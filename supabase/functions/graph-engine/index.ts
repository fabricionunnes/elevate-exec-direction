// graph-engine: Grafo do Cliente — a IA lê tudo que o Nexus sabe do projeto
// (briefing, reuniões/transcrições, WhatsApp dos grupos via Marcelo, tarefas,
// grade curricular, KPIs, NPS/CSAT, Cérebro) e extrai uma rede de nós
// (temas, pessoas, dores, decisões, metas, riscos) com evidências reais
// (trechos citáveis com fonte e data) e arestas justificadas.
// Uso: {projectId, force?} — cache de 12h, force regenera.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-6";
const CACHE_HOURS = 12;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function truncate(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

async function gatherContext(supabase: SupabaseClient, projectId: string) {
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("*, company:onboarding_companies(id, name, segment)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Projeto não encontrado");
  const companyId = project.onboarding_company_id;

  const now = new Date();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  // Briefing completo da empresa (campos preenchidos)
  let briefing: Record<string, unknown> = {};
  if (companyId) {
    const { data: company } = await supabase
      .from("onboarding_companies").select("*").eq("id", companyId).maybeSingle();
    if (company) {
      for (const [k, v] of Object.entries(company)) {
        if (v === null || v === "" || k === "id") continue;
        briefing[k] = typeof v === "string" ? truncate(v, 500) : v;
      }
    }
  }

  const { data: meetings } = await supabase
    .from("onboarding_meeting_notes")
    .select("meeting_title, meeting_date, notes, transcript, is_no_show")
    .eq("project_id", projectId)
    .gte("meeting_date", d90)
    .order("meeting_date", { ascending: false })
    .limit(8);

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("title, status, due_date, completed_at")
    .eq("project_id", projectId)
    .order("due_date", { ascending: false })
    .limit(120);

  const { data: grade } = await supabase
    .from("project_curriculum_items")
    .select("title, status, due_date, source, pillar:curriculum_pillars(name)")
    .eq("project_id", projectId)
    .limit(60);

  const { data: brainRow } = await supabase
    .from("client_brain").select("brain").eq("project_id", projectId).maybeSingle();

  const { data: nps } = await supabase
    .from("onboarding_nps_responses")
    .select("score, feedback, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(3);

  let kpis: any[] = [];
  if (companyId) {
    const { data: kpiRows } = await supabase
      .from("company_kpis")
      .select("name, kpi_type, target_value, periodicity")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .limit(15);
    kpis = kpiRows || [];
  }

  // WhatsApp dos grupos (cross-conta Marcelo), últimos 30 dias
  let waMessages: any[] = [];
  const MARCELO_URL = Deno.env.get("MARCELO_SUPABASE_URL") || "";
  const MARCELO_KEY = Deno.env.get("MARCELO_SERVICE_KEY") || "";
  if (MARCELO_URL && MARCELO_KEY && companyId) {
    const mh = { apikey: MARCELO_KEY, Authorization: `Bearer ${MARCELO_KEY}` };
    try {
      const gRes = await fetch(
        `${MARCELO_URL}/rest/v1/marcelo_groups?select=group_jid,group_type,group_name&company_id=eq.${companyId}`,
        { headers: mh },
      );
      const groups = gRes.ok ? await gRes.json() : [];
      if (groups.length) {
        const jids = groups.map((g: any) => `"${g.group_jid}"`).join(",");
        const typeByJid = new Map(groups.map((g: any) => [g.group_jid, g.group_type || g.group_name]));
        const mRes = await fetch(
          `${MARCELO_URL}/rest/v1/marcelo_group_messages?select=group_jid,sender_name,message_text,msg_timestamp&group_jid=in.(${jids})&msg_timestamp=gte.${d30}&order=msg_timestamp.desc&limit=300`,
          { headers: mh },
        );
        const msgs = mRes.ok ? await mRes.json() : [];
        waMessages = msgs
          .filter((mm: any) => (mm.message_text || "").trim())
          .map((mm: any) => ({
            grupo: typeByJid.get(mm.group_jid) || "grupo",
            quem: mm.sender_name,
            msg: truncate(mm.message_text, 240),
            quando: mm.msg_timestamp,
          }))
          .reverse();
      }
    } catch (_e) { /* Marcelo indisponível: segue sem WhatsApp */ }
  }

  return {
    empresa: (project.company as any)?.name,
    segmento: (project.company as any)?.segment,
    produto_contratado: project.product_name,
    inicio_contrato: project.contract_start ?? project.created_at,
    briefing,
    reunioes_90d: (meetings || []).map((m: any) => ({
      titulo: m.meeting_title,
      data: m.meeting_date,
      no_show: m.is_no_show,
      notas: truncate(m.notes, 700),
      transcricao: truncate(m.transcript, 1400),
    })),
    tarefas: (tasks || []).map((t: any) => ({ t: t.title, s: t.status, vence: t.due_date })),
    grade_curricular: (grade || []).map((g: any) => ({
      item: g.title, pilar: (g.pillar as any)?.name, s: g.status, origem: g.source,
    })),
    kpis,
    nps: (nps || []).map((n: any) => ({ nota: n.score, feedback: truncate(n.feedback, 250), quando: n.created_at })),
    cerebro: brainRow?.brain ?? null,
    whatsapp_30d: waMessages,
  };
}

async function buildGraph(supabase: SupabaseClient, projectId: string) {
  const ctx = await gatherContext(supabase, projectId);

  const prompt = `Você é o motor de conhecimento da UNV (diretoria comercial terceirizada). Monte o GRAFO DE CONHECIMENTO deste cliente: uma rede de nós e conexões que modela TUDO que se sabe dele — como o graph view do Obsidian, mas com evidências.

DADOS DO CLIENTE (JSON):
${JSON.stringify(ctx, null, 1)}

Extraia nós e arestas. Tipos de nó (kind):
- "pessoa": pessoas reais (dono, vendedores, consultor UNV, contatos)
- "tema": temas recorrentes (ex.: tráfego pago, comissionamento, CRM)
- "dor": dores/problemas vivos
- "decisao": decisões tomadas (com quem decidiu)
- "meta": metas e números-alvo
- "risco": riscos (churn, atraso, dependência)
- "produto": produtos/serviços (do cliente ou da UNV)
- "evento": marcos (reunião-chave, virada, incidente)

Regras:
- 20 a 40 nós. Cada nó TEM que ter pelo menos 1 evidência REAL: trecho citável (frase de WhatsApp, transcrição, tarefa, campo do briefing), com fonte e data quando houver. NÃO invente evidência.
- "weight" do nó = relevância 1-10 (quantas vezes aparece / quão central é).
- Arestas conectam nós relacionados com "why" curto (o mecanismo da relação). Todo nó precisa de pelo menos 1 aresta. 30 a 70 arestas. Máximo 3 evidências por nó.
- ids curtos em kebab-case (ex.: "trafego-pago", "caio-vendedor").
- Fontes válidas: "whatsapp" | "reuniao" | "tarefa" | "briefing" | "grade" | "kpi" | "nps" | "cerebro".

Responda APENAS com JSON válido:
{
  "nodes": [{ "id": "kebab-id", "label": "Nome curto", "kind": "tema", "weight": 7, "resumo": "1-2 frases sobre o que este nó representa PRA ESTE cliente", "evidencias": [{ "fonte": "whatsapp", "quem": "nome ou null", "quando": "data ISO ou null", "trecho": "citação/trecho real" }] }],
  "edges": [{ "source": "id-a", "target": "id-b", "weight": 3, "why": "por que se conectam" }],
  "resumo": "3 frases: o que o grafo revela sobre este cliente"
}
Português do Brasil.`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 9000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${truncate(await aiResp.text(), 300)}`);
  const aiData = await aiResp.json();
  const raw = (aiData.content?.[0]?.text || "{}").replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const graph = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);

  if (!Array.isArray(graph?.nodes) || !graph.nodes.length) throw new Error("IA não retornou nós");
  // saneamento: arestas só entre nós existentes
  const ids = new Set(graph.nodes.map((n: any) => n.id));
  graph.edges = (Array.isArray(graph.edges) ? graph.edges : []).filter(
    (e: any) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target,
  );

  const generatedAt = new Date().toISOString();
  await supabase.from("project_graph").upsert(
    { project_id: projectId, graph, generated_at: generatedAt },
    { onConflict: "project_id" },
  );
  return { graph, generatedAt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const projectId = body.projectId;
    if (!projectId) return json({ error: "projectId é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cached } = await supabase
      .from("project_graph")
      .select("graph, generated_at")
      .eq("project_id", projectId)
      .maybeSingle();

    // build em andamento (marcador building) nos últimos 5 min → não duplica
    if (cached?.graph && (cached.graph as any).building) {
      const ageMin = (Date.now() - new Date(cached.generated_at).getTime()) / 60000;
      if (ageMin < 5) return json({ building: true });
    }

    if (!body.force && cached?.generated_at && !(cached.graph as any)?.building) {
      const ageH = (Date.now() - new Date(cached.generated_at).getTime()) / 3600000;
      if (ageH < CACHE_HOURS) return json({ ...cached, cached: true });
    }

    // marca como "gerando" e processa em background — o painel acompanha na tabela
    await supabase.from("project_graph").upsert(
      { project_id: projectId, graph: { building: true }, generated_at: new Date().toISOString() },
      { onConflict: "project_id" },
    );
    const work = buildGraph(supabase, projectId).catch(async (e) => {
      console.error("graph build failed:", e);
      await supabase.from("project_graph").upsert(
        { project_id: projectId, graph: { building: false, error: String(e?.message || e) }, generated_at: new Date().toISOString() },
        { onConflict: "project_id" },
      );
    });
    // @ts-ignore EdgeRuntime existe no Supabase Edge
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;
    return json({ building: true });
  } catch (error) {
    console.error("graph-engine error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
