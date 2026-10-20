// Kommo → Meta Conversions API (traqueamento avançado de clientes que usam Kommo).
// O Kommo chama este endpoint (webhook "lead mudou de etapa" / "lead adicionado").
// A gente lê o lead e o contato pela API do Kommo, decide o evento pela etapa e manda pro pixel do cliente.
// Protegido por ?k=<app_secrets.kommo_capi_hook_secret> na URL do webhook. Deploy manual (fora do CI).
// Chaves ficam em public.app_secrets (o projeto bateu o limite de 100 secrets de edge function).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

type Rule = { event: string; statuses?: number[]; pipelines?: number[]; withValue?: boolean };
type Cfg = {
  pixel: string;
  metaTokenKey: string; // chaves em app_secrets
  kommoTokenKey: string;
  testCodeKey: string; // se tiver valor, manda como test_event_code (modo teste)
  pipelines: number[]; // só esses funis disparam
  rules: Rule[]; // primeira regra que casar vence
};

// Vitale Estética (Sete Lagoas) — pixel "Pixel Clínica Vitale 00"
const CONFIGS: Record<string, Cfg> = {
  contatoesteticavitale2026: {
    pixel: "534301682274757",
    metaTokenKey: "meta_capi_token_vitale",
    kommoTokenKey: "kommo_token_vitale",
    testCodeKey: "kommo_capi_test_code_vitale",
    // Estética Vitale, 1 Qualificação, 1.2 Recontato, 2 Agendamento, 3 Orçamentos, 4 Agenda Procedimento
    pipelines: [14084007, 13833551, 14456911, 13833539, 13833559, 13833571],
    rules: [
      { event: "Purchase", statuses: [142], withValue: true }, // venda ganha em qualquer funil da estética
      { event: "Purchase", pipelines: [13833571], withValue: true }, // entrou em 4 - Agenda Procedimento
      { event: "ConsultaRealizada", statuses: [106741267] }, // COMPARECEU
      { event: "Schedule", statuses: [108719627] }, // AGENDOU (1 - Qualificação)
      { event: "Schedule", pipelines: [13833539] }, // qualquer etapa de 2 - Agendamento (menos as acima)
    ],
  },
};
async function secrets(supa: ReturnType<typeof createClient>, keys: string[]) {
  const { data } = await supa.from("app_secrets").select("key, value").in("key", keys);
  return Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value || ""]));
}

const IGNORE_STATUSES = new Set([143, 106741263]); // perdido, FALTOU

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const normPhone = (p?: string | null) => {
  let d = (p || "").replace(/\D/g, "");
  if (d && d.length <= 11) d = "55" + d;
  return d;
};
const words = (n?: string | null) => (n || "").trim().toLowerCase().split(/\s+/).filter(Boolean);

function pickRule(cfg: Cfg, pipeline: number, status: number): Rule | null {
  if (!cfg.pipelines.includes(pipeline) || IGNORE_STATUSES.has(status)) return null;
  for (const r of cfg.rules) {
    if (r.statuses && !r.statuses.includes(status)) continue;
    if (r.pipelines && !r.pipelines.includes(pipeline)) continue;
    return r;
  }
  return null;
}

// Kommo manda application/x-www-form-urlencoded: leads[status][0][id]=..., account[subdomain]=...
function parseHook(form: URLSearchParams) {
  const subdomain = form.get("account[subdomain]") || "";
  const items: { id: number; status: number; pipeline: number; price: number }[] = [];
  for (const kind of ["status", "add"]) {
    for (let i = 0; i < 50; i++) {
      const id = form.get(`leads[${kind}][${i}][id]`);
      if (!id) break;
      items.push({
        id: Number(id),
        status: Number(form.get(`leads[${kind}][${i}][status_id]`) || 0),
        pipeline: Number(form.get(`leads[${kind}][${i}][pipeline_id]`) || 0),
        price: Number(form.get(`leads[${kind}][${i}][price]`) || 0),
      });
    }
  }
  return { subdomain, items };
}

async function kommo(sub: string, token: string, path: string) {
  const r = await fetch(`https://${sub}.kommo.com/api/v4/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`kommo ${path} ${r.status}`);
  return r.json();
}

async function processLead(supa: ReturnType<typeof createClient>, sub: string, cfg: Cfg, it: { id: number; status: number; pipeline: number; price: number }) {
  const rule = pickRule(cfg, it.pipeline, it.status);
  if (!rule) return { id: it.id, skipped: "etapa sem evento" };

  const event_id = `kommo:${sub}:${it.id}:${rule.event}`;
  const { data: done } = await supa.from("kommo_capi_log").select("id").eq("event_id", event_id).eq("events_received", 1).eq("test_mode", false).limit(1);
  if (done && done.length) return { id: it.id, skipped: "já enviado" };

  const sec = await secrets(supa, [cfg.kommoTokenKey, cfg.metaTokenKey, cfg.testCodeKey]);
  const kToken = sec[cfg.kommoTokenKey] || "";
  const mToken = sec[cfg.metaTokenKey] || "";
  const testCode = sec[cfg.testCodeKey] || "";
  if (!kToken || !mToken) return { id: it.id, skipped: "tokens não configurados" };

  const lead = await kommo(sub, kToken, `leads/${it.id}?with=contacts`);
  const contactId = lead?._embedded?.contacts?.[0]?.id;
  const contact = contactId ? await kommo(sub, kToken, `contacts/${contactId}`) : null;
  const fields = (contact?.custom_fields_values || []) as { field_code?: string; values: { value: string }[] }[];
  const phones = fields.filter((f) => f.field_code === "PHONE").flatMap((f) => f.values.map((v) => normPhone(v.value))).filter(Boolean);
  const emails = fields.filter((f) => f.field_code === "EMAIL").flatMap((f) => f.values.map((v) => (v.value || "").trim().toLowerCase())).filter(Boolean);

  const user_data: Record<string, unknown> = { external_id: [await sha256(`${sub}:${it.id}`)] };
  if (phones.length) user_data.ph = await Promise.all([...new Set(phones)].map(sha256));
  if (emails.length) user_data.em = await Promise.all([...new Set(emails)].map(sha256));
  const nm = words(contact?.name || "");
  if (nm[0]) user_data.fn = [await sha256(nm[0])];
  if (nm.length > 1) user_data.ln = [await sha256(nm[nm.length - 1])];

  const value = Number(lead?.price || it.price || 0);
  const custom_data: Record<string, unknown> = {};
  if (rule.withValue && value > 0) { custom_data.value = value; custom_data.currency = "BRL"; }

  const payload: Record<string, unknown> = {
    data: [{
      event_name: rule.event,
      event_time: Math.floor(Date.now() / 1000),
      event_id,
      action_source: "system_generated",
      user_data,
      ...(Object.keys(custom_data).length ? { custom_data } : {}),
    }],
  };
  if (testCode) payload.test_event_code = testCode;

  const resp = await fetch(`https://graph.facebook.com/v21.0/${cfg.pixel}/events?access_token=${mToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  await supa.from("kommo_capi_log").insert({
    subdomain: sub, kommo_lead_id: it.id, pipeline_id: it.pipeline, status_id: it.status,
    event_name: rule.event, event_id, value: custom_data.value ?? null, pixel_id: cfg.pixel,
    test_mode: !!testCode, status_code: resp.status, events_received: body?.events_received ?? null,
    response: body, error: resp.ok ? null : (body?.error?.message || "erro"),
  });
  return { id: it.id, event: rule.event, ok: resp.ok, phone: phones.length > 0 };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const supa = createClient(SUPA_URL, SERVICE_KEY);
  const hook = (await secrets(supa, ["kommo_capi_hook_secret"])).kommo_capi_hook_secret || "";
  if (!hook || url.searchParams.get("k") !== hook) return new Response("unauthorized", { status: 401 });
  try {
    const ctype = req.headers.get("content-type") || "";
    let sub = "", items: { id: number; status: number; pipeline: number; price: number }[] = [];
    if (ctype.includes("application/json")) {
      // teste manual: {subdomain, lead_id, status_id, pipeline_id}
      const b = await req.json();
      sub = b.subdomain;
      items = [{ id: Number(b.lead_id), status: Number(b.status_id), pipeline: Number(b.pipeline_id), price: Number(b.price || 0) }];
    } else {
      const p = parseHook(new URLSearchParams(await req.text()));
      sub = p.subdomain; items = p.items;
    }
    const cfg = CONFIGS[sub];
    if (!cfg) return new Response(JSON.stringify({ ok: true, skipped: "conta não configurada", sub }), { headers: { "Content-Type": "application/json" } });
    const results = [];
    for (const it of items) {
      try { results.push(await processLead(supa, sub, cfg, it)); }
      catch (e) { results.push({ id: it.id, error: String(e) }); console.error("kommo-capi", sub, it.id, e); }
    }
    // Sempre 200: o Kommo desliga o webhook se receber erro repetido.
    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("kommo-capi", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: { "Content-Type": "application/json" } });
  }
});
