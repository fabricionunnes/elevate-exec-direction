import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Load config
    const { data: configRows } = await supabase
      .from("gamification_report_config")
      .select("setting_key, setting_value");

    if (!configRows || configRows.length === 0) {
      return new Response(JSON.stringify({ error: "Config not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config: Record<string, string | null> = {};
    configRows.forEach((r: any) => { config[r.setting_key] = r.setting_value; });

    if (config.enabled !== "true") {
      return new Response(JSON.stringify({ message: "Disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.instance_id || !config.group_jid) {
      return new Response(JSON.stringify({ error: "Missing instance or group config" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch ranking data (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Get KPI entries for this month
    const { data: kpiEntries } = await supabase
      .from("kpi_entries")
      .select("*, kpi_definition:kpi_definitions(*)")
      .gte("entry_date", startOfMonth)
      .lte("entry_date", endOfMonth);

    // Get salespeople and companies
    const { data: salespeople } = await supabase
      .from("company_salespeople")
      .select("id, name, company_id, is_active")
      .eq("is_active", true);

    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name, segment");

    const { data: projects } = await supabase
      .from("onboarding_projects")
      .select("id, company_id");

    // Get staff user IDs to exclude
    const { data: staffMembers } = await supabase
      .from("onboarding_staff")
      .select("user_id");
    const staffUserIds = new Set((staffMembers || []).map((s: any) => s.user_id).filter(Boolean));

    // Get monthly goals
    const { data: monthlyGoals } = await supabase
      .from("kpi_monthly_goals")
      .select("*")
      .eq("month", startOfMonth);

    // Build company map
    const companyMap = new Map((companies || []).map((c: any) => [c.id, c]));
    const projectCompanyMap = new Map((projects || []).map((p: any) => [p.id, p.company_id]));

    // Find main KPI definitions (is_main = true)
    const mainKpiDefs = (kpiEntries || [])
      .filter((e: any) => e.kpi_definition?.is_main)
      .map((e: any) => e.kpi_definition);

    const mainKpiIds = new Set(mainKpiDefs.map((d: any) => d.id));
    const mainEntries = (kpiEntries || []).filter((e: any) => mainKpiIds.has(e.kpi_definition_id));

    // Group entries by salesperson
    type ParticipantData = {
      salesperson_id: string;
      salesperson_name: string;
      company_id: string;
      company_name: string;
      segment: string;
      total_achieved: number;
      total_target: number;
    };

    const spMap = new Map<string, ParticipantData>();
    
    for (const entry of mainEntries) {
      const sp = (salespeople || []).find((s: any) => s.id === entry.salesperson_id);
      if (!sp) continue;

      // Exclude staff
      if (staffUserIds.has(sp.id)) continue;

      const companyId = sp.company_id;
      const company = companyMap.get(companyId);
      if (!company) continue;

      if (!spMap.has(sp.id)) {
        spMap.set(sp.id, {
          salesperson_id: sp.id,
          salesperson_name: sp.name,
          company_id: companyId,
          company_name: company.name,
          segment: company.segment || "",
          total_achieved: 0,
          total_target: 0,
        });
      }

      const data = spMap.get(sp.id)!;
      data.total_achieved += Number(entry.value) || 0;

      // Find target: monthly goal > base target
      const monthlyGoal = (monthlyGoals || []).find(
        (g: any) => g.kpi_definition_id === entry.kpi_definition_id && g.salesperson_id === sp.id
      );
      if (monthlyGoal) {
        data.total_target += Number(monthlyGoal.target_value) || 0;
      } else {
        const def = mainKpiDefs.find((d: any) => d.id === entry.kpi_definition_id);
        if (def) {
          data.total_target += Number(def.target) || 0;
        }
      }
    }

    // Build ranking
    const participants = Array.from(spMap.values())
      .filter((p) => p.total_target > 0)
      .map((p) => ({
        ...p,
        achievement_percent: (p.total_achieved / p.total_target) * 100,
      }))
      .sort((a, b) => b.achievement_percent - a.achievement_percent);

    const stats = {
      total: participants.length,
      avgPercent: participants.length > 0
        ? participants.reduce((s, p) => s + p.achievement_percent, 0) / participants.length
        : 0,
      activeCompanies: new Set(participants.map((p) => p.company_id)).size,
      above100: participants.filter((p) => p.achievement_percent >= 100).length,
    };

    // 3. Format message
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthLabel = `${monthNames[now.getMonth()]}/${now.getFullYear()}`;

    const lines: string[] = [];
    lines.push("🏆 *RANKING GAMIFICAÇÃO* 🏆");
    lines.push(`📅 ${monthLabel}`);
    lines.push("");
    lines.push(`👥 ${stats.total} vendedores | 🏢 ${stats.activeCompanies} empresas`);
    lines.push(`📊 Média: ${stats.avgPercent.toFixed(1)}% | ✅ Bateram meta: ${stats.above100}`);
    lines.push("");

    const top10 = participants.slice(0, 10);
    if (top10.length > 0) {
      lines.push("*🥇 TOP 10 VENDEDORES*");
      lines.push("");
      top10.forEach((p, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
        lines.push(`${medal} *${p.salesperson_name}* - ${p.company_name}`);
        lines.push(`   📈 ${p.achievement_percent.toFixed(1)}%`);
      });
    }

    lines.push("");
    lines.push("💪 _Vamos com tudo!_");

    const message = lines.join("\n");

    // 4. Send via evolution-api
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sendResp = await fetch(`${supabaseUrl}/functions/v1/evolution-api?action=sendGroupText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        instanceId: config.instance_id,
        groupId: config.group_jid,
        message,
      }),
    });

    const sendResult = await sendResp.json();
    console.log("[gamification-daily-report] Send result:", JSON.stringify(sendResult).substring(0, 500));

    return new Response(
      JSON.stringify({ success: true, participants_count: participants.length, message_sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[gamification-daily-report] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
