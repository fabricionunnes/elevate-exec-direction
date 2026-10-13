// ============================================================
// crm-prospect-search (UNV Nexus)
// Ponte pro módulo de Prospecção B2B do UNV Sales: mesma base de CNPJs da
// Receita Federal, mesma validação de WhatsApp — mas SEM cobrança, porque
// aqui é uso interno da UNV. O UNV Sales só devolve os dados; quem cria os
// leads é este lado, direto no banco do Nexus.
//
// Ações (POST { action, ... }):
//   contar    { filtros }                                    → grátis, sempre
//   executar  { filtros, quantidade, modo, pipeline_id, stage_id?, owner_staff_id? }
//              → busca (e valida WhatsApp se modo="whatsapp") no UNV Sales,
//                cria os leads aqui, sem gerar nenhum custo.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const erro = (code: string, detail: string, s = 400) => json({ error: code, detail }, s);

const UNV_SALES_URL = Deno.env.get("UNVSALES_PROSPECT_URL")
  ?? "https://fvruacjgxojjayvjulmd.supabase.co/functions/v1/prospect-search";
const TOKEN = Deno.env.get("PROSPECT_INTERNAL_TOKEN") ?? "";
const PORTES: Record<string, string> = { "01": "Microempresa", "03": "Pequena empresa", "05": "Média/grande", "00": "Não informado" };

async function chamarUnvSales(body: Record<string, unknown>) {
  const r = await fetch(UNV_SALES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-prospect-token": TOKEN },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, ...j };
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const cnpjFormatado = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

// Troca o erro técnico do banco por algo que dá pra agir.
function motivoBusca(detail: unknown, padrao: string) {
  const d = String(detail || "");
  if (/statement timeout|canceling statement/i.test(d)) {
    return "A busca demorou demais com esse filtro. Escolha um estado ou diminua a quantidade e tente de novo.";
  }
  return d || padrao;
}

// Quais desses CNPJs já são lead no CRM (confere com e sem pontuação).
async function jaNoCrm(admin: any, cnpjs: string[]): Promise<Set<string>> {
  const achados = new Set<string>();
  const unicos = [...new Set(cnpjs.filter((c) => c.length === 14))];
  for (let i = 0; i < unicos.length; i += 100) {
    const lote = unicos.slice(i, i + 100);
    const { data } = await admin.from("crm_leads").select("document")
      .in("document", [...lote, ...lote.map(cnpjFormatado)]).limit(1000);
    for (const x of data ?? []) achados.add(soDigitos(x.document));
  }
  return achados;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return erro("method_not_allowed", "Requisição inválida.", 405);
  if (!TOKEN) return erro("nao_configurado", "A ponte com o UNV Sales não está configurada. Avise o suporte.", 500);

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: caller } = await userClient.auth.getUser();
    if (!caller?.user) return erro("unauthorized", "Sua sessão expirou. Entre de novo.", 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: staff } = await admin.from("onboarding_staff").select("id").eq("user_id", caller.user.id).eq("is_active", true).maybeSingle();
    if (!staff) return erro("sem_permissao", "Você não tem acesso ao CRM.", 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const filtros = (body.filtros && typeof body.filtros === "object") ? body.filtros : {};

    if (action === "contar") {
      // Só conta (ação leve "contar_interno" do UNV Sales). Antes buscava até 1000
      // empresas só pra saber o tamanho e estourava o tempo em segmento grande com
      // filtro de porte (23/09/2026). Empresa que já está no CRM é pulada na hora
      // de enviar pro funil, não aqui.
      const r2 = await chamarUnvSales({ action: "contar_interno", filtros });
      if (!r2.ok) return erro("falha_busca", motivoBusca(r2.detail, "Não foi possível contar."));
      return json({ ok: true, total: Number(r2.total ?? 0), teto: !!r2.teto });
    }

    if (action === "cnaes") {
      const r = await chamarUnvSales({ action: "cnaes_interno", texto: body.texto ?? null });
      return json(r);
    }
    if (action === "municipios") {
      const r = await chamarUnvSales({ action: "municipios_interno", uf: body.uf, texto: body.texto ?? null });
      return json(r);
    }

    if (action !== "executar") return erro("acao_invalida", "Ação desconhecida.");

    const modo = body.modo === "whatsapp" ? "whatsapp" : "lista";
    const quantidade = Math.min(1000, Math.max(1, Number(body.quantidade ?? 100)));
    const pipelineId = String(body.pipeline_id || "");
    if (!pipelineId) return erro("funil_obrigatorio", "Escolha o funil que vai receber as empresas.");

    const { data: pipeline } = await admin.from("crm_pipelines").select("id, name").eq("id", pipelineId).maybeSingle();
    if (!pipeline) return erro("funil_invalido", "Esse funil não existe.");
    let stageId = body.stage_id ? String(body.stage_id) : null;
    if (!stageId) {
      const { data: st } = await admin.from("crm_stages").select("id").eq("pipeline_id", pipelineId).order("sort_order").limit(1).maybeSingle();
      stageId = st?.id ?? null;
    }
    if (!stageId) return erro("funil_sem_etapas", "O funil escolhido não tem etapas.");

    // O UNV Sales não sabe o que o Nexus já usou (aqui não há tenant/carteira pra
    // rastrear isso do lado dele), então quem tira as repetidas é este lado.
    //
    // 13/10/2026: a busca pedia sempre o triplo (e o UNV Sales triplica de novo pra
    // validar WhatsApp), ou seja, 900 empresas pra entregar 100. Em filtro raro
    // (ex.: estética + pequena empresa sem MEI) o banco levava 47s e a tela
    // mostrava "non-2xx". Agora pede uma folga pequena e só vai buscar mais fundo
    // se faltar empresa e ainda houver tempo.
    // A conferência de duplicado lia crm_leads inteiro, mas a API devolve no máximo
    // 1000 linhas e o CRM tem 47 mil leads com CNPJ: quase nada era conferido.
    // Agora pergunta só pelos CNPJs que vieram na busca.
    const inicio = Date.now();
    const empresas: any[] = [];
    const vistos = new Set<string>();
    const teto = 1000; // teto de uma pesquisa no UNV Sales
    const pedidos = [...new Set([Math.min(teto, Math.ceil(quantidade * 1.3) + 10), Math.min(teto, quantidade * 3)])];
    let falha = "";
    for (let i = 0; i < pedidos.length; i++) {
      if (i > 0 && (empresas.length >= quantidade || Date.now() - inicio > 35_000)) break;
      const r = await chamarUnvSales({ action: "buscar_interno", filtros, quantidade: pedidos[i], modo });
      if (!r.ok) { falha = motivoBusca(r.detail, "Não foi possível buscar."); break; }
      const vieram: any[] = (r.empresas ?? []).filter((e: any) => !vistos.has(soDigitos(e.cnpj)));
      const repetidas = await jaNoCrm(admin, vieram.map((e) => soDigitos(e.cnpj)));
      for (const e of vieram) {
        const cnpj = soDigitos(e.cnpj);
        vistos.add(cnpj);
        if (repetidas.has(cnpj)) continue;
        if (empresas.length < quantidade) empresas.push(e);
      }
      // na lista simples, vir menos do que foi pedido quer dizer que a base acabou
      if (modo === "lista" && (r.empresas ?? []).length < pedidos[i]) break;
    }
    if (empresas.length === 0) {
      if (falha) return erro("falha_busca", falha);
      return erro(modo === "whatsapp" ? "sem_whatsapp" : "nada_encontrado",
        modo === "whatsapp"
          ? "Nenhuma empresa NOVA com esse filtro tem WhatsApp confirmado (as que bateram já estão no CRM)."
          : "Nenhuma empresa NOVA bate com esse filtro (as que bateram já estão no CRM).");
    }

    const itens: any[] = []; const erros: string[] = [];
    for (const e of empresas) {
      const socio = e.socio_principal as string | undefined;
      const notas = [
        `Prospecção B2B (via UNV Sales) — ${pipeline.name}`,
        `CNPJ ${e.cnpj_formatado} · ${e.cnae_descricao ?? ""}`,
        `Porte: ${PORTES[e.porte] ?? e.porte ?? "—"} · Abertura: ${e.data_inicio ?? "—"} · ${e.cidade ?? ""}/${e.uf ?? ""}`,
        (e.socios ?? []).length ? `Sócios: ${e.socios.join(", ")}` : "",
        modo === "whatsapp" ? "WhatsApp confirmado" : "",
      ].filter(Boolean).join("\n");

      const { error: lErr } = await admin.from("crm_leads").insert({
        name: socio ? socio.split(" ").slice(0, 2).join(" ") : e.nome,
        company: e.nome, phone: e.telefone ? String(e.telefone).replace(/\D/g, "") : null, // 55DDD9XXXXXXXX sem "+", como o resto do CRM
        email: e.email || null, document: e.cnpj, city: e.cidade, state: e.uf, segment: e.cnae_descricao,
        origin: "Prospecção B2B", pipeline_id: pipelineId, stage_id: stageId,
        owner_staff_id: body.owner_staff_id || staff.id, notes: notas,
        legal_representative_name: socio || null, created_by: staff.id,
      });
      if (lErr) { erros.push(lErr.message); continue; }
      itens.push(e.cnpj);
    }

    if (itens.length === 0) return erro("falha_gravar", "As empresas foram encontradas mas não deu para gravar: " + (erros[0] ?? ""), 500);
    const { data: origemDoFunil } = await admin.from("crm_origins").select("id")
      .eq("pipeline_id", pipelineId).eq("is_active", true).order("sort_order", { ascending: true, nullsFirst: false }).limit(1).maybeSingle();
    return json({ ok: true, pipeline: pipeline.name, pipeline_id: pipelineId, origin_id: origemDoFunil?.id ?? null,
      encontradas: empresas.length, entregues: itens.length, modo });
  } catch (e) {
    return erro("unexpected", "Erro inesperado: " + String(e), 500);
  }
});
