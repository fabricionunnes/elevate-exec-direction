// dialer-billing-run: cobrança mensal por usuário ativo (Asaas) + grant da franquia na carteira.
// Ativo = colaborador com sessão no discador no período. Admin UNV ou cron (service role).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaas(path: string, method: string, key: string, body?: unknown) {
  const r = await fetch(`${ASAAS_BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", access_token: key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.errors?.[0]?.description || `Asaas ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: service role (cron) OU staff UNV admin
    const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const isService = auth && auth === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isService) {
      const { data: u } = await supabase.auth.getUser(auth);
      const uid = u?.user?.id;
      const { data: staff } = uid ? await supabase.from("onboarding_staff").select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle() : { data: null };
      if (!staff || !staff.is_active || staff.tenant_id || !["master", "admin", "head_comercial"].includes(staff.role)) {
        return json({ error: "Acesso restrito à UNV" }, 403);
      }
    }

    // chave Asaas (conta default)
    let apiKey = Deno.env.get("ASAAS_API_KEY") || "";
    const { data: acc } = await supabase.from("asaas_accounts").select("api_key_secret_name").eq("is_default", true).eq("is_active", true).maybeSingle();
    if (acc?.api_key_secret_name) { const s = Deno.env.get(acc.api_key_secret_name); if (s) apiKey = s; }

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const periodEndD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const periodEnd = periodEndD.toISOString().slice(0, 10);

    // tenants a cobrar
    let tenantIds: string[] = [];
    if (body.tenantId) tenantIds = [body.tenantId];
    else {
      const { data: ts } = await supabase.from("whitelabel_tenants").select("id").eq("status", "active");
      tenantIds = (ts || []).map((t: any) => t.id);
    }

    const results: any[] = [];
    for (const tenantId of tenantIds) {
      // usuários ativos no período (sessão no discador)
      const { data: sess } = await supabase.from("crm_dialer_sessions")
        .select("agent_staff_id").eq("tenant_id", tenantId).gte("started_at", `${periodStart}T00:00:00Z`);
      const activeUsers = new Set((sess || []).map((s: any) => s.agent_staff_id).filter(Boolean)).size;
      if (activeUsers === 0) { results.push({ tenantId, skipped: "sem usuários ativos" }); continue; }

      // já cobrado neste período?
      const { data: existing } = await supabase.from("dialer_billing").select("id").eq("tenant_id", tenantId).eq("period_start", periodStart).maybeSingle();
      if (existing) { results.push({ tenantId, skipped: "já cobrado" }); continue; }

      // preço (override do tenant ou global)
      const { data: pricing } = await supabase.from("dialer_pricing").select("*")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`).order("tenant_id", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      const planPrice = Number(pricing?.plan_price_per_user ?? 997);
      const inclMin = Number(pricing?.included_minutes_per_user ?? 1000);
      const pricePerMin = Number(pricing?.price_per_minute ?? 1.2);
      const amount = Number((activeUsers * planPrice).toFixed(2));

      // registra a fatura
      const { data: billing } = await supabase.from("dialer_billing").insert({
        tenant_id: tenantId, period_start: periodStart, period_end: periodEnd,
        active_users: activeUsers, plan_price_per_user: planPrice, amount,
        franchise_minutes_granted: activeUsers * inclMin, status: "pending",
      }).select("id").single();

      // cobrança no Asaas (PIX)
      const { data: tenant } = await supabase.from("whitelabel_tenants").select("name, asaas_customer_id").eq("id", tenantId).maybeSingle();
      let invoiceUrl: string | null = null, asaasId: string | null = null;
      if (apiKey && tenant?.asaas_customer_id) {
        try {
          const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
          const pay = await asaas("/payments", "POST", apiKey, {
            customer: tenant.asaas_customer_id, billingType: "PIX", value: amount, dueDate: due,
            description: `Discador — ${activeUsers} usuário(s) — ${periodStart}`,
            externalReference: `dialer_billing:${billing.id}`,
          });
          asaasId = pay.id; invoiceUrl = pay.invoiceUrl || (pay.id ? `https://www.asaas.com/i/${pay.id}` : null);
          await supabase.from("dialer_billing").update({ asaas_payment_id: asaasId, invoice_url: invoiceUrl }).eq("id", billing.id);
        } catch (e) { results.push({ tenantId, billingId: billing.id, asaas_error: String(e) }); }
      }

      // grant da franquia na carteira (minutos incluídos × usuários, em R$)
      const franchiseCredit = Number((activeUsers * inclMin * pricePerMin).toFixed(2));
      await supabase.rpc("dialer_credit_wallet", {
        p_tenant: tenantId, p_amount: franchiseCredit, p_operation: "franchise_grant",
        p_desc: `Franquia ${activeUsers}×${inclMin} min`, p_ref: billing.id,
      });

      results.push({ tenantId, activeUsers, amount, franchiseCredit, invoiceUrl, billingId: billing.id });
    }

    return json({ ok: true, period: periodStart, results });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
