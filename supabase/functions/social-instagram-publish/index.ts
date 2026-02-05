import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // 2. Validate card has media
    if (!card.creative_url) {
      return new Response(
        JSON.stringify({ error: "Card has no media to publish" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch Instagram account for the project
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

    // 4. Build caption
    let caption = card.final_caption || card.copy_text || "";
    if (card.hashtags) {
      caption = caption + "\n\n" + card.hashtags;
    }

    // 5. Determine media type and create container
    const isVideo = card.creative_type === "video";
    let containerId: string;

    console.log(`Creating ${isVideo ? "video" : "image"} container...`);

    if (isVideo) {
      // Video/Reels container
      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "REELS",
            video_url: card.creative_url,
            caption: caption,
            access_token: accessToken,
          }),
        }
      );

      const containerData = await containerResponse.json();
      console.log("Video container response:", containerData);

      if (containerData.error) {
        throw new Error(containerData.error.message || "Failed to create video container");
      }

      containerId = containerData.id;
    } else {
      // Image container
      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: card.creative_url,
            caption: caption,
            access_token: accessToken,
          }),
        }
      );

      const containerData = await containerResponse.json();
      console.log("Image container response:", containerData);

      if (containerData.error) {
        throw new Error(containerData.error.message || "Failed to create image container");
      }

      containerId = containerData.id;
    }

    // 6. Wait for container to be ready (poll status)
    let status = "IN_PROGRESS";
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2s = 60s max wait

    while (status === "IN_PROGRESS" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const statusData = await statusResponse.json();
      console.log(`Container status (attempt ${attempts}):`, statusData);

      if (statusData.error) {
        throw new Error(statusData.error.message || "Failed to check container status");
      }

      status = statusData.status_code || "FINISHED";
    }

    if (status === "ERROR") {
      throw new Error("Media container processing failed");
    }

    if (status === "IN_PROGRESS") {
      throw new Error("Media processing timed out");
    }

    // 7. Publish the container
    console.log("Publishing container...");
    const publishResponse = await fetch(
      `${GRAPH_API_BASE}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();
    console.log("Publish response:", publishData);

    if (publishData.error) {
      throw new Error(publishData.error.message || "Failed to publish media");
    }

    const mediaId = publishData.id;

    // 8. Get the permalink
    const permalinkResponse = await fetch(
      `${GRAPH_API_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`
    );
    const permalinkData = await permalinkResponse.json();
    const postUrl = permalinkData.permalink || `https://www.instagram.com/p/${mediaId}/`;

    console.log("Post URL:", postUrl);

    // 9. Log the publication
    await supabaseClient.from("social_publish_logs").insert({
      project_id: projectId,
      card_id: cardId,
      platform: "instagram",
      status: "success",
      post_id: mediaId,
      post_url: postUrl,
      published_at: new Date().toISOString(),
    });

    // 10. Update the card with post info and move to "published" stage
    const { data: publishedStage } = await supabaseClient
      .from("social_content_stages")
      .select("id")
      .eq("board_id", card.board_id)
      .eq("stage_type", "published")
      .single();

    const updateData: Record<string, unknown> = {
      instagram_post_url: postUrl,
      published_at: new Date().toISOString(),
    };

    if (publishedStage) {
      updateData.stage_id = publishedStage.id;
    }

    await supabaseClient
      .from("social_content_cards")
      .update(updateData)
      .eq("id", cardId);

    // 11. Log history
    await supabaseClient.from("social_content_history").insert({
      card_id: cardId,
      action: "published",
      details: { platform: "instagram", post_id: mediaId, post_url: postUrl },
    });

    return new Response(
      JSON.stringify({
        success: true,
        postId: mediaId,
        postUrl: postUrl,
      }),
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
