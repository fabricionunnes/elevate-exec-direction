// dialer-admin-stats: visão de margem/receita do discador (todos os tenants). Só para staff UNV.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Autorização: precisa ser staff UNV (onboarding_staff, sem tenant, ativo)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "Não autenticado" }, 401);
    const { data: staff } = await supabase.from("onboarding_staff")
      .select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle();
    if (!staff || !staff.is_active || staff.tenant_id || !["master", "admin", "head_comercial"].includes(staff.role)) {
      return json({ error: "Acesso restrito à UNV" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const sinceDate = since.slice(0, 10);

    // Receita de uso (débitos da carteira) por tenant
    const { data: debits } = await supabase.from("dialer_ledger")
      .select("tenant_id, amount, minutes").eq("operation", "debit_call").gte("created_at", since);
    const { data: recharges } = await supabase.from("dialer_ledger")
      .select("amount").eq("operation", "recharge").gte("created_at", since);

    const byTenant: Record<string, { revenue: number; minutes: number }> = {};
    let totalRevenue = 0, totalMinutes = 0;
    for (const d of debits || []) {
      const rev = Math.abs(Number(d.amount) || 0);
      totalRevenue += rev; totalMinutes += Number(d.minutes) || 0;
      const t = d.tenant_id || "—";
      (byTenant[t] ||= { revenue: 0, minutes: 0 });
      byTenant[t].revenue += rev; byTenant[t].minutes += Number(d.minutes) || 0;
    }
    const totalRecharged = (recharges || []).reduce((s, r) => s + Number(r.amount || 0), 0);

    // nomes dos tenants
    const tenantIds = Object.keys(byTenant).filter((t) => t !== "—");
    const names: Record<string, string> = {};
    if (tenantIds.length) {
      const { data: tns } = await supabase.from("whitelabel_tenants").select("id, name").in("id", tenantIds);
      (tns || []).forEach((t: any) => { names[t.id] = t.name; });
    }
    const tenants = Object.entries(byTenant).map(([id, v]) => ({
      tenant_id: id, name: id === "—" ? "Sem tenant" : (names[id] || id), revenue: v.revenue, minutes: v.minutes,
    })).sort((a, b) => b.revenue - a.revenue);

    // Custo Twilio (USD) no período — câmbio aproximado configurável
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const usdBrl = Number(Deno.env.get("USD_BRL") || "5.5");
    let twilioCostUsd = 0;
    if (accountSid && authToken) {
      try {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records.json?Category=totalprice&StartDate=${sinceDate}&PageSize=100`, {
          headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
        });
        const d = await r.json();
        twilioCostUsd = (d.usage_records || []).reduce((s: number, x: any) => s + Math.abs(parseFloat(x.price) || 0), 0);
      } catch (_e) { /* ignora */ }
    }
    const twilioCostBrl = twilioCostUsd * usdBrl;
    const margin = totalRevenue - twilioCostBrl;

    return json({
      days, totalRevenue, totalMinutes, totalRecharged,
      twilioCostUsd, twilioCostBrl, usdBrl, margin,
      marginPct: totalRevenue ? Math.round((margin / totalRevenue) * 100) : 0,
      tenants,
    });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
