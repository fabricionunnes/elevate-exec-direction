import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MASTER_EMAIL = "fabricio@universidadevendas.com.br";

const DATA_SOURCES = `
Você tem acesso a um banco de dados PostgreSQL. Abaixo estão as tabelas com TODAS as colunas EXATAS (use APENAS estes nomes):

=== MÓDULO ONBOARDING/GESTÃO ===

onboarding_companies (Empresas clientes):
  id, name, cnpj, segment, website, phone, email, address, cs_id (uuid → onboarding_staff.id), consultant_id (uuid → onboarding_staff.id), kickoff_date, contract_start_date, contract_end_date, contract_value, billing_day, status, notes, created_at, updated_at, owner_name, owner_cpf, goal_not_required (boolean), is_billing_blocked, tenant_id

onboarding_staff (Equipe interna - consultores, CS, etc.):
  id, user_id, name (TEXT - nome do staff), email, role, phone, is_active, created_at, updated_at, avatar_url
  IMPORTANTE: A coluna do nome é "name", NÃO "full_name" nem "nome_completo"

onboarding_projects (Projetos de cada empresa):
  id, company_id (→ onboarding_companies.id), product_id, product_name, status, created_at, updated_at, onboarding_company_id, churn_risk, consultant_id (→ onboarding_staff.id), cs_id (→ onboarding_staff.id), crm_lead_id, tenant_id

onboarding_tasks (Tarefas de projetos):
  id, project_id (→ onboarding_projects.id), title, description, due_date, completed_at, status (enum: 'pending','in_progress','completed','cancelled'), assignee_id, responsible_staff_id (→ onboarding_staff.id), start_date, priority, estimated_hours, actual_hours, tags, is_internal, sort_order, created_at

onboarding_users (Usuários de clientes):
  id, project_id (→ onboarding_projects.id), user_id, name, email, temp_password, role, password_changed, salesperson_id, created_at

service_requests (Solicitações de serviço):
  id, project_id (→ onboarding_projects.id), service_catalog_id, menu_key, requested_by, status, admin_notes, created_at

=== MÓDULO FINANCEIRO ===

company_invoices (TABELA PRINCIPAL DE CONTAS A RECEBER):
  id, company_id (→ onboarding_companies.id), description, amount_cents (INTEGER em CENTAVOS - divida por 100 para reais), due_date, status ('pending','paid','overdue','partial','cancelled'), paid_at, paid_amount_cents, payment_method, bank_id, category_id, cost_center_id, installment_number, total_installments, notes, created_at
  SEMPRE use amount_cents/100 para valores em reais

financial_payables (TABELA PRINCIPAL DE CONTAS A PAGAR):
  id, supplier_name, category_id, description, amount (NUMERIC já em reais), due_date, paid_date, paid_amount, status, is_recurring, recurrence_type, payment_method, bank_id, cost_center_id, cost_type, installment_number, total_installments, notes, created_at

financial_banks (Bancos/contas bancárias):
  id, name, bank_code, agency, account_number, initial_balance_cents, current_balance_cents, is_active, created_at

financial_bank_transactions (Extrato bancário):
  id, bank_id (→ financial_banks.id), type ('credit','debit'), amount_cents (BIGINT em centavos), description, reference_type, reference_id, created_at

=== MÓDULO CRM COMERCIAL ===

crm_leads (Leads/negócios):
  id, name, phone, email, company, role, city, state, origin (text), owner_staff_id (→ onboarding_staff.id), team, pipeline_id (→ crm_pipelines.id), stage_id (→ crm_stages.id), opportunity_value, probability, entered_pipeline_at, last_activity_at, next_activity_at, closed_at, loss_reason_id, segment, notes, sdr_staff_id (→ onboarding_staff.id), closer_staff_id (→ onboarding_staff.id), created_by, created_at, origin_id (→ crm_origins.id), head_status, head_closing_date
  IMPORTANTE: NÃO TEM coluna "status". O status é determinado pelo stage_id → crm_stages

crm_pipelines: id, name, description, is_default, is_active, created_by, created_at

crm_stages (Etapas dos pipelines):
  id, pipeline_id (→ crm_pipelines.id), name, sort_order, is_final, final_type ('won','lost'), color, created_at
  Leads ganhos: is_final=true AND final_type='won'
  Leads perdidos: is_final=true AND final_type='lost'
  Forecast: name ILIKE '%forecast%'

crm_activities (Atividades/reuniões):
  id, lead_id (→ crm_leads.id), type, title, description, scheduled_at, completed_at, status, responsible_staff_id (→ onboarding_staff.id), notes, meeting_link, recording_url, created_at

crm_origins: id, name, group_id, pipeline_id, icon, color, sort_order, is_active, created_at

=== MÓDULO RH/RECRUTAMENTO ===

job_openings (Vagas):
  id, project_id, company_id, title, area, job_type, description, requirements, seniority, contract_model, status, salary_range, location, is_remote, created_by, created_at, closed_at, target_date, sla_days, responsible_rh_id, consultant_id

candidates (Candidatos):
  id, project_id, job_opening_id (→ job_openings.id), full_name, email, phone, cpf, linkedin_url, source, current_stage, status, notes, created_at, ai_summary, ai_match_score

=== MÓDULO CANCELAMENTOS ===

onboarding_cancellations: NÃO EXISTE COMO TABELA SEPARADA. Os cancelamentos são gerenciados via onboarding_projects (campos: churn_risk, churn_reason, churn_notes, churn_date, cancellation_signal_reason, cancellation_signal_notes, cancellation_signal_date)

retention_attempts: id, project_id, company_id, staff_id, attempt_date, strategy, notes, result, created_at

=== MÓDULO KPIs ===

company_kpis (Definições de KPIs):
  id, company_id (→ onboarding_companies.id), name, kpi_type ('monetary','numeric','percentage'), periodicity ('daily','weekly','monthly'), target_value, is_individual, is_required, is_active, sort_order, scope, is_main_goal (true = meta principal), team_id, salesperson_id, unit_id, sector_id

kpi_entries (Lançamentos/valores realizados):
  id, company_id, salesperson_id, kpi_id (→ company_kpis.id), entry_date (DATE), value, observations, unit_id, team_id, sector_id

kpi_monthly_targets (Metas mensais):
  id, kpi_id (→ company_kpis.id), company_id, month_year (VARCHAR formato 'YYYY-MM'), target_value, level_name, level_order (1 = meta base), unit_id, salesperson_id, team_id, sector_id

=== RELAÇÕES IMPORTANTES ===
- "Consultor" de uma empresa: onboarding_companies.consultant_id → onboarding_staff.id (coluna name)
- "CS" de uma empresa: onboarding_companies.cs_id → onboarding_staff.id (coluna name)
- "Empresas do consultor X": JOIN onboarding_companies oc ON oc.consultant_id = os.id JOIN onboarding_staff os ON os.name ILIKE '%X%'
- Para saber dados de empresa por nome: onboarding_companies.name ILIKE '%nome%'
- Para cruzar projeto com empresa: onboarding_projects.company_id = onboarding_companies.id OU onboarding_projects.onboarding_company_id = onboarding_companies.id

=== REGRAS SQL ===
1. Use APENAS colunas listadas acima - NUNCA invente colunas
2. APENAS SELECT statements
3. Limite a 50 linhas
4. amount_cents / 100 para converter centavos em reais
5. Para mês atual: due_date >= date_trunc('month', CURRENT_DATE) AND due_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
6. NUNCA use tabelas que não existam (ex: kpi_goals, crm_pipeline_stages)
7. Para buscar por nome de pessoa/empresa, use ILIKE '%nome%'
8. Retorne APENAS o SQL puro, sem markdown, sem explicação
`;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getMonthRange = (monthYear: string) => {
  const [year, month] = monthYear.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
};

const parseMonthYearFromQuestion = (question: string) => {
  const normalized = normalizeText(question);
  const today = new Date();
  const monthNames: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const explicit = normalized.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})/);
  if (explicit) return `${explicit[2]}-${monthNames[explicit[1]]}`;

  const iso = normalized.match(/(20\d{2})-(0[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${iso[2]}`;

  if (normalized.includes("mes passado") || normalized.includes("mês passado")) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  if (normalized.includes("mes atual") || normalized.includes("mês atual") || normalized.includes("esse mes") || normalized.includes("esse mês")) {
    return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return null;
};

const extractCompanyHint = (question: string) => {
  const cleaned = question.replace(/[?!.]/g, " ").replace(/\s+/g, " ").trim();
  const patterns = [
    /empresa\s+(.+?)\s+(?:atingiu|bateu|teve|tem|no|na|em)\b/i,
    /que\s+a\s+empresa\s+(.+?)\s+(?:atingiu|bateu|teve|tem|no|na|em)\b/i,
    /a\s+empresa\s+(.+?)\s+(?:atingiu|bateu|teve|tem|no|na|em)\b/i,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

async function findCompanyByQuestion(supabase: ReturnType<typeof createClient>, question: string) {
  const hint = extractCompanyHint(question);
  if (!hint) return null;

  const { data, error } = await supabase
    .from("onboarding_companies")
    .select("id, name")
    .ilike("name", `%${hint}%`)
    .limit(5);

  if (error || !data || data.length === 0) return null;
  return data.sort((a, b) => a.name.length - b.name.length)[0];
}

async function handleForecastQuery(supabase: ReturnType<typeof createClient>) {
  const { data: stages, error: stagesError } = await supabase
    .from("crm_stages")
    .select("id, name")
    .ilike("name", "%forecast%");

  if (stagesError) throw new Error(stagesError.message);
  if (!stages || stages.length === 0) {
    return {
      sqlQuery: "-- deterministic forecast query",
      resultData: { total_leads: 0, total_value: 0, sample: [], stages: [] },
      queryErrorMessage: null,
    };
  }

  const stageIds = stages.map((stage) => stage.id);
  const { data: leads, error: leadsError } = await supabase
    .from("crm_leads")
    .select("id, name, company, opportunity_value, stage_id, closed_at")
    .in("stage_id", stageIds)
    .is("closed_at", null);

  if (leadsError) throw new Error(leadsError.message);

  const totalValue = (leads || []).reduce((sum, lead) => sum + Number(lead.opportunity_value || 0), 0);
  const sample = (leads || []).slice(0, 10).map((lead) => ({
    nome: lead.name,
    empresa: lead.company,
    valor: Number(lead.opportunity_value || 0),
    stage_id: lead.stage_id,
  }));

  return {
    sqlQuery: "DETERMINISTIC_FORECAST_QUERY",
    resultData: {
      total_leads: leads?.length || 0,
      total_value: totalValue,
      stages: stages.map((stage) => stage.name),
      sample,
    },
    queryErrorMessage: null,
  };
}

async function handleMetaPercentageQuery(supabase: ReturnType<typeof createClient>, question: string) {
  const company = await findCompanyByQuestion(supabase, question);
  const monthYear = parseMonthYearFromQuestion(question);

  if (!company || !monthYear) {
    return null;
  }

  const { startDate, endDate } = getMonthRange(monthYear);

  const { data: kpis, error: kpisError } = await supabase
    .from("company_kpis")
    .select("id, name, kpi_type, periodicity, target_value, is_main_goal")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (kpisError) throw new Error(kpisError.message);
  if (!kpis || kpis.length === 0) {
    return {
      sqlQuery: "DETERMINISTIC_META_QUERY",
      resultData: { company_name: company.name, month_year: monthYear, found: false, reason: "no_kpis" },
      queryErrorMessage: null,
    };
  }

  const targetKpis = kpis.filter((kpi) => kpi.is_main_goal) || [];
  const effectiveKpis = targetKpis.length > 0 ? targetKpis : kpis.filter((kpi) => kpi.kpi_type === "monetary");
  if (effectiveKpis.length === 0) {
    return {
      sqlQuery: "DETERMINISTIC_META_QUERY",
      resultData: { company_name: company.name, month_year: monthYear, found: false, reason: "no_target_kpi" },
      queryErrorMessage: null,
    };
  }

  const kpiIds = effectiveKpis.map((kpi) => kpi.id);

  const [{ data: monthlyTargets, error: targetsError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase
      .from("kpi_monthly_targets")
      .select("kpi_id, target_value, level_order, unit_id, team_id, sector_id, salesperson_id")
      .eq("company_id", company.id)
      .eq("month_year", monthYear)
      .in("kpi_id", kpiIds),
    supabase
      .from("kpi_entries")
      .select("kpi_id, value, entry_date")
      .eq("company_id", company.id)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .in("kpi_id", kpiIds),
  ]);

  if (targetsError) throw new Error(targetsError.message);
  if (entriesError) throw new Error(entriesError.message);

  let totalMonthlyTarget = 0;
  for (const kpi of effectiveKpis) {
    const scopedTargets = (monthlyTargets || []).filter((target) =>
      target.kpi_id === kpi.id &&
      target.unit_id === null &&
      target.team_id === null &&
      target.sector_id === null &&
      target.salesperson_id === null
    );
    const baseTarget = scopedTargets.find((target) => target.level_order === 1) || scopedTargets[0];
    if (baseTarget) {
      totalMonthlyTarget += Number(baseTarget.target_value || 0);
      continue;
    }

    const [year, month] = monthYear.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    if (kpi.periodicity === "daily") totalMonthlyTarget += Number(kpi.target_value || 0) * daysInMonth;
    else if (kpi.periodicity === "weekly") totalMonthlyTarget += Number(kpi.target_value || 0) * Math.ceil(daysInMonth / 7);
    else totalMonthlyTarget += Number(kpi.target_value || 0);
  }

  const totalRealized = (entries || []).reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const percentage = totalMonthlyTarget > 0 ? (totalRealized / totalMonthlyTarget) * 100 : 0;

  return {
    sqlQuery: "DETERMINISTIC_META_QUERY",
    resultData: {
      found: true,
      company_name: company.name,
      month_year: monthYear,
      target_value: totalMonthlyTarget,
      realized_value: totalRealized,
      percentage,
      kpis: effectiveKpis.map((kpi) => ({ id: kpi.id, name: kpi.name })),
    },
    queryErrorMessage: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("email, role")
      .eq("email", user.email)
      .eq("is_active", true)
      .single();

    if (!staffData || staffData.email !== MASTER_EMAIL) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao usuário master" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    const userQuestion = messages[messages.length - 1]?.content || "";
    const normalizedQuestion = normalizeText(userQuestion);

    let sqlQuery = "";
    let resultData: any = null;
    let queryErrorMessage: string | null = null;

    if (normalizedQuestion.includes("forecast")) {
      const deterministic = await handleForecastQuery(supabase);
      sqlQuery = deterministic.sqlQuery;
      resultData = deterministic.resultData;
      queryErrorMessage = deterministic.queryErrorMessage;
    } else if (
      (normalizedQuestion.includes("percentual") || normalizedQuestion.includes("%")) &&
      normalizedQuestion.includes("meta")
    ) {
      const deterministic = await handleMetaPercentageQuery(supabase, userQuestion);
      if (deterministic) {
        sqlQuery = deterministic.sqlQuery;
        resultData = deterministic.resultData;
        queryErrorMessage = deterministic.queryErrorMessage;
      }
    }

    if (!sqlQuery) {
      const sqlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Você é um assistente SQL expert. A data de HOJE é ${new Date().toISOString().split('T')[0]}. Dado o esquema do banco de dados abaixo, gere UMA query SQL SELECT para responder a pergunta do usuário. Retorne APENAS o SQL puro, sem markdown, sem explicação, sem \`\`\`.

IMPORTANTE: Quando o usuário perguntar sobre "contas a receber", considere TODOS os status (pending, paid, overdue, partial) a menos que ele especifique um status. Quando perguntar "quanto tenho a receber", inclua todos os registros do período independente do status.

${DATA_SOURCES}`,
            },
            { role: "user", content: userQuestion },
          ],
        }),
      });

      if (!sqlResponse.ok) {
        const errText = await sqlResponse.text();
        console.error("AI SQL generation error:", sqlResponse.status, errText);
        if (sqlResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (sqlResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Erro ao gerar SQL");
      }

      const sqlJson = await sqlResponse.json();
      sqlQuery = sqlJson.choices?.[0]?.message?.content?.trim() || "";
      sqlQuery = sqlQuery.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();
      sqlQuery = sqlQuery.replace(/;\s*$/, "").trim();

      const upperSql = sqlQuery.toUpperCase().trim();
      if (!upperSql.startsWith("SELECT") || /\b(DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE)\b/i.test(sqlQuery)) {
        return new Response(JSON.stringify({ error: "A consulta gerada não é segura. Apenas consultas SELECT são permitidas.", sql: sqlQuery }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", { query_text: sqlQuery });
      if (queryError) {
        console.error("Query execution error:", queryError);
        queryErrorMessage = queryError.message;
      } else {
        resultData = queryResult;
      }
    }

    const interpretMessages = [
      {
        role: "system" as const,
        content: `Você é o assistente executivo direto do Fabrício, CEO da Universidade de Vendas. Responda de forma DIRETA, objetiva e informal-profissional. NUNCA use "Prezado(a) Cliente" ou linguagem formal de atendimento. Fale como um braço-direito que entrega dados rápidos.

REGRAS DE FORMATAÇÃO:
1. NUNCA use tabelas markdown com mais de 3 colunas — use listas compactas
2. Para forecast, informe primeiro quantidade e valor total
3. Para percentual de meta, informe realizado, meta e percentual final
4. Use títulos (##, ###) quando ajudar
5. Destaque totais em **negrito**
6. Formate valores em R$ com separador de milhar (ponto) e decimal (vírgula)
7. Se houve erro, explique de forma simples sem inventar dados`,
      },
      ...messages.slice(0, -1),
      { role: "user" as const, content: userQuestion },
      {
        role: "assistant" as const,
        content: `Executei a seguinte consulta no banco de dados:\n\
\`\`\`sql\n${sqlQuery}\n\`\`\`\n\n${queryErrorMessage ? `Erro na consulta: ${queryErrorMessage}` : `Resultado:\n${JSON.stringify(resultData, null, 2)}`}`,
      },
      {
        role: "user" as const,
        content: "Com base nos dados acima, me dê uma resposta completa e bem formatada para a minha pergunta original. Não mostre o SQL, apenas interprete os dados de forma clara e acionável.",
      },
    ];

    const interpretResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: interpretMessages,
        stream: true,
      }),
    });

    if (!interpretResponse.ok) {
      const errText = await interpretResponse.text();
      console.error("AI interpret error:", interpretResponse.status, errText);
      throw new Error("Erro ao interpretar resultados");
    }

    return new Response(interpretResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("master-ai-query error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
