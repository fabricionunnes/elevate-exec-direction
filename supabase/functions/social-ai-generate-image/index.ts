import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

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

    const { projectId, prompt, format, includeLogoPref, carouselCount, carouselConnected, referenceImageUrl } = await req.json();

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
    let enhancedPrompt = buildEnhancedPrompt(prompt, briefing, profile, format, includeLogoPref && logoUrl, referenceImageUrl);

    console.log("Generating image with prompt:", enhancedPrompt);
    console.log("Logo URL for inclusion:", includeLogoPref && logoUrl ? logoUrl : "none");
    console.log("Reference image URL:", referenceImageUrl || "none");
    console.log("Carousel count:", carouselCount || 1);
    console.log("Carousel connected:", carouselConnected || false);

    // Build the message content - include logo image if requested
    const messageImages: { type: string; image_url: { url: string } }[] = [];
    
    if (includeLogoPref && logoUrl) {
      messageImages.push({
        type: "image_url",
        image_url: { url: logoUrl }
      });
    }
    
    if (referenceImageUrl) {
      messageImages.push({
        type: "image_url",
        image_url: { url: referenceImageUrl }
      });
    }

    const messageContent: any = messageImages.length > 0 
      ? [{ type: "text", text: enhancedPrompt }, ...messageImages]
      : enhancedPrompt;

    // Handle carousel generation
    if (format === "carousel" && carouselCount && carouselCount > 1) {
      const images: string[] = [];
      const { width: targetW, height: targetH } = getTargetDimensions(format);
      
      for (let i = 0; i < carouselCount; i++) {
        let carouselPrompt = enhancedPrompt;
        
        if (carouselConnected) {
          // For connected carousel, generate panoramic slices
          // Reference image only on first slide for connected carousels
          const useRefImage = i === 0 ? referenceImageUrl : null;
          carouselPrompt = buildConnectedCarouselPrompt(prompt, briefing, profile, i + 1, carouselCount, includeLogoPref && logoUrl, useRefImage);
        } else {
          // For separate images, add variation instruction
          // Reference image only on first slide
          const isFirstSlide = i === 0;
          if (isFirstSlide && referenceImageUrl) {
            carouselPrompt = `${enhancedPrompt}\n\nThis is image ${i + 1} of ${carouselCount} in a carousel. This is the MAIN image featuring the reference subject prominently.`;
          } else {
            carouselPrompt = `${enhancedPrompt}\n\nThis is image ${i + 1} of ${carouselCount} in a carousel. Create a unique variation that maintains the same theme and style. Do NOT include the reference subject in this image - focus on complementary visuals.`;
          }
        }

        // Only include reference image on the first slide
        const slideImages: { type: string; image_url: { url: string } }[] = [];
        if (includeLogoPref && logoUrl) {
          slideImages.push({ type: "image_url", image_url: { url: logoUrl } });
        }
        if (i === 0 && referenceImageUrl) {
          slideImages.push({ type: "image_url", image_url: { url: referenceImageUrl } });
        }

        const carouselMessageContent: any = slideImages.length > 0 
          ? [{ type: "text", text: carouselPrompt }, ...slideImages]
          : carouselPrompt;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: carouselMessageContent }],
            modalities: ["image", "text"]
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for carousel image ${i + 1}:`, errorText);
          
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
          
          continue; // Skip this image and try next
        }

        const aiData = await aiResponse.json();
        const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageData) {
          const base64Data = imageData.split(",")[1];
          const rawBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const imageBuffer = await resizeAndCropToExact(rawBuffer, targetW, targetH);
          
          const fileName = `${projectId}/ai-generated/carousel-${Date.now()}-${i + 1}.png`;
          
          const { error: uploadError } = await supabase.storage
            .from("social-briefing")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: false
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("social-briefing")
              .getPublicUrl(fileName);
            images.push(publicUrl);
          }
        }
      }

      if (images.length === 0) {
        throw new Error("Failed to generate any carousel images");
      }

      // Log for audit
      await supabase.from("social_audit_logs").insert({
        project_id: projectId,
        entity_type: "ai_image",
        entity_id: projectId,
        action: "generate_carousel",
        changes: { 
          prompt: prompt,
          format: format,
          carousel_count: carouselCount,
          connected: carouselConnected,
          image_urls: images
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          images: images
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    console.log("AI Response structure:", JSON.stringify({
      hasChoices: !!aiData.choices,
      choicesLength: aiData.choices?.length,
      hasMessage: !!aiData.choices?.[0]?.message,
      hasImages: !!aiData.choices?.[0]?.message?.images,
      imagesLength: aiData.choices?.[0]?.message?.images?.length,
      finishReason: aiData.choices?.[0]?.finish_reason,
      nativeFinishReason: aiData.choices?.[0]?.native_finish_reason
    }));
    
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = aiData.choices?.[0]?.message?.content;

    if (!imageData) {
      // Check if the model refused to generate due to content policy
      const finishReason = aiData.choices?.[0]?.finish_reason;
      const nativeReason = aiData.choices?.[0]?.native_finish_reason;
      console.error("No image generated, response:", JSON.stringify(aiData));
      
      if (finishReason === "stop" && !aiData.choices?.[0]?.message?.images) {
        return new Response(
          JSON.stringify({ 
            error: "O modelo não conseguiu gerar a imagem. Tente reformular o prompt ou usar termos diferentes.",
            details: textContent || "Sem detalhes adicionais"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Falha ao gerar imagem. Tente novamente.");
    }

    // Upload the generated image to Supabase Storage
    const base64Data = imageData.split(",")[1];
    const rawBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const { width: targetW, height: targetH } = getTargetDimensions(format);
    const imageBuffer = await resizeAndCropToExact(rawBuffer, targetW, targetH);
    
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
        // Keep returning the original base64 for backwards compatibility.
        // The stored/public image URL is guaranteed to be the correct dimensions.
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

function getTargetDimensions(format: string): { width: number; height: number } {
  if (format === "story" || format === "reel") return { width: 1080, height: 1920 };
  if (format === "cover") return { width: 1920, height: 1080 };
  // feed + carousel default
  return { width: 1080, height: 1350 };
}

async function resizeAndCropToExact(
  input: Uint8Array,
  targetW: number,
  targetH: number
): Promise<Uint8Array> {
  // Most image models default to 1:1. We enforce exact output size here.
  const img = await Image.decode(input);

  const scale = Math.max(targetW / img.width, targetH / img.height);
  const resizedW = Math.ceil(img.width * scale);
  const resizedH = Math.ceil(img.height * scale);

  const resized = img.resize(resizedW, resizedH);

  const x = Math.max(0, Math.floor((resizedW - targetW) / 2));
  const y = Math.max(0, Math.floor((resizedH - targetH) / 2));
  const cropped = resized.crop(x, y, targetW, targetH);

  return await cropped.encode();
}

function buildEnhancedPrompt(
  basePrompt: string, 
  briefing: any, 
  profile: any, 
  format: string,
  includeLogo: boolean,
  referenceImageUrl: string | null = null
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

  // Add style guidelines with HIGH QUALITY emphasis
  prompt += `
IMAGE QUALITY REQUIREMENTS (CRITICAL):
- Generate in the HIGHEST possible resolution and quality
- Ultra-sharp details, no blur or artifacts
- Professional-grade photography/design quality
- Rich colors with proper contrast and saturation
- Clean edges and precise details

Style guidelines:
- Modern, clean, professional design
- Visually stunning and eye-catching
- Suitable for premium social media marketing
- Clear focal point and excellent composition
- Studio-quality lighting and shadows
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

  if (referenceImageUrl) {
    prompt += `
REFERENCE IMAGE INSTRUCTIONS:
- I am providing a reference image that MUST be incorporated into this design
- The subject from the reference image should appear prominently in the generated image
- Maintain the key visual features and recognizable elements of the reference subject
- Integrate the reference subject naturally into the overall composition
- The reference subject should be the focal point or a key element of the image
`;
  }

prompt += `
CRITICAL LANGUAGE REQUIREMENTS:
- If ANY text appears in the image, it MUST be in 100% correct Brazilian Portuguese
- Double-check all spelling, grammar, and accents before generating
- Common Portuguese accents that MUST be correct: á, é, í, ó, ú, ã, õ, ê, â, ç
- Do NOT generate text with spelling errors, wrong accents, or grammatical mistakes
- If unsure about spelling, prefer NOT including text rather than including incorrect text

IMPORTANT:
- Do NOT include any other text or typography in the image (except the provided logo if requested)
- Create a visually striking image that works as a background for text overlays
- Ultra high resolution, professional quality
`;

  return prompt;
}

function buildConnectedCarouselPrompt(
  basePrompt: string,
  briefing: any,
  profile: any,
  imageNumber: number,
  totalImages: number,
  includeLogo: boolean,
  referenceImageUrl: string | null
): string {
  // For connected carousel, we need a panoramic image that can be sliced
  const totalWidth = 1080 * totalImages;
  const sliceWidth = 1080;
  const startX = (imageNumber - 1) * sliceWidth;
  const endX = imageNumber * sliceWidth;

  let prompt = `CRITICAL: Generate a PANORAMIC IMAGE that represents slice ${imageNumber} of ${totalImages} of a continuous scene.

This is for an Instagram CONNECTED CAROUSEL - where images flow seamlessly from one to the next.

EXACT DIMENSIONS: 1080x1350 pixels (4:5 aspect ratio)

CONTINUITY INSTRUCTIONS:
- This is slice ${imageNumber} of ${totalImages} in a horizontal panorama
- The scene should feel like it continues from the previous slice (if not the first)
- The scene should continue naturally to the next slice (if not the last)
${imageNumber === 1 ? "- This is the FIRST slice - start the scene here" : ""}
${imageNumber === totalImages ? "- This is the LAST slice - conclude the scene here" : ""}
- Imagine the full panorama is ${totalWidth}px wide, this slice shows pixels ${startX}-${endX}

Visual Request: ${basePrompt}

`;

  if (profile?.tone_of_voice) {
    prompt += `Brand tone: ${profile.tone_of_voice}\n`;
  }

  if (briefing?.brand_perception) {
    prompt += `Brand personality: ${briefing.brand_perception}\n`;
  }

  prompt += `
Style guidelines:
- Modern, clean, professional design
- High quality, visually appealing
- Suitable for social media marketing
- Clear focal point with natural continuation to adjacent slices
`;

  if (includeLogo && imageNumber === totalImages) {
    prompt += `
LOGO INCLUSION (LAST SLIDE ONLY):
- Include the brand logo in a subtle position on this final slice
- The logo should be proportionally sized and blend naturally
`;
  }

  if (referenceImageUrl) {
    prompt += `
REFERENCE IMAGE INSTRUCTIONS:
- I am providing a reference image that should be incorporated into this design
- The reference subject should appear naturally in the scene
- Maintain the subject's key features while integrating into the overall composition
`;
  }

prompt += `
CRITICAL LANGUAGE REQUIREMENTS:
- If ANY text appears in the image, it MUST be in 100% correct Brazilian Portuguese
- Double-check all spelling, grammar, and accents (á, é, í, ó, ú, ã, õ, ê, â, ç)
- Do NOT generate text with spelling errors or wrong accents
- If unsure about spelling, prefer NOT including text

IMPORTANT:
- Do NOT include any text or typography
- Create a visually striking slice that connects seamlessly with adjacent slices
- Ultra high resolution, professional quality
`;

  return prompt;
}
