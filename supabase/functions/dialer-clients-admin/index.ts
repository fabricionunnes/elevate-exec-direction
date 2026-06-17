// dialer-clients-admin: gestão dos clientes do discador (saldo, plano, uso, agendamentos). Só staff UNV.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const monthStart = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;

    // tenants que são clientes do discador (têm carteira, ou staff/users habilitados, ou campanha)
    const tenantSet = new Set<string>();
    const collect = (rows: any[] | null, key = "tenant_id") => (rows || []).forEach((r) => r[key] && tenantSet.add(r[key]));
    const [w, st, pu, camp] = await Promise.all([
      supabase.from("dialer_wallets").select("tenant_id"),
      supabase.from("onboarding_staff").select("tenant_id").eq("dialer_only", true).not("tenant_id", "is", null),
      supabase.from("onboarding_users").select("tenant_id").eq("dialer_enabled", true).not("tenant_id", "is", null),
      supabase.from("crm_dialer_campaigns").select("tenant_id").not("tenant_id", "is", null),
    ]);
    collect(w.data); collect(st.data); collect(pu.data); collect(camp.data);
    const tenantIds = [...tenantSet];
    if (!tenantIds.length) return json({ clients: [], totals: emptyTotals() });

    // dados em lote
    const [tenants, wallets, pricings, ledger, sessions, queue] = await Promise.all([
      supabase.from("whitelabel_tenants").select("id, name, status").in("id", tenantIds),
      supabase.from("dialer_wallets").select("tenant_id, balance, total_spent, total_deposited").in("tenant_id", tenantIds),
      supabase.from("dialer_pricing").select("tenant_id, plan_price_per_user, price_per_minute, included_minutes_per_user").or(`tenant_id.in.(${tenantIds.join(",")}),tenant_id.is.null`),
      supabase.from("dialer_ledger").select("tenant_id, amount, minutes, operation").eq("operation", "debit_call").in("tenant_id", tenantIds).gte("created_at", since),
      supabase.from("crm_dialer_sessions").select("tenant_id, agent_staff_id").in("tenant_id", tenantIds).gte("started_at", monthStart),
      supabase.from("crm_dialer_queue").select("tenant_id, disposition").in("tenant_id", tenantIds).not("disposition", "is", null).gte("updated_at", since),
    ]);

    const nameOf: Record<string, string> = {}; (tenants.data || []).forEach((t: any) => nameOf[t.id] = t.name);
    const statusOf: Record<string, string> = {}; (tenants.data || []).forEach((t: any) => statusOf[t.id] = t.status);
    const walletOf: Record<string, any> = {}; (wallets.data || []).forEach((x: any) => walletOf[x.tenant_id] = x);
    const globalPricing = (pricings.data || []).find((p: any) => p.tenant_id === null);
    const pricingOf: Record<string, any> = {}; (pricings.data || []).forEach((p: any) => { if (p.tenant_id) pricingOf[p.tenant_id] = p; });

    const agg: Record<string, { revenue: number; minutes: number; agendamentos: number; qualificados: number; activeUsers: Set<string> }> = {};
    const ensure = (t: string) => (agg[t] ||= { revenue: 0, minutes: 0, agendamentos: 0, qualificados: 0, activeUsers: new Set() });
    for (const d of ledger.data || []) { const a = ensure(d.tenant_id); a.revenue += Math.abs(Number(d.amount) || 0); a.minutes += Number(d.minutes) || 0; }
    for (const s of sessions.data || []) { if (s.agent_staff_id) ensure(s.tenant_id).activeUsers.add(s.agent_staff_id); }
    for (const q of queue.data || []) { const a = ensure(q.tenant_id); if (q.disposition === "agendou_reuniao") a.agendamentos++; if (q.disposition === "qualificado") a.qualificados++; }

    const clients = tenantIds.map((t) => {
      const a = agg[t] || { revenue: 0, minutes: 0, agendamentos: 0, qualificados: 0, activeUsers: new Set() };
      const pr = pricingOf[t] || globalPricing || {};
      const activeUsers = a.activeUsers.size;
      return {
        tenant_id: t, name: nameOf[t] || t, status: statusOf[t] || "—",
        balance: Number(walletOf[t]?.balance ?? 0),
        total_deposited: Number(walletOf[t]?.total_deposited ?? 0),
        plan_price_per_user: Number(pr.plan_price_per_user ?? 0),
        price_per_minute: Number(pr.price_per_minute ?? 0),
        active_users: activeUsers,
        mrr: activeUsers * Number(pr.plan_price_per_user ?? 0),
        minutes: Math.round(a.minutes),
        revenue_usage: Number(a.revenue.toFixed(2)),
        agendamentos: a.agendamentos,
        qualificados: a.qualificados,
      };
    }).sort((x, y) => y.mrr - x.mrr);

    const totals = clients.reduce((t, c) => ({
      clients: t.clients + 1,
      mrr: t.mrr + c.mrr,
      balance: t.balance + c.balance,
      usage_revenue: t.usage_revenue + c.revenue_usage,
      agendamentos: t.agendamentos + c.agendamentos,
      qualificados: t.qualificados + c.qualificados,
      minutes: t.minutes + c.minutes,
    }), emptyTotals());

    return json({ days, clients, totals });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
  function emptyTotals() { return { clients: 0, mrr: 0, balance: 0, usage_revenue: 0, agendamentos: 0, qualificados: 0, minutes: 0 }; }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
