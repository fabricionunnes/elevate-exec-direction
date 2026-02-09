import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Normalize SITE_URL to always have trailing slash for Meta Strict Mode compatibility
const rawSiteUrl = Deno.env.get("SITE_URL") || "https://elevate-exec-direction.lovable.app";
const SITE_URL = rawSiteUrl.endsWith("/") ? rawSiteUrl : `${rawSiteUrl}/`;

console.log("Social Instagram Auth - Configured redirect_uri:", SITE_URL);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    console.log("Social Instagram Auth - Action:", action);

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      throw new Error("Facebook App credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Action: Get authorization URL
    if (action === "get_auth_url") {
      const { projectId } = body;
      
      if (!projectId) {
        throw new Error("projectId is required");
      }

      // Instagram Business scopes for content publishing
      const scopes = [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "business_management"
      ].join(",");

      // Mark this as "social" flow to differentiate from CRM OAuth
      const state = JSON.stringify({ projectId, flow: "social" });
      const encodedState = btoa(state);

      const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      authUrl.searchParams.set("redirect_uri", SITE_URL);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", encodedState);

      console.log("Generated auth URL for project:", projectId);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Exchange code for tokens
    if (action === "exchange") {
      const { code, projectId } = body;

      if (!code || !projectId) {
        throw new Error("code and projectId are required");
      }

      console.log("Exchanging code for access token for project:", projectId);

      // Step 1: Exchange code for short-lived token
      const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
      tokenUrl.searchParams.set("redirect_uri", SITE_URL);
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

      let instagramAccount: any = null;

      for (const page of accountsData.data || []) {
        if (page.instagram_business_account) {
          const igAccount = page.instagram_business_account;
          
          // Get page access token for this specific page
          const pageTokenUrl = new URL(`https://graph.facebook.com/v19.0/${page.id}`);
          pageTokenUrl.searchParams.set("fields", "access_token");
          pageTokenUrl.searchParams.set("access_token", longLivedToken);
          
          const pageTokenResponse = await fetch(pageTokenUrl.toString());
          const pageTokenData = await pageTokenResponse.json();

          instagramAccount = {
            instagram_user_id: igAccount.id,
            username: igAccount.username,
            profile_picture_url: igAccount.profile_picture_url,
            followers_count: igAccount.followers_count,
            facebook_page_id: page.id,
            facebook_page_name: page.name,
            access_token: pageTokenData.access_token || longLivedToken,
          };
          break; // Use the first account found
        }
      }

      if (!instagramAccount) {
        throw new Error("Nenhuma conta Instagram Business conectada foi encontrada. Certifique-se de que sua página do Facebook está conectada a uma conta Instagram Business ou Creator.");
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step 4: Save to social_instagram_accounts table
      const { data: savedAccount, error: upsertError } = await supabase
        .from("social_instagram_accounts")
        .upsert({
          project_id: projectId,
          instagram_user_id: instagramAccount.instagram_user_id,
          instagram_username: instagramAccount.username,
          profile_picture_url: instagramAccount.profile_picture_url,
          followers_count: instagramAccount.followers_count,
          facebook_page_id: instagramAccount.facebook_page_id,
          access_token: instagramAccount.access_token,
          token_expires_at: expiresAt.toISOString(),
          is_connected: true,
        }, { 
          onConflict: "project_id",
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (upsertError) {
        console.error("Error saving account:", upsertError);
        throw new Error("Failed to save Instagram account");
      }

      // Also update social_integrations table
      await supabase
        .from("social_integrations")
        .upsert({
          project_id: projectId,
          platform: "instagram",
          status: "connected",
          account_name: `@${instagramAccount.username}`,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: "project_id,platform" });

      console.log("Instagram account saved for project:", projectId);

      return new Response(JSON.stringify({ 
        success: true,
        account: {
          username: instagramAccount.username,
          profile_picture_url: instagramAccount.profile_picture_url,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Refresh token
    if (action === "refresh") {
      const { projectId } = body;

      if (!projectId) {
        throw new Error("projectId is required");
      }

      const { data: account, error: fetchError } = await supabase
        .from("social_instagram_accounts")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (fetchError || !account) {
        throw new Error("Account not found");
      }

      // Refresh the long-lived token
      const refreshUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
      refreshUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      refreshUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
      refreshUrl.searchParams.set("fb_exchange_token", account.access_token);

      const refreshResponse = await fetch(refreshUrl.toString());
      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        console.error("Token refresh error:", refreshData.error);
        throw new Error(refreshData.error.message || "Failed to refresh token");
      }

      const expiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);

      const { error: updateError } = await supabase
        .from("social_instagram_accounts")
        .update({
          access_token: refreshData.access_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq("project_id", projectId);

      if (updateError) {
        throw new Error("Failed to update token");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Disconnect
    if (action === "disconnect") {
      const { projectId } = body;

      if (!projectId) {
        throw new Error("projectId is required");
      }

      const { error: updateError } = await supabase
        .from("social_instagram_accounts")
        .update({ is_connected: false, access_token: null })
        .eq("project_id", projectId);

      if (updateError) {
        throw new Error("Failed to disconnect");
      }

      // Also update social_integrations table
      await supabase
        .from("social_integrations")
        .update({ status: "disconnected", account_name: null })
        .eq("project_id", projectId)
        .eq("platform", "instagram");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Social Instagram Auth error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
