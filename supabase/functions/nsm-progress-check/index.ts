import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const THRESHOLDS = [70, 90, 100] as const;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startStr = monthStart.toISOString().slice(0, 10);
  const endStr = monthEnd.toISOString().slice(0, 10);
  const monthYearStr = startStr; // YYYY-MM-01

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  try {
    // 1. Empresas com NSM definido + projeto ativo
    const { data: companies, error: cErr } = await supabase
      .from("onboarding_companies")
      .select("id, name, north_star_metric_cents")
      .gt("north_star_metric_cents", 0);
    if (cErr) throw cErr;

    let triggered = 0;
    const detailsLog: any[] = [];

    for (const co of companies || []) {
      const targetCents = Number((co as any).north_star_metric_cents) || 0;
      if (targetCents <= 0) continue;
      const targetValue = targetCents / 100;

      // KPIs monetários main_goal
      const { data: kpis } = await supabase
        .from("company_kpis")
        .select("id")
        .eq("company_id", co.id)
        .eq("is_active", true)
        .eq("is_main_goal", true)
        .eq("kpi_type", "monetary");
      const kpiIds = (kpis || []).map((k: any) => k.id);
      if (kpiIds.length === 0) continue;

      // Faturamento do mês
      const { data: entries } = await supabase
        .from("kpi_entries")
        .select("value")
        .eq("company_id", co.id)
        .in("kpi_id", kpiIds)
        .gte("entry_date", startStr)
        .lte("entry_date", endStr);
      const achieved = (entries || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      const pct = targetValue > 0 ? (achieved / targetValue) * 100 : 0;

      // Encontra projeto ativo (para anexar à notificação)
      const { data: proj } = await supabase
        .from("onboarding_projects")
        .select("id, tenant_id")
        .eq("company_id", co.id)
        .eq("status", "active")
        .maybeSingle();

      // Carrega marcos já enviados neste mês
      const { data: alreadySent } = await supabase
        .from("north_star_alerts_sent")
        .select("threshold")
        .eq("company_id", co.id)
        .eq("month_year", monthYearStr);
      const sentSet = new Set((alreadySent || []).map((a: any) => a.threshold));

      for (const t of THRESHOLDS) {
        if (pct >= t && !sentSet.has(t)) {
          // Registra marco
          const { error: insErr } = await supabase.from("north_star_alerts_sent").insert({
            company_id: co.id,
            month_year: monthYearStr,
            threshold: t,
            achieved_value_cents: Math.round(achieved * 100),
            target_value_cents: targetCents,
          });
          if (insErr) {
            console.error("alerts_sent insert err", insErr);
            continue;
          }

          // Notifica todo o staff ativo (filtrando por tenant do projeto se houver)
          let staffQuery = supabase.from("onboarding_staff").select("id, tenant_id").eq("is_active", true);
          if (proj?.tenant_id) staffQuery = staffQuery.eq("tenant_id", proj.tenant_id);
          const { data: staff } = await staffQuery;

          const isHit = t === 100;
          const title = isHit
            ? `🎯 NSM atingido: ${co.name}`
            : `🚀 ${co.name} bateu ${t}% do NSM`;
          const message = isHit
            ? `Norte Estratégico do mês atingido! Realizado ${fmtBRL(achieved)} / Meta ${fmtBRL(targetValue)}.`
            : `Realizado ${fmtBRL(achieved)} de ${fmtBRL(targetValue)} (${Math.round(pct)}% da meta NSM neste mês).`;

          const rows = (staff || []).map((s: any) => ({
            staff_id: s.id,
            project_id: proj?.id || null,
            type: isHit ? "nsm_reached" : "nsm_progress",
            title,
            message,
            reference_id: co.id,
            reference_type: "north_star_metric",
          }));
          if (rows.length > 0) {
            const { error: nErr } = await supabase.from("onboarding_notifications").insert(rows);
            if (nErr) console.error("notif insert err", nErr);
          }

          triggered++;
          detailsLog.push({ company: co.name, threshold: t, pct: Math.round(pct), staff: rows.length });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, triggered, details: detailsLog }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("nsm-progress-check error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
