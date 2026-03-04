import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchCompanyContext(supabase: any, projectId: string) {
  // Fetch project + company info
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("*, onboarding_company:onboarding_companies(name, segment, cnpj, phone, email, address, city, state, website, social_media, observations, employee_count, monthly_revenue)")
    .eq("id", projectId)
    .single();

  // Fetch briefing data
  const { data: briefings } = await supabase
    .from("onboarding_meeting_briefings")
    .select("briefing_content, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recent meeting notes/summaries
  const { data: meetings } = await supabase
    .from("onboarding_meeting_notes")
    .select("meeting_title, subject, notes, transcript, meeting_date")
    .eq("project_id", projectId)
    .order("meeting_date", { ascending: false })
    .limit(5);

  // Fetch existing tasks to understand current journey
  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("title, description, status, phase, due_date")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(30);

  // Fetch task observations/history
  const { data: taskHistory } = await supabase
    .from("onboarding_task_history")
    .select("action, description, created_at, onboarding_tasks!inner(project_id)")
    .eq("onboarding_tasks.project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Build context string
  let context = "";

  if (project?.onboarding_company) {
    const c = project.onboarding_company;
    context += `\n## INFORMAÇÕES DA EMPRESA\n`;
    context += `Nome: ${c.name || "N/A"}\n`;
    context += `Segmento: ${c.segment || "N/A"}\n`;
    if (c.website) context += `Website: ${c.website}\n`;
    if (c.social_media) context += `Redes Sociais: ${c.social_media}\n`;
    if (c.employee_count) context += `Nº Funcionários: ${c.employee_count}\n`;
    if (c.monthly_revenue) context += `Faturamento Mensal: R$ ${c.monthly_revenue}\n`;
    if (c.city && c.state) context += `Localização: ${c.city}/${c.state}\n`;
    if (c.observations) context += `Observações: ${c.observations}\n`;
  }

  if (briefings && briefings.length > 0) {
    context += `\n## BRIEFINGS E ANÁLISES ANTERIORES\n`;
    for (const b of briefings) {
      try {
        const parsed = JSON.parse(b.briefing_content);
        if (parsed.report_summary) context += `- Resumo: ${parsed.report_summary}\n`;
        if (parsed.report_alignments) context += `- Alinhamentos: ${JSON.stringify(parsed.report_alignments)}\n`;
        // Include other briefing fields if present
        const keys = Object.keys(parsed).filter(k => !k.startsWith("report_"));
        for (const k of keys) {
          if (typeof parsed[k] === "string" && parsed[k].length > 10) {
            context += `- ${k}: ${parsed[k].substring(0, 500)}\n`;
          }
        }
      } catch {
        context += `- ${b.briefing_content?.substring(0, 500)}\n`;
      }
    }
  }

  if (meetings && meetings.length > 0) {
    context += `\n## REUNIÕES RECENTES\n`;
    for (const m of meetings) {
      context += `### ${m.subject || m.meeting_title || "Reunião"} (${m.meeting_date || "sem data"})\n`;
      if (m.notes) context += `Notas: ${m.notes.substring(0, 800)}\n`;
      if (m.transcript) context += `Transcrição (trecho): ${m.transcript.substring(0, 800)}\n`;
    }
  }

  if (tasks && tasks.length > 0) {
    context += `\n## TAREFAS ATUAIS DA JORNADA\n`;
    const grouped: Record<string, any[]> = {};
    for (const t of tasks) {
      const phase = t.phase || "Sem fase";
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(t);
    }
    for (const [phase, phaseTasks] of Object.entries(grouped)) {
      context += `Fase "${phase}":\n`;
      for (const t of phaseTasks) {
        context += `- [${t.status}] ${t.title}${t.description ? ": " + t.description.substring(0, 200) : ""}\n`;
      }
    }
  }

  if (taskHistory && taskHistory.length > 0) {
    context += `\n## OBSERVAÇÕES E HISTÓRICO RECENTE\n`;
    for (const h of taskHistory) {
      if (h.description) context += `- ${h.action}: ${h.description.substring(0, 300)}\n`;
    }
  }

  return context;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, niche, year, consultant_staff_id } = await req.json();

    if (!project_id || !niche || !year) {
      return new Response(JSON.stringify({ error: "project_id, niche and year are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if there are already actions for this project/year
    const { data: existing } = await supabase
      .from("commercial_actions")
      .select("id")
      .eq("project_id", project_id)
      .eq("year", year)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Já existem ações para este ano. Exclua-as primeiro para gerar novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // First check if we have templates for this niche
    const { data: templates } = await supabase
      .from("commercial_action_templates")
      .select("*")
      .eq("is_active", true)
      .or(`niche.eq.${niche},niche.is.null`)
      .order("month").order("week").order("sort_order");

    let actionsToInsert: any[] = [];

    if (templates && templates.length >= 20) {
      // Use templates from bank
      actionsToInsert = templates.map(t => ({
        project_id,
        template_id: t.id,
        title: t.title,
        description: t.description,
        objective: t.objective,
        category: t.category,
        step_by_step: t.step_by_step,
        script: t.script,
        responsible_staff_id: consultant_staff_id || null,
        goal: t.default_goal,
        status: "planned",
        recurrence: t.frequency,
        month: t.month,
        week: t.week,
        year,
      }));
    } else {
      // Fetch full company context
      const companyContext = await fetchCompanyContext(supabase, project_id);

      // Generate with AI
      const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";

      const prompt = `Gere um calendário anual de ações comerciais para uma empresa do nicho "${niche}" para o ano de ${year}.

${companyContext ? `# CONTEXTO COMPLETO DA EMPRESA\nUse TODAS as informações abaixo para personalizar as ações. As ações devem estar alinhadas com os objetivos, desafios, briefings, tarefas em andamento e observações de reuniões da empresa.\n${companyContext}` : ""}

# INSTRUÇÕES
Gere exatamente 12 meses, com 3 a 4 ações por semana (4 semanas por mês), totalizando aproximadamente 150 ações no ano.

As ações DEVEM ser:
- Personalizadas para a realidade específica desta empresa (não genéricas)
- Alinhadas com os objetivos identificados nas reuniões e briefings
- Complementares às tarefas já existentes na jornada
- Progressivas ao longo do ano (ações iniciais preparando terreno para ações posteriores)
- Adaptadas ao porte, localização e recursos da empresa

Para cada ação, retorne um JSON object com:
- title: título curto e específico da ação (referenciando a empresa quando possível)
- description: descrição em 1-2 frases contextualizada
- objective: objetivo da ação alinhado com os objetivos da empresa
- category: uma de [Prospecção, Conteúdo, Parcerias, Eventos, Reativação, Follow-up, Pós-venda, Autoridade, Networking]
- step_by_step: passos para executar (2-4 passos específicos)
- script: exemplo de abordagem/mensagem personalizada se aplicável
- month: número do mês (1-12)
- week: número da semana (1-4)
- goal: meta sugerida específica (ex: "30 leads gerados", "10 reuniões agendadas")

Retorne APENAS um array JSON válido com as ações. Sem texto adicional.`;

      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

      const aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 30000,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", errorText);
        throw new Error("Erro ao chamar IA: " + errorText);
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Resposta da IA não contém JSON válido");
      }

      const generatedActions = JSON.parse(jsonMatch[0]);

      actionsToInsert = generatedActions.map((a: any) => ({
        project_id,
        title: a.title,
        description: a.description || null,
        objective: a.objective || null,
        category: a.category || "Prospecção",
        step_by_step: a.step_by_step || null,
        script: a.script || null,
        responsible_staff_id: consultant_staff_id || null,
        goal: a.goal || null,
        status: "planned",
        month: a.month || null,
        week: a.week || null,
        year,
      }));
    }

    // Insert all actions
    if (actionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("commercial_actions")
        .insert(actionsToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Erro ao salvar ações: " + insertError.message);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: actionsToInsert.length,
      source: (templates && templates.length >= 20) ? "templates" : "ai"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
