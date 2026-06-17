// dialer-provision-client: cadastra um cliente do discador. Só staff UNV.
// mode 'new' = cria login + tenant + funil + carteira + api key (login dedicado, dialer_only).
// mode 'existing_portal' = habilita o discador num cliente do portal já existente (mesmo login).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string): string {
  return (s || "cliente").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

async function createDialerPipeline(supabase: any, tenantId: string): Promise<string | null> {
  const { data: existing } = await supabase.from("crm_pipelines").select("id").eq("name", "Discador").eq("tenant_id", tenantId).maybeSingle();
  if (existing) return existing.id;
  const { data: p } = await supabase.from("crm_pipelines").insert({ name: "Discador", description: "Funil do discador", is_active: true, sort_order: 100, tenant_id: tenantId }).select("id").single();
  await supabase.from("crm_stages").insert([
    { pipeline_id: p.id, name: "Para ligar", sort_order: 0, color: "#3b82f6", tenant_id: tenantId },
    { pipeline_id: p.id, name: "Em qualificação", sort_order: 1, color: "#f59e0b", tenant_id: tenantId },
    { pipeline_id: p.id, name: "Qualificado", sort_order: 2, color: "#10b981", tenant_id: tenantId },
    { pipeline_id: p.id, name: "Sem interesse", sort_order: 3, color: "#ef4444", is_final: true, final_type: "lost", tenant_id: tenantId },
  ]);
  return p.id;
}

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
    const mode = body.mode === "existing_portal" ? "existing_portal" : "new";
    const planPrice = body.planPricePerUser != null ? Number(body.planPricePerUser) : null;
    const initialCredit = body.initialCredit != null ? Number(body.initialCredit) : 0;

    if (mode === "existing_portal") {
      let pu: any = null;
      if (body.portalUserId) {
        ({ data: pu } = await supabase.from("onboarding_users").select("id, tenant_id, name").eq("id", body.portalUserId).maybeSingle());
      } else if (body.email) {
        ({ data: pu } = await supabase.from("onboarding_users").select("id, tenant_id, name").eq("email", String(body.email).trim().toLowerCase()).order("created_at", { ascending: false }).limit(1).maybeSingle());
      }
      if (!pu) throw new Error("Cliente do portal não encontrado (informe e-mail ou id válido)");
      const portalUserId = pu.id;
      if (!pu.tenant_id) throw new Error("Cliente do portal sem tenant — não dá para isolar o discador");
      await supabase.from("onboarding_users").update({ dialer_enabled: true }).eq("id", portalUserId);
      await createDialerPipeline(supabase, pu.tenant_id);
      const { data: key } = await supabase.rpc("dialer_generate_api_key", { p_tenant: pu.tenant_id, p_label: pu.name || "Cliente" });
      if (initialCredit > 0) await supabase.rpc("dialer_credit_wallet", { p_tenant: pu.tenant_id, p_amount: initialCredit, p_operation: "adjustment", p_desc: "Crédito inicial", p_ref: null });
      if (planPrice != null) await upsertPricing(supabase, pu.tenant_id, planPrice);
      return json({ ok: true, mode, tenantId: pu.tenant_id, apiKey: key, message: "Discador habilitado no portal do cliente." });
    }

    // mode 'new'
    const name: string = (body.name || "").trim();
    const email: string = (body.email || "").trim().toLowerCase();
    if (!name || !email) throw new Error("name e email são obrigatórios");

    // 1) login
    const tempPassword = "Disc-" + crypto.randomUUID().slice(0, 8) + "!";
    const ures = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: tempPassword, email_confirm: true }),
    });
    const udata = await ures.json();
    if (!ures.ok) throw new Error(udata?.msg || udata?.error_description || "Falha ao criar login");
    const newUserId = udata.id;

    // 2) tenant
    const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`;
    const maxUsers = body.maxUsers != null ? Number(body.maxUsers) : null;
    const { data: tenant } = await supabase.from("whitelabel_tenants").insert({ name, slug, status: "active", max_users: maxUsers }).select("id").single();
    const tenantId = tenant.id;

    // 3) funil
    await createDialerPipeline(supabase, tenantId);

    // 4) staff dialer_only + permissão
    const { data: staff } = await supabase.from("onboarding_staff").insert({
      user_id: newUserId, tenant_id: tenantId, role: "closer", name, email, is_active: true, dialer_only: true,
    }).select("id").single();
    await supabase.from("staff_menu_permissions").insert({ staff_id: staff.id, menu_key: "crm" });

    // 5) carteira + api key + preço
    if (initialCredit > 0) await supabase.rpc("dialer_credit_wallet", { p_tenant: tenantId, p_amount: initialCredit, p_operation: "adjustment", p_desc: "Crédito inicial", p_ref: null });
    const { data: key } = await supabase.rpc("dialer_generate_api_key", { p_tenant: tenantId, p_label: name });
    if (planPrice != null) await upsertPricing(supabase, tenantId, planPrice);

    return json({ ok: true, mode, tenantId, login: email, tempPassword, apiKey: key });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }

  async function upsertPricing(supabase: any, tenantId: string, planPrice: number) {
    const { data: ex } = await supabase.from("dialer_pricing").select("id").eq("tenant_id", tenantId).maybeSingle();
    if (ex) await supabase.from("dialer_pricing").update({ plan_price_per_user: planPrice }).eq("tenant_id", tenantId);
    else await supabase.from("dialer_pricing").insert({ tenant_id: tenantId, plan_price_per_user: planPrice });
  }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
