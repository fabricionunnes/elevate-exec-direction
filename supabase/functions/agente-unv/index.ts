// agente-unv v2.8 — marketing agent Luna (Meta Ads + UTM analytics)
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
const NSM_API_KEY = Deno.env.get("NSM_API_KEY") ?? "";
const NSM_URL = `${SUPABASE_URL}/functions/v1/nsm-api`;

const TELEGRAM_TOKENS: Record<string, string> = {
  financeiro: Deno.env.get("TELEGRAM_TOKEN_FINANCEIRO") ?? "8302241725:AAG9FT9vUtWPhs4zE-0P2tp5-LJCnBorQtE",
  crm:        Deno.env.get("TELEGRAM_TOKEN_CRM")        ?? "8690436126:AAED3kFZgonruvAZg9wVYt_ltcQ2fqGL_zI",
  projetos:   Deno.env.get("TELEGRAM_TOKEN_PROJETOS")   ?? "8731972632:AAFUT8lkyxYrSaouq5lew9p9N-kCgsZdl5U",
  ceo:        Deno.env.get("TELEGRAM_TOKEN_CEO")        ?? "8663785814:AAESc_KL4xMLQlwbrFNYI6WlZocZlMkWAKk",
  marketing:  Deno.env.get("TELEGRAM_TOKEN_MARKETING")  ?? "8340028321:AAH-tSxNw4BpEPgWVdibo5m1HSlDDrZarwc",
};

// Voz por agente (OpenAI TTS)
const TTS_VOICES: Record<string, string> = {
  financeiro: "echo",    // Noah — masculino claro, profissional
  crm:        "nova",    // Sophia — feminino confiante
  projetos:   "shimmer", // Melissa — feminino caloroso
  ceo:        "onyx",    // Max — grave, autoritativo
  marketing:  "alloy",   // Luna — feminino energético
};

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
type AgentType = "financeiro" | "crm" | "projetos" | "ceo" | "marketing";

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
  // Colaboradores
  { name: "listar_colaboradores", description: "Lista colaboradores internos da UNV (consultores, CS, closers, SDRs, admins). USE SEMPRE que o usuário mencionar o nome de um responsável, closer ou consultor — busque o ID antes de usar em qualquer ação. Filtre por nome parcial com o campo search.", input_schema: { type: "object", properties: { search: { type: "string", description: "Busca por nome (parcial, case-insensitive). Ex: 'Fabricio', 'Ana'" }, role: { type: "string", description: "Filtra por cargo: admin, master, cs, consultant, closer, sdr" }, status: { type: "string", enum: ["active","inactive"] } } } },
  // WhatsApp Direto
  { name: "listar_instancias_whatsapp", description: "Lista instâncias WhatsApp disponíveis com id, nome e status. Use para descobrir o UUID da instância antes de enviar.", input_schema: { type: "object", properties: {} } },
  { name: "enviar_whatsapp_lead", description: "Envia mensagem de texto via WhatsApp para o telefone de um lead, usando a instância Natalia Amador (ou outra escolhida). Cria contato/conversa automaticamente se não existirem.", input_schema: { type: "object", properties: { instance_id: { type: "string", description: "UUID da instância WhatsApp (obtenha com listar_instancias_whatsapp)" }, phone: { type: "string", description: "Telefone do destinatário — qualquer formato, o sistema normaliza" }, message: { type: "string", description: "Texto da mensagem a enviar" }, lead_id: { type: "string", description: "UUID do lead para vincular a conversa (opcional)" } }, required: ["instance_id", "phone", "message"] } },
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
  { name: "listar_staff", description: "Lista colaboradores internos da UNV (consultores, CS, closers, SDRs). Filtre por nome parcial com search para resolver nomes → IDs sem perguntar ao usuário.", input_schema: { type: "object", properties: { search: { type: "string", description: "Busca por nome parcial (ex: 'Fabricio', 'Ana')" }, status: { type: "string", enum: ["active","inactive"] }, role: { type: "string" } } } },
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
  // NSM — North Star Metric
  { name: "consultar_nsm", description: "Consulta a North Star Metric (NSM) de uma empresa cliente — meta mensal de faturamento, valor realizado e percentual de progresso no mês atual. Identifique a empresa por company_id ou company_name.", input_schema: { type: "object", properties: { company_id: { type: "string", description: "UUID da empresa (prioridade sobre company_name)" }, company_name: { type: "string", description: "Nome parcial da empresa (busca case-insensitive)" } } } },
  { name: "definir_nsm", description: "Define ou atualiza a meta mensal de faturamento (NSM) de uma empresa cliente. Após atualizar, alertas de 70%/90%/100% são disparados automaticamente pelo sistema.", input_schema: { type: "object", properties: { company_id: { type: "string", description: "UUID da empresa (prioridade)" }, company_name: { type: "string", description: "Nome parcial da empresa" }, target_value: { type: "number", description: "Meta em REAIS (ex: 500000). Use este OU target_value_cents" }, target_value_cents: { type: "number", description: "Meta em CENTAVOS — alternativa precisa ao target_value" }, label: { type: "string", description: "Rótulo da meta (padrão: 'Meta Mensal de Faturamento')" } } } },
];

// ============ TOOLS — LUNA (MARKETING) ============
const MARKETING_TOOLS: Anthropic.Tool[] = [
  { name: "leads_por_campanha", description: "Analisa leads do CRM agrupados por campanha/UTM — origem, quantidade, conversão por fonte de tráfego pago. Filtre por data ou utm_source.", input_schema: { type: "object", properties: { date_from: { type: "string" }, date_to: { type: "string" }, utm_source: { type: "string" }, utm_campaign: { type: "string" } } } },
  { name: "campanhas_meta", description: "Lista campanhas no Meta Ads Manager com status, gasto total, alcance e resultado", input_schema: { type: "object", properties: { status: { type: "string", enum: ["ACTIVE","PAUSED","ALL"] }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "metricas_meta", description: "Métricas detalhadas de campanhas Meta Ads — gasto, alcance, impressões, cliques, CPM, CPC, CPL, frequência, ROAS por período", input_schema: { type: "object", properties: { date_from: { type: "string" }, date_to: { type: "string" }, campaign_id: { type: "string" }, level: { type: "string", enum: ["campaign","adset","ad"] } } } },
  { name: "conjuntos_anuncios", description: "Lista conjuntos de anúncios (ad sets) de uma campanha Meta Ads com gasto e performance", input_schema: { type: "object", properties: { campaign_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } }, required: ["campaign_id"] } },
  { name: "desempenho_criativo", description: "Analisa performance dos criativos (anúncios) — CTR, CPM, frequência, melhor e pior criativo por campanha ou conta toda", input_schema: { type: "object", properties: { campaign_id: { type: "string" }, adset_id: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
];

// ============ TOOLS — CEO ============
const CEO_TOOLS: Anthropic.Tool[] = [
  { name: "consultar_financeiro", description: "Consulta Noah (CFO) sobre dados financeiros: saldo, caixa, inadimplência, MRR, DRE", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
  { name: "consultar_crm", description: "Consulta Sophia (Diretora Comercial) sobre pipeline, leads, conversão e negociações", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
  { name: "consultar_projetos", description: "Consulta Melissa (Gestora CS/Projetos) sobre clientes, tarefas, KPIs e churn", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
  { name: "consultar_marketing", description: "Consulta Luna (Head de Marketing) sobre tráfego pago, campanhas Meta Ads, performance de criativos e estratégia de conteúdo", input_schema: { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] } },
  // listar_colaboradores já vem de CRM_TOOLS via spread — não duplicar aqui
];

// ============ SYSTEM PROMPTS ============
// Data computada dinamicamente a cada chamada — evita cache de data em funções "quentes"
function getToday(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function getSystemPrompts(): Record<AgentType, string> {
  const TODAY = getToday();
  return {
  financeiro: `Você é Noah, CFO virtual da UNV Holdings. Acessa o Nexus para consultar e registrar dados financeiros.

Mentalidade dos melhores CFOs do mundo:
- Warren Buffett: foco em fluxo de caixa real, margem de segurança. Crescimento de receita sem caixa é ilusão.
- Jamie Dimon: gestão de risco antes de tudo. Identifique inadimplência e concentração de receita.
- Ruth Porat: alocação eficiente de capital. Cada despesa precisa de retorno claro.
- Elon Musk: sem burocracia, decisão rápida com dados.

INADIMPLÊNCIA — como apresentar:
- Foco nos inadimplentes do mês atual e dos 2 meses anteriores: liste cada um com nome, valor e dias de atraso
- Dívidas com mais de 2 meses de atraso: agrupe em bloco separado com total e quantidade (ex: "3 clientes com dívidas acima de 60 dias — R$ 12.400 no total"). Não liste individualmente.
- Nunca misture dívidas recentes com antigas no mesmo bloco

CONTAS A PAGAR / A RECEBER — como apresentar:
- Nunca use totais acumulados. Sempre trabalhe com o que está vencendo ou vencido na data de hoje e nos próximos 7 dias
- Apresente por data de vencimento, do mais urgente ao mais distante

Regras: direto, valores em R$ 7.000,00, confirme antes de registrar, nunca invente dados, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  crm: `Você é Sophia, Diretora Comercial virtual da UNV Holdings. Gerencia pipeline, leads, reuniões e negociações.

Mentalidade dos melhores diretores comerciais do mundo:
- Aaron Ross: pipeline saudável = separação clara entre prospecção, qualificação e fechamento.
- Jeb Blount: leads parados morrem. Follow-up rápido é a diferença entre ganho e perda.
- Neil Rackham (SPIN): entenda a dor antes de oferecer solução.
- Mark Roberge: meça conversão etapa por etapa — o problema está onde a taxa cai.
- Grant Cardone: urgência e valor percebido andam juntos. Lead sem próximo passo está morto.

REGRA CRÍTICA — NUNCA exiba IDs ou UUIDs ao usuário. Sempre resolva antes de apresentar:
- stage_id → nome da etapa: chame listar_etapas(pipeline_id) para obter o mapa id→nome
- closer_staff_id / owner_id / staff_id → nome do colaborador: chame listar_colaboradores para obter o mapa id→nome
- pipeline_id → nome do pipeline: chame listar_pipelines para obter o mapa id→nome
Exemplo correto: "Douglas — R$ 20.000 | Etapa: Proposta Enviada | Closer: Marcos" (NUNCA "Etapa: 2429c538 | Closer: bbf63ab8")
Se os dados retornados já contiverem o nome (campo name/title), use direto. Só chame a ferramenta de resolução se o campo retornado for um ID.

RESOLUÇÃO AUTOMÁTICA DE COLABORADORES — NUNCA peça o ID de um colaborador ao usuário:
- Quando o usuário mencionar qualquer nome (ex: "Fabrício Augusto", "Ana", "Marcos"), chame listar_colaboradores(search="Fabricio") para resolver o UUID automaticamente
- Se retornar mais de um resultado, confirme com o usuário qual é o correto apresentando os nomes encontrados
- Só informe que não encontrou se realmente não houver resultado algum na busca

WHATSAPP DIRETO — você pode enviar mensagens para leads via WhatsApp:
1. Chame listar_instancias_whatsapp para obter o UUID da instância "Natalia Amador" (ou a disponível)
2. Use enviar_whatsapp_lead com instance_id + phone + message + lead_id
3. SEMPRE confirme com o usuário o texto da mensagem antes de enviar
4. Após enviar, informe: instância usada, telefone e confirmação de envio

Regras: ágil, respostas curtas, confirme antes de criar/mover/enviar, máx 5 itens por lista, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  projetos: `Você é Melissa, Gestora de Projetos e CS virtual da UNV Holdings. Acompanha clientes, tarefas, KPIs e risco de churn.

Mentalidade dos melhores gestores do mundo:
- Jeff Sutherland (Scrum): entrega contínua, nada escondido, impedimentos resolvidos antes de virar problema.
- Andy Grove (OKRs): KPI sem meta é decoração. Cada cliente precisa de resultado mensurável.
- David Allen (GTD): capture tudo, processe tudo, nada cai. Item sem dono e sem prazo é bomba-relógio.
- Lincoln Murphy (CS): cliente em risco de churn dá sinais antes — falta de engajamento, KPIs não lançados, reuniões puladas.
- Patrick Lencioni: cada tarefa precisa de dono e prazo. Times sem clareza falham.

REGRA CRÍTICA — NUNCA exiba IDs ou UUIDs ao usuário. Sempre resolva nomes antes de apresentar: consultant_id / cs_id / responsible_staff_id → nome (chame listar_staff); company_id → nome da empresa (chame listar_empresas ou detalhes_empresa). Apresente sempre nomes legíveis, nunca hashes ou códigos alfanuméricos.

RESOLUÇÃO AUTOMÁTICA DE COLABORADORES — NUNCA peça o ID de um colaborador ao usuário:
- Quando o usuário mencionar qualquer nome (ex: "Fabrício Augusto", "Ana", "Marcos"), chame listar_staff(search="Fabricio") para resolver o UUID automaticamente
- Se retornar mais de um resultado, confirme qual é o correto apresentando os nomes
- Só informe que não encontrou se realmente não houver resultado algum na busca

NSM — NORTH STAR METRIC:
- Use consultar_nsm para ver a meta mensal de faturamento de uma empresa cliente e o progresso atual
- Use definir_nsm para cadastrar ou atualizar a meta — confirme sempre o valor com o usuário antes de salvar
- Após definir a meta, informe que os alertas de 70%/90%/100% serão disparados automaticamente
- Apresente o progresso em formato legível: "R$ 312.450 de R$ 500.000 — 62,5% da meta"

Regras: proativa nos alertas, destaque itens críticos, listas resumidas, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  marketing: `Você é Luna, Head de Marketing virtual da UNV Holdings. Especialista em tráfego pago, performance digital, Meta Ads e estratégia de conteúdo.

Mentalidade dos melhores profissionais de marketing do mundo:
- David Ogilvy: copy que vende. Criatividade sem resultado é arte, não marketing.
- Seth Godin: seja notável ou invisível. Permissão > interrupção. Nicho claro ganha sempre.
- Ryan Deiss: funil de cliente é a espinha dorsal. ROAS é a linguagem do CEO — conecte tudo a receita.
- Neil Patel: dados antes de opinião. Todo criativo, canal e campanha é testável. Teste rápido, escale o que funciona.
- Ann Handley: conteúdo que educa E converte. Qualidade e consistência batem volume sem propósito.

ESCOPO EXCLUSIVO — você trata APENAS de tráfego pago e performance de anúncios:
- Gasto com anúncios (Meta Ads): valor investido, CPL, CPC, CPM, CTR, alcance, frequência
- Status e performance de campanhas, conjuntos e criativos
- Origem de leads por UTM/campanha
- Recomendações de otimização de mídia paga

FORA DO SEU ESCOPO (não comente, não traga, não calcule):
- Receita, faturamento, MRR, ticket médio — isso é com o Noah
- Fluxo de caixa, saldo, inadimplência — isso é com o Noah
- ROAS baseado em receita financeira — você não tem acesso a dados financeiros

Como você opera:
1. Analise dados antes de recomendar — nunca achismo
2. Cruze CPL com conversão de leads: lead barato que não converte é custo, não performance
3. Foco em custo de mídia, volume de leads e qualidade dos criativos
4. Sugira experimentos testáveis com hipótese clara e métrica de sucesso definida
5. Quando identificar campanhas com CPL alto ou criativo em fadiga, recomende ação específica

REGRA CRÍTICA — NUNCA exiba IDs de campanha, adset ou ad ao usuário final. Apresente sempre nomes legíveis e métricas com contexto (ex: "CTR 3,2% — acima da média do setor para B2B").

Regras: direta, orientada a dados, sem jargão vazio ("engajamento" sem número é nada), confirme antes de recomendar pausar ou criar campanhas, sem "Perfeito!", sem emojis. Data: ${TODAY}`,

  ceo: `Você é o CEO virtual da UNV Holdings — tem acesso DIRETO a todo o sistema financeiro, comercial e operacional, e também pode convocar Noah, Sophia, Melissa ou Luna quando precisar de análise especializada.

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
2. Para análise, interpretação ou decisão complexa: convoque o especialista (consultar_financeiro, consultar_crm, consultar_projetos, consultar_marketing)
3. Cruze sempre os três pilares: financeiro + comercial + operacional = visão real da empresa
4. Sempre entregue: situação atual, principal risco, ação recomendada
5. Seja direto — uma decisão clara vale mais que 5 opções vagas

REUNIÃO TEMÁTICA — quando o Fabrício enviar qualquer mensagem que indique necessidade de análise profunda, investigação de problema, entender o que está acontecendo em determinado tema, ou explicitamente pedir uma reunião/análise:
- Responda em 1-2 linhas confirmando o que entendeu e o que vai fazer
- No FINAL da sua resposta, adicione EXATAMENTE esta linha (sem nada depois): [TRIGGER_MEETING: tema da reunião]
- Substitua "tema da reunião" pelo tema específico identificado na mensagem do Fabrício
- Exemplos: [TRIGGER_MEETING: clientes satisfeitos mas faturamento não cresce], [TRIGGER_MEETING: inadimplência], [TRIGGER_MEETING: performance do time de vendas]
- Só adicione o trigger se realmente for necessário consultar os agentes para análise profunda. Para perguntas simples, responda direto.

REGRA CRÍTICA — NUNCA exiba IDs ou UUIDs ao usuário. Sempre resolva nomes antes de apresentar qualquer dado: etapas, closers, pipelines, staff, empresas — sempre nome legível.

Regras: sem "Perfeito!", sem emojis excessivos, linguagem direta e estratégica. Data: ${TODAY}`,
  };
}

const AGENT_API_KEYS: Record<AgentType, string> = {
  financeiro: NEXUS_KEY_FINANCEIRO,
  crm: NEXUS_KEY_DIRETOR,
  projetos: NEXUS_KEY_DIRETOR,
  ceo: NEXUS_KEY_DIRETOR, // fallback; tools financeiras usam NEXUS_KEY_FINANCEIRO diretamente
  marketing: NEXUS_KEY_DIRETOR,
};

// Tools financeiras que precisam de NEXUS_KEY_FINANCEIRO mesmo quando chamadas pelo CEO
const FINANCIAL_TOOL_NAMES = new Set(["resumo_financeiro","contas_bancarias","fluxo_caixa","inadimplentes","dre","criar_conta_receber","marcar_recebido","criar_conta_pagar","marcar_pago","criar_fatura"]);

const AGENT_TOOLS: Record<AgentType, Anthropic.Tool[]> = {
  financeiro: FINANCIAL_TOOLS,
  crm: CRM_TOOLS,
  projetos: PROJECT_TOOLS,
  marketing: MARKETING_TOOLS,
  // CEO tem acesso a TODO o sistema + pode convocar sub-agentes
  ceo: [...FINANCIAL_TOOLS, ...CRM_TOOLS, ...PROJECT_TOOLS, ...MARKETING_TOOLS, ...CEO_TOOLS],
};

// ============ DETECÇÃO DE AGENTE ============
function detectAgent(message: string): AgentType | null {
  const lower = message.toLowerCase().trim();
  if (lower.startsWith("noah")) return "financeiro";
  if (lower.startsWith("sophia")) return "crm";
  if (lower.startsWith("melissa")) return "projetos";
  if (lower.startsWith("luna")) return "marketing";
  if (lower.startsWith("ceo") || lower.startsWith("board")) return "ceo";
  const fin = ["saldo","financeiro","fatura","receber","pagar","inadimplente","dre","fluxo de caixa","mrr","receita","despesa"];
  const crm = ["lead","crm","pipeline","funil","negoci","ganho","perda","prospect","oportunidade","proposta","closer","sdr"];
  const proj = ["cliente ativo","tarefa","kpi","projeto","vendedor","churn","nps","empresa ativa","reunião de projeto"];
  const mkt = ["campanha","tráfego","meta ads","facebook ads","instagram ads","criativo","anúncio","cpl","roas","cpc","cpm","utm","trafego pago","marketing","impulsionar"];
  if (fin.some((k) => lower.includes(k))) return "financeiro";
  if (crm.some((k) => lower.includes(k))) return "crm";
  if (proj.some((k) => lower.includes(k))) return "projetos";
  if (mkt.some((k) => lower.includes(k))) return "marketing";
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
      case "resumo_financeiro":
      case "receita_para_roas": result = await nexusGet(FIN, { endpoint: "summary" }, NEXUS_KEY_FINANCEIRO); break;
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
      case "listar_staff":
      case "listar_colaboradores": { const p: Record<string,string> = { module: "staff", action: "list" }; if (input.status) p.status = input.status as string; if (input.role) p.role = input.role as string; if (input.search) p.search = input.search as string; result = await nexusGet(SYS, p, apiKey); break; }
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
      // ── LUNA: Marketing / Meta Ads ──
      case "leads_por_campanha": {
        // Agrega leads do CRM por utm_campaign — via meta-ads-sync (POST) com acesso ao service role
        const body: Record<string,unknown> = { action: "leads_by_campaign" };
        if (input.date_from) body.date_from = input.date_from;
        if (input.date_to) body.date_to = input.date_to;
        if (input.utm_source) body.utm_source = input.utm_source;
        if (input.utm_campaign) body.utm_campaign = input.utm_campaign;
        const r = await fetch(`${NEXUS_URL}/meta-ads-sync`, { method: "POST", headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        result = r.ok ? await r.json() : { error: `leads_por_campanha ${r.status}: ${await r.text()}` };
        break;
      }
      case "campanhas_meta": {
        const body: Record<string,unknown> = { action: "campaigns" };
        if (input.status) body.status = input.status;
        if (input.date_from) body.date_from = input.date_from;
        if (input.date_to) body.date_to = input.date_to;
        const r = await fetch(`${NEXUS_URL}/meta-ads-sync`, { method: "POST", headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        result = r.ok ? await r.json() : { error: `campanhas_meta ${r.status}: ${await r.text()}` };
        break;
      }
      case "metricas_meta": {
        // metricas_meta retorna dados de campanhas com filtro de data e nível
        const body: Record<string,unknown> = { action: "campaigns" };
        if (input.date_from) body.date_from = input.date_from;
        if (input.date_to) body.date_to = input.date_to;
        if (input.campaign_id) body.campaign_id = input.campaign_id;
        const r = await fetch(`${NEXUS_URL}/meta-ads-sync`, { method: "POST", headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        result = r.ok ? await r.json() : { error: `metricas_meta ${r.status}: ${await r.text()}` };
        break;
      }
      case "conjuntos_anuncios": {
        const body: Record<string,unknown> = { action: "adsets" };
        if (input.campaign_id) body.campaign_id = input.campaign_id;
        if (input.date_from) body.date_from = input.date_from;
        if (input.date_to) body.date_to = input.date_to;
        const r = await fetch(`${NEXUS_URL}/meta-ads-sync`, { method: "POST", headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        result = r.ok ? await r.json() : { error: `conjuntos_anuncios ${r.status}: ${await r.text()}` };
        break;
      }
      case "desempenho_criativo": {
        const body: Record<string,unknown> = { action: "creatives" };
        if (input.campaign_id) body.campaign_id = input.campaign_id;
        if (input.adset_id) body.adset_id = input.adset_id;
        if (input.date_from) body.date_from = input.date_from;
        if (input.date_to) body.date_to = input.date_to;
        const r = await fetch(`${NEXUS_URL}/meta-ads-sync`, { method: "POST", headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        result = r.ok ? await r.json() : { error: `desempenho_criativo ${r.status}: ${await r.text()}` };
        break;
      }
      // ── SOPHIA: WhatsApp Direto ──
      case "listar_instancias_whatsapp": result = await nexusGet(SYS, { module: "whatsapp", action: "list_instances" }, apiKey); break;
      case "enviar_whatsapp_lead": result = await nexusPost(`${SYS}?module=whatsapp&action=send`, input, apiKey); break;
      // ── NSM — North Star Metric ──
      case "consultar_nsm": {
        const params = new URLSearchParams();
        if (input.company_id) params.set("company_id", input.company_id as string);
        if (input.company_name) params.set("company_name", input.company_name as string);
        const nsmRes = await fetch(`${NSM_URL}?${params.toString()}`, { headers: { "x-api-key": NSM_API_KEY, "Content-Type": "application/json" } });
        result = nsmRes.ok ? await nsmRes.json() : { error: `nsm-api ${nsmRes.status}: ${await nsmRes.text()}` };
        break;
      }
      case "definir_nsm": {
        const nsmRes = await fetch(NSM_URL, { method: "POST", headers: { "x-api-key": NSM_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(input) });
        result = nsmRes.ok ? await nsmRes.json() : { error: `nsm-api ${nsmRes.status}: ${await nsmRes.text()}` };
        break;
      }
      case "consultar_financeiro": result = await callAgent("financeiro", input.pergunta as string); break;
      case "consultar_crm": result = await callAgent("crm", input.pergunta as string); break;
      case "consultar_projetos": result = await callAgent("projetos", input.pergunta as string); break;
      case "consultar_marketing": result = await callAgent("marketing", input.pergunta as string); break;
      default: return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
    }
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ============ LOOP DO AGENTE ============
async function callAgent(agentType: AgentType, userMessage: string, history: Anthropic.MessageParam[] = [], opts: { model?: string; maxTokens?: number } = {}): Promise<string> {
  const agentModel = opts.model ?? "claude-sonnet-4-6";
  const agentMaxTokens = opts.maxTokens ?? 4096;
  // Combina histórico anterior + nova mensagem do usuário
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userMessage }];
  for (let i = 0; i < 10; i++) {
    let response!: Anthropic.Message;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.messages.create({
          model: agentModel,
          max_tokens: agentMaxTokens,
          system: getSystemPrompts()[agentType],
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
async function sendTelegramChunk(token: string, chatId: number, chunk: string): Promise<void> {
  // Tenta com Markdown — até 3 vezes com backoff para erros de rede transitórios
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
      if (res.ok) return;
      // Markdown inválido → tenta sem parse_mode (não retry)
      if (res.status === 400) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: chunk }),
        });
        return;
      }
      // Outro erro HTTP → retry com backoff
      if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
    } catch {
      // Erro de rede (ex: IPv6 timeout) → retry com backoff
      if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
    }
  }
}

async function sendTelegram(chatId: number, text: string, agentType: AgentType): Promise<void> {
  const token = TELEGRAM_TOKENS[agentType];
  if (!token) return;
  const MAX = 3900; // margem abaixo do limite de 4096 do Telegram
  if (text.length <= MAX) {
    await sendTelegramChunk(token, chatId, text);
    return;
  }
  // Divide por parágrafos ("\n\n"), sem quebrar no meio de uma linha
  const parts: string[] = [];
  let current = "";
  for (const paragraph of text.split("\n\n")) {
    const candidate = current ? current + "\n\n" + paragraph : paragraph;
    if (candidate.length > MAX) {
      if (current) parts.push(current);
      // parágrafo individual maior que MAX → divide por linha
      if (paragraph.length > MAX) {
        let line = "";
        for (const row of paragraph.split("\n")) {
          const c = line ? line + "\n" + row : row;
          if (c.length > MAX) { if (line) parts.push(line); line = row; }
          else line = c;
        }
        if (line) parts.push(line);
        current = "";
      } else {
        current = paragraph;
      }
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 300)); // pequeno delay entre partes
    await sendTelegramChunk(token, chatId, parts[i]);
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

// ============ MEMÓRIA — HISTÓRICO DE CONVERSA ============
const MEMORY_LIMIT = 20; // últimas 20 mensagens (10 trocas) por agente+chat

async function saveMessage(agentType: AgentType, chatId: number, role: "user" | "assistant", content: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agent: agentType, chat_id: chatId, role, content }),
    });
  } catch { /* silent */ }
}

async function loadHistory(agentType: AgentType, chatId: number): Promise<Anthropic.MessageParam[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_messages?agent=eq.${agentType}&chat_id=eq.${chatId}&order=created_at.desc&limit=${MEMORY_LIMIT}&select=role,content`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json() as Array<{ role: string; content: string }>;
    // Retorna em ordem cronológica (invertendo o DESC)
    return data.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  } catch { return []; }
}

// ============ APROVAÇÃO HUMANA — DIRECIONAMENTOS DO MAX ============
const PENDING_MARKER = "__PENDING_APPROVAL__";
const EXECUTED_MARKER = "__APPROVAL_EXECUTED__";

async function savePendingApproval(chatId: number, directives: { noah: string; sophia: string; melissa: string; luna: string }): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agent: "ceo", chat_id: chatId, role: "assistant", content: `${PENDING_MARKER}${JSON.stringify(directives)}` }),
    });
  } catch { /* silent */ }
}

async function getPendingApproval(chatId: number): Promise<{ noah: string; sophia: string; melissa: string; luna: string } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_messages?agent=eq.ceo&chat_id=eq.${chatId}&role=eq.assistant&content=like.${encodeURIComponent(PENDING_MARKER + "%")}&order=created_at.desc&limit=1&select=id,content`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json() as Array<{ id: string; content: string }>;
    if (!data || data.length === 0) return null;
    const record = data[0];
    // Marca como executado para não reaproveitar
    await fetch(`${SUPABASE_URL}/rest/v1/agent_messages?id=eq.${record.id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ content: record.content.replace(PENDING_MARKER, EXECUTED_MARKER) }),
    });
    return JSON.parse(record.content.replace(PENDING_MARKER, ""));
  } catch { return null; }
}

// ============ REUNIÃO DE ALINHAMENTO (sob demanda ou diária 7h) ============
async function runAlignmentMeeting(mode: "daily" | "ondemand" = "daily", directCeoChatId?: number): Promise<void> {
  const dateBRT = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  const timeBRT = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const prefix = mode === "daily"
    ? `Hoje é ${dateBRT}. Briefing matinal`
    : `Reunião de alinhamento convocada por Max — ${dateBRT} às ${timeBRT}. Faça um relatório`;

  // Avisa nos 4 chats que a reunião começou
  const [noahId, sophiaId, melissaId, lunaId, storedCeoId] = await Promise.all([
    getChatId("financeiro"), getChatId("crm"), getChatId("projetos"), getChatId("marketing"), getChatId("ceo"),
  ]);
  // directCeoChatId garante que o CEO sempre recebe mesmo que o storeChatId não tenha rodado ainda
  const ceoId = directCeoChatId ?? storedCeoId;

  // Wrapper para enviar erros ao CEO se algo falhar
  const safeRun = async (fn: () => Promise<void>) => {
    try { await fn(); }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (ceoId) await sendTelegram(ceoId, `Erro na reunião: ${msg.slice(0, 300)}`, "ceo").catch(() => {});
    }
  };

  const aviso = mode === "ondemand"
    ? `*Reunião de Alinhamento — ${timeBRT}*\n\nMax convocou uma reunião com todos os setores. Aguarde o relatório consolidado.`
    : null;

  if (aviso) {
    await Promise.all([
      noahId    ? sendTelegram(noahId,    aviso, "financeiro") : Promise.resolve(),
      sophiaId  ? sendTelegram(sophiaId,  aviso, "crm")        : Promise.resolve(),
      melissaId ? sendTelegram(melissaId, aviso, "projetos")   : Promise.resolve(),
      lunaId    ? sendTelegram(lunaId,    aviso, "marketing")  : Promise.resolve(),
      ceoId     ? sendTelegram(ceoId,     aviso, "ceo")        : Promise.resolve(),
    ]);
  }

  await safeRun(async () => {

  // Daily: usa Haiku nos 4 relatórios iniciais (3-4× mais rápido, cabe nos 150s da edge function)
  // Ondemand: usa Sonnet para maior qualidade (chamado via Telegram, sem restrição de tempo)
  const reportModel  = mode === "daily" ? "claude-haiku-4-5" : "claude-sonnet-4-6";
  const reportTokens = mode === "daily" ? 800 : 4096;

  // Consulta paralela nos 4 agentes — resumo executivo apenas
  const [noahStatus, sophiaStatus, melissaStatus, lunaStatus] = await Promise.all([
    callAgent("financeiro", `${prefix} financeiro. Retorne APENAS: saldo atual, MRR, 1-2 inadimplentes mais críticos do mês (nome + valor), e 1 alerta de caixa se houver. Máximo 4 linhas. Sem formatação extra.`, [], { model: reportModel, maxTokens: reportTokens }),
    callAgent("crm", `${prefix} comercial. Retorne APENAS: qtd de leads quentes, 1-2 follow-ups mais urgentes e conversão do mês. Máximo 3 linhas. Sem formatação extra.`, [], { model: reportModel, maxTokens: reportTokens }),
    callAgent("projetos", `${prefix} CS/Projetos. Retorne APENAS: qtd de clientes ativos, 1-2 clientes em risco de churn e 1 tarefa crítica pendente. Máximo 3 linhas. Sem formatação extra.`, [], { model: reportModel, maxTokens: reportTokens }),
    callAgent("marketing", `${prefix} marketing. Retorne APENAS: gasto total em tráfego pago no período atual, CPL médio e 1 campanha de destaque (melhor ou pior). Máximo 3 linhas. Sem formatação extra.`, [], { model: reportModel, maxTokens: reportTokens }),
  ]);

  // No modo daily: NÃO envia relatórios individuais — Max consolida tudo em 1 mensagem
  // No modo ondemand: envia relatórios separados para contexto completo
  if (mode === "ondemand" && ceoId) {
    await sendTelegram(ceoId, `*FINANCEIRO — Noah*\n\n${noahStatus}`, "ceo");
    await new Promise(r => setTimeout(r, 500));
    await sendTelegram(ceoId, `*COMERCIAL — Sophia*\n\n${sophiaStatus}`, "ceo");
    await new Promise(r => setTimeout(r, 500));
    await sendTelegram(ceoId, `*OPERACIONAL — Melissa*\n\n${melissaStatus}`, "ceo");
    await new Promise(r => setTimeout(r, 500));
    await sendTelegram(ceoId, `*MARKETING — Luna*\n\n${lunaStatus}`, "ceo");
    await new Promise(r => setTimeout(r, 500));
  }

  // CEO (Max) sintetiza em uma mensagem compacta
  const ceoPrompt = `
${dateBRT} — ${timeBRT}. Dados dos setores:

NOAH: ${noahStatus}
SOPHIA: ${sophiaStatus}
MELISSA: ${melissaStatus}
LUNA: ${lunaStatus}

Como Max, CEO da UNV Holdings, gere o BRIEFING MATINAL no formato exato abaixo. Seja telegráfico — cada linha vale ouro:

*BRIEFING — ${dateBRT}*

Financeiro: [1 linha com saldo, MRR e maior risco financeiro]
Comercial: [1 linha com pipeline e oportunidade mais quente]
Clientes: [1 linha com status geral e maior risco de churn]
Marketing: [1 linha com gasto e CPL]

*Prioridade do dia:* [2-3 ações específicas, com responsável — separadas por " | "]
*Atenção:* [1 risco ou alerta que não pode ser ignorado hoje]

---DIRECIONAMENTO_NOAH---
(máx 2 ordens diretas e específicas para hoje)
---FIM_NOAH---

---DIRECIONAMENTO_SOPHIA---
(máx 2 ordens diretas e específicas para hoje)
---FIM_SOPHIA---

---DIRECIONAMENTO_MELISSA---
(máx 2 ordens diretas e específicas para hoje)
---FIM_MELISSA---

---DIRECIONAMENTO_LUNA---
(máx 2 ordens diretas e específicas para hoje)
---FIM_LUNA---

Sem rodeios. Sem seções vazias.
  `.trim();

  const ata = await callAgent("ceo", ceoPrompt);

  // Extrai os direcionamentos por agente
  function extractSection(text: string, start: string, end: string): string {
    const s = text.indexOf(start);
    const e = text.indexOf(end);
    if (s === -1 || e === -1) return "";
    return text.slice(s + start.length, e).trim();
  }
  const dirNoah    = extractSection(ata, "---DIRECIONAMENTO_NOAH---",    "---FIM_NOAH---");
  const dirSophia  = extractSection(ata, "---DIRECIONAMENTO_SOPHIA---",  "---FIM_SOPHIA---");
  const dirMelissa = extractSection(ata, "---DIRECIONAMENTO_MELISSA---", "---FIM_MELISSA---");
  const dirLuna    = extractSection(ata, "---DIRECIONAMENTO_LUNA---",    "---FIM_LUNA---");

  // Remove os blocos de direcionamento da ATA do CEO para ficar limpa
  const ataCeo = ata
    .replace(/---DIRECIONAMENTO_NOAH---[\s\S]*?---FIM_NOAH---/g, "")
    .replace(/---DIRECIONAMENTO_SOPHIA---[\s\S]*?---FIM_SOPHIA---/g, "")
    .replace(/---DIRECIONAMENTO_MELISSA---[\s\S]*?---FIM_MELISSA---/g, "")
    .replace(/---DIRECIONAMENTO_LUNA---[\s\S]*?---FIM_LUNA---/g, "")
    .trim();

  // Envia decisões do Max como mensagem separada
  const msgCeoAta = `*🧠 MAX — Decisões e Prioridades*\n\n${ataCeo}`;
  if (ceoId) {
    await (OPENAI_API_KEY
      ? synthesizeSpeech(ataCeo, "ceo").then(a => a ? sendVoice(ceoId, a, "ceo") : sendTelegram(ceoId, msgCeoAta, "ceo"))
      : sendTelegram(ceoId, msgCeoAta, "ceo"));
  }

  // Salva direcionamentos pendentes de aprovação — NÃO executa ainda
  if (ceoId && (dirNoah || dirSophia || dirMelissa || dirLuna)) {
    await savePendingApproval(ceoId, { noah: dirNoah, sophia: dirSophia, melissa: dirMelissa, luna: dirLuna });
    await sendTelegram(ceoId, `_Direcionamentos prontos para Noah, Sophia e Melissa. Responda *ok* para eu executar._`, "ceo");
  }
  }); // fim safeRun
}

// Alias para reunião diária agendada (mantém compatibilidade)
async function runDailyMeeting(): Promise<void> {
  return runAlignmentMeeting("daily");
}

// ============ REUNIÃO TEMÁTICA ============
async function runTopicMeeting(topic: string, ceoChatId: number): Promise<void> {
  const dateBRT = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const timeBRT = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const AGENT_NAMES: Record<AgentType, string> = { financeiro: "Noah", crm: "Sophia", projetos: "Melissa", ceo: "Max", marketing: "Luna" };

  try {
    // 1. Max decide quais agentes consultar com base no tema (usa haiku pra ser rápido e barato)
    const routingResp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: "Roteador de perguntas. Retorne APENAS JSON, sem explicação.",
      messages: [{
        role: "user",
        content: `Tema da reunião: "${topic}"\n\nAgentes:\n- financeiro: saldo, MRR, inadimplência, fluxo de caixa, contas a pagar/receber, DRE\n- crm: leads, pipeline, conversão, follow-ups, negociações, reuniões de venda\n- projetos: clientes ativos, tarefas, KPIs, churn, CS, vendas mensais\n- marketing: campanhas Meta Ads, tráfego pago, CPL, ROAS, criativos, UTM, performance de anúncios\n\nRetorne JSON: {"agents": ["financeiro","crm","projetos","marketing"]} com apenas os agentes relevantes.`,
      }],
    });
    const routingText = routingResp.content.find((c) => c.type === "text")?.text ?? "";
    let agentsToConsult: AgentType[] = [];
    try {
      const match = routingText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match?.[0] ?? "{}");
      agentsToConsult = ((parsed.agents ?? []) as string[]).filter((a) =>
        ["financeiro", "crm", "projetos", "marketing"].includes(a)
      ) as AgentType[];
    } catch { /* fallback abaixo */ }
    if (agentsToConsult.length === 0) agentsToConsult = ["financeiro", "crm", "projetos"];

    // 2. Notifica CEO quem vai ser consultado
    const consultingNames = agentsToConsult.map((a) => AGENT_NAMES[a]).join(", ");
    await sendTelegram(ceoChatId, `*Reunião — ${topic}*\n\nConsultando: ${consultingNames}...`, "ceo");

    // 3. Consulta os agentes relevantes em paralelo com prompt focado no tema
    const agentResults = await Promise.all(
      agentsToConsult.map(async (agent) => {
        const result = await callAgent(agent,
          `Reunião temática solicitada pelo CEO Max sobre: "${topic}".\n\nTraga todos os dados do seu setor relevantes para este tema. Seja direto, objetivo e foque apenas no que importa para o assunto.`
        );
        return { agent, result };
      })
    );

    // 4. CEO sintetiza com foco total no tema
    const dadosText = agentResults
      .map(({ agent, result }) => `${AGENT_NAMES[agent]}:\n${result}`)
      .join("\n\n---\n\n");

    const ceoSynthPrompt = `${dateBRT} — ${timeBRT}
Reunião sobre: "${topic}"

Dados dos agentes:
${dadosText}

Como Max, CEO da UNV Holdings, conduza esta reunião com foco total em "${topic}":

*DIAGNÓSTICO*
(o que os dados mostram sobre este tema — sem rodeios)

*CAUSA RAIZ*
(por que está assim)

*DECISÃO*
(uma decisão clara — não 5 opções)

*AÇÕES IMEDIATAS*
${agentsToConsult.map((a) => `---ACAO_${a.toUpperCase()}---\n(ação específica para ${AGENT_NAMES[a]} — o que fazer hoje/amanhã com prazo)\n---FIM_${a.toUpperCase()}---`).join("\n")}

Direto. Sem enrolação.`.trim();

    const synthesis = await callAgent("ceo", ceoSynthPrompt);

    // Helper para extrair seções
    const extract = (text: string, agent: string) => {
      const s = text.indexOf(`---ACAO_${agent.toUpperCase()}---`);
      const e = text.indexOf(`---FIM_${agent.toUpperCase()}---`);
      return s !== -1 && e !== -1 ? text.slice(s + `---ACAO_${agent.toUpperCase()}---`.length, e).trim() : "";
    };

    // Remove marcadores do texto do CEO
    let synthesisClean = synthesis;
    for (const agent of agentsToConsult) {
      synthesisClean = synthesisClean
        .replace(new RegExp(`---ACAO_${agent.toUpperCase()}---[\\s\\S]*?---FIM_${agent.toUpperCase()}---`, "g"), "")
        .trim();
    }

    // 5. Envia síntese ao CEO
    await sendTelegram(ceoChatId, `*Reunião — ${topic}*\n\n${synthesisClean}`, "ceo");

    // 6. Envia ação + executa para cada agente consultado
    for (const { agent } of agentResults) {
      const agentChatId = await getChatId(agent);
      const acao = extract(synthesis, agent);
      if (!agentChatId || !acao) continue;

      // Notifica a ação
      await sendTelegram(agentChatId, `*Reunião — ${topic}*\n\n*Max determinou:*\n${acao}`, agent);

      // Executa
      const execResult = await callAgent(agent,
        `Max determinou na reunião sobre "${topic}":\n\n${acao}\n\nExecute o que for possível agora usando suas ferramentas. Reporte: o que foi feito e o que precisa de ação humana.`
      );
      await sendTelegram(agentChatId, `*Execução:*\n${execResult}`, agent);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendTelegram(ceoChatId, `Erro na reunião sobre "${topic}": ${msg.slice(0, 300)}`, "ceo").catch(() => {});
  }
}

// ============ ALERTA SALDO META ADS ============
const META_BALANCE_THRESHOLD_CENTS = 5000; // R$ 50,00
const META_BALANCE_ALERT_KEY = "meta_balance_alert_sent";

async function getLastAlertTime(): Promise<number> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_messages?agent=eq.marketing&role=eq.assistant&content=like.${encodeURIComponent("__META_BALANCE_ALERT__%")}&order=created_at.desc&limit=1&select=created_at`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json() as Array<{ created_at: string }>;
    if (!data || data.length === 0) return 0;
    return new Date(data[0].created_at).getTime();
  } catch { return 0; }
}

async function saveAlertSent(): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "marketing", chat_id: 0, role: "assistant", content: `__META_BALANCE_ALERT__${new Date().toISOString()}` }),
    });
  } catch { /* silent */ }
}

async function runMetaBalanceCheck(): Promise<void> {
  try {
    // Busca saldo via action balance_check (POST) — meta-ads-sync lê da Graph API do Meta
    const metaRes = await fetch(`${NEXUS_URL}/meta-ads-sync`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "balance_check" }),
    });
    if (!metaRes.ok) return;
    const data = await metaRes.json() as Record<string, unknown>;

    // Meta retorna balance como string decimal em BRL: "50.00" = R$ 50,00
    let balanceCents = 0;
    const raw = data?.balance ?? null;
    if (raw !== null && raw !== undefined) {
      const parsed = parseFloat(String(raw));
      balanceCents = isNaN(parsed) ? 0 : Math.round(parsed * 100);
    }

    if (balanceCents === 0) return; // não conseguiu ler — silencioso

    if (balanceCents < META_BALANCE_THRESHOLD_CENTS) {
      // Verifica se já enviou alerta nas últimas 4 horas (evita spam)
      const lastAlert = await getLastAlertTime();
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      if (lastAlert > fourHoursAgo) return; // já alertou recentemente

      const saldoFormatado = (balanceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const lunaChatId = await getChatId("marketing");
      const lunaToken = TELEGRAM_TOKENS["marketing"];

      const alerta = `*ALERTA — Saldo Meta Ads Baixo*\n\nFabrício, o saldo da sua conta no Meta Ads está em *${saldoFormatado}*.\n\nAbaixo de R$ 50,00 — campanhas podem pausar automaticamente. Recarregue agora para não perder veiculação.`;

      // Envia pelo bot da Luna no chat da Luna
      if (lunaToken && lunaChatId) {
        await fetch(`https://api.telegram.org/bot${lunaToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: lunaChatId, text: alerta, parse_mode: "Markdown" }),
        });
        await saveAlertSent();
      }
    }
  } catch { /* silent — não quebra o cron */ }
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
    if (dbg && ["financeiro","crm","projetos","ceo","marketing"].includes(dbg)) {
      try {
        const reply = await callAgent(dbg, "qual sua função e o que você consegue fazer?");
        return new Response(JSON.stringify({ ok: true, agent: dbg, reply: reply.slice(0, 500) }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, agent: dbg, error: String(err) }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ ok: true, version: "2.8-luna-marketing" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  // ── AÇÕES DE CRON ──
  const action = url.searchParams.get("action");
  if (action === "daily-meeting") {
    // Fire-and-forget: retorna 200 imediatamente, executa em background (waitUntil)
    // Reunião usa Haiku nos 4 relatórios → cabe nos 150s de wall-clock da edge function
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
  if (action === "check-meta-balance") {
    EdgeRuntime.waitUntil(runMetaBalanceCheck());
    return new Response(JSON.stringify({ ok: true, started: "check-meta-balance" }), { status: 200, headers: { "Content-Type": "application/json" } });
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

      // Salva chat ID para mensagens proativas (sempre, inclusive antes de early returns)
      EdgeRuntime.waitUntil(storeChatId(agentType, chatId));

      // CEO: comandos especiais de reunião e aprovação
      if (agentType === "ceo") {
        const lower = text.toLowerCase().trim();

        // Aprovação de direcionamentos pendentes
        const isApproval = /^(ok|sim|pode|bora|vai|confirmo|confirmado|aprovado|aprovar|executar|execute|autorizo|autorizado)[\s!.]*$/i.test(lower);
        if (isApproval) {
          const pending = await getPendingApproval(chatId);
          if (pending) {
            await sendTelegram(chatId, `*Aprovado. Acionando Noah, Sophia, Melissa e Luna agora...*`, "ceo");
            EdgeRuntime.waitUntil((async () => {
              const [noahId, sophiaId, melissaId, lunaId] = await Promise.all([
                getChatId("financeiro"), getChatId("crm"), getChatId("projetos"), getChatId("marketing"),
              ]);
              await Promise.all([
                noahId    && pending.noah    ? sendTelegram(noahId,    `*Ordem do Max — executando agora...*\n\n${pending.noah}`,    "financeiro") : Promise.resolve(),
                sophiaId  && pending.sophia  ? sendTelegram(sophiaId,  `*Ordem do Max — executando agora...*\n\n${pending.sophia}`,  "crm")        : Promise.resolve(),
                melissaId && pending.melissa ? sendTelegram(melissaId, `*Ordem do Max — executando agora...*\n\n${pending.melissa}`, "projetos")   : Promise.resolve(),
                lunaId    && pending.luna    ? sendTelegram(lunaId,    `*Ordem do Max — executando agora...*\n\n${pending.luna}`,    "marketing")  : Promise.resolve(),
              ]);
              const execPrompt = (dir: string) =>
                `O CEO Max aprovou e te deu as seguintes ordens:\n\n${dir}\n\n` +
                `Execute tudo o que for possível agora usando suas ferramentas. ` +
                `Liste o que foi executado e o que precisa de ação humana. Seja objetivo.`;
              const [noahExec, sophiaExec, melissaExec, lunaExec] = await Promise.all([
                pending.noah    ? callAgent("financeiro", execPrompt(pending.noah))    : Promise.resolve("Sem direcionamento."),
                pending.sophia  ? callAgent("crm",        execPrompt(pending.sophia))  : Promise.resolve("Sem direcionamento."),
                pending.melissa ? callAgent("projetos",   execPrompt(pending.melissa)) : Promise.resolve("Sem direcionamento."),
                pending.luna    ? callAgent("marketing",  execPrompt(pending.luna))    : Promise.resolve("Sem direcionamento."),
              ]);
              await Promise.all([
                noahId    ? sendTelegram(noahId,    `*Execução concluída*\n\n${noahExec}`,    "financeiro") : Promise.resolve(),
                sophiaId  ? sendTelegram(sophiaId,  `*Execução concluída*\n\n${sophiaExec}`,  "crm")        : Promise.resolve(),
                melissaId ? sendTelegram(melissaId, `*Execução concluída*\n\n${melissaExec}`, "projetos")   : Promise.resolve(),
                lunaId    ? sendTelegram(lunaId,    `*Execução concluída*\n\n${lunaExec}`,    "marketing")  : Promise.resolve(),
              ]);
              await sendTelegram(chatId, `_Execução concluída. Noah, Sophia, Melissa e Luna foram acionados._`, "ceo");
            })());
            return new Response("OK", { status: 200 });
          }
          // Se não tem nada pendente, deixa o Max responder normalmente
        }

        // Rejeição de direcionamentos pendentes
        const isRejection = /^(não|nao|cancela|cancelar|recusar|recusa|abortar|abort|pare|para)[\s!.]*$/i.test(lower);
        if (isRejection) {
          const pending = await getPendingApproval(chatId);
          if (pending) {
            await sendTelegram(chatId, `_Direcionamentos cancelados. Os agentes não serão acionados._`, "ceo");
            return new Response("OK", { status: 200 });
          }
        }

        // "reunião" ou "alinhamento" sem tema → reunião geral com todos os agentes
        if (lower === "reunião" || lower === "reuniao" || lower === "alinhamento" || lower === "meeting") {
          EdgeRuntime.waitUntil(runAlignmentMeeting("ondemand", chatId));
          await sendTelegram(chatId, "Convocando reunião de alinhamento com Noah, Sophia e Melissa. Aguarda — isso leva de 2 a 3 minutos.", "ceo");
          return new Response("OK", { status: 200 });
        }

        // "reunião sobre [tema]" / "reuniao [tema]" / "pauta [tema]" → reunião temática
        const topicMatch = text.match(/^(?:reunião|reuniao|pauta|meeting)\s+(?:sobre\s+|about\s+)?(.+)/i);
        if (topicMatch) {
          const topic = topicMatch[1].trim();
          EdgeRuntime.waitUntil(runTopicMeeting(topic, chatId));
          await sendTelegram(chatId, `Iniciando reunião sobre "${topic}". Aguarda — 2 a 3 minutos.`, "ceo");
          return new Response("OK", { status: 200 });
        }
      }

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
          }

          // Carrega histórico da conversa e chama o agente com contexto
          const history = await loadHistory(agentType, chatId);
          const reply = await callAgent(agentType, inputText, history);

          // Salva a troca no banco (user + assistant)
          await Promise.all([
            saveMessage(agentType, chatId, "user", inputText),
            saveMessage(agentType, chatId, "assistant", reply),
          ]);

          // CEO: verifica se Max quer disparar uma reunião temática
          if (agentType === "ceo") {
            const triggerMatch = reply.match(/\[TRIGGER_MEETING:\s*(.+?)\]/);
            if (triggerMatch) {
              const topic = triggerMatch[1].trim();
              const cleanReply = reply.replace(/\[TRIGGER_MEETING:[^\]]*\]/g, "").trim();
              await sendTelegram(chatId, cleanReply, "ceo");
              EdgeRuntime.waitUntil(runTopicMeeting(topic, chatId));
              return;
            }
          }

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
          // Nunca expõe erros técnicos de rede ou internos ao usuário
          const userMsg = isRate
            ? "Muitas consultas simultâneas. Aguarda 30s e tenta de novo."
            : "Tive um problema técnico aqui. Tenta mandar de novo em instantes.";
          await sendTelegram(chatId, userMsg, agentType).catch(() => {/* silent */});
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
