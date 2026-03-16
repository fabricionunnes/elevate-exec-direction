import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cardId, videoUrl, editorNotes } = await req.json();
    if (!cardId || !videoUrl) {
      return new Response(JSON.stringify({ error: "cardId and videoUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download video and convert to base64 data URL
    console.log("Downloading video from:", videoUrl);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível baixar o vídeo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBytes = new Uint8Array(videoBuffer);
    
    // Convert to base64
    let binary = "";
    for (let i = 0; i < videoBytes.length; i++) {
      binary += String.fromCharCode(videoBytes[i]);
    }
    const base64Video = btoa(binary);
    
    // Detect MIME type from URL
    const extension = videoUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "mp4";
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
    };
    const mimeType = mimeMap[extension] || "video/mp4";
    const dataUrl = `data:${mimeType};base64,${base64Video}`;
    console.log(`Video converted: ${videoBytes.length} bytes, mime: ${mimeType}`);

    // Build prompt for transcription + emoji suggestions
    const editorContext = editorNotes
      ? `\n\nDirecionamento do editor: "${editorNotes}"`
      : "";

    const systemPrompt = `Você é um editor de vídeo profissional. Analise o vídeo fornecido e retorne:

1. **Transcrição** com timestamps aproximados em segundos (início e fim de cada segmento de fala)
2. **Sugestões de emojis/efeitos** para sobrepor no vídeo em momentos específicos, baseado no conteúdo falado${editorContext}

Use a tool "video_analysis" para retornar os dados estruturados.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise este vídeo, transcreva o áudio com timestamps e sugira emojis/efeitos visuais para os momentos mais impactantes.${editorContext}`,
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "video_analysis",
              description: "Return video transcription and overlay suggestions",
              parameters: {
                type: "object",
                properties: {
                  captions: {
                    type: "array",
                    description: "Transcription segments with timestamps",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Transcribed text segment" },
                        start_time: { type: "number", description: "Start time in seconds" },
                        end_time: { type: "number", description: "End time in seconds" },
                      },
                      required: ["text", "start_time", "end_time"],
                    },
                  },
                  overlays: {
                    type: "array",
                    description: "Suggested emoji/effect overlays",
                    items: {
                      type: "object",
                      properties: {
                        content: { type: "string", description: "Emoji or effect text (e.g. 🔥, 💰, ⚡)" },
                        start_time: { type: "number", description: "When to show (seconds)" },
                        end_time: { type: "number", description: "When to hide (seconds)" },
                        x: { type: "number", description: "X position (0-100 percent from left)" },
                        y: { type: "number", description: "Y position (0-100 percent from top)" },
                        reason: { type: "string", description: "Why this overlay was suggested" },
                      },
                      required: ["content", "start_time", "end_time"],
                    },
                  },
                  suggested_style: {
                    type: "string",
                    enum: ["default", "hormozi", "captions", "minimal", "bold", "neon"],
                    description: "Suggested caption style based on content tone",
                  },
                },
                required: ["captions", "overlays", "suggested_style"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "video_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro na transcrição" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    const { captions, overlays, suggested_style } = analysis;

    // Delete existing captions/overlays for this card
    await supabase.from("social_video_captions").delete().eq("card_id", cardId);
    await supabase.from("social_video_overlays").delete().eq("card_id", cardId);

    // Insert captions
    if (captions?.length > 0) {
      const captionRows = captions.map((c: any, i: number) => ({
        card_id: cardId,
        text: c.text,
        start_time: c.start_time,
        end_time: c.end_time,
        style_preset: suggested_style || "default",
        sort_order: i,
      }));
      await supabase.from("social_video_captions").insert(captionRows);
    }

    // Insert overlays
    if (overlays?.length > 0) {
      const overlayRows = overlays.map((o: any) => ({
        card_id: cardId,
        overlay_type: "emoji",
        content: o.content,
        x: o.x ?? 50,
        y: o.y ?? 20,
        start_time: o.start_time,
        end_time: o.end_time,
        scale: 1.0,
      }));
      await supabase.from("social_video_overlays").insert(overlayRows);
    }

    return new Response(
      JSON.stringify({
        success: true,
        captions_count: captions?.length || 0,
        overlays_count: overlays?.length || 0,
        suggested_style: suggested_style || "default",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcribe error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
