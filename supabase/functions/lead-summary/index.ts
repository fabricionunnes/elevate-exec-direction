import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { leadId, type, transcriptionId } = await req.json(); // type: "overview" | "guide" | "followup" | "analysis"
    if (!leadId || !type) throw new Error("leadId and type are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lead data
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .select(`
        *,
        stage:crm_stages(name, color, is_final, final_type, sort_order),
        pipeline:crm_pipelines(name),
        owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
        origin_rel:crm_origins(name),
        tags:crm_lead_tags(tag:crm_tags(id, name, color))
      `)
      .eq("id", leadId)
      .single();
    if (leadErr) throw leadErr;

    // Fetch activities
    const { data: activities } = await supabase
      .from("crm_activities")
      .select("*, responsible:onboarding_staff(name)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    // Fetch history
    const { data: history } = await supabase
      .from("crm_lead_history")
      .select("*, staff:onboarding_staff(name)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    // Fetch meeting events
    const { data: meetings } = await supabase
      .from("crm_meeting_events")
      .select("*, credited:onboarding_staff!crm_meeting_events_credited_staff_id_fkey(name)")
      .eq("lead_id", leadId)
      .order("event_date", { ascending: false });

    // Fetch transcriptions for context
    const { data: transcriptions } = await supabase
      .from("crm_transcriptions")
      .select("title, transcription_text, summary, ai_analysis, created_at")
      .eq("lead_id", leadId)
      .not("transcription_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch Scanner UNV submission (Isca de baleia funnel) for richer context
    const { data: scannerSub } = await supabase
      .from("sales_scanner_submissions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch all stages from same pipeline for journey
    let pipelineStages: any[] = [];
    if (lead.pipeline_id) {
      const { data: stgs } = await supabase
        .from("crm_stages")
        .select("id, name, color, sort_order, is_final, final_type")
        .eq("pipeline_id", lead.pipeline_id)
        .order("sort_order");
      pipelineStages = stgs || [];
    }

    // Build stage history from crm_lead_history
    const stageChanges = (history || [])
      .filter((h: any) => h.action === "stage_changed")
      .map((h: any) => ({
        from: h.old_value,
        to: h.new_value,
        date: h.created_at,
        staff: h.staff?.name,
      }));

    // Calculate days in funnel
    const createdAt = new Date(lead.created_at);
    const now = new Date();
    const daysInFunnel = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Count meeting types
    const meetingsRealized = (meetings || []).filter((m: any) => m.event_type === "realized").length;
    const meetingsNoShow = (meetings || []).filter((m: any) => m.event_type === "no_show").length;
    const meetingsScheduled = (meetings || []).filter((m: any) => m.event_type === "scheduled").length;
    const meetingsRescheduled = (activities || []).filter((a: any) => 
      a.type === "meeting" && a.notes?.toLowerCase().includes("reagend")
    ).length;

    // Build context for AI
    const leadContext = {
      name: lead.name,
      company: lead.company,
      segment: lead.segment,
      city: lead.city,
      state: lead.state,
      phone: lead.phone,
      email: lead.email,
      role: lead.role,
      employee_count: lead.employee_count,
      main_pain: lead.main_pain,
      urgency: lead.urgency,
      fit_score: lead.fit_score,
      opportunity_value: lead.opportunity_value,
      probability: lead.probability,
      notes: lead.notes,
      origin: lead.origin_rel?.name || lead.origin,
      current_stage: lead.stage?.name,
      pipeline: lead.pipeline?.name,
      owner: lead.owner?.name,
      tags: (lead.tags || []).map((t: any) => t.tag?.name).filter(Boolean),
      created_at: lead.created_at,
      days_in_funnel: daysInFunnel,
      pipeline_stages: pipelineStages.map((s: any) => s.name),
      stage_changes: stageChanges,
      activities_summary: (activities || []).slice(0, 20).map((a: any) => ({
        type: a.type,
        title: a.title,
        description: a.description,
        notes: a.notes,
        status: a.status,
        scheduled_at: a.scheduled_at,
        completed_at: a.completed_at,
        responsible: a.responsible?.name,
      })),
      meetings_count: {
        realized: meetingsRealized,
        no_show: meetingsNoShow,
        scheduled: meetingsScheduled,
        rescheduled: meetingsRescheduled,
      },
      meeting_events: (meetings || []).slice(0, 15).map((m: any) => ({
        type: m.event_type,
        date: m.event_date,
        credited_to: m.credited?.name,
      })),
      last_activity: lead.last_activity_at,
      transcriptions: (transcriptions || []).map((t: any) => ({
        title: t.title,
        summary: t.summary,
        ai_analysis: t.ai_analysis,
        content: (t.transcription_text || "").substring(0, 3000),
        date: t.created_at,
      })),
    };

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "overview") {
      systemPrompt = `Você é um analista comercial especialista. Responda APENAS em JSON válido, sem markdown, sem code blocks. Use o formato exato pedido.`;
      userPrompt = `Com base nos dados abaixo de um lead no CRM, gere um JSON com a seguinte estrutura:
{
  "company_summary": "Resumo executivo da empresa em 3-5 linhas, tom direto e profissional",
  "temperature": "hot" | "warm" | "cold",
  "temperature_reason": "Justificativa curta para a temperatura",
  "interest_level": "high" | "medium" | "low",
  "main_pain": "Principal dor identificada com base nas notas e reuniões",
  "main_objection": "Principal objeção registrada ou 'Nenhuma objeção registrada'",
  "close_probability": número de 0 a 100,
  "close_probability_reason": "Justificativa para a probabilidade",
  "meeting_summaries": [
    {
      "date": "data",
      "type": "tipo",
      "key_points": ["pontos principais"],
      "objections": ["objeções se houver"],
      "next_steps": ["próximos passos"]
    }
  ]
}

Dados do lead:
${JSON.stringify(leadContext, null, 2)}

IMPORTANTE: Responda APENAS o JSON, sem nenhum texto adicional, sem markdown.`;
    } else if (type === "guide") {
      systemPrompt = `Você é um coach de vendas especialista no roteiro de 12 fases de uma ligação comercial. Responda APENAS em JSON válido, sem markdown, sem code blocks.`;
      userPrompt = `Com base no histórico completo do lead abaixo, gere um guia de atendimento personalizado em JSON.

IMPORTANTE: O array "recommended_phases" DEVE conter EXATAMENTE as 12 fases, sempre. Cada fase deve ter insights e scripts personalizados com base nos dados do lead. Para fases já concluídas, marque is_completed como true e ainda assim forneça insights úteis. Para fases futuras, gere scripts e dicas baseados no que sabemos do cliente para que o closer esteja preparado.

Estrutura do JSON:
{
  "current_phase": número de 1 a 12,
  "current_phase_name": "nome da fase",
  "briefing_alerts": ["lista de 3-5 alertas pré-reunião baseados no histórico"],
  "recommended_phases": [
    {
      "phase_number": número (de 1 a 12, TODAS as fases),
      "phase_name": "nome",
      "objective": "objetivo da fase",
      "ai_insights": ["insights personalizados da IA baseados nos dados do lead - o que já sabemos, o que falta descobrir"],
      "suggested_scripts": ["scripts sugeridos usando dados reais do lead (nome, empresa, segmento, dor)"],
      "tips": ["dicas específicas para este lead nesta fase"],
      "is_completed": boolean (baseado no histórico - true se já foi abordado em reuniões anteriores)
    }
  ],
  "dont_do": ["lista de 3-5 coisas que NÃO fazer neste atendimento, baseado no histórico"],
  "next_step": {
    "action": "ação recomendada",
    "deadline": "prazo sugerido",
    "responsible": "responsável",
    "ai_note": "observação personalizada da IA"
  }
}

Roteiro de referência (12 fases — GERE TODAS):
Fase 1 - Rapport: criar conexão genuína, espelhamento, correspondência de comportamento
Fase 2 - Expectativas: alinhar formato da ligação, assumir controle, analogia do médico
Fase 3 - Tomadores de decisão: identificar quem fecha, atenção ao Assassino Silencioso
Fase 4 - A Razão (A Dor): fazer o prospect declarar o motivo da ligação
Fase 5 - Cavar: aprofundar a dor com emoção, nunca usar PORQUE
Fase 6 - Tentou: descobrir tentativas anteriores frustradas
Fase 7 - Situação Atual e Desejada: onde está e onde quer chegar em 12 meses
Fase 8 - Porquê: motivação emocional profunda (AMOR ou STATUS)
Fase 9 - Admissão: fazer admitir que precisa de ajuda
Fase 10 - Compromisso: confirmar urgência
Fase 11 - Fechamento Personalizado: pitch usando palavras do prospect
Fase 12 - Preço: NUNCA falar o preço sem ser solicitado

Dados do lead:
${JSON.stringify(leadContext, null, 2)}

IMPORTANTE: Responda APENAS o JSON, sem nenhum texto adicional, sem markdown. O array recommended_phases DEVE ter exatamente 12 itens.`;
    } else if (type === "followup") {
      systemPrompt = `Você é um estrategista comercial especialista em follow-up e fechamento de vendas. Responda APENAS em JSON válido, sem markdown, sem code blocks.`;
      userPrompt = `Com base no histórico completo do lead abaixo, analise todas as notas, atividades e reuniões para gerar um plano completo de follow-up. Identifique se o cliente mencionou alguma data específica para fechar/decidir.

Gere um JSON com a seguinte estrutura:
{
  "closing_date": {
    "detected": boolean,
    "date": "data mencionada pelo cliente no formato YYYY-MM-DD ou null",
    "source": "de onde foi extraída essa informação (nota, reunião, atividade) ou null",
    "days_remaining": número de dias até a data ou null,
    "confidence": "high" | "medium" | "low",
    "context": "frase ou contexto exato onde o cliente mencionou a data ou null"
  },
  "lead_status_summary": "Resumo em 2-3 linhas do estado atual do lead em relação ao fechamento",
  "urgency_level": "critical" | "high" | "medium" | "low",
  "urgency_reason": "motivo da urgência",
  "followup_timeline": [
    {
      "day_label": "Dia X após reunião" ou "Hoje" ou data específica,
      "action": "ação a ser realizada",
      "channel": "whatsapp" | "ligação" | "email" | "presencial",
      "objective": "objetivo desta ação",
      "script": "script completo pronto para usar, personalizado com dados reais do lead (nome, empresa, dor)",
      "tips": ["dicas para esta abordagem"],
      "is_past_due": boolean,
      "priority": "high" | "medium" | "low"
    }
  ],
  "post_closing_date_plan": [
    {
      "day_label": "Dia X após data de fechamento",
      "action": "ação caso o cliente não tenha fechado na data prevista",
      "channel": "whatsapp" | "ligação" | "email",
      "script": "script personalizado para reengajar após data prevista",
      "tone": "empático" | "direto" | "urgente"
    }
  ],
  "objection_scripts": [
    {
      "objection": "objeção identificada ou comum para este perfil",
      "response_script": "script de resposta",
      "technique": "nome da técnica usada"
    }
  ],
  "golden_rules": ["5-7 regras de ouro para o follow-up deste lead específico"],
  "next_immediate_action": {
    "action": "próxima ação imediata recomendada",
    "when": "quando fazer",
    "script": "script pronto para usar",
    "channel": "canal recomendado"
  }
}

REGRAS:
- Gere pelo menos 6-8 touchpoints no timeline de follow-up
- Se identificou data de fechamento, crie ações antes E depois dessa data
- Scripts devem usar nome real do cliente, empresa, dor e dados específicos
- Inclua scripts para WhatsApp (curtos e diretos) e ligação (mais detalhados)
- Se já passaram muitos dias sem contato, indique urgência
- Se o lead está frio, sugira abordagens de reaquecimento
- Sempre termine com um próximo passo claro

Dados do lead:
${JSON.stringify(leadContext, null, 2)}

IMPORTANTE: Responda APENAS o JSON, sem nenhum texto adicional, sem markdown.`;
    } else if (type === "analysis") {
      // Fetch transcriptions for this lead
      let transcriptionText = "";
      let transcriptionTitle = "";
      
      if (transcriptionId) {
        const { data: t } = await supabase
          .from("crm_transcriptions")
          .select("title, transcription_text")
          .eq("id", transcriptionId)
          .single();
        transcriptionText = t?.transcription_text || "";
        transcriptionTitle = t?.title || "";
      } else {
        // Get the most recent transcription
        const { data: ts } = await supabase
          .from("crm_transcriptions")
          .select("title, transcription_text")
          .eq("lead_id", leadId)
          .not("transcription_text", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (ts && ts.length > 0) {
          transcriptionText = ts[0].transcription_text || "";
          transcriptionTitle = ts[0].title || "";
        }
      }

      if (!transcriptionText) {
        return new Response(JSON.stringify({
          ai: { no_transcription: true },
          lead: {
            id: lead.id, name: lead.name, company: lead.company, segment: lead.segment,
            city: lead.city, state: lead.state, phone: lead.phone, email: lead.email,
            role: lead.role, employee_count: lead.employee_count, main_pain: lead.main_pain,
            notes: lead.notes, origin: lead.origin_rel?.name || lead.origin,
            current_stage: lead.stage?.name, stage_color: lead.stage?.color,
            pipeline: lead.pipeline?.name, owner: lead.owner?.name,
            tags: (lead.tags || []).map((t: any) => ({ name: t.tag?.name, color: t.tag?.color })),
            created_at: lead.created_at, last_activity_at: lead.last_activity_at,
            days_in_funnel: daysInFunnel, opportunity_value: lead.opportunity_value,
            probability: lead.probability, trade_name: lead.trade_name,
          },
          transcription_title: transcriptionTitle,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      systemPrompt = `Você é um diretor comercial experiente que analisa transcrições de reuniões de vendas. Avalie com rigor e honestidade, dando notas justas. Responda APENAS em JSON válido, sem markdown, sem code blocks.`;
      userPrompt = `Analise a transcrição da reunião abaixo e avalie a performance do vendedor em cada uma das 12 fases do roteiro de vendas.

Para cada fase, dê:
- Uma nota de 0 a 10 (0 = não aplicou / péssimo, 10 = execução perfeita)
- Feedback específico do que foi feito bem ou mal
- Pontos de melhoria concretos

Gere um JSON com a seguinte estrutura:
{
  "overall_score": número de 0 a 10 (média ponderada),
  "overall_feedback": "feedback geral da reunião em 3-5 linhas",
  "strengths": ["3-5 pontos fortes identificados na reunião"],
  "critical_improvements": ["3-5 melhorias críticas e urgentes"],
  "phases": [
    {
      "phase_number": 1,
      "phase_name": "Rapport",
      "score": número de 0 a 10,
      "applied": boolean (se a fase foi aplicada na reunião),
      "feedback": "feedback detalhado sobre a execução desta fase",
      "good_moments": ["momentos em que o vendedor acertou nesta fase"],
      "improvements": ["pontos específicos de melhoria"],
      "suggested_script": "como deveria ter sido feito (script ideal para este lead)"
    }
  ],
  "missed_opportunities": ["oportunidades perdidas durante a reunião"],
  "client_signals": {
    "buying_signals": ["sinais de compra identificados na transcrição"],
    "objection_signals": ["sinais de objeção ou resistência"],
    "interest_level": "high" | "medium" | "low",
    "emotional_triggers": ["gatilhos emocionais identificados"]
  },
  "next_meeting_recommendations": "recomendações para a próxima reunião com base nesta análise"
}

As 12 fases do roteiro:
Fase 1 - Rapport (peso 1): Conexão genuína, espelhamento, correspondência de comportamento, ponto em comum
Fase 2 - Expectativas (peso 1): Alinhar formato, assumir controle, analogia do médico
Fase 3 - Tomadores de Decisão (peso 1.5): Identificar decisor, Assassino Silencioso
Fase 4 - A Razão / A Dor (peso 2): Fazer declarar o motivo e a dor específica
Fase 5 - Cavar (peso 2): Aprofundar dor com emoção, usar "então"/"parece que", nunca PORQUE
Fase 6 - Tentou (peso 1): Descobrir tentativas anteriores frustradas
Fase 7 - Situação Atual e Desejada (peso 1.5): Onde está e onde quer chegar em 12 meses
Fase 8 - Porquê (peso 1.5): Motivação emocional profunda (AMOR ou STATUS)
Fase 9 - Admissão (peso 1.5): Fazer admitir que precisa de ajuda
Fase 10 - Compromisso (peso 1): Confirmar urgência, "quando quer resolver?"
Fase 11 - Fechamento Personalizado (peso 2): Pitch usando palavras do prospect
Fase 12 - Preço (peso 1.5): NUNCA falar preço sem ser solicitado, calar após falar valor

Dados do lead:
${JSON.stringify(leadContext, null, 2)}

Título da transcrição: ${transcriptionTitle}

Transcrição da reunião:
${transcriptionText.substring(0, 15000)}

IMPORTANTE: Responda APENAS o JSON, sem nenhum texto adicional, sem markdown. Seja rigoroso nas notas.`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";

    // Clean markdown wrappers if present
    content = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = { error: "Não foi possível processar a resposta da IA", raw: content };
    }

    // Include raw data for the frontend
    const responseData = {
      ai: parsed,
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        segment: lead.segment,
        city: lead.city,
        state: lead.state,
        phone: lead.phone,
        email: lead.email,
        role: lead.role,
        employee_count: lead.employee_count,
        main_pain: lead.main_pain,
        notes: lead.notes,
        origin: lead.origin_rel?.name || lead.origin,
        current_stage: lead.stage?.name,
        stage_color: lead.stage?.color,
        pipeline: lead.pipeline?.name,
        owner: lead.owner?.name,
        tags: (lead.tags || []).map((t: any) => ({ name: t.tag?.name, color: t.tag?.color })),
        created_at: lead.created_at,
        last_activity_at: lead.last_activity_at,
        days_in_funnel: daysInFunnel,
        opportunity_value: lead.opportunity_value,
        probability: lead.probability,
        trade_name: lead.trade_name,
      },
      journey: {
        stages: pipelineStages,
        stage_changes: stageChanges,
        current_stage_id: lead.stage_id,
      },
      meetings: {
        total_realized: meetingsRealized,
        total_no_show: meetingsNoShow,
        total_scheduled: meetingsScheduled,
        total_rescheduled: meetingsRescheduled,
        events: (meetings || []).map((m: any) => ({
          type: m.event_type,
          date: m.event_date,
          credited_to: m.credited?.name,
        })),
      },
      activities: (activities || []).slice(0, 30).map((a: any) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        notes: a.notes,
        status: a.status,
        scheduled_at: a.scheduled_at,
        completed_at: a.completed_at,
        responsible: a.responsible?.name,
        created_at: a.created_at,
      })),
    };

    // Save summary to database (upsert)
    try {
      await supabase
        .from("crm_lead_summaries")
        .upsert({
          lead_id: leadId,
          summary_type: type,
          summary_data: responseData,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "lead_id,summary_type" });
    } catch (saveErr) {
      console.error("Save summary error (non-critical):", saveErr);
    }

    // Log access
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: staffUser } = await supabase
            .from("onboarding_staff")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (staffUser) {
            await supabase.from("crm_lead_history").insert({
              lead_id: leadId,
              action: "summary_accessed",
              field_changed: type,
              notes: `Resumo ${type === "overview" ? "Visão Geral" : "Guia de Atendimento"} acessado`,
              staff_id: staffUser.id,
            });
          }
        }
      }
    } catch (logErr) {
      console.error("Log error (non-critical):", logErr);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
