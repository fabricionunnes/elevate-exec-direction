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

function chunkWordsIntoCaptions(
  words: TranscriptWord[] = [],
  fallbackText = "",
): Array<{ text: string; start_time: number; end_time: number }> {
  if (!words.length) {
    const text = fallbackText.trim();
    return text ? [{ text, start_time: 0, end_time: 3 }] : [];
  }

  const captions: Array<{ text: string; start_time: number; end_time: number }> = [];
  let currentWords: TranscriptWord[] = [];
  let currentStart = words[0].start;

  for (const word of words) {
    if (!currentWords.length) {
      currentWords = [word];
      currentStart = word.start;
      continue;
    }

    const elapsedMs = word.end - currentStart;
    const cleanText = word.text.trim();
    const endsSentence = /[.!?,:;]$/.test(cleanText);
    const shouldBreak = currentWords.length >= 4 || elapsedMs >= 1800 || endsSentence;

    if (shouldBreak) {
      const lastWord = currentWords[currentWords.length - 1];
      captions.push({
        text: currentWords.map((item) => item.text).join(" ").replace(/\s+([.,!?;:])/g, "$1").trim(),
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
      text: currentWords.map((item) => item.text).join(" ").replace(/\s+([.,!?;:])/g, "$1").trim(),
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
      language_code: "pt",
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

async function generateRichEditing(
  transcriptText: string,
  captions: Array<{ text: string; start_time: number; end_time: number }>,
  editorNotes: string | null | undefined,
  lovableApiKey: string | null,
) {
  const emptyResult = {
    headline: "",
    overlays: [],
    suggested_style: defaultStyle,
  };

  if (!lovableApiKey || !transcriptText.trim()) {
    return emptyResult;
  }

  const editorContext = editorNotes ? `\n\nDirecionamento do editor: "${editorNotes}"` : "";
  const timestampedScript = captions
    .map((c) => `[${c.start_time.toFixed(2)}s - ${c.end_time.toFixed(2)}s] ${c.text}`)
    .join("\n");

  const lastCaptionEnd = captions.length > 0 ? captions[captions.length - 1].end_time : 10;

  const systemPrompt = `Você é um editor de vídeos curtos profissional para Reels/TikTok em português do Brasil. Sua tarefa é criar uma edição RICA e COMPLETA com base na transcrição.${editorContext}

REGRAS IMPORTANTES:
1. HEADLINE: Crie uma frase de gancho impactante e curta (máx 8 palavras) que capture a atenção nos primeiros 2 segundos. Deve ser provocativa, gerar curiosidade.

2. OVERLAYS - Distribua ao longo de TODO o vídeo (0s até ${lastCaptionEnd.toFixed(1)}s). Tipos:
   - "emoji": Emojis que reforçam o que está sendo dito (🔥💰⚡🎯🚀💡✅❌📈🏆💎👀🤯💪)
   - "text_highlight": Frases curtas de impacto visual que aparecem na tela (ex: "ATENÇÃO!", "Isso é CRUCIAL", "Anota aí")
   - "zoom_cue": Marcações de momentos que merecem zoom/ênfase (será aplicado efeito de zoom no player)
   - "broll_keyword": Palavras-chave para imagens de apoio que ilustram o que está sendo dito (ex: "dinheiro", "crescimento", "equipe")

3. Gere PELO MENOS:
   - 8-15 overlays de emoji distribuídos
   - 4-8 text_highlights em momentos-chave
   - 3-6 zoom_cues em frases impactantes
   - 3-6 broll_keywords para ilustrações

4. Posicionamento (x, y em %):
   - Emojis: variar posição (topo, laterais, centro)
   - text_highlight: centro-superior (x:50, y:15-25)
   - zoom_cue: centro (x:50, y:50)
   - broll_keyword: centro (x:50, y:50)

5. Escolha o melhor estilo de legenda.

Use a tool "rich_video_edit" para retornar os dados.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Transcrição completa:\n${transcriptText}\n\nLegenda segmentada com timestamps:\n${timestampedScript}\n\nCrie uma edição profissional rica com headline, overlays variados (emoji, text_highlight, zoom_cue, broll_keyword) distribuídos ao longo de todo o vídeo.${editorContext}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "rich_video_edit",
            description: "Return headline, rich overlays and caption style for the video",
            parameters: {
              type: "object",
              properties: {
                headline: {
                  type: "string",
                  description: "Short hook phrase for the first 2 seconds (max 8 words)",
                },
                overlays: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      overlay_type: {
                        type: "string",
                        enum: ["emoji", "text_highlight", "zoom_cue", "broll_keyword"],
                      },
                      content: { type: "string" },
                      start_time: { type: "number" },
                      end_time: { type: "number" },
                      x: { type: "number" },
                      y: { type: "number" },
                    },
                    required: ["overlay_type", "content", "start_time", "end_time"],
                  },
                },
                suggested_style: {
                  type: "string",
                  enum: ["default", "hormozi", "captions", "minimal", "bold", "neon"],
                },
              },
              required: ["headline", "overlays", "suggested_style"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "rich_video_edit" } },
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
    return emptyResult;
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    return emptyResult;
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    headline: parsed?.headline ?? "",
    overlays: parsed?.overlays ?? [],
    suggested_style: parsed?.suggested_style ?? defaultStyle,
  };
}

async function persistAnalysis(
  supabase: ReturnType<typeof createClient>,
  cardId: string,
  captions: Array<{ text: string; start_time: number; end_time: number }>,
  overlays: Array<{ overlay_type?: string; content: string; start_time: number; end_time: number; x?: number; y?: number }>,
  stylePreset: string,
  headline: string,
) {
  await Promise.all([
    supabase.from("social_video_captions").delete().eq("card_id", cardId),
    supabase.from("social_video_overlays").delete().eq("card_id", cardId),
  ]);

  // Save headline as a special overlay
  if (headline) {
    const firstCaptionEnd = captions.length > 0 ? Math.min(captions[0].end_time, 3) : 3;
    overlays.unshift({
      overlay_type: "headline",
      content: headline,
      start_time: 0,
      end_time: firstCaptionEnd,
      x: 50,
      y: 12,
    });
  }

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
      overlay_type: overlay.overlay_type || "emoji",
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
      const { headline, overlays, suggested_style } = await generateRichEditing(
        transcript.text || captions.map((c) => c.text).join(" "),
        captions,
        editorNotes,
        lovableApiKey,
      );

      await persistAnalysis(supabase, cardId, captions, overlays, suggested_style || defaultStyle, headline);

      return jsonResponse({
        success: true,
        status: "completed",
        captions_count: captions.length,
        overlays_count: overlays.length + (headline ? 1 : 0),
        suggested_style: suggested_style || defaultStyle,
        headline,
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
