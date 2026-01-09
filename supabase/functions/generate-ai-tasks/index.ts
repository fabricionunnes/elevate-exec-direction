import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, userSuggestion } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch project info
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        product_id,
        product_name,
        status,
        product_variables,
        onboarding_company:onboarding_companies(
          id,
          name,
          segment,
          company_description,
          main_challenges,
          goals_short_term,
          goals_long_term,
          target_audience
        )
      `)
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    // Fetch existing tasks (completed and pending)
    const { data: existingTasks, error: tasksError } = await supabase
      .from("onboarding_tasks")
      .select("id, title, description, status, completed_at, observations, tags, due_date")
      .eq("project_id", projectId)
      .order("completed_at", { ascending: false });

    if (tasksError) {
      throw tasksError;
    }

    const completedTasks = existingTasks?.filter(t => t.status === "completed") || [];
    const pendingTasks = existingTasks?.filter(t => t.status !== "completed") || [];

    // Fetch templates for the service
    const { data: templates, error: templatesError } = await supabase
      .from("onboarding_task_templates")
      .select("title, description, phase, priority")
      .eq("product_id", project.product_id)
      .order("phase_order", { ascending: true })
      .order("sort_order", { ascending: true });

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
    }

    // Fetch meeting notes (O que foi tratado nas reuniões)
    const { data: meetingNotes } = await supabase
      .from("onboarding_meeting_notes")
      .select("meeting_title, meeting_date, notes, attendees, transcript, manual_transcript")
      .eq("project_id", projectId)
      .eq("is_finalized", true)
      .order("meeting_date", { ascending: false })
      .limit(15);

    // Build context for AI
    const company = project.onboarding_company as any;
    const companyContext = company ? `
Empresa: ${company.name}
Segmento: ${company.segment || "Não informado"}
Descrição: ${company.company_description || "Não informada"}
Desafios principais: ${company.main_challenges || "Não informados"}
Metas curto prazo: ${company.goals_short_term || "Não informadas"}
Metas longo prazo: ${company.goals_long_term || "Não informadas"}
Público-alvo: ${company.target_audience || "Não informado"}
` : "Informações da empresa não disponíveis";

    const completedTasksContext = completedTasks.length > 0 
      ? completedTasks.slice(0, 30).map(t => `- ${t.title}${t.observations ? ` (Resultado: ${t.observations})` : ""}`).join("\n")
      : "Nenhuma tarefa concluída ainda";

    const pendingTasksContext = pendingTasks.length > 0
      ? pendingTasks.slice(0, 20).map(t => `- ${t.title}`).join("\n")
      : "Nenhuma tarefa pendente";

    const templatesContext = templates && templates.length > 0
      ? templates.slice(0, 40).map(t => `- [${t.phase || "Geral"}] ${t.title}`).join("\n")
      : "Sem templates de referência";

    // Meeting notes context (very important for understanding what was discussed)
    // Include transcript and manual_transcript content
    const meetingsContext = meetingNotes && meetingNotes.length > 0
      ? meetingNotes.map(m => {
          const date = new Date(m.meeting_date).toLocaleDateString('pt-BR');
          const transcriptText = m.transcript || m.manual_transcript || null;
          return `### Reunião ${date}: ${m.meeting_title || 'Sem título'}
Participantes: ${m.attendees || 'N/A'}
O que foi tratado:
${m.notes?.substring(0, 500) || 'Sem notas'}${m.notes && m.notes.length > 500 ? '...' : ''}
${transcriptText ? `Transcrição:
${transcriptText.substring(0, 2000)}${transcriptText.length > 2000 ? '...' : ''}` : ''}`;
        }).join("\n\n")
      : "Nenhuma reunião registrada";

    const userSuggestionContext = userSuggestion 
      ? `\nSOLICITAÇÃO DO CONSULTOR:\n"${userSuggestion}"\n\nIMPORTANTE: Priorize a solicitação acima na geração das tarefas. Crie tarefas específicas para atender o que foi pedido.`
      : "";

    // Detect if user specified a quantity in their suggestion
    let requestedQuantity: number | null = null;
    if (userSuggestion) {
      // Match patterns like "10 tarefas", "15 ações", "gere 5", "criar 8 tasks", etc.
      const quantityMatch = userSuggestion.match(/(\d+)\s*(tarefas?|ações?|tasks?|atividades?|itens?)/i) 
        || userSuggestion.match(/gere?\s*(\d+)/i)
        || userSuggestion.match(/criar?\s*(\d+)/i)
        || userSuggestion.match(/(\d+)\s*(novas?)?/i);
      
      if (quantityMatch) {
        const num = parseInt(quantityMatch[1], 10);
        if (num >= 1 && num <= 50) {
          requestedQuantity = num;
        }
      }
    }

    const quantityInstruction = requestedQuantity 
      ? `Gere EXATAMENTE ${requestedQuantity} tarefas conforme solicitado pelo consultor.`
      : "Sugira de 3 a 5 NOVAS tarefas que façam sentido para o momento atual do cliente.";

    const prompt = `Você é um consultor especialista em vendas e gestão comercial da UNV (Universidade Nacional de Vendas).

CONTEXTO DO CLIENTE:
${companyContext}

SERVIÇO CONTRATADO: ${project.product_name}
${userSuggestionContext}

TAREFAS JÁ REALIZADAS (NÃO SUGERIR ESTAS NOVAMENTE DA MESMA FORMA):
${completedTasksContext}

TAREFAS PENDENTES (JÁ PLANEJADAS):
${pendingTasksContext}

TEMPLATES DE REFERÊNCIA DO SERVIÇO:
${templatesContext}

REUNIÕES REALIZADAS (O QUE FOI TRATADO - MUITO IMPORTANTE PARA CONTEXTO):
${meetingsContext}

INSTRUÇÕES:
1. ${userSuggestion ? "Foque principalmente na solicitação do consultor acima" : "Analise o contexto do cliente, tarefas já realizadas e resultados obtidos"}
2. ${quantityInstruction}
3. NÃO repita tarefas já realizadas da mesma forma - pode evoluir ou criar variações mais avançadas
4. Considere os desafios e metas do cliente para personalizar as sugestões
5. Se identificar gaps no que já foi feito, sugira tarefas para cobri-los
6. Priorize tarefas práticas e executáveis
7. IMPORTANTE: O texto do consultor define exatamente o tema/foco das tarefas. Siga fielmente o que foi pedido.

Responda APENAS com um array JSON válido no seguinte formato (sem markdown, sem explicações):
[
  {
    "title": "Título da tarefa",
    "description": "Descrição detalhada da tarefa e como executá-la",
    "priority": "high|medium|low",
    "phase": "Nome da fase (ex: Diagnóstico, Implementação, Escala)",
    "reasoning": "Breve justificativa de por que esta tarefa é relevante agora"
  }
]`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to generate tasks with AI");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("Empty response from AI");
    }

    // Parse JSON from AI response (handle potential markdown wrapper)
    let suggestedTasks;
    try {
      let jsonString = aiContent.trim();
      // Remove markdown code blocks if present
      if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      suggestedTasks = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(suggestedTasks)) {
      throw new Error("AI response is not an array");
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks: suggestedTasks,
        context: {
          completedCount: completedTasks.length,
          pendingCount: pendingTasks.length,
          companyName: company?.name || project.product_name,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in generate-ai-tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
