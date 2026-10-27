// ai-team-orchestrator: o "Max" — coordenador do Time de IA da empresa.
// Decide quais especialistas rodam agora, executa cada um, grava a rodada em
// ai_team_runs, deixa anúncios/posts/mensagens na fila ai_team_approvals e
// fecha com um briefing único pro dono (opcionalmente no WhatsApp).
//
// Modos (body):
//   {scheduled:true}                 -> CRON (30/30 min): roda os agentes cujo horário bate com o slot
//                                        atual (BRT) e ainda não rodaram hoje. Exige anon/service role.
//   {companyId}                      -> MANUAL: roda todos os especialistas rodáveis da empresa agora.
//   {companyId, agentKey}            -> MANUAL: roda só aquele agente.
// Chamada manual exige JWT de alguém com acesso à empresa (ai_team_has_access) ou a service role.
//
// Dados: cada agente recebe o "contexto" de buildContext() (shared.ts). Por padrão só KPIs;
// com config.dados = "nexus_unv" no orquestrador, o contexto vem do próprio Nexus da UNV.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  corsHeaders, SUPABASE_URL, SERVICE_KEY, type Agent, type AgentKey, type Company, type Ctx,
  brNow, brToday, brNowSlot, brl, json, jwtRole, askClaude, parseJson, sendWhatsApp, buildContext, dadosBlock, REGRAS,
} from "./shared.ts";

type RunResult = { status: "done" | "skipped" | "error"; summary: string; output?: any; approvals?: { kind: string; title: string; payload: any }[] };

// Agentes que trabalham por rodada. Lia (atendimento) é de canal: age quando chega mensagem.
const RUNNABLE: AgentKey[] = ["briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"];
const CHANNEL_NOTE: Partial<Record<AgentKey, string>> = {
  atendimento: "Agente de canal: responde quando chega Direct ou WhatsApp no CRM, não em rodada.",
};

// ───────────────────────── especialistas ─────────────────────────

/** Briefing da manhã com os dados reais (Sophia). */
async function runBriefing(ctx: Ctx, agent: Agent, pendingApprovals: number): Promise<RunResult> {
  const dados = ctx.modo === "nexus_unv"
    ? dadosBlock(ctx, ["financeiro", "comercial", "carteira", "trafego"])
    : (ctx.kpis || "Nenhum KPI lançado.");
  const prompt = `Você é ${agent.name}, responsável pelo resumo diário no Time de IA da ${ctx.empresa}. Escreva o briefing da manhã pro dono.

DADOS DE HOJE:
${dados}
${pendingApprovals > 0 ? `\nFila do time: ${pendingApprovals} item(ns) esperando aprovação do dono.` : ""}

${REGRAS}
Formato: 8 a 12 linhas curtas, sem título nem cabeçalho. Comece pelo dinheiro (entrou x esperado, o que está vencido), depois comercial (leads, reuniões, fechamentos), depois carteira (churn, risco). Aponte os 2 pontos que mais merecem atenção e feche com 1 ação concreta pra HOJE, dizendo QUAL PESSOA DO TIME faz (financeiro, CS, pré-vendas, closer): você não liga, não cobra nem executa nada, só lê e orienta. Se um dado estiver vazio, diga que está vazio e o que falta lançar.`;
  const text = await askClaude(prompt, { maxTokens: 700, agent: "briefing" });
  return { status: "done", summary: text, output: { modo: ctx.modo } };
}

/** 3 anúncios pra aprovação, apoiado no que já funciona (Rafa). */
async function runAnuncios(ctx: Ctx, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, criador de anúncios do Time de IA. Crie 3 anúncios Meta Ads (Instagram/Facebook) diferentes entre si para a empresa abaixo.

${ctx.oferta}

${ctx.modo === "nexus_unv" ? dadosBlock(ctx, ["trafego", "comercial", "catalogo"]) : ctx.kpis}

Use os dados: se uma campanha ou origem já traz lead barato, faça pelo menos 1 anúncio no mesmo ângulo dela; se o CPL está alto, proponha um ângulo diferente e diga por quê no campo "racional". Não cite preço no texto do anúncio a menos que a oferta diga explicitamente que o preço é o gancho. NUNCA cite nome de cliente, lead ou pessoa no anúncio (prova social sem nome: "uma empresa de X", "um cliente do setor Y").
Cada anúncio com ângulo distinto (dor, prova/autoridade, oferta direta). Responda SOMENTE com JSON:
[{"angulo":"...","headline":"até 40 caracteres","texto":"texto principal de 3 a 5 linhas, sem emoji","cta":"ex: Saiba mais","publico":"descrição curta do público e interesses","racional":"1 frase: qual dado sustentou esse anúncio"}]`;
  const ads = parseJson<{ angulo: string; headline: string; texto: string; cta: string; publico: string; racional?: string }[]>(
    await askClaude(prompt, { maxTokens: 1600, agent: "anuncios" }),
  );
  const approvals = ads.slice(0, 3).map((ad) => ({ kind: "ad", title: ad.headline, payload: ad }));
  return { status: "done", summary: `Deixei ${approvals.length} anúncios prontos pra você aprovar, apoiados no tráfego dos últimos 30 dias.`, output: { ads }, approvals };
}

/** 3 posts (gancho, legenda, formato) a partir do que o comercial está vivendo (Mika). */
async function runConteudo(ctx: Ctx, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, responsável por conteúdo e social no Time de IA. Proponha 3 posts pro Instagram da empresa abaixo, pensados pra gerar conversa com cliente (não só curtida).

${ctx.oferta}

${ctx.modo === "nexus_unv" ? dadosBlock(ctx, ["comercial", "carteira", "trafego"]) : ctx.kpis}

Use os dados como matéria-prima, não como manchete: motivos de churn viram pauta de "como evitar"; fechamentos recentes viram prova (sem citar nome de cliente); origem que mais traz lead diz qual tema o público está respondendo. NUNCA exponha número interno da empresa no post (quantidade de clientes que saíram, reuniões canceladas, faturamento, churn) — isso é bastidor, não conteúdo. Não cite valores em reais no post.
Responda SOMENTE com JSON:
[{"formato":"reels|carrossel|estático","gancho":"primeira frase que segura a atenção","legenda":"legenda completa, sem emoji, com CTA no final","objetivo":"o que esse post deve gerar","racional":"1 frase: qual dado inspirou"}]`;
  const posts = parseJson<{ formato: string; gancho: string; legenda: string; objetivo: string; racional?: string }[]>(
    await askClaude(prompt, { maxTokens: 1600, agent: "conteudo" }),
  );
  const approvals = posts.slice(0, 3).map((p) => ({ kind: "post", title: p.gancho, payload: p }));
  return { status: "done", summary: `Separei ${approvals.length} posts pra semana a partir do que o comercial está vivendo.`, output: { posts }, approvals };
}

/** Mensagens de reativação pra leads parados e clientes que saíram, com nome real (Theo). */
async function runReativacao(ctx: Ctx, agent: Agent): Promise<RunResult> {
  if (ctx.modo !== "nexus_unv" || (!ctx.leadsParados.length && !ctx.clientesPerdidos.length)) {
    const prompt = `Você é ${agent.name}, responsável por reativação no Time de IA. Escreva 3 mensagens de WhatsApp pra reativar contatos parados da empresa abaixo: uma pra cliente antigo que sumiu, uma pra lead que pediu orçamento e não fechou, uma pra quem comprou uma vez e não voltou.

${ctx.oferta}

${REGRAS} Tom de quem escreve do próprio celular, 3 a 4 linhas, termina com pergunta fácil de responder. Use {{nome}} no lugar do nome. Responda SOMENTE com JSON:
[{"alvo":"...","mensagem":"..."}]`;
    const msgs = parseJson<{ alvo: string; mensagem: string }[]>(await askClaude(prompt, { maxTokens: 900, agent: "reativacao" }));
    const approvals = msgs.slice(0, 3).map((m) => ({ kind: "message", title: `Reativação: ${m.alvo}`, payload: m }));
    return { status: "done", summary: `Montei ${approvals.length} mensagens de reativação (modelo, sem CRM ligado).`, output: { msgs }, approvals };
  }

  const leads = ctx.leadsParados.slice(0, 4);
  const perdidos = ctx.clientesPerdidos.filter((c) => c.motivo !== "Repassou a empresa").slice(0, 2);
  const prompt = `Você é ${agent.name}, responsável por reativação no Time de IA da ${ctx.empresa}. Escreva UMA mensagem de WhatsApp pra cada contato abaixo, como se o dono estivesse mandando do próprio celular.

${ctx.oferta}

LEADS PARADOS (sem contato há mais de 30 dias):
${leads.map((l, i) => `${i + 1}. ${l.name} — funil ${l.pipeline}, etapa "${l.stage}", ${l.dias} dias sem atividade${l.valor ? `, oportunidade ${brl(l.valor)}` : ""}${l.origem ? `, origem ${l.origem}` : ""}`).join("\n")}

CLIENTES QUE SAÍRAM (últimos 90 dias):
${perdidos.map((c, i) => `${leads.length + i + 1}. ${c.nome} — saiu em ${c.mes}, motivo registrado: ${c.motivo}`).join("\n") || "nenhum"}

${REGRAS} 3 a 4 linhas cada, use o primeiro nome da pessoa (se for razão social, use só o nome fantasia curto, sem LTDA), mencione o contexto real (etapa do funil ou motivo da saída) sem parecer que leu uma ficha, ofereça um motivo concreto pra conversa (uma novidade, um resultado recente, uma ideia pro negócio dela) e termine com UMA pergunta fácil de responder. Nada de "a porta está aberta" ou "se fizer sentido": quem reativa propõe, não espera. Pra quem saiu por insatisfação, reconheça em uma frase, sem se justificar. Responda SOMENTE com JSON, na mesma ordem:
[{"numero":1,"mensagem":"..."}]`;
  const msgs = parseJson<{ numero: number; mensagem: string }[]>(await askClaude(prompt, { maxTokens: 1400, agent: "reativacao" }));
  const alvos = [
    ...leads.map((l) => ({ tipo: "lead", id: l.id, nome: l.name, contexto: `${l.pipeline} · ${l.stage} · ${l.dias}d parado` })),
    ...perdidos.map((c) => ({ tipo: "cliente", id: null as string | null, nome: c.nome, contexto: `saiu em ${c.mes} · ${c.motivo}` })),
  ];
  const approvals = msgs.filter((m) => alvos[m.numero - 1]).map((m) => {
    const a = alvos[m.numero - 1];
    return { kind: "message", title: `${a.tipo === "lead" ? "Lead parado" : "Cliente que saiu"}: ${a.nome}`, payload: { alvo: a.nome, tipo: a.tipo, lead_id: a.id, contexto: a.contexto, mensagem: m.mensagem } };
  });
  return { status: "done", summary: `Montei ${approvals.length} mensagens com nome: ${leads.length} leads parados e ${perdidos.length} clientes que saíram.`, output: { alvos }, approvals };
}

/** Leitura do tráfego: o que traz lead barato, o que queima verba (Luna). */
async function runTrafego(ctx: Ctx, agent: Agent): Promise<RunResult> {
  if (ctx.modo !== "nexus_unv") return { status: "skipped", summary: "Sem conta Meta ligada a este time ainda." };
  if (!ctx.campanhas.length) return { status: "done", summary: "Nenhuma campanha da Meta sincronizada nos últimos 30 dias. Nada pra analisar." };
  const prompt = `Você é ${agent.name}, analista de tráfego do Time de IA da ${ctx.empresa}. Leia as campanhas e devolva o veredito.

${dadosBlock(ctx, ["trafego", "comercial"])}

${REGRAS} 5 a 8 linhas, sem título: qual campanha merece mais verba (e por quê), qual está queimando dinheiro (gasto sem lead ou CPL fora da curva), e 1 ajuste concreto pra fazer hoje (pausar, realocar, trocar criativo). Compare CPL entre campanhas. Se faltar dado de lead, diga que a campanha pode estar otimizada pra conversa e não pra formulário.`;
  const text = await askClaude(prompt, { maxTokens: 600, agent: "trafego" });
  return { status: "done", summary: text, output: { campanhas: ctx.campanhas } };
}

/** Leads das últimas 24h: quem está sem dono ou sem contato (Júlia). */
async function runQualificacao(ctx: Ctx, agent: Agent): Promise<RunResult> {
  if (ctx.modo !== "nexus_unv") return { status: "skipped", summary: "Sem CRM ligado a este time ainda." };
  const novos = ctx.leadsNovos;
  if (!novos.length) return { status: "done", summary: "Nenhum lead novo nas últimas 24 horas." };
  const semDono = novos.filter((l) => l.semDono);
  const semContato = novos.filter((l) => l.semAtividade);
  const prompt = `Você é ${agent.name}, responsável por qualificação no Time de IA da ${ctx.empresa}. Chegaram ${novos.length} leads nas últimas 24h.

LEADS:
${novos.slice(0, 20).map((l) => `- ${l.name} — funil ${l.pipeline}${l.origem ? `, origem ${l.origem}` : ""}, há ${l.horas}h${l.semDono ? ", SEM DONO" : ""}${l.semAtividade ? ", SEM CONTATO" : ""}`).join("\n")}

${REGRAS} 4 a 7 linhas: quantos chegaram, quantos sem dono e sem contato, quais 3 devem ser ligados primeiro (nome + motivo curto: origem quente, funil de maior ticket, mais tempo esperando) e 1 recado pro time de pré-vendas.`;
  const text = await askClaude(prompt, { maxTokens: 500, agent: "qualificacao" });
  return { status: "done", summary: text, output: { total: novos.length, semDono: semDono.length, semContato: semContato.length, leads: novos.slice(0, 20) } };
}

async function runAgent(ctx: Ctx, agent: Agent, pendingApprovals: number): Promise<RunResult> {
  switch (agent.agent_key) {
    case "briefing": return runBriefing(ctx, agent, pendingApprovals);
    case "anuncios": return runAnuncios(ctx, agent);
    case "conteudo": return runConteudo(ctx, agent);
    case "reativacao": return runReativacao(ctx, agent);
    case "trafego": return runTrafego(ctx, agent);
    case "qualificacao": return runQualificacao(ctx, agent);
    default: return { status: "skipped", summary: CHANNEL_NOTE[agent.agent_key] || "Agente sem rodada." };
  }
}

// ───────────────────────── Max (orquestrador) ─────────────────────────

async function orchestrate(
  supabase: SupabaseClient, c: Company, agents: Agent[],
  opts: { trigger: "manual" | "cron"; only?: AgentKey | null },
) {
  const today = brToday();
  const slot = brNowSlot();
  const dow = brNow().getDay();
  const byKey = new Map(agents.map((a) => [a.agent_key, a]));
  const max = byKey.get("orquestrador");

  // quem roda agora
  const { data: todayRuns } = await supabase.from("ai_team_runs").select("agent_key")
    .eq("company_id", c.id).eq("status", "done").gte("started_at", `${today}T00:00:00-03:00`);
  const ranToday = new Set(((todayRuns || []) as any[]).map((r) => r.agent_key));

  const selected = agents.filter((a) => {
    if (a.agent_key === "orquestrador" || !a.is_active) return false;
    if (opts.only) return a.agent_key === opts.only;
    if (opts.trigger === "manual") return RUNNABLE.includes(a.agent_key);
    if (!a.schedule?.hour) return false;
    if (a.schedule.hour !== slot) return false;
    if (a.schedule.days?.length && !a.schedule.days.includes(dow)) return false;
    return !ranToday.has(a.agent_key);
  });
  if (!selected.length) return { company: c.name, ran: [], skipped: "nada agendado pra este horário" };

  const { data: maxRun } = await supabase.from("ai_team_runs")
    .insert({ company_id: c.id, agent_key: "orquestrador", trigger: opts.trigger, status: "running" }).select("id").single();

  const { count: pendingCount } = await supabase.from("ai_team_approvals")
    .select("id", { count: "exact", head: true }).eq("company_id", c.id).eq("status", "pending");

  let ctx: Ctx;
  try {
    ctx = await buildContext(supabase, c, agents);
  } catch (e) {
    await supabase.from("ai_team_runs").update({ status: "error", error: `contexto: ${(e as Error).message}`, finished_at: new Date().toISOString() }).eq("id", maxRun?.id);
    return { company: c.name, ran: [], error: `contexto: ${(e as Error).message}` };
  }

  const results: { agent: Agent; result: RunResult }[] = [];
  for (const agent of selected) {
    const { data: run } = await supabase.from("ai_team_runs")
      .insert({ company_id: c.id, agent_key: agent.agent_key, trigger: opts.trigger, status: "running" }).select("id").single();
    let result: RunResult;
    try {
      result = await runAgent(ctx, agent, pendingCount || 0);
    } catch (e) {
      result = { status: "error", summary: `Falhou: ${(e as Error).message}` };
    }
    if (result.approvals?.length) {
      await supabase.from("ai_team_approvals").insert(result.approvals.map((ap) => ({
        company_id: c.id, agent_key: agent.agent_key, run_id: run?.id, kind: ap.kind, title: ap.title, payload: ap.payload,
      })));
    }
    await supabase.from("ai_team_runs").update({
      status: result.status, summary: result.summary, output: result.output ?? null,
      error: result.status === "error" ? result.summary : null, finished_at: new Date().toISOString(),
    }).eq("id", run?.id);
    if (result.status === "done") {
      await supabase.from("ai_team_agents").update({ last_run_at: new Date().toISOString() }).eq("id", agent.id);
    }
    results.push({ agent, result });
  }

  // briefing do Max: consolida a rodada em poucas linhas pro dono
  const novasAprovacoes = results.reduce((s, r) => s + (r.result.approvals?.length || 0), 0);
  const relato = results.map((r) => `- ${r.agent.name} (${r.agent.role_title}): [${r.result.status}] ${r.result.summary.slice(0, 500)}`).join("\n");
  let maxText = "";
  try {
    maxText = await askClaude(`Você é ${max?.name || "Max"}, coordenador do Time de IA da ${c.name}. O time acabou de rodar. Escreva o recado pro dono: o que cada um entregou, o que está esperando a decisão dele e o que você, como coordenador, acha que ele deve olhar primeiro.

Rodada:
${relato}
${novasAprovacoes ? `\n${novasAprovacoes} item(ns) novos entraram na fila de aprovação.` : ""}

${REGRAS} 4 a 6 linhas, sem repetir o texto dos agentes na íntegra, sem saudação longa, sem assinatura. Se algo falhou, diga sem rodeio.`, { maxTokens: 450, agent: "orquestrador" });
  } catch (e) {
    maxText = `Rodada concluída: ${results.map((r) => `${r.agent.name} ${r.result.status}`).join(", ")}. (${(e as Error).message})`;
  }

  let whatsapp: boolean | null = null;
  if (max?.config?.send_whatsapp && c.phone) {
    const number = c.phone.replace(/\D/g, "");
    whatsapp = await sendWhatsApp(supabase, number.startsWith("55") ? number : `55${number}`, `*Time de IA · ${c.name}*\n\n${maxText}`);
  }

  await supabase.from("ai_team_runs").update({
    status: "done", summary: maxText, finished_at: new Date().toISOString(),
    output: { ran: results.map((r) => ({ agent: r.agent.agent_key, status: r.result.status })), novasAprovacoes, whatsapp, modo: ctx.modo },
  }).eq("id", maxRun?.id);
  if (max) await supabase.from("ai_team_agents").update({ last_run_at: new Date().toISOString() }).eq("id", max.id);

  return {
    company: c.name, modo: ctx.modo, maxText, novasAprovacoes, whatsapp,
    ran: results.map((r) => ({ agent: r.agent.agent_key, name: r.agent.name, status: r.result.status, summary: r.result.summary })),
  };
}

// ───────────────────────── handler ─────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const role = jwtRole(token);

    let companyIds: string[] = [];
    let trigger: "manual" | "cron" = "manual";

    if (body.scheduled === true) {
      // cron do projeto chama com a anon key (padrão dos outros crons); service role também vale.
      // O gateway já validou a assinatura do JWT (verify_jwt), então basta olhar o papel.
      // Modo agendado é idempotente (1 rodada por agente/dia), então não há o que abusar.
      if (!["anon", "service_role"].includes(role)) return json({ error: "cron exige chave do projeto" }, 401);
      trigger = "cron";
      const { data } = await supabase.from("ai_team_agents").select("company_id")
        .eq("agent_key", "orquestrador").eq("is_active", true);
      companyIds = Array.from(new Set(((data || []) as any[]).map((r) => r.company_id)));
    } else {
      if (!body.companyId) return json({ error: "companyId obrigatório" }, 400);
      if (role !== "service_role") {
        // quem chama precisa ter acesso à empresa — checado com o JWT do próprio usuário
        // (apikey = service role só pra passar no gateway; o Authorization do usuário é o que manda no RLS)
        const asUser = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await asUser.auth.getUser(token);
        if (!user) return json({ error: "não autenticado" }, 401);
        // mesma regra da RLS: cliente da empresa, staff alocado, ou master/admin
        const { data: ok } = await asUser.rpc("ai_team_has_access", { p_company_id: body.companyId });
        if (!ok) return json({ error: "sem acesso à empresa" }, 403);
      }
      companyIds = [body.companyId];
    }

    const results: any[] = [];
    for (const companyId of companyIds) {
      const { data: c } = await supabase.from("onboarding_companies").select("id, name, segment, phone").eq("id", companyId).maybeSingle();
      if (!c) continue;
      const { data: agents } = await supabase.from("ai_team_agents").select("*").eq("company_id", companyId);
      if (!agents?.length) { results.push({ company: c.name, skipped: "time não montado" }); continue; }
      results.push(await orchestrate(supabase, c as Company, agents as Agent[], { trigger, only: body.agentKey || null }));
    }
    return json({ ok: true, trigger, slot: brNowSlot(), results });
  } catch (e) {
    console.error("ai-team-orchestrator", e);
    return json({ error: (e as Error).message }, 500);
  }
});
