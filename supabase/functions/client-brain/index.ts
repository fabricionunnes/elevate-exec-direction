// client-brain: o CÉREBRO DO CLIENTE — consolida tudo que se sabe de um
// projeto (reuniões/transcrições, WhatsApp dos grupos via Marcelo, dossiê
// vivo, KPIs vs meta, entregas, saúde, NPS) num estado vivo com promessas,
// riscos e próximas ações. Objetivo: o consultor abre e em 10 segundos sabe
// o momento do cliente e o que fazer pra segurar/expandir (churn zero).
// Cache de 12h em client_brain; body {projectId, force?}.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-6";
const CACHE_HOURS = 12;

function truncate(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { projectId, force } = await req.json();
    if (!projectId) return json({ error: "projectId obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache
    const { data: cached } = await supabase
      .from("client_brain")
      .select("brain, generated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!force && cached && Date.now() - new Date(cached.generated_at).getTime() < CACHE_HOURS * 3600_000) {
      return json({ brain: cached.brain, generated_at: cached.generated_at, cached: true });
    }

    // ── Projeto + empresa ────────────────────────────────────────────────
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("*, company:onboarding_companies(id, name, segment)")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return json({ error: "Projeto não encontrado" }, 404);
    const companyId = project.onboarding_company_id;

    const now = new Date();
    const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();

    // ── Reuniões (últimos 90d, com transcrição/notas) ───────────────────
    const { data: meetings } = await supabase
      .from("onboarding_meeting_notes")
      .select("meeting_title, meeting_date, notes, transcript, is_no_show, is_internal")
      .eq("project_id", projectId)
      .gte("meeting_date", d90)
      .order("meeting_date", { ascending: false })
      .limit(8);

    // ── Tarefas: atrasadas, concluídas 30d, próximas ─────────────────────
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

    // ── Saúde + eventos ─────────────────────────────────────────────────
    const { data: health } = await supabase
      .from("client_health_scores")
      .select("total_score, risk_level, trend_direction, goals_score, engagement_score, last_calculated_at")
      .eq("project_id", projectId)
      .maybeSingle();

    // ── NPS / CSAT ──────────────────────────────────────────────────────
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

    // ── KPIs: meta vs realizado do mês ──────────────────────────────────
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

    // ── Marcelo (cross-conta): dossiê vivo + conversas recentes ─────────
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
      } catch (_e) {
        // Marcelo indisponível: segue sem WhatsApp
      }
    }

    // ── Contexto pra IA ──────────────────────────────────────────────────
    const ctx = {
      empresa: project.company?.name,
      segmento: project.company?.segment,
      produto_contratado: project.product_name,
      status_projeto: project.status,
      inicio_contrato: project.contract_start ?? project.created_at,
      saude: health,
      resultado_mes: kpiResumo,
      nps_recentes: (nps || []).map((n: any) => ({ nota: n.score, feedback: truncate(n.feedback, 300), quando: n.created_at })),
      csat_recentes: (csat || []).map((c: any) => ({ nota: c.score, comentario: truncate(c.comment, 300), quando: c.created_at })),
      tarefas: {
        atrasadas: overdueTasks.slice(0, 10).map((t: any) => ({ titulo: t.title, vencia_em: t.due_date })),
        concluidas_30d: doneRecent.length,
        proximas: upcoming.map((t: any) => ({ titulo: t.title, vence_em: t.due_date })),
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
  "proximas_acoes": [{ "acao": "ação concreta pro consultor/CS fazer", "motivo": "por quê (ligado a evidência)", "urgencia": "hoje" | "esta_semana" | "este_mes" }],
  "relacionamento": { "ultima_reuniao": "data ou null", "dias_sem_reuniao": número ou null, "whatsapp": "ativo | morno | silencioso", "resumo": "1 frase sobre a qualidade da relação" },
  "citacoes_chave": [{ "quem": "nome", "frase": "citação real e relevante", "quando": "data", "leitura": "o que essa frase significa pro churn" }]
}

Regras: promessas VENCIDAS e riscos vêm primeiro nas listas. Máximo 6 itens por lista. Se não houver dado pra um campo, use lista vazia ou null — NÃO invente. Português do Brasil.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${truncate(await aiResp.text(), 300)}`);
    const aiData = await aiResp.json();
    const raw = aiData.content?.[0]?.text || "{}";
    const brain = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, ""));

    const generatedAt = new Date().toISOString();
    await supabase.from("client_brain").upsert(
      { project_id: projectId, brain, generated_at: generatedAt },
      { onConflict: "project_id" },
    );

    return json({ brain, generated_at: generatedAt, cached: false });
  } catch (error) {
    console.error("client-brain error:", error);
    return json({ error: String(error).slice(0, 300) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
