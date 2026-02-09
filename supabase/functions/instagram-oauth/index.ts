import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    console.log("Instagram OAuth - Action:", action);

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      throw new Error("Facebook App credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Action: Get authorization URL
    if (action === "auth_url") {
      const { staffId, redirectUri } = body;
      
      if (!staffId || !redirectUri) {
        throw new Error("staffId and redirectUri are required");
      }

      // Instagram Business/Creator scopes
      const scopes = [
        "instagram_basic",
        "instagram_manage_messages",
        "instagram_manage_comments",
        "pages_show_list",
        "pages_messaging",
        "pages_manage_metadata",
        "business_management"
      ].join(",");

      const state = JSON.stringify({ staffId, redirectUri });
      const encodedState = btoa(state);

      const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", encodedState);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Exchange code for tokens
    if (action === "exchange") {
      const { code, redirectUri, staffId } = body;

      if (!code || !redirectUri || !staffId) {
        throw new Error("code, redirectUri and staffId are required");
      }

      console.log("Exchanging code for access token...");

      // Step 1: Exchange code for short-lived token
      const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code);

      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error("Token exchange error:", tokenData.error);
        throw new Error(tokenData.error.message || "Token exchange failed");
      }

      const shortLivedToken = tokenData.access_token;
      console.log("Short-lived token obtained");

      // Step 2: Exchange for long-lived token
      const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      longLivedUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
      longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedResponse.json();

      if (longLivedData.error) {
        console.error("Long-lived token error:", longLivedData.error);
        throw new Error(longLivedData.error.message || "Failed to get long-lived token");
      }

      const longLivedToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 5184000; // ~60 days default
      console.log("Long-lived token obtained, expires in:", expiresIn);

      // Step 3: Get connected Instagram Business accounts
      const accountsUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
      accountsUrl.searchParams.set("access_token", longLivedToken);
      accountsUrl.searchParams.set("fields", "id,name,instagram_business_account{id,username,profile_picture_url,followers_count}");

      const accountsResponse = await fetch(accountsUrl.toString());
      const accountsData = await accountsResponse.json();

      if (accountsData.error) {
        console.error("Accounts fetch error:", accountsData.error);
        throw new Error(accountsData.error.message || "Failed to fetch accounts");
      }

      const instagramAccounts: any[] = [];

      for (const page of accountsData.data || []) {
        if (page.instagram_business_account) {
          const igAccount = page.instagram_business_account;
          
          // Get page access token for this specific page
          const pageTokenUrl = new URL(`https://graph.facebook.com/v19.0/${page.id}`);
          pageTokenUrl.searchParams.set("fields", "access_token");
          pageTokenUrl.searchParams.set("access_token", longLivedToken);
          
          const pageTokenResponse = await fetch(pageTokenUrl.toString());
          const pageTokenData = await pageTokenResponse.json();

          instagramAccounts.push({
            instagram_user_id: igAccount.id,
            username: igAccount.username,
            profile_picture_url: igAccount.profile_picture_url,
            followers_count: igAccount.followers_count,
            facebook_page_id: page.id,
            facebook_page_name: page.name,
            access_token: pageTokenData.access_token || longLivedToken,
          });
        }
      }

      if (instagramAccounts.length === 0) {
        throw new Error("Nenhuma conta Instagram Business conectada foi encontrada. Certifique-se de que sua página do Facebook está conectada a uma conta Instagram Business ou Creator.");
      }

      // Step 4: Save accounts to database
      const savedInstances: any[] = [];

      for (const account of instagramAccounts) {
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        const { data: instance, error: upsertError } = await supabase
          .from("instagram_instances")
          .upsert({
            instagram_user_id: account.instagram_user_id,
            username: account.username,
            profile_picture_url: account.profile_picture_url,
            access_token: account.access_token,
            token_expires_at: expiresAt.toISOString(),
            facebook_page_id: account.facebook_page_id,
            status: "connected",
            connected_by: staffId,
          }, { 
            onConflict: "instagram_user_id",
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (upsertError) {
          console.error("Error saving instance:", upsertError);
          continue;
        }

        // Grant access to the staff member who connected
        await supabase
          .from("instagram_instance_access")
          .upsert({
            instance_id: instance.id,
            staff_id: staffId,
            can_view: true,
            can_reply: true,
          }, { onConflict: "instance_id,staff_id" });

        savedInstances.push(instance);
      }

      return new Response(JSON.stringify({ 
        success: true,
        instances: savedInstances,
        count: savedInstances.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: List connected instances
    if (action === "list") {
      const { staffId } = body;

      if (!staffId) {
        throw new Error("staffId is required");
      }

      // Get instances the staff has access to
      const { data: instances, error } = await supabase
        .from("instagram_instances")
        .select(`
          *,
          instagram_instance_access!inner (
            can_view,
            can_reply
          )
        `)
        .eq("instagram_instance_access.staff_id", staffId)
        .eq("instagram_instance_access.can_view", true);

      if (error) {
        throw new Error("Failed to fetch instances");
      }

      return new Response(JSON.stringify({ instances: instances || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Disconnect an instance
    if (action === "disconnect") {
      const { instanceId, staffId } = body;

      if (!instanceId || !staffId) {
        throw new Error("instanceId and staffId are required");
      }

      // Verify staff has access
      const { data: access } = await supabase
        .from("instagram_instance_access")
        .select("*")
        .eq("instance_id", instanceId)
        .eq("staff_id", staffId)
        .single();

      if (!access) {
        throw new Error("Access denied");
      }

      // Update instance status
      const { error: updateError } = await supabase
        .from("instagram_instances")
        .update({ status: "disconnected" })
        .eq("id", instanceId);

      if (updateError) {
        throw new Error("Failed to disconnect instance");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Refresh token
    if (action === "refresh") {
      const { instanceId } = body;

      if (!instanceId) {
        throw new Error("instanceId is required");
      }

      const { data: instance, error: fetchError } = await supabase
        .from("instagram_instances")
        .select("*")
        .eq("id", instanceId)
        .single();

      if (fetchError || !instance) {
        throw new Error("Instance not found");
      }

      // Refresh the long-lived token
      const refreshUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
      refreshUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      refreshUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
      refreshUrl.searchParams.set("fb_exchange_token", instance.access_token);

      const refreshResponse = await fetch(refreshUrl.toString());
      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        console.error("Token refresh error:", refreshData.error);
        throw new Error(refreshData.error.message || "Failed to refresh token");
      }

      const expiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);

      const { error: updateError } = await supabase
        .from("instagram_instances")
        .update({
          access_token: refreshData.access_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq("id", instanceId);

      if (updateError) {
        throw new Error("Failed to update token");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Instagram OAuth error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
