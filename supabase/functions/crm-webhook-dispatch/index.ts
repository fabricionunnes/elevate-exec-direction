// Webhooks de saída do CRM (crm_outbound_webhooks / crm_outbound_webhook_deliveries), 01/10/2026.
// Os gatilhos em crm_leads e crm_meeting_events só enfileiram; quem entrega é esta function.
//
// Duas formas de chamar:
//  1) pg_cron a cada minuto (só quando há fila), com o header x-webhook-dispatch-secret.
//     O segredo vive em app_secrets e é conferido pela RPC crm_webhook_dispatch_auth.
//     Corpo opcional: { dry_run: true } só conta o que sairia.
//  2) A tela (Configurações > API e Webhooks), com o JWT de um master/admin da UNV:
//     { action: "test", webhook_id }   manda um payload de exemplo pra URL agora
//     { action: "retry", delivery_id } reenvia uma entrega agora
//
// Entrega: POST com o corpo JSON e X-UNV-Signature = HMAC-SHA256 (hex) do corpo com o
// segredo do webhook. Timeout de 10 s. Qualquer resposta fora de 2xx conta como falha.
// 5 tentativas com espera crescente (1 min, 5 min, 30 min, 2 h) e depois vira "failed".
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-dispatch-secret",
};
const json = (p: unknown, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const APP_URL = "https://unvholdings.com.br";
const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 30, 120]; // espera depois da 1ª, 2ª, 3ª e 4ª falha
const LOTE = 40;
const PARALELO = 8;

type Delivery = {
  id: string; webhook_id: string; event: string; payload: any; status: string;
  attempts: number; is_test: boolean; created_at: string;
};
type Webhook = { id: string; name: string; url: string; secret: string; is_active: boolean };

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Só http(s) pra fora: nada de localhost, rede interna ou metadados de nuvem.
function urlBloqueada(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "URL inválida"; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "URL precisa ser http ou https";
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return "Endereço interno não é permitido";
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return "Endereço interno não é permitido";
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return "Endereço interno não é permitido";
  return null;
}

// Nomes de funil, etapa, dono, origem e motivo de perda entram na hora da entrega
// (o gatilho guarda só ids pra ficar barato).
async function enriquecer(deliveries: Delivery[]) {
  const ids = { pipeline: new Set<string>(), stage: new Set<string>(), staff: new Set<string>(), origin: new Set<string>(), lost: new Set<string>() };
  const add = (set: Set<string>, v: unknown) => { if (typeof v === "string" && v) set.add(v); };
  for (const d of deliveries) {
    const p = d.payload || {};
    for (const bloco of [p.lead, p.previous, p.meeting]) {
      if (!bloco) continue;
      add(ids.pipeline, bloco.pipeline_id); add(ids.stage, bloco.stage_id);
      add(ids.staff, bloco.owner_staff_id); add(ids.staff, bloco.credited_staff_id); add(ids.origin, bloco.origin_id);
    }
    if (d.event === "lead.lost") add(ids.lost, p.lead?.id);
  }
  const mapa = async (tabela: string, set: Set<string>, cols: string) => {
    if (!set.size) return new Map<string, any>();
    const { data } = await supabase.from(tabela).select(cols).in("id", [...set]);
    return new Map((data || []).map((r: any) => [r.id, r]));
  };
  const [pipelines, stages, staff, origins, lostLeads] = await Promise.all([
    mapa("crm_pipelines", ids.pipeline, "id, name"),
    mapa("crm_stages", ids.stage, "id, name, final_type"),
    mapa("onboarding_staff", ids.staff, "id, name, email"),
    mapa("crm_origins", ids.origin, "id, name"),
    mapa("crm_leads", ids.lost, "id, loss_reason_id"),
  ]);
  const reasonIds = new Set<string>();
  for (const l of lostLeads.values()) if (l.loss_reason_id) reasonIds.add(l.loss_reason_id);
  const reasons = await mapa("crm_loss_reasons", reasonIds, "id, name");

  const nomes = (bloco: any) => {
    if (!bloco) return bloco;
    const out = { ...bloco };
    if ("pipeline_id" in bloco) out.pipeline_name = pipelines.get(bloco.pipeline_id)?.name ?? null;
    if ("stage_id" in bloco) out.stage_name = stages.get(bloco.stage_id)?.name ?? null;
    if ("owner_staff_id" in bloco) {
      out.owner_name = staff.get(bloco.owner_staff_id)?.name ?? null;
      out.owner_email = staff.get(bloco.owner_staff_id)?.email ?? null;
    }
    if ("credited_staff_id" in bloco) out.credited_staff_name = staff.get(bloco.credited_staff_id)?.name ?? null;
    if ("origin_id" in bloco) out.origin_name = origins.get(bloco.origin_id)?.name ?? null;
    return out;
  };

  return (d: Delivery) => {
    const p = d.payload || {};
    const data: any = { ...p };
    if (p.lead) {
      data.lead = nomes(p.lead);
      if (p.lead.id) data.lead.url = `${APP_URL}/#/crm/leads/${p.lead.id}`;
      if (d.event === "lead.lost") {
        const rid = lostLeads.get(p.lead.id)?.loss_reason_id || null;
        data.lead.loss_reason_id = rid;
        data.lead.loss_reason = rid ? reasons.get(rid)?.name ?? null : null;
      }
    }
    if (p.previous) data.previous = nomes(p.previous);
    if (p.meeting) data.meeting = nomes(p.meeting);
    return data;
  };
}

type Resultado = { ok: boolean; http_status: number | null; response: string };

async function enviar(hook: Webhook, d: Delivery, data: unknown): Promise<Resultado> {
  const bloqueio = urlBloqueada(hook.url);
  if (bloqueio) return { ok: false, http_status: null, response: bloqueio };

  const body = JSON.stringify({ id: d.id, event: d.event, created_at: d.created_at, test: d.is_test, data });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(hook.url, {
      method: "POST",
      redirect: "manual",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "UNV-Nexus-Webhooks/1.0",
        "X-UNV-Event": d.event,
        "X-UNV-Delivery": d.id,
        "X-UNV-Signature": await hmacHex(hook.secret, body),
      },
      body,
    });
    const texto = (await resp.text().catch(() => "")).slice(0, 500);
    return { ok: resp.status >= 200 && resp.status < 300, http_status: resp.status, response: texto };
  } catch (e) {
    const abortou = (e as any)?.name === "AbortError";
    return { ok: false, http_status: null, response: abortou ? `Sem resposta em ${TIMEOUT_MS / 1000} s (timeout)` : `Falha de conexão: ${String((e as any)?.message || e).slice(0, 300)}` };
  } finally {
    clearTimeout(timer);
  }
}

// Grava o desfecho. `automatico` = entrega da fila (reagenda); teste e reenvio manual não reagendam.
async function registrar(d: Delivery, r: Resultado, automatico: boolean) {
  const agora = new Date().toISOString();
  let status = "delivered";
  let next: string | null = null;
  if (!r.ok) {
    if (automatico && d.attempts < MAX_ATTEMPTS) {
      status = "retrying";
      const min = BACKOFF_MIN[Math.min(d.attempts, BACKOFF_MIN.length) - 1] ?? 120;
      next = new Date(Date.now() + min * 60_000).toISOString();
    } else {
      status = "failed";
    }
  }
  const { error } = await supabase.from("crm_outbound_webhook_deliveries").update({
    status, http_status: r.http_status, response: r.response, next_retry_at: next,
    last_attempt_at: agora, delivered_at: r.ok ? agora : null,
  }).eq("id", d.id);
  if (error) console.error("[crm-webhook-dispatch] erro ao registrar", d.id, error.message);
  return status;
}

async function carregarWebhooks(ids: string[]) {
  if (!ids.length) return new Map<string, Webhook>();
  const { data } = await supabase.from("crm_outbound_webhooks").select("id, name, url, secret, is_active").in("id", [...new Set(ids)]);
  return new Map((data || []).map((w: any) => [w.id, w as Webhook]));
}

async function processarFila() {
  const { data: lote, error } = await supabase.rpc("crm_webhook_claim_deliveries", { p_limit: LOTE });
  if (error) throw new Error(`claim: ${error.message}`);
  const deliveries = (lote || []) as Delivery[];
  if (!deliveries.length) return { processadas: 0, entregues: 0, reagendadas: 0, falhas: 0 };

  const hooks = await carregarWebhooks(deliveries.map((d) => d.webhook_id));
  const montar = await enriquecer(deliveries);
  const cont = { processadas: deliveries.length, entregues: 0, reagendadas: 0, falhas: 0 };

  for (let i = 0; i < deliveries.length; i += PARALELO) {
    await Promise.all(deliveries.slice(i, i + PARALELO).map(async (d) => {
      const hook = hooks.get(d.webhook_id);
      let status: string;
      if (!hook || !hook.is_active) {
        // desligado depois de enfileirar: não entrega nem fica tentando
        status = await registrar({ ...d, attempts: MAX_ATTEMPTS }, { ok: false, http_status: null, response: "Webhook desativado antes da entrega" }, true);
      } else {
        status = await registrar(d, await enviar(hook, d, montar(d)), true);
      }
      if (status === "delivered") cont.entregues++; else if (status === "retrying") cont.reagendadas++; else cont.falhas++;
    }));
  }
  return cont;
}

const EXEMPLO = {
  lead: {
    id: "00000000-0000-0000-0000-000000000000", name: "Lead de teste", phone: "5531999990000", email: "teste@exemplo.com",
    company: "Empresa Exemplo", pipeline_id: null, pipeline_name: "Funil de exemplo", stage_id: null, stage_name: "Reunião agendada",
    owner_staff_id: null, owner_name: "Vendedor Exemplo", owner_email: null, origin_id: null, origin_name: "Landing Page",
    opportunity_value: 2000, created_at: new Date().toISOString(), url: `${APP_URL}/#/crm/leads/00000000-0000-0000-0000-000000000000`,
  },
  previous: { stage_id: null, stage_name: "Novo lead", pipeline_id: null, pipeline_name: "Funil de exemplo" },
};

async function staffAutorizado(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: u, error } = await supabase.auth.getUser(token);
  if (error || !u?.user) return null;
  const { data: staff } = await supabase.from("onboarding_staff")
    .select("id, role, tenant_id").eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
  if (!staff || staff.tenant_id !== null || !["master", "admin"].includes(staff.role)) return null;
  return { id: staff.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    // 1) cron
    const segredo = req.headers.get("x-webhook-dispatch-secret");
    if (segredo) {
      const { data: ok } = await supabase.rpc("crm_webhook_dispatch_auth", { p_secret: segredo });
      if (ok !== true) return json({ error: "Unauthorized" }, 401);
      if (body?.dry_run === true) {
        const { count } = await supabase.from("crm_outbound_webhook_deliveries")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "retrying"]).lte("next_retry_at", new Date().toISOString());
        return json({ ok: true, dry_run: true, na_fila: count ?? 0 });
      }
      return json({ ok: true, ...(await processarFila()) });
    }

    // 2) tela
    const staff = await staffAutorizado(req);
    if (!staff) return json({ error: "Unauthorized" }, 401);

    if (body?.action === "test" && typeof body?.webhook_id === "string") {
      const hooks = await carregarWebhooks([body.webhook_id]);
      const hook = hooks.get(body.webhook_id);
      if (!hook) return json({ error: "Webhook não encontrado" }, 404);
      const { data: row, error } = await supabase.from("crm_outbound_webhook_deliveries").insert({
        webhook_id: hook.id, event: "test.ping", payload: EXEMPLO, status: "sending", attempts: 1,
        is_test: true, next_retry_at: null, last_attempt_at: new Date().toISOString(),
      }).select("*").single();
      if (error || !row) return json({ error: `Não consegui registrar o teste: ${error?.message}` }, 500);
      const r = await enviar(hook, row as Delivery, EXEMPLO);
      const status = await registrar(row as Delivery, r, false);
      return json({ ok: r.ok, status, http_status: r.http_status, response: r.response, delivery_id: row.id });
    }

    if (body?.action === "retry" && typeof body?.delivery_id === "string") {
      const { data: atual } = await supabase.from("crm_outbound_webhook_deliveries").select("*").eq("id", body.delivery_id).maybeSingle();
      if (!atual) return json({ error: "Entrega não encontrada" }, 404);
      if (atual.status === "sending") return json({ error: "Esta entrega está sendo enviada agora. Tente de novo em instantes." }, 409);
      const hooks = await carregarWebhooks([atual.webhook_id]);
      const hook = hooks.get(atual.webhook_id);
      if (!hook) return json({ error: "Webhook não encontrado" }, 404);
      // marca como enviando só se ninguém pegou no meio do caminho
      const { data: pego } = await supabase.from("crm_outbound_webhook_deliveries")
        .update({ status: "sending", attempts: atual.attempts + 1, last_attempt_at: new Date().toISOString() })
        .eq("id", atual.id).eq("status", atual.status).select("*").maybeSingle();
      if (!pego) return json({ error: "Esta entrega mudou de estado. Atualize a lista." }, 409);
      const d = pego as Delivery;
      const data = d.is_test ? d.payload : (await enriquecer([d]))(d);
      const r = await enviar(hook, d, data);
      const status = await registrar(d, r, false);
      return json({ ok: r.ok, status, http_status: r.http_status, response: r.response, delivery_id: d.id });
    }

    return json({ error: "Ação desconhecida. Use action: test ou retry." }, 400);
  } catch (e) {
    console.error("[crm-webhook-dispatch]", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
