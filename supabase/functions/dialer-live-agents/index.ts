// dialer-live-agents: quem está online no discador agora e o que está fazendo (pronta / chamando / em ligação).
// UNV (staff sem tenant) vê todos os clientes; gestor de cliente vê só a própria equipe.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // auth: precisa ser staff ativo. UNV (tenant null + role gestor) vê todos; senão filtra pelo próprio tenant.
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(jwt);
    const uid = u?.user?.id;
    const { data: me } = uid
      ? await supabase.from("onboarding_staff").select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle()
      : { data: null };
    if (!me || !me.is_active) return json({ error: "Não autorizado" }, 403);
    const isUnvAdmin = !me.tenant_id && ["master", "admin", "head_comercial"].includes(me.role);
    const scopeTenant: string | null = isUnvAdmin ? null : (me.tenant_id || null);

    const nowMs = Date.now();
    const onlineCutoff = new Date(nowMs - 2 * 60000).toISOString(); // visto nos últimos 2 min
    const dayStart = new Date(nowMs - 12 * 3600000).toISOString();  // janela de "hoje" (12h) p/ contagem

    // sessões abertas e recentes
    let sq = supabase
      .from("crm_dialer_sessions")
      .select("id, agent_staff_id, campaign_id, tenant_id, started_at, last_seen_at")
      .is("ended_at", null)
      .gte("last_seen_at", onlineCutoff);
    if (scopeTenant) sq = sq.eq("tenant_id", scopeTenant);
    const { data: sessions } = await sq;
    const rows = sessions || [];
    if (!rows.length) return json({ agents: [], serverTime: new Date(nowMs).toISOString() });

    // mantém só a sessão mais recente por agente
    const bestByAgent = new Map<string, any>();
    for (const s of rows) {
      if (!s.agent_staff_id) continue;
      const prev = bestByAgent.get(s.agent_staff_id);
      if (!prev || new Date(s.last_seen_at).getTime() > new Date(prev.last_seen_at).getTime()) bestByAgent.set(s.agent_staff_id, s);
    }
    const agentIds = [...bestByAgent.keys()];
    const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter(Boolean))] as string[];
    const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))] as string[];

    const [staffRes, tenantRes, campRes, callsRes] = await Promise.all([
      supabase.from("onboarding_staff").select("id, name, avatar_url").in("id", agentIds),
      tenantIds.length ? supabase.from("whitelabel_tenants").select("id, name").in("id", tenantIds) : Promise.resolve({ data: [] }),
      campaignIds.length ? supabase.from("crm_dialer_campaigns").select("id, name").in("id", campaignIds) : Promise.resolve({ data: [] }),
      supabase
        .from("crm_calls")
        .select("agent_staff_id, status, answered_by, created_at, lead:crm_leads(name)")
        .in("agent_staff_id", agentIds)
        .gte("created_at", dayStart)
        .order("created_at", { ascending: false }),
    ]);

    const nameOf: Record<string, string> = {}; const avatarOf: Record<string, string | null> = {};
    (staffRes.data || []).forEach((s: any) => { nameOf[s.id] = s.name; avatarOf[s.id] = s.avatar_url; });
    const tenantNameOf: Record<string, string> = {}; (tenantRes.data || []).forEach((t: any) => tenantNameOf[t.id] = t.name);
    const campNameOf: Record<string, string> = {}; (campRes.data || []).forEach((c: any) => campNameOf[c.id] = c.name);

    // ligações de cada agente na janela
    const callsByAgent: Record<string, any[]> = {};
    for (const c of callsRes.data || []) (callsByAgent[c.agent_staff_id] ||= []).push(c);

    const agents = agentIds.map((id) => {
      const s = bestByAgent.get(id);
      const calls = callsByAgent[id] || [];
      const active = calls.find((c) => c.status === "in-progress");
      const ringing = calls.find((c) => ["ringing", "queued"].includes(c.status));
      const cur = active || ringing;
      const status = active ? "em_ligacao" : ringing ? "chamando" : "pronta";
      return {
        agentId: id,
        name: nameOf[id] || "—",
        avatarUrl: avatarOf[id] || null,
        tenantId: s.tenant_id || null,
        tenantName: s.tenant_id ? (tenantNameOf[s.tenant_id] || "Cliente") : "UNV",
        campaignName: s.campaign_id ? (campNameOf[s.campaign_id] || null) : null,
        since: s.started_at,
        lastSeen: s.last_seen_at,
        status,
        currentLead: cur ? ((cur as any).lead?.name || null) : null,
        callsCount: calls.length,
        answeredCount: calls.filter((c) => c.answered_by === "human").length,
      };
    }).sort((a, b) => {
      const order: Record<string, number> = { em_ligacao: 0, chamando: 1, pronta: 2 };
      return (order[a.status] - order[b.status]) || a.name.localeCompare(b.name);
    });

    return json({ agents, isUnvAdmin, serverTime: new Date(nowMs).toISOString() });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
