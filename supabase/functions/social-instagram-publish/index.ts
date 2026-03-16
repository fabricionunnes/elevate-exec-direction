import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface PublishRequest {
  cardId: string;
  projectId: string;
}

async function waitForContainer(
  containerId: string,
  accessToken: string,
  isVideo: boolean
): Promise<string> {
  let status = "IN_PROGRESS";
  let attempts = 0;
  const pollIntervalMs = 2000;
  const maxWaitMs = isVideo ? 150_000 : 60_000;
  const maxAttempts = Math.ceil(maxWaitMs / pollIntervalMs);

  while (status === "IN_PROGRESS" && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    attempts++;

    const statusResponse = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusResponse.json();
    console.log(`Container status (attempt ${attempts}/${maxAttempts}):`, statusData);

    if (statusData.error) {
      throw new Error(statusData.error.message || "Failed to check container status");
    }

    status = statusData.status_code || "FINISHED";
  }

  if (status === "ERROR") throw new Error("Media container processing failed");
  if (status === "IN_PROGRESS") throw new Error(`Media processing timed out after ${Math.round(maxWaitMs / 1000)}s`);

  return status;
}

async function createImageContainer(
  igUserId: string,
  imageUrl: string,
  accessToken: string,
  caption?: string,
  isCarouselItem: boolean = false
): Promise<string> {
  const body: Record<string, unknown> = {
    image_url: imageUrl,
    access_token: accessToken,
  };
  if (isCarouselItem) {
    body.is_carousel_item = true;
  } else if (caption) {
    body.caption = caption;
  }

  const response = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log("Image container response:", data);

  if (data.error) {
    throw new Error(data.error.message || "Failed to create image container");
  }

  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (token !== serviceRoleKey) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("Service-to-service call authorized");
    }

    const body: PublishRequest = await req.json();
    const { cardId, projectId } = body;

    if (!cardId || !projectId) {
      return new Response(
        JSON.stringify({ error: "cardId and projectId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Publishing card ${cardId} for project ${projectId}`);

    // 1. Fetch the card
    const { data: card, error: cardError } = await supabaseClient
      .from("social_content_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.error("Card not found:", cardError);
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!card.creative_url) {
      return new Response(
        JSON.stringify({ error: "Card has no media to publish" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard against duplicate publishing
    if (card.instagram_post_id || card.published_at) {
      console.log(`Card ${cardId} already published (post_id: ${card.instagram_post_id}), skipping`);
      return new Response(
        JSON.stringify({ success: true, alreadyPublished: true, postId: card.instagram_post_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch Instagram account
    const { data: igAccount, error: igError } = await supabaseClient
      .from("social_instagram_accounts")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_connected", true)
      .single();

    if (igError || !igAccount) {
      console.error("Instagram account not found:", igError);
      return new Response(
        JSON.stringify({ error: "Instagram account not connected for this project" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = igAccount.access_token;
    const igUserId = igAccount.instagram_user_id;

    if (!accessToken || !igUserId) {
      return new Response(
        JSON.stringify({ error: "Instagram credentials missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Build caption
    let caption = card.final_caption || card.copy_text || "";
    if (card.hashtags) {
      caption = caption + "\n\n" + card.hashtags;
    }

    // 4. Check if carousel
    const isCarousel = card.content_type === "carrossel";
    const isVideo = card.creative_type === "video";
    let containerId: string;

    if (isCarousel) {
      // Fetch carousel slides from attachments
      const { data: attachments, error: attachError } = await supabaseClient
        .from("social_card_attachments")
        .select("file_url, created_at")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });

      if (attachError) {
        console.error("Failed to load carousel attachments:", attachError);
        throw new Error("Não foi possível carregar os slides do carrossel");
      }

      const slideUrls = (attachments ?? [])
        .map((a: { file_url: string | null }) => a.file_url)
        .filter((url): url is string => Boolean(url));

      const fallbackImageUrl = card.creative_url;

      if (slideUrls.length < 2) {
        // Single image fallback (legacy cards without attachments)
        console.log(`Carousel fallback: ${slideUrls.length} slide(s) found, posting as single image`);
        containerId = await createImageContainer(
          igUserId,
          slideUrls[0] ?? fallbackImageUrl,
          accessToken,
          caption
        );
        await waitForContainer(containerId, accessToken, false);
      } else {
        console.log(`Creating carousel with ${slideUrls.length} slides...`);

        // Create individual containers for each slide (is_carousel_item = true)
        const childIds: string[] = [];
        for (const url of slideUrls) {
          const childId = await createImageContainer(igUserId, url, accessToken, undefined, true);
          await waitForContainer(childId, accessToken, false);
          childIds.push(childId);
        }

        // Create the carousel container
        const carouselResponse = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            children: childIds.join(","),
            caption: caption,
            access_token: accessToken,
          }),
        });

        const carouselData = await carouselResponse.json();
        console.log("Carousel container response:", carouselData);

        if (carouselData.error) {
          throw new Error(carouselData.error.message || "Failed to create carousel container");
        }

        containerId = carouselData.id;
        await waitForContainer(containerId, accessToken, false);
      }
    } else if (isVideo) {
      console.log("Creating video container...");
      const containerResponse = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: card.creative_url,
          caption: caption,
          access_token: accessToken,
        }),
      });

      const containerData = await containerResponse.json();
      console.log("Video container response:", containerData);

      if (containerData.error) {
        throw new Error(containerData.error.message || "Failed to create video container");
      }

      containerId = containerData.id;
      await waitForContainer(containerId, accessToken, true);
    } else {
      console.log("Creating image container...");
      containerId = await createImageContainer(igUserId, card.creative_url, accessToken, caption);
      await waitForContainer(containerId, accessToken, false);
    }

    // 5. Publish the container
    console.log("Publishing container...");
    const publishResponse = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishResponse.json();
    console.log("Publish response:", publishData);

    if (publishData.error) {
      throw new Error(publishData.error.message || "Failed to publish media");
    }

    const mediaId = publishData.id;

    // 6. Get the permalink
    const permalinkResponse = await fetch(
      `${GRAPH_API_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`
    );
    const permalinkData = await permalinkResponse.json();
    const postUrl = permalinkData.permalink || `https://www.instagram.com/p/${mediaId}/`;

    console.log("Post URL:", postUrl);

    // 7. Log the publication
    await supabaseClient.from("social_publish_logs").insert({
      project_id: projectId,
      card_id: cardId,
      platform: "instagram",
      status: "success",
      post_id: mediaId,
      post_url: postUrl,
      published_at: new Date().toISOString(),
    });

    // 8. Update the card
    const { data: publishedStage } = await supabaseClient
      .from("social_content_stages")
      .select("id")
      .eq("board_id", card.board_id)
      .eq("stage_type", "published")
      .single();

    const updateData: Record<string, unknown> = {
      instagram_post_url: postUrl,
      instagram_post_id: mediaId,
      published_at: new Date().toISOString(),
    };

    if (publishedStage) {
      updateData.stage_id = publishedStage.id;
    }

    await supabaseClient
      .from("social_content_cards")
      .update(updateData)
      .eq("id", cardId);

    // 9. Log history
    await supabaseClient.from("social_content_history").insert({
      card_id: cardId,
      action: "published",
      details: { platform: "instagram", post_id: mediaId, post_url: postUrl },
    });

    // 10. Send WhatsApp notification to client about publication
    try {
      await sendPublishedNotification(supabaseClient, card, projectId, postUrl);
    } catch (notifError) {
      console.error("Error sending publish WhatsApp notification:", notifError);
    }

    return new Response(
      JSON.stringify({ success: true, postId: mediaId, postUrl: postUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error publishing to Instagram:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to publish to Instagram",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendPublishedNotification(
  supabase: any,
  card: any,
  projectId: string,
  postUrl: string,
) {
  // Get WhatsApp settings
  const { data: settings } = await supabase
    .from("social_whatsapp_settings")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .single();

  if (!settings?.whatsapp_instance_id) return;

  // Get instance
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("api_url, api_key, instance_name")
    .eq("id", settings.whatsapp_instance_id)
    .single();

  if (!instance?.api_url || !instance?.api_key) return;

  // Get contacts
  const { data: contacts } = await supabase
    .from("social_approval_contacts")
    .select("phone, name")
    .eq("project_id", projectId)
    .eq("is_active", true);

  const targets: { phone: string; name: string }[] = [];

  if (contacts && contacts.length > 0) {
    for (const c of contacts) {
      let phone = c.phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = "55" + phone;
      targets.push({ phone, name: c.name || "" });
    }
  } else if (settings.client_phone) {
    let phone = settings.client_phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;
    targets.push({ phone, name: settings.client_name || "" });
  }

  if (settings.send_to_group && settings.group_jid) {
    targets.push({ phone: settings.group_jid, name: settings.group_name || "Grupo" });
  }

  if (targets.length === 0) return;

  const contentTypes: Record<string, string> = {
    feed: "Feed", estatico: "Estático", carrossel: "Carrossel",
    reels: "Reels", stories: "Stories", outro: "Outro"
  };

  const contentType = contentTypes[card.content_type] || card.content_type || "Conteúdo";

  const message = `🎉 *Conteúdo Publicado!*

O conteúdo abaixo acabou de ser publicado no Instagram:

📱 *${contentType}*
📝 *Tema:* ${card.theme || "—"}

🔗 Veja o post: ${postUrl}

Obrigado! ✨`;

  const baseUrl = instance.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");

  for (const target of targets) {
    try {
      await fetch(`${baseUrl}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instance.api_key,
        },
        body: JSON.stringify({ number: target.phone, text: message }),
      });
    } catch (err) {
      console.error(`Error sending publish notification to ${target.phone}:`, err);
    }
  }
}
