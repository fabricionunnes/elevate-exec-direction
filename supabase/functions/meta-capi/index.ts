// Meta Conversions API (CAPI) — envia eventos do CRM pro pixel do Meta.
// Chamado por trigger do banco (pg_net) ou manualmente. Protegido por x-capi-secret.
// Multi-pixel: o pixel é escolhido pelo funil (pipeline) do lead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-capi-secret",
};

const PIXEL = Deno.env.get("META_CAPI_PIXEL_ID") || "";
const TOKEN = Deno.env.get("META_CAPI_TOKEN") || "";
const HOOK_SECRET = Deno.env.get("CAPI_HOOK_SECRET") || "";
const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// pipeline_id -> pixel. Funis sem entrada aqui usam o pixel principal (META_CAPI_PIXEL_ID).
const PIXEL_BY_PIPELINE: Record<string, string> = {
  // Social Media -> pixel UNV Social
  "96bbbbaf-cf87-43eb-af1e-2ab15ccfdf00": "1747516463051359",
};

// pixel -> token próprio (quando o token principal não tem acesso ao pixel).
const TOKEN_BY_PIXEL: Record<string, string> = {
  "1747516463051359": Deno.env.get("META_CAPI_TOKEN_SOCIAL") || TOKEN,
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const normEmail = (e?: string | null) => (e || "").trim().toLowerCase();
const normPhone = (p?: string | null) => {
  let d = (p || "").replace(/\D/g, "");
  if (d && d.length <= 11) d = "55" + d; // assume BR se vier sem país
  return d;
};
const firstName = (n?: string | null) => (n || "").trim().toLowerCase().split(/\s+/)[0] || "";
const lastName = (n?: string | null) => {
  const parts = (n || "").trim().toLowerCase().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if ((req.headers.get("x-capi-secret") || "") !== HOOK_SECRET || !HOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const { lead_id, event_name, value, currency, test_event_code, event_time } = await req.json();
    if (!lead_id || !event_name) {
      return new Response(JSON.stringify({ error: "lead_id e event_name obrigatorios" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const supa = createClient(SUPA_URL, SERVICE_KEY);
    const { data: lead } = await supa
      .from("crm_leads")
      .select("id, name, email, phone, fbclid, created_at, opportunity_value, pipeline_id, meta_lead_id")
      .eq("id", lead_id)
      .single();
    if (!lead) {
      return new Response(JSON.stringify({ error: "lead nao encontrado" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const pixel = PIXEL_BY_PIPELINE[lead.pipeline_id || ""] || PIXEL;
    const token = TOKEN_BY_PIXEL[pixel] || TOKEN;

    // user_data (PII hasheada)
    const user_data: Record<string, unknown> = {};
    const em = normEmail(lead.email);
    const ph = normPhone(lead.phone);
    if (em) user_data.em = [await sha256(em)];
    if (ph) user_data.ph = [await sha256(ph)];
    if (lead.name) {
      const fn = firstName(lead.name), ln = lastName(lead.name);
      if (fn) user_data.fn = [await sha256(fn)];
      if (ln) user_data.ln = [await sha256(ln)];
    }
    user_data.external_id = [await sha256(String(lead.id))];
    // Lead de formulário nativo (Lead Ads) não tem fbclid: o casamento com o anúncio é pelo id do lead na Meta.
    // Vai SEM hash, como a Meta pede (campo lead_id do CRM).
    if ((lead as any).meta_lead_id && /^\d{10,20}$/.test(String((lead as any).meta_lead_id))) user_data.lead_id = String((lead as any).meta_lead_id);
    if (lead.fbclid) {
      const ts = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
      user_data.fbc = `fb.1.${ts}.${lead.fbclid}`;
    }

    // event_id p/ dedup no Meta (1 evento de marco por lead)
    const event_id = `${lead.id}:${event_name}`;
    const custom_data: Record<string, unknown> = {};
    const v = value != null ? Number(value) : (event_name === "Purchase" ? Number(lead.opportunity_value || 0) : undefined);
    if (v != null && !Number.isNaN(v) && v > 0) { custom_data.value = v; custom_data.currency = currency || "BRL"; }

    // event_time opcional (backfill) — Meta só aceita até 7 dias atrás
    const nowS = Math.floor(Date.now() / 1000);
    let evTime = nowS;
    if (event_time != null) {
      const t = Number(event_time);
      if (!Number.isNaN(t) && t <= nowS && t > nowS - 7 * 24 * 3600) evTime = Math.floor(t);
    }

    const payload: Record<string, unknown> = {
      data: [{
        event_name,
        event_time: evTime,
        event_id,
        action_source: "system_generated",
        user_data,
        ...(Object.keys(custom_data).length ? { custom_data } : {}),
      }],
    };
    if (test_event_code) payload.test_event_code = test_event_code;

    const resp = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));

    await supa.from("meta_capi_log").insert({
      lead_id: lead.id,
      event_name,
      event_id,
      pixel_id: pixel,
      status_code: resp.status,
      events_received: body?.events_received ?? null,
      response: body,
      error: resp.ok ? null : (body?.error?.message || "erro"),
    });

    return new Response(JSON.stringify({ ok: resp.ok, event_id, pixel, meta: body }), {
      status: resp.ok ? 200 : 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
