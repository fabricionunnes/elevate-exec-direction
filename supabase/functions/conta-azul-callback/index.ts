import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONTA_AZUL_TOKEN_URL = "https://api.contaazul.com/oauth2/token";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("CONTA_AZUL_CLIENT_ID")!;
    const clientSecret = Deno.env.get("CONTA_AZUL_CLIENT_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle error from Conta Azul
    if (error) {
      console.error("OAuth error:", error);
      return redirectToApp("error=auth_denied");
    }

    if (!code) {
      return redirectToApp("error=no_code");
    }

    // Validate state
    const { data: integration } = await supabase
      .from("financial_integrations")
      .select("config")
      .eq("integration_type", "conta_azul")
      .single();

    const storedState = (integration?.config as any)?.oauth_state;
    if (state && storedState && state !== storedState) {
      console.error("State mismatch");
      return redirectToApp("error=invalid_state");
    }

    // Exchange code for tokens
    const redirectUri = `${supabaseUrl}/functions/v1/conta-azul-callback`;
    
    const tokenResponse = await fetch(CONTA_AZUL_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return redirectToApp("error=token_failed");
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens received successfully");

    // Store tokens
    await supabase.from("financial_integrations").upsert({
      integration_type: "conta_azul",
      is_active: true,
      config: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      },
      sync_status: "connected",
      last_sync_at: null
    }, { onConflict: "integration_type" });

    return redirectToApp("success=true");

  } catch (err: any) {
    console.error("Callback error:", err);
    return redirectToApp("error=unknown");
  }
});

function redirectToApp(params: string) {
  // Redirect back to the financial module
  const appUrl = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/#/onboarding-tasks/financeiro?tab=integracoes&${params}`;
  
  // Fallback - just redirect to origin
  const fallbackUrl = `https://czmyjgdixwhpfasfugkm.lovable.app/#/onboarding-tasks/financeiro?tab=integracoes&${params}`;
  
  return new Response(null, {
    status: 302,
    headers: {
      "Location": fallbackUrl
    }
  });
}
