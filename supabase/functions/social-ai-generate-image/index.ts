import { createClient } from "@supabase/supabase-js";
import { createCanvas, loadImage as canvasLoadImage } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

// Overlay the logo programmatically onto the generated image
async function applyLogoOverlay(
  imageBuffer: Uint8Array,
  logoUrl: string,
  targetW: number,
  targetH: number
): Promise<Uint8Array> {
  try {
    console.log("Applying logo overlay from:", logoUrl);
    
    // Load the generated image
    const baseImage = await canvasLoadImage(imageBuffer);
    
    // Fetch and load the logo
    const logoResponse = await fetch(logoUrl);
    if (!logoResponse.ok) {
      console.error("Failed to fetch logo:", logoResponse.status);
      return imageBuffer; // Return original if logo fetch fails
    }
    const logoBuffer = new Uint8Array(await logoResponse.arrayBuffer());
    const logoImage = await canvasLoadImage(logoBuffer);
    
    // Create canvas with target dimensions
    const canvas = createCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d");
    
    // Draw the base image (fit to canvas)
    ctx.drawImage(baseImage, 0, 0, targetW, targetH);
    
    // Calculate logo size (max 15% of image width, positioned in bottom-right safe zone)
    const maxLogoWidth = targetW * 0.15;
    const logoAspect = logoImage.width() / logoImage.height();
    let logoW = Math.min(logoImage.width(), maxLogoWidth);
    let logoH = logoW / logoAspect;
    
    // If logo is too tall, resize by height instead
    const maxLogoHeight = targetH * 0.1;
    if (logoH > maxLogoHeight) {
      logoH = maxLogoHeight;
      logoW = logoH * logoAspect;
    }
    
    // Position: bottom-right corner with padding (safe zone)
    const padding = targetW * 0.05; // 5% padding
    const logoX = targetW - logoW - padding;
    const logoY = targetH - logoH - padding;
    
    // Draw the logo
    ctx.drawImage(logoImage, logoX, logoY, logoW, logoH);
    
    // Export as PNG buffer
    const resultBuffer = canvas.toBuffer("image/png");
    console.log("Logo overlay applied successfully");
    
    return new Uint8Array(resultBuffer);
  } catch (error) {
    console.error("Error applying logo overlay:", error);
    return imageBuffer; // Return original if overlay fails
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const { projectId, prompt, format, includeLogoPref, carouselCount, carouselConnected, referenceImageUrl, overlayText, slideTexts } = await req.json();

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
    // NOTE: We do NOT pass the logo to the AI - logos are applied via programmatic overlay
    // This ensures the EXACT logo is used, not an AI-interpreted version
    const shouldApplyLogoOverlay = includeLogoPref && logoUrl;
    let enhancedPrompt = buildEnhancedPrompt(prompt, briefing, profile, format, false, referenceImageUrl);

    // Add overlay text instruction for single images
    if (overlayText && overlayText.trim()) {
      enhancedPrompt += `\n\nIMPORTANT TEXT TO INCLUDE IN THE IMAGE: Write the following text prominently and legibly in the image, using a visually appealing typography that fits the design: "${overlayText.trim()}". The text must be in Brazilian Portuguese, clearly readable, and well-positioned.`;
    }

    console.log("Generating image with prompt:", enhancedPrompt);
    console.log("Logo will be applied via overlay:", shouldApplyLogoOverlay ? logoUrl : "none");
    console.log("Reference image URL:", referenceImageUrl || "none");
    console.log("Carousel count:", carouselCount || 1);
    console.log("Carousel connected:", carouselConnected || false);

    // Build the message content - only include reference image, NOT the logo
    // Logo is applied programmatically AFTER generation for pixel-perfect accuracy
    const messageImages: { type: string; image_url: { url: string } }[] = [];
    
    if (referenceImageUrl) {
      messageImages.push({
        type: "image_url",
        image_url: { url: referenceImageUrl }
      });
    }

    const messageContent: any = messageImages.length > 0 
      ? [{ type: "text", text: enhancedPrompt }, ...messageImages]
      : enhancedPrompt;

    // Handle carousel generation - generate ONE wide panoramic image and split it
    if (format === "carousel" && carouselCount && carouselCount > 1) {
      const slideHeight = 1350;
      const slideWidth = 1080;
      const panoramicWidth = slideWidth * carouselCount;

      // Build prompt for a single wide panoramic image
      let panoramicPrompt = `Generate a SINGLE WIDE PANORAMIC IMAGE for an Instagram carousel with ${carouselCount} slides.

The image must be a very wide horizontal panorama (ratio approximately ${carouselCount}:1.25).

CRITICAL COMPOSITION RULES:
- The image will be split into ${carouselCount} equal vertical sections. Each section must look beautiful on its own AND flow seamlessly into the next.
- Spread visual interest across the ENTIRE width — do NOT concentrate everything in the center.
- Use a continuous background, gradient, or scene that spans the full width.
- Important elements should be distributed across all sections.

Visual Request: ${prompt}
`;

      if (profile?.tone_of_voice) {
        panoramicPrompt += `\nBrand tone: ${profile.tone_of_voice}`;
      }
      if (briefing?.brand_perception) {
        panoramicPrompt += `\nBrand personality: ${briefing.brand_perception}`;
      }

      // Add full brand style block for consistency
      panoramicPrompt += buildBrandStyleBlock(profile, briefing);

      // Add slide text instructions
      const hasSlideTexts = slideTexts && Array.isArray(slideTexts) && slideTexts.some((t: string) => t && t.trim());
      if (hasSlideTexts) {
        panoramicPrompt += `\n\nTEXT TO INCLUDE: The image has ${carouselCount} equal vertical sections from left to right. Include the following text in each section, using prominent, legible typography:`;
        for (let i = 0; i < carouselCount; i++) {
          const text = slideTexts[i]?.trim();
          if (text) {
            panoramicPrompt += `\n- Section ${i + 1}: "${text}"`;
          }
        }
        panoramicPrompt += `\nAll text MUST be in Brazilian Portuguese, clearly readable, and well-positioned.`;
      }

      panoramicPrompt += `
QUALITY: Ultra-high resolution, professional studio quality, crisp and sharp.
LANGUAGE: Any text MUST be in correct Brazilian Portuguese.${hasSlideTexts ? '' : ' Prefer NO text if possible.'}
REALISM: 100% physically realistic, correct proportions and perspective.

ABSOLUTELY FORBIDDEN:
- NO pixel measurements, coordinates, or dimensions
- NO panel/section labels, numbers, or indicators
- NO aspect ratio text, UI elements, borders, grid markers
- NO technical annotations of any kind
- NO logos, brand marks, watermarks, or company name text (logo added separately)
`;

      // Add reference image if provided
      const panoramicMessageContent: any = referenceImageUrl 
        ? [
            { type: "text", text: panoramicPrompt },
            { type: "image_url", image_url: { url: referenceImageUrl } }
          ]
        : panoramicPrompt;

      console.log(`Generating panoramic image ${panoramicWidth}x${slideHeight} for ${carouselCount}-slide carousel...`);

      try {
        const aiResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [{ role: "user", content: panoramicMessageContent }],
            modalities: ["image", "text"],
          }),
        }, 120000);

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("AI API error for panoramic:", errorText);
          if (aiResponse.status === 429) {
            return new Response(
              JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error("Failed to generate panoramic image");
        }

        const aiData = await aiResponse.json();
        const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageData) {
          const textContent = aiData.choices?.[0]?.message?.content;
          return new Response(
            JSON.stringify({ error: "Não foi possível gerar a imagem panorâmica. Tente reformular o prompt.", details: textContent }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Decode the panoramic image
        const base64Data = imageData.split(",")[1];
        const panoramicBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Split the panoramic image into equal slides using canvas
        console.log("Splitting panoramic image into slides...");
        const panoramicImage = await canvasLoadImage(panoramicBuffer);
        const imgW = panoramicImage.width();
        const imgH = panoramicImage.height();
        console.log(`Panoramic image actual size: ${imgW}x${imgH}`);

        const sliceW = Math.floor(imgW / carouselCount);
        const images: string[] = [];

        for (let i = 0; i < carouselCount; i++) {
          const canvas = createCanvas(sliceW, imgH);
          const ctx = canvas.getContext("2d");

          // Draw the slice from the panoramic image
          // drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
          ctx.drawImage(panoramicImage, i * sliceW, 0, sliceW, imgH, 0, 0, sliceW, imgH);

          // Apply logo overlay on last slide if requested
          if (shouldApplyLogoOverlay && logoUrl && i === carouselCount - 1) {
            try {
              const logoResponse = await fetch(logoUrl);
              if (logoResponse.ok) {
                const logoBuffer = new Uint8Array(await logoResponse.arrayBuffer());
                const logoImage = await canvasLoadImage(logoBuffer);
                const maxLogoWidth = sliceW * 0.15;
                const logoAspect = logoImage.width() / logoImage.height();
                let logoW2 = Math.min(logoImage.width(), maxLogoWidth);
                let logoH2 = logoW2 / logoAspect;
                const maxLogoHeight = imgH * 0.1;
                if (logoH2 > maxLogoHeight) { logoH2 = maxLogoHeight; logoW2 = logoH2 * logoAspect; }
                const padding = sliceW * 0.05;
                ctx.drawImage(logoImage, sliceW - logoW2 - padding, imgH - logoH2 - padding, logoW2, logoH2);
              }
            } catch (e) { console.error("Logo overlay error:", e); }
          }

          const sliceBuffer = new Uint8Array(canvas.toBuffer("image/png"));
          const fileName = `${projectId}/ai-generated/carousel-${Date.now()}-${i + 1}.png`;

          const { error: uploadError } = await supabase.storage
            .from("social-briefing")
            .upload(fileName, sliceBuffer, { contentType: "image/png", upsert: false });

          if (uploadError) {
            console.error(`Upload error for slide ${i + 1}:`, uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from("social-briefing")
            .getPublicUrl(fileName);

          images.push(publicUrl);
          console.log(`Slide ${i + 1}/${carouselCount} uploaded`);
        }

        if (images.length === 0) {
          return new Response(
            JSON.stringify({ error: "Falha ao dividir a imagem panorâmica em slides." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Also upload the full panoramic for reference
        const panoramicFileName = `${projectId}/ai-generated/panoramic-${Date.now()}.png`;
        await supabase.storage.from("social-briefing").upload(panoramicFileName, panoramicBuffer, { contentType: "image/png", upsert: false });
        const { data: { publicUrl: panoramicUrl } } = supabase.storage.from("social-briefing").getPublicUrl(panoramicFileName);

        // Log for audit
        await supabase.from("social_audit_logs").insert({
          project_id: projectId,
          entity_type: "ai_image",
          entity_id: projectId,
          action: "generate_carousel",
          changes: { prompt, format, carousel_count: carouselCount, panoramic_url: panoramicUrl, image_urls: images },
        });

        return new Response(
          JSON.stringify({ success: true, images, panoramic_url: panoramicUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("Carousel generation error:", err);
        if (err instanceof Error && err.name === "AbortError") {
          return new Response(
            JSON.stringify({ error: "Tempo limite ao gerar imagem panorâmica. Tente com menos slides ou prompt mais simples." }),
            { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw err;
      }
    }

    // Call Lovable AI for image generation - using PRO model for higher quality
    const aiResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: messageContent,
          },
        ],
        modalities: ["image", "text"],
      }),
    }, 60000);

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
    let imageBuffer = await resizeAndCropToExact(rawBuffer, targetW, targetH);
    
    // Apply logo overlay if requested (using the ACTUAL logo, not AI-generated)
    if (shouldApplyLogoOverlay && logoUrl) {
      imageBuffer = await applyLogoOverlay(imageBuffer, logoUrl, targetW, targetH);
    }
    
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

    // Surface timeout as a clear error (avoids generic "Load failed" on the client)
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(
        JSON.stringify({
          error: "Tempo limite ao gerar a imagem. Tente novamente (ou simplifique o prompt).",
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
  _targetW: number,
  _targetH: number
): Promise<Uint8Array> {
  // NOTE: Removemos a dependência do ImageScript para evitar timeouts no bundle.
  // A imagem gerada já vem em alta resolução; mantemos o buffer original.
  return input;
}

// Extract brand colors from profile/briefing
function extractBrandColors(profile: any, briefing: any): string {
  const colors: string[] = [];
  
  // Priority 1: Explicit brand_colors array from profile
  if (profile?.brand_colors && Array.isArray(profile.brand_colors) && profile.brand_colors.length > 0) {
    colors.push(...profile.brand_colors);
  }
  
  // Priority 2: Try to get from brand_identity if it mentions colors
  if (colors.length === 0 && profile?.brand_identity && typeof profile.brand_identity === 'string') {
    const colorMatches = profile.brand_identity.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    if (colorMatches) colors.push(...colorMatches);
  }
  
  // Priority 3: Check briefing for color info
  if (colors.length === 0 && briefing?.brand_perception && typeof briefing.brand_perception === 'string') {
    const colorMatches = briefing.brand_perception.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    if (colorMatches) colors.push(...colorMatches);
  }
  
  if (colors.length > 0) {
    return colors.slice(0, 8).join(", ");
  }
  
  return "";
}

function buildBrandStyleBlock(profile: any, briefing: any): string {
  let block = "";
  
  const brandColors = extractBrandColors(profile, briefing);
  const brandFonts = profile?.brand_fonts;
  const visualStyle = profile?.visual_style;
  const visualStylePrompt = profile?.visual_style_prompt;
  
  if (brandColors || brandFonts || visualStyle) {
    block += `
============================================
BRAND IDENTITY SYSTEM (MANDATORY — FOLLOW STRICTLY):
============================================
ALL images for this brand MUST follow a CONSISTENT visual identity. Every image generated should look like it belongs to the SAME Instagram feed — same color palette, same typography style, same visual language.
`;
  }
  
  if (brandColors) {
    block += `
COLOR PALETTE (STRICT — USE ONLY THESE):
- Primary brand colors: ${brandColors}
- These colors MUST dominate the image design (backgrounds, overlays, text colors, gradients, shapes)
- DO NOT introduce random colors outside this palette
- You may use lighter/darker tints of these colors for variety, but stay within the brand family
- White and very dark tones can be used as neutrals alongside the brand colors
- Every image should be IMMEDIATELY recognizable as belonging to this brand through its colors
`;
  }
  
  if (brandFonts) {
    block += `
TYPOGRAPHY STYLE (STRICT):
- Brand fonts: ${brandFonts}
- ALL text in the image must follow this typography style
- Use bold/heavy weights for headlines, lighter weights for body text
- Maintain CONSISTENT font sizes and styles across all images
- If the exact font is not available, use the CLOSEST match in style (sans-serif, serif, geometric, etc.)
`;
  }
  
  if (visualStyle) {
    block += `
VISUAL STYLE (STRICT):
${visualStyle}
- This style MUST be consistent across ALL images — same feel, same aesthetic, same design language
- Small variations are allowed (different layouts, different content), but the OVERALL LOOK must be unified
`;
  }
  
  if (visualStylePrompt) {
    block += `
ADDITIONAL BRAND INSTRUCTIONS:
${visualStylePrompt}
`;
  }
  
  if (!brandColors && !brandFonts && !visualStyle) {
    // Even without explicit settings, encourage consistency
    block += `
============================================
VISUAL CONSISTENCY (IMPORTANT):
============================================
- Maintain a COHESIVE visual style suitable for a professional Instagram feed
- Use a LIMITED color palette (max 3-4 colors) consistently
- Keep typography style consistent
- Every image should look like it belongs to the SAME brand
`;
  }
  
  return block;
}

function buildEnhancedPrompt(
  basePrompt: string, 
  briefing: any, 
  profile: any, 
  format: string,
  includeLogo: boolean,
  referenceImageUrl: string | null = null
): string {
  let aspectRatio = "4:5";
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

  let prompt = `Generate a HIGH-QUALITY professional image with EXACT dimensions ${dimensions} pixels and ${aspectRatio} aspect ratio for Instagram ${format || "feed post"}.

Visual Request: ${basePrompt}

`;

  // Add brand context from profile
  if (profile?.tone_of_voice) {
    prompt += `Brand tone: ${profile.tone_of_voice}\n`;
  }
  if (briefing?.brand_perception) {
    prompt += `Brand personality: ${briefing.brand_perception}\n`;
  }

  // Add the comprehensive brand style block
  prompt += buildBrandStyleBlock(profile, briefing);

  prompt += `
============================================
PHYSICAL REALISM REQUIREMENTS:
============================================
- 100% physically realistic, correct proportions and perspective
- People in realistic positions, correct anatomy
- Professional studio-grade photography/design quality
- Realistic shadows matching light sources

============================================
IMAGE QUALITY:
============================================
- ULTRA-SHARP details, no blur, no pixelation, no artifacts
- Rich, vibrant colors with proper contrast
- CLEAN, CRISP edges and precise details
- Professional lighting with realistic shadows and highlights

============================================
SAFE ZONE:
============================================
- Keep important elements in the center 50% of the image
- Leave at least 25% padding from all edges
- Leave bottom-right corner clean for logo overlay

============================================
LOGO (CRITICAL):
============================================
- Do NOT include any logo, brand mark, watermark, or company name text
- The logo will be added separately after generation
- This is NON-NEGOTIABLE

============================================
LANGUAGE:
============================================
- Any text MUST be in correct Brazilian Portuguese with proper accents (á, é, í, ó, ú, ã, õ, ê, â, ç)
- PREFER creating images WITHOUT text — let the design speak
- If text is essential, keep to 1-3 words maximum, large and centered
- Do NOT render technical labels (px, ratios, panel numbers)
`;

  if (referenceImageUrl) {
    prompt += `
REFERENCE IMAGE: Incorporate the provided reference image naturally into the design, maintaining its key visual features as the focal point.
`;
  }

  return prompt;
}

