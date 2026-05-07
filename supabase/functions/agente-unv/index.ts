// agente-unv v2.0 — CEO + 3 agentes + Telegram confiável
import Anthropic from "npm:@anthropic-ai/sdk";

// ============ ENV VARS ============
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY") ?? "";
const EVOLUTION_URL = "https://evo07.stevo.chat";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "fabricionunnes";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const NEXUS_URL = "https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1";
const NEXUS_KEY_FINANCEIRO = Deno.env.get("NEXUS_KEY_FINANCEIRO") ?? "";
const NEXUS_KEY_DIRETOR = Deno.env.get("NEXUS_KEY_DIRETOR") ?? "";

const TELEGRAM_TOKENS: Record<string, string> = {
  financeiro: Deno.env.get("TELEGRAM_TOKEN_FINANCEIRO") ?? "8302241725:AAG9FT9vUtWPhs4zE-0P2tp5-LJCnBorQtE",
  crm:        Deno.env.get("TELEGRAM_TOKEN_CRM")        ?? "8690436126:AAED3kFZgonruvAZg9wVYt_ltcQ2fqGL_zI",
  projetos:   Deno.env.get("TELEGRAM_TOKEN_PROJETOS")   ?? "8731972632:AAFUT8lkyxYrSaouq5lew9p9N-kCgsZdl5U",
  ceo:        Deno.env.get("TELEGRAM_TOKEN_CEO")        ?? "8663785814:AAESc_KL4xMLQlwbrFNYI6WlZocZlMkWAKk",
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
  { name: "listar_leads", description: "Lista leads do CRM com filtros", input_schema: { type: "object", properties: { pipeline_id: { type: "string" }, stage_id: { type: "string" }, search: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "detalhes_lead", description: "Detalhes de um lead", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "criar_lead", description: "Cria um novo lead", input_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, company: { type: "string" }, pipeline_id: { type: "string" }, stage_id: { type: "string" }, opportunity_value: { type: "number" }, segment: { type: "string" }, main_pain: { type: "string" }, notes: { type: "string" }, origin: { type: "string" } }, required: ["name"] } },
  { name: "atualizar_lead", description: "Atualiza campos de um lead", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, company: { type: "string" }, opportunity_value: { type: "number" }, segment: { type: "string" }, main_pain: { type: "string" }, notes: { type: "string" } }, required: ["id"] } },
  { name: "mover_etapa", description: "Move lead para outra etapa do pipeline", input_schema: { type: "object", properties: { id: { type: "string" }, stage_id: { type: "string" } }, required: ["id","stage_id"] } },
  { name: "dar_ganho", description: "Marca lead como GANHO", input_schema: { type: "object", properties: { id: { type: "string" }, opportunity_value: { type: "number" }, paid_value: { type: "number" }, payment_method: { type: "string" }, notes: { type: "string" } }, required: ["id"] } },
  { name: "dar_perda", description: "Marca lead como PERDIDO", input_schema: { type: "object", properties: { id: { type: "string" }, notes: { type: "string" } }, required: ["id"] } },
  { name: "adicionar_nota", description: "Adiciona nota ao lead", input_schema: { type: "object", properties: { id: { type: "string" }, content: { type: "string" } }, required: ["id","content"] } },
  { name: "criar_atividade", description: "Cria atividade ou follow-up para lead", input_schema: { type: "object", properties: { lead_id: { type: "string" }, type: { type: "string", enum: ["call","whatsapp","email","meeting","followup","proposal","note","other"] }, title: { type: "string" }, description: { type: "string" }, scheduled_at: { type: "string" } }, required: ["lead_id","type","title"] } },
  { name: "agendar_reuniao", description: "Agenda reunião de vendas para lead", input_schema: { type: "object", properties: { lead_id: { type: "string" }, pipeline_id: { type: "string" }, credited_staff_id: { type: "string" }, event_date: { type: "string" } }, required: ["lead_id","pipeline_id","credited_staff_id"] } },
  { name: "listar_pipelines", description: "Lista pipelines e etapas do CRM", input_schema: { type: "object", properties: {} } },
];

// ============ TOOLS — MELISSA (PROJETOS) ============
const PROJECT_TOOLS: Anthropic.Tool[] = [
  { name: "listar_empresas", description: "Lista empresas clientes", input_schema: { type: "object", properties: { status: { type: "string", enum: ["active","inactive","churned"] } } } },
  { name: "detalhes_empresa", description: "Detalhes de uma empresa cliente", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "listar_projetos", description: "Lista projetos com filtros", input_schema: { type: "object", properties: { status: { type: "string", enum: ["pending","active","completed","paused"] }, company_id: { type: "string" } } } },
  { name: "listar_tarefas", description: "Lista tarefas com filtros", input_schema: { type: "object", properties: { project_id: { type: "string" }, status: { type: "string", enum: ["pending","in_progress","completed"] }, date_from: { type: "string" }, date_to: { type: "string" } } } },
  { name: "atualizar_tarefa", description: "Atualiza status ou dados de tarefa", input_schema: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["pending","in_progress","completed"] }, observations: { type: "string" }, due_date: { type: "string" } }, required: ["id"] } },
  { name: "listar_kpis", description: "Lista KPIs de uma empresa", input_schema: { type: "object", properties: { company_id: { type: "string" }, month_year: { type: "string" } }, required: ["company_id"] } },
  { name: "registrar_kpi", description: "Registra lançamento de KPI", input_schema: { type: "object", properties: { company_id: { type: "string" }, salesperson_id: { type: "string" }, kpi_id: { type: "string" }, value: { type: "number" }, entry_date: { type: "string" }, observations: { type: "string" } }, required: ["company_id","salesperson_id","kpi_id","value"] } },
  { name: "listar_vendedores", description: "Lista vendedores de empresa cliente", input_schema: { type: "object", properties: { company_id: { type: "string" }, status: { type: "string", enum: ["active","inactive"] } }, required: ["company_id"] } },
  { name: "listar_reunioes", description: "Lista reuniões de projeto", input_schema: { type: "object", properties: { project_id: { type: "string" }, company_id: { type: "string" }, is_finalized: { type: "boolean" }, date_from: { type: "string" }, date_to: { type: "string" } } } },
];

// ============ TOOLS — CEO ============
const CEO_TOOLS: Anthropic.Tool[] = [
  { name: "consultar_financeiro", description: "Consulta Noah (CFO) sobre dados financeiros da empresa: saldo, caixa, inadimplência, MRR, DRE", input_schema: { type: "object", properties: { pergunta: { type: "string", description: "Pergunta específica para o CFO" } }, required: ["pergunta"] } },
  { name: "consultar_crm", description: "Consulta Sophia (Diretora Comercial) sobre pipeline, leads, conversão e negociações em andamento", input_schema: { type: "object", properties: { pergunta: { type: "string", description: "Pergunta específica sobre comercial" } }, required: ["pergunta"] } },
  { name: "consultar_projetos", description: "Consulta Melissa (Gestora de CS/Projetos) sobre clientes ativos, tarefas, KPIs e risco de churn", input_schema: { type: "object", properties: { pergunta: { type: "string", description: "Pergunta específica sobre projetos e clientes" } }, required: ["pergunta"] } },
];

// ============ SYSTEM PROMPTS ============
const TODAY = new Date().toLocaleDateString("pt-BR");

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

  ceo: `Você é o CEO virtual da UNV Holdings — o orquestrador estratégico. Você consulta Noah (financeiro), Sophia (comercial) e Melissa (projetos/CS) para cruzar dados e dar orientação estratégica ao Fabrício.

Mentalidade dos melhores CEOs do mundo:
- Jeff Bezos: decisões de longo prazo, obsessão com o cliente, dados antes de opinião. "Discorde e comprometa" — não paralise por falta de consenso.
- Steve Jobs: simplicidade e foco. Diga não para 1000 coisas para dizer sim para a que importa.
- Jack Welch: pessoas + estratégia + execução. O CEO que não cuida dos três perde em todos.
- Reed Hastings: transparência radical, cultura como vantagem competitiva. Contexto beats controle.
- Brian Chesky: mentalidade de fundador, obsessão com produto e experiência.
- Larry Fink: gestão de risco sistêmica, visão de portfólio, impacto de longo prazo.
- Elon Musk: raciocínio por primeiros princípios, urgência real, elimine o que não escala.

Como você opera:
1. Consulte os especialistas necessários (não todos — só os relevantes para a pergunta)
2. Cruze os dados: financeiro + comercial + operacional = visão estratégica real
3. Sempre entregue 3 coisas: situação atual, principal risco, ação recomendada
4. Nunca seja operacional — você orienta, não executa
5. Seja direto: uma recomendação clara vale mais que 5 opções vagas

Regras: sem "Perfeito!", sem emojis excessivos, linguagem direta e estratégica. Data: ${TODAY}`,
};

const AGENT_API_KEYS: Record<AgentType, string> = {
  financeiro: NEXUS_KEY_FINANCEIRO,
  crm: NEXUS_KEY_DIRETOR,
  projetos: NEXUS_KEY_DIRETOR,
  ceo: NEXUS_KEY_DIRETOR,
};

const AGENT_TOOLS: Record<AgentType, Anthropic.Tool[]> = {
  financeiro: FINANCIAL_TOOLS,
  crm: CRM_TOOLS,
  projetos: PROJECT_TOOLS,
  ceo: CEO_TOOLS,
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
  const res = await fetch(url.toString(), { headers: { "x-api-key": apiKey, "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Nexus GET ${res.status}: ${await res.text()}`);
  return res.json();
}

async function nexusPost(url: string, body: Record<string, unknown>, apiKey: string): Promise<unknown> {
  const res = await fetch(url, { method: "POST", headers: { "x-api-key": apiKey, "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Nexus POST ${res.status}: ${await res.text()}`);
  return res.json();
}

// ============ EXECUÇÃO DE TOOLS ============
async function executeTool(toolName: string, input: Record<string, unknown>, agentType: AgentType): Promise<string> {
  const apiKey = AGENT_API_KEYS[agentType];
  const FIN = `${NEXUS_URL}/financial-api`;
  const SYS = `${NEXUS_URL}/system-api`;

  try {
    let result: unknown;
    switch (toolName) {
      // FINANCEIRO
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
      // CRM
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
      // PROJETOS
      case "listar_empresas": { const p: Record<string,string> = { module: "companies", action: "list" }; if (input.status) p.status = input.status as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "detalhes_empresa": result = await nexusGet(SYS, { module: "companies", action: "get", id: input.id as string }, apiKey); break;
      case "listar_projetos": { const p: Record<string,string> = { module: "projects", action: "list" }; if (input.status) p.status = input.status as string; if (input.company_id) p.company_id = input.company_id as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "listar_tarefas": { const p: Record<string,string> = { module: "tasks", action: "list" }; if (input.project_id) p.project_id = input.project_id as string; if (input.status) p.status = input.status as string; if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "atualizar_tarefa": { const { id, ...b } = input; result = await nexusPost(`${SYS}?module=tasks&action=update&id=${id}`, b, apiKey); break; }
      case "listar_kpis": { const p: Record<string,string> = { module: "kpis", action: "list", company_id: input.company_id as string }; if (input.month_year) p.month_year = input.month_year as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "registrar_kpi": result = await nexusPost(`${SYS}?module=kpis&action=create_entry`, input, apiKey); break;
      case "listar_vendedores": { const p: Record<string,string> = { module: "salespeople", action: "list", company_id: input.company_id as string }; if (input.status) p.status = input.status as string; result = await nexusGet(SYS, p, apiKey); break; }
      case "listar_reunioes": { const p: Record<string,string> = { module: "project_meetings", action: "list" }; if (input.project_id) p.project_id = input.project_id as string; if (input.company_id) p.company_id = input.company_id as string; if (input.is_finalized !== undefined) p.is_finalized = String(input.is_finalized); if (input.date_from) p.date_from = input.date_from as string; if (input.date_to) p.date_to = input.date_to as string; result = await nexusGet(SYS, p, apiKey); break; }
      // CEO — chama sub-agentes
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

// ============ TELEGRAM ============
async function sendTelegram(chatId: number, text: string, agentType: AgentType): Promise<void> {
  const token = TELEGRAM_TOKENS[agentType];
  if (!token) return;
  const safe = text.length > 4000 ? text.slice(0, 3990) + "…" : text;
  // Tenta com Markdown, fallback para texto plano se falhar
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
  if (req.method === "GET") {
    const dbg = new URL(req.url).searchParams.get("debug") as AgentType | null;
    if (dbg && ["financeiro","crm","projetos","ceo"].includes(dbg)) {
      try {
        const reply = await callAgent(dbg, "qual sua função e o que você consegue fazer?");
        return new Response(JSON.stringify({ ok: true, agent: dbg, reply: reply.slice(0, 500) }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, agent: dbg, error: String(err) }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ ok: true, version: "2.0-ceo" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const body = await req.json();

    // ── TELEGRAM ──
    if (body.message) {
      const chatId: number = body.message.chat?.id;
      const text: string = body.message.text ?? "";
      if (!text.trim() || !chatId) return new Response("OK", { status: 200 });

      const agentParam = new URL(req.url).searchParams.get("agent") as AgentType | null;
      const agentType = agentParam ?? detectAgent(text);
      if (!agentType) return new Response("OK", { status: 200 });

      EdgeRuntime.waitUntil((async () => {
        try {
          const reply = await callAgent(agentType, text);
          await sendTelegram(chatId, reply, agentType);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const isRate = msg.includes("rate_limit") || msg.includes("429");
          await sendTelegram(chatId, isRate ? "Muitas consultas simultâneas. Aguarda 30s e tenta de novo." : `Erro ao processar: ${msg.slice(0, 200)}`, agentType);
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

    const text: string = data.message?.conversation || data.message?.extendedTextMessage?.text || "";
    const from: string = (data.key?.addressingMode === "lid" && data.key?.remoteJidAlt) ? data.key.remoteJidAlt : (data.key?.remoteJid ?? "");
    if (!text.trim() || !from) { EdgeRuntime.waitUntil(forwardToEvolutionWebhook(body)); return new Response("OK", { status: 200 }); }

    const agentType = detectAgent(text);
    if (!agentType) { EdgeRuntime.waitUntil(forwardToEvolutionWebhook(body)); return new Response("OK", { status: 200 }); }

    EdgeRuntime.waitUntil((async () => {
      try {
        const reply = await callAgent(agentType, text);
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
