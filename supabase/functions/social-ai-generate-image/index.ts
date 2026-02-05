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

        // Use PRO model for higher quality
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
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

    // Call Lovable AI for image generation - using PRO model for higher quality
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
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

// Extract brand colors from profile/briefing
function extractBrandColors(profile: any, briefing: any): string {
  const colors: string[] = [];
  
  // Try to get colors from profile
  if (profile?.brand_colors) {
    if (Array.isArray(profile.brand_colors)) {
      colors.push(...profile.brand_colors);
    } else if (typeof profile.brand_colors === 'string') {
      colors.push(profile.brand_colors);
    }
  }
  
  // Try to get from brand_identity if it mentions colors
  if (profile?.brand_identity && typeof profile.brand_identity === 'string') {
    const colorMatches = profile.brand_identity.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    if (colorMatches) colors.push(...colorMatches);
  }
  
  // Check briefing for color info
  if (briefing?.brand_perception && typeof briefing.brand_perception === 'string') {
    const colorMatches = briefing.brand_perception.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    if (colorMatches) colors.push(...colorMatches);
  }
  
  if (colors.length > 0) {
    return colors.slice(0, 5).join(", ");
  }
  
  return "";
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

  // Extract brand colors
  const brandColors = extractBrandColors(profile, briefing);

  let prompt = `CRITICAL: Generate a HIGH-QUALITY professional image with EXACT dimensions ${dimensions} pixels and ${aspectRatio} aspect ratio.

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

  // Add brand colors if available
  if (brandColors) {
    prompt += `
BRAND COLOR PALETTE (MUST USE):
- Use these exact brand colors: ${brandColors}
- The design should primarily use these colors
- Maintain color harmony with the brand palette
`;
  }

  // Add style guidelines with MAXIMUM QUALITY emphasis
  prompt += `
============================================
IMAGE QUALITY REQUIREMENTS (ABSOLUTELY CRITICAL):
============================================
- Generate at the MAXIMUM possible resolution and quality
- ULTRA-SHARP details - no blur, no pixelation, no artifacts
- PROFESSIONAL studio-grade photography/design quality
- Rich, vibrant colors with proper contrast and saturation
- CLEAN, CRISP edges and precise details
- NO compression artifacts, NO noise, NO grain
- Render ALL elements with PERFECT clarity
- Text (if any) must be CRYSTAL CLEAR and razor-sharp - NO pixelation or blur on text
- 8K-level detail quality
- Professional lighting with realistic shadows and highlights

============================================
SAFE ZONE - LOGO & ELEMENT POSITIONING (CRITICAL):
============================================
- The image will be cropped from a square to ${aspectRatio} format
- Keep ALL important elements in the ABSOLUTE CENTER 50% of the image
- Leave AT LEAST 25% padding from ALL edges (top, bottom, left, right)
- NEVER place logos, text, faces, or important elements anywhere near the edges
- The logo (if included) MUST be positioned in the EXACT CENTER or in the CENTER of the safe zone
- NO important elements should be cut off when cropped
`;

  if (includeLogo) {
    prompt += `
============================================
LOGO INCLUSION INSTRUCTIONS (CRITICAL):
============================================
- I am providing the brand logo image as a reference
- You MUST incorporate this EXACT logo into the generated image
- POSITION THE LOGO IN THE CENTER OF THE IMAGE - not in corners!
- The logo must be FULLY VISIBLE and COMPLETE - no cropping
- The logo should be clearly visible and proportionally sized
- Maintain the logo's original colors, proportions, and details EXACTLY
- The logo must remain SHARP and HIGH QUALITY - no blur or pixelation
- Integrate the logo naturally without distorting it
- The logo is the brand identity - it MUST be perfect
`;
  }

  if (referenceImageUrl) {
    prompt += `
============================================
REFERENCE IMAGE INSTRUCTIONS:
============================================
- I am providing a reference image that MUST be incorporated into this design
- The subject from the reference image should appear prominently in the generated image
- Position the reference subject in the CENTER SAFE ZONE
- Maintain the key visual features and recognizable elements of the reference subject
- Integrate the reference subject naturally into the overall composition
- The reference subject should be the focal point or a key element of the image
`;
  }

  prompt += `
============================================
LANGUAGE & TEXT REQUIREMENTS (ABSOLUTELY CRITICAL):
============================================
- If ANY text appears in the image, it MUST be in 100% CORRECT Brazilian Portuguese
- VERIFY EVERY WORD for correct spelling before generating
- Common words that MUST be spelled correctly:
  * "crescimento" (NOT "cresiemento" or "crecimento")
  * "estrutura" (NOT "estructura")
  * "negócio" (NOT "negocio" without accent)
  * "você" (NOT "voce" without accent)
  * "é" (NOT "e" without accent when it's the verb)
  * "não" (NOT "nao" without tilde)
- Double-check all spelling, grammar, and accents before generating
- Common Portuguese accents that MUST be correct: á, é, í, ó, ú, ã, õ, ê, â, ç
- Do NOT generate text with spelling errors, wrong accents, or grammatical mistakes
- If UNSURE about any spelling, DO NOT include text - leave space for text overlay later
- TRIPLE CHECK any Portuguese text for correctness

============================================
FINAL INSTRUCTIONS:
============================================
- STRONGLY PREFER creating images WITHOUT text - let the design speak for itself
- If text is absolutely essential, keep it to 1-3 words maximum, CENTERED and LARGE
- Create a visually striking image that works as a background for text overlays added later
- MAXIMUM resolution, PROFESSIONAL quality, STUDIO-GRADE output
- Every pixel must be perfect
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

  // Extract brand colors
  const brandColors = extractBrandColors(profile, briefing);

  let prompt = `CRITICAL: Generate a HIGH-QUALITY PANORAMIC IMAGE that represents slice ${imageNumber} of ${totalImages} of a continuous scene.

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

  // Add brand colors if available
  if (brandColors) {
    prompt += `
BRAND COLOR PALETTE (MUST USE):
- Use these exact brand colors: ${brandColors}
- The design should primarily use these colors
`;
  }

  prompt += `
============================================
IMAGE QUALITY REQUIREMENTS (ABSOLUTELY CRITICAL):
============================================
- Generate at the MAXIMUM possible resolution and quality
- ULTRA-SHARP details - no blur, no pixelation, no artifacts
- PROFESSIONAL studio-grade photography/design quality
- Rich, vibrant colors with proper contrast
- CLEAN, CRISP edges and precise details
- NO compression artifacts, NO noise
- 8K-level detail quality

============================================
SAFE ZONE - AVOID CROPPING:
============================================
- Keep ALL important elements in the CENTER 50% of the image
- Leave AT LEAST 25% padding from ALL edges
- NEVER place text or important elements near the edges
`;

  if (includeLogo && imageNumber === totalImages) {
    prompt += `
============================================
LOGO INCLUSION (LAST SLIDE ONLY):
============================================
- Include the brand logo in the CENTER of this final slice
- The logo should be clearly visible and proportionally sized
- Maintain the logo's original colors and proportions EXACTLY
- The logo must be FULLY VISIBLE - no cropping
`;
  }

  if (referenceImageUrl) {
    prompt += `
============================================
REFERENCE IMAGE INSTRUCTIONS:
============================================
- I am providing a reference image that should be incorporated into this design
- The reference subject should appear naturally in the scene, positioned in the safe zone
- Maintain the subject's key features while integrating into the overall composition
`;
  }

  prompt += `
============================================
LANGUAGE REQUIREMENTS (CRITICAL):
============================================
- If ANY text appears, it MUST be in 100% CORRECT Brazilian Portuguese
- VERIFY EVERY WORD for correct spelling
- "crescimento" NOT "cresiemento"
- If unsure about spelling, DO NOT include text
- Double-check all accents: á, é, í, ó, ú, ã, õ, ê, â, ç

============================================
FINAL INSTRUCTIONS:
============================================
- PREFER creating images WITHOUT text
- Only include text if absolutely essential, and keep it SHORT and CENTERED
- Create a visually striking slice that connects seamlessly with adjacent slices
- MAXIMUM resolution, PROFESSIONAL quality
`;

  return prompt;
}
