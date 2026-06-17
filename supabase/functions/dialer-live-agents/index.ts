// dialer-live-agents: quem está online no discador agora e o que está fazendo (pronta / chamando / em ligação).
// Online = heartbeat fresco (sessão aberta, last_seen < 2min) OU ligou nos últimos 3min (robusto a cache do navegador).
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
    const heartbeatCutoff = nowMs - 2 * 60000; // sessão "viva" se deu sinal nos últimos 2min
    const callCutoff = new Date(nowMs - 3 * 60000).toISOString(); // ou se ligou nos últimos 3min
    const dayStart = new Date(nowMs - 12 * 3600000).toISOString(); // janela p/ contagem

    // ligações recentes (presença por atividade + ligação atual)
    let cq = supabase
      .from("crm_calls")
      .select("agent_staff_id, tenant_id, campaign_id, status, answered_by, created_at, lead:crm_leads(name)")
      .gte("created_at", callCutoff)
      .order("created_at", { ascending: false });
    if (scopeTenant) cq = cq.eq("tenant_id", scopeTenant);
    const { data: recentCalls } = await cq;

    // sessões abertas (contexto: campanha, início, tenant)
    let sq = supabase
      .from("crm_dialer_sessions")
      .select("id, agent_staff_id, campaign_id, tenant_id, started_at, last_seen_at")
      .is("ended_at", null);
    if (scopeTenant) sq = sq.eq("tenant_id", scopeTenant);
    const { data: openSessions } = await sq;

    // agentes online = heartbeat fresco OU ligação recente
    const onlineSet = new Set<string>();
    for (const s of openSessions || []) {
      if (s.agent_staff_id && s.last_seen_at && new Date(s.last_seen_at).getTime() >= heartbeatCutoff) onlineSet.add(s.agent_staff_id);
    }
    for (const c of recentCalls || []) { if (c.agent_staff_id) onlineSet.add(c.agent_staff_id); }
    const agentIds = [...onlineSet];
    if (!agentIds.length) return json({ agents: [], isUnvAdmin, serverTime: new Date(nowMs).toISOString() });

    // melhor sessão aberta por agente (mais recente), pra contexto/início
    const bestSession = new Map<string, any>();
    for (const s of openSessions || []) {
      if (!s.agent_staff_id || !onlineSet.has(s.agent_staff_id)) continue;
      const prev = bestSession.get(s.agent_staff_id);
      const t = new Date(s.last_seen_at || s.started_at).getTime();
      if (!prev || t > new Date(prev.last_seen_at || prev.started_at).getTime()) bestSession.set(s.agent_staff_id, s);
    }

    const tenantIds = [...new Set([...(openSessions || []).map((s) => s.tenant_id), ...(recentCalls || []).map((c) => c.tenant_id)].filter(Boolean))] as string[];
    const campaignIds = [...new Set((openSessions || []).map((s) => s.campaign_id).filter(Boolean))] as string[];

    const [staffRes, tenantRes, campRes, todayCallsRes] = await Promise.all([
      supabase.from("onboarding_staff").select("id, name, avatar_url").in("id", agentIds),
      tenantIds.length ? supabase.from("whitelabel_tenants").select("id, name").in("id", tenantIds) : Promise.resolve({ data: [] }),
      campaignIds.length ? supabase.from("crm_dialer_campaigns").select("id, name").in("id", campaignIds) : Promise.resolve({ data: [] }),
      supabase.from("crm_calls").select("agent_staff_id, answered_by, created_at").in("agent_staff_id", agentIds).gte("created_at", dayStart),
    ]);

    const nameOf: Record<string, string> = {}; const avatarOf: Record<string, string | null> = {};
    (staffRes.data || []).forEach((s: any) => { nameOf[s.id] = s.name; avatarOf[s.id] = s.avatar_url; });
    const tenantNameOf: Record<string, string> = {}; (tenantRes.data || []).forEach((t: any) => tenantNameOf[t.id] = t.name);
    const campNameOf: Record<string, string> = {}; (campRes.data || []).forEach((c: any) => campNameOf[c.id] = c.name);

    // ligação atual + contagem do dia, por agente
    const curByAgent: Record<string, any> = {};
    for (const c of recentCalls || []) { if (c.agent_staff_id && !curByAgent[c.agent_staff_id]) curByAgent[c.agent_staff_id] = c; } // mais recente (ordenado desc)
    const todayByAgent: Record<string, { total: number; answered: number }> = {};
    for (const c of todayCallsRes.data || []) {
      const a = (todayByAgent[c.agent_staff_id] ||= { total: 0, answered: 0 });
      a.total++; if (c.answered_by === "human") a.answered++;
    }

    const agents = agentIds.map((id) => {
      const s = bestSession.get(id);
      const cur = curByAgent[id];
      const active = cur && cur.status === "in-progress";
      const ringing = cur && ["ringing", "queued"].includes(cur.status);
      const status = active ? "em_ligacao" : ringing ? "chamando" : "pronta";
      const tenantId = s?.tenant_id ?? cur?.tenant_id ?? null;
      const since = s?.started_at || cur?.created_at || new Date(nowMs).toISOString();
      const today = todayByAgent[id] || { total: 0, answered: 0 };
      return {
        agentId: id,
        name: nameOf[id] || "—",
        avatarUrl: avatarOf[id] || null,
        tenantId,
        tenantName: tenantId ? (tenantNameOf[tenantId] || "Cliente") : "UNV",
        campaignName: s?.campaign_id ? (campNameOf[s.campaign_id] || null) : null,
        since,
        lastSeen: s?.last_seen_at || cur?.created_at || null,
        status,
        currentLead: active || ringing ? ((cur as any)?.lead?.name || null) : null,
        callsCount: today.total,
        answeredCount: today.answered,
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
