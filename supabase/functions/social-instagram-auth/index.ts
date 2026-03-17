import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Fallback SITE_URL — prefer client-provided redirectUri
const rawSiteUrl = Deno.env.get("SITE_URL") || "https://elevate-exec-direction.lovable.app";
const DEFAULT_SITE_URL = rawSiteUrl.endsWith("/") ? rawSiteUrl : `${rawSiteUrl}/`;

console.log("Social Instagram Auth - Default redirect_uri:", DEFAULT_SITE_URL);

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
      const { projectId, redirectUri: clientRedirectUri } = body;
      
      if (!projectId) {
        throw new Error("projectId is required");
      }

      // Use client-provided redirectUri (from window.location.origin) or fallback
      const redirectUri = clientRedirectUri || DEFAULT_SITE_URL;
      console.log("Social Instagram Auth - Using redirect_uri:", redirectUri);

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
      const state = JSON.stringify({ projectId, flow: "social", redirectUri });
      const encodedState = btoa(state);

      const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
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
      const { code, projectId, redirectUri: clientRedirectUri } = body;

      if (!code || !projectId) {
        throw new Error("code and projectId are required");
      }

      const redirectUri = clientRedirectUri || DEFAULT_SITE_URL;
      console.log("Exchanging code for access token for project:", projectId, "with redirect_uri:", redirectUri);

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
      const expiresIn = longLivedData.expires_in || 5184000;

      // Step 3: Get ALL connected Instagram Business accounts
      const accountsUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
      accountsUrl.searchParams.set("access_token", longLivedToken);
      accountsUrl.searchParams.set("fields", "id,name,instagram_business_account{id,username,profile_picture_url,followers_count}");
      accountsUrl.searchParams.set("limit", "100");

      const accountsResponse = await fetch(accountsUrl.toString());
      const accountsData = await accountsResponse.json();

      if (accountsData.error) {
        console.error("Accounts fetch error:", accountsData.error);
        throw new Error(accountsData.error.message || "Failed to fetch accounts");
      }

      // Collect ALL Instagram accounts
      const instagramAccounts: any[] = [];
      for (const page of accountsData.data || []) {
        if (page.instagram_business_account) {
          const igAccount = page.instagram_business_account;
          
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

      // If multiple accounts, return the list for the user to choose
      if (instagramAccounts.length > 1) {
        // Store the token temporarily so we can use it when the user picks an account
        // We'll store in a temporary record
        const tempData = {
          longLivedToken,
          expiresIn,
          accounts: instagramAccounts,
        };

        // Save temp data keyed by projectId
        await supabase
          .from("social_instagram_accounts")
          .upsert({
            project_id: projectId,
            instagram_user_id: "pending_selection",
            instagram_username: null,
            access_token: longLivedToken,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            is_connected: false,
          }, { onConflict: "project_id", ignoreDuplicates: false });

        return new Response(JSON.stringify({ 
          success: true,
          multiple: true,
          accounts: instagramAccounts.map(a => ({
            instagram_user_id: a.instagram_user_id,
            username: a.username,
            profile_picture_url: a.profile_picture_url,
            followers_count: a.followers_count,
            facebook_page_name: a.facebook_page_name,
          })),
          projectId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Single account — save directly
      const instagramAccount = instagramAccounts[0];
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const { error: upsertError } = await supabase
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
        }, { onConflict: "project_id", ignoreDuplicates: false })
        .select()
        .single();

      if (upsertError) {
        console.error("Error saving account:", upsertError);
        throw new Error("Failed to save Instagram account");
      }

      await supabase
        .from("social_integrations")
        .upsert({
          project_id: projectId,
          platform: "instagram",
          status: "connected",
          account_name: `@${instagramAccount.username}`,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: "project_id,platform" });

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

    // Action: Select a specific account (after multiple were found)
    if (action === "select_account") {
      const { projectId, instagramUserId, username, profilePictureUrl, followersCount, facebookPageId, facebookPageName } = body;

      if (!projectId || !instagramUserId) {
        throw new Error("projectId and instagramUserId are required");
      }

      // Retrieve the stored token from the pending record
      const { data: pendingAccount, error: fetchErr } = await supabase
        .from("social_instagram_accounts")
        .select("access_token, token_expires_at")
        .eq("project_id", projectId)
        .single();

      if (fetchErr || !pendingAccount?.access_token) {
        throw new Error("Token expirado. Reconecte o Instagram.");
      }

      // Get the page-specific access token
      const longLivedToken = pendingAccount.access_token;
      const pageTokenUrl = new URL(`https://graph.facebook.com/v19.0/${facebookPageId}`);
      pageTokenUrl.searchParams.set("fields", "access_token");
      pageTokenUrl.searchParams.set("access_token", longLivedToken);
      
      const pageTokenResponse = await fetch(pageTokenUrl.toString());
      const pageTokenData = await pageTokenResponse.json();
      const pageAccessToken = pageTokenData.access_token || longLivedToken;

      const { error: upsertError } = await supabase
        .from("social_instagram_accounts")
        .upsert({
          project_id: projectId,
          instagram_user_id: instagramUserId,
          instagram_username: username,
          profile_picture_url: profilePictureUrl,
          followers_count: followersCount,
          facebook_page_id: facebookPageId,
          access_token: pageAccessToken,
          token_expires_at: pendingAccount.token_expires_at,
          is_connected: true,
        }, { onConflict: "project_id", ignoreDuplicates: false });

      if (upsertError) {
        console.error("Error saving selected account:", upsertError);
        throw new Error("Failed to save Instagram account");
      }

      await supabase
        .from("social_integrations")
        .upsert({
          project_id: projectId,
          platform: "instagram",
          status: "connected",
          account_name: `@${username}`,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: "project_id,platform" });

      return new Response(JSON.stringify({ 
        success: true,
        account: { username, profile_picture_url: profilePictureUrl }
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
