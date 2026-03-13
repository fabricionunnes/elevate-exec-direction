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
      const brandColors = extractBrandColors(profile, briefing);
      let panoramicPrompt = `Generate a SINGLE WIDE PANORAMIC IMAGE that will be sliced into ${carouselCount} equal vertical panels for an Instagram carousel.

EXACT DIMENSIONS: The image must be ${panoramicWidth}x${slideHeight} pixels (a very wide horizontal panorama).
ASPECT RATIO: ${panoramicWidth}:${slideHeight} — this is a very wide image.

CRITICAL COMPOSITION RULES:
- Design the image so that when split into ${carouselCount} equal vertical slices (each ${slideWidth}x${slideHeight}), EACH slice looks beautiful on its own AND flows seamlessly into the next.
- Spread visual interest across the ENTIRE width — do NOT concentrate everything in the center.
- Use a continuous background, gradient, or scene that spans the full width.
- Important elements should be distributed across all ${carouselCount} sections.
- Avoid placing critical elements exactly at the split boundaries (every ${slideWidth}px).

Visual Request: ${prompt}
`;

      if (profile?.tone_of_voice) {
        panoramicPrompt += `\nBrand tone: ${profile.tone_of_voice}`;
      }
      if (briefing?.brand_perception) {
        panoramicPrompt += `\nBrand personality: ${briefing.brand_perception}`;
      }
      if (brandColors) {
        panoramicPrompt += `\nBRAND COLORS (MUST USE): ${brandColors}`;
      }

      // Add slide text instructions
      const hasSlideTexts = slideTexts && Array.isArray(slideTexts) && slideTexts.some((t: string) => t && t.trim());
      if (hasSlideTexts) {
        panoramicPrompt += `\n\nTEXT TO INCLUDE IN EACH SLIDE: The panoramic image will be split into ${carouselCount} equal vertical panels. Include the following text in each corresponding panel section, using prominent, legible typography that fits the design:`;
        for (let i = 0; i < carouselCount; i++) {
          const text = slideTexts[i]?.trim();
          if (text) {
            panoramicPrompt += `\n- Panel ${i + 1} (from x=${i * slideWidth}px to x=${(i + 1) * slideWidth}px): "${text}"`;
          } else {
            panoramicPrompt += `\n- Panel ${i + 1}: No text needed.`;
          }
        }
        panoramicPrompt += `\nAll text MUST be in Brazilian Portuguese, clearly readable, and well-positioned within each panel area.`;
      }

      panoramicPrompt += `
QUALITY: Ultra-high resolution, professional studio quality, crisp and sharp.
LANGUAGE: Any text MUST be in correct Brazilian Portuguese.${hasSlideTexts ? '' : ' Prefer NO text if possible.'}
REALISM: 100% physically realistic, correct proportions and perspective.

CRITICAL - NO TECHNICAL LABELS: Never render resolution labels, measurement text, UI elements or counters such as "1080px", "px", "4:5", "1/3", "2/3", or similar.

CRITICAL - LOGO: Do NOT include any logo, brand mark, watermark, or company name text in the image.
The logo will be added separately after generation. If you include a fabricated logo it will be WRONG.
Do NOT invent or hallucinate any logos. Leave the image clean without any brand marks.
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
PHYSICAL REALISM REQUIREMENTS (ABSOLUTELY CRITICAL):
============================================
- The image MUST be 100% PHYSICALLY REALISTIC and POSSIBLE in the real world
- ALL people, objects, and scenes must follow real-world physics and spatial logic
- People must be positioned in REALISTIC places:
  * People sit on CHAIRS at the sides of tables, NEVER on top of tables or in the middle
  * People stand on the FLOOR, not floating or in impossible positions
  * Hands, arms, and body parts must be anatomically correct and natural
- Perspective and depth must be correct:
  * Objects closer to the camera should be larger
  * Correct vanishing points and horizon lines
  * Realistic shadows matching light sources
- NO surreal, impossible, or physically incorrect compositions
- The scene should look like a HIGH-END PROFESSIONAL PHOTOGRAPH
- If showing a meeting room: people sit AROUND the table on chairs, NOT on the table
- If showing an office: furniture is in logical positions, people interact naturally

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

  // Logo is ALWAYS applied via programmatic canvas overlay, NEVER by AI generation
  // We must tell the AI explicitly NOT to include logos to prevent hallucinated/fake logos
  prompt += `
============================================
LOGO / BRAND MARK INSTRUCTIONS (ABSOLUTELY CRITICAL):
============================================
- Do NOT include any logo, brand mark, watermark, or company name text in the image
- The logo will be added separately AFTER image generation via a precise overlay process
- If you include any fabricated or hallucinated logo, it will be WRONG and ruin the image
- Leave the bottom-right corner area clean/simple so the real logo can be overlaid there
- This is NON-NEGOTIABLE — NO logos or brand marks of any kind in the generated image
`;

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

// buildConnectedCarouselPrompt removed - panoramic split approach is now used directly in the handler
