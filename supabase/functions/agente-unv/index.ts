// agente-unv v1.2
import Anthropic from "npm:@anthropic-ai/sdk";

// ============ ENV VARS ============
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY") ?? "";
// EVOLUTION_URL: usa secret específico primeiro, depois fallback para evo07 (evo13 tem problema de TLS)
const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL") ?? "https://evo07.stevo.chat";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "fabricionunnes";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const NEXUS_URL = "https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1";
const NEXUS_KEY_FINANCEIRO = Deno.env.get("NEXUS_KEY_FINANCEIRO") ?? "";
const NEXUS_KEY_DIRETOR = Deno.env.get("NEXUS_KEY_DIRETOR") ?? "";

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

// ============ TIPOS ============
type AgentType = "financeiro" | "crm" | "projetos";

// ============ TOOLS — BRUNO (FINANCEIRO) ============
const FINANCIAL_TOOLS: Anthropic.Tool[] = [
  {
    name: "resumo_financeiro",
    description: "Retorna resumo financeiro completo: saldo bancário, recebíveis, contas a pagar e MRR",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "contas_bancarias",
    description: "Lista todas as contas bancárias com saldos atuais",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "fluxo_caixa",
    description: "Projeção de fluxo de caixa por período",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Data início YYYY-MM-DD" },
        date_to: { type: "string", description: "Data fim YYYY-MM-DD" },
      },
    },
  },
  {
    name: "inadimplentes",
    description: "Lista clientes com faturas em atraso",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "dre",
    description: "Demonstrativo de Resultado do Exercício do ano",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Ano no formato YYYY-01-01" },
      },
    },
  },
  {
    name: "criar_conta_receber",
    description: "Cria uma conta a receber",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number", description: "Valor em reais" },
        due_date: { type: "string", description: "Data de vencimento YYYY-MM-DD" },
        company_id: { type: "string", description: "UUID da empresa (opcional)" },
        custom_receiver_name: { type: "string", description: "Nome do recebedor se não for empresa cadastrada" },
        payment_method: { type: "string", enum: ["pix", "boleto", "credit_card", "transfer"] },
        notes: { type: "string" },
      },
      required: ["description", "amount", "due_date"],
    },
  },
  {
    name: "marcar_recebido",
    description: "Marca um recebível como pago",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do recebível" },
        paid_amount: { type: "number" },
        paid_date: { type: "string", description: "YYYY-MM-DD" },
        payment_method: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "criar_conta_pagar",
    description: "Cria uma conta a pagar",
    input_schema: {
      type: "object",
      properties: {
        supplier_name: { type: "string" },
        description: { type: "string" },
        amount: { type: "number" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        payment_method: { type: "string" },
        cost_type: { type: "string", enum: ["fixed", "variable"] },
        notes: { type: "string" },
      },
      required: ["supplier_name", "description", "amount", "due_date"],
    },
  },
  {
    name: "marcar_pago",
    description: "Marca uma conta a pagar como paga",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID da conta a pagar" },
        paid_amount: { type: "number" },
        paid_date: { type: "string", description: "YYYY-MM-DD" },
        payment_method: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "criar_fatura",
    description: "Cria uma fatura para uma empresa cliente",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount_cents: { type: "number", description: "Valor em centavos (ex: 700000 = R$7.000)" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        company_id: { type: "string" },
        custom_receiver_name: { type: "string" },
        payment_method: { type: "string" },
        notes: { type: "string" },
      },
      required: ["description", "amount_cents", "due_date"],
    },
  },
];

// ============ TOOLS — MATEUS (CRM) ============
const CRM_TOOLS: Anthropic.Tool[] = [
  {
    name: "listar_leads",
    description: "Lista leads do CRM com filtros opcionais",
    input_schema: {
      type: "object",
      properties: {
        pipeline_id: { type: "string" },
        stage_id: { type: "string" },
        search: { type: "string", description: "Busca por nome, empresa, telefone ou email" },
        date_from: { type: "string" },
        date_to: { type: "string" },
      },
    },
  },
  {
    name: "detalhes_lead",
    description: "Detalhes completos de um lead incluindo tags e histórico",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lead" },
      },
      required: ["id"],
    },
  },
  {
    name: "criar_lead",
    description: "Cria um novo lead no CRM",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        pipeline_id: { type: "string" },
        stage_id: { type: "string" },
        opportunity_value: { type: "number" },
        segment: { type: "string" },
        main_pain: { type: "string" },
        notes: { type: "string" },
        origin: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "atualizar_lead",
    description: "Atualiza qualquer campo de um lead",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        opportunity_value: { type: "number" },
        segment: { type: "string" },
        main_pain: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "mover_etapa",
    description: "Move um lead para outra etapa do pipeline",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lead" },
        stage_id: { type: "string", description: "UUID da nova etapa" },
      },
      required: ["id", "stage_id"],
    },
  },
  {
    name: "dar_ganho",
    description: "Marca um lead como GANHO — move para etapa won e cria fatura no financeiro",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lead" },
        opportunity_value: { type: "number" },
        paid_value: { type: "number" },
        payment_method: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "dar_perda",
    description: "Marca um lead como PERDIDO",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lead" },
        notes: { type: "string", description: "Motivo da perda" },
      },
      required: ["id"],
    },
  },
  {
    name: "adicionar_nota",
    description: "Adiciona uma nota ao histórico do lead",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lead" },
        content: { type: "string" },
      },
      required: ["id", "content"],
    },
  },
  {
    name: "criar_atividade",
    description: "Cria uma atividade ou follow-up para um lead",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        type: {
          type: "string",
          enum: ["call", "whatsapp", "email", "meeting", "followup", "proposal", "note", "other"],
        },
        title: { type: "string" },
        description: { type: "string" },
        scheduled_at: { type: "string", description: "ISO 8601" },
      },
      required: ["lead_id", "type", "title"],
    },
  },
  {
    name: "agendar_reuniao",
    description: "Agenda uma reunião de vendas para um lead",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        pipeline_id: { type: "string" },
        credited_staff_id: { type: "string" },
        event_date: { type: "string", description: "ISO 8601" },
      },
      required: ["lead_id", "pipeline_id", "credited_staff_id"],
    },
  },
  {
    name: "listar_pipelines",
    description: "Lista os pipelines e etapas disponíveis no CRM",
    input_schema: { type: "object", properties: {} },
  },
];

// ============ TOOLS — SOFIA (PROJETOS) ============
const PROJECT_TOOLS: Anthropic.Tool[] = [
  {
    name: "listar_empresas",
    description: "Lista empresas clientes com filtro por status",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "inactive", "churned"] },
      },
    },
  },
  {
    name: "detalhes_empresa",
    description: "Detalhes completos de uma empresa cliente",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "listar_projetos",
    description: "Lista projetos ativos com filtros",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "active", "completed", "paused"] },
        company_id: { type: "string" },
      },
    },
  },
  {
    name: "listar_tarefas",
    description: "Lista tarefas com filtros por projeto, status ou data",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed"] },
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "atualizar_tarefa",
    description: "Atualiza status ou dados de uma tarefa",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed"] },
        observations: { type: "string" },
        due_date: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "listar_kpis",
    description: "Lista KPIs configurados de uma empresa para o mês",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string" },
        month_year: { type: "string", description: "Formato YYYY-MM" },
      },
      required: ["company_id"],
    },
  },
  {
    name: "registrar_kpi",
    description: "Registra um lançamento de KPI para um vendedor",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string" },
        salesperson_id: { type: "string" },
        kpi_id: { type: "string" },
        value: { type: "number" },
        entry_date: { type: "string", description: "YYYY-MM-DD (padrão: hoje)" },
        observations: { type: "string" },
      },
      required: ["company_id", "salesperson_id", "kpi_id", "value"],
    },
  },
  {
    name: "listar_vendedores",
    description: "Lista vendedores de uma empresa cliente",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string" },
        status: { type: "string", enum: ["active", "inactive"] },
      },
      required: ["company_id"],
    },
  },
  {
    name: "listar_reunioes",
    description: "Lista reuniões de projeto — útil para verificar clientes sem atividade",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        company_id: { type: "string" },
        is_finalized: { type: "boolean" },
        date_from: { type: "string" },
        date_to: { type: "string" },
      },
    },
  },
];

// ============ CONFIGS DOS AGENTES ============
const TODAY = new Date().toLocaleDateString("pt-BR");

const AGENT_CONFIGS = {
  financeiro: {
    name: "Noah",
    systemPrompt: `Você é Noah, agente financeiro da UNV Holdings.
Você acessa o sistema Nexus para consultar e registrar informações financeiras da empresa.

Regras:
- Seja direto e objetivo. Uma resposta curta vale mais que um texto longo.
- Formate sempre valores em reais: R$ 7.000,00
- Antes de criar qualquer registro, confirme os dados com o usuário
- Nunca invente dados — sempre consulte a API
- Linguagem direta: sem "Perfeito!", sem emojis excessivos, sem formalidade
- Se não encontrar o dado, fale claramente que não encontrou
- Data de hoje: ${TODAY}`,
    apiKey: NEXUS_KEY_FINANCEIRO,
    tools: FINANCIAL_TOOLS,
  },
  crm: {
    name: "Sophia",
    systemPrompt: `Você é Sophia, agente de CRM da UNV Holdings.
Você gerencia o pipeline comercial: leads, reuniões, atividades e negociações.

Regras:
- Seja ágil. Respostas curtas e diretas.
- Ao criar lead: confirme os dados antes de registrar
- Ao dar ganho ou perda: se o motivo não foi informado, pergunte
- Apresente listas resumidas — máximo 5 itens por vez, com o essencial
- Sem formalidade, sem "Perfeito!", sem emojis excessivos
- Se não encontrar o lead pelo nome, liste os mais similares e pergunte qual
- Data de hoje: ${TODAY}`,
    apiKey: NEXUS_KEY_DIRETOR,
    tools: CRM_TOOLS,
  },
  projetos: {
    name: "Melissa",
    systemPrompt: `Você é Melissa, agente de projetos da UNV Holdings.
Você acompanha clientes ativos, tarefas, KPIs e reuniões de projeto.

Regras:
- Seu foco é garantir que nada caia. Seja proativa nos alertas.
- Sempre destaque itens críticos: clientes sem atividade, tarefas vencidas, KPIs não lançados
- Listas resumidas com destaque para o que precisa de ação
- Sem formalidade, sem "Perfeito!", sem emojis excessivos
- Se precisar de mais contexto para registrar um KPI, pergunte qual empresa e qual vendedor
- Data de hoje: ${TODAY}`,
    apiKey: NEXUS_KEY_DIRETOR,
    tools: PROJECT_TOOLS,
  },
};

// ============ ROTEAMENTO ============
function detectAgent(message: string): AgentType | null {
  const lower = message.toLowerCase().trim();

  if (lower.startsWith("noah")) return "financeiro";
  if (lower.startsWith("sophia")) return "crm";
  if (lower.startsWith("melissa")) return "projetos";

  const financialKw = ["saldo", "financeiro", "fatura", "receber", "pagar", "inadimplente", "dre", "fluxo de caixa", "mrr", "receita", "despesa", "cobrança"];
  const crmKw = ["lead", "crm", "pipeline", "funil", "negoci", "ganho", "perda", "prospect", "oportunidade", "atividade", "proposta", "closer", "sdr"];
  const projectKw = ["cliente ativo", "tarefa", "kpi", "projeto", "vendedor", "reunião de projeto", "churn", "nps", "melissa", "empresa ativa"];

  if (financialKw.some((k) => lower.includes(k))) return "financeiro";
  if (crmKw.some((k) => lower.includes(k))) return "crm";
  if (projectKw.some((k) => lower.includes(k))) return "projetos";

  return null;
}

// ============ CHAMADAS À API NEXUS ============
async function nexusGet(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const url = new URL(path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": apiKey,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Nexus GET error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function nexusPost(url: string, body: Record<string, unknown>, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Nexus POST error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ============ EXECUÇÃO DE TOOLS ============
async function executeTool(toolName: string, input: Record<string, unknown>, agentType: AgentType): Promise<string> {
  const apiKey = AGENT_CONFIGS[agentType].apiKey;
  const FINANCIAL_API = `${NEXUS_URL}/financial-api`;
  const SYSTEM_API = `${NEXUS_URL}/system-api`;

  try {
    let result: unknown;

    switch (toolName) {
      // ── FINANCEIRO ──
      case "resumo_financeiro":
        result = await nexusGet(FINANCIAL_API, { endpoint: "summary" }, apiKey);
        break;
      case "contas_bancarias":
        result = await nexusGet(FINANCIAL_API, { endpoint: "banks" }, apiKey);
        break;
      case "fluxo_caixa": {
        const p: Record<string, string> = { endpoint: "cashflow" };
        if (input.date_from) p.date_from = input.date_from as string;
        if (input.date_to) p.date_to = input.date_to as string;
        result = await nexusGet(FINANCIAL_API, p, apiKey);
        break;
      }
      case "inadimplentes":
        result = await nexusGet(FINANCIAL_API, { endpoint: "overdue_clients" }, apiKey);
        break;
      case "dre": {
        const p: Record<string, string> = { endpoint: "dre" };
        if (input.date_from) p.date_from = input.date_from as string;
        result = await nexusGet(FINANCIAL_API, p, apiKey);
        break;
      }
      case "criar_conta_receber":
        result = await nexusPost(`${SYSTEM_API}?module=receivables&action=create`, input, apiKey);
        break;
      case "marcar_recebido": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=receivables&action=mark_paid&id=${id}`, body, apiKey);
        break;
      }
      case "criar_conta_pagar":
        result = await nexusPost(`${SYSTEM_API}?module=payables&action=create`, input, apiKey);
        break;
      case "marcar_pago": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=payables&action=mark_paid&id=${id}`, body, apiKey);
        break;
      }
      case "criar_fatura":
        result = await nexusPost(`${SYSTEM_API}?module=invoices&action=create`, input, apiKey);
        break;

      // ── CRM ──
      case "listar_leads": {
        const p: Record<string, string> = { module: "leads", action: "list" };
        if (input.pipeline_id) p.pipeline_id = input.pipeline_id as string;
        if (input.stage_id) p.stage_id = input.stage_id as string;
        if (input.search) p.search = input.search as string;
        if (input.date_from) p.date_from = input.date_from as string;
        if (input.date_to) p.date_to = input.date_to as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }
      case "detalhes_lead":
        result = await nexusGet(SYSTEM_API, { module: "leads", action: "get", id: input.id as string }, apiKey);
        break;
      case "criar_lead":
        result = await nexusPost(`${SYSTEM_API}?module=leads&action=create`, input, apiKey);
        break;
      case "atualizar_lead": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=leads&action=update&id=${id}`, body, apiKey);
        break;
      }
      case "mover_etapa": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=leads&action=move_stage&id=${id}`, body, apiKey);
        break;
      }
      case "dar_ganho": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=leads&action=win&id=${id}`, body, apiKey);
        break;
      }
      case "dar_perda": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=leads&action=lose&id=${id}`, body, apiKey);
        break;
      }
      case "adicionar_nota": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=leads&action=add_note&id=${id}`, body, apiKey);
        break;
      }
      case "criar_atividade":
        result = await nexusPost(`${SYSTEM_API}?module=activities&action=create`, input, apiKey);
        break;
      case "agendar_reuniao":
        result = await nexusPost(`${SYSTEM_API}?module=meetings&action=schedule`, input, apiKey);
        break;
      case "listar_pipelines":
        result = await nexusGet(SYSTEM_API, { module: "pipelines", action: "list" }, apiKey);
        break;

      // ── PROJETOS ──
      case "listar_empresas": {
        const p: Record<string, string> = { module: "companies", action: "list" };
        if (input.status) p.status = input.status as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }
      case "detalhes_empresa":
        result = await nexusGet(SYSTEM_API, { module: "companies", action: "get", id: input.id as string }, apiKey);
        break;
      case "listar_projetos": {
        const p: Record<string, string> = { module: "projects", action: "list" };
        if (input.status) p.status = input.status as string;
        if (input.company_id) p.company_id = input.company_id as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }
      case "listar_tarefas": {
        const p: Record<string, string> = { module: "tasks", action: "list" };
        if (input.project_id) p.project_id = input.project_id as string;
        if (input.status) p.status = input.status as string;
        if (input.date_from) p.date_from = input.date_from as string;
        if (input.date_to) p.date_to = input.date_to as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }
      case "atualizar_tarefa": {
        const { id, ...body } = input;
        result = await nexusPost(`${SYSTEM_API}?module=tasks&action=update&id=${id}`, body, apiKey);
        break;
      }
      case "listar_kpis": {
        const p: Record<string, string> = { module: "kpis", action: "list", company_id: input.company_id as string };
        if (input.month_year) p.month_year = input.month_year as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }
      case "registrar_kpi":
        result = await nexusPost(`${SYSTEM_API}?module=kpis&action=create_entry`, input, apiKey);
        break;
      case "listar_vendedores": {
        const p: Record<string, string> = { module: "salespeople", action: "list", company_id: input.company_id as string };
        if (input.status) p.status = input.status as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }
      case "listar_reunioes": {
        const p: Record<string, string> = { module: "project_meetings", action: "list" };
        if (input.project_id) p.project_id = input.project_id as string;
        if (input.company_id) p.company_id = input.company_id as string;
        if (input.is_finalized !== undefined) p.is_finalized = String(input.is_finalized);
        if (input.date_from) p.date_from = input.date_from as string;
        if (input.date_to) p.date_to = input.date_to as string;
        result = await nexusGet(SYSTEM_API, p, apiKey);
        break;
      }

      default:
        return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
    }

    return JSON.stringify(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: message });
  }
}

// ============ LOOP DO AGENTE ============
async function callAgent(agentType: AgentType, userMessage: string): Promise<string> {
  const config = AGENT_CONFIGS[agentType];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: config.systemPrompt,
      tools: config.tools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((c) => c.type === "text");
      return text ? text.text : "Pronto.";
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter((c) => c.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      const results = await Promise.all(
        toolUses.map(async (tu) => {
          if (tu.type !== "tool_use") return null;
          return {
            type: "tool_result" as const,
            tool_use_id: tu.id,
            content: await executeTool(tu.name, tu.input as Record<string, unknown>, agentType),
          };
        })
      );

      messages.push({ role: "user", content: results.filter(Boolean) as Anthropic.ToolResultBlockParam[] });
    } else {
      const text = response.content.find((c) => c.type === "text");
      return text ? text.text : "Erro inesperado.";
    }
  }

  return "Não consegui processar em tempo hábil. Tenta de novo.";
}

// ============ ENVIAR MENSAGEM WHATSAPP ============
async function sendWhatsApp(to: string, text: string): Promise<void> {
  // Tenta HTTPS primeiro; se falhar por TLS, tenta HTTP (para servidores Stevo com cert problemático)
  const tryUrls = [
    `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    `${EVOLUTION_URL.replace("https://", "http://")}/message/sendText/${EVOLUTION_INSTANCE}`,
  ];

  let lastErr = "";
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number: to, text, delay: 1200 }),
      });
      if (res.ok) {
        console.log(`sendWhatsApp OK → ${to} via ${url}`);
        return;
      }
      const body = await res.text().catch(() => "(sem body)");
      lastErr = `HTTP ${res.status}: ${body}`;
      console.error(`sendWhatsApp ${lastErr} via ${url}`);
      return; // HTTP error não tenta fallback
    } catch (err) {
      lastErr = String(err);
      console.error(`sendWhatsApp fetch error via ${url}: ${lastErr}`);
      // Continua para o próximo URL apenas se for erro de conexão/TLS
    }
  }
  console.error(`sendWhatsApp falhou em todas as tentativas: ${lastErr}`);
}

// URL da evolution-webhook original — recebe tudo que não é comando de agente
const EVOLUTION_WEBHOOK_URL = `${NEXUS_URL}/evolution-webhook`;
const EVOLUTION_WEBHOOK_TOKEN = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") ?? "";

// ============ FORWARD PARA EVOLUTION-WEBHOOK ============
async function forwardToEvolutionWebhook(rawBody: unknown): Promise<void> {
  await fetch(EVOLUTION_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(EVOLUTION_WEBHOOK_TOKEN ? { authorization: `Bearer ${EVOLUTION_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify(rawBody),
  });
}

// ============ HANDLER PRINCIPAL ============
Deno.serve(async (req) => {
  // GET — diagnóstico de secrets (sem expor valores)
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      secrets: {
        CLAUDE_API_KEY: !!CLAUDE_API_KEY,
        EVOLUTION_URL: !!EVOLUTION_URL,
        EVOLUTION_API_KEY: !!EVOLUTION_API_KEY,
        EVOLUTION_INSTANCE: EVOLUTION_INSTANCE || "(vazio)",
        SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY,
        NEXUS_KEY_FINANCEIRO: !!NEXUS_KEY_FINANCEIRO,
        NEXUS_KEY_DIRETOR: !!NEXUS_KEY_DIRETOR,
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const rawBody = await req.json();

    // Repassa eventos que não são mensagens direto para evolution-webhook
    // Evolution envia "MESSAGES_UPSERT" (maiúsculo) ou "messages.upsert" (minúsculo)
    const eventNorm = (rawBody.event || "").toUpperCase().replace(/\./g, "_");
    if (eventNorm !== "MESSAGES_UPSERT") {
      EdgeRuntime.waitUntil(forwardToEvolutionWebhook(rawBody));
      return new Response("OK", { status: 200 });
    }

    const data = rawBody.data;
    if (!data || data.key?.fromMe) {
      EdgeRuntime.waitUntil(forwardToEvolutionWebhook(rawBody));
      return new Response("OK", { status: 200 });
    }

    // Extrai texto (suporta mensagens simples e com formatação)
    const text: string =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    // LID addressing (novo formato WhatsApp): usa remoteJidAlt quando disponível
    const from: string =
      (data.key?.addressingMode === "lid" && data.key?.remoteJidAlt)
        ? data.key.remoteJidAlt
        : (data.key?.remoteJid ?? "");

    if (!text.trim() || !from) {
      EdgeRuntime.waitUntil(forwardToEvolutionWebhook(rawBody));
      return new Response("OK", { status: 200 });
    }

    const agentType = detectAgent(text);

    if (!agentType) {
      // Não é comando de agente — repassa para evolution-webhook (async, sem bloquear)
      EdgeRuntime.waitUntil(forwardToEvolutionWebhook(rawBody));
      return new Response("OK", { status: 200 });
    }

    // Processa agente de forma síncrona — retorna OK só depois de enviar resposta
    let debugResult = "ok";
    try {
      const reply = await callAgent(agentType, text);
      debugResult = `reply_ok:${reply.slice(0, 100)}`;
      try {
        await sendWhatsApp(from, reply);
        debugResult += "|whatsapp_ok";
      } catch (we) {
        debugResult += `|whatsapp_err:${we instanceof Error ? we.message : String(we)}`;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      debugResult = `agent_err:${errMsg}`;
      console.error("Erro no agente:", errMsg);
      try {
        await sendWhatsApp(from, `[ERRO AGENTE] ${errMsg.slice(0, 300)}`);
        debugResult += "|err_whatsapp_ok";
      } catch (we2) {
        debugResult += `|err_whatsapp_err:${we2 instanceof Error ? we2.message : String(we2)}`;
      }
    }

    return new Response(debugResult, { status: 200 });
  } catch (err) {
    console.error("Erro no handler:", err);
    return new Response("OK", { status: 200 });
  }
});
