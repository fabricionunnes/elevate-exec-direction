import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
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
    const bruto = meeting.transcript || meeting.manual_transcript || meeting.notes || "";
    // Notas muito longas (reunião de 30k+ caracteres) espremem o espaço da
    // resposta e o JSON volta cortado. Mantém início e fim, que é onde ficam
    // contexto e encaminhamentos.
    const LIMITE = 24000;
    const transcriptionContent = bruto.length > LIMITE
      ? `${bruto.slice(0, LIMITE * 0.6)}\n\n[...trecho do meio omitido por tamanho...]\n\n${bruto.slice(-LIMITE * 0.4)}`
      : bruto;
    
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
        company:onboarding_companies!onboarding_company_id (id, name, segment, owner_name)
      `)
      .eq("id", projectId)
      .single();

    const companyName = project?.company?.name || "Cliente";
    const consultantName = project?.consultant?.name || "Consultor";
    const segment = project?.company?.segment || "";
    const ownerName = project?.company?.owner_name || "";

    // Time da empresa: âncora pra detectar transcrição anexada no cliente errado
    // (caso real: reunião da Terra Passos transcrita dentro da Vitale gerou
    // tarefas de outra empresa no projeto). A IA confere nomes/segmento.
    let teamNames = "";
    if (project?.company?.id) {
      const { data: sellers } = await supabase
        .from("company_salespeople")
        .select("name")
        .eq("company_id", project.company.id)
        .eq("is_active", true)
        .limit(20);
      teamNames = (sellers || []).map((s: any) => s.name).join(", ");
    }

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
TIME DE VENDAS DA EMPRESA: ${teamNames || "não cadastrado"}
CONSULTOR RESPONSÁVEL: ${consultantName}
DATA DA REUNIÃO: ${meeting.meeting_date}

VERIFICAÇÃO DE PERTENCIMENTO (obrigatória antes de extrair ações):
Antes de extrair, confirme que a reunião pertence a ${companyName}${ownerName ? ` (dono: ${ownerName})` : ""}${segment ? `, do ramo de ${segment}` : ""}.
ATENÇÃO — só marque como outra empresa se houver evidência FORTE, por exemplo: o nome de outra empresa cliente aparece como dona da reunião, ou o ramo discutido é claramente incompatível com o da empresa acima.
NÃO é sinal de outra empresa: a reunião ser só com o dono ou com um gestor; nenhum vendedor da lista aparecer (reunião de diretoria é assim); nomes de participantes que você não reconhece; o consultor da UNV conduzindo sozinho.
Na dúvida, EXTRAIA as ações normalmente. Só se tiver certeza de que é outra empresa retorne: {"mismatch": true, "motivo": "1 frase explicando"}.`;

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
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
          max_tokens: 8096,
        system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
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
    const content = aiData.content?.[0]?.text;

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

    // A IA pode concluir que a reunião é de OUTRA empresa — é uma resposta
    // legítima, prevista no prompt. Devolve 200 pro front avisar direito.
    if (parsedActions?.mismatch) {
      return new Response(
        JSON.stringify({ mismatch: true, motivo: parsedActions.motivo || "" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sem ações: pode ser reunião sem encaminhamento nenhum. Também é 200, com
    // a lista vazia, em vez de estourar erro genérico.
    if (!parsedActions.actions || !Array.isArray(parsedActions.actions)) {
      console.error("[meeting-actions] resposta sem 'actions':", JSON.stringify(parsedActions).slice(0, 400));
      return new Response(
        JSON.stringify({
          meeting: { id: meeting.id, subject: meeting.subject, date: meeting.meeting_date },
          phase_name: meeting.subject || "Ações da Reunião",
          actions: [],
          aviso: "A IA não encontrou ações claras nesta reunião. Revise as notas ou crie as tarefas manualmente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
