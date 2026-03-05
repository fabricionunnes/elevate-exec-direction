import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subscription_id, asaas_account_id } = await req.json();
    if (!subscription_id) {
      return new Response(
        JSON.stringify({ error: "subscription_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve API key: if asaas_account_id is provided, look up the secret name
    let ASAAS_API_KEY: string | undefined;

    if (asaas_account_id) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: account } = await supabaseAdmin
        .from("asaas_accounts")
        .select("api_key_secret_name")
        .eq("id", asaas_account_id)
        .single();

      if (account?.api_key_secret_name) {
        ASAAS_API_KEY = Deno.env.get(account.api_key_secret_name);
        console.log(`Using Asaas account: ${account.api_key_secret_name}`);
      }
    }

    if (!ASAAS_API_KEY) {
      ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    }
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    console.log("Cancelling Asaas subscription:", subscription_id);

    const res = await fetch(`https://api.asaas.com/v3/subscriptions/${subscription_id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Asaas cancel error:", JSON.stringify(data));
      throw new Error(data.errors?.[0]?.description || "Erro ao cancelar assinatura");
    }

    console.log("Asaas subscription cancelled:", subscription_id);

    return new Response(
      JSON.stringify({ success: true, deleted: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cancel error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
