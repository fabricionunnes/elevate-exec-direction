import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

type CaptionRow = {
  card_id: string;
  text: string;
  start_time: number;
  end_time: number;
  style_preset: string;
  sort_order: number;
};

type OverlayRow = {
  card_id: string;
  overlay_type: string;
  content: string;
  x: number;
  y: number;
  start_time: number;
  end_time: number;
  scale: number;
};

const defaultStyle = "default";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunkWordsIntoCaptions(words: TranscriptWord[] = [], fallbackText = ""): Array<{ text: string; start_time: number; end_time: number; }> {
  if (!words.length) {
    const text = fallbackText.trim();
    return text
      ? [{ text, start_time: 0, end_time: 3 }]
      : [];
  }

  const captions: Array<{ text: string; start_time: number; end_time: number; }> = [];
  let currentWords: TranscriptWord[] = [];
  let currentStart = words[0].start;

  for (const word of words) {
    if (!currentWords.length) {
      currentWords = [word];
      currentStart = word.start;
      continue;
    }

    const elapsedMs = word.end - currentStart;
    const shouldBreak = currentWords.length >= 6 || elapsedMs >= 2800;

    if (shouldBreak) {
      const lastWord = currentWords[currentWords.length - 1];
      captions.push({
        text: currentWords.map((item) => item.text).join(" ").trim(),
        start_time: currentStart / 1000,
        end_time: lastWord.end / 1000,
      });
      currentWords = [word];
      currentStart = word.start;
    } else {
      currentWords.push(word);
    }
  }

  if (currentWords.length) {
    const lastWord = currentWords[currentWords.length - 1];
    captions.push({
      text: currentWords.map((item) => item.text).join(" ").trim(),
      start_time: currentStart / 1000,
      end_time: lastWord.end / 1000,
    });
  }

  return captions.filter((caption) => caption.text.length > 0);
}

async function submitTranscription(videoUrl: string, assemblyKey: string) {
  const response = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: assemblyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: videoUrl,
      punctuate: true,
      format_text: true,
      speaker_labels: false,
      speech_model: "best",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("AssemblyAI submit error:", response.status, data);
    throw new Error(data?.error || "Erro ao iniciar transcrição externa");
  }

  return data;
}

async function getTranscriptionStatus(transcriptId: string, assemblyKey: string) {
  const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
    headers: { Authorization: assemblyKey },
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("AssemblyAI status error:", response.status, data);
    throw new Error(data?.error || "Erro ao consultar status da transcrição");
  }

  return data;
}

async function generateOverlaysAndStyle(
  transcriptText: string,
  editorNotes: string | null | undefined,
  lovableApiKey: string | null,
) {
  if (!lovableApiKey || !transcriptText.trim()) {
    return { overlays: [], suggested_style: defaultStyle };
  }

  const editorContext = editorNotes ? `\n\nDirecionamento do editor: "${editorNotes}"` : "";
  const systemPrompt = `Você é um editor de vídeo profissional. Com base APENAS na transcrição abaixo, sugira overlays rápidos para vídeo short-form e um estilo de legenda.${editorContext}\n\nUse a tool \"video_analysis\" para retornar os dados estruturados.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Transcrição:\n${transcriptText}\n\nRetorne sugestões de overlays com timestamps coerentes com o conteúdo falado.${editorContext}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "video_analysis",
            description: "Return overlay suggestions and caption style from transcript",
            parameters: {
              type: "object",
              properties: {
                overlays: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string" },
                      start_time: { type: "number" },
                      end_time: { type: "number" },
                      x: { type: "number" },
                      y: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["content", "start_time", "end_time"],
                  },
                },
                suggested_style: {
                  type: "string",
                  enum: ["default", "hormozi", "captions", "minimal", "bold", "neon"],
                },
              },
              required: ["overlays", "suggested_style"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "video_analysis" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      throw new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errorText = await response.text();
    console.error("AI gateway overlay error:", response.status, errorText);
    return { overlays: [], suggested_style: defaultStyle };
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    return { overlays: [], suggested_style: defaultStyle };
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    overlays: parsed?.overlays ?? [],
    suggested_style: parsed?.suggested_style ?? defaultStyle,
  };
}

async function persistAnalysis(
  supabase: ReturnType<typeof createClient>,
  cardId: string,
  captions: Array<{ text: string; start_time: number; end_time: number }>,
  overlays: Array<{ content: string; start_time: number; end_time: number; x?: number; y?: number }>,
  stylePreset: string,
) {
  await Promise.all([
    supabase.from("social_video_captions").delete().eq("card_id", cardId),
    supabase.from("social_video_overlays").delete().eq("card_id", cardId),
  ]);

  if (captions.length) {
    const captionRows: CaptionRow[] = captions.map((caption, index) => ({
      card_id: cardId,
      text: caption.text,
      start_time: caption.start_time,
      end_time: caption.end_time,
      style_preset: stylePreset || defaultStyle,
      sort_order: index,
    }));

    const { error } = await supabase.from("social_video_captions").insert(captionRows);
    if (error) throw error;
  }

  if (overlays.length) {
    const overlayRows: OverlayRow[] = overlays.map((overlay) => ({
      card_id: cardId,
      overlay_type: "emoji",
      content: overlay.content,
      x: overlay.x ?? 50,
      y: overlay.y ?? 20,
      start_time: overlay.start_time,
      end_time: overlay.end_time,
      scale: 1,
    }));

    const { error } = await supabase.from("social_video_overlays").insert(overlayRows);
    if (error) throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action = "start", cardId, videoUrl, editorNotes, transcriptId } = body;

    const assemblyKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!assemblyKey) {
      return jsonResponse({ error: "ASSEMBLYAI_API_KEY not configured" }, 500);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "start") {
      if (!cardId || !videoUrl) {
        return jsonResponse({ error: "cardId and videoUrl are required" }, 400);
      }

      const submission = await submitTranscription(videoUrl, assemblyKey);
      return jsonResponse({
        success: true,
        status: submission.status ?? "queued",
        transcriptId: submission.id,
      });
    }

    if (action === "status") {
      if (!cardId || !transcriptId) {
        return jsonResponse({ error: "cardId and transcriptId are required" }, 400);
      }

      const transcript = await getTranscriptionStatus(transcriptId, assemblyKey);

      if (transcript.status === "queued" || transcript.status === "processing") {
        return jsonResponse({
          success: true,
          status: transcript.status,
          transcriptId,
        });
      }

      if (transcript.status === "error") {
        return jsonResponse({ error: transcript.error || "Falha na transcrição externa" }, 500);
      }

      const captions = chunkWordsIntoCaptions(transcript.words, transcript.text);
      const { overlays, suggested_style } = await generateOverlaysAndStyle(
        transcript.text || captions.map((caption) => caption.text).join(" "),
        editorNotes,
        lovableApiKey,
      );

      await persistAnalysis(supabase, cardId, captions, overlays, suggested_style || defaultStyle);

      return jsonResponse({
        success: true,
        status: "completed",
        captions_count: captions.length,
        overlays_count: overlays.length,
        suggested_style: suggested_style || defaultStyle,
      });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Transcribe error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      500,
    );
  }
});