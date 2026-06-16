// dialer-brief: monta o briefing de qualificação de um lead pra SDR ver na hora que o cliente atende.
// Lê cadastro + atividades + ligações anteriores + transcrições + WhatsApp e resume com a IA (Claude).
// Cacheia em crm_leads.ai_brief / ai_brief_at. Não depende do Twilio.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-6";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const leadId: string | undefined = body.leadId;
    const force: boolean = body.force === true;
    if (!leadId) throw new Error("leadId é obrigatório");

    // 1) Lead
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .select(`
        id, name, phone, email, company, role, city, state, origin, team,
        segment, estimated_revenue, employee_count, main_pain, urgency, fit_score,
        opportunity_value, probability, notes, ai_brief, ai_brief_at,
        stage:crm_stages(name), pipeline:crm_pipelines(name),
        owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name)
      `)
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) throw new Error("Lead não encontrado");

    // Cache hit?
    if (!force && lead.ai_brief && lead.ai_brief_at) {
      const age = Date.now() - new Date(lead.ai_brief_at).getTime();
      if (age < CACHE_TTL_MS) {
        return new Response(JSON.stringify({ brief: lead.ai_brief, cached: true, lead_id: leadId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Histórico em paralelo
    const [actsRes, callsRes, transRes, convsRes] = await Promise.all([
      supabase.from("crm_activities")
        .select("type, title, description, notes, status, scheduled_at, completed_at, created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
      supabase.from("crm_calls")
        .select("status, answered_by, ai_summary, ai_disposition, duration_seconds, created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10),
      supabase.from("crm_transcriptions")
        .select("title, summary, ai_analysis, recorded_at")
        .eq("lead_id", leadId).order("recorded_at", { ascending: false }).limit(5),
      supabase.from("crm_whatsapp_conversations")
        .select("id, last_message, last_message_at")
        .eq("lead_id", leadId).order("last_message_at", { ascending: false }).limit(5),
    ]);

    const activities = actsRes.data || [];
    const priorCalls = callsRes.data || [];
    const transcriptions = transRes.data || [];
    const conversations = convsRes.data || [];

    // Mensagens recentes de WhatsApp das conversas do lead
    let waMessages: any[] = [];
    if (conversations.length) {
      const convIds = conversations.map((c: any) => c.id);
      const { data: msgs } = await supabase
        .from("crm_whatsapp_messages")
        .select("content, direction, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(40);
      waMessages = (msgs || []).reverse();
    }

    const hasHistory =
      activities.length > 0 || priorCalls.length > 0 || transcriptions.length > 0 || waMessages.length > 0;

    // 3) Monta o contexto pro modelo
    const ctx = {
      cadastro: {
        nome_contato: lead.name,
        empresa: lead.company,
        cargo: lead.role,
        cidade_uf: [lead.city, lead.state].filter(Boolean).join("/"),
        origem: lead.origin,
        segmento: lead.segment,
        faturamento_estimado: lead.estimated_revenue,
        n_funcionarios: lead.employee_count,
        principal_dor: lead.main_pain,
        urgencia: lead.urgency,
        fit_score: lead.fit_score,
        valor_oportunidade: lead.opportunity_value,
        etapa: (lead as any).stage?.name,
        funil: (lead as any).pipeline?.name,
        responsavel: (lead as any).owner?.name,
        observacoes: truncate(lead.notes, 1500),
      },
      atividades: activities.map((a: any) => ({
        tipo: a.type, titulo: a.title, status: a.status,
        nota: truncate(a.notes || a.description, 400),
        quando: a.completed_at || a.scheduled_at || a.created_at,
      })),
      ligacoes_anteriores: priorCalls.map((c: any) => ({
        quando: c.created_at, status: c.status, atendido_por: c.answered_by,
        disposicao: c.ai_disposition, resumo: truncate(c.ai_summary, 500),
        duracao_s: c.duration_seconds,
      })),
      reunioes: transcriptions.map((t: any) => ({
        titulo: t.title, quando: t.recorded_at,
        resumo: truncate(t.summary || t.ai_analysis, 800),
      })),
      whatsapp_recentes: waMessages.map((m: any) => ({
        de: m.direction === "outbound" ? "nós" : "cliente",
        msg: truncate(m.content, 300), quando: m.created_at,
      })),
    };

    const prompt = `Você é um analista comercial da UNV. Monte um BRIEFING DE QUALIFICAÇÃO curto e direto para a SDR usar AO VIVO no instante em que o cliente atende a ligação. Foco no que importa pra qualificar e conduzir a conversa. Sem enrolação.

Dados do lead (JSON):
${JSON.stringify(ctx, null, 2)}

Responda APENAS com um JSON válido (sem markdown, sem cercas de código) neste formato exato:
{
  "resumo": "2 a 3 frases: o que é a empresa/contato e o contexto comercial mais importante",
  "nicho": "nicho/segmento em poucas palavras, ou null se não souber",
  "faturamento": "faixa de faturamento conhecida, ou null se não souber",
  "porte": "porte/nº de funcionários se houver, ou null",
  "principal_dor": "principal dor/necessidade aparente, ou null",
  "urgencia": "alta | media | baixa | desconhecida",
  "ja_falou_antes": { "sim": true ou false, "quando": "data/período do último contato ou null", "resumo": "o que já rolou nas conversas anteriores em 1-2 frases, ou null" },
  "pontos_chave": ["3 a 5 bullets do mais relevante pra SDR saber antes de falar"],
  "perguntas_qualificacao": ["2 a 4 perguntas específicas pra fazer nesta ligação, considerando o contexto"],
  "alertas": ["riscos/sensibilidades a evitar, ou [] se nenhum"],
  "proximo_passo_sugerido": "objetivo claro desta ligação"
}

Regras: se um dado não existir, use null (não invente). Português do Brasil. Seja específico ao lead, nada genérico.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${truncate(errText, 400)}`);
    }

    const aiData = await aiResp.json();
    let raw = aiData?.content?.[0]?.text || "{}";
    // limpa eventuais cercas de código
    raw = raw.trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    let brief: any;
    try {
      brief = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      brief = m ? JSON.parse(m[0]) : { resumo: raw };
    }
    brief._has_history = hasHistory;

    // 4) Cacheia no lead
    await supabase
      .from("crm_leads")
      .update({ ai_brief: brief, ai_brief_at: new Date().toISOString() })
      .eq("id", leadId);

    return new Response(JSON.stringify({ brief, cached: false, lead_id: leadId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
