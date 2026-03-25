import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth
    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("x-api-key");

    if (!authHeader && !apiKey) {
      return json({ error: "Não autorizado. Envie Authorization: Bearer <token> ou x-api-key: <chave>" }, 401);
    }

    let authenticatedStaffId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return json({ error: "Token inválido" }, 401);
      const { data: staff } = await supabase.from("onboarding_staff").select("id, role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!staff) return json({ error: "Acesso restrito a membros da equipe" }, 403);
      authenticatedStaffId = staff.id;
    }

    if (apiKey && !authHeader) {
      const { data: keyRecord } = await supabase.from("api_keys").select("id, is_active").eq("key", apiKey).eq("is_active", true).maybeSingle();
      if (!keyRecord) return json({ error: "API Key inválida" }, 401);
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() } as any).eq("id", keyRecord.id);
    }

    const url = new URL(req.url);
    const module = url.searchParams.get("module") || "system";
    const action = url.searchParams.get("action") || "list";
    const id = url.searchParams.get("id");

    let body: any = {};
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      body = await req.json();
    }

    // Query params for filtering
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const companyId = url.searchParams.get("company_id");
    const projectId = url.searchParams.get("project_id");
    const leadId = url.searchParams.get("lead_id");
    const pipelineId = url.searchParams.get("pipeline_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "500"), 5000);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const ctx = { supabase, status, dateFrom, dateTo, companyId, projectId, leadId, pipelineId, limit, offset, id, body, staffId: authenticatedStaffId };

    // Route
    const modules: Record<string, Record<string, (c: any) => Promise<Response>>> = {
      // ===== COMPANIES =====
      companies: {
        list: async (c) => {
          let q = c.supabase.from("onboarding_companies").select("id, name, cnpj, segment, status, contract_value, billing_day, email, phone, website, address, cs_id, consultant_id, kickoff_date, contract_start_date, contract_end_date, notes, created_at, updated_at").eq("is_simulator", false).order("name").range(c.offset, c.offset + c.limit - 1);
          if (c.status) q = q.eq("status", c.status);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("onboarding_companies").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        create: async (c) => {
          const { name, cnpj, segment, contract_value, billing_day, email, phone, website, address, notes, consultant_id, cs_id, kickoff_date, contract_start_date, contract_end_date } = c.body;
          if (!name) return json({ error: "Campo 'name' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("onboarding_companies").insert({ name, cnpj, segment, contract_value, billing_day, email, phone, website, address, notes, consultant_id, cs_id, kickoff_date, contract_start_date, contract_end_date }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("onboarding_companies").update({ ...c.body, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== PROJECTS =====
      projects: {
        list: async (c) => {
          let q = c.supabase.from("onboarding_projects").select("id, company_id, onboarding_company_id, product_id, product_name, status, consultant_id, cs_id, churn_risk, created_at, updated_at").order("created_at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.status) q = q.eq("status", c.status);
          if (c.companyId) q = q.or(`company_id.eq.${c.companyId},onboarding_company_id.eq.${c.companyId}`);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("onboarding_projects").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== TASKS =====
      tasks: {
        list: async (c) => {
          let q = c.supabase.from("onboarding_tasks").select("id, project_id, title, description, due_date, start_date, status, priority, assignee_id, responsible_staff_id, observations, tags, estimated_hours, actual_hours, completed_at, created_at, updated_at").order("due_date", { ascending: true }).range(c.offset, c.offset + c.limit - 1);
          if (c.status) q = q.eq("status", c.status);
          if (c.projectId) q = q.eq("project_id", c.projectId);
          if (c.dateFrom) q = q.gte("due_date", c.dateFrom);
          if (c.dateTo) q = q.lte("due_date", c.dateTo);
          const staffId = url.searchParams.get("staff_id");
          if (staffId) q = q.eq("responsible_staff_id", staffId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("onboarding_tasks").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        create: async (c) => {
          const { project_id, title, description, due_date, start_date, priority, responsible_staff_id, assignee_id, observations, tags, estimated_hours } = c.body;
          if (!project_id || !title) return json({ error: "Campos 'project_id' e 'title' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("onboarding_tasks").insert({ project_id, title, description, due_date, start_date, priority: priority || "medium", responsible_staff_id, assignee_id, observations, tags, estimated_hours, status: "pending" }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const updates: any = { ...c.body, updated_at: new Date().toISOString() };
          if (updates.status === "completed" && !updates.completed_at) {
            updates.completed_at = new Date().toISOString();
          }
          const { data, error } = await c.supabase.from("onboarding_tasks").update(updates).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        delete: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { error } = await c.supabase.from("onboarding_tasks").delete().eq("id", c.id);
          if (error) throw error;
          return json({ success: true });
        },
      },

      // ===== STAFF =====
      staff: {
        list: async (c) => {
          let q = c.supabase.from("onboarding_staff").select("id, name, email, role, phone, is_active, avatar_url, created_at").order("name");
          if (c.status === "active") q = q.eq("is_active", true);
          if (c.status === "inactive") q = q.eq("is_active", false);
          const role = url.searchParams.get("role");
          if (role) q = q.eq("role", role);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [] });
        },
      },

      // ===== CRM LEADS =====
      leads: {
        list: async (c) => {
          let q = c.supabase.from("crm_leads").select("id, name, phone, email, company, role, city, state, origin, owner_staff_id, sdr_staff_id, closer_staff_id, pipeline_id, stage_id, opportunity_value, probability, segment, main_pain, urgency, fit_score, notes, entered_pipeline_at, last_activity_at, closed_at, created_at, updated_at").order("created_at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.pipelineId) q = q.eq("pipeline_id", c.pipelineId);
          const stageId = url.searchParams.get("stage_id");
          if (stageId) q = q.eq("stage_id", stageId);
          const ownerId = url.searchParams.get("owner_id");
          if (ownerId) q = q.eq("owner_staff_id", ownerId);
          if (c.dateFrom) q = q.gte("created_at", c.dateFrom);
          if (c.dateTo) q = q.lte("created_at", c.dateTo);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_leads").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        create: async (c) => {
          const { name, phone, email, company, pipeline_id, stage_id, owner_staff_id, sdr_staff_id, closer_staff_id, opportunity_value, segment, main_pain, urgency, notes, origin } = c.body;
          if (!name) return json({ error: "Campo 'name' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_leads").insert({ name, phone, email, company, pipeline_id, stage_id, owner_staff_id, sdr_staff_id, closer_staff_id, opportunity_value, segment, main_pain, urgency, notes, origin, entered_pipeline_at: new Date().toISOString() }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_leads").update({ ...c.body, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        move_stage: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { stage_id } = c.body;
          if (!stage_id) return json({ error: "Campo 'stage_id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_leads").update({ stage_id, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== CRM PIPELINES =====
      pipelines: {
        list: async (c) => {
          const { data, error } = await c.supabase.from("crm_pipelines").select("id, name, description, is_default, is_active, created_at").order("name");
          if (error) throw error;
          return json({ data: data || [] });
        },
        stages: async (c) => {
          let q = c.supabase.from("crm_stages").select("id, pipeline_id, name, sort_order, color, is_active, stage_type, created_at").order("sort_order");
          if (c.pipelineId) q = q.eq("pipeline_id", c.pipelineId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [] });
        },
      },

      // ===== CRM ACTIVITIES =====
      activities: {
        list: async (c) => {
          let q = c.supabase.from("crm_activities").select("id, lead_id, type, title, description, scheduled_at, completed_at, status, responsible_staff_id, notes, meeting_link, created_at, updated_at").order("scheduled_at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.leadId) q = q.eq("lead_id", c.leadId);
          if (c.status) q = q.eq("status", c.status);
          if (c.dateFrom) q = q.gte("scheduled_at", c.dateFrom);
          if (c.dateTo) q = q.lte("scheduled_at", c.dateTo);
          const staffId = url.searchParams.get("staff_id");
          if (staffId) q = q.eq("responsible_staff_id", staffId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        create: async (c) => {
          const { lead_id, type, title, description, scheduled_at, responsible_staff_id, notes, meeting_link } = c.body;
          if (!lead_id || !type || !title) return json({ error: "Campos 'lead_id', 'type' e 'title' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("crm_activities").insert({ lead_id, type, title, description, scheduled_at, responsible_staff_id, notes, meeting_link, status: "pending" }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const updates: any = { ...c.body, updated_at: new Date().toISOString() };
          if (updates.status === "completed" && !updates.completed_at) updates.completed_at = new Date().toISOString();
          const { data, error } = await c.supabase.from("crm_activities").update(updates).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        complete: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_activities").update({ status: "completed", completed_at: new Date().toISOString(), notes: c.body.notes, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== MEETINGS =====
      meetings: {
        list: async (c) => {
          let q = c.supabase.from("crm_meeting_events").select("id, lead_id, pipeline_id, event_type, credited_staff_id, triggered_by_staff_id, stage_id, event_date, created_at").order("event_date", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.pipelineId) q = q.eq("pipeline_id", c.pipelineId);
          const eventType = url.searchParams.get("event_type");
          if (eventType) q = q.eq("event_type", eventType);
          if (c.dateFrom) q = q.gte("event_date", c.dateFrom);
          if (c.dateTo) q = q.lte("event_date", c.dateTo);
          const staffId = url.searchParams.get("staff_id");
          if (staffId) q = q.eq("credited_staff_id", staffId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        schedule: async (c) => {
          const { lead_id, pipeline_id, credited_staff_id, triggered_by_staff_id, stage_id, event_date } = c.body;
          if (!lead_id || !pipeline_id || !credited_staff_id) return json({ error: "Campos 'lead_id', 'pipeline_id' e 'credited_staff_id' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("crm_meeting_events").insert({ lead_id, pipeline_id, event_type: "scheduled", credited_staff_id, triggered_by_staff_id, stage_id, event_date: event_date || new Date().toISOString() }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        finalize: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { event_type } = c.body; // realized, no_show, out_of_icp
          if (!event_type || !["realized", "no_show", "out_of_icp"].includes(event_type)) {
            return json({ error: "Campo 'event_type' obrigatório (realized, no_show, out_of_icp)" }, 400);
          }
          // Get original meeting to copy context
          const { data: original } = await c.supabase.from("crm_meeting_events").select("*").eq("id", c.id).single();
          if (!original) return json({ error: "Reunião não encontrada" }, 404);
          // Insert finalization event
          const { data, error } = await c.supabase.from("crm_meeting_events").insert({
            lead_id: original.lead_id, pipeline_id: original.pipeline_id, event_type,
            credited_staff_id: original.credited_staff_id, triggered_by_staff_id: c.body.triggered_by_staff_id || original.triggered_by_staff_id,
            stage_id: original.stage_id, event_date: new Date().toISOString(),
          }).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== SALES =====
      sales: {
        list: async (c) => {
          let q = c.supabase.from("company_sales_history").select("id, company_id, month_year, revenue, sales_count, notes, target_revenue, is_pre_unv, created_at").order("month_year", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.companyId) q = q.eq("company_id", c.companyId);
          if (c.dateFrom) q = q.gte("month_year", c.dateFrom);
          if (c.dateTo) q = q.lte("month_year", c.dateTo);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        create: async (c) => {
          const { company_id, month_year, revenue, sales_count, notes, target_revenue, is_pre_unv } = c.body;
          if (!company_id || !month_year) return json({ error: "Campos 'company_id' e 'month_year' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("company_sales_history").upsert({ company_id, month_year, revenue: revenue || 0, sales_count: sales_count || 0, notes, target_revenue, is_pre_unv: is_pre_unv ?? false }, { onConflict: "company_id,month_year" }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("company_sales_history").update({ ...c.body, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== KPIs =====
      kpis: {
        list: async (c) => {
          let q = c.supabase.from("company_kpis").select("id, company_id, name, kpi_type, periodicity, target_value, is_individual, is_required, is_active, is_main_goal, scope, sector_id, team_id, unit_id, salesperson_id, sort_order, created_at").order("sort_order");
          if (c.companyId) q = q.eq("company_id", c.companyId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [] });
        },
        entries: async (c) => {
          let q = c.supabase.from("kpi_entries").select("id, company_id, salesperson_id, kpi_id, entry_date, value, observations, unit_id, team_id, sector_id, created_at").order("entry_date", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.companyId) q = q.eq("company_id", c.companyId);
          if (c.dateFrom) q = q.gte("entry_date", c.dateFrom);
          if (c.dateTo) q = q.lte("entry_date", c.dateTo);
          const kpiId = url.searchParams.get("kpi_id");
          if (kpiId) q = q.eq("kpi_id", kpiId);
          const spId = url.searchParams.get("salesperson_id");
          if (spId) q = q.eq("salesperson_id", spId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        create_entry: async (c) => {
          const { company_id, salesperson_id, kpi_id, entry_date, value, observations, unit_id, team_id, sector_id } = c.body;
          if (!company_id || !salesperson_id || !kpi_id) return json({ error: "Campos 'company_id', 'salesperson_id' e 'kpi_id' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("kpi_entries").upsert({ company_id, salesperson_id, kpi_id, entry_date: entry_date || new Date().toISOString().split("T")[0], value: value || 0, observations, unit_id, team_id, sector_id }, { onConflict: "salesperson_id,kpi_id,entry_date" }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
      },

      // ===== SALESPEOPLE =====
      salespeople: {
        list: async (c) => {
          let q = c.supabase.from("company_salespeople").select("id, company_id, name, email, phone, is_active, unit_id, team_id, sector_id, access_code, created_at").order("name");
          if (c.companyId) q = q.eq("company_id", c.companyId);
          if (c.status === "active") q = q.eq("is_active", true);
          if (c.status === "inactive") q = q.eq("is_active", false);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [] });
        },
        create: async (c) => {
          const { company_id, name, email, phone, unit_id, team_id, sector_id } = c.body;
          if (!company_id || !name) return json({ error: "Campos 'company_id' e 'name' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("company_salespeople").insert({ company_id, name, email, phone, unit_id, team_id, sector_id }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("company_salespeople").update({ ...c.body, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== SYSTEM INFO =====
      system: {
        endpoints: async () => {
          return json({
            modules: {
              companies: { actions: ["list", "get", "create", "update"], description: "Gerenciar empresas/clientes" },
              projects: { actions: ["list", "get"], description: "Visualizar projetos" },
              tasks: { actions: ["list", "get", "create", "update", "delete"], description: "Gerenciar tarefas" },
              staff: { actions: ["list"], description: "Listar colaboradores" },
              leads: { actions: ["list", "get", "create", "update", "move_stage"], description: "Gerenciar leads do CRM" },
              pipelines: { actions: ["list", "stages"], description: "Pipelines e etapas" },
              activities: { actions: ["list", "create", "update", "complete"], description: "Atividades do CRM" },
              meetings: { actions: ["list", "schedule", "finalize"], description: "Reuniões do CRM" },
              sales: { actions: ["list", "create", "update"], description: "Histórico de vendas" },
              kpis: { actions: ["list", "entries", "create_entry"], description: "KPIs e lançamentos" },
              salespeople: { actions: ["list", "create", "update"], description: "Vendedores das empresas" },
            },
            usage: "?module=<module>&action=<action>&id=<id>",
            auth: "Authorization: Bearer <jwt> OU x-api-key: <key>",
          });
        },
      },
    };

    const mod = modules[module];
    if (!mod) return json({ error: `Módulo '${module}' não encontrado`, available: Object.keys(modules) }, 404);
    const handler = mod[action];
    if (!handler) return json({ error: `Ação '${action}' não disponível para '${module}'`, available: Object.keys(mod) }, 404);

    return await handler(ctx);
  } catch (e) {
    console.error("system-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
