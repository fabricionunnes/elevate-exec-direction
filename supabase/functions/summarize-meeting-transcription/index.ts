import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const extractJsonFromContent = (content: string): Record<string, unknown> => {
  const clean = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Falha ao interpretar resposta de resumo");
    return JSON.parse(jsonMatch[0]);
  }
};

const normalizeAlignments = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 5);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(/\r?\n|•|- /)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  return [];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, forceRegenerate = false } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: "meetingId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL is not configured");
    }

    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: meeting, error: meetingError } = await supabase
      .from("onboarding_meeting_notes")
      .select("id, project_id, meeting_title, subject, meeting_date, transcript, notes")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: "Reunião não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcription = (meeting.transcript || meeting.notes || "").trim();
    if (transcription.length < 120) {
      return new Response(
        JSON.stringify({ error: "Transcrição insuficiente para gerar resumo por IA" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingBriefing } = await supabase
      .from("onboarding_meeting_briefings")
      .select("id, briefing_content")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    let existingPayload: Record<string, unknown> = {};

    if (existingBriefing?.briefing_content) {
      try {
        existingPayload = JSON.parse(existingBriefing.briefing_content) as Record<string, unknown>;
      } catch {
        existingPayload = {};
      }
    }

    const cachedSummary = typeof existingPayload.report_summary === "string"
      ? existingPayload.report_summary.trim()
      : "";
    const cachedAlignments = normalizeAlignments(existingPayload.report_alignments);

    if (!forceRegenerate && cachedSummary) {
      return new Response(
        JSON.stringify({
          summary: cachedSummary,
          alignments: cachedAlignments,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é especialista em análise de reuniões de consultoria e gestão.
Sua missão é ler a transcrição COMPLETA e gerar um resumo executivo claro e útil para relatório mensal.

Regras obrigatórias:
1) Leia toda a transcrição fornecida (não apenas início).
2) Não copie a conversa literalmente.
3) Resuma o que foi decidido, problemas levantados e combinados.
4) Ignore cumprimentos e conversas paralelas.
5) Escreva em português do Brasil.

Retorne APENAS JSON válido no formato:
{
  "summary": "Parágrafo objetivo de 5 a 8 frases com visão executiva da reunião",
  "alignments": ["3 a 5 principais alinhamentos/combinados de forma objetiva"]
}`;

    const userPrompt = `Título: ${meeting.subject || meeting.meeting_title || "Reunião"}
Data: ${meeting.meeting_date || "Não informada"}

TRANSCRIÇÃO COMPLETA:
${transcription}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes para gerar o resumo da reunião." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorBody = await aiResponse.text();
      throw new Error(`AI Gateway error [${aiResponse.status}]: ${errorBody}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("Resposta vazia da IA");
    }

    const parsed = extractJsonFromContent(content);

    const summary = typeof parsed.summary === "string"
      ? parsed.summary.trim()
      : "";
    const alignments = normalizeAlignments(parsed.alignments);

    if (!summary) {
      throw new Error("Resumo inválido retornado pela IA");
    }

    const mergedPayload: Record<string, unknown> = {
      ...existingPayload,
      report_summary: summary,
      report_alignments: alignments,
      report_generated_at: new Date().toISOString(),
    };

    await supabase
      .from("onboarding_meeting_briefings")
      .upsert(
        {
          meeting_id: meeting.id,
          project_id: meeting.project_id,
          briefing_content: JSON.stringify(mergedPayload),
        },
        { onConflict: "meeting_id" }
      );

    return new Response(
      JSON.stringify({ summary, alignments, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error summarizing meeting transcription:", error);
    const message = error instanceof Error ? error.message : "Erro interno ao resumir reunião";

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
