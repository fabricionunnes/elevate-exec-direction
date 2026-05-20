import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Restore order respects FK dependencies (parents before children)
const RESTORE_ORDER = [
  "onboarding_staff",
  "onboarding_services",
  "onboarding_companies",
  "onboarding_projects",
  "onboarding_tasks",
  "onboarding_subtasks",
  "onboarding_task_comments",
  "onboarding_task_history",
  "onboarding_task_templates",
  "onboarding_meeting_notes",
  "onboarding_meeting_briefings",
  "onboarding_announcements",
  "onboarding_tickets",
  "onboarding_ticket_replies",
  "onboarding_notifications",
  "company_invoices",
  "company_recurring_charges",
  "company_kpis",
  "financial_bank_accounts",
  "financial_categories",
  "financial_receivables",
  "financial_payables",
  "financial_transactions",
  "financial_suppliers",
  "commercial_actions",
  "commercial_action_templates",
  "commercial_director_analyses",
  "generated_contracts",
  "contract_template_clauses",
  "employee_contracts",
  "routine_contracts",
  "crm_pipelines",
  "crm_stages",
  "crm_leads",
  "crm_activities",
  "crm_tags",
  "crm_origins",
  "crm_products",
  "crm_settings",
  "crm_sales",
  "job_openings",
  "candidates",
  "interviews",
  "onboarding_monthly_goals",
  "onboarding_nps_responses",
  "company_sales_history",
  "kpi_entries",
  "kpi_monthly_targets",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token de autenticação ausente" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only master can restore (more dangerous than backup)
    const { data: staff } = await supabaseAdmin
      .from("onboarding_staff")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!staff || staff.role !== "master") {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas o usuário master pode restaurar o banco de dados." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse backup file
    const backup = await req.json();

    if (!backup.version || !backup.data || !backup.tables) {
      return new Response(JSON.stringify({ error: "Arquivo de backup inválido. Verifique o formato." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { upserted: number; skipped: number; error?: string }> = {};

    // Restore tables in dependency order
    const tablesToRestore = RESTORE_ORDER.filter((t) => backup.data[t] !== undefined);

    for (const table of tablesToRestore) {
      const rows = backup.data[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        results[table] = { upserted: 0, skipped: 0 };
        continue;
      }

      try {
        // Upsert in batches of 100 to avoid payload limits
        const batchSize = 100;
        let upserted = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await supabaseAdmin
            .from(table)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

          if (error) {
            console.error(`Error upserting ${table} batch ${i}:`, error.message);
            results[table] = {
              upserted,
              skipped: rows.length - upserted,
              error: error.message,
            };
            break;
          }
          upserted += batch.length;
        }

        if (!results[table]) {
          results[table] = { upserted, skipped: 0 };
        }
      } catch (e) {
        console.error(`Unexpected error on ${table}:`, e);
        results[table] = { upserted: 0, skipped: rows.length, error: String(e) };
      }
    }

    const totalUpserted = Object.values(results).reduce((s, r) => s + r.upserted, 0);
    const tablesWithErrors = Object.entries(results).filter(([, r]) => r.error).map(([t]) => t);

    console.log(`Restore complete: ${totalUpserted} rows upserted, ${tablesWithErrors.length} tables with errors`);

    return new Response(
      JSON.stringify({
        success: true,
        restored_from: backup.exported_at,
        tables_restored: tablesToRestore.length,
        total_rows_upserted: totalUpserted,
        errors: tablesWithErrors.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Restore error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
