import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { participant_id, task_id, text } = await req.json();
    if (!participant_id || !task_id || !text) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get task info
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: task } = await supabase.from("pdi_tasks").select("title, description").eq("id", task_id).single();
    const taskTitle = task?.title || "Tarefa";
    const taskDesc = task?.description || "";

    // Call AI to evaluate
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é a IA Avaliadora de Aprendizado do Plano de Desenvolvimento Individual (PDI).
Avalie o resumo/resposta do participante com base na tarefa proposta.

Critérios de avaliação:
1. Qualidade da reflexão (0-25 pontos)
2. Compreensão do conteúdo (0-25 pontos)
3. Aplicação prática (0-25 pontos)
4. Profundidade da análise (0-25 pontos)

Retorne EXATAMENTE no formato JSON:
{
  "score": <número de 0 a 10>,
  "feedback": "<feedback construtivo em português, máximo 300 palavras, incluindo pontos fortes e sugestões de melhoria>"
}`
          },
          {
            role: "user",
            content: `Tarefa: ${taskTitle}\nDescrição: ${taskDesc}\n\nResposta do participante:\n${text}`
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_summary",
              description: "Avalia o resumo e retorna score e feedback",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Nota de 0 a 10" },
                  feedback: { type: "string", description: "Feedback construtivo" },
                },
                required: ["score", "feedback"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "evaluate_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI evaluation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let score = 5;
    let feedback = "Avaliação processada.";

    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        score = Math.min(10, Math.max(0, Number(args.score) || 5));
        feedback = args.feedback || feedback;
      } catch { /* use defaults */ }
    }

    // Update submission with AI results
    const { data: submission } = await supabase.from("pdi_task_submissions")
      .select("id")
      .eq("participant_id", participant_id)
      .eq("task_id", task_id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single();

    if (submission) {
      await supabase.from("pdi_task_submissions").update({
        ai_score: score,
        ai_feedback: feedback,
        status: "reviewed",
        reviewed_at: new Date().toISOString(),
      }).eq("id", submission.id);
    }

    return new Response(JSON.stringify({ score, feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pdi-evaluate-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
