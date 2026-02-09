import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quizId, lessonTranscript, numQuestions = 5 } = await req.json();

    if (!quizId || !lessonTranscript) {
      return new Response(
        JSON.stringify({ error: "quizId and lessonTranscript are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI
    const prompt = `Você é um especialista em educação corporativa. Com base no seguinte conteúdo de aula, gere ${numQuestions} questões de múltipla escolha para avaliar o aprendizado.

CONTEÚDO DA AULA:
${lessonTranscript.substring(0, 8000)}

REGRAS:
1. Crie questões que testem compreensão, não apenas memorização
2. Cada questão deve ter 4 alternativas
3. Apenas UMA alternativa deve estar correta
4. Varie a dificuldade (easy, medium, hard)
5. Inclua uma breve explicação para cada resposta correta

Responda APENAS com um JSON válido no seguinte formato:
{
  "questions": [
    {
      "question_text": "Pergunta aqui?",
      "options": [
        {"text": "Opção A", "isCorrect": false},
        {"text": "Opção B", "isCorrect": true},
        {"text": "Opção C", "isCorrect": false},
        {"text": "Opção D", "isCorrect": false}
      ],
      "explanation": "Explicação de por que a resposta B está correta",
      "difficulty": "medium"
    }
  ]
}`;

    // Call Lovable AI (Google Gemini)
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_AI_KEY")}`,
        "Content-Type": "application/json",
        "HTTP-Referer": supabaseUrl,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      throw new Error("Failed to generate questions with AI");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content from AI response");
    }

    // Parse JSON from response
    let questionsData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        questionsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
      throw new Error("Invalid questions format from AI");
    }

    // Get current question count for sort order
    const { count: existingCount } = await supabase
      .from("academy_quiz_questions")
      .select("id", { count: "exact" })
      .eq("quiz_id", quizId);

    // Insert questions
    const questionsToInsert = questionsData.questions.map((q: any, index: number) => ({
      quiz_id: quizId,
      question_text: q.question_text,
      question_type: "multiple_choice",
      options: q.options,
      explanation: q.explanation,
      difficulty: q.difficulty || "medium",
      points: q.difficulty === "hard" ? 15 : q.difficulty === "easy" ? 5 : 10,
      is_ai_generated: true,
      is_approved: false, // Admin must approve
      sort_order: (existingCount || 0) + index + 1,
    }));

    const { error: insertError } = await supabase
      .from("academy_quiz_questions")
      .insert(questionsToInsert);

    if (insertError) {
      console.error("Error inserting questions:", insertError);
      throw insertError;
    }

    console.log(`Generated ${questionsToInsert.length} questions for quiz ${quizId}`);

    return new Response(
      JSON.stringify({
        success: true,
        questionsGenerated: questionsToInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in academy-generate-quiz:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
