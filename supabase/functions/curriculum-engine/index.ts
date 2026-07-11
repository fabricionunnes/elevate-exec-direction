// curriculum-engine: Grade Curricular dos serviços UNV + Boletim da empresa.
// Ações:
//   {action:"generate", projectId, force?} — IA lê o briefing do cliente e monta
//     a grade do projeto a partir dos itens padrão (adapta/inclui itens do
//     briefing), criando as tarefas correspondentes na Jornada (onboarding_tasks).
//     force=true regenera mantendo os itens concluídos.
//   {action:"boletim", projectId} — IA dá nota 0-10 por pilar (execução da grade
//     + resultado + contexto do Cérebro) e grava em project_report_cards no
//     período corrente (YYYY-MM, America/Sao_Paulo).
//   {action:"batch"} — boletim dos projetos ativos com grade mais desatualizados
//     (cron semanal de segunda).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-6";
const BATCH_LIMIT = 3;
const ACTIVE_STATUSES = [
  "active", "ativo", "cancellation_requested", "cancellation_signaled",
  "notice_period", "sinalizou_cancelamento", "cumprindo_aviso",
];

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

function currentPeriodBRT(): string {
  const now = new Date(Date.now() - 3 * 3600 * 1000); // America/Sao_Paulo (UTC-3)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function callAI(prompt: string, maxTokens: number): Promise<any> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${truncate(await resp.text(), 300)}`);
  const data = await resp.json();
  const raw = (data.content?.[0]?.text || "{}").replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
}

/** Briefing consolidado da empresa pro prompt. */
async function loadBriefing(supabase: SupabaseClient, companyId: string) {
  const { data: company } = await supabase
    .from("onboarding_companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return null;
  const slim: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(company)) {
    if (v === null || v === "" || k === "id") continue;
    if (typeof v === "string") slim[k] = truncate(v, 600);
    else slim[k] = v;
  }
  const { data: sales } = await supabase
    .from("company_sales_history")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { empresa: slim, historico_vendas: sales || null };
}

async function generateGrade(supabase: SupabaseClient, projectId: string, force: boolean) {
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, name, onboarding_company_id, created_at, company:onboarding_companies(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Projeto não encontrado");
  if (!project.onboarding_company_id) throw new Error("Projeto sem empresa vinculada");

  const { data: existing } = await supabase
    .from("project_curriculum_items")
    .select("id, status, task_id")
    .eq("project_id", projectId);
  if ((existing?.length || 0) > 0 && !force) {
    return { exists: true, count: existing!.length };
  }

  const briefing = await loadBriefing(supabase, project.onboarding_company_id);
  const { data: pillars } = await supabase
    .from("curriculum_pillars").select("id, key, name, description").eq("is_active", true).order("sort_order");
  const { data: items } = await supabase
    .from("curriculum_items")
    .select("id, pillar_id, title, description, default_week")
    .eq("is_active", true)
    .order("sort_order");
  const pillarByKey = new Map((pillars || []).map((p: any) => [p.key, p]));
  const pillarById = new Map((pillars || []).map((p: any) => [p.id, p]));

  const catalog = (items || []).map((i: any) => ({
    item_id: i.id,
    pilar: pillarById.get(i.pillar_id)?.key,
    titulo: i.title,
    descricao: i.description,
    semana: i.default_week,
  }));

  const prompt = `Você é o diretor comercial terceirizado da UNV montando a GRADE CURRICULAR de entrega pra um cliente que acabou de fechar. A grade é o plano de implantação dos serviços, organizado em pilares, e cada item vira uma tarefa no sistema.

PILARES: ${JSON.stringify((pillars || []).map((p: any) => ({ key: p.key, nome: p.name, foco: p.description })))}

CATÁLOGO PADRÃO (adapte ao cliente — pode ajustar título/descrição/semana, remover o que não se aplica e criar itens novos a partir do briefing):
${JSON.stringify(catalog)}

BRIEFING DO CLIENTE:
${JSON.stringify(briefing, null, 1)}

Monte a grade deste cliente. Regras:
- 25 a 45 itens no total, todos os pilares representados (mínimo 2 itens por pilar).
- Personalize com o briefing: cite o contexto real do cliente nas descrições (segmento, dores, time atual, metas). Itens criados especificamente pelo briefing marcam origem "briefing".
- "semana" = semana de entrega a partir do início do projeto (1 a 24), sequência lógica de implantação.
- Se o briefing indicar que algo já existe (ex.: CRM implantado), transforme o item em auditoria/otimização em vez de implantação.

Responda APENAS com JSON válido:
{
  "itens": [{ "pilar": "key do pilar", "item_id": "id do catálogo ou null se novo", "titulo": "...", "descricao": "...", "semana": 1, "origem": "padrao" | "briefing" }],
  "resumo": "2 frases: como a grade foi adaptada pra este cliente"
}`;

  const ai = await callAI(prompt, 8000);
  const rawItens: any[] = Array.isArray(ai?.itens) ? ai.itens : [];
  if (!rawItens.length) throw new Error("IA não retornou itens");

  // force: limpa pendentes (e as tarefas abertas ligadas), preserva concluídos
  if ((existing?.length || 0) > 0 && force) {
    const pending = (existing || []).filter((e: any) => e.status !== "done");
    const taskIds = pending.map((e: any) => e.task_id).filter(Boolean);
    if (taskIds.length) {
      await supabase.from("onboarding_tasks").delete().in("id", taskIds).neq("status", "completed");
    }
    await supabase.from("project_curriculum_items").delete()
      .eq("project_id", projectId).neq("status", "done");
  }

  const startDate = new Date();
  let created = 0;
  let sort = 0;
  for (const it of rawItens.slice(0, 45)) {
    const pillar = pillarByKey.get(String(it.pilar));
    if (!pillar || !it.titulo) continue;
    const week = Math.min(Math.max(Number(it.semana) || 1, 1), 24);
    const due = new Date(startDate.getTime() + week * 7 * 86400 * 1000);
    const dueStr = due.toISOString().slice(0, 10);

    const { data: task } = await supabase
      .from("onboarding_tasks")
      .insert({
        project_id: projectId,
        title: `Grade · ${truncate(it.titulo, 140)}`,
        description: truncate(it.descricao || "", 1000),
        status: "pending",
        due_date: dueStr,
        tags: ["grade"],
        is_internal: false,
        sort_order: 900 + sort,
      })
      .select("id")
      .single();

    const { error: insErr } = await supabase.from("project_curriculum_items").insert({
      project_id: projectId,
      pillar_id: pillar.id,
      item_id: it.item_id && catalog.some((c) => c.item_id === it.item_id) ? it.item_id : null,
      title: truncate(it.titulo, 200),
      description: truncate(it.descricao || "", 1000),
      status: "pending",
      due_date: dueStr,
      task_id: task?.id ?? null,
      source: it.origem === "briefing" ? "briefing" : "padrao",
      sort_order: sort++,
    });
    if (!insErr) created++;
  }

  return { created, resumo: ai?.resumo || null };
}

async function generateBoletim(supabase: SupabaseClient, projectId: string) {
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, name, onboarding_company_id, company:onboarding_companies(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Projeto não encontrado");

  const { data: pillars } = await supabase
    .from("curriculum_pillars").select("id, key, name, description").eq("is_active", true).order("sort_order");
  const { data: items } = await supabase
    .from("project_curriculum_items")
    .select("pillar_id, title, status, due_date, source")
    .eq("project_id", projectId);
  if (!(items?.length)) throw new Error("Projeto ainda sem grade — gere a grade primeiro");

  const pillarById = new Map((pillars || []).map((p: any) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);
  const porPilar: Record<string, any> = {};
  for (const p of pillars || []) {
    porPilar[p.key] = { nome: p.name, itens: [], done: 0, total: 0, atrasados: 0 };
  }
  for (const it of items || []) {
    const key = pillarById.get(it.pillar_id)?.key;
    if (!key) continue;
    const g = porPilar[key];
    g.total++;
    if (it.status === "done") g.done++;
    if (it.status !== "done" && it.status !== "na" && it.due_date && it.due_date < today) g.atrasados++;
    g.itens.push({ t: truncate(it.title, 90), s: it.status, vence: it.due_date });
  }

  // Contexto de resultado: Cérebro do Cliente (se existir) + KPIs recentes
  const { data: brainRow } = await supabase
    .from("client_brain").select("brain, generated_at").eq("project_id", projectId).maybeSingle();
  let kpis: any[] = [];
  if (project.onboarding_company_id) {
    const { data: kpiRows } = await supabase
      .from("company_kpis")
      .select("name, kpi_type, target_value, is_active")
      .eq("company_id", project.onboarding_company_id)
      .eq("is_active", true)
      .limit(15);
    kpis = kpiRows || [];
  }

  const prompt = `Você é o diretor comercial da UNV emitindo o BOLETIM mensal de um cliente. Dê uma nota de 0 a 10 (1 casa decimal) pra cada pilar da entrega, como um boletim escolar da empresa.

Critérios por pilar: execução da grade (itens concluídos vs pendentes vs atrasados), qualidade do que o contexto mostra, e resultado quando houver evidência. Nota 10 = pilar implantado e rodando com resultado; 7-9 = avançando bem; 4-6 = andamento parcial ou atrasos relevantes; 0-3 = pilar parado ou crítico. Itens "na" não contam contra.

GRADE POR PILAR:
${JSON.stringify(porPilar, null, 1)}

CONTEXTO DO CLIENTE (Cérebro, pode ser null):
${JSON.stringify(brainRow?.brain ?? null, null, 1)}

KPIs ATIVOS: ${JSON.stringify(kpis)}

Responda APENAS com JSON válido:
{
  "notas": [{ "pilar": "key", "nota": 7.5, "comentario": "1-2 frases específicas, com evidência" }],
  "resumo": "3 frases: leitura geral do boletim, destaque e principal alerta"
}
Inclua TODOS os pilares que têm itens na grade. Português do Brasil.`;

  const ai = await callAI(prompt, 3500);
  const notas: any[] = Array.isArray(ai?.notas) ? ai.notas : [];
  if (!notas.length) throw new Error("IA não retornou notas");

  const period = currentPeriodBRT();
  const byKey = new Map((pillars || []).map((p: any) => [p.key, p]));
  let saved = 0;
  for (const n of notas) {
    const pillar = byKey.get(String(n.pilar));
    const score = Math.min(Math.max(Number(n.nota), 0), 10);
    if (!pillar || Number.isNaN(score)) continue;
    const { error } = await supabase.from("project_report_cards").upsert(
      {
        project_id: projectId,
        period,
        pillar_id: pillar.id,
        score: Math.round(score * 10) / 10,
        commentary: truncate(n.comentario || "", 500),
        graded_by: "ia",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,period,pillar_id" },
    );
    if (!error) saved++;
  }

  return { period, saved, resumo: ai?.resumo || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "generate") {
      if (!body.projectId) return json({ error: "projectId é obrigatório" }, 400);
      return json(await generateGrade(supabase, body.projectId, body.force === true));
    }

    if (action === "boletim") {
      if (!body.projectId) return json({ error: "projectId é obrigatório" }, 400);
      return json(await generateBoletim(supabase, body.projectId));
    }

    if (action === "batch") {
      // boletins mais desatualizados dos projetos ativos com grade
      const period = currentPeriodBRT();
      const { data: withGrade } = await supabase
        .from("project_curriculum_items")
        .select("project_id")
        .limit(2000);
      const projectIds = [...new Set((withGrade || []).map((r: any) => r.project_id))];
      if (!projectIds.length) return json({ processed: 0 });

      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select("id, status")
        .in("id", projectIds)
        .in("status", ACTIVE_STATUSES);
      const { data: cards } = await supabase
        .from("project_report_cards")
        .select("project_id, updated_at")
        .eq("period", period)
        .in("project_id", projectIds);
      const lastByProject = new Map<string, string>();
      for (const c of cards || []) {
        const prev = lastByProject.get(c.project_id);
        if (!prev || c.updated_at > prev) lastByProject.set(c.project_id, c.updated_at);
      }
      const ordered = (projects || [])
        .map((p: any) => ({ id: p.id, last: lastByProject.get(p.id) || "" }))
        .sort((a, b) => a.last.localeCompare(b.last))
        .slice(0, BATCH_LIMIT);

      const results: any[] = [];
      for (const p of ordered) {
        try {
          results.push({ projectId: p.id, ...(await generateBoletim(supabase, p.id)) });
        } catch (e) {
          results.push({ projectId: p.id, error: String(e) });
        }
      }
      return json({ processed: results.length, results });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error("curriculum-engine error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
