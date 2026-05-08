import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeMonthYear = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return trimmed;
  return `${match[1]}-${match[2]}`;
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
    let callerTenantId: string | null = null; // null = master UNV

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return json({ error: "Token inválido" }, 401);
      const { data: staff } = await supabase.from("onboarding_staff").select("id, role, tenant_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!staff) return json({ error: "Acesso restrito a membros da equipe" }, 403);
      authenticatedStaffId = staff.id;
      callerTenantId = (staff as any).tenant_id ?? null;
    }

    if (apiKey && !authHeader) {
      const { data: keyRecord } = await supabase.from("api_keys").select("id, is_active, tenant_id").eq("key", apiKey).eq("is_active", true).maybeSingle();
      if (!keyRecord) return json({ error: "API Key inválida" }, 401);
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() } as any).eq("id", keyRecord.id);
      callerTenantId = (keyRecord as any).tenant_id ?? null;
    }

    // Isolamento por tenant: a System API ainda não filtra dados por tenant_id em todas as queries.
    // Por segurança, apenas chamadas do tenant master UNV (tenant_id = NULL) são permitidas.
    // Tenants White-Label devem usar a UI; o acesso programático será liberado quando o filtro
    // por tenant for aplicado em cada endpoint.
    if (callerTenantId !== null) {
      return json({
        error: "Acesso à API indisponível para este tenant. Esta API ainda não está liberada para tenants White-Label.",
        code: "TENANT_API_DISABLED",
      }, 403);
    }

    const url = new URL(req.url);
    const module = url.searchParams.get("module") || "system";
    const action = url.searchParams.get("action") || "list";
    const id = url.searchParams.get("id");

    let body: any = {};
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      body = await req.json();
    }

    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const companyId = url.searchParams.get("company_id");
    const projectId = url.searchParams.get("project_id");
    const leadId = url.searchParams.get("lead_id");
    const pipelineId = url.searchParams.get("pipeline_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "500"), 5000);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const ctx = { supabase, status, dateFrom, dateTo, companyId, projectId, leadId, pipelineId, limit, offset, id, body, staffId: authenticatedStaffId, url };

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
        search: async (c) => {
          const query = c.url.searchParams.get("query");
          if (!query || query.trim().length < 2) return json({ error: "Parâmetro 'query' obrigatório (mínimo 2 caracteres)" }, 400);
          const { data, error } = await c.supabase
            .from("onboarding_companies")
            .select("id, name, cnpj, status, segment, contract_value, consultant_id, cs_id, contract_start_date, contract_end_date")
            .eq("is_simulator", false)
            .ilike("name", `%${query.trim()}%`)
            .order("name")
            .limit(20);
          if (error) throw error;
          // Enrich with active project info
          const enriched = [];
          for (const company of (data || [])) {
            const { data: project } = await c.supabase
              .from("onboarding_projects")
              .select("id, status, product")
              .eq("company_id", company.id)
              .in("status", ["active", "implementation", "ongoing"])
              .maybeSingle();
            enriched.push({ ...company, active_project: project || null });
          }
          return json({ data: enriched, total: enriched.length });
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
          const staffId = c.url.searchParams.get("staff_id");
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
          const role = c.url.searchParams.get("role");
          if (role) q = q.eq("role", role);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [] });
        },
      },

      // ===== CRM LEADS (FULL) =====
      leads: {
        list: async (c) => {
          let q = c.supabase.from("crm_leads").select("id, name, phone, email, company, trade_name, cpf, document, rg, role, city, state, address, address_number, address_complement, address_neighborhood, zipcode, marital_status, legal_representative_name, employee_count, estimated_revenue, origin, origin_id, owner_staff_id, sdr_staff_id, closer_staff_id, scheduled_by_staff_id, pipeline_id, stage_id, plan_id, product_id, opportunity_value, probability, segment, main_pain, urgency, fit_score, payment_method, installments, due_day, team, head_status, head_closing_date, notes, utm_source, utm_medium, utm_campaign, utm_content, entered_pipeline_at, scheduled_at, last_activity_at, next_activity_at, closed_at, created_at, updated_at").order("created_at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.pipelineId) q = q.eq("pipeline_id", c.pipelineId);
          const stageId = c.url.searchParams.get("stage_id");
          if (stageId) q = q.eq("stage_id", stageId);
          const ownerId = c.url.searchParams.get("owner_id");
          if (ownerId) q = q.eq("owner_staff_id", ownerId);
          if (c.dateFrom) q = q.gte("created_at", c.dateFrom);
          if (c.dateTo) q = q.lte("created_at", c.dateTo);
          const search = c.url.searchParams.get("search");
          if (search) q = q.or(`name.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_leads").select("*").eq("id", c.id).single();
          if (error) throw error;
          // Get tags
          const { data: tags } = await c.supabase.from("crm_lead_tags").select("tag_id, crm_tags(id, name, color)").eq("lead_id", c.id);
          return json({ data: { ...data, tags: (tags || []).map((t: any) => t.crm_tags) } });
        },
        create: async (c) => {
          const b = c.body;
          if (!b.name) return json({ error: "Campo 'name' obrigatório" }, 400);
          const insertData: any = {
            name: b.name, phone: b.phone, email: b.email, company: b.company, trade_name: b.trade_name,
            cpf: b.cpf, document: b.document, rg: b.rg, role: b.role,
            city: b.city, state: b.state, address: b.address, address_number: b.address_number,
            address_complement: b.address_complement, address_neighborhood: b.address_neighborhood, zipcode: b.zipcode,
            marital_status: b.marital_status, legal_representative_name: b.legal_representative_name,
            employee_count: b.employee_count, estimated_revenue: b.estimated_revenue,
            pipeline_id: b.pipeline_id, stage_id: b.stage_id, plan_id: b.plan_id, product_id: b.product_id,
            owner_staff_id: b.owner_staff_id, sdr_staff_id: b.sdr_staff_id, closer_staff_id: b.closer_staff_id,
            scheduled_by_staff_id: b.scheduled_by_staff_id,
            opportunity_value: b.opportunity_value, probability: b.probability,
            segment: b.segment, main_pain: b.main_pain, urgency: b.urgency, fit_score: b.fit_score,
            payment_method: b.payment_method, installments: b.installments, due_day: b.due_day,
            team: b.team, notes: b.notes, origin: b.origin, origin_id: b.origin_id,
            utm_source: b.utm_source, utm_medium: b.utm_medium, utm_campaign: b.utm_campaign, utm_content: b.utm_content,
            entered_pipeline_at: new Date().toISOString(),
          };
          const { data, error } = await c.supabase.from("crm_leads").insert(insertData).select().single();
          if (error) throw error;
          // Add tags if provided
          if (b.tag_ids && Array.isArray(b.tag_ids) && b.tag_ids.length > 0) {
            await c.supabase.from("crm_lead_tags").insert(b.tag_ids.map((tid: string) => ({ lead_id: data.id, tag_id: tid })));
          }
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { tag_ids, ...rest } = c.body;
          const { data, error } = await c.supabase.from("crm_leads").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          // Update tags if provided
          if (tag_ids && Array.isArray(tag_ids)) {
            await c.supabase.from("crm_lead_tags").delete().eq("lead_id", c.id);
            if (tag_ids.length > 0) {
              await c.supabase.from("crm_lead_tags").insert(tag_ids.map((tid: string) => ({ lead_id: c.id, tag_id: tid })));
            }
          }
          return json({ data });
        },
        delete: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          // Cascade delete related data
          const tables = [
            "crm_lead_tags", "crm_activities", "crm_lead_stage_history", "crm_meeting_events",
            "crm_lead_form_responses", "crm_lead_checklist_items", "crm_lead_custom_fields",
            "crm_conversations", "crm_lead_contracts",
          ];
          for (const table of tables) {
            await c.supabase.from(table).delete().eq("lead_id", c.id);
          }
          const { error } = await c.supabase.from("crm_leads").delete().eq("id", c.id);
          if (error) throw error;
          return json({ success: true });
        },
        move_stage: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { stage_id } = c.body;
          if (!stage_id) return json({ error: "Campo 'stage_id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_leads").update({ stage_id, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        win: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data: lead } = await c.supabase.from("crm_leads").select("id, pipeline_id, name, phone, email, company, opportunity_value").eq("id", c.id).single();
          if (!lead) return json({ error: "Lead não encontrado" }, 404);
          // Find won stage
          const { data: wonStage } = await c.supabase.from("crm_stages").select("id, name").eq("pipeline_id", lead.pipeline_id).eq("final_type", "won").limit(1).maybeSingle();
          if (!wonStage) return json({ error: "Etapa 'won' não encontrada no pipeline" }, 400);
          const now = new Date().toISOString();
          const finalValue = c.body.opportunity_value ?? c.body.paid_value ?? lead.opportunity_value;
          const updateData: any = { stage_id: wonStage.id, closed_at: now, updated_at: now };
          if (finalValue !== undefined && finalValue !== null) updateData.opportunity_value = finalValue;
          if (c.body.closer_staff_id) updateData.closer_staff_id = c.body.closer_staff_id;
          if (c.body.notes) updateData.notes = c.body.notes;
          if (c.body.payment_method) updateData.payment_method = c.body.payment_method;
          if (c.body.installments) updateData.installments = c.body.installments;
          if (c.body.due_day) updateData.due_day = c.body.due_day;
          const { error: updateError } = await c.supabase.from("crm_leads").update(updateData).eq("id", c.id);
          if (updateError) throw updateError;

          // Create financial record if paid_value provided (with dedup check)
          let invoiceId: string | null = null;
          if (c.body.paid_value && c.body.paid_value > 0) {
            const amountCents = Math.round(c.body.paid_value * 100);
            const description = c.body.description || `Venda: ${lead.company || lead.name || 'Lead'} (via API)`;
            const today = now.split('T')[0];

            // Dedup: check if an invoice was already created for this lead win in the last 5 minutes
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: existingInv } = await c.supabase.from("company_invoices")
              .select("id")
              .eq("amount_cents", amountCents)
              .eq("description", description)
              .eq("status", "paid")
              .gte("created_at", fiveMinAgo)
              .limit(1);

            if (existingInv && existingInv.length > 0) {
              invoiceId = existingInv[0].id;
              return json({ success: true, lead_id: c.id, status: "won", stage: wonStage.name, invoice_id: invoiceId, deduplicated: true });
            }

            const { data: invoice, error: invErr } = await c.supabase.from("company_invoices").insert({
              amount_cents: amountCents, paid_amount_cents: amountCents,
              description, due_date: today, paid_at: now, status: "paid",
              company_id: c.body.company_id || null,
              custom_receiver_name: !c.body.company_id ? (lead.company || lead.name || null) : null,
              payment_method: c.body.payment_method || "pix",
              bank_id: c.body.bank_id || null,
              notes: `Lead: ${lead.name || ''} | Criado via API`,
            }).select("id").single();
            if (!invErr && invoice) {
              invoiceId = invoice.id;
              if (c.body.bank_id) {
                await c.supabase.rpc("increment_bank_balance" as any, { p_bank_id: c.body.bank_id, p_amount: amountCents });
                await c.supabase.from("financial_bank_transactions").insert({
                  bank_id: c.body.bank_id, type: "credit", amount_cents: amountCents,
                  description, reference_type: "invoice", reference_id: invoiceId,
                } as any);
              }
            }
          }
          return json({ success: true, lead_id: c.id, status: "won", stage: wonStage.name, invoice_id: invoiceId });
        },
        lose: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data: lead } = await c.supabase.from("crm_leads").select("id, pipeline_id").eq("id", c.id).single();
          if (!lead) return json({ error: "Lead não encontrado" }, 404);
          const { data: lostStage } = await c.supabase.from("crm_stages").select("id, name").eq("pipeline_id", lead.pipeline_id).eq("final_type", "lost").limit(1).maybeSingle();
          if (!lostStage) return json({ error: "Etapa 'lost' não encontrada no pipeline" }, 400);
          const now = new Date().toISOString();
          const updateData: any = { stage_id: lostStage.id, closed_at: now, lost_at: now, updated_at: now };
          if (c.body.loss_reason_id) updateData.loss_reason_id = c.body.loss_reason_id;
          if (c.body.notes) updateData.notes = c.body.notes;
          const { error } = await c.supabase.from("crm_leads").update(updateData).eq("id", c.id);
          if (error) throw error;
          return json({ success: true, lead_id: c.id, status: "lost", stage: lostStage.name });
        },
        add_note: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { content, author_name } = c.body;
          if (!content) return json({ error: "Campo 'content' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_activities").insert({
            lead_id: c.id, type: "note",
            title: `Nota de ${author_name || 'API'}`,
            description: content,
            responsible_staff_id: c.body.staff_id || null,
            status: "completed", completed_at: new Date().toISOString(),
          }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
      },

      // ===== CRM TAGS =====
      tags: {
        list: async (c) => {
          const { data, error } = await c.supabase.from("crm_tags").select("id, name, color, is_active, created_at").order("name");
          if (error) throw error;
          return json({ data: data || [] });
        },
        create: async (c) => {
          const { name, color } = c.body;
          if (!name) return json({ error: "Campo 'name' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_tags").insert({ name, color: color || null }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        add_to_lead: async (c) => {
          const { lead_id, tag_id } = c.body;
          if (!lead_id || !tag_id) return json({ error: "Campos 'lead_id' e 'tag_id' obrigatórios" }, 400);
          const { data, error } = await c.supabase.from("crm_lead_tags").insert({ lead_id, tag_id }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        remove_from_lead: async (c) => {
          const { lead_id, tag_id } = c.body;
          if (!lead_id || !tag_id) return json({ error: "Campos 'lead_id' e 'tag_id' obrigatórios" }, 400);
          const { error } = await c.supabase.from("crm_lead_tags").delete().eq("lead_id", lead_id).eq("tag_id", tag_id);
          if (error) throw error;
          return json({ success: true });
        },
        lead_tags: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' (lead_id) obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_lead_tags").select("tag_id, crm_tags(id, name, color)").eq("lead_id", c.id);
          if (error) throw error;
          return json({ data: (data || []).map((t: any) => t.crm_tags) });
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
          let q = c.supabase.from("crm_stages").select("id, pipeline_id, name, sort_order, color, is_active, stage_type, final_type, created_at").order("sort_order");
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
          const staffId = c.url.searchParams.get("staff_id");
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
        delete: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { error } = await c.supabase.from("crm_activities").delete().eq("id", c.id);
          if (error) throw error;
          return json({ success: true });
        },
      },

      // ===== MEETINGS =====
      meetings: {
        list: async (c) => {
          let q = c.supabase.from("crm_meeting_events").select("id, lead_id, pipeline_id, event_type, credited_staff_id, triggered_by_staff_id, stage_id, event_date, created_at").order("event_date", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.pipelineId) q = q.eq("pipeline_id", c.pipelineId);
          const eventType = c.url.searchParams.get("event_type");
          if (eventType) q = q.eq("event_type", eventType);
          if (c.dateFrom) q = q.gte("event_date", c.dateFrom);
          if (c.dateTo) q = q.lte("event_date", c.dateTo);
          const staffId = c.url.searchParams.get("staff_id");
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
          const { event_type } = c.body;
          if (!event_type || !["realized", "no_show", "out_of_icp"].includes(event_type)) {
            return json({ error: "Campo 'event_type' obrigatório (realized, no_show, out_of_icp)" }, 400);
          }
          const { data: original } = await c.supabase.from("crm_meeting_events").select("*").eq("id", c.id).single();
          if (!original) return json({ error: "Reunião não encontrada" }, 404);
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

          const normalizedMonthYear = normalizeMonthYear(c.url.searchParams.get("month_year")) || new Date().toISOString().slice(0, 7);
          if (!data?.length || !c.companyId) {
            return json({ data: data || [] });
          }

          const kpiIds = data.map((kpi: any) => kpi.id);
          const { data: monthlyTargets, error: monthlyTargetsError } = await c.supabase
            .from("kpi_monthly_targets")
            .select("kpi_id, month_year, target_value, level_name, level_order, salesperson_id, unit_id, team_id, sector_id")
            .eq("company_id", c.companyId)
            .eq("month_year", normalizedMonthYear)
            .in("kpi_id", kpiIds)
            .order("level_order", { ascending: true });

          if (monthlyTargetsError) throw monthlyTargetsError;

          const resolvedTargets = new Map<string, any>();
          for (const target of monthlyTargets || []) {
            const isCompanyLevel = !target.salesperson_id && !target.unit_id && !target.team_id && !target.sector_id;
            const isMainMeta = target.level_name === "Meta";
            if (!isCompanyLevel || !isMainMeta || resolvedTargets.has(target.kpi_id)) continue;
            resolvedTargets.set(target.kpi_id, target);
          }

          const enrichedData = (data || []).map((kpi: any) => {
            const resolvedTarget = resolvedTargets.get(kpi.id);
            if (!resolvedTarget) return kpi;

            return {
              ...kpi,
              default_target_value: kpi.target_value,
              target_value: resolvedTarget.target_value,
              target_month_year: resolvedTarget.month_year,
              target_source: "monthly_targets",
            };
          });

          return json({ data: enrichedData });
        },
        entries: async (c) => {
          let q = c.supabase.from("kpi_entries").select("id, company_id, salesperson_id, kpi_id, entry_date, value, observations, unit_id, team_id, sector_id, created_at").order("entry_date", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.companyId) q = q.eq("company_id", c.companyId);
          if (c.dateFrom) q = q.gte("entry_date", c.dateFrom);
          if (c.dateTo) q = q.lte("entry_date", c.dateTo);
          const kpiId = c.url.searchParams.get("kpi_id");
          if (kpiId) q = q.eq("kpi_id", kpiId);
          const spId = c.url.searchParams.get("salesperson_id");
          if (spId) q = q.eq("salesperson_id", spId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        monthly_targets: async (c) => {
          let q = c.supabase.from("kpi_monthly_targets").select("id, company_id, kpi_id, month_year, target_value, level_name, level_order, salesperson_id, unit_id, team_id, sector_id, created_at").order("month_year", { ascending: false });
          if (c.companyId) q = q.eq("company_id", c.companyId);
          const monthYear = normalizeMonthYear(c.url.searchParams.get("month_year"));
          if (monthYear) q = q.eq("month_year", monthYear);
          const kpiId = c.url.searchParams.get("kpi_id");
          if (kpiId) q = q.eq("kpi_id", kpiId);
          const spId = c.url.searchParams.get("salesperson_id");
          if (spId) q = q.eq("salesperson_id", spId);
          const unitId = c.url.searchParams.get("unit_id");
          if (unitId) q = q.eq("unit_id", unitId);
          const teamId = c.url.searchParams.get("team_id");
          if (teamId) q = q.eq("team_id", teamId);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [] });
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

      // ===== FINANCIAL RECEIVABLES =====
      receivables: {
        list: async (c) => {
          let q = c.supabase.from("financial_receivables").select("id, company_id, description, amount, due_date, status, paid_amount, paid_date, payment_method, category_id, bank_account_id, contract_id, custom_receiver_name, discount_amount, interest_amount, late_fee_amount, fee_amount, notes, reference_month, is_recurring, payment_link, created_at, updated_at").order("due_date", { ascending: true }).range(c.offset, c.offset + c.limit - 1);
          if (c.status) q = q.eq("status", c.status);
          if (c.companyId) q = q.eq("company_id", c.companyId);
          if (c.dateFrom) q = q.gte("due_date", c.dateFrom);
          if (c.dateTo) q = q.lte("due_date", c.dateTo);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("financial_receivables").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        create: async (c) => {
          const b = c.body;
          if (!b.description || !b.amount || !b.due_date) return json({ error: "Campos 'description', 'amount' e 'due_date' obrigatórios" }, 400);
          const insertData: any = {
            description: b.description, amount: b.amount, due_date: b.due_date,
            company_id: b.company_id || null, custom_receiver_name: b.custom_receiver_name || null,
            payment_method: b.payment_method || null, category_id: b.category_id || null,
            bank_account_id: b.bank_account_id || null, contract_id: b.contract_id || null,
            notes: b.notes || null, reference_month: b.reference_month || null,
            is_recurring: b.is_recurring || false, status: "pending",
          };
          const { data, error } = await c.supabase.from("financial_receivables").insert(insertData).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("financial_receivables").update({ ...c.body, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        mark_paid: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data: rec } = await c.supabase.from("financial_receivables").select("*").eq("id", c.id).single();
          if (!rec) return json({ error: "Recebível não encontrado" }, 404);
          const now = new Date().toISOString();
          const paidAmount = c.body.paid_amount ?? rec.amount;
          const paidDate = c.body.paid_date || now.split("T")[0];
          const bankId = c.body.bank_id || null;
          const updateData: any = { status: "paid", paid_amount: paidAmount, paid_date: paidDate, updated_at: now };
          if (c.body.payment_method) updateData.payment_method = c.body.payment_method;
          if (c.body.discount_amount !== undefined) updateData.discount_amount = c.body.discount_amount;
          if (c.body.interest_amount !== undefined) updateData.interest_amount = c.body.interest_amount;
          if (c.body.late_fee_amount !== undefined) updateData.late_fee_amount = c.body.late_fee_amount;
          const { data, error } = await c.supabase.from("financial_receivables").update(updateData).eq("id", c.id).select().single();
          if (error) throw error;
          // Register bank transaction if bank_id provided
          if (bankId) {
            const amountCents = Math.round(paidAmount * 100);
            await c.supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: amountCents });
            await c.supabase.from("financial_bank_transactions").insert({
              bank_id: bankId, type: "credit", amount_cents: amountCents,
              description: `Recebível: ${rec.description}`, reference_type: "receivable", reference_id: c.id,
              discount_cents: c.body.discount_amount ? Math.round(c.body.discount_amount * 100) : 0,
              interest_cents: c.body.interest_amount ? Math.round(c.body.interest_amount * 100) : 0,
            } as any);
          }
          return json({ data, bank_credited: !!bankId });
        },
        mark_unpaid: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("financial_receivables").update({ status: "pending", paid_amount: null, paid_date: null, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        delete: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          // Find and reverse associated bank transactions before deleting
          const { data: txs } = await c.supabase.from("financial_bank_transactions")
            .select("id, amount_cents, bank_id, type")
            .eq("reference_type", "receivable")
            .eq("reference_id", c.id);
          if (txs && txs.length > 0) {
            for (const tx of txs) {
              const reverseAmount = tx.type === "credit" ? -tx.amount_cents : tx.amount_cents;
              await c.supabase.rpc("increment_bank_balance", { p_bank_id: tx.bank_id, p_amount: reverseAmount });
            }
            await c.supabase.from("financial_bank_transactions").delete().eq("reference_type", "receivable").eq("reference_id", c.id);
          }
          const { error } = await c.supabase.from("financial_receivables").delete().eq("id", c.id);
          if (error) throw error;
          return json({ success: true, transactions_reversed: txs?.length || 0 });
        },
      },

      // ===== FINANCIAL PAYABLES =====
      payables: {
        list: async (c) => {
          let q = c.supabase.from("financial_payables").select("id, supplier_name, description, amount, due_date, status, paid_amount, paid_date, payment_method, category_id, bank_id, bank_account_id, cost_center, cost_center_id, cost_type, notes, reference_month, is_recurring, recurrence_type, installment_number, total_installments, created_at, updated_at").order("due_date", { ascending: true }).range(c.offset, c.offset + c.limit - 1);
          if (c.status) q = q.eq("status", c.status);
          if (c.dateFrom) q = q.gte("due_date", c.dateFrom);
          if (c.dateTo) q = q.lte("due_date", c.dateTo);
          const supplier = c.url.searchParams.get("supplier");
          if (supplier) q = q.ilike("supplier_name", `%${supplier}%`);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("financial_payables").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        create: async (c) => {
          const b = c.body;
          if (!b.supplier_name || !b.description || !b.amount || !b.due_date) return json({ error: "Campos 'supplier_name', 'description', 'amount' e 'due_date' obrigatórios" }, 400);
          const insertData: any = {
            supplier_name: b.supplier_name, description: b.description, amount: b.amount, due_date: b.due_date,
            payment_method: b.payment_method || null, category_id: b.category_id || null,
            bank_id: b.bank_id || null, bank_account_id: b.bank_account_id || null,
            cost_center: b.cost_center || null, cost_center_id: b.cost_center_id || null,
            cost_type: b.cost_type || null, notes: b.notes || null,
            reference_month: b.reference_month || null, is_recurring: b.is_recurring || false,
            recurrence_type: b.recurrence_type || null, installment_number: b.installment_number || null,
            total_installments: b.total_installments || null, status: "pending",
          };
          const { data, error } = await c.supabase.from("financial_payables").insert(insertData).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        update: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("financial_payables").update({ ...c.body, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        mark_paid: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data: pay } = await c.supabase.from("financial_payables").select("*").eq("id", c.id).single();
          if (!pay) return json({ error: "Conta a pagar não encontrada" }, 404);
          const now = new Date().toISOString();
          const paidAmount = c.body.paid_amount ?? pay.amount;
          const paidDate = c.body.paid_date || now.split("T")[0];
          const bankId = c.body.bank_id || pay.bank_id || null;
          const updateData: any = { status: "paid", paid_amount: paidAmount, paid_date: paidDate, updated_at: now };
          if (c.body.payment_method) updateData.payment_method = c.body.payment_method;
          const { data, error } = await c.supabase.from("financial_payables").update(updateData).eq("id", c.id).select().single();
          if (error) throw error;
          // Register bank transaction (debit)
          if (bankId) {
            const amountCents = Math.round(paidAmount * 100);
            await c.supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: -amountCents });
            await c.supabase.from("financial_bank_transactions").insert({
              bank_id: bankId, type: "debit", amount_cents: amountCents,
              description: `Pagamento: ${pay.description}`, reference_type: "payable", reference_id: c.id,
            } as any);
          }
          return json({ data, bank_debited: !!bankId });
        },
        mark_unpaid: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("financial_payables").update({ status: "pending", paid_amount: null, paid_date: null, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
        delete: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          // Find and reverse associated bank transactions before deleting
          const { data: txs } = await c.supabase.from("financial_bank_transactions")
            .select("id, amount_cents, bank_id, type")
            .eq("reference_type", "payable")
            .eq("reference_id", c.id);
          if (txs && txs.length > 0) {
            for (const tx of txs) {
              // Reverse balance: if it was a debit, add back; if credit, subtract
              const reverseAmount = tx.type === "debit" ? tx.amount_cents : -tx.amount_cents;
              await c.supabase.rpc("increment_bank_balance", { p_bank_id: tx.bank_id, p_amount: reverseAmount });
            }
            // Delete all associated transactions
            await c.supabase.from("financial_bank_transactions").delete().eq("reference_type", "payable").eq("reference_id", c.id);
          }
          const { error } = await c.supabase.from("financial_payables").delete().eq("id", c.id);
          if (error) throw error;
          return json({ success: true, transactions_reversed: txs?.length || 0 });
        },
      },

      // ===== INVOICES (company_invoices) =====
      invoices: {
        list: async (c) => {
          let q = c.supabase.from("company_invoices").select("id, company_id, description, amount_cents, paid_amount_cents, due_date, status, paid_at, payment_method, bank_id, bank_account_id, notes, custom_receiver_name, recurring_charge_id, payment_link_id, pagarme_charge_id, installment_number, total_installments, late_fee_cents, interest_cents, discount_cents, created_at, updated_at").order("due_date", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.status) q = q.eq("status", c.status);
          if (c.companyId) q = q.eq("company_id", c.companyId);
          if (c.dateFrom) q = q.gte("due_date", c.dateFrom);
          if (c.dateTo) q = q.lte("due_date", c.dateTo);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("company_invoices").select("*").eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        create: async (c) => {
          const b = c.body;
          if (!b.description || !b.amount_cents || !b.due_date) return json({ error: "Campos 'description', 'amount_cents' e 'due_date' obrigatórios" }, 400);
          const insertData: any = {
            description: b.description, amount_cents: b.amount_cents, due_date: b.due_date,
            company_id: b.company_id || null, custom_receiver_name: b.custom_receiver_name || null,
            payment_method: b.payment_method || null, bank_id: b.bank_id || null,
            bank_account_id: b.bank_account_id || null, notes: b.notes || null,
            status: "pending",
          };
          const { data, error } = await c.supabase.from("company_invoices").insert(insertData).select().single();
          if (error) throw error;
          return json({ data }, 201);
        },
        mark_paid: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data: inv } = await c.supabase.from("company_invoices").select("*").eq("id", c.id).single();
          if (!inv) return json({ error: "Fatura não encontrada" }, 404);
          const now = new Date().toISOString();
          const paidCents = c.body.paid_amount_cents ?? (inv as any).amount_cents;
          const bankId = c.body.bank_id || (inv as any).bank_id || null;
          const updateData: any = {
            status: "paid", paid_amount_cents: paidCents, paid_at: now, updated_at: now,
          };
          if (c.body.payment_method) updateData.payment_method = c.body.payment_method;
          if (c.body.late_fee_cents !== undefined) updateData.late_fee_cents = c.body.late_fee_cents;
          if (c.body.interest_cents !== undefined) updateData.interest_cents = c.body.interest_cents;
          if (c.body.discount_cents !== undefined) updateData.discount_cents = c.body.discount_cents;
          const { data, error } = await c.supabase.from("company_invoices").update(updateData).eq("id", c.id).select().single();
          if (error) throw error;
          if (bankId) {
            await c.supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: paidCents });
            await c.supabase.from("financial_bank_transactions").insert({
              bank_id: bankId, type: "credit", amount_cents: paidCents,
              description: `Fatura: ${(inv as any).description}`, reference_type: "invoice", reference_id: c.id,
            } as any);
          }
          return json({ data, bank_credited: !!bankId });
        },
        mark_unpaid: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("company_invoices").update({ status: "pending", paid_amount_cents: null, paid_at: null, updated_at: new Date().toISOString() }).eq("id", c.id).select().single();
          if (error) throw error;
          return json({ data });
        },
      },

      // ===== ASAAS CHARGES =====
      asaas: {
        create_charge: async (c) => {
          const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
          if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY não configurada" }, 500);
          const b = c.body;
          if (!b.customer_name || !b.amount_cents || !b.payment_method) {
            return json({ error: "Campos 'customer_name', 'amount_cents' e 'payment_method' obrigatórios" }, 400);
          }
          // Accept multiple field names for document
          const rawDocument = b.customer_document || b.document || b.cpf_cnpj || "";
          const ASAAS_BASE = "https://api.asaas.com/v3";
          // Find or create customer
          let cleanDoc = String(rawDocument).replace(/\D/g, "");
          if (cleanDoc.length > 0 && cleanDoc.length <= 11) cleanDoc = cleanDoc.padStart(11, "0");
          else if (cleanDoc.length > 11 && cleanDoc.length <= 14) cleanDoc = cleanDoc.padStart(14, "0");
          let customerId: string | null = null;
          const customerPayload: any = { name: b.customer_name, email: b.customer_email, notificationDisabled: true };
          if (cleanDoc) customerPayload.cpfCnpj = cleanDoc;
          if (b.customer_phone) customerPayload.mobilePhone = b.customer_phone.replace(/\D/g, "");
          if (cleanDoc) {
            const existingRes = await fetch(`${ASAAS_BASE}/customers?cpfCnpj=${cleanDoc}`, { headers: { "access_token": ASAAS_API_KEY } });
            const existing = await existingRes.json();
            if (existing.data?.length > 0) customerId = existing.data[0].id;
          }
          if (!customerId) {
            const newRes = await fetch(`${ASAAS_BASE}/customers`, { method: "POST", headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY }, body: JSON.stringify(customerPayload) });
            const newCustomer = await newRes.json();
            if (!newRes.ok) throw new Error(newCustomer.errors?.[0]?.description || "Erro ao criar cliente no Asaas");
            customerId = newCustomer.id;
          }
          // Create payment
          let billingType = "PIX";
          if (b.payment_method === "credit_card") billingType = "CREDIT_CARD";
          else if (b.payment_method === "boleto") billingType = "BOLETO";
          const amountValue = b.amount_cents / 100;
          const dueDate = b.due_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          const paymentPayload: any = {
            customer: customerId, billingType, value: amountValue, dueDate,
            description: b.description || "Cobrança via API", notificationDisabled: true,
          };
          if (billingType === "CREDIT_CARD" && b.installments > 1) {
            paymentPayload.installmentCount = b.installments;
            paymentPayload.installmentValue = Math.round((amountValue / b.installments) * 100) / 100;
          }
          const payRes = await fetch(`${ASAAS_BASE}/payments`, { method: "POST", headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY }, body: JSON.stringify(paymentPayload) });
          const payment = await payRes.json();
          if (!payRes.ok) throw new Error(payment.errors?.[0]?.description || "Erro ao criar cobrança no Asaas");
          // Get PIX QR if applicable
          let pixData: any = null;
          if (billingType === "PIX" && payment.id) {
            try {
              const pixRes = await fetch(`${ASAAS_BASE}/payments/${payment.id}/pixQrCode`, { headers: { "access_token": ASAAS_API_KEY } });
              if (pixRes.ok) pixData = await pixRes.json();
            } catch {}
          }
          const response: any = {
            success: true, asaas_payment_id: payment.id, status: payment.status,
            invoice_url: payment.invoiceUrl, billing_type: billingType,
          };
          if (pixData) {
            response.pix_qr_code = pixData.payload;
            response.pix_qr_code_base64 = pixData.encodedImage;
          }
          if (billingType === "BOLETO") response.boleto_url = payment.bankSlipUrl;
          // Optionally create receivable record
          if (b.create_receivable !== false) {
            const recInsert: any = {
              description: b.description || `Cobrança Asaas: ${b.customer_name}`,
              amount: amountValue, due_date: dueDate, status: "pending",
              company_id: b.company_id || null,
              custom_receiver_name: !b.company_id ? b.customer_name : null,
              payment_method: b.payment_method,
              notes: `Asaas ID: ${payment.id} | Via API`,
            };
            const { data: recData } = await c.supabase.from("financial_receivables").insert(recInsert).select("id").single();
            if (recData) response.receivable_id = recData.id;
          }
          return json(response, 201);
        },
      },

      // ===== CONVERSATIONS (WhatsApp do Projeto) =====
      conversations: {
        list: async (c) => {
          let q = c.supabase.from("crm_whatsapp_conversations")
            .select("id, instance_id, contact_id, status, assigned_to, lead_id, sector_id, last_message, last_message_at, unread_count, created_at, updated_at, project_id, official_instance_id, contact:crm_whatsapp_contacts(id, phone, name, profile_picture_url)")
            .order("last_message_at", { ascending: false })
            .range(c.offset, c.offset + c.limit - 1);
          if (c.projectId) q = q.eq("project_id", c.projectId);
          if (c.status) q = q.eq("status", c.status);
          const instanceId = c.url.searchParams.get("instance_id");
          if (instanceId) q = q.eq("instance_id", instanceId);
          const assignedTo = c.url.searchParams.get("assigned_to");
          if (assignedTo) q = q.eq("assigned_to", assignedTo);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("crm_whatsapp_conversations")
            .select("id, instance_id, contact_id, status, assigned_to, lead_id, sector_id, last_message, last_message_at, unread_count, created_at, updated_at, project_id, official_instance_id, contact:crm_whatsapp_contacts(id, phone, name, profile_picture_url)")
            .eq("id", c.id).single();
          if (error) throw error;
          return json({ data });
        },
        messages: async (c) => {
          const conversationId = c.id || c.url.searchParams.get("conversation_id");
          if (!conversationId) return json({ error: "Parâmetro 'id' ou 'conversation_id' obrigatório" }, 400);
          let q = c.supabase.from("crm_whatsapp_messages")
            .select("id, conversation_id, remote_id, content, type, direction, status, media_url, media_mimetype, quoted_message_id, sent_by, created_at, whatsapp_message_id")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .range(c.offset, c.offset + c.limit - 1);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        send_message: async (c) => {
          const { conversation_id, message, instance_id } = c.body;
          if (!conversation_id || !message) return json({ error: "Campos 'conversation_id' e 'message' obrigatórios" }, 400);

          // Get conversation with contact
          const { data: conv, error: convErr } = await c.supabase.from("crm_whatsapp_conversations")
            .select("id, instance_id, contact:crm_whatsapp_contacts(phone), project_id")
            .eq("id", conversation_id).single();
          if (convErr || !conv) return json({ error: "Conversa não encontrada" }, 404);

          const targetInstanceId = instance_id || conv.instance_id;
          if (!targetInstanceId) return json({ error: "Instância não identificada para esta conversa" }, 400);

          // Get instance details
          const { data: instance } = await c.supabase.from("whatsapp_instances")
            .select("id, instance_name, api_url, api_key")
            .eq("id", targetInstanceId).single();
          if (!instance) return json({ error: "Instância WhatsApp não encontrada" }, 404);

          const phone = (conv as any).contact?.phone;
          if (!phone) return json({ error: "Contato sem telefone" }, 400);

          // Send via Evolution API edge function
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          const evoResponse = await fetch(`${supabaseUrl}/functions/v1/evolution-api`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "sendText",
              instanceId: targetInstanceId,
              phone: phone,
              message: message,
            }),
          });

          const evoData = await evoResponse.json();
          if (!evoResponse.ok) return json({ error: "Erro ao enviar mensagem", details: evoData }, evoResponse.status);

          // Save message locally
          const { data: savedMsg } = await c.supabase.from("crm_whatsapp_messages").insert({
            conversation_id,
            content: message,
            type: "text",
            direction: "outgoing",
            status: "sent",
            sent_by: c.staffId,
          }).select().single();

          // Update conversation last_message
          await c.supabase.from("crm_whatsapp_conversations").update({
            last_message: message,
            last_message_at: new Date().toISOString(),
          }).eq("id", conversation_id);

          return json({ data: savedMsg, evolution_response: evoData }, 201);
        },
      },

      // ===== WHATSAPP DIRECT SEND =====
      whatsapp: {
        list_instances: async (c) => {
          const { data, error } = await c.supabase.from("whatsapp_instances")
            .select("id, instance_name, status, phone_number")
            .order("instance_name");
          if (error) throw error;
          return json({ data: data || [] });
        },
        send: async (c) => {
          const { instance_id, phone, message, lead_id, project_id } = c.body;
          if (!instance_id || !phone || !message) {
            return json({ error: "Campos 'instance_id', 'phone' e 'message' são obrigatórios" }, 400);
          }

          // Normalize BR phone (E.164, 13 digits)
          let digits = String(phone).replace(/\D/g, "");
          if (!digits) return json({ error: "Telefone inválido" }, 400);
          if (!digits.startsWith("55")) digits = `55${digits}`;
          if (digits.length === 12) {
            const ddd = digits.slice(2, 4);
            const rest = digits.slice(4);
            digits = `55${ddd}9${rest}`;
          }
          const formatted = digits;
          const suffix8 = digits.slice(-8);
          const suffix9 = digits.slice(-9);

          // Validate instance
          const { data: instance } = await c.supabase.from("whatsapp_instances")
            .select("id, instance_name, status").eq("id", instance_id).maybeSingle();
          if (!instance) return json({ error: "Instância WhatsApp não encontrada" }, 404);

          // Find or create contact
          const { data: suffixMatches } = await c.supabase
            .from("crm_whatsapp_contacts")
            .select("id, phone, lead_id, name")
            .or(`phone.ilike.%${suffix8},phone.ilike.%${suffix9}`);

          const contactMatch = (suffixMatches || []).find((ct: any) => {
            const cd = (ct.phone || "").replace(/\D/g, "");
            if (cd.length > 13 || cd.length < 8) return false;
            if ((ct.phone || "").includes("@") || (ct.phone || "").includes("-")) return false;
            return cd.slice(-8) === suffix8 || cd.slice(-9) === suffix9;
          });

          let contactId: string;
          if (contactMatch?.id) {
            contactId = contactMatch.id;
            const updates: Record<string, any> = {};
            if (lead_id && !contactMatch.lead_id) updates.lead_id = lead_id;
            if (Object.keys(updates).length) {
              await c.supabase.from("crm_whatsapp_contacts").update(updates).eq("id", contactId);
            }
          } else {
            const { data: created, error: createErr } = await c.supabase
              .from("crm_whatsapp_contacts")
              .insert({ phone: formatted, lead_id: lead_id || null })
              .select("id").single();
            if (createErr) return json({ error: "Erro ao criar contato", details: createErr.message }, 500);
            contactId = created.id;
          }

          // Find or create conversation (scoped to instance)
          const { data: existingConv } = await c.supabase
            .from("crm_whatsapp_conversations")
            .select("id")
            .eq("contact_id", contactId)
            .eq("instance_id", instance_id)
            .order("last_message_at", { ascending: false, nullsFirst: false })
            .limit(1).maybeSingle();

          let conversationId = existingConv?.id as string | undefined;
          if (!conversationId) {
            const { data: createdConv, error: createConvErr } = await c.supabase
              .from("crm_whatsapp_conversations")
              .insert({
                contact_id: contactId,
                instance_id,
                status: "open",
                unread_count: 0,
                lead_id: lead_id || null,
                project_id: project_id || null,
              })
              .select("id").single();
            if (createConvErr) return json({ error: "Erro ao criar conversa", details: createConvErr.message }, 500);
            conversationId = createdConv.id;
          } else if (lead_id) {
            await c.supabase.from("crm_whatsapp_conversations").update({ lead_id }).eq("id", conversationId);
          }

          // Send via Evolution API
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          const evoResponse = await fetch(`${supabaseUrl}/functions/v1/evolution-api`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sendText", instanceId: instance_id, phone: formatted, message }),
          });
          const evoData = await evoResponse.json();
          if (!evoResponse.ok || evoData?.error) {
            return json({ error: "Erro ao enviar mensagem", details: evoData }, evoResponse.status || 500);
          }

          const remoteId = evoData?.key?.id || null;

          // Save message
          const { data: savedMsg } = await c.supabase.from("crm_whatsapp_messages").insert({
            conversation_id: conversationId,
            content: message,
            type: "text",
            direction: "outbound",
            status: "sent",
            sent_by: c.staffId || null,
            remote_id: remoteId,
          }).select().single();

          await c.supabase.from("crm_whatsapp_conversations").update({
            last_message: message,
            last_message_at: new Date().toISOString(),
          }).eq("id", conversationId);

          return json({
            data: {
              conversation_id: conversationId,
              contact_id: contactId,
              instance_id,
              instance_name: instance.instance_name,
              phone: formatted,
              message_id: savedMsg?.id,
              remote_id: remoteId,
            },
            evolution_response: evoData,
          }, 201);
        },
      },

      // ===== PROJECT MEETINGS (onboarding_meeting_notes) =====
      project_meetings: {
        list: async (c) => {
          let q = c.supabase.from("onboarding_meeting_notes").select(`
            id, project_id, staff_id, meeting_title, meeting_date, subject, notes, attendees,
            meeting_link, recording_link, is_finalized, transcript, live_notes, is_no_show, is_internal,
            scheduled_by, calendar_owner_id, calendar_owner_name, google_event_id, created_at, updated_at,
            staff:onboarding_staff!onboarding_meeting_notes_staff_id_fkey(id, name, email, role),
            scheduled_by_staff:onboarding_staff!onboarding_meeting_notes_scheduled_by_fkey(id, name, email),
            project:onboarding_projects!inner(id, product_name, onboarding_company_id, onboarding_companies(id, name)),
            briefings:onboarding_meeting_briefings(id, briefing_content, generated_at)
          `).order("meeting_date", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
          if (c.projectId) q = q.eq("project_id", c.projectId);
          if (c.companyId) q = q.eq("project.onboarding_company_id", c.companyId);
          const staffId = c.url.searchParams.get("staff_id");
          if (staffId) q = q.eq("staff_id", staffId);
          const isFinalized = c.url.searchParams.get("is_finalized");
          if (isFinalized === "true") q = q.eq("is_finalized", true);
          if (isFinalized === "false") q = q.eq("is_finalized", false);
          const isInternal = c.url.searchParams.get("is_internal");
          if (isInternal === "true") q = q.eq("is_internal", true);
          if (isInternal === "false") q = q.eq("is_internal", false);
          if (c.dateFrom) q = q.gte("meeting_date", c.dateFrom);
          if (c.dateTo) q = q.lte("meeting_date", c.dateTo);
          const { data, error } = await q;
          if (error) throw error;
          return json({ data: data || [], pagination: { limit: c.limit, offset: c.offset } });
        },
        get: async (c) => {
          if (!c.id) return json({ error: "Parâmetro 'id' obrigatório" }, 400);
          const { data, error } = await c.supabase.from("onboarding_meeting_notes").select(`
            id, project_id, staff_id, meeting_title, meeting_date, subject, notes, attendees,
            meeting_link, recording_link, is_finalized, transcript, live_notes, is_no_show, is_internal,
            scheduled_by, calendar_owner_id, calendar_owner_name, google_event_id, created_at, updated_at,
            staff:onboarding_staff!onboarding_meeting_notes_staff_id_fkey(id, name, email, role),
            scheduled_by_staff:onboarding_staff!onboarding_meeting_notes_scheduled_by_fkey(id, name, email),
            project:onboarding_projects(id, product_name, onboarding_company_id, onboarding_companies(id, name)),
            briefings:onboarding_meeting_briefings(id, briefing_content, generated_at)
          `).eq("id", c.id).maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: "Reunião não encontrada" }, 404);
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
              leads: { actions: ["list", "get", "create", "update", "delete", "move_stage", "win", "lose", "add_note"], description: "CRM completo" },
              tags: { actions: ["list", "create", "add_to_lead", "remove_from_lead", "lead_tags"], description: "Tags do CRM" },
              pipelines: { actions: ["list", "stages"], description: "Pipelines e etapas" },
              activities: { actions: ["list", "create", "update", "complete", "delete"], description: "Atividades do CRM" },
              meetings: { actions: ["list", "schedule", "finalize"], description: "Reuniões do CRM" },
              sales: { actions: ["list", "create", "update"], description: "Histórico de vendas" },
              kpis: { actions: ["list", "entries", "monthly_targets", "create_entry"], description: "KPIs, metas mensais e lançamentos" },
              salespeople: { actions: ["list", "create", "update"], description: "Vendedores das empresas" },
              receivables: { actions: ["list", "get", "create", "update", "mark_paid", "mark_unpaid", "delete"], description: "Contas a receber (CRUD + baixa)" },
              payables: { actions: ["list", "get", "create", "update", "mark_paid", "mark_unpaid", "delete"], description: "Contas a pagar (CRUD + baixa)" },
              invoices: { actions: ["list", "get", "create", "mark_paid", "mark_unpaid"], description: "Faturas de empresas" },
              asaas: { actions: ["create_charge"], description: "Criar cobrança no Asaas (PIX/Boleto/Cartão)" },
              conversations: { actions: ["list", "get", "messages", "send_message"], description: "Conversas WhatsApp dos projetos" },
              project_meetings: { actions: ["list", "get"], description: "Reuniões de projetos (atas, participantes, transcrições, briefings)" },
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
