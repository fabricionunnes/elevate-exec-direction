// dialer-client-manage: editar (plano/limite/status) ou excluir (soft) um cliente do discador. Só UNV.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

    if (action === "delete") {
      // soft delete: cancela o cliente e desativa os acessos (reversível)
      await supabase.from("whitelabel_tenants").update({ status: "cancelled" }).eq("id", tenantId);
      await supabase.from("onboarding_staff").update({ is_active: false }).eq("tenant_id", tenantId).eq("dialer_only", true);
      await supabase.from("onboarding_users").update({ dialer_enabled: false }).eq("tenant_id", tenantId);
      return json({ ok: true, deleted: true });
    }

    if (action === "update") {
      if (body.status) await supabase.from("whitelabel_tenants").update({ status: body.status }).eq("id", tenantId);
      if (body.maxUsers !== undefined) await supabase.from("whitelabel_tenants").update({ max_users: body.maxUsers === null || body.maxUsers === "" ? null : Number(body.maxUsers) }).eq("id", tenantId);
      if (body.planPrice != null) {
        const { data: ex } = await supabase.from("dialer_pricing").select("id").eq("tenant_id", tenantId).maybeSingle();
        if (ex) await supabase.from("dialer_pricing").update({ plan_price_per_user: Number(body.planPrice) }).eq("tenant_id", tenantId);
        else await supabase.from("dialer_pricing").insert({ tenant_id: tenantId, plan_price_per_user: Number(body.planPrice) });
      }
      return json({ ok: true, updated: true });
    }

    throw new Error("action inválida (update | delete)");
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
