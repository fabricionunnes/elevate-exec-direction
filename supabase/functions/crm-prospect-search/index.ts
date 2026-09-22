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
      const r = await chamarUnvSales({ action: "buscar_interno", filtros, quantidade: 1, modo: "lista" });
      if (!r.ok) return erro("falha_busca", r.detail || "Não foi possível contar.");
      // "buscar_interno" já limita a 1000 (o teto de uma pesquisa); pra contar de
      // verdade pedimos o teto e devolvemos o tamanho — suficiente pra decidir a busca
      const r2 = await chamarUnvSales({ action: "buscar_interno", filtros, quantidade: 1000, modo: "lista" });
      if (!r2.ok) return erro("falha_busca", r2.detail || "Não foi possível contar.");
      const total = (r2.empresas ?? []).length;
      return json({ ok: true, total, teto: total >= 1000 });
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

    const r = await chamarUnvSales({ action: "buscar_interno", filtros, quantidade, modo });
    if (!r.ok) return erro("falha_busca", r.detail || "Não foi possível buscar.");
    const empresas: any[] = r.empresas ?? [];
    if (empresas.length === 0) {
      return erro(modo === "whatsapp" ? "sem_whatsapp" : "nada_encontrado",
        modo === "whatsapp" ? "Nenhuma empresa com esse filtro tem WhatsApp confirmado." : "Nenhuma empresa bate com esse filtro.");
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
        company: e.nome, phone: e.telefone ? "+" + String(e.telefone).replace(/^\+/, "") : null,
        email: e.email || null, document: e.cnpj, city: e.cidade, state: e.uf, segment: e.cnae_descricao,
        origin: "Prospecção B2B", pipeline_id: pipelineId, stage_id: stageId,
        owner_staff_id: body.owner_staff_id || staff.id, notes: notas,
        legal_representative_name: socio || null, created_by: staff.id,
      });
      if (lErr) { erros.push(lErr.message); continue; }
      itens.push(e.cnpj);
    }

    if (itens.length === 0) return erro("falha_gravar", "As empresas foram encontradas mas não deu para gravar: " + (erros[0] ?? ""), 500);
    return json({ ok: true, pipeline: pipeline.name, encontradas: empresas.length, entregues: itens.length, modo });
  } catch (e) {
    return erro("unexpected", "Erro inesperado: " + String(e), 500);
  }
});
