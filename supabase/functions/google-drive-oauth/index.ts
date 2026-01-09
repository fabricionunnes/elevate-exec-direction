import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get action from request body
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    console.log("Google Drive OAuth - Action:", action);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Action: Get authorization URL
    if (action === "auth_url") {
      const { projectId, redirectUri } = body;
      
      if (!projectId || !redirectUri) {
        throw new Error("projectId and redirectUri are required");
      }

      const scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" ");

      const state = JSON.stringify({ projectId, redirectUri });
      const encodedState = btoa(state);

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", encodedState);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Exchange code for tokens
    if (action === "exchange") {
      const { code, redirectUri, projectId } = body;

      if (!code || !redirectUri || !projectId) {
        throw new Error("code, redirectUri and projectId are required");
      }

      console.log("Exchanging code for tokens...");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error("Token exchange error:", tokenData);
        throw new Error(tokenData.error_description || tokenData.error);
      }

      console.log("Token exchange successful");

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Store tokens in database
      const { error: upsertError } = await supabase
        .from("google_drive_tokens")
        .upsert({
          project_id: projectId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || "Bearer",
          expires_at: expiresAt.toISOString(),
          scope: tokenData.scope,
        }, { onConflict: "project_id" });

      if (upsertError) {
        console.error("Error storing tokens:", upsertError);
        throw new Error("Failed to store tokens");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Refresh token
    if (action === "refresh") {
      const { projectId } = body;

      if (!projectId) {
        throw new Error("projectId is required");
      }

      // Get existing tokens
      const { data: tokenData, error: fetchError } = await supabase
        .from("google_drive_tokens")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (fetchError || !tokenData) {
        throw new Error("No tokens found for this project");
      }

      console.log("Refreshing token...");

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        console.error("Token refresh error:", refreshData);
        throw new Error(refreshData.error_description || refreshData.error);
      }

      // Update tokens
      const expiresAt = new Date(Date.now() + (refreshData.expires_in * 1000));

      const { error: updateError } = await supabase
        .from("google_drive_tokens")
        .update({
          access_token: refreshData.access_token,
          expires_at: expiresAt.toISOString(),
          scope: refreshData.scope || tokenData.scope,
        })
        .eq("project_id", projectId);

      if (updateError) {
        console.error("Error updating tokens:", updateError);
        throw new Error("Failed to update tokens");
      }

      return new Response(JSON.stringify({ 
        success: true,
        access_token: refreshData.access_token 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Check connection status
    if (action === "status") {
      const { projectId } = body;

      if (!projectId) {
        throw new Error("projectId is required");
      }

      const { data: tokenData, error } = await supabase
        .from("google_drive_tokens")
        .select("expires_at, created_at")
        .eq("project_id", projectId)
        .single();

      if (error || !tokenData) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isExpired = new Date(tokenData.expires_at) < new Date();

      return new Response(JSON.stringify({ 
        connected: true,
        expired: isExpired,
        connectedAt: tokenData.created_at
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Disconnect
    if (action === "disconnect") {
      const { projectId } = body;

      if (!projectId) {
        throw new Error("projectId is required");
      }

      const { error } = await supabase
        .from("google_drive_tokens")
        .delete()
        .eq("project_id", projectId);

      if (error) {
        throw new Error("Failed to disconnect");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Google Drive OAuth error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
