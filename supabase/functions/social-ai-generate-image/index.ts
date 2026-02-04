import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, prompt, format, includeLogoPref } = await req.json();

    if (!projectId || !prompt) {
      return new Response(
        JSON.stringify({ error: "projectId and prompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load briefing data for brand context
    const { data: briefing } = await supabase
      .from("social_briefing_forms")
      .select("*")
      .eq("project_id", projectId)
      .single();

    // Load company profile
    const { data: profile } = await supabase
      .from("social_company_profiles")
      .select("*")
      .eq("project_id", projectId)
      .single();

    // Load logo if available - use briefing_id from the briefing form
    let logoUrl: string | null = null;
    if (briefing?.id) {
      const { data: uploads } = await supabase
        .from("social_briefing_uploads")
        .select("*")
        .eq("briefing_id", briefing.id)
        .eq("file_type", "logo");
      
      logoUrl = uploads?.[0]?.file_url || null;
      console.log("Found logo for briefing:", briefing.id, "URL:", logoUrl);
    }

    // Build enhanced prompt with brand context
    let enhancedPrompt = buildEnhancedPrompt(prompt, briefing, profile, format, includeLogoPref && logoUrl);

    console.log("Generating image with prompt:", enhancedPrompt);
    console.log("Logo URL for inclusion:", includeLogoPref && logoUrl ? logoUrl : "none");

    // Build the message content - include logo image if requested
    let messageContent: any;
    
    if (includeLogoPref && logoUrl) {
      // Multimodal message with logo image reference
      messageContent = [
        {
          type: "text",
          text: enhancedPrompt
        },
        {
          type: "image_url",
          image_url: {
            url: logoUrl
          }
        }
      ];
    } else {
      messageContent = enhancedPrompt;
    }

    // Call Lovable AI for image generation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to generate image");
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = aiData.choices?.[0]?.message?.content;

    if (!imageData) {
      console.error("No image generated, response:", JSON.stringify(aiData));
      throw new Error("No image generated");
    }

    // Upload the generated image to Supabase Storage
    const base64Data = imageData.split(",")[1];
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${projectId}/ai-generated/${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from("social-briefing")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: false
      });

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      throw new Error("Failed to save generated image");
    }

    const { data: { publicUrl } } = supabase.storage
      .from("social-briefing")
      .getPublicUrl(fileName);

    // Log for audit
    await supabase.from("social_audit_logs").insert({
      project_id: projectId,
      entity_type: "ai_image",
      entity_id: projectId,
      action: "generate",
      changes: { 
        prompt: prompt,
        format: format,
        image_url: publicUrl
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        image_url: publicUrl,
        image_base64: imageData,
        message: textContent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating image:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEnhancedPrompt(
  basePrompt: string, 
  briefing: any, 
  profile: any, 
  format: string,
  includeLogo: boolean
): string {
  // Determine aspect ratio and dimensions based on format
  // Instagram Feed: 1080x1350 (4:5 aspect ratio)
  // Stories/Reels: 1080x1920 (9:16 aspect ratio)
  // Cover: 1920x1080 (16:9 aspect ratio)
  let aspectRatio = "4:5"; // Default for feed posts (1080x1350)
  let dimensions = "1080x1350";
  if (format === "story" || format === "reel") {
    aspectRatio = "9:16";
    dimensions = "1080x1920";
  } else if (format === "cover") {
    aspectRatio = "16:9";
    dimensions = "1920x1080";
  } else if (format === "carousel") {
    aspectRatio = "4:5";
    dimensions = "1080x1350";
  }

  let prompt = `CRITICAL: Generate an image with EXACT dimensions ${dimensions} pixels and ${aspectRatio} aspect ratio.

This is for Instagram ${format || "feed post"}.
The image MUST be portrait orientation (taller than wide) with exact ${aspectRatio} ratio.
Width: ${dimensions.split("x")[0]} pixels
Height: ${dimensions.split("x")[1]} pixels

Visual Request: ${basePrompt}

`;

  // Add brand context
  if (profile?.tone_of_voice) {
    prompt += `Brand tone: ${profile.tone_of_voice}\n`;
  }

  if (briefing?.brand_perception) {
    prompt += `Brand personality: ${briefing.brand_perception}\n`;
  }

  // Add style guidelines
  prompt += `
Style guidelines:
- Modern, clean, professional design
- High quality, visually appealing
- Suitable for social media marketing
- Clear focal point and good composition
`;

  if (includeLogo) {
    prompt += `
LOGO INCLUSION INSTRUCTIONS:
- I am providing the brand logo image as a reference
- You MUST incorporate this exact logo into the generated image
- Place the logo in a subtle but visible position (corner or appropriate area)
- The logo should be proportionally sized (not too large, not too small)
- Maintain the logo's original colors and proportions
- The logo should blend naturally with the overall design
`;
  }

  prompt += `
IMPORTANT:
- Do NOT include any other text or typography in the image (except the provided logo if requested)
- Create a visually striking image that works as a background for text overlays
- Ultra high resolution, professional quality
`;

  return prompt;
}
