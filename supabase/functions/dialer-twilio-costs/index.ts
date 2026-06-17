// dialer-twilio-costs: extrato de custo por ligação do UNV (conta própria Twilio, tenant null).
// Puxa o preço real de cada ligação na Twilio (Call.price) e cacheia em crm_calls.cost. Só staff UNV.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getBrlRate(supabase: any): Promise<number> {
  const { data } = await supabase.from("fx_rates").select("rate").eq("pair", "USD-BRL").maybeSingle();
  return data ? Number(data.rate) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // auth: staff UNV (sem tenant) master/admin/head
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(jwt);
    const uid = u?.user?.id;
    const { data: me } = uid ? await supabase.from("onboarding_staff").select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle() : { data: null };
    if (!me || !me.is_active || me.tenant_id || !["master", "admin", "head_comercial"].includes(me.role)) {
      return json({ error: "Acesso restrito à UNV" }, 403);
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const basic = "Basic " + btoa(`${accountSid}:${authToken}`);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 300);

    // ligações do UNV (tenant null) com SID
    const { data: calls } = await supabase
      .from("crm_calls")
      .select("id, created_at, duration_seconds, status, answered_by, cost, cost_currency, twilio_call_sid, lead:crm_leads(name, company)")
      .is("tenant_id", null)
      .not("twilio_call_sid", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = calls || [];

    // busca preço real na Twilio só pras que ainda não têm custo (cacheia)
    const pending = rows.filter((c: any) => c.cost == null && c.twilio_call_sid).slice(0, 60);
    await Promise.all(pending.map(async (c: any) => {
      try {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${c.twilio_call_sid}.json`, { headers: { Authorization: basic } });
        const j = await r.json();
        const price = j?.price != null && j.price !== "" ? Math.abs(parseFloat(j.price)) : null;
        if (price != null && !Number.isNaN(price)) {
          const unit = (j.price_unit || "USD").toUpperCase();
          await supabase.from("crm_calls").update({ cost: price, cost_currency: unit }).eq("id", c.id);
          c.cost = price; c.cost_currency = unit;
        }
      } catch { /* a Twilio popula o preço com atraso; tenta de novo na próxima abertura */ }
    }));

    const brlRate = await getBrlRate(supabase);
    const totalUsd = rows.reduce((s: number, c: any) => s + (Number(c.cost) || 0), 0);
    const pendingCount = rows.filter((c: any) => c.cost == null).length;

    return json({
      brlRate,
      totalUsd,
      totalBrl: brlRate ? totalUsd * brlRate : null,
      pendingCount,
      calls: rows.map((c: any) => ({
        id: c.id,
        created_at: c.created_at,
        duration_seconds: c.duration_seconds,
        answered: c.answered_by === "human",
        cost: c.cost != null ? Number(c.cost) : null,
        cost_currency: c.cost_currency || "USD",
        lead: c.lead?.name || null,
        company: c.lead?.company || null,
      })),
    });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
