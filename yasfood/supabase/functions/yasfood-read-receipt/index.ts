// yasfood-read-receipt — lê a foto da nota/cupom de compra de insumos e devolve os itens
// casados com o estoque, pra Yasmim conferir e lançar (estoque + despesa) de uma vez.
// Só admin chama (JWT verificado + yasfood.admins).
//
//   POST { images: [{ media_type, data: <base64> }], hint?: string }
//   → { receipt: { supplier, purchased_on, total, items: [...], doubts, confidence } }
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = Deno.env.get("YASFOOD_READ_ORDER_MODEL") || "claude-opus-5-5";
const MAX_IMAGES = 6;
const MAX_B64 = 7_000_000;

type Img = { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };

const nullable = (t: "string" | "number", description: string) => ({ anyOf: [{ type: t }, { type: "null" }], description });
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["supplier", "purchased_on", "total", "items", "doubts", "confidence"],
  properties: {
    supplier: nullable("string", "Nome da loja/mercado como aparece no cupom (curto, ex.: Atacadão, Super Nosso)"),
    purchased_on: nullable("string", "Data da compra em YYYY-MM-DD, se aparecer no cupom"),
    total: nullable("number", "Valor total do cupom em reais, se aparecer"),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "ingredient_name", "packs", "pack_size", "unit", "total_price", "relevant"],
        properties: {
          description: { type: "string", description: "Linha como está no cupom (abreviações incluídas)" },
          ingredient_name: nullable("string", "Nome EXATO de um insumo do estoque que corresponde a esta linha, ou null se não corresponder a nenhum"),
          packs: { type: "number", description: "Quantas embalagens/unidades foram compradas (a coluna de quantidade do cupom)" },
          pack_size: nullable("number", "Quanto vem em cada embalagem, JÁ CONVERTIDO pra unidade do insumo do estoque (ex.: insumo em g e pacote de 1 kg → 1000; dúzia de ovos em un → 12). Null se não der pra saber"),
          unit: { anyOf: [{ type: "string", enum: ["g", "kg", "ml", "l", "un"] }, { type: "null" }], description: "Unidade em que pack_size está expresso (deve ser a unidade do insumo do estoque quando casou)" },
          total_price: nullable("number", "Valor total pago nesta linha (quantidade × preço), em reais"),
          relevant: { type: "boolean", description: "true se é insumo de confeitaria/cozinha que faz sentido no estoque; false pra itens pessoais (sabão, refrigerante pra casa, etc.)" },
        },
      },
    },
    doubts: { type: "array", items: { type: "string" }, description: "Pontos que a confeiteira precisa conferir, em frases curtas (ex.: linha ilegível, item sem insumo correspondente)" },
    confidence: { type: "string", enum: ["alta", "media", "baixa"] },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "Método não permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401);
    if (!ANTHROPIC_API_KEY) return j({ error: "Leitura de notas indisponível: ANTHROPIC_API_KEY não configurada no projeto." }, 500);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Não autenticado" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { db: { schema: "yasfood" }, global: { headers: { Authorization: auth } } });
    const { data: isAdmin, error: adminErr } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminErr) return j({ error: `Não consegui conferir a permissão: ${adminErr.message}` }, 500);
    if (!isAdmin) return j({ error: "Só a administradora pode ler notas." }, 403);

    const body = await req.json().catch(() => null) as { images?: Img[]; hint?: string } | null;
    const images = (body?.images ?? []).filter((i) => i && typeof i.data === "string" && i.data.length > 0).slice(0, MAX_IMAGES);
    if (!images.length) return j({ error: "Mande pelo menos uma foto da nota." }, 400);
    for (const im of images) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(im.media_type)) return j({ error: `Formato não suportado: ${im.media_type}` }, 400);
      if (im.data.length > MAX_B64) return j({ error: "Foto muito grande. Tente de novo." }, 400);
    }

    const { data: ingredients, error: ingErr } = await db.from("ingredients").select("name, unit, pack_size, pack_label, supplier").eq("active", true).order("name");
    if (ingErr) return j({ error: `Não consegui ler o estoque: ${ingErr.message}` }, 500);

    const system = `Você lê fotos de cupom fiscal / nota de compra de uma confeiteira caseira e extrai os itens pra dar entrada no estoque. Ela confere antes de lançar: prefira deixar null e registrar em "doubts" a inventar.

Regras:
- Uma linha do cupom = um item. Quantidade é a coluna de quantidade (ex.: "3 UN", "2,000 KG"). Se vendido por peso (KG), packs = 1 e pack_size = o peso total convertido pra unidade do insumo.
- Case cada linha com o nome EXATO de um insumo do estoque abaixo (abreviações de cupom: "FAR TRIGO" = Farinha de trigo, "ACUCAR REF" = Açúcar, "LEITE COND" = Leite condensado, "CHOC PO" = Chocolate em pó, "OVOS DZ" = Ovos). Se não casar com nenhum, ingredient_name null.
- pack_size SEMPRE na unidade do insumo do estoque: estoque em g e pacote de 1 kg → 1000 (unit "g"); estoque em ml e garrafa de 900 ml → 900; ovos em un e "DZ" → 12. Se o cupom não diz o tamanho, use o tamanho padrão do insumo do estoque (pack_size do catálogo) e avise em doubts.
- total_price é o valor da linha (quantidade × unitário), não o unitário.
- Itens que não são insumo de cozinha (limpeza, pessoal) → relevant false.
- Várias fotos podem ser a mesma nota em partes: junte sem duplicar linhas.
- Valores em reais, ponto decimal.

Insumos do estoque (nome exato · unidade · tamanho padrão da embalagem · onde costuma comprar):
${(ingredients ?? []).map((i: { name: string; unit: string; pack_size: number | null; pack_label: string; supplier: string }) => `- ${i.name} · ${i.unit}${i.pack_size ? ` · ${i.pack_label} de ${i.pack_size} ${i.unit}` : ""}${i.supplier ? ` · ${i.supplier}` : ""}`).join("\n") || "- (vazio)"}`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const content: Anthropic.ContentBlockParam[] = [
      ...images.map((im): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
      { type: "text", text: `${images.length > 1 ? `São ${images.length} fotos da mesma nota. ` : ""}Extraia os itens.${body?.hint ? ` Observação da confeiteira: ${body.hint}` : ""}` },
    ];
    const params = { model: MODEL, max_tokens: 6000, system, messages: [{ role: "user" as const, content }], betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
    let response: Anthropic.Beta.BetaMessage;
    let viaSchema = true;
    try {
      response = await client.beta.messages.create({ ...params, output_config: { effort: "medium", format: { type: "json_schema", schema: RECEIPT_SCHEMA } } });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError) || !/output_config|format|schema/i.test(e.message)) throw e;
      viaSchema = false;
      response = await client.beta.messages.create({ ...params, system: `${system}\n\nResponda SOMENTE com um JSON válido neste formato:\n${JSON.stringify(RECEIPT_SCHEMA)}`, output_config: { effort: "medium" } });
    }
    if (response.stop_reason === "refusal") return j({ error: "A IA não conseguiu ler essa nota. Tente outra foto." }, 422);
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    let receipt: unknown;
    try { receipt = JSON.parse(viaSchema ? text : text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")); } catch { return j({ error: "A IA devolveu um formato inesperado. Tente de novo." }, 502); }
    return j({ receipt, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens, model: response.model } });
  } catch (e) {
    const msg = e instanceof Anthropic.RateLimitError ? "A IA está ocupada. Tente de novo em instantes."
      : e instanceof Anthropic.APIError ? `Erro da IA (${e.status}): ${e.message}`
      : (e as Error).message || "Erro inesperado";
    console.error("[yasfood-read-receipt]", e);
    return j({ error: msg }, 500);
  }
});
