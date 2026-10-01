// Exportação de leads do CRM em SEGUNDO PLANO (Central de Execuções, 30/09/2026).
// O kanban exporta direto no navegador até 2.000 leads. Acima disso chama esta função
// com a lista de ids (o que está na tela, com os filtros aplicados): ela cria a
// execução (crm_executions, kind 'lead_export'), responde na hora e monta o CSV em
// blocos de 500, gravando o progresso. O arquivo vai pro bucket privado crm-execucoes
// em <staff_id>/<execution_id>/<arquivo>.csv e a tela baixa por link assinado.
// Mesmas colunas do export do kanban. Só master e admin exportam (a base é dado sensível).
// Cancelar pela Central muda o status da execução; o próximo bloco percebe e para.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-impulso-secret" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const BUCKET = "crm-execucoes";
const BLOCO = 500;
const MAX_IDS = 200_000;
const BUDGET_MS = 130_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = ["nome", "empresa", "telefone", "email", "documento", "etapa", "origem", "responsavel", "valor",
  "criado_em", "ultima_atividade", "campanha", "conjunto", "anuncio", "tags"];
const HEAD = ["Nome", "Empresa", "Telefone", "Email", "Documento", "Etapa", "Origem", "Responsavel", "Valor",
  "Criado em", "Ultima atividade", "Campanha", "Conjunto", "Anuncio", "Tags"];
const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE);

  const body = await req.json().catch(() => ({}));
  // Quem pede: o usuário logado (tela) ou uma chamada interna com o segredo do motor
  // (x-impulso-secret) dizendo em nome de qual staff exporta. Nos dois casos, só master/admin.
  const interno = Deno.env.get("IMPULSO_SECRET");
  let staffQuery = supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true);
  if (interno && req.headers.get("x-impulso-secret") === interno && typeof body?.staff_id === "string") {
    staffQuery = staffQuery.eq("id", body.staff_id);
  } else {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return json({ error: "Não autorizado" }, 401);
    staffQuery = staffQuery.eq("user_id", u.user.id);
  }
  const { data: staff } = await staffQuery.maybeSingle();
  if (!staff || !["master", "admin"].includes(staff.role)) return json({ error: "Sem permissão para exportar" }, 403);

  const ids: string[] = Array.isArray(body?.lead_ids) ? [...new Set((body.lead_ids as unknown[]).map(String).filter((x) => UUID.test(x)))] : [];
  if (!ids.length) return json({ error: "Nenhum lead pra exportar" }, 400);
  if (ids.length > MAX_IDS) return json({ error: `Muitos leads de uma vez (máximo ${MAX_IDS})` }, 400);
  const nome = String(body?.filename || "leads").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "leads";
  const arquivo = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;

  const { data: exec, error } = await supabase.from("crm_executions").insert({
    kind: "lead_export", title: String(body?.title || `Exportação de ${ids.length} leads`).slice(0, 160), status: "running",
    total: ids.length, started_by: staff.id, started_by_name: staff.name, started_at: new Date().toISOString(),
    params: { filename: arquivo },
  }).select("id").single();
  if (error || !exec) return json({ error: "Não consegui registrar a execução" }, 500);

  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(exportar(supabase, exec.id, staff.id, ids, arquivo));
  return json({ ok: true, execution_id: exec.id, total: ids.length });
});

async function exportar(supabase: any, execId: string, staffId: string, ids: string[], arquivo: string) {
  const inicio = Date.now();
  const partes: string[] = [HEAD.map(esc).join(";")];
  let feitos = 0;
  try {
    for (let i = 0; i < ids.length; i += BLOCO) {
      if (Date.now() - inicio > BUDGET_MS) throw new Error("A exportação passou do tempo limite. Filtre o funil e exporte em partes.");
      const bloco = ids.slice(i, i + BLOCO);
      const { data, error } = await supabase.rpc("crm_export_leads_rows", { p_ids: bloco });
      if (error) throw new Error(error.message);
      for (const r of (data || []) as Record<string, unknown>[]) partes.push(COLS.map((c) => esc(r[c])).join(";"));
      feitos += (data || []).length;
      // só continua se a execução ainda estiver rodando (Cancelar muda o status)
      const { data: vivo } = await supabase.from("crm_executions")
        .update({ done: feitos, skipped: Math.min(i + bloco.length, ids.length) - feitos, updated_at: new Date().toISOString() })
        .eq("id", execId).eq("status", "running").select("id");
      if (!vivo?.length) return;
    }
    const path = `${staffId}/${execId}/${arquivo}`;
    // BOM: o Excel em pt-BR precisa dele pra não quebrar os acentos
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, new Blob(["﻿" + partes.join("\r\n")], { type: "text/csv;charset=utf-8" }), { upsert: true, contentType: "text/csv;charset=utf-8" });
    if (upErr) throw new Error(`Não consegui gravar o arquivo: ${upErr.message}`);
    await supabase.from("crm_executions").update({
      status: "done", done: feitos, skipped: ids.length - feitos, result_path: path, result_name: arquivo,
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", execId).eq("status", "running");
  } catch (e) {
    console.error("[crm-export-leads]", execId, e);
    await supabase.from("crm_executions").update({
      status: "failed", error: String((e as Error)?.message || e).slice(0, 400), done: feitos,
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", execId).eq("status", "running");
  }
}
