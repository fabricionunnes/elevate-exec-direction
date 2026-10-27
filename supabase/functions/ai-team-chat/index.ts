// ai-team-chat: conversa com o Max, coordenador do Time de IA da empresa.
// O Max responde com os mesmos dados reais que o orquestrador lê (buildContext) e tem
// ferramentas pra agir: rodar um agente, aprovar/rejeitar item da fila, ligar/desligar
// ou reconfigurar um agente. Histórico em ai_team_messages (uma thread por empresa).
//
// body: {companyId, message}            -> responde e grava user + assistant
//       {companyId, message, reset:true} -> apaga a thread antes de responder
// Exige JWT com acesso à empresa (ai_team_has_access) ou service role.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  corsHeaders, SUPABASE_URL, SERVICE_KEY, MODEL, type Agent, type Company, type Ctx,
  json, jwtRole, logUsoIA, buildContext, dadosBlock, brNow,
} from "./shared.ts";
import { contaMetaUNV, criarAnuncioPausado, mudarStatus, linkGerenciador } from "./meta.ts";

// contexto de dados vale por 5 min dentro do isolate: a conversa por voz não pode
// esperar as consultas a cada frase (o orquestrador continua pedindo fresco)
const CTX_CACHE_MS = 5 * 60 * 1000;
const LINK_PADRAO = "https://unvholdings.com.br/sessao-estrategica";

const CHAT_MODEL = Deno.env.get("AI_TEAM_CHAT_MODEL") || MODEL;
const MAX_TOOL_ROUNDS = 8;

// Mapa do Nexus pro Max saber onde cada coisa mora antes de consultar.
const MAPA_NEXUS = `MAPA DO NEXUS (Postgres; use consultar(sql) com SELECT; ver_tabelas(busca) mostra colunas):
- Clientes da UNV: onboarding_companies (id, name, status active/inactive, segment, cnpj, phone, consultant_id, cs_id, contract_value). Projetos/contratos: onboarding_projects (id, onboarding_company_id → empresa, product_name, status active/closed/cancellation_signaled, contract_value, contract_start_date, contract_end_date, churn_date, churn_reason, churn_risk, consultant_id, cs_id, current_nps). Time da UNV: onboarding_staff (id, name, role, is_active). Usuários do cliente: onboarding_users (user_id, project_id, role).
- CRM da UNV (tenant_id IS NULL): crm_leads (id, name, phone, pipeline_id, stage_id, opportunity_value, owner_staff_id, closer_staff_id, sdr_staff_id, origin, campaign_name, created_at, last_activity_at, stage_entered_at, loss_reason_id, product_id), crm_pipelines (id, name, tenant_id), crm_stages (id, pipeline_id, name, is_final, final_type won/lost), crm_activities (lead_id, type meeting/call/followup/whatsapp, status pending/completed/cancelled, scheduled_at, responsible_staff_id, notes), crm_loss_reasons. Conversas: crm_conversations / crm_messages, instagram_conversations / instagram_messages.
- Financeiro da UNV: company_invoices (company_id → cliente, description, amount_cents, due_date, status paid/pending/overdue/cancelled, paid_at), financial_receivables (amount, due_date, status, company_id), financial_payables (supplier_name, amount, due_date, status paid/pending/partial, category_id, tenant_id IS NULL), financial_bank_transactions, financial_categories, financial_budgets.
- KPIs dos clientes: company_kpis (id, company_id, name, kpi_type monetary/number, is_active), kpi_entries (company_id, kpi_id, entry_date, value, salesperson_id), company_salespeople (company_id, name, is_active). Metas: kpi_goals se existir (ver_tabelas kpi).
- Saúde/retenção: client_health_scores (project_id, total_score, risk_level, trend_direction), onboarding_nps_responses (score, created_at, project_id), churn_predictions, retention_attempts.
- Tráfego pago: da UNV → crm_meta_ads_campaigns (tenant_id IS NULL: campaign_name, spend, leads, clicks, date_start, date_stop); dos clientes → meta_ads_accounts (project_id, ad_account_name), meta_ads_campaigns (project_id, spend, leads, roas...), trafego_diario (project_id, dia, campaign_name, spend, leads, conversas, receita).
- Serviços e preços: service_catalog. Time de IA: ai_team_agents, ai_team_runs, ai_team_approvals, ai_team_messages.
Regras de consulta: sempre LIMIT; datas com current_date; dinheiro de company_invoices está em centavos (amount_cents/100); nomes de cliente ficam em onboarding_companies.name (junte por onboarding_company_id nos projetos e company_id nas faturas/KPIs); valores de lead em crm_leads.opportunity_value.`;

const TOOLS = [
  {
    name: "consultar",
    description: "Roda um SELECT no banco do Nexus (todas as empresas, financeiro, CRM, KPIs, tráfego, carteira). Use SEMPRE que a pergunta pedir um dado que não está no contexto ou que envolva um cliente específico, um período específico ou um detalhe. Somente leitura, máximo 200 linhas, 10 segundos. Prefira agregações (count, sum, avg) a listas longas.",
    input_schema: {
      type: "object",
      properties: { sql: { type: "string", description: "SELECT/WITH em PostgreSQL, uma consulta, sem ponto e vírgula, com LIMIT" }, motivo: { type: "string", description: "o que você quer descobrir, em uma frase" } },
      required: ["sql"],
    },
  },
  {
    name: "ver_tabelas",
    description: "Procura tabelas e colunas do Nexus por palavra (ex: 'kpi', 'invoice', 'meta', 'nps'). Use antes de consultar uma tabela que não está no mapa, ou quando uma consulta falhar por coluna inexistente.",
    input_schema: { type: "object", properties: { busca: { type: "string" } }, required: ["busca"] },
  },
  {
    name: "rodar_agente",
    description: "Coloca um agente do time pra trabalhar agora. Use quando o dono pedir pra rodar/acionar alguém ou quando a pergunta dele exige uma entrega nova (anúncios, posts, mensagens, análise de tráfego, briefing). Demora de 5 a 60 segundos.",
    input_schema: {
      type: "object",
      properties: { agent_key: { type: "string", enum: ["briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"] } },
      required: ["agent_key"],
    },
  },
  {
    name: "criar_anuncio_meta",
    description: "Cria um anúncio REAL na conta Meta Ads da UNV, PAUSADO: gera a imagem, sobe campanha, conjunto (Brasil, idade, posicionamentos manuais, sem Advantage+), criativo e anúncio. Demora 30 a 60 s. Use só quando o dono mandar criar/subir anúncio. Pode partir de um item aprovado da fila (approval_id) ou de copy nova. Nunca ativa: ativar é ativar_anuncio_meta, só com ordem explícita.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "nome interno da campanha, ex: 'DCT · vendedor figurante · out/26'" },
        headline: { type: "string", description: "título do anúncio, até 40 caracteres" },
        texto: { type: "string", description: "texto principal, 3 a 5 linhas, sem emoji" },
        cta: { type: "string", enum: ["LEARN_MORE", "SIGN_UP", "CONTACT_US", "GET_QUOTE"], description: "botão; padrão LEARN_MORE" },
        link: { type: "string", description: "destino; padrão a página de sessão estratégica da UNV" },
        orcamento_diario: { type: "number", description: "em reais; padrão 50" },
        idade_min: { type: "integer" }, idade_max: { type: "integer" },
        imagem_briefing: { type: "string", description: "cena da foto em 1 frase (ex: 'dono de empresa sozinho na mesa de reunião olhando um painel de metas vazio')" },
        approval_id: { type: "string", description: "id de um anúncio da fila pra reaproveitar headline/texto/cta" },
      },
      required: ["nome", "imagem_briefing"],
    },
  },
  {
    name: "ativar_anuncio_meta",
    description: "Liga (ACTIVE) uma campanha que o Max criou pausada. Só quando o dono mandar ativar explicitamente. Começa a gastar dinheiro.",
    input_schema: { type: "object", properties: { campaign_id: { type: "string" } }, required: ["campaign_id"] },
  },
  {
    name: "pausar_anuncio_meta",
    description: "Pausa uma campanha que o Max criou. Use quando o dono mandar pausar/parar.",
    input_schema: { type: "object", properties: { campaign_id: { type: "string" } }, required: ["campaign_id"] },
  },
  {
    name: "listar_anuncios_meta",
    description: "Lista os anúncios que o Max criou na Meta (status, orçamento, link do Gerenciador).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "ver_negociacoes",
    description: "Lista as negociações abertas do CRM com valor, etapa, dono, dias sem contato e próxima atividade (até 40, da maior pra menor). Use quando o dono falar em meta, bater número, fechar venda, 'preciso vender X', ou perguntar o que tem pra fechar.",
    input_schema: { type: "object", properties: { minimo: { type: "number", description: "filtra por valor mínimo em reais (opcional)" } } },
  },
  {
    name: "ver_fila",
    description: "Lê os itens pendentes de aprovação com o conteúdo completo (texto do anúncio, legenda do post, mensagem). Use antes de opinar sobre um item ou quando o dono perguntar o que tem na fila.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "decidir_item",
    description: "Aprova ou rejeita um item da fila em nome do dono. Só use quando o dono mandar explicitamente (ex: 'aprova o anúncio 2', 'joga fora os posts').",
    input_schema: {
      type: "object",
      properties: {
        approval_id: { type: "string" },
        decisao: { type: "string", enum: ["approved", "rejected"] },
        nota: { type: "string" },
      },
      required: ["approval_id", "decisao"],
    },
  },
  {
    name: "atualizar_agente",
    description: "Liga/desliga um agente, muda o horário dele ou ajusta oferta/público/tom usados nos anúncios, posts e mensagens. Só quando o dono pedir.",
    input_schema: {
      type: "object",
      properties: {
        agent_key: { type: "string", enum: ["atendimento", "briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"] },
        is_active: { type: "boolean" },
        schedule: { type: "object", properties: { hour: { type: "string" }, days: { type: "array", items: { type: "integer" } } } },
        oferta: { type: "string" }, publico: { type: "string" }, tom: { type: "string" },
      },
      required: ["agent_key"],
    },
  },
];

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const agendaLabel = (s: Agent["schedule"]) => !s?.hour ? "por canal / sob demanda" : `${(s.days?.length || 0) >= 6 ? "seg a sáb" : (s.days || []).map((d) => DOW[d]).join(", ")} às ${s.hour}`;
const timeAgo = (iso?: string | null) => {
  if (!iso) return "nunca rodou";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)}h` : `há ${Math.round(m / 1440)}d`;
};

async function loadTeamState(supabase: SupabaseClient, companyId: string) {
  const [agentsR, filaR, runsR] = await Promise.all([
    supabase.from("ai_team_agents").select("*").eq("company_id", companyId),
    supabase.from("ai_team_approvals").select("id, agent_key, kind, title, payload, created_at").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_team_runs").select("agent_key, status, summary, finished_at, started_at").eq("company_id", companyId).order("started_at", { ascending: false }).limit(12),
  ]);
  return { agents: (agentsR.data || []) as Agent[], fila: (filaR.data || []) as any[], runs: (runsR.data || []) as any[] };
}

async function runTool(supabase: SupabaseClient, c: Company, name: string, input: any, userId: string | null, ctx: Ctx): Promise<any> {
  if (name === "criar_anuncio_meta") {
    try {
      let headline = String(input.headline || "").trim(), texto = String(input.texto || "").trim(), cta = String(input.cta || "LEARN_MORE");
      if (input.approval_id) {
        const { data: ap } = await supabase.from("ai_team_approvals").select("payload, title").eq("id", input.approval_id).eq("company_id", c.id).maybeSingle();
        if (ap?.payload) { headline = headline || ap.payload.headline || ap.title; texto = texto || ap.payload.texto || ""; }
      }
      if (!headline || !texto) return { erro: "faltou headline ou texto (ou approval_id de um anúncio da fila)" };
      const conta = await contaMetaUNV(supabase);
      const ids = await criarAnuncioPausado(conta, {
        nome: String(input.nome), headline: headline.slice(0, 40), texto, cta, link: String(input.link || LINK_PADRAO),
        orcamentoDiario: Number(input.orcamento_diario || 50), idadeMin: Number(input.idade_min || 25), idadeMax: Number(input.idade_max || 60),
        imagemBriefing: String(input.imagem_briefing),
      });
      await supabase.from("ai_team_meta_ads").insert({
        company_id: c.id, ad_account_id: conta.ad_account_id, ...ids, headline: headline.slice(0, 40), texto,
        link: String(input.link || LINK_PADRAO), orcamento_diario: Number(input.orcamento_diario || 50), status: "paused", created_by: userId,
      });
      if (input.approval_id) await supabase.from("ai_team_approvals").update({ status: "approved", decided_at: new Date().toISOString(), decided_by: userId, note: `subiu na Meta: campanha ${ids.campaign_id}` }).eq("id", input.approval_id).eq("company_id", c.id);
      return { ok: true, conta: conta.nome, ...ids, status: "PAUSADO", orcamento_diario: Number(input.orcamento_diario || 50), link_gerenciador: linkGerenciador(conta.ad_account_id, ids.campaign_id) };
    } catch (e) {
      return { erro: (e as Error).message };
    }
  }
  if (name === "ativar_anuncio_meta" || name === "pausar_anuncio_meta") {
    const ativar = name === "ativar_anuncio_meta";
    const { data: row } = await supabase.from("ai_team_meta_ads").select("*").eq("company_id", c.id).eq("campaign_id", String(input.campaign_id)).maybeSingle();
    if (!row) return { erro: "campanha não encontrada entre as que o Max criou" };
    try {
      const conta = await contaMetaUNV(supabase);
      await mudarStatus(conta, row, ativar ? "ACTIVE" : "PAUSED");
      await supabase.from("ai_team_meta_ads").update({ status: ativar ? "active" : "paused", activated_at: ativar ? new Date().toISOString() : row.activated_at }).eq("id", row.id);
      return { ok: true, campaign_id: row.campaign_id, status: ativar ? "ATIVA" : "PAUSADA", headline: row.headline, orcamento_diario: row.orcamento_diario, link_gerenciador: linkGerenciador(row.ad_account_id, row.campaign_id) };
    } catch (e) {
      return { erro: (e as Error).message };
    }
  }
  if (name === "listar_anuncios_meta") {
    const { data } = await supabase.from("ai_team_meta_ads").select("campaign_id, headline, status, orcamento_diario, link, created_at, activated_at, ad_account_id").eq("company_id", c.id).order("created_at", { ascending: false }).limit(20);
    return (data || []).map((r: any) => ({ ...r, link_gerenciador: linkGerenciador(r.ad_account_id, r.campaign_id) }));
  }
  if (name === "consultar") {
    const sql = String(input?.sql || "").trim();
    if (!sql) return { erro: "sql vazio" };
    const { data, error } = await supabase.rpc("ai_team_sql", { q: sql });
    if (error) return { erro: error.message, dica: "confira colunas com ver_tabelas; só SELECT, sem ponto e vírgula" };
    const rows = Array.isArray(data) ? data : [];
    return { linhas: rows.length, truncado: rows.length >= 200, dados: rows };
  }
  if (name === "ver_tabelas") {
    const busca = String(input?.busca || "").replace(/[^a-z0-9_ ]/gi, "").trim().toLowerCase();
    if (!busca) return { erro: "busca vazia" };
    const { data, error } = await supabase.rpc("ai_team_sql", { q:
      `select table_name, string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) as colunas
       from information_schema.columns where table_schema = 'public' and (table_name ilike '%${busca.replace(/ /g, "%")}%' or column_name ilike '%${busca.replace(/ /g, "%")}%')
       group by table_name order by table_name limit 40` });
    if (error) return { erro: error.message };
    return data;
  }
  if (name === "ver_negociacoes") {
    const min = Number(input?.minimo || 0);
    return ctx.negociacoes.filter((n) => n.valor >= min).map((n) => ({
      lead_id: n.id, nome: n.name, valor: n.valor, funil: n.pipeline, etapa: n.stage,
      dias_sem_contato: n.dias === 999 ? null : n.dias, dono: n.dono, proxima_atividade: n.proximaAtividade,
    }));
  }
  if (name === "ver_fila") {
    const { fila } = await loadTeamState(supabase, c.id);
    return fila.map((f) => ({ id: f.id, agente: f.agent_key, tipo: f.kind, titulo: f.title, conteudo: f.payload }));
  }
  if (name === "decidir_item") {
    const { data, error } = await supabase.from("ai_team_approvals")
      .update({ status: input.decisao, note: input.nota || "decidido pelo Max no chat", decided_at: new Date().toISOString(), decided_by: userId })
      .eq("id", input.approval_id).eq("company_id", c.id).eq("status", "pending").select("id, title").maybeSingle();
    if (error) return { erro: error.message };
    if (!data) return { erro: "item não encontrado ou já decidido" };
    return { ok: true, item: data.title, status: input.decisao };
  }
  if (name === "atualizar_agente") {
    const { data: ag } = await supabase.from("ai_team_agents").select("id, config, schedule").eq("company_id", c.id).eq("agent_key", input.agent_key).maybeSingle();
    if (!ag) return { erro: "agente não encontrado" };
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof input.is_active === "boolean") patch.is_active = input.is_active;
    if (input.schedule?.hour) patch.schedule = { hour: input.schedule.hour, days: input.schedule.days || ag.schedule?.days || [1, 2, 3, 4, 5] };
    const cfg = { ...(ag.config || {}) };
    for (const k of ["oferta", "publico", "tom"]) if (typeof input[k] === "string") cfg[k] = input[k];
    patch.config = cfg;
    const { error } = await supabase.from("ai_team_agents").update(patch).eq("id", ag.id);
    return error ? { erro: error.message } : { ok: true, agent_key: input.agent_key, alterado: Object.keys(patch).filter((k) => k !== "updated_at") };
  }
  if (name === "rodar_agente") {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-team-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ companyId: c.id, agentKey: input.agent_key }),
    });
    const data = await resp.json().catch(() => ({}));
    const r = data?.results?.[0];
    if (!resp.ok || !r) return { erro: data?.error || `orquestrador respondeu ${resp.status}` };
    if (r.error) return { erro: r.error };
    const ran = (r.ran || [])[0];
    return { ok: true, agente: ran?.name || input.agent_key, status: ran?.status, entrega: ran?.summary, novos_itens_na_fila: r.novasAprovacoes || 0 };
  }
  return { erro: `ferramenta desconhecida: ${name}` };
}

function systemPrompt(c: Company, agents: Agent[], fila: any[], runs: any[], dados: string, donoNome: string | null): string {
  const max = agents.find((a) => a.agent_key === "orquestrador");
  const time = agents.filter((a) => a.agent_key !== "orquestrador").map((a) =>
    `- ${a.name} (${a.role_title}, chave ${a.agent_key}): ${a.is_active ? "ligado" : "DESLIGADO"}, agenda ${agendaLabel(a.schedule)}, última rodada ${timeAgo(a.last_run_at)}`).join("\n");
  const filaTxt = fila.length
    ? fila.map((f) => `- [${f.id}] ${f.kind} de ${agents.find((a) => a.agent_key === f.agent_key)?.name || f.agent_key}: "${f.title}"`).join("\n")
    : "vazia";
  const rodadas = runs.slice(0, 8).map((r) => `- ${agents.find((a) => a.agent_key === r.agent_key)?.name || r.agent_key} (${timeAgo(r.finished_at || r.started_at)}, ${r.status}): ${String(r.summary || "").slice(0, 350)}`).join("\n") || "nenhuma ainda";
  const agora = brNow();
  return `Você é ${max?.name || "Max"}, coordenador do Time de IA da ${c.name}. Você conversa com o dono da empresa${donoNome ? ` (${donoNome})` : ""} como um sócio operador: direto, humano, sem enrolação, sem emoji, sem markdown (nada de #, **, listas com asterisco; se precisar enumerar, use linhas simples com hífen ou números). Português do Brasil. Frases curtas. Você entende de vendas, gestão comercial, marketing e caixa.

Hoje é ${DOW[agora.getDay()]}, ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (Brasília).

SEU TIME:
${time}

FILA DE APROVAÇÃO (itens que o dono ainda não decidiu):
${filaTxt}

ÚLTIMAS RODADAS:
${rodadas}

RESUMO DE HOJE (lido agora do Nexus; é um recorte, não o banco inteiro):
${dados || "nenhum dado além da oferta"}

${MAPA_NEXUS}

Como agir:
- Você tem acesso de leitura a TODO o Nexus: a UNV e todas as empresas clientes. Se a pergunta pede algo que não está no resumo (um cliente específico, um período, um vendedor, uma campanha, um detalhe), use consultar(sql) antes de responder. Não diga "não tenho esse dado" sem antes tentar uma consulta; se a consulta não encontrar, aí sim diga que o dado não está lançado no sistema.
- Responda com número quando tiver número. Nunca invente dado.
- Quando o dono pedir pra alguém do time fazer algo, use rodar_agente e depois conte o que saiu (resuma a entrega, não copie inteira).
- Quando o dono pedir pra aprovar/rejeitar, use ver_fila se precisar achar o item certo e depois decidir_item. Confirme o que fez em uma linha.
- Quando ele perguntar "o que eu faço", opine: escolha, priorize, discorde se for o caso. Você tem opinião.
- Quando ele colocar uma META ("preciso vender 40 mil hoje", "tenho que fechar 3 contratos essa semana"), NÃO responda com teoria: vá nas negociações abertas (estão nos dados; use ver_negociacoes se precisar da lista completa), some quais fecham a meta, diga NOME, VALOR e ETAPA de cada uma, quem está cuidando, e o que fazer AGORA com cada uma (ligar, mandar proposta, cobrar resposta). Ofereça deixar as mensagens prontas pelo Theo ou pelo time.
- Primeiro responda exatamente o que foi perguntado; só depois, se couber, acrescente o que você acha.
- ORDENS DE EXECUÇÃO na Meta: quando o dono mandar criar/subir anúncio, crie de verdade com criar_anuncio_meta (copy do Rafa, de um item da fila ou escrita por você agora, sem nome de cliente, sem preço salvo se ele pedir), SEMPRE pausado, e devolva: headline, orçamento diário, público e o link do Gerenciador. Se ele não disser orçamento, use 50 reais por dia e avise. NUNCA chame ativar_anuncio_meta sem uma ordem explícita de ativar ("ativa", "pode ligar", "sobe pra valer"); se a ordem de criar vier junto com "e ativa", crie, confirme o que criou e pergunte se ativa mesmo. Pausar pode ser imediato quando ele mandar.
- Se ele pedir algo que o time não faz (ligar pra cliente, publicar anúncio na Meta, mandar WhatsApp), diga com clareza que isso ainda é mão humana e deixe pronto o que der (texto, lista, prioridade).
- Respostas de 2 a 8 linhas. Só alongue quando ele pedir detalhe.`;
}

// Em voz alta a conversa precisa caber no ouvido: curto, redondo, sem lista.
const MODO_VOZ = `

MODO VOZ: o dono está falando com você por áudio e vai OUVIR sua resposta. A transcrição pode vir com erro de reconhecimento: interprete pelo contexto ("vender quarenta mil" = meta de R$ 40 mil) e, se ficar em dúvida real, pergunte em uma frase curta. Responda em 1 a 5 frases faladas, como numa ligação: sem lista, sem hífen, sem número com centavos (arredonde: "quarenta e dois mil"), sem sigla sem explicar, sem URL. A primeira frase já tem que ser a resposta, nunca um preâmbulo. Se tiver muita coisa, dê as 2 ou 3 mais importantes e pergunte se ele quer o resto. Quando acionar alguém do time, avise antes em uma frase ("vou pedir pro Theo escrever, me dá uns segundos") e depois conte o resultado em uma ou duas frases.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const role = jwtRole(token);
    if (!body.companyId || !String(body.message || "").trim()) return json({ error: "companyId e message são obrigatórios" }, 400);
    const message = String(body.message).trim().slice(0, 4000);

    let userId: string | null = null;
    let donoNome: string | null = null;
    if (role !== "service_role") {
      const asUser = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await asUser.auth.getUser(token);
      if (!user) return json({ error: "não autenticado" }, 401);
      const { data: ok } = await asUser.rpc("ai_team_has_access", { p_company_id: body.companyId });
      if (!ok) return json({ error: "sem acesso à empresa" }, 403);
      userId = user.id;
      donoNome = (user.user_metadata?.full_name || user.user_metadata?.name || null) as string | null;
    }

    const { data: c } = await supabase.from("onboarding_companies").select("id, name, segment, phone").eq("id", body.companyId).maybeSingle();
    if (!c) return json({ error: "empresa não encontrada" }, 404);
    if (body.reset === true) await supabase.from("ai_team_messages").delete().eq("company_id", c.id);

    const { agents, fila, runs } = await loadTeamState(supabase, c.id);
    if (!agents.length) return json({ error: "time não montado" }, 400);
    const ctx = await buildContext(supabase, c as Company, agents, { cacheMs: CTX_CACHE_MS });
    const dados = ctx.modo === "nexus_unv" ? dadosBlock(ctx, ["financeiro", "comercial", "carteira", "trafego", "catalogo"]) : (ctx.kpis ? dadosBlock(ctx, ["kpis"]) : "") ;
    const system = systemPrompt(c as Company, agents, fila, runs, `${ctx.oferta}\n\n${dados}`, donoNome) + (body.modo === "voz" ? MODO_VOZ : "");

    // histórico (últimas 30 mensagens, ordem cronológica)
    const { data: hist } = await supabase.from("ai_team_messages").select("role, content").eq("company_id", c.id).order("created_at", { ascending: false }).limit(30);
    const messages: any[] = ((hist || []) as any[]).reverse().map((m) => ({ role: m.role, content: m.content }));
    messages.push({ role: "user", content: message });
    await supabase.from("ai_team_messages").insert({ company_id: c.id, user_id: userId, role: "user", content: message });

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);
    const actions: any[] = [];
    let reply = "";
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: CHAT_MODEL, max_tokens: 1200, temperature: 0.7, system, tools: TOOLS, messages }),
      });
      if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
      const data = await resp.json();
      logUsoIA("ai-team-chat", CHAT_MODEL, data?.usage, { company: c.id, round });
      const content = data.content || [];
      const toolUses = content.filter((b: any) => b.type === "tool_use");
      const text = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      if (!toolUses.length || round === MAX_TOOL_ROUNDS) { reply = text || reply || "Feito."; break; }
      messages.push({ role: "assistant", content });
      const results: any[] = [];
      for (const tu of toolUses) {
        const result = await runTool(supabase, c as Company, tu.name, tu.input || {}, userId, ctx);
        actions.push({ tool: tu.name, input: tu.input, result });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result).slice(0, 12000) });
      }
      messages.push({ role: "user", content: results });
    }

    await supabase.from("ai_team_messages").insert({ company_id: c.id, user_id: userId, role: "assistant", content: reply, meta: actions.length ? { actions } : null });
    return json({ ok: true, reply, actions });
  } catch (e) {
    console.error("ai-team-chat", e);
    return json({ error: (e as Error).message }, 500);
  }
});
