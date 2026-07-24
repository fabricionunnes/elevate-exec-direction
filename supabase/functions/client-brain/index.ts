// client-brain: o CÉREBRO DO CLIENTE — consolida tudo que se sabe de um
// projeto (reuniões/transcrições, WhatsApp dos grupos via Marcelo, dossiê
// vivo, KPIs vs meta, entregas, saúde, NPS) num estado vivo com promessas,
// riscos e próximas ações. Objetivo: churn zero.
// Modos: {projectId, force?} = gera/retorna 1 (cache 12h);
//        {batch: true}       = renova os mais antigos (cron da madrugada).
// Alerta: termômetro virou "risco_alto" → WhatsApp pro Fabrício.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-6";
const CACHE_HOURS = 12;
const BATCH_STALE_HOURS = 20; // batch renova 1x/dia
const BATCH_LIMIT = 2; // 2×~60s cabe no idle-timeout de 150s do gateway
const ALERT_PHONE = "5531989840003"; // Fabrício

const ACTIVE_STATUSES = [
  "active", "ativo", "cancellation_requested", "cancellation_signaled",
  "notice_period", "sinalizou_cancelamento", "cumprindo_aviso",
];

function truncate(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** WhatsApp pelo mesmo caminho das instâncias do sistema (Stevo/Evolution).
 * Envia SEMPRE pela instância "fabricionunnes" (alerta oficial do Fabrício);
 * fallback pra qualquer conectada só se ela estiver fora. */
async function sendWhatsApp(supabase: SupabaseClient, phone: string, text: string): Promise<boolean> {
  try {
    let { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, api_url, api_key, status, provider_type")
      .eq("instance_name", "fabricionunnes")
      .eq("status", "connected")
      .maybeSingle();
    if (!inst) {
      const { data: fallback } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, api_url, api_key, status, provider_type")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      inst = fallback;
    }
    if (!inst?.api_url || !inst?.api_key) return false;
    let host = "";
    try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
    const isManagerV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
    const url = isManagerV2
      ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text`
      : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key },
      body: JSON.stringify({ number: phone, text }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}


/** Parse tolerante: se a IA truncar o JSON, apara até o último ponto
 * estruturalmente válido e fecha as chaves/colchetes abertos. */
function parseBrainJson(raw: string): Record<string, any> {
  try {
    return JSON.parse(raw);
  } catch {
    // corta a partir do último separador completo e fecha a estrutura
    for (let cut = raw.length; cut > 100; ) {
      const idx = Math.max(raw.lastIndexOf("},", cut - 1), raw.lastIndexOf("],", cut - 1), raw.lastIndexOf('",', cut - 1));
      if (idx <= 0) break;
      let candidate = raw.slice(0, idx + 1);
      let closers = "";
      let inStr = false;
      for (let i = 0; i < candidate.length; i++) {
        const ch = candidate[i];
        if (inStr) {
          if (ch === "\\") i++;
          else if (ch === '"') inStr = false;
        } else if (ch === '"') inStr = true;
        else if (ch === "{") closers = "}" + closers;
        else if (ch === "[") closers = "]" + closers;
        else if (ch === "}" || ch === "]") closers = closers.slice(1);
      }
      candidate = candidate.replace(/,\s*$/, "") + closers;
      try {
        return JSON.parse(candidate);
      } catch {
        cut = idx;
      }
    }
    throw new Error("JSON da IA irrecuperável");
  }
}

interface GenResult {
  brain: Record<string, any>;
  generatedAt: string;
  companyName: string;
  becameHighRisk: boolean;
  autoCompleted: number;
}

/** Palavras significativas (sem acento, >2 letras) pra comparar títulos. */
function significantWords(s: string): Set<string> {
  return new Set(
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2),
  );
}
/** Duas tarefas são "a mesma" se metade das palavras significativas coincide. */
function tasksSimilar(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let inter = 0;
  wa.forEach((w) => { if (wb.has(w)) inter++; });
  return inter / (wa.size + wb.size - inter) >= 0.5;
}

/** Registra como CONCLUÍDAS as tarefas que o time já executou (detectadas no
 * grupo/reuniões pela IA) e que ainda NÃO existem no sistema. Idempotente:
 * a cada rodada, o que já foi registrado é filtrado pela similaridade. */
async function reconcileExecutedTasks(
  supabase: SupabaseClient,
  projectId: string,
  executed: any[],
  generatedAt: string,
): Promise<number> {
  const items = (Array.isArray(executed) ? executed : [])
    .filter((e) => e && typeof e.titulo === "string" && e.titulo.trim().length > 3)
    .slice(0, 12); // trava anti-flood por rodada
  if (items.length === 0) return 0;

  // Todos os títulos de tarefas do projeto (abertas e concluídas) pra dedup.
  const { data: existing } = await supabase
    .from("onboarding_tasks")
    .select("title")
    .eq("project_id", projectId)
    .limit(1000);
  const existingTitles = (existing || []).map((t: any) => t.title || "");

  const rows: Record<string, unknown>[] = [];
  const acceptedTitles: string[] = [];
  for (const e of items) {
    const titulo = String(e.titulo).trim().slice(0, 140);
    // já existe algo parecido no sistema? ou já vamos inserir parecido nesta rodada?
    if (existingTitles.some((t) => tasksSimilar(t, titulo))) continue;
    if (acceptedTitles.some((t) => tasksSimilar(t, titulo))) continue;
    acceptedTitles.push(titulo);
    // data de conclusão: usa a informada se válida, senão a hora da geração
    let completedAt = generatedAt;
    let dueDate = generatedAt.slice(0, 10);
    if (typeof e.quando === "string" && /^\d{4}-\d{2}-\d{2}/.test(e.quando)) {
      dueDate = e.quando.slice(0, 10);
      completedAt = `${dueDate}T12:00:00-03:00`;
    }
    rows.push({
      project_id: projectId,
      title: titulo,
      description: `Detectada como JÁ EXECUTADA pelo time e registrada automaticamente pelo Cérebro do Cliente.\nEvidência: ${truncate(e.evidencia, 500)}`,
      status: "completed",
      completed_at: completedAt,
      due_date: dueDate,
      is_internal: true,
      priority: "medium",
      tags: ["cerebro-executada"],
    });
  }
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("onboarding_tasks").insert(rows as never);
  if (error) {
    console.error("reconcileExecutedTasks insert error:", error.message);
    return 0;
  }
  return rows.length;
}

/** Gera o cérebro de UM projeto e persiste. */
async function generateBrain(supabase: SupabaseClient, projectId: string): Promise<GenResult> {
  const { data: prev } = await supabase
    .from("client_brain")
    .select("brain")
    .eq("project_id", projectId)
    .maybeSingle();
  const prevTermo = (prev?.brain as any)?.termometro || null;

  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("*, company:onboarding_companies(id, name, segment)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Projeto não encontrado");
  const companyId = project.onboarding_company_id;

  const now = new Date();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();

  const { data: meetings } = await supabase
    .from("onboarding_meeting_notes")
    .select("meeting_title, meeting_date, notes, transcript, is_no_show, is_internal")
    .eq("project_id", projectId)
    .gte("meeting_date", d90)
    .order("meeting_date", { ascending: false })
    .limit(8);

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("title, status, due_date, completed_at, is_internal")
    .eq("project_id", projectId)
    .order("due_date", { ascending: false })
    .limit(120);
  const overdueTasks = (tasks || []).filter(
    (t: any) => t.status !== "completed" && t.due_date && new Date(t.due_date) < now,
  );
  const doneRecent = (tasks || []).filter(
    (t: any) => t.status === "completed" && t.completed_at && t.completed_at >= d30,
  );
  const upcoming = (tasks || []).filter(
    (t: any) => t.status !== "completed" && t.due_date && new Date(t.due_date) >= now,
  ).slice(0, 10);
  // Para a IA NÃO sugerir algo que já foi feito ou já está na fila: manda os
  // TÍTULOS do que foi concluído (60d) e de tudo que está em aberto agora.
  const concluidasTitulos = (tasks || [])
    .filter((t: any) => t.status === "completed" && t.completed_at && t.completed_at >= d60)
    .slice(0, 40)
    .map((t: any) => ({ titulo: t.title, concluida_em: t.completed_at }));
  const emAbertoTitulos = (tasks || [])
    .filter((t: any) => t.status !== "completed")
    .slice(0, 40)
    .map((t: any) => t.title);

  const { data: health } = await supabase
    .from("client_health_scores")
    .select("total_score, risk_level, trend_direction, goals_score, engagement_score, last_calculated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  const { data: nps } = await supabase
    .from("onboarding_nps_responses")
    .select("score, feedback, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: csat } = await supabase
    .from("csat_responses")
    .select("score, comment, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(3);

  let kpiResumo: any = null;
  if (companyId) {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const { data: kpis } = await supabase
      .from("company_kpis")
      .select("id, name, target_value, periodicity, kpi_type")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .eq("kpi_type", "monetary");
    if (kpis?.length) {
      const ids = kpis.map((k: any) => k.id);
      const { data: entries } = await supabase
        .from("kpi_entries")
        .select("kpi_id, value")
        .eq("company_id", companyId)
        .in("kpi_id", ids)
        .gte("entry_date", monthStart);
      const realized = (entries || []).reduce((s: number, e: any) => s + (e.value || 0), 0);
      const target = kpis.reduce((s: number, k: any) => {
        if (!k.target_value) return s;
        if (k.periodicity === "daily") return s + k.target_value * daysInMonth;
        if (k.periodicity === "weekly") return s + k.target_value * Math.ceil(daysInMonth / 7);
        return s + k.target_value;
      }, 0);
      const elapsed = now.getDate() / daysInMonth;
      kpiResumo = {
        meta_mes: target,
        realizado: realized,
        projecao_pct: target > 0 && elapsed > 0 ? Math.round(((realized / target) / elapsed) * 100) : null,
        lancamentos: entries?.length || 0,
      };
    }
  }

  // Marcelo (cross-conta): dossiê vivo + conversas recentes
  let dossierMd: string | null = null;
  let waMessages: any[] = [];
  const MARCELO_URL = Deno.env.get("MARCELO_SUPABASE_URL") || "";
  const MARCELO_KEY = Deno.env.get("MARCELO_SERVICE_KEY") || "";
  if (MARCELO_URL && MARCELO_KEY && companyId) {
    const mh = { apikey: MARCELO_KEY, Authorization: `Bearer ${MARCELO_KEY}` };
    try {
      const dRes = await fetch(
        `${MARCELO_URL}/rest/v1/marcelo_company_dossier?select=dossier_md,updated_at&company_id=eq.${companyId}&limit=1`,
        { headers: mh },
      );
      const dossiers = dRes.ok ? await dRes.json() : [];
      dossierMd = dossiers?.[0]?.dossier_md ? truncate(dossiers[0].dossier_md, 7000) : null;

      const gRes = await fetch(
        `${MARCELO_URL}/rest/v1/marcelo_groups?select=group_jid,group_type,group_name&company_id=eq.${companyId}`,
        { headers: mh },
      );
      const groups = gRes.ok ? await gRes.json() : [];
      if (groups.length) {
        const jids = groups.map((g: any) => `"${g.group_jid}"`).join(",");
        const typeByJid = new Map(groups.map((g: any) => [g.group_jid, g.group_type || g.group_name]));
        const mRes = await fetch(
          `${MARCELO_URL}/rest/v1/marcelo_group_messages?select=group_jid,sender_name,message_text,msg_timestamp&group_jid=in.(${jids})&msg_timestamp=gte.${d14}&order=msg_timestamp.desc&limit=200`,
          { headers: mh },
        );
        const msgs = mRes.ok ? await mRes.json() : [];
        waMessages = msgs
          .filter((mm: any) => (mm.message_text || "").trim())
          .map((mm: any) => ({
            grupo: typeByJid.get(mm.group_jid) || "grupo",
            quem: mm.sender_name,
            msg: truncate(mm.message_text, 300),
            quando: mm.msg_timestamp,
          }))
          .reverse();
      }
      // Mastermind UNV: o que o dono desta empresa falou na mesa de donos também
      // alimenta o cérebro (metas declaradas, dores, trocas — material riquíssimo).
      try {
        const mmCtx = await fetch(`${MARCELO_URL}/rest/v1/mastermind_member_context?select=phone,member_name&company_id=eq.${companyId}`, { headers: mh });
        const members = mmCtx.ok ? await mmCtx.json() : [];
        if (members.length) {
          const mmGrp = await fetch(`${MARCELO_URL}/rest/v1/marcelo_groups?select=group_jid&group_type=eq.mastermind&limit=1`, { headers: mh });
          const mg = mmGrp.ok ? await mmGrp.json() : [];
          const mmJid = mg[0]?.group_jid;
          if (mmJid) {
            const last10 = new Set(members.map((m: any) => String(m.phone || "").replace(/\D/g, "").slice(-10)).filter((ph: string) => ph.length === 10));
            const mmRes = await fetch(`${MARCELO_URL}/rest/v1/marcelo_group_messages?select=sender_jid,sender_name,message_text,msg_timestamp&group_jid=eq.${encodeURIComponent(mmJid)}&msg_timestamp=gte.${d14}&order=msg_timestamp.desc&limit=300`, { headers: mh });
            const mmMsgs = mmRes.ok ? await mmRes.json() : [];
            const mine = mmMsgs
              .filter((mm: any) => {
                const ph = String(mm.sender_jid || "").split("@")[0].replace(/\D/g, "").slice(-10);
                return ph.length === 10 && last10.has(ph) && (mm.message_text || "").trim();
              })
              .slice(0, 40)
              .map((mm: any) => ({
                grupo: "Mastermind UNV (mesa de donos)",
                quem: mm.sender_name,
                msg: truncate(mm.message_text, 300),
                quando: mm.msg_timestamp,
              }))
              .reverse();
            waMessages = waMessages.concat(mine);
          }
        }
      } catch (_e) { /* segue sem mastermind */ }
    } catch (_e) {
      // Marcelo indisponível: segue sem WhatsApp
    }
  }

  const ctx = {
    empresa: project.company?.name,
    segmento: project.company?.segment,
    produto_contratado: project.product_name,
    status_projeto: project.status,
    inicio_contrato: project.contract_start_date ?? project.contract_start ?? project.created_at,
    saude: health,
    resultado_mes: kpiResumo,
    nps_recentes: (nps || []).map((n: any) => ({ nota: n.score, feedback: truncate(n.feedback, 300), quando: n.created_at })),
    csat_recentes: (csat || []).map((c: any) => ({ nota: c.score, comentario: truncate(c.comment, 300), quando: c.created_at })),
    tarefas: {
      atrasadas: overdueTasks.slice(0, 10).map((t: any) => ({ titulo: t.title, vencia_em: t.due_date })),
      concluidas_30d: doneRecent.length,
      proximas: upcoming.map((t: any) => ({ titulo: t.title, vence_em: t.due_date })),
      ja_concluidas: concluidasTitulos, // o que JÁ foi feito (não sugerir de novo)
      em_aberto: emAbertoTitulos,       // o que JÁ está na fila (não duplicar)
    },
    reunioes_90d: (meetings || []).map((mm: any) => ({
      titulo: mm.meeting_title,
      data: mm.meeting_date,
      no_show: mm.is_no_show,
      interna: mm.is_internal,
      notas: truncate(mm.notes, 800),
      transcricao: truncate(mm.transcript, 2200),
    })),
    dossie_vivo: dossierMd,
    whatsapp_14d: waMessages,
  };

  const prompt = `Você é o CÉREBRO DO CLIENTE da UNV (diretoria comercial terceirizada). Consolide TUDO abaixo num estado vivo e ACIONÁVEL deste cliente, pensando como um diretor de Customer Success obcecado por churn zero. Seja específico, cite evidências reais (frases, números, datas). Nada genérico.

Dados (JSON):
${JSON.stringify(ctx, null, 2)}

Responda APENAS com JSON válido (sem markdown) neste formato:
{
  "momento": "1 parágrafo direto: onde este cliente está AGORA (resultado, humor, relação com a UNV)",
  "termometro": "seguro" | "atencao" | "risco_alto",
  "termometro_motivo": "1 frase com a evidência principal",
  "promessas": [{ "o_que": "compromisso/promessa feita (pela UNV ou pelo cliente)", "quem": "UNV | cliente", "status": "cumprida" | "pendente" | "vencida", "evidencia": "de onde veio (reunião/whatsapp/tarefa, com data)" }],
  "dores_atuais": ["dores/insatisfações vivas, com evidência curta"],
  "vitorias_recentes": ["vitórias/resultados que devem ser LEMBRADOS ao cliente (anti-churn)"],
  "riscos": [{ "sinal": "sinal de risco de churn", "evidencia": "fato/frase/data", "gravidade": "alta" | "media" | "baixa" }],
  "proximas_acoes": [{ "acao": "ação concreta pro consultor/CS fazer (SÓ o que ainda NÃO foi feito e NÃO está em aberto)", "motivo": "por quê (ligado a evidência)", "urgencia": "hoje" | "esta_semana" | "este_mes" }],
  "relacionamento": { "ultima_reuniao": "data ou null", "dias_sem_reuniao": número ou null, "whatsapp": "ativo | morno | silencioso", "resumo": "1 frase sobre a qualidade da relação" },
  "citacoes_chave": [{ "quem": "nome", "frase": "citação real e relevante", "quando": "data", "leitura": "o que essa frase significa pro churn" }],
  "tarefas_executadas": [{ "titulo": "entrega/tarefa que a UNV JÁ FEZ e comunicou (ex: 'subiu as campanhas de tráfego', 'entregou os criativos', 'montou o funil no CRM', 'treinou o time de vendas')", "quando": "data YYYY-MM-DD da execução ou null", "evidencia": "trecho/mensagem do grupo (ou reunião) que comprova que foi FEITO, com data" }]
}

Regras:
- ANTES de montar "proximas_acoes", leia "tarefas.ja_concluidas" (o que já foi FEITO) e "tarefas.em_aberto" (o que já está na fila). NÃO sugira nenhuma ação que seja igual ou muito parecida (mesma intenção/objetivo) a algo que já está nessas listas — mesmo que as palavras sejam diferentes. Se algo já foi resolvido, ele NÃO é próxima ação; vira, no máximo, uma vitória. Só proponha ações genuinamente novas e ainda pendentes.
- "tarefas_executadas": liste SÓ o que o time da UNV JÁ ENTREGOU/EXECUTOU e comunicou (principalmente no whatsapp_14d dos grupos; reuniões também valem). Regras rígidas: (a) só entregas CONCLUÍDAS — nada de promessa, plano, "vou fazer", "agendado" ou tarefa do cliente; se houver qualquer dúvida se foi realmente feito, NÃO inclua; (b) cada item precisa de evidência real (frase/data) de que foi feito; (c) não repita algo que já esteja em "tarefas.ja_concluidas". Cada título curto e no passado ("Subiu as campanhas", "Entregou os criativos"). Se não houver nada claramente executado, devolva lista vazia.
- promessas VENCIDAS e riscos vêm primeiro nas listas. Máximo 6 itens por lista. Se não houver dado pra um campo, use lista vazia ou null — NÃO invente. Português do Brasil.`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 4500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${truncate(await aiResp.text(), 300)}`);
  const aiData = await aiResp.json();
  const raw = (aiData.content?.[0]?.text || "{}").replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
  const brain = parseBrainJson(raw);

  const generatedAt = new Date().toISOString();
  await supabase.from("client_brain").upsert(
    { project_id: projectId, brain, generated_at: generatedAt },
    { onConflict: "project_id" },
  );

  // Registra no sistema (como concluídas) as tarefas que o time já executou
  // e comunicou no grupo, mas que ninguém tinha lançado ainda.
  let autoCompleted = 0;
  try {
    autoCompleted = await reconcileExecutedTasks(supabase, projectId, brain?.tarefas_executadas, generatedAt);
  } catch (e) {
    console.error("reconcileExecutedTasks falhou:", String(e).slice(0, 160));
  }

  return {
    brain,
    generatedAt,
    autoCompleted,
    companyName: project.company?.name || "Cliente",
    becameHighRisk: brain?.termometro === "risco_alto" && prevTermo !== "risco_alto",
  };
}

function riskAlertText(items: { companyName: string; brain: any }[]): string {
  const lines = items.map(({ companyName, brain }) => {
    const acao = brain?.proximas_acoes?.[0]?.acao ? `\n   → ${truncate(brain.proximas_acoes[0].acao, 160)}` : "";
    return `• *${companyName}*: ${truncate(brain?.termometro_motivo || "risco alto detectado", 180)}${acao}`;
  });
  return `🚨 *Cérebro do Cliente — RISCO ALTO*\n\n${lines.join("\n\n")}\n\nAbra o projeto no Nexus (aba Cérebro) pra ver promessas, riscos e o plano completo.`;
}

// Relatório matinal: tarefas registradas automaticamente (tag cerebro-executada)
// nas últimas 24h, agrupadas por cliente. Vai pro Fabrício e pra Eva.
// Cron: 07:50 BRT seg-sex; feriados nacionais são pulados aqui na função.
const REPORT_PHONES = [
  "5531989840003", // Fabrício
  "5531997667686", // Eva Castanon
];

/** Domingo de Páscoa (algoritmo de Meeus) — base dos feriados móveis. */
function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
/** Feriado nacional brasileiro? Recebe "YYYY-MM-DD" (data BRT). */
function isBrazilHoliday(dateStr: string): boolean {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const mmdd = `${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  if (fixed.includes(mmdd)) return true;
  const easter = easterDate(y);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const offset = (n: number) => { const d = new Date(easter); d.setDate(d.getDate() + n); return key(d); };
  // Carnaval (seg/ter), Sexta-feira Santa, Corpus Christi
  return [offset(-48), offset(-47), offset(-2), offset(60)].includes(dateStr);
}
function brTodayStr(): string {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}-${String(br.getDate()).padStart(2, "0")}`;
}

async function buildExecutedReport(supabase: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("title, completed_at, created_at, project:onboarding_projects(company:onboarding_companies(name))")
    .contains("tags", ["cerebro-executada"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (!tasks || tasks.length === 0) {
    return `*Cérebro do Cliente — ${hoje}*\n\nNenhuma tarefa executada nova foi identificada nos grupos nas últimas 24h.`;
  }

  const byCompany = new Map<string, string[]>();
  for (const t of tasks as any[]) {
    const name = t.project?.company?.name || "Sem empresa";
    if (!byCompany.has(name)) byCompany.set(name, []);
    byCompany.get(name)!.push(truncate(t.title, 120));
  }
  const blocks = [...byCompany.entries()].map(
    ([name, titles]) => `*${name}*\n${titles.map((tt) => `  ✓ ${tt}`).join("\n")}`,
  );
  return `*Cérebro do Cliente — ${hoje}*\n\nTarefas que o time já executou (detectadas nos grupos) e foram registradas como concluídas no sistema:\n\n${blocks.join("\n\n")}\n\nTotal: ${tasks.length}. Todas com a etiqueta cerebro-executada, dentro de cada projeto.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Modo REPORT (cron 07:50 BRT seg-sex): tarefas auto-registradas ──
    if (body.report) {
      const todayBR = brTodayStr();
      if (!body.dry && isBrazilHoliday(todayBR)) {
        return json({ ok: true, skipped: "feriado nacional", date: todayBR });
      }
      const text = await buildExecutedReport(supabase);
      if (body.dry) return json({ ok: true, preview: text, holiday: isBrazilHoliday(todayBR) });
      const phones = body.to === "test" ? [REPORT_PHONES[0]] : REPORT_PHONES;
      const sent: Record<string, boolean> = {};
      for (const phone of phones) {
        sent[phone] = await sendWhatsApp(supabase, phone, text);
      }
      return json({ ok: true, sent });
    }

    // ── Modo BATCH (cron da madrugada): renova os cérebros mais antigos ──
    if (body.batch) {
      const staleBefore = new Date(Date.now() - BATCH_STALE_HOURS * 3600_000).toISOString();
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select("id, client_brain(generated_at)")
        .in("status", ACTIVE_STATUSES);
      const pending = (projects || [])
        .filter((p: any) => {
          const g = p.client_brain?.generated_at ?? p.client_brain?.[0]?.generated_at;
          return !g || g < staleBefore;
        })
        .slice(0, BATCH_LIMIT);

      const results: Record<string, unknown>[] = [];
      const newHighRisk: { companyName: string; brain: any }[] = [];
      for (const p of pending) {
        try {
          const r = await generateBrain(supabase, p.id);
          results.push({ project: p.id, empresa: r.companyName, termometro: r.brain?.termometro, auto_completed: r.autoCompleted });
          if (r.becameHighRisk) newHighRisk.push({ companyName: r.companyName, brain: r.brain });
        } catch (e) {
          results.push({ project: p.id, error: String(e).slice(0, 120) });
        }
      }
      let alerted = false;
      if (newHighRisk.length > 0) {
        alerted = await sendWhatsApp(supabase, ALERT_PHONE, riskAlertText(newHighRisk));
      }
      return json({ ok: true, processed: results.length, results, alerted });
    }

    // ── Modo single: {projectId, force?} ─────────────────────────────────
    const { projectId, force } = body;
    if (!projectId) return json({ error: "projectId obrigatório" }, 400);

    const { data: cached } = await supabase
      .from("client_brain")
      .select("brain, generated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!force && cached && Date.now() - new Date(cached.generated_at).getTime() < CACHE_HOURS * 3600_000) {
      return json({ brain: cached.brain, generated_at: cached.generated_at, cached: true });
    }

    const r = await generateBrain(supabase, projectId);
    if (r.becameHighRisk) {
      await sendWhatsApp(supabase, ALERT_PHONE, riskAlertText([{ companyName: r.companyName, brain: r.brain }]));
    }
    return json({ brain: r.brain, generated_at: r.generatedAt, cached: false, auto_completed: r.autoCompleted });
  } catch (error) {
    console.error("client-brain error:", error);
    return json({ error: String(error).slice(0, 300) }, 500);
  }
});
