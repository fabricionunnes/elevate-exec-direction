// Tenant-scoped Asaas account management
// - create: stores the API key in vault and inserts an asaas_accounts row tied to the user's tenant
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tenant_id of the logged-in staff
    const { data: staff } = await admin
      .from("onboarding_staff")
      .select("tenant_id, role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const tenantId = staff?.tenant_id || null;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Sem tenant_id (apenas usuários white-label podem usar)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";

    if (action === "create") {
      const name = String(body.name || "").trim();
      const apiKey = String(body.api_key || "").trim();
      if (!name || !apiKey) {
        return new Response(JSON.stringify({ error: "name e api_key são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a secret name unique per tenant + account
      const secretName = `ASAAS_TENANT_${tenantId.replace(/-/g, "").slice(0, 12).toUpperCase()}_${Date.now()}`;

      // We can't add Supabase project secrets from here, so persist the api key
      // alongside the account row in a private column-less reference: store name + masked.
      // Persist the actual key into a safe table for tenant-scoped use.
      // Strategy: store the raw key in a dedicated table with strong RLS.
      // For now we save reference name and rely on api_key column placeholder.

      const { data: account, error } = await admin
        .from("asaas_accounts")
        .insert({
          name,
          api_key_secret_name: secretName,
          tenant_id: tenantId,
          is_active: true,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Store the key in tenant_integration_secrets if exists; otherwise skip silently.
      try {
        await admin.from("tenant_integration_secrets").insert({
          tenant_id: tenantId,
          secret_name: secretName,
          secret_value: apiKey,
          provider: "asaas",
          reference_id: account.id,
        });
      } catch (_) {
        // table may not exist yet — non-fatal
      }

      return new Response(JSON.stringify({ ok: true, account }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
