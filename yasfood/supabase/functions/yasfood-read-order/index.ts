// yasfood-read-order — lê prints de conversa do WhatsApp e devolve o pedido estruturado
// pra Yasmim conferir e salvar. Só admin do YasFood chama (JWT verificado + yasfood.admins).
//
//   POST { images: [{ media_type: "image/jpeg"|"image/png"|"image/webp", data: <base64> }], hint?: string }
//   → { order: {...}, usage: {...} }
//   Segunda rodada (dúvidas respondidas pela Yasmim):
//   POST { images, previous: <order da rodada anterior>, answers: [{ question, answer }] }
//   → { order } atualizado, com as dúvidas resolvidas removidas
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
const MAX_B64 = 7_000_000; // ~5 MB por imagem (limite da API)

type Img = { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };

// O que o modelo devolve. Tudo que não estiver nos prints vem null; dúvidas vão em "doubts".
// Subconjunto conservador de JSON Schema (sem type em lista, sem minimum): nullable via anyOf.
const nullable = (t: "string" | "number", description: string) => ({ anyOf: [{ type: t }, { type: "null" }], description });
const ORDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["customer_name", "phone", "fulfillment", "zone_name", "address", "reference", "scheduled_date", "window_label", "time_text", "payment_method", "change_for", "items", "notes", "doubts", "confidence"],
  properties: {
    customer_name: nullable("string", "Nome do cliente como aparece no topo da conversa ou como ele se apresenta"),
    phone: nullable("string", "Telefone do cliente só com dígitos, com DDD (ex.: 31999991234). Null se não aparecer"),
    fulfillment: { type: "string", enum: ["entrega", "retirada", "indefinido"] },
    zone_name: nullable("string", "Nome EXATO de uma região do catálogo, ou null"),
    address: nullable("string", "Endereço de entrega como o cliente escreveu (rua, número, casa/apto, condomínio)"),
    reference: nullable("string", "Ponto de referência ou instrução de entrega"),
    scheduled_date: nullable("string", "Data da entrega/retirada em YYYY-MM-DD, resolvida a partir de 'amanhã', 'sexta', 'dia 12' etc. usando a data de hoje informada"),
    window_label: nullable("string", "Rótulo EXATO de um horário do catálogo (ex.: 14:00–17:00) que combine com o que o cliente pediu, ou null"),
    time_text: nullable("string", "Horário como o cliente escreveu (ex.: 'de tarde', '15h')"),
    payment_method: { anyOf: [{ type: "string", enum: ["pix", "dinheiro", "cartao"] }, { type: "null" }], description: "pix, dinheiro ou cartao; null se não aparecer" },
    change_for: nullable("number", "Troco pra quanto, se pagamento em dinheiro"),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["product_name", "raw_text", "qty"],
        properties: {
          product_name: nullable("string", "Nome EXATO de um produto do catálogo, ou null se não casar com nenhum"),
          raw_text: { type: "string", description: "Como o cliente escreveu o item" },
          qty: { type: "integer", description: "Quantidade, 1 ou mais" },
        },
      },
    },
    notes: nullable("string", "Observações relevantes do cliente (sem lactose, bilhete, recado, etc.)"),
    doubts: { type: "array", items: { type: "string" }, description: "Cada ponto que a Yasmim precisa confirmar antes de salvar, em uma frase curta" },
    confidence: { type: "string", enum: ["alta", "media", "baixa"] },
  },
} as const;

function weekdayBR(d: Date) {
  return ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][d.getDay()];
}
function todayBR() {
  // data de hoje no fuso de São Paulo
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return s; // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "Método não permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401);
    if (!ANTHROPIC_API_KEY) return j({ error: "Leitura de prints indisponível: a chave da IA (ANTHROPIC_API_KEY) não está configurada no projeto Supabase." }, 500);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Não autenticado" }, 401);

    // Lê o banco com o login da própria Yasmim (RLS + grants do schema yasfood valem pra "authenticated").
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { db: { schema: "yasfood" }, global: { headers: { Authorization: auth } } });
    const { data: isAdmin, error: adminErr } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminErr) return j({ error: `Não consegui conferir a permissão: ${adminErr.message}` }, 500);
    if (!isAdmin) return j({ error: "Só a administradora pode ler prints." }, 403);

    const body = await req.json().catch(() => null) as { images?: Img[]; hint?: string; previous?: unknown; answers?: { question: string; answer: string }[] } | null;
    const images = (body?.images ?? []).filter((i) => i && typeof i.data === "string" && i.data.length > 0).slice(0, MAX_IMAGES);
    const answers = (body?.answers ?? []).filter((a) => a && typeof a.question === "string" && typeof a.answer === "string" && a.answer.trim()).slice(0, 20);
    const previous = body?.previous && typeof body.previous === "object" ? body.previous : null;
    if (!images.length && !previous) return j({ error: "Mande pelo menos um print." }, 400);
    for (const im of images) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(im.media_type)) return j({ error: `Formato não suportado: ${im.media_type}` }, 400);
      if (im.data.length > MAX_B64) return j({ error: "Print muito grande. O app reduz sozinho; tente de novo." }, 400);
    }

    // catálogo pra o modelo casar nomes exatos
    const [prodRes, zoneRes, winRes, setRes] = await Promise.all([
      admin.from("products").select("name, price, description").eq("active", true).order("sort_order"),
      admin.from("delivery_zones").select("name, fee, notes").eq("active", true).order("sort_order"),
      admin.from("delivery_windows").select("label, start_time, end_time, weekdays, applies_to").eq("active", true).order("sort_order"),
      admin.from("settings").select("pickup_enabled, pickup_address, business_name, read_order_notes").eq("id", 1).maybeSingle(),
    ]);
    const dbErr = prodRes.error ?? zoneRes.error ?? winRes.error ?? setRes.error;
    if (dbErr) return j({ error: `Não consegui ler o cardápio: ${dbErr.message}` }, 500);
    const products = prodRes.data, zones = zoneRes.data, windows = winRes.data, settings = setRes.data;
    const hm = (t: string) => String(t).slice(0, 5);
    const wds = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const today = todayBR();
    const base = new Date(`${today}T12:00:00-03:00`);
    const proximos = Array.from({ length: 15 }, (_, i) => { const d = new Date(base.getTime() + i * 86400000); const iso = d.toISOString().slice(0, 10); return `${iso} = ${weekdayBR(d)}${i === 0 ? " (hoje)" : i === 1 ? " (amanhã)" : ""}`; }).join("\n");

    const system = `Você lê prints de conversas de WhatsApp entre a confeiteira (${settings?.business_name ?? "Yas Delícias"}) e um cliente e extrai o pedido pra ser lançado no sistema. A confeiteira vai conferir tudo antes de salvar: prefira deixar um campo null e registrar a dúvida em "doubts" a inventar.

Regras:
- As mensagens do lado direito (balão verde) são da confeiteira; as do lado esquerdo são do cliente. O nome no topo da conversa é o do cliente.
- Quantidade: se o cliente pediu "2 bolos", qty 2. Se pediu "um com cobertura e um sem", dois itens de qty 1.
- Produto: case com o nome EXATO do catálogo abaixo. "Com cobertura" e "sem cobertura" são produtos diferentes. Se não casar, product_name null e explique em doubts.
- Data: resolva expressões relativas usando a tabela de datas. "Sexta" = a próxima sexta a partir de hoje (se hoje for sexta e ele disser "sexta", registre dúvida). Se não houver data, null e dúvida.
- Horário: case com o rótulo EXATO de um horário do catálogo quando o que o cliente pediu cabe nele (ex.: "de tarde" → 14:00–17:00). Senão null e time_text com o que ele escreveu.
- Entrega x retirada: "vou buscar" = retirada. Endereço informado = entrega. Sem indicação = "indefinido".
- Região: case com o nome EXATO de uma região do catálogo a partir do condomínio citado. Em dúvida, null.
- Pagamento: pix, dinheiro ou cartao. Se mandou comprovante de Pix, payment_method pix e anote em notes "comprovante enviado".
- Telefone: só se aparecer na tela (no topo ou na mensagem). Não invente.
- Vários prints podem ser a mesma conversa em sequência: junte tudo num pedido só. Se parecerem conversas diferentes, use a mais recente e avise em doubts.
- Não inclua em notes o que já está nos outros campos.

O que vale como dúvida (doubts). Pergunte SÓ quando faltar ou estiver ambíguo algo que muda o pedido: qual produto (com ou sem cobertura), quantidade, data, entrega ou retirada, endereço quando é entrega. Fora disso, decida e siga. Nunca peça pra "confirmar" o que já deu pra concluir. Em especial, NÃO pergunte sobre:
- Região: use o condomínio citado e as observações das regiões abaixo. Se não der pra saber, deixe zone_name null sem pergunta (a confeiteira escolhe na tela).
- Horário: se o horário pedido cai dentro de uma janela do catálogo, use a janela e pronto. Se não cai em nenhuma, use a janela mais próxima e anote o horário pedido em time_text. Sem pergunta.
- Pagamento: Pix sem comprovante é pedido ainda não pago; não é dúvida. Comprovante na conversa: anote "comprovante enviado" em notes.
- Data relativa: "amanhã", "sexta" contam a partir de hoje (a data de hoje está abaixo). Prints de WhatsApp quase nunca mostram a data das mensagens; assuma que são de hoje. Sem pergunta.
- Telefone ausente ou nome incompleto: não é dúvida.

Hoje é ${today} (${weekdayBR(base)}), fuso de São Paulo.
Datas dos próximos dias:
${proximos}

Catálogo de produtos:
${(products ?? []).map((p: { name: string; price: number; description?: string }) => `- ${p.name} (R$ ${Number(p.price).toFixed(2)})${p.description ? ` — ${p.description}` : ""}`).join("\n") || "- (vazio)"}

Regiões de entrega (com observações que ajudam a casar o condomínio):
${(zones ?? []).map((z: { name: string; fee: number; notes?: string | null }) => `- ${z.name} (frete R$ ${Number(z.fee).toFixed(2)})${z.notes ? ` — ${z.notes}` : ""}`).join("\n") || "- (vazio)"}

Horários (rótulo exato = início–fim):
${(windows ?? []).map((w: { label: string; start_time: string; end_time: string; weekdays: number[]; applies_to: string }) => `- ${hm(w.start_time)}–${hm(w.end_time)}${w.label ? ` (${w.label})` : ""} · ${(w.weekdays ?? []).map((d: number) => wds[d]).join(", ")} · ${w.applies_to}`).join("\n") || "- (sem horários fixos)"}

Retirada no local: ${settings?.pickup_enabled ? `permitida${settings?.pickup_address ? ` em ${settings.pickup_address}` : ""}` : "não oferecida"}.${settings?.read_order_notes?.trim() ? `\n\nO que a confeiteira já ensinou (vale mais que qualquer regra acima):\n${settings.read_order_notes.trim()}` : ""}`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const pedido = previous && answers.length
      ? `Você já fez uma leitura destes prints e devolveu este pedido:\n${JSON.stringify(previous)}\n\nA confeiteira respondeu às dúvidas:\n${answers.map((a) => `- Pergunta: ${a.question}\n  Resposta: ${a.answer.trim()}`).join("\n")}\n\nAtualize o pedido com as respostas (elas valem mais que os prints quando houver conflito), remova de "doubts" tudo que ficou resolvido e mantenha o resto como estava. Se uma resposta abrir uma dúvida nova, liste só ela.`
      : `${images.length > 1 ? `São ${images.length} prints, na ordem em que foram enviados. ` : ""}Extraia o pedido.`;
    const content: Anthropic.ContentBlockParam[] = [
      ...images.map((im): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
      { type: "text", text: `${pedido}${body?.hint ? ` Observação da confeiteira: ${body.hint}` : ""}` },
    ];

    const params = {
      model: MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: "user" as const, content }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    };
    let response: Anthropic.Beta.BetaMessage;
    let viaSchema = true;
    try {
      response = await client.beta.messages.create({ ...params, output_config: { effort: "medium", format: { type: "json_schema", schema: ORDER_SCHEMA } } });
    } catch (e) {
      // a validação do formato muda com o tempo: se a API recusar o schema, pede o JSON no texto e extrai
      if (!(e instanceof Anthropic.BadRequestError) || !/output_config|format|schema/i.test(e.message)) throw e;
      console.warn("[yasfood-read-order] schema recusado, caindo pra JSON no texto:", e.message.slice(0, 200));
      viaSchema = false;
      response = await client.beta.messages.create({
        ...params,
        system: `${system}\n\nResponda SOMENTE com um JSON válido (sem markdown, sem comentários) exatamente neste formato:\n${JSON.stringify(ORDER_SCHEMA)}`,
        output_config: { effort: "medium" },
      });
    }

    if (response.stop_reason === "refusal") return j({ error: "A IA não conseguiu ler esses prints. Tente outros prints ou lance o pedido manualmente." }, 422);
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    let order: unknown;
    try {
      const raw = viaSchema ? text : text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1");
      order = JSON.parse(raw);
    } catch { return j({ error: "A IA devolveu um formato inesperado. Tente de novo." }, 502); }

    return j({ order, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens, model: response.model } });
  } catch (e) {
    const msg = e instanceof Anthropic.RateLimitError ? "A IA está ocupada. Tente de novo em instantes."
      : e instanceof Anthropic.AuthenticationError ? "Chave da IA inválida no projeto Supabase."
      : e instanceof Anthropic.APIError ? `Erro da IA (${e.status}): ${e.message}`
      : (e as Error).message || "Erro inesperado";
    console.error("[yasfood-read-order]", e);
    return j({ error: msg }, 500);
  }
});
