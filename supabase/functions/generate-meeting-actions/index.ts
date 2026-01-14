import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, projectId } = await req.json();

    if (!meetingId || !projectId) {
      return new Response(
        JSON.stringify({ error: "meetingId and projectId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from("onboarding_meeting_notes")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error("Meeting not found");
    }

    // Get transcription content - check notes, transcript, or manual_transcript
    const transcriptionContent = meeting.transcript || meeting.manual_transcript || meeting.notes || "";
    
    if (!transcriptionContent || transcriptionContent.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Reunião não possui transcrição ou notas suficientes para gerar ações" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch project and company details
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select(`
        *,
        consultant:onboarding_staff!consultant_id (id, name),
        company:onboarding_companies!onboarding_company_id (id, name, segment)
      `)
      .eq("id", projectId)
      .single();

    const companyName = project?.company?.name || "Cliente";
    const consultantName = project?.consultant?.name || "Consultor";
    const segment = project?.company?.segment || "";

    // Build prompt for AI
    const systemPrompt = `Você é um assistente especializado em análise de reuniões de consultoria comercial.
Sua tarefa é extrair ações concretas e práticas da transcrição de uma reunião.

REGRAS:
1. Identifique todas as ações, compromissos e próximos passos mencionados na reunião
2. Cada ação deve ser específica, mensurável e ter um prazo realista
3. Os prazos devem ser calculados a partir de hoje e não passar de 30 dias, a menos que explicitamente acordado
4. Use o contexto da empresa para priorizar as ações
5. Retorne um JSON válido com o formato especificado

EMPRESA: ${companyName}
SEGMENTO: ${segment}
CONSULTOR RESPONSÁVEL: ${consultantName}
DATA DA REUNIÃO: ${meeting.meeting_date}`;

    const userPrompt = `Analise a seguinte transcrição/notas da reunião e extraia as ações a serem realizadas:

${transcriptionContent}

Retorne um JSON no seguinte formato (retorne APENAS o JSON, sem markdown):
{
  "actions": [
    {
      "title": "Título da ação (máximo 100 caracteres)",
      "description": "Descrição detalhada do que precisa ser feito",
      "due_days": 7,
      "priority": "high" | "medium" | "low"
    }
  ],
  "phase_name": "Nome sugerido para a fase baseado no tema principal da reunião"
}

IMPORTANTE:
- due_days é o número de dias a partir de hoje para a data de vencimento (máximo 30, a menos que especificado na reunião)
- Ordene as ações por prioridade (high primeiro, depois medium, depois low)
- Inclua entre 3 e 10 ações, focando nas mais importantes
- phase_name deve ser um nome curto e descritivo que resuma o tema da reunião`;

    // Call Lovable AI
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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Por favor, adicione créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error("Erro ao processar com IA");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Parse the JSON response
    let parsedActions;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }
      
      parsedActions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Falha ao interpretar resposta da IA");
    }

    // Validate structure
    if (!parsedActions.actions || !Array.isArray(parsedActions.actions)) {
      throw new Error("Formato de resposta inválido");
    }

    // Add meeting context to response
    const result = {
      meeting: {
        id: meeting.id,
        subject: meeting.subject,
        date: meeting.meeting_date,
      },
      phase_name: parsedActions.phase_name || meeting.subject || "Ações da Reunião",
      actions: parsedActions.actions.map((action: any, index: number) => ({
        id: `temp_${index}`,
        title: action.title?.substring(0, 100) || "Ação sem título",
        description: action.description || "",
        due_days: Math.min(action.due_days || 7, 30),
        priority: ["high", "medium", "low"].includes(action.priority) ? action.priority : "medium",
        selected: true,
      })),
    };

    console.log(`Generated ${result.actions.length} actions for meeting ${meetingId}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating meeting actions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
