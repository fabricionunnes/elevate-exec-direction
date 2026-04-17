// Edge Function: whitelabel-reset-admin-password
// Reseta a senha do admin (owner) de um tenant white-label e devolve a nova senha temporária.
// Acesso: apenas o usuário master.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generatePassword(len = 14): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerEmail = (claimsData.claims.email as string | undefined)?.toLowerCase();
    if (callerEmail !== "fabricio@universidadevendas.com.br") {
      return new Response(
        JSON.stringify({ error: "Forbidden — apenas o usuário master" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Buscar tenant
    const { data: tenant, error: tErr } = await supabase
      .from("whitelabel_tenants")
      .select("id, name, slug, owner_user_id")
      .eq("id", tenant_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tenant.owner_user_id) {
      return new Response(
        JSON.stringify({ error: "Este tenant não tem um admin (owner_user_id) vinculado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pegar email do admin
    const { data: userInfo, error: getErr } = await supabase.auth.admin.getUserById(
      tenant.owner_user_id,
    );
    if (getErr) throw getErr;
    const adminEmail = userInfo?.user?.email || null;

    // Gerar e aplicar nova senha
    const newPassword = generatePassword();
    const { error: updErr } = await supabase.auth.admin.updateUserById(tenant.owner_user_id, {
      password: newPassword,
    });
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        success: true,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        admin: {
          user_id: tenant.owner_user_id,
          email: adminEmail,
          new_password: newPassword,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[whitelabel-reset-admin-password] error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
