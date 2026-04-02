import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MASTER_EMAIL = "fabricio@universidadevendas.com.br";

// Map of available data sources and how to query them
const DATA_SOURCES = `
Você tem acesso a um banco de dados PostgreSQL com as seguintes tabelas e seus propósitos:

MÓDULO ONBOARDING/GESTÃO:
- onboarding_companies: Empresas clientes (id, name, segment, status, consultant_id, cs_id, created_at, etc.)
- onboarding_projects: Projetos de cada empresa (id, company_id, name, status, start_date, end_date, etc.)
- onboarding_users: Usuários de projetos/clientes (id, project_id, full_name, email, role, etc.)
- onboarding_staff: Equipe interna (id, full_name, email, role, is_active, etc.)
- onboarding_tasks: Tarefas de projetos (id, project_id, title, status, responsible_id, due_date, etc.)
- service_requests: Solicitações de serviço (id, project_id, type, status, created_at, etc.)

MÓDULO FINANCEIRO:
- company_invoices: TABELA PRINCIPAL DE CONTAS A RECEBER. Faturas das empresas clientes (id, company_id, description, amount_cents (valor em CENTAVOS - divida por 100 para obter reais), due_date, status, paid_at, paid_amount_cents, etc.). SEMPRE use esta tabela para consultas de contas a receber / faturamento / receita.
- financial_receivables: Recebíveis avulsos (SECUNDÁRIA, geralmente vazia - prefira company_invoices para contas a receber)
- financial_payables: TABELA PRINCIPAL DE CONTAS A PAGAR (id, supplier_name, description, amount, due_date, status, paid_amount, paid_date, category_id, etc.)
- client_financial_receivables: Recebíveis internos de clientes (id, project_id, description, amount, due_date, status, etc.)
- client_financial_payables: Pagáveis internos de clientes (id, project_id, description, amount, due_date, status, etc.)
- financial_banks: Bancos (id, name, balance, etc.)
- financial_bank_transactions: Transações bancárias (id, bank_id, amount, type, description, date, etc.)
- staff_financial_entries: Lançamentos financeiros da equipe

MÓDULO CRM COMERCIAL:
- crm_leads: Leads comerciais (id, name, phone, email, company, role, city, state, origin, owner_staff_id, team, pipeline_id, stage_id, opportunity_value, probability, entered_pipeline_at, last_activity_at, next_activity_at, closed_at, loss_reason_id, segment, notes, sdr_staff_id, closer_staff_id, created_at, etc.). IMPORTANTE: NÃO TEM coluna "status". O status do lead é determinado pelo stage_id vinculado à tabela crm_stages.
- crm_pipelines: Pipelines de venda (id, name, description, is_default, is_active, etc.)
- crm_stages: Etapas dos pipelines (id, pipeline_id, name, sort_order, is_final, final_type, color). Para leads "ganhos" use is_final=true AND final_type='won'. Para "perdidos" use is_final=true AND final_type='lost'. Leads em forecast são os que NÃO estão em etapa final (is_final=false).
- crm_activities: Atividades do CRM (id, lead_id, type, title, description, scheduled_at, completed_at, status, responsible_staff_id, notes, meeting_link, recording_url, etc.)
- crm_origins: Origens de leads (id, name, pipeline_id, icon, color, sort_order, is_active)

MÓDULO RH/RECRUTAMENTO:
- job_openings: Vagas em aberto (id, project_id, title, status, department, location, etc.)
- candidates: Candidatos (id, job_opening_id, full_name, email, current_stage, status, etc.)
- candidate_resumes: Currículos dos candidatos

MÓDULO CANCELAMENTOS:
- onboarding_cancellations: Solicitações de cancelamento (id, company_id, project_id, reason, status, requested_at, etc.)
- retention_attempts: Tentativas de retenção

MÓDULO KPIs:
- company_kpis: Definições de KPIs por empresa (id, company_id, name, kpi_type ('monetary','numeric','percentage'), periodicity, target_value, is_individual, is_required, is_active, sort_order, scope, is_main_goal (true = meta principal/faturamento), team_id, salesperson_id, unit_id, sector_id)
- kpi_entries: Lançamentos/valores realizados de KPIs (id, company_id, salesperson_id, kpi_id, entry_date (tipo DATE), value, observations, unit_id, team_id, sector_id). Para calcular o realizado de um mês, filtre por entry_date >= 'YYYY-MM-01' AND entry_date <= 'YYYY-MM-último_dia'.
- kpi_monthly_targets: Metas mensais de KPIs (id, kpi_id, company_id, month_year (formato 'YYYY-MM'), target_value, level_name, level_order, unit_id, salesperson_id, team_id, sector_id). A meta base/principal é level_order = 1. Use esta tabela para consultas de metas.
- kpi_target_levels: Níveis de meta por KPI
- kpi_salespeople: Relação KPI-vendedores
- kpi_sectors: Relação KPI-setores
- kpi_teams: Relação KPI-equipes
- kpi_units: Relação KPI-unidades

REGRAS PARA CÁLCULO DE % DE META ATINGIDA:
1. Buscar o KPI principal (is_main_goal = true) na tabela company_kpis
2. Buscar a meta do mês na tabela kpi_monthly_targets com level_order = 1 (meta base)
3. Somar os valores realizados em kpi_entries para o período
4. Calcular: (SUM(kpi_entries.value) / kpi_monthly_targets.target_value) * 100
5. Exemplo de query para % de meta:
   SELECT ROUND((SUM(ke.value) / NULLIF(kmt.target_value, 0)) * 100, 1) as percentual
   FROM kpi_entries ke
   JOIN company_kpis ck ON ck.id = ke.kpi_id
   JOIN kpi_monthly_targets kmt ON kmt.kpi_id = ck.id AND kmt.company_id = ke.company_id AND kmt.month_year = 'YYYY-MM'
   WHERE ke.company_id = '...' AND ck.is_main_goal = true AND kmt.level_order = 1
   AND ke.entry_date >= 'YYYY-MM-01' AND ke.entry_date <= 'YYYY-MM-último_dia'

MÓDULO ACADEMY:
- academy_tracks: Trilhas da academia
- academy_lessons: Aulas
- academy_progress: Progresso dos alunos
- academy_quizzes: Quizzes
- academy_quiz_attempts: Tentativas de quiz

MÓDULO SOCIAL/MARKETING:
- social_content_cards: Cards de conteúdo social
- social_content_boards: Boards de conteúdo

MÓDULO WHATSAPP:
- whatsapp_instances: Instâncias de WhatsApp
- whatsapp_message_log: Log de mensagens

MÓDULO AGENDAMENTOS:
- appointments: Agendamentos
- appointment_clients: Clientes de agendamento
- appointment_services: Serviços de agendamento
- appointment_professionals: Profissionais

Regras IMPORTANTES:
1. SEMPRE use SQL válido para PostgreSQL
2. Use COUNT, SUM, AVG para agregações
3. Limite resultados a no máximo 50 linhas
4. Para valores monetários, formate em BRL (R$)
5. Retorne APENAS a query SQL, sem explicações
6. Use JOINs quando necessário para cruzar dados
7. Para status, os comuns são: 'active', 'inactive', 'pending', 'paid', 'overdue', 'cancelled', 'completed', 'open', 'closed', 'won', 'lost'
8. Em company_invoices, amount_cents está em CENTAVOS (divida por 100 para reais). paid_amount_cents também em centavos.
9. Nunca use DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE ou qualquer comando que modifique dados
10. Use ONLY SELECT statements
11. Para "contas a receber" ou "faturamento", use SEMPRE a tabela company_invoices (com amount_cents / 100)
12. Para "contas a pagar", use SEMPRE a tabela financial_payables
13. Para filtrar pelo mês atual, use: due_date >= date_trunc('month', CURRENT_DATE) AND due_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
14. NUNCA use a tabela "kpi_goals" - ela NÃO EXISTE. Use "kpi_monthly_targets" para metas e "kpi_entries" para valores realizados.
15. Para calcular % de meta atingida: SUM(kpi_entries.value) / NULLIF(kpi_monthly_targets.target_value, 0) * 100
16. Para buscar empresa por nome, use ILIKE '%nome%' na tabela onboarding_companies
`;

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

    // Verify master user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    
    // Use the anon client to get user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if master
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

    // Step 1: Ask AI to generate SQL query
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
            content: `Você é um assistente SQL expert. A data de HOJE é ${new Date().toISOString().split('T')[0]}. Dado o esquema do banco de dados abaixo, gere UMA query SQL SELECT para responder a pergunta do usuário. Retorne APENAS o SQL puro, sem markdown, sem explicação, sem \`\`\`.\n\nIMPORTANTE: Quando o usuário perguntar sobre "contas a receber", considere TODOS os status (pending, paid, overdue, partial) a menos que ele especifique um status. Quando perguntar "quanto tenho a receber", inclua todos os registros do período independente do status.\n\n${DATA_SOURCES}`,
          },
          {
            role: "user",
            content: userQuestion,
          },
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
    let sqlQuery = sqlJson.choices?.[0]?.message?.content?.trim() || "";
    
    // Clean up SQL (remove markdown code blocks, trailing semicolons, etc.)
    sqlQuery = sqlQuery.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();
    // Remove trailing semicolons - they cause syntax errors inside the RPC wrapper
    sqlQuery = sqlQuery.replace(/;\s*$/, "").trim();

    // Security: only allow SELECT
    const upperSql = sqlQuery.toUpperCase().trim();
    if (!upperSql.startsWith("SELECT") || 
        /\b(DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE)\b/i.test(sqlQuery)) {
      return new Response(JSON.stringify({ 
        error: "A consulta gerada não é segura. Apenas consultas SELECT são permitidas.",
        sql: sqlQuery 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Execute SQL query
    const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", {
      query_text: sqlQuery,
    });

    let resultData: any;
    let queryErrorMessage: string | null = null;

    if (queryError) {
      console.error("Query execution error:", queryError);
      queryErrorMessage = queryError.message;
      resultData = null;
    } else {
      resultData = queryResult;
    }

    // Step 3: Ask AI to interpret results with streaming
    const interpretMessages = [
      {
        role: "system" as const,
        content: `Você é o assistente executivo direto do Fabrício, CEO da Universidade de Vendas. Responda de forma DIRETA, objetiva e informal-profissional. NUNCA use "Prezado(a) Cliente" ou linguagem formal de atendimento. Fale como um braço-direito que entrega dados rápidos.

REGRAS DE FORMATAÇÃO:
1. NUNCA use tabelas markdown com mais de 3 colunas — use listas compactas
2. Exemplo de lista: - **Empresa X** — R$ 2.000,00 — Vence: 10/04 — Pending
3. Use títulos (##, ###) para organizar seções
4. Destaque totais em **negrito**
5. Formate valores em R$ com separador de milhar (ponto) e decimal (vírgula)
6. Para >10 registros, agrupe por categoria/status/data
7. Comece com um RESUMO rápido dos totais
8. Use emojis com moderação (📊 💰 ⚠️ ✅)
9. Se houve erro na query, explique o que aconteceu de forma simples e sugira reformular a pergunta — NÃO invente dados e NÃO fale em "equipe técnica"`,
      },
      ...messages.slice(0, -1),
      {
        role: "user" as const,
        content: userQuestion,
      },
      {
        role: "assistant" as const,
        content: `Executei a seguinte consulta no banco de dados:\n\`\`\`sql\n${sqlQuery}\n\`\`\`\n\n${queryErrorMessage ? `Erro na consulta: ${queryErrorMessage}` : `Resultado:\n${JSON.stringify(resultData, null, 2)}`}`,
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
