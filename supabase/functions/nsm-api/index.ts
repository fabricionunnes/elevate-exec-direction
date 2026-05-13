import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth
  const apiKey = req.headers.get("x-api-key");
  const expected = Deno.env.get("NSM_API_KEY");
  if (!expected || apiKey !== expected) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Parse body (POST) or query (GET)
    const url = new URL(req.url);
    let payload: any = {};
    if (req.method === "POST") {
      payload = await req.json().catch(() => ({}));
    } else if (req.method === "GET") {
      payload = Object.fromEntries(url.searchParams.entries());
    } else {
      return json({ error: "Method not allowed" }, 405);
    }

    const {
      company_id,
      company_name,
      target_value, // em reais (ex: 150000.50)
      target_value_cents, // em centavos (ex: 15000050)
      label,
    } = payload;

    // Resolve company
    let companyId: string | null = company_id || null;
    let resolvedName = "";
    if (!companyId && company_name) {
      const { data } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .ilike("name", `%${company_name}%`)
        .limit(1)
        .maybeSingle();
      companyId = data?.id || null;
      resolvedName = data?.name || "";
    } else if (companyId) {
      const { data } = await supabase
        .from("onboarding_companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle();
      resolvedName = data?.name || "";
    }

    if (!companyId) {
      return json({ error: "Empresa não encontrada. Informe company_id ou company_name." }, 404);
    }

    // GET = retornar status atual
    if (req.method === "GET") {
      const { data: co } = await supabase
        .from("onboarding_companies")
        .select("id, name, north_star_metric_cents, north_star_metric_label")
        .eq("id", companyId)
        .maybeSingle();

      const targetCents = Number(co?.north_star_metric_cents || 0);
      const targetValueR = targetCents / 100;

      // Realizado do mês corrente
      const now = new Date();
      const startStr = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().slice(0, 10);
      const endStr = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().slice(0, 10);

      const { data: kpis } = await supabase
        .from("company_kpis")
        .select("id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .eq("is_main_goal", true)
        .eq("kpi_type", "monetary");
      const kpiIds = (kpis || []).map((k: any) => k.id);

      let achieved = 0;
      if (kpiIds.length > 0) {
        const { data: entries } = await supabase
          .from("kpi_entries")
          .select("value")
          .eq("company_id", companyId)
          .in("kpi_id", kpiIds)
          .gte("entry_date", startStr)
          .lte("entry_date", endStr);
        achieved = (entries || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      }

      return json({
        success: true,
        company_id: companyId,
        company_name: co?.name || resolvedName,
        target_value: targetValueR,
        target_value_cents: targetCents,
        label: co?.north_star_metric_label || null,
        current_month_achieved: achieved,
        progress_percent: targetValueR > 0
          ? Math.round((achieved / targetValueR) * 1000) / 10
          : 0,
      });
    }

    // POST = atualizar NSM
    let cents: number | null = null;
    if (typeof target_value_cents === "number" && target_value_cents >= 0) {
      cents = Math.round(target_value_cents);
    } else if (typeof target_value === "number" && target_value >= 0) {
      cents = Math.round(target_value * 100);
    } else if (typeof target_value === "string" && target_value.trim() !== "") {
      const n = Number(target_value.replace(",", "."));
      if (!isNaN(n)) cents = Math.round(n * 100);
    }

    if (cents === null) {
      return json({
        error: "Informe target_value (em reais) ou target_value_cents (em centavos).",
      }, 400);
    }

    const update: Record<string, unknown> = { north_star_metric_cents: cents };
    if (typeof label === "string") update.north_star_metric_label = label;

    const { error: upErr } = await supabase
      .from("onboarding_companies")
      .update(update)
      .eq("id", companyId);

    if (upErr) {
      console.error("[nsm-api] update error", upErr);
      return json({ error: "Erro ao atualizar NSM", details: upErr.message }, 500);
    }

    return json({
      success: true,
      company_id: companyId,
      company_name: resolvedName,
      target_value: cents / 100,
      target_value_cents: cents,
      label: typeof label === "string" ? label : null,
    });
  } catch (e) {
    console.error("[nsm-api] error", e);
    return json({ error: String(e) }, 500);
  }
});
