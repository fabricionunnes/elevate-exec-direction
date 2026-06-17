// dialer-tenant-users: gerencia os usuários (agentes) de um cliente do discador. Só staff UNV.
// list / add / set_limit. O limite (whitelabel_tenants.max_users) é o teto do plano.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // auth UNV
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(jwt);
    const uid = u?.user?.id;
    const { data: me } = uid ? await supabase.from("onboarding_staff").select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle() : { data: null };
    if (!me || !me.is_active || me.tenant_id || !["master", "admin", "head_comercial"].includes(me.role)) {
      return json({ error: "Acesso restrito à UNV" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const tenantId: string = body.tenantId;
    if (!tenantId) throw new Error("tenantId é obrigatório");

    const { data: tenant } = await supabase.from("whitelabel_tenants").select("id, name, max_users").eq("id", tenantId).maybeSingle();
    if (!tenant) throw new Error("Cliente não encontrado");

    // usuários do discador desse cliente
    const loadUsers = async () => {
      const { data: staff } = await supabase.from("onboarding_staff").select("id, name, email, is_active").eq("tenant_id", tenantId).eq("dialer_only", true);
      const { data: portal } = await supabase.from("onboarding_users").select("id, name, email").eq("tenant_id", tenantId).eq("dialer_enabled", true);
      return [
        ...(staff || []).map((s: any) => ({ ...s, kind: "login" })),
        ...(portal || []).map((p: any) => ({ ...p, kind: "portal" })),
      ];
    };

    if (action === "set_limit") {
      await supabase.from("whitelabel_tenants").update({ max_users: body.maxUsers != null ? Number(body.maxUsers) : null }).eq("id", tenantId);
      return json({ ok: true, max_users: body.maxUsers ?? null });
    }

    if (action === "add") {
      const name = (body.name || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      if (!name || !email) throw new Error("name e email são obrigatórios");

      const users = await loadUsers();
      const limit = tenant.max_users;
      if (limit != null && users.length >= limit) {
        return json({ error: `Limite do plano atingido (${limit} usuário(s)). Aumente o plano para adicionar mais.` }, 400);
      }

      const tempPassword = "Disc-" + crypto.randomUUID().slice(0, 8) + "!";
      const ures = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: tempPassword, email_confirm: true }),
      });
      const udata = await ures.json();
      if (!ures.ok) throw new Error(udata?.msg || udata?.error_description || "Falha ao criar login");

      const { data: staff } = await supabase.from("onboarding_staff").insert({
        user_id: udata.id, tenant_id: tenantId, role: "closer", name, email, is_active: true, dialer_only: true,
      }).select("id").single();
      await supabase.from("staff_menu_permissions").insert({ staff_id: staff.id, menu_key: "crm" });

      return json({ ok: true, login: email, tempPassword });
    }

    // list (default)
    const users = await loadUsers();
    return json({ tenant: tenant.name, max_users: tenant.max_users, count: users.length, users });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
