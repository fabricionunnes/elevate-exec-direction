import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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
    }

    const { projectId, boardId } = await req.json();

    if (!projectId || !boardId) {
      return new Response(
        JSON.stringify({ success: false, error: "projectId e boardId são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get Instagram account for this project
    const { data: igAccount, error: igError } = await supabaseClient
      .from("social_instagram_accounts")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_connected", true)
      .single();

    if (igError || !igAccount) {
      return new Response(
        JSON.stringify({ success: false, error: "Conta Instagram não conectada para este projeto. Conecte na aba Base Estratégica > Integrações." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!igAccount.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token de acesso inválido. Reconecte o Instagram nas Integrações." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = igAccount.access_token;
    const igUserId = igAccount.instagram_user_id;

    // 2. Fetch all recent media from Instagram
    const mediaUrl = `${GRAPH_API_BASE}/${igUserId}/media?fields=id,caption,timestamp,permalink,like_count,comments_count,media_type,media_url,thumbnail_url&limit=50&access_token=${accessToken}`;
    
    console.log("Fetching media from Instagram...");
    const mediaResponse = await fetch(mediaUrl);
    const mediaData = await mediaResponse.json();

    if (mediaData.error) {
      console.error("Instagram API error:", mediaData.error);
      return new Response(
        JSON.stringify({ success: false, error: `Erro da API Instagram: ${mediaData.error.message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const igMediaList = mediaData.data || [];
    console.log(`Found ${igMediaList.length} media items from Instagram`);

    // 3. Get published cards with their instagram_post_url
    const { data: publishedCards, error: cardsError } = await supabaseClient
      .from("social_content_cards")
      .select("id, instagram_post_url, instagram_post_id, theme, published_at")
      .eq("board_id", boardId)
      .not("published_at", "is", null);

    if (cardsError) throw cardsError;
    console.log(`Found ${publishedCards?.length || 0} published cards`);

    // 4. Match cards to Instagram media
    let synced = 0;
    const results: Array<{ cardId: string; theme: string; matched: boolean }> = [];

    for (const card of (publishedCards || [])) {
      // Try to match by instagram_post_id first, then by URL
      let matchedMedia = null;

      if (card.instagram_post_id) {
        matchedMedia = igMediaList.find((m: any) => m.id === card.instagram_post_id);
      }

      if (!matchedMedia && card.instagram_post_url) {
        // Match by permalink
        matchedMedia = igMediaList.find((m: any) => {
          if (!m.permalink || !card.instagram_post_url) return false;
          // Compare normalized URLs
          const normalize = (url: string) => url.replace(/\/$/, "").toLowerCase();
          return normalize(m.permalink) === normalize(card.instagram_post_url);
        });
      }

      if (!matchedMedia) {
        results.push({ cardId: card.id, theme: card.theme, matched: false });
        continue;
      }

      // 5. Fetch detailed insights for this media
      let saves = 0;
      let shares = 0;
      let reach = 0;
      let impressions = 0;
      let views = 0;

      try {
        const insightsUrl = `${GRAPH_API_BASE}/${matchedMedia.id}/insights?metric=saved,shares,reach,impressions&access_token=${accessToken}`;
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        if (insightsData.data) {
          for (const insight of insightsData.data) {
            const value = insight.values?.[0]?.value || 0;
            switch (insight.name) {
              case "saved": saves = value; break;
              case "shares": shares = value; break;
              case "reach": reach = value; break;
              case "impressions": impressions = value; break;
            }
          }
        }

        // For video/reels, fetch video views
        if (matchedMedia.media_type === "VIDEO" || matchedMedia.media_type === "REELS") {
          try {
            const videoInsightsUrl = `${GRAPH_API_BASE}/${matchedMedia.id}/insights?metric=plays&access_token=${accessToken}`;
            const videoResponse = await fetch(videoInsightsUrl);
            const videoData = await videoResponse.json();
            if (videoData.data?.[0]?.values?.[0]?.value) {
              views = videoData.data[0].values[0].value;
            }
          } catch (e) {
            console.warn("Could not fetch video views:", e);
          }
        }
      } catch (insightError) {
        console.warn(`Could not fetch insights for media ${matchedMedia.id}:`, insightError);
      }

      const likes = matchedMedia.like_count || 0;
      const comments = matchedMedia.comments_count || 0;

      // Calculate engagement rate
      const totalInteractions = likes + comments + saves + shares;
      const reachVal = reach || impressions || 1;
      const engagementRate = Number(((totalInteractions / reachVal) * 100).toFixed(2));

      // 6. Upsert metrics
      const { error: upsertError } = await supabaseClient
        .from("social_post_metrics")
        .upsert({
          card_id: card.id,
          board_id: boardId,
          likes,
          comments,
          saves,
          shares,
          views: views || reach,
          reach,
          impressions,
          engagement_rate: engagementRate,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "card_id" });

      if (upsertError) {
        console.error(`Error upserting metrics for card ${card.id}:`, upsertError);
      } else {
        synced++;
      }

      // Also update instagram_post_id on card if not set
      if (!card.instagram_post_id && matchedMedia.id) {
        await supabaseClient
          .from("social_content_cards")
          .update({ instagram_post_id: matchedMedia.id })
          .eq("id", card.id);
      }

      results.push({ cardId: card.id, theme: card.theme, matched: true });
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        total: publishedCards?.length || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing metrics:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Falha ao sincronizar métricas" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
