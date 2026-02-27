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
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    const { subscription_id } = await req.json();
    if (!subscription_id) {
      return new Response(
        JSON.stringify({ error: "subscription_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
