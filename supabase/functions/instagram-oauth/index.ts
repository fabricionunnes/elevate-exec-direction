// OAuth do Instagram pro inbox do CRM — modelo "Instagram API with Instagram Login".
// O app da Meta usa o caso de uso "API do Instagram" com login DIRETO do Instagram
// (sem página do Facebook): autorização em instagram.com, tokens em api.instagram.com
// e chamadas em graph.instagram.com, com escopos instagram_business_*.
// (O modelo antigo via Facebook Login pedia instagram_manage_* e o app rejeitava
// com "Invalid Scopes".)
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IG_APP_ID = Deno.env.get("IG_APP_ID");
const IG_APP_SECRET = Deno.env.get("IG_APP_SECRET");
const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    console.log("Instagram OAuth - Action:", action);

    if (!IG_APP_ID || !IG_APP_SECRET) {
      throw new Error("Instagram App credentials not configured (IG_APP_ID/IG_APP_SECRET)");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Action: registra a subscription de DMs no nível do app (webhook).
    // Tenta no app do Instagram e também no app Facebook pai — idempotente.
    if (action === "setup_webhook") {
      const verifyToken = Deno.env.get("IG_WEBHOOK_VERIFY_TOKEN");
      if (!verifyToken) throw new Error("IG_WEBHOOK_VERIFY_TOKEN não configurado");

      const callbackUrl = `${SUPABASE_URL}/functions/v1/instagram-webhook`;
      const results: Record<string, unknown> = {};

      const subscribe = async (appId: string, appSecret: string, graphHost: string) => {
        const subUrl = new URL(`https://${graphHost}/v21.0/${appId}/subscriptions`);
        subUrl.searchParams.set("object", "instagram");
        subUrl.searchParams.set("callback_url", callbackUrl);
        subUrl.searchParams.set("verify_token", verifyToken);
        subUrl.searchParams.set("fields", "messages");
        subUrl.searchParams.set("access_token", `${appId}|${appSecret}`);
        const resp = await fetch(subUrl.toString(), { method: "POST" });
        return await resp.json();
      };

      results.ig_app = await subscribe(IG_APP_ID, IG_APP_SECRET, "graph.instagram.com");
      if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
        results.fb_app = await subscribe(FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, "graph.facebook.com");
      }

      return new Response(JSON.stringify({ results, callbackUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Get authorization URL (login direto do Instagram)
    if (action === "auth_url") {
      const { staffId, redirectUri, projectId, returnOrigin, returnPath } = body;

      if (!staffId || !redirectUri) {
        throw new Error("staffId and redirectUri are required");
      }

      const state = JSON.stringify({
        staffId,
        redirectUri,
        projectId: projectId || null,
        returnOrigin: returnOrigin || null,
        returnPath: returnPath || null,
        flow: "crm",
      });
      const encodedState = btoa(state);

      const authUrl = new URL("https://www.instagram.com/oauth/authorize");
      authUrl.searchParams.set("client_id", IG_APP_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", IG_SCOPES);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", encodedState);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Exchange code for tokens
    if (action === "exchange") {
      const { code, redirectUri, staffId, projectId } = body;

      if (!code || !redirectUri || !staffId) {
        throw new Error("code, redirectUri and staffId are required");
      }

      console.log("Exchanging code for Instagram access token...");

      // Step 1: code -> short-lived token (api.instagram.com, form-encoded)
      const form = new URLSearchParams();
      form.set("client_id", IG_APP_ID);
      form.set("client_secret", IG_APP_SECRET);
      form.set("grant_type", "authorization_code");
      form.set("redirect_uri", redirectUri);
      form.set("code", code);

      const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const tokenData = await tokenResponse.json();

      if (tokenData.error_type || tokenData.error) {
        console.error("Token exchange error:", tokenData);
        throw new Error(tokenData.error_message || tokenData.error?.message || "Token exchange failed");
      }

      const shortLivedToken = tokenData.access_token;
      console.log("Short-lived IG token obtained");

      // Step 2: short-lived -> long-lived (~60 dias)
      const longLivedUrl = new URL("https://graph.instagram.com/access_token");
      longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
      longLivedUrl.searchParams.set("client_secret", IG_APP_SECRET);
      longLivedUrl.searchParams.set("access_token", shortLivedToken);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedResponse.json();

      if (longLivedData.error) {
        console.error("Long-lived token error:", longLivedData.error);
        throw new Error(longLivedData.error.message || "Failed to get long-lived token");
      }

      const accessToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 5184000;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step 3: dados da conta conectada
      const meUrl = new URL("https://graph.instagram.com/v21.0/me");
      meUrl.searchParams.set("fields", "id,user_id,username,name,profile_picture_url");
      meUrl.searchParams.set("access_token", accessToken);
      const meResp = await fetch(meUrl.toString());
      const me = await meResp.json();

      if (me.error) {
        console.error("Profile fetch error:", me.error);
        throw new Error(me.error.message || "Failed to fetch Instagram profile");
      }

      // id = app-scoped; user_id = Instagram professional account ID (o que os
      // webhooks usam em entry.id). Guardamos o que os webhooks entregam.
      const igAccountId = String(me.user_id || me.id);

      const upsertData: any = {
        instagram_account_id: igAccountId,
        instagram_username: me.username ?? null,
        instance_name: me.username ? `@${me.username}` : (me.name ?? "Instagram"),
        profile_picture_url: me.profile_picture_url ?? null,
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
        page_id: null,
        page_name: null,
        status: "active",
        connected_by: staffId,
      };
      if (projectId) upsertData.project_id = projectId;

      const { data: instance, error: upsertError } = await supabase
        .from("instagram_instances")
        .upsert(upsertData, { onConflict: "instagram_account_id", ignoreDuplicates: false })
        .select()
        .single();

      if (upsertError) {
        console.error("Error saving instance:", upsertError);
        throw new Error("Falha ao salvar a conta conectada");
      }

      // Acesso do staff que conectou
      await supabase
        .from("instagram_instance_access")
        .upsert({
          instance_id: instance.id,
          staff_id: staffId,
          can_view: true,
          can_reply: true,
        }, { onConflict: "instance_id,staff_id" });

      // Assina o app nos webhooks DESSA conta (DMs)
      try {
        const subUrl = new URL(`https://graph.instagram.com/v21.0/${me.id}/subscribed_apps`);
        subUrl.searchParams.set("subscribed_fields", "messages");
        subUrl.searchParams.set("access_token", accessToken);
        const subResp = await fetch(subUrl.toString(), { method: "POST" });
        console.log("Account webhook subscription:", JSON.stringify(await subResp.json()));
      } catch (subErr) {
        console.error("Failed to subscribe account to webhooks:", subErr);
      }

      return new Response(JSON.stringify({
        success: true,
        instances: [instance],
        count: 1,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: List connected instances
    if (action === "list") {
      const { staffId } = body;
      if (!staffId) throw new Error("staffId is required");

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

      if (error) throw new Error("Failed to fetch instances");

      return new Response(JSON.stringify({ instances: instances || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Disconnect an instance
    if (action === "disconnect") {
      const { instanceId, staffId } = body;
      if (!instanceId || !staffId) throw new Error("instanceId and staffId are required");

      const { data: access } = await supabase
        .from("instagram_instance_access")
        .select("*")
        .eq("instance_id", instanceId)
        .eq("staff_id", staffId)
        .single();

      if (!access) throw new Error("Access denied");

      const { error: updateError } = await supabase
        .from("instagram_instances")
        .update({ status: "disconnected" })
        .eq("id", instanceId);

      if (updateError) throw new Error("Failed to disconnect instance");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Refresh token (long-lived IG token: ig_refresh_token)
    if (action === "refresh") {
      const { instanceId } = body;
      if (!instanceId) throw new Error("instanceId is required");

      const { data: instance, error: fetchError } = await supabase
        .from("instagram_instances")
        .select("*")
        .eq("id", instanceId)
        .single();

      if (fetchError || !instance) throw new Error("Instance not found");

      const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
      refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
      refreshUrl.searchParams.set("access_token", instance.access_token);

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

      if (updateError) throw new Error("Failed to update token");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Instagram OAuth error:", error);
    // 200 + {error}: o front checa data.error; com 400 o invoke esconde o corpo
    // e a tela mostrava só "non-2xx" sem a causa real.
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
