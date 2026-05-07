// agente-unv v2.5 — fix: remove apikey header do nexusGet/nexusPost (causava JWT 401)
import Anthropic from "npm:@anthropic-ai/sdk";

// ============ ENV VARS ============
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? ""; // opcional — habilita voz
const EVOLUTION_URL = "https://evo07.stevo.chat";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "fabricionunnes";
const SUPABASE_URL = "https://czmyjgdixwhpfasfugkm.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY";
const NEXUS_URL = `${SUPABASE_URL}/functions/v1`;
const NEXUS_KEY_FINANCEIRO = Deno.env.get("NEXUS_KEY_FINANCEIRO") ?? "";
const NEXUS_KEY_DIRETOR = Deno.env.get("NEXUS_KEY_DIRETOR") ?? "";

const TELEGRAM_TOKENS: Record<string, string> = {
  financeiro: Deno.env.get("TELEGRAM_TOKEN_FINANCEIRO") ?? "8302241725:AAG9FT9vUtWPhs4zE-0P2tp5-LJCnBorQtE",
  crm:        Deno.env.get("TELEGRAM_TOKEN_CRM")        ?? "8690436126:AAED3kFZgonruvAZg9wVYt_ltcQ2fqGL_zI",
  projetos:   Deno.env.get("TELEGRAM_TOKEN_PROJETOS")   ?? "8731972632:AAFUT8lkyxYrSaouq5lew9p9N-kCgsZdl5U",
  ceo:        Deno.env.get("TELEGRAM_TOKEN_CEO")        ?? "8663785814:AAESc_KL4xMLQlwbrFNYI6WlZocZlMkWAKk",
};

// Voz por agente (OpenAI TTS)
const TTS_VOICES: Record<string, string> = {
  financeiro: "onyx",    // Noah — voz grave, profissional
  crm:        "nova",    // Sophia — voz feminina, confiante
  projetos:   "shimmer", // Melissa — voz feminina, calorosa
  ceo:        "fable",   // CEO — voz autoritativa
};

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
type AgentType = "financeiro" | "crm" | "projetos" | "ceo";

// ============ TOOLS — NOAH (FINANCEIRO) ============
const FINANCIAL_TOOLS: Anthropic.Tool[] = [
  { name: "resumo_financeiro", description: "Retorna resumo financeiro: saldo bancário, recebíveis, contas a pagar e MRR", input_schema: { type: "object", properties: {} } },
  { name: "contas_bancarias", description: "Lista contas bancárias com saldos atuais", input_schema: { type: "object", properties: {} } },
  { name: "fluxo_caixa", description: "Projeção de fluxo de caixa por período", input_schema: { type: "object", properties: { date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "inadimplentes", description: "Lista clientes com faturas em atraso", input_schema: { type: "object", properties: {} } },
  { name: "dre", description: "Demonstrativo de Resultado do Exercício", input_schema: { type: "object", properties: { date_from: { type: "string" } } } },
  { name: "criar_conta_receber", description: "Cria uma conta a receber", input_schema: { type: "object", properties: { description: { type: "string" }, amount: { type: "number" }, due_date: { type: "string" }, payment_method: { type: "string", enum: ["pix","boleto","credit_card","transfer"] }, notes: { type: "string" }, company_id: { type: "string" }, custom_receiver_name: { type: "string" } }, required: ["description","amount","due_date"] } },
  { name: "marcar_recebido", description: "Marca um recebível como pago", input_schema: { type: "object", properties: { id: { type: "string" }, paid_amount: { type: "number" }, paid_date: { type: "string" }, payment_method: { type: "string" } }, required: ["id"] } },
  { name: "criar_conta_pagar", description: "Cria uma conta a pagar", input_schema: { type: "object", properties: { supplier_name: { type: "string" }, description: { type: "string" }, amount: { type: "number" }, due_date: { type: "string" }, payment_method: { type: "string" }, cost_type: { type: "string", enum: ["fixed","variable"] }, notes: { type: "string" } }, required: ["supplier_name","description","amount","due_date"] } },
  { name: "marcar_pago", description: "Marca uma conta a pagar como paga", input_schema: { type: "object", properties: { id: { type: "string" }, paid_amount: { type: "number" }, paid_date: { type: "string" }, payment_method: { type: "string" } }, required: ["id"] } },
  { name: "criar_fatura", description: "Cria fatura para empresa cliente", input_schema: { type: "object", properties: { description: { type: "string" }, amount_cents: { type: "number" }, due_date: { type: "string" }, company_id: { type: "string" }, custom_receiver_name: { type: "string" }, payment_method: { type: "string" }, notes: { type: "string" } }, required: ["description","amount_cents","due_date"] } },
];

// ============ TOOLS — SOPHIA (CRM) ============
const CRM_TOOLS: Anthropic.Tool[] = [
  // Leads
  { name: "listar_leads", description: "Lista leads do CRM com filtros", input_schema: { type: "object", properties: { pipeline_id: { type: "string" }, stage_id: { type: "string" }, search: { type: "string" }, owner_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "detalhes_lead", description: "Detalhes completos de um lead", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "criar_lead", description: "Cria um novo lead no CRM", input_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, cpf: { type: "string" }, company: { type: "string" }, pipeline_id: { type: "string" }, stage_id: { type: "string" }, opportunity_value: { type: "number" }, segment: { type: "string" }, main_pain: { type: "string" }, notes: { type: "string" }, origin: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip_code: { type: "string" }, address: { type: "string" }, address_number: { type: "string" }, address_complement: { type: "string" }, neighborhood: { type: "string" }, tag_ids: { type: "array", items: { type: "string" } }, closer_staff_id: { type: "string" }, utm_source: { type: "string" }, utm_medium: { type: "string" }, utm_campaign: { type: "string" }, utm_content: { type: "string" }, utm_term: { type: "string" } }, required: ["name"] } },
  { name: "atualizar_lead", description: "Atualiza campos de um lead existente", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, cpf: { type: "string" }, company: { type: "string" }, opportunity_value: { type: "number" }, segment: { type: "string" }, main_pain: { type: "string" }, notes: { type: "string" }, origin: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip_code: { type: "string" }, address: { type: "string" }, tag_ids: { type: "array", items: { type: "string" } }, closer_staff_id: { type: "string" } }, required: ["id"] } },
  { name: "mover_etapa", description: "Move lead para outra etapa do pipeline", input_schema: { type: "object", properties: { id: { type: "string" }, stage_id: { type: "string" } }, required: ["id","stage_id"] } },
  { name: "dar_ganho", description: "Marca lead como GANHO/fechado", input_schema: { type: "object", properties: { id: { type: "string" }, opportunity_value: { type: "number" }, paid_value: { type: "number" }, payment_method: { type: "string" }, notes: { type: "string" }, bank_id: { type: "string" }, company_id: { type: "string" }, closer_staff_id: { type: "string" } }, required: ["id"] } },
  { name: "dar_perda", description: "Marca lead como PERDIDO", input_schema: { type: "object", properties: { id: { type: "string" }, notes: { type: "string" }, loss_reason_id: { type: "string" } }, required: ["id"] } },
  { name: "adicionar_nota", description: "Adiciona nota ao lead", input_schema: { type: "object", properties: { id: { type: "string" }, content: { type: "string" }, author_name: { type: "string" }, staff_id: { type: "string" } }, required: ["id","content"] } },
  { name: "excluir_lead", description: "Remove um lead do CRM", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  // Tags
  { name: "listar_tags", description: "Lista todas as tags disponíveis no CRM", input_schema: { type: "object", properties: {} } },
  { name: "criar_tag", description: "Cria uma nova tag no CRM", input_schema: { type: "object", properties: { name: { type: "string" }, color: { type: "string" } }, required: ["name"] } },
  { name: "vincular_tag", description: "Vincula uma tag a um lead", input_schema: { type: "object", properties: { lead_id: { type: "string" }, tag_id: { type: "string" } }, required: ["lead_id","tag_id"] } },
  { name: "desvincular_tag", description: "Remove uma tag de um lead", input_schema: { type: "object", properties: { lead_id: { type: "string" }, tag_id: { type: "string" } }, required: ["lead_id","tag_id"] } },
  { name: "tags_do_lead", description: "Lista tags de um lead específico", input_schema: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] } },
  // Atividades
  { name: "listar_atividades", description: "Lista atividades com filtros por lead, status ou responsável", input_schema: { type: "object", properties: { lead_id: { type: "string" }, status: { type: "string", enum: ["pending","completed","overdue"] }, staff_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "criar_atividade", description: "Cria atividade ou follow-up para lead", input_schema: { type: "object", properties: { lead_id: { type: "string" }, type: { type: "string", enum: ["call","whatsapp","email","meeting","followup","proposal","note","other"] }, title: { type: "string" }, description: { type: "string" }, scheduled_at: { type: "string" }, responsible_staff_id: { type: "string" }, meeting_link: { type: "string" } }, required: ["lead_id","type","title"] } },
  { name: "concluir_atividade", description: "Marca uma atividade como concluída", input_schema: { type: "object", properties: { id: { type: "string" }, notes: { type: "string" } }, required: ["id"] } },
  { name: "excluir_atividade", description: "Remove uma atividade do CRM", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  // Reuniões CRM
  { name: "listar_reunioes_crm", description: "Lista reuniões de vendas do CRM (diferente de reuniões de projetos)", input_schema: { type: "object", properties: { lead_id: { type: "string" }, pipeline_id: { type: "string" }, status: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "agendar_reuniao", description: "Agenda reunião de vendas para lead", input_schema: { type: "object", properties: { lead_id: { type: "string" }, pipeline_id: { type: "string" }, credited_staff_id: { type: "string" }, triggered_by_staff_id: { type: "string" }, stage_id: { type: "string" }, event_date: { type: "string" } }, required: ["lead_id","pipeline_id","credited_staff_id"] } },
  { name: "finalizar_reuniao", description: "Finaliza uma reunião de vendas registrando resultado", input_schema: { type: "object", properties: { id: { type: "string" }, outcome: { type: "string" }, notes: { type: "string" } }, required: ["id"] } },
  // Pipelines
  { name: "listar_pipelines", description: "Lista pipelines do CRM", input_schema: { type: "object", properties: {} } },
  { name: "listar_etapas", description: "Lista etapas/stages de um pipeline específico", input_schema: { type: "object", properties: { pipeline_id: { type: "string" } }, required: ["pipeline_id"] } },
];

// ============ TOOLS — MELISSA (PROJETOS) ============
const PROJECT_TOOLS: Anthropic.Tool[] = [
  // Empresas
  { name: "listar_empresas", description: "Lista empresas clientes", input_schema: { type: "object", properties: { status: { type: "string", enum: ["active","inactive","churned"] } } } },
  { name: "detalhes_empresa", description: "Detalhes de uma empresa cliente", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "criar_empresa", description: "Cria nova empresa cliente", input_schema: { type: "object", properties: { name: { type: "string" }, cnpj: { type: "string" }, segment: { type: "string" }, contract_value: { type: "number" }, billing_day: { type: "number" }, email: { type: "string" }, phone: { type: "string" }, website: { type: "string" }, address: { type: "string" }, notes: { type: "string" }, consultant_id: { type: "string" }, cs_id: { type: "string" }, kickoff_date: { type: "string" }, contract_start_date: { type: "string" }, contract_end_date: { type: "string" } }, required: ["name"] } },
  { name: "atualizar_empresa", description: "Atualiza dados de empresa cliente (status, contrato, observações)", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, status: { type: "string", enum: ["active","inactive","churned"] }, contract_value: { type: "number" }, billing_day: { type: "number" }, email: { type: "string" }, phone: { type: "string" }, notes: { type: "string" }, consultant_id: { type: "string" }, cs_id: { type: "string" }, contract_start_date: { type: "string" }, contract_end_date: { type: "string" } }, required: ["id"] } },
  // Projetos
  { name: "listar_projetos", description: "Lista projetos com filtros", input_schema: { type: "object", properties: { status: { type: "string", enum: ["pending","active","completed","paused"] }, company_id: { type: "string" } } } },
  { name: "detalhes_projeto", description: "Detalhes completos de um projeto", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  // Tarefas
  { name: "listar_tarefas", description: "Lista tarefas com filtros (projeto, status, responsável, período)", input_schema: { type: "object", properties: { project_id: { type: "string" }, status: { type: "string", enum: ["pending","in_progress","completed"] }, staff_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "criar_tarefa", description: "Cria nova tarefa em um projeto", input_schema: { type: "object", properties: { project_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, due_date: { type: "string" }, start_date: { type: "string" }, priority: { type: "string", enum: ["low","medium","high","urgent"] }, responsible_staff_id: { type: "string" }, assignee_id: { type: "string" }, tags: { type: "array", items: { type: "string" } }, estimated_hours: { type: "number" }, observations: { type: "string" } }, required: ["project_id","title"] } },
  { name: "atualizar_tarefa", description: "Atualiza status, responsável ou dados de tarefa", input_schema: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["pending","in_progress","completed"] }, title: { type: "string" }, description: { type: "string" }, observations: { type: "string" }, due_date: { type: "string" }, priority: { type: "string", enum: ["low","medium","high","urgent"] }, responsible_staff_id: { type: "string" } }, required: ["id"] } },
  { name: "excluir_tarefa", description: "Exclui uma tarefa", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  // Colaboradores (Staff)
  { name: "listar_staff", description: "Lista colaboradores internos da UNV (consultores, CS, closers, SDRs)", input_schema: { type: "object", properties: { status: { type: "string", enum: ["active","inactive"] }, role: { type: "string" } } } },
  // Vendas mensais
  { name: "listar_vendas", description: "Lista histórico de vendas mensais de empresa cliente", input_schema: { type: "object", properties: { company_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "registrar_venda", description: "Lança venda mensal de empresa cliente (upsert por empresa+mês)", input_schema: { type: "object", properties: { company_id: { type: "string" }, month_year: { type: "string" }, revenue: { type: "number" }, sales_count: { type: "number" }, target_revenue: { type: "number" }, notes: { type: "string" } }, required: ["company_id","month_year"] } },
  { name: "atualizar_venda", description: "Atualiza registro de venda mensal", input_schema: { type: "object", properties: { id: { type: "string" }, revenue: { type: "number" }, sales_count: { type: "number" }, target_revenue: { type: "number" }, notes: { type: "string" } }, required: ["id"] } },
  // KPIs — Dashboard
  { name: "listar_kpis", description: "Lista KPIs configurados da empresa. target_value já reflete a meta do mês (se informado month_year)", input_schema: { type: "object", properties: { company_id: { type: "string" }, month_year: { type: "string" } }, required: ["company_id"] } },
  { name: "entradas_kpi", description: "Lista lançamentos diários de KPI por vendedor — dados reais do dashboard. Use date_from/date_to para filtrar por mês", input_schema: { type: "object", properties: { company_id: { type: "string" }, kpi_id: { type: "string" }, salesperson_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } }, required: ["company_id"] } },
  { name: "metas_mensais_kpi", description: "Busca metas mensais reais de KPI. IMPORTANTE: meta real fica aqui, NÃO no target_value do KPI. Use level_name='Meta' para meta principal", input_schema: { type: "object", properties: { company_id: { type: "string" }, month_year: { type: "string" }, kpi_id: { type: "string" }, salesperson_id: { type: "string" } }, required: ["company_id"] } },
  { name: "registrar_kpi", description: "Lança resultado diário de KPI para um vendedor (upsert por vendedor+KPI+data)", input_schema: { type: "object", properties: { company_id: { type: "string" }, salesperson_id: { type: "string" }, kpi_id: { type: "string" }, value: { type: "number" }, entry_date: { type: "string" }, observations: { type: "string" }, unit_id: { type: "string" }, team_id: { type: "string" }, sector_id: { type: "string" } }, required: ["company_id","salesperson_id","kpi_id","value"] } },
  // Vendedores dos clientes
  { name: "listar_vendedores", description: "Lista vendedores de empresa cliente — necessário para cruzar com lançamentos de KPI", input_schema: { type: "object", properties: { company_id: { type: "string" }, status: { type: "string", enum: ["active","inactive"] } }, required: ["company_id"] } },
  { name: "criar_vendedor", description: "Cria novo vendedor para empresa cliente", input_schema: { type: "object", properties: { company_id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, unit_id: { type: "string" }, team_id: { type: "string" }, sector_id: { type: "string" } }, required: ["company_id","name"] } },
  { name: "atualizar_vendedor", description: "Atualiza dados ou status de vendedor cliente", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, is_active: { type: "boolean" }, unit_id: { type: "string" }, team_id: { type: "string" }, sector_id: { type: "string" } }, required: ["id"] } },
  // Reuniões de Projeto
  { name: "listar_reunioes", description: "Lista reuniões de projeto com briefing IA, transcrição e participantes", input_schema: { type: "object", properties: { project_id: { type: "string" }, company_id: { type: "string" }, staff_id: { type: "string" }, is_finalized: { type: "boolean" }, is_internal: { type: "boolean" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "detalhes_reuniao", description: "Detalhes completos de uma reunião de projeto (inclui transcrição, briefing IA, gravação)", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  // Conversas WhatsApp
  { name: "listar_conversas", description: "Lista conversas WhatsApp vinculadas a um projeto (contato, status, última mensagem)", input_schema: { type: "object", properties: { project_id: { type: "string" }, status: { type: "string", enum: ["open","closed","archived"] }, assigned_to: { type: "string" }, limit: { type: "number" } }, required: ["project_id"] } },
  { name: "mensagens_conversa", description: "Lista histórico de mensagens de uma conversa WhatsApp (direction: incoming=cliente, outgoing=equipe)", input_schema: { type: "object", properties: { id: { type: "string" }, limit: { type: "number" } }, required: ["id"] } },
  { name: "enviar_mensagem_conversa", description: "Envia mensagem de texto em uma conversa WhatsApp existente — envia via WhatsApp e salva no histórico", input_schema: { type: "object", properties: { conversation_id: { type: "string" }, message: { type: "string" } }, required: ["conversation_id","message"] } },
];

// ============ TOOLS — CEO ============
const CEO_TOOLS: Anthropic.Tool[] = [
  { name: "consultar_financeiro", description: "Consulta Noah (CFO) sobre dados financeiros: saldo, caixa, inadimplência, MRR, DRE", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
  { name: "consultar_crm", description: "Consulta Sophia (Diretora Comercial) sobre pipeline, leads, conversão e negociações", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
  { name: "consultar_projetos", description: "Consulta Melissa (Gestora CS/Projetos) sobre clientes, tarefas, KPIs e churn", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
];

// ============ SYSTEM PROMPTS ============
const TODAY = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  financeiro: `Você é Noah, CFO virtual da UNV Holdings. Acessa o Nexus para consultar e registrar dados financeiros.

Mentalidade dos melhores CFOs do mundo:
- Warren Buffett: foco em fluxo de caixa real, margem de segurança. Crescimento de receita sem caixa é ilusão.
- Jamie Dimon: gestão de risco antes de tudo. Identifique inadimplência e concentração de receita.
- Ruth Porat: alocação eficiente de capital. Cada despesa precisa de retorno claro.
- Elon Musk: sem burocracia, decisão rápida com dados.

Regras: direto, valores em R$ 7.000,00, confirme antes de registrar, nunca invente dados, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  crm: `Você é Sophia, Diretora Comercial virtual da UNV Holdings. Gerencia pipeline, leads, reuniões e negociações.

Mentalidade dos melhores diretores comerciais do mundo:
- Aaron Ross: pipeline saudável = separação clara entre prospecção, qualificação e fechamento.
- Jeb Blount: leads parados morrem. Follow-up rápido é a diferença entre ganho e perda.
- Neil Rackham (SPIN): entenda a dor antes de oferecer solução.
- Mark Roberge: meça conversão etapa por etapa — o problema está onde a taxa cai.
- Grant Cardone: urgência e valor percebido andam juntos. Lead sem próximo passo está morto.

Regras: ágil, respostas curtas, confirme antes de criar/mover, máx 5 itens por lista, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  projetos: `Você é Melissa, Gestora de Projetos e CS virtual da UNV Holdings. Acompanha clientes, tarefas, KPIs e risco de churn.

Mentalidade dos melhores gestores do mundo:
- Jeff Sutherland (Scrum): entrega contínua, nada escondido, impedimentos resolvidos antes de virar problema.
- Andy Grove (OKRs): KPI sem meta é decoração. Cada cliente precisa de resultado mensurável.
- David Allen (GTD): capture tudo, processe tudo, nada cai. Item sem dono e sem prazo é bomba-relógio.
- Lincoln Murphy (CS): cliente em risco de churn dá sinais antes — falta de engajamento, KPIs não lançados, reuniões puladas.
- Patrick Lencioni: cada tarefa precisa de dono e prazo. Times sem clareza falham.

Regras: proativa nos alertas, destaque itens críticos, listas resumidas, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  ceo: `Você é o CEO virtual da UNV Holdings — tem acesso DIRETO a todo o sistema financeiro, comercial e operacional, e também pode convocar Noah, Sophia ou Melissa quando precisar de análise especializada.

Mentalidade dos melhores CEOs do mundo:
- Jeff Bezos: decisões de longo prazo, obsessão com o cliente, dados antes de opinião.
- Steve Jobs: simplicidade e foco. Diga não para 1000 coisas para dizer sim para a que importa.
- Jack Welch: pessoas + estratégia + execução. O CEO que não cuida dos três perde em todos.
- Reed Hastings: transparência radical, cultura como vantagem competitiva.
- Brian Chesky: mentalidade de fundador, obsessão com produto e experiência.
- Larry Fink: gestão de risco sistêmica, visão de portfólio, impacto de longo prazo.
- Elon Musk: raciocínio por primeiros princípios, urgência real, elimine o que não escala.

Como você opera:
1. Para dados factuais (saldo, leads, tarefas): busque diretamente no sistema via ferramentas
2. Para análise, interpretação ou decisão complexa: convoque o especialista (consultar_financeiro, consultar_crm, consultar_projetos)
3. Cruze sempre os três pilares: financeiro + comercial + operacional = visão real da empresa
4. Sempre entregue: situação atual, principal risco, ação recomendada
5. Seja direto — uma decisão clara vale mais que 5 opções vagas

Regras: sem "Perfeito!", sem emojis excessivos, linguagem direta e estratégica. Data: ${TODAY}`,
};

const AGENT_API_KEYS: Record<AgentType, string> = {
  financeiro: NEXUS_KEY_FINANCEIRO,
  crm: NEXUS_KEY_DIRETOR,
  projetos: NEXUS_KEY_DIRETOR,
  ceo: NEXUS_KEY_DIRETOR, // fallback; tools financeiras usam NEXUS_KEY_FINANCEIRO diretamente
};

// Tools financeiras que precisam de NEXUS_KEY_FINANCEIRO mesmo quando chamadas pelo CEO
const FINANCIAL_TOOL_NAMES = new Set(["resumo_financeiro","contas_bancarias","fluxo_caixa","inadimplentes","dre","criar_conta_receber","marcar_recebido","criar_conta_pagar","marcar_pago","criar_fatura"]);

const AGENT_TOOLS: Record<AgentType, Anthropic.Tool[]> = {
  financeiro: FINANCIAL_TOOLS,
  crm: CRM_TOOLS,
  projetos: PROJECT_TOOLS,
  // CEO tem acesso a TODO o sistema + pode convocar sub-agentes
  ceo: [...FINANCIAL_TOOLS, ...CRM_TOOLS, ...PROJECT_TOOLS, ...CEO_TOOLS],
};

// ============ DETECÇÃO DE AGENTE ============
function detectAgent(message: string): AgentType | null {
  const lower = message.toLowerCase().trim();
  if (lower.startsWith("noah")) return "financeiro";
  if (lower.startsWith("sophia")) return "crm";
  if (lower.startsWith("melissa")) return "projetos";
  if (lower.startsWith("ceo") || lower.startsWith("board")) return "ceo";
  const fin = ["saldo","financeiro","fatura","receber","pagar","inadimplente","dre","fluxo de caixa","mrr","receita","despesa"];
  const crm = ["lead","crm","pipeline","funil","negoci","ganho","perda","prospect","oportunidade","proposta","closer","sdr"];
  const proj = ["cliente ativo","tarefa","kpi","projeto","vendedor","churn","nps","empresa ativa","reunião de projeto"];
  if (fin.some((k) => lower.includes(k))) return "financeiro";
  if (crm.some((k) => lower.includes(k))) return "crm";
  if (proj.some((k) => lower.includes(k))) return "projetos";
  return null;
}

// ============ NEXUS API ============
async function nexusGet(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const url = new URL(path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { "x-api-key": apiKey, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Nexus GET ${res.status}: ${await res.text()}`);
  return res.json();
}

async function nexusPost(url: string, body: Record<string, unknown>, apiKey: string): Promise<unknown> {
  const res = await fetch(url, { method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Nexus POST ${res.status}: ${await res.text()}`);
  return res.json();
}

// ============ EXECUÇÃO DE TOOLS ============
async function executeTool(toolName: string, input: Record<string, unknown>, agentType: AgentType): Promise<string> {
  // CEO usa NEXUS_KEY_FINANCEIRO para tools financeiras, NEXUS_KEY_DIRETOR para as demais
  const apiKey = (agentType === "ceo" && FINANCIAL_TOOL_NAMES.has(toolName))
    ? NEXUS_KEY_FINANCEIRO
    : AGENT_API_KEYS[agentType];
  const FIN = `${NEXUS_URL}/financial-api`;
  const SYS = `${NEXUS_URL}/system-api`;
  try {
    let result: unknown;
    switch (toolName) {
      case "resumo_financeiro": result = await nexusGet(FIN, { endpoint: "summary" }, apiKey); break;
      case "contas_bancarias": result = await nexusGet(FIN, { endpoint: "banks" }, apiKey); break;
      case "fluxo_caixa": { const p: Record<string,string> = { endpoint: "cashflow" }; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(FIN, p, apiKey); break; }
      case "inadimplentes": result = await nexusGet(FIN, { endpoint: "overdue_clients" }, apiKey); break;
      case "dre": { const p: Record<string,string> = { endpoint: "dre" }; if (input.date_from) p.date_from = input.date_from as string; result = await nexusGet(FIN, p, apiKey); break; }
      case "criar_conta_receber": result = await nexusPost(`${SYS}?module=receivables&action=create`, input, apiKey); break;
      case "marcar_recebido": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=receivables&action=mark_paid&id=${id}`, b, apiKey); break; }
      case "criar_conta_pagar": result = await nexusPost(`${SYS}?module=payables&action=create`, input, apiKey); break;
      case "marcar_pago": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=payables&action=mark_paid&id=${id}`, b, apiKey); break; }
      case "criar_fatura": result = await nexusPost(`${SYS}?module=invoices&action=create`, input, apiKey); break;
      case "listar_leads": { const p: Record<string,string> = { module: "leads", action: "list" }; if (input.pipeline_id) p.pipeline_id = input.pipeline_id as string; if (input.stage_id) p.stage_id = input.stage_id as string; if (input.search) p.search = input.search as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "detalhes_lead": result = await nexusGet(SYS, { module: "leads", action: "get", id: input.id as string }, apiKey); break;
      case "criar_lead": result = await nexusPost(`${SYS}?module=leads&action=create`, input, apiKey); break;
      case "atualizar_lead": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=leads&action=update&id=${id}`, b, apiKey); break; }
      case "mover_etapa": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=leads&action=move_stage&id=${id}`, b, apiKey); break; }
      case "dar_ganho": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=leads&action=win&id=${id}`, b, apiKey); break; }
      case "dar_perda": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=leads&action=lose&id=${id}`, b, apiKey); break; }
      case "adicionar_nota": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=leads&action=add_note&id=${id}`, b, apiKey); break; }
      case "criar_atividade": result = await nexusPost(`${SYS}?module=activities&action=create`, input, apiKey); break;
      case "agendar_reuniao": result = await nexusPost(`${SYS}?module=meetings&action=schedule`, input, apiKey); break;
      case "listar_pipelines": result = await nexusGet(SYS, { module: "pipelines", action: "list" }, apiKey); break;
      case "excluir_lead": { const { id } = input; result = await nexusPost(`${SYS}?module=leads&action=delete&id=${id}`, {}, apiKey); break; }
      case "listar_tags": result = await nexusGet(SYS, { module: "tags", action: "list" }, apiKey); break;
      case "criar_tag": result = await nexusPost(`${SYS}?module=tags&action=create`, input, apiKey); break;
      case "vincular_tag": result = await nexusPost(`${SYS}?module=tags&action=add_to_lead`, input, apiKey); break;
      case "desvincular_tag": result = await nexusPost(`${SYS}?module=tags&action=remove_from_lead`, input, apiKey); break;
      case "tags_do_lead": result = await nexusGet(SYS, { module: "tags", action: "lead_tags", lead_id: input.lead_id as string }, apiKey); break;
      case "listar_atividades": { const p: Record<string,string> = { module: "activities", action: "list" }; if (input.lead_id) p.lead_id = input.lead_id as string; if (input.status) p.status = input.status as string; if (input.staff_id) p.staff_id = input.staff_id as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "concluir_atividade": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=activities&action=complete&id=${id}`, b, apiKey); break; }
      case "excluir_atividade": { const { id } = input; result = await nexusPost(`${SYS}?module=activities&action=delete&id=${id}`, {}, apiKey); break; }
      case "listar_reunioes_crm": { const p: Record<string,string> = { module: "crm_meetings", action: "list" }; if (input.lead_id) p.lead_id = input.lead_id as string; if (input.pipeline_id) p.pipeline_id = input.pipeline_id as string; if (input.status) p.status = input.status as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "finalizar_reuniao": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=crm_meetings&action=finalize&id=${id}`, b, apiKey); break; }
      case "listar_etapas": { const p: Record<string,string> = { module: "pipelines", action: "stages" }; if (input.pipeline_id) p.pipeline_id = input.pipeline_id as string; result = await nexusGet(SYS, p, apiKey); break; }
      // ── MELISSA: Empresas ──
      case "listar_empresas": { const p: Record<string,string> = { module: "companies", action: "list" }; if (input.status) p.status = input.status as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "detalhes_empresa": result = await nexusGet(SYS, { module: "companies", action: "get", id: input.id as string }, apiKey); break;
      case "criar_empresa": result = await nexusPost(`${SYS}?module=companies&action=create`, input, apiKey); break;
      case "atualizar_empresa": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=companies&action=update&id=${id}`, b, apiKey); break; }
      // ── MELISSA: Projetos ──
      case "listar_projetos": { const p: Record<string,string> = { module: "projects", action: "list" }; if (input.status) p.status = input.status as string; if (input.company_id) p.company_id = input.company_id as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "detalhes_projeto": result = await nexusGet(SYS, { module: "projects", action: "get", id: input.id as string }, apiKey); break;
      // ── MELISSA: Tarefas ──
      case "listar_tarefas": { const p: Record<string,string> = { module: "tasks", action: "list" }; if (input.project_id) p.project_id = input.project_id as string; if (input.status) p.status = input.status as string; if (input.staff_id) p.staff_id = input.staff_id as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "criar_tarefa": result = await nexusPost(`${SYS}?module=tasks&action=create`, input, apiKey); break;
      case "atualizar_tarefa": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=tasks&action=update&id=${id}`, b, apiKey); break; }
      case "excluir_tarefa": { const { id } = input; result = await nexusPost(`${SYS}?module=tasks&action=delete&id=${id}`, {}, apiKey); break; }
      // ── MELISSA: Staff ──
      case "listar_staff": { const p: Record<string,string> = { module: "staff", action: "list" }; if (input.status) p.status = input.status as string; if (input.role) p.role = input.role as string; result = await nexusGet(SYS, p, apiKey); break; }
      // ── MELISSA: Vendas mensais ──
      case "listar_vendas": { const p: Record<string,string> = { module: "sales", action: "list" }; if (input.company_id) p.company_id = input.company_id as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "registrar_venda": result = await nexusPost(`${SYS}?module=sales&action=create`, input, apiKey); break;
      case "atualizar_venda": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=sales&action=update&id=${id}`, b, apiKey); break; }
      // ── MELISSA: KPIs ──
      case "listar_kpis": { const p: Record<string,string> = { module: "kpis", action: "list", company_id: input.company_id as string }; if (input.month_year) p.month_year = input.month_year as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "entradas_kpi": { const p: Record<string,string> = { module: "kpis", action: "entries", company_id: input.company_id as string }; if (input.kpi_id) p.kpi_id = input.kpi_id as string; if (input.salesperson_id) p.salesperson_id = input.salesperson_id as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "metas_mensais_kpi": { const p: Record<string,string> = { module: "kpis", action: "monthly_targets", company_id: input.company_id as string }; if (input.month_year) p.month_year = input.month_year as string; if (input.kpi_id) p.kpi_id = input.kpi_id as string; if (input.salesperson_id) p.salesperson_id = input.salesperson_id as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "registrar_kpi": result = await nexusPost(`${SYS}?module=kpis&action=create_entry`, input, apiKey); break;
      // ── MELISSA: Vendedores dos clientes ──
      case "listar_vendedores": { const p: Record<string,string> = { module: "salespeople", action: "list", company_id: input.company_id as string }; if (input.status) p.status = input.status as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "criar_vendedor": result = await nexusPost(`${SYS}?module=salespeople&action=create`, input, apiKey); break;
      case "atualizar_vendedor": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=salespeople&action=update&id=${id}`, b, apiKey); break; }
      // ── MELISSA: Reuniões de Projeto ──
      case "listar_reunioes": { const p: Record<string,string> = { module: "project_meetings", action: "list" }; if (input.project_id) p.project_id = input.project_id as string; if (input.company_id) p.company_id = input.company_id as string; if (input.staff_id) p.staff_id = input.staff_id as string; if (input.is_finalized !== undefined) p.is_finalized = String(input.is_finalized); if (input.is_internal !== undefined) p.is_internal = String(input.is_internal); if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "detalhes_reuniao": result = await nexusGet(SYS, { module: "project_meetings", action: "get", id: input.id as string }, apiKey); break;
      // ── MELISSA: Conversas WhatsApp ──
      case "listar_conversas": { const p: Record<string,string> = { module: "conversations", action: "list", project_id: input.project_id as string }; if (input.status) p.status = input.status as string; if (input.assigned_to) p.assigned_to = input.assigned_to as string; if (input.limit) p.limit = String(input.limit); result = await nexusGet(SYS, p, apiKey); break; }
      case "mensagens_conversa": { const p: Record<string,string> = { module: "conversations", action: "messages", id: input.id as string }; if (input.limit) p.limit = String(input.limit); result = await nexusGet(SYS, p, apiKey); break; }
      case "enviar_mensagem_conversa": result = await nexusPost(`${SYS}?module=conversations&action=send_message`, input, apiKey); break;
      case "consultar_financeiro": result = await callAgent("financeiro", input.pergunta as string); break;
      case "consultar_crm": result = await callAgent("crm", input.pergunta as string); break;
      case "consultar_projetos": result = await callAgent("projetos", input.pergunta as string); break;
      default: return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
    }
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ============ LOOP DO AGENTE ============
async function callAgent(agentType: AgentType, userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  for (let i = 0; i < 10; i++) {
    let response!: Anthropic.Message;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPTS[agentType],
          tools: AGENT_TOOLS[agentType],
          messages,
        });
        break;
      } catch (err: unknown) {
        if ((err as { status?: number }).status === 429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 8000));
          continue;
        }
        throw err;
      }
    }
    if (response.stop_reason === "end_turn") {
      return response.content.find((c) => c.type === "text")?.text ?? "Pronto.";
    }
    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter((c) => c.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });
      const results = await Promise.all(toolUses.map(async (tu) => {
        if (tu.type !== "tool_use") return null;
        return { type: "tool_result" as const, tool_use_id: tu.id, content: await executeTool(tu.name, tu.input as Record<string, unknown>, agentType) };
      }));
      messages.push({ role: "user", content: results.filter(Boolean) as Anthropic.ToolResultBlockParam[] });
    } else {
      return response.content.find((c) => c.type === "text")?.text ?? "Erro inesperado.";
    }
  }
  return "Não consegui processar. Tenta de novo.";
}

// ============ TELEGRAM — TEXTO ============
async function sendTelegram(chatId: number, text: string, agentType: AgentType): Promise<void> {
  const token = TELEGRAM_TOKENS[agentType];
  if (!token) return;
  const safe = text.length > 4000 ? text.slice(0, 3990) + "…" : text;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: safe, parse_mode: "Markdown" }),
  });
  if (!res.ok) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: safe }),
    });
  }
}

// ============ VOZ — TRANSCRIÇÃO (Whisper) ============
async function transcribeVoice(fileId: string, agentType: AgentType): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const token = TELEGRAM_TOKENS[agentType];
    // 1. Pegar URL do arquivo no Telegram
    const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileInfo = await fileInfoRes.json();
    if (!fileInfo.ok) return null;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
    // 2. Baixar o OGG
    const audioRes = await fetch(fileUrl);
    const audioBuffer = await audioRes.arrayBuffer();
    // 3. Transcrever com Whisper
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
    form.append("model", "whisper-1");
    form.append("language", "pt");
    const transcRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!transcRes.ok) return null;
    const data = await transcRes.json();
    return (data.text as string) ?? null;
  } catch { return null; }
}

// ============ VOZ — TTS (OpenAI) ============
async function synthesizeSpeech(text: string, agentType: AgentType): Promise<ArrayBuffer | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        input: text.slice(0, 4000),
        voice: TTS_VOICES[agentType] ?? "alloy",
        response_format: "opus",
      }),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch { return null; }
}

async function sendVoice(chatId: number, audioBuffer: ArrayBuffer, agentType: AgentType): Promise<boolean> {
  const token = TELEGRAM_TOKENS[agentType];
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("voice", new Blob([audioBuffer], { type: "audio/ogg" }), "resposta.ogg");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, { method: "POST", body: form });
    return res.ok;
  } catch { return false; }
}

// ============ CHAT IDS — PERSISTÊNCIA ============
async function storeChatId(agentType: AgentType, chatId: number): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/agent_chat_ids`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ agent: agentType, chat_id: chatId, updated_at: new Date().toISOString() }),
    });
  } catch { /* silent */ }
}

async function getChatId(agentType: AgentType): Promise<number | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agent_chat_ids?agent=eq.${agentType}&select=chat_id&limit=1`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const data = await res.json();
    return (data as Array<{ chat_id: number }>)[0]?.chat_id ?? null;
  } catch { return null; }
}

// ============ REUNIÃO DE ALINHAMENTO (sob demanda ou diária 7h) ============
async function runAlignmentMeeting(mode: "daily" | "ondemand" = "daily"): Promise<void> {
  const dateBRT = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  const timeBRT = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const prefix = mode === "daily"
    ? `Hoje é ${dateBRT}. Briefing matinal`
    : `Reunião de alinhamento convocada por Max — ${dateBRT} às ${timeBRT}. Faça um relatório`;

  // Avisa nos 3 chats que a reunião começou
  const [noahId, sophiaId, melissaId, ceoId] = await Promise.all([
    getChatId("financeiro"), getChatId("crm"), getChatId("projetos"), getChatId("ceo"),
  ]);

  const aviso = mode === "ondemand"
    ? `*Reunião de Alinhamento — ${timeBRT}*\n\nMax convocou uma reunião com todos os setores. Aguarde o relatório consolidado.`
    : null;

  if (aviso) {
    await Promise.all([
      noahId  ? sendTelegram(noahId,   aviso, "financeiro") : Promise.resolve(),
      sophiaId? sendTelegram(sophiaId, aviso, "crm")        : Promise.resolve(),
      melissaId?sendTelegram(melissaId,aviso, "projetos")   : Promise.resolve(),
      ceoId   ? sendTelegram(ceoId,    aviso, "ceo")        : Promise.resolve(),
    ]);
  }

  // Consulta paralela nos 3 agentes
  const [noahStatus, sophiaStatus, melissaStatus] = await Promise.all([
    callAgent("financeiro", `${prefix} financeiro: saldo atual, MRR, inadimplência crítica, contas vencendo esta semana e projeção de caixa. Máximo 6 itens. Objetivo e direto.`),
    callAgent("crm", `${prefix} comercial: leads quentes, follow-ups críticos, reuniões agendadas, oportunidades próximas de fechar e conversão do mês. Máximo 6 itens. Objetivo e direto.`),
    callAgent("projetos", `${prefix} de CS/Projetos: clientes ativos, sinais de churn, entregas pendentes, tarefas atrasadas e KPIs não lançados. Máximo 6 itens. Objetivo e direto.`),
  ]);

  // CEO (Max) sintetiza e prioriza
  const title = mode === "daily" ? "BRIEFING MATINAL" : "REUNIÃO DE ALINHAMENTO";
  const ceoPrompt = `
${dateBRT} — ${timeBRT}. Relatórios dos setores:

*NOAH — Financeiro:*
${noahStatus}

*SOPHIA — Comercial:*
${sophiaStatus}

*MELISSA — Projetos/CS:*
${melissaStatus}

Como Max, CEO da UNV Holdings, gere a ATA DE ALINHAMENTO no formato:

*SITUAÇÃO GERAL*
(2-3 linhas — snapshot real da empresa agora)

*PRIORIDADES IMEDIATAS*
(top 3 ações que precisam acontecer hoje — específicas e acionáveis)

*RISCOS NO RADAR*
(o que não pode ser ignorado)

*DECISÕES NECESSÁRIAS*
(o que precisa de decisão do Fabrício agora)

*ALINHAMENTOS ENTRE SETORES*
(o que Sophia precisa saber do Noah, o que Melissa precisa saber da Sophia, etc.)

Direto. Sem enrolação. Cada ponto com responsável e prazo quando possível.
  `.trim();

  const ata = await callAgent("ceo", ceoPrompt);

  // Monta mensagem completa para o CEO
  const msgCeo = `*${title} — ${dateBRT}*\n\n${ata}`;

  // Monta resumo por setor (cada agente recebe só o seu briefing + os alinhamentos)
  const msgNoah    = `*${title} — Setor Financeiro*\n\n*Seu relatório:*\n${noahStatus}\n\n*Alinhamentos do Max:*\n${ata.split("ALINHAMENTOS")[1]?.split("\n\n")[0] ?? ""}`;
  const msgSophia  = `*${title} — Setor Comercial*\n\n*Seu relatório:*\n${sophiaStatus}\n\n*Alinhamentos do Max:*\n${ata.split("ALINHAMENTOS")[1]?.split("\n\n")[0] ?? ""}`;
  const msgMelissa = `*${title} — Projetos/CS*\n\n*Seu relatório:*\n${melissaStatus}\n\n*Alinhamentos do Max:*\n${ata.split("ALINHAMENTOS")[1]?.split("\n\n")[0] ?? ""}`;

  // Envia para todos em paralelo
  await Promise.all([
    ceoId    ? (OPENAI_API_KEY
      ? synthesizeSpeech(ata, "ceo").then(a => a ? sendVoice(ceoId, a, "ceo") : sendTelegram(ceoId, msgCeo, "ceo"))
      : sendTelegram(ceoId, msgCeo, "ceo"))
      : Promise.resolve(),
    noahId    ? sendTelegram(noahId,    msgNoah,    "financeiro") : Promise.resolve(),
    sophiaId  ? sendTelegram(sophiaId,  msgSophia,  "crm")        : Promise.resolve(),
    melissaId ? sendTelegram(melissaId, msgMelissa, "projetos")   : Promise.resolve(),
  ]);
}

// Alias para reunião diária agendada (mantém compatibilidade)
async function runDailyMeeting(): Promise<void> {
  return runAlignmentMeeting("daily");
}

// ============ CHECK-IN (5x/dia) ============
async function runCheckIn(): Promise<void> {
  const timeBRT = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const [noahUpdate, sophiaUpdate, melissaUpdate] = await Promise.all([
    callAgent("financeiro", `Check-in das ${timeBRT}. Alguma atualização financeira crítica nas últimas 2 horas? Pagamento recebido, novo inadimplente, ou urgência de caixa? Se não houver nada crítico, diga "sem novidades financeiras".`),
    callAgent("crm", `Check-in das ${timeBRT}. Alguma atualização comercial crítica nas últimas 2 horas? Lead quente, reunião realizada, negócio fechado ou perdido? Se não houver nada crítico, diga "sem novidades comerciais".`),
    callAgent("projetos", `Check-in das ${timeBRT}. Alguma atualização crítica em projetos/clientes nas últimas 2 horas? Cliente insatisfeito, entrega feita, tarefa atrasada? Se não houver nada crítico, diga "sem novidades operacionais".`),
  ]);

  const summary = await callAgent("ceo", `
Check-in das ${timeBRT}. Status da equipe:
- Noah: ${noahUpdate}
- Sophia: ${sophiaUpdate}
- Melissa: ${melissaUpdate}

Resumo executivo em 2-3 linhas: o que é crítico agora e o que pode esperar?
  `.trim());

  const ceoChatId = await getChatId("ceo");
  if (ceoChatId) {
    await sendTelegram(ceoChatId, `*Check-in ${timeBRT}*\n\n${summary}`, "ceo");
  }
}

// ============ WHATSAPP ============
async function sendWhatsApp(to: string, text: string): Promise<void> {
  const urls = [`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, `${EVOLUTION_URL.replace("https://","http://")}/message/sendText/${EVOLUTION_INSTANCE}`];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "POST", headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ number: to, text, delay: 1200 }) });
      if (res.ok) return;
    } catch { continue; }
  }
}

async function forwardToEvolutionWebhook(rawBody: unknown): Promise<void> {
  await fetch(`${NEXUS_URL}/evolution-webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rawBody) }).catch(() => {});
}

// ============ HANDLER ============
Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const dbg = url.searchParams.get("debug") as AgentType | null;
    if (dbg && ["financeiro","crm","projetos","ceo"].includes(dbg)) {
      try {
        const reply = await callAgent(dbg, "qual sua função e o que você consegue fazer?");
        return new Response(JSON.stringify({ ok: true, agent: dbg, reply: reply.slice(0, 500) }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, agent: dbg, error: String(err) }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ ok: true, version: "2.5-auth-fix" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  // ── AÇÕES DE CRON ──
  const action = url.searchParams.get("action");
  if (action === "daily-meeting") {
    EdgeRuntime.waitUntil(runAlignmentMeeting("daily"));
    return new Response(JSON.stringify({ ok: true, started: "daily-meeting" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (action === "reuniao" || action === "alinhamento") {
    EdgeRuntime.waitUntil(runAlignmentMeeting("ondemand"));
    return new Response(JSON.stringify({ ok: true, started: "reuniao-alinhamento" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (action === "check-in") {
    EdgeRuntime.waitUntil(runCheckIn());
    return new Response(JSON.stringify({ ok: true, started: "check-in" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();

    // ── TELEGRAM ──
    if (body.message) {
      const chatId: number = body.message.chat?.id;
      if (!chatId) return new Response("OK", { status: 200 });

      const text: string = body.message.text ?? "";
      const voice = body.message.voice ?? body.message.audio ?? null;
      const hasContent = text.trim() || voice;
      if (!hasContent) return new Response("OK", { status: 200 });

      const agentParam = url.searchParams.get("agent") as AgentType | null;
      const agentType = agentParam ?? detectAgent(text);
      if (!agentType) return new Response("OK", { status: 200 });

      // CEO: comandos especiais — "reunião" ou "alinhamento" convoca os 3 agentes
      if (agentType === "ceo") {
        const lower = text.toLowerCase().trim();
        if (lower === "reunião" || lower === "reuniao" || lower === "alinhamento" || lower === "meeting") {
          EdgeRuntime.waitUntil(runAlignmentMeeting("ondemand"));
          await sendTelegram(chatId, "Convocando reunião de alinhamento com Noah, Sophia e Melissa. Aguarda — isso leva cerca de 1 minuto.", "ceo");
          return new Response("OK", { status: 200 });
        }
      }

      // Salva chat ID para mensagens proativas
      EdgeRuntime.waitUntil(storeChatId(agentType, chatId));

      const isVoiceInput = !!voice && !text.trim();

      EdgeRuntime.waitUntil((async () => {
        try {
          let inputText = text;

          // Transcreve áudio se necessário
          if (isVoiceInput) {
            if (!OPENAI_API_KEY) {
              await sendTelegram(chatId, "Recebi seu áudio, mas o serviço de transcrição não está configurado. Envie por texto por enquanto.", agentType);
              return;
            }
            const transcription = await transcribeVoice(voice.file_id, agentType);
            if (!transcription) {
              await sendTelegram(chatId, "Não consegui transcrever o áudio. Tente novamente ou envie por texto.", agentType);
              return;
            }
            inputText = transcription;
            // Mostra o que foi entendido
            await sendTelegram(chatId, `_Entendi: "${inputText}"_`, agentType);
          }

          const reply = await callAgent(agentType, inputText);

          // Responde em áudio se o usuário enviou áudio E OPENAI_API_KEY configurado
          if (isVoiceInput && OPENAI_API_KEY) {
            const audio = await synthesizeSpeech(reply, agentType);
            if (audio) {
              const sent = await sendVoice(chatId, audio, agentType);
              if (sent) return;
            }
          }

          await sendTelegram(chatId, reply, agentType);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const isRate = msg.includes("rate_limit") || msg.includes("429");
          await sendTelegram(chatId, isRate ? "Muitas consultas simultâneas. Aguarda 30s e tenta de novo." : `Erro: ${msg.slice(0, 200)}`, agentType);
        }
      })());

      return new Response("OK", { status: 200 });
    }

    // ── WHATSAPP ──
    const eventNorm = (body.event || "").toUpperCase().replace(/\./g, "_");
    if (eventNorm !== "MESSAGES_UPSERT") { EdgeRuntime.waitUntil(forwardToEvolutionWebhook(body)); return new Response("OK", { status: 200 }); }
    let data = body.data;
    if (typeof data === "string") { try { data = JSON.parse(atob(data)); } catch { return new Response("OK", { status: 200 }); } }
    if (!data || data.key?.fromMe) { EdgeRuntime.waitUntil(forwardToEvolutionWebhook(body)); return new Response("OK", { status: 200 }); }
    const waText: string = data.message?.conversation || data.message?.extendedTextMessage?.text || "";
    const from: string = (data.key?.addressingMode === "lid" && data.key?.remoteJidAlt) ? data.key.remoteJidAlt : (data.key?.remoteJid ?? "");
    if (!waText.trim() || !from) { EdgeRuntime.waitUntil(forwardToEvolutionWebhook(body)); return new Response("OK", { status: 200 }); }
    const waAgentType = detectAgent(waText);
    if (!waAgentType) { EdgeRuntime.waitUntil(forwardToEvolutionWebhook(body)); return new Response("OK", { status: 200 }); }
    EdgeRuntime.waitUntil((async () => {
      try {
        const reply = await callAgent(waAgentType, waText);
        await sendWhatsApp(from, reply);
      } catch (err) {
        await sendWhatsApp(from, `Erro: ${String(err).slice(0, 200)}`);
      }
    })());
    return new Response("OK", { status: 200 });
  } catch {
    return new Response("OK", { status: 200 });
  }
});
