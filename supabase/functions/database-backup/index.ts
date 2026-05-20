import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Ordered list of tables to backup (respects FK dependencies)
const BACKUP_TABLES = [
  // Core staff & companies
  "onboarding_staff",
  "onboarding_services",
  "onboarding_companies",
  "onboarding_projects",
  // Tasks & activities
  "onboarding_tasks",
  "onboarding_subtasks",
  "onboarding_task_comments",
  "onboarding_task_history",
  "onboarding_task_templates",
  // Meetings & comms
  "onboarding_meeting_notes",
  "onboarding_meeting_briefings",
  "onboarding_announcements",
  "onboarding_tickets",
  "onboarding_ticket_replies",
  "onboarding_notifications",
  // Financial
  "company_invoices",
  "company_recurring_charges",
  "company_kpis",
  "financial_bank_accounts",
  "financial_categories",
  "financial_receivables",
  "financial_payables",
  "financial_transactions",
  "financial_suppliers",
  // Commercial
  "commercial_actions",
  "commercial_action_templates",
  "commercial_director_analyses",
  // Contracts
  "generated_contracts",
  "contract_template_clauses",
  "employee_contracts",
  "routine_contracts",
  // CRM
  "crm_pipelines",
  "crm_stages",
  "crm_leads",
  "crm_activities",
  "crm_tags",
  "crm_origins",
  "crm_products",
  "crm_settings",
  "crm_sales",
  // People
  "job_openings",
  "candidates",
  "interviews",
  // Monthly data
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
    // Auth: verify user is master or admin
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

    // Get user from JWT
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

    // Check role
    const { data: staff } = await supabaseAdmin
      .from("onboarding_staff")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!staff || !["master", "admin"].includes(staff.role)) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas master e admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Export all tables
    const backup: Record<string, unknown[]> = {};
    const meta: Record<string, { count: number; error?: string }> = {};

    for (const table of BACKUP_TABLES) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          console.warn(`Skipping ${table}:`, error.message);
          meta[table] = { count: 0, error: error.message };
          backup[table] = [];
        } else {
          backup[table] = data || [];
          meta[table] = { count: (data || []).length };
        }
      } catch (e) {
        console.warn(`Error on ${table}:`, e);
        meta[table] = { count: 0, error: String(e) };
        backup[table] = [];
      }
    }

    const payload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      tables: BACKUP_TABLES,
      meta,
      data: backup,
    };

    const totalRows = Object.values(meta).reduce((s, t) => s + t.count, 0);
    console.log(`Backup complete: ${BACKUP_TABLES.length} tables, ${totalRows} rows`);

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-unv-nexus-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
