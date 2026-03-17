import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { cardId, projectId } = await req.json();

    if (!cardId || !projectId) {
      return new Response(
        JSON.stringify({ error: "cardId and projectId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the card
    const { data: card, error: cardError } = await supabaseClient
      .from("social_content_cards")
      .select("instagram_post_id, instagram_post_url, published_at")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not published, nothing to delete from Instagram
    if (!card.instagram_post_id) {
      return new Response(
        JSON.stringify({ success: true, message: "Card was not published on Instagram" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Instagram account for access token
    const { data: igAccount, error: igError } = await supabaseClient
      .from("social_instagram_accounts")
      .select("access_token")
      .eq("project_id", projectId)
      .eq("is_connected", true)
      .single();

    if (igError || !igAccount?.access_token) {
      console.error("Instagram account not found:", igError);
      return new Response(
        JSON.stringify({ error: "Conta Instagram não conectada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete from Instagram via Graph API
    const deleteResponse = await fetch(
      `${GRAPH_API_BASE}/${card.instagram_post_id}?access_token=${igAccount.access_token}`,
      { method: "DELETE" }
    );

    const deleteData = await deleteResponse.json();
    console.log("Instagram delete response:", deleteData);

    if (deleteData.error) {
      // If post already doesn't exist, that's fine
      if (deleteData.error.code === 100 || deleteData.error.code === 803) {
        console.log("Post already deleted from Instagram");
        return new Response(
          JSON.stringify({ success: true, message: "Post already removed from Instagram" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(deleteData.error.message || "Failed to delete from Instagram");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Post deleted from Instagram" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error deleting Instagram post:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
