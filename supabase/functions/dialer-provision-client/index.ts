// dialer-provision-client: cadastra um cliente do discador. Só staff UNV.
// mode 'new' = cria login + tenant + funil + carteira + api key (login dedicado, dialer_only).
// mode 'existing_portal' = habilita o discador num cliente do portal já existente (mesmo login).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

function slugify(s: string): string {
  return (s || "cliente").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

async function asaasReq(path: string, method: string, key: string, body?: unknown) {
  const r = await fetch(`${ASAAS_BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", access_token: key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.errors?.[0]?.description || `Asaas ${r.status}`);
  return d;
}

async function resolveAsaasKey(supabase: any): Promise<string> {
  let apiKey = Deno.env.get("ASAAS_API_KEY") || "";
  const { data: acc } = await supabase.from("asaas_accounts").select("api_key_secret_name").eq("is_default", true).eq("is_active", true).maybeSingle();
  if (acc?.api_key_secret_name) { const s = Deno.env.get(acc.api_key_secret_name); if (s) apiKey = s; }
  return apiKey;
}

// Gera a cobrança da assinatura (Asaas PIX) + a conta a receber. O webhook libera e dá baixa ao pagar.
async function createPlanCharge(supabase: any, apiKey: string, opts: { tenantId: string; tenantName: string; amount: number; email?: string; cpfCnpj?: string }) {
  // cliente Asaas
  const { data: tenant } = await supabase.from("whitelabel_tenants").select("asaas_customer_id").eq("id", opts.tenantId).maybeSingle();
  let customerId: string | null = tenant?.asaas_customer_id || null;
  if (!customerId) {
    const doc = (opts.cpfCnpj || "").replace(/\D/g, "");
    if (!doc) throw new Error("Informe o CPF/CNPJ do cliente para gerar a cobrança.");
    const found = await asaasReq(`/customers?cpfCnpj=${doc}`, "GET", apiKey);
    customerId = found?.data?.length ? found.data[0].id : (await asaasReq("/customers", "POST", apiKey, { name: opts.tenantName, cpfCnpj: doc, email: opts.email || undefined })).id;
    await supabase.from("whitelabel_tenants").update({ asaas_customer_id: customerId }).eq("id", opts.tenantId);
  }
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const pay = await asaasReq("/payments", "POST", apiKey, {
    customer: customerId, billingType: "PIX", value: opts.amount, dueDate: due,
    description: `Discador — assinatura — ${opts.tenantName}`,
    externalReference: `dialer_activation:${opts.tenantId}`,
  });
  let pixPayload: string | null = null;
  try { const pix = await asaasReq(`/payments/${pay.id}/pixQrCode`, "GET", apiKey); pixPayload = pix.payload || null; } catch (_e) { /* ok */ }
  const invoiceUrl = pay.invoiceUrl || (pay.id ? `https://www.asaas.com/i/${pay.id}` : null);

  // conta a receber (menu financeiro) — baixa automática pelo webhook via asaas_payment_id
  await supabase.from("financial_receivables").insert({
    description: `Discador — assinatura — ${opts.tenantName}`,
    amount: opts.amount, due_date: due, status: "pending",
    payment_method: "pix", payment_link: invoiceUrl, asaas_payment_id: pay.id, tenant_id: opts.tenantId,
  });

  return { invoiceUrl, pixPayload, asaasPaymentId: pay.id };
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

      let charge: any = null;
      const planAmount = (planPrice ?? 997) * 1;
      if (planAmount > 0 && body.generateCharge !== false) {
        const apiKey = await resolveAsaasKey(supabase);
        charge = await createPlanCharge(supabase, apiKey, { tenantId: pu.tenant_id, tenantName: pu.name || "Cliente", amount: planAmount, email: body.email, cpfCnpj: body.cpfCnpj });
        await supabase.from("whitelabel_tenants").update({ status: "pending" }).eq("id", pu.tenant_id);
      }
      return json({ ok: true, mode, tenantId: pu.tenant_id, apiKey: key, amount: planAmount, invoiceUrl: charge?.invoiceUrl, pixPayload: charge?.pixPayload, message: "Discador habilitado. Pague a assinatura para liberar." });
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

    // Cobrança da assinatura + conta a receber. Cliente fica "pendente" até pagar.
    let charge: any = null;
    const qty = maxUsers && maxUsers > 0 ? maxUsers : 1;
    const planAmount = (planPrice ?? 997) * qty;
    if (planAmount > 0 && body.generateCharge !== false) {
      const apiKey = await resolveAsaasKey(supabase);
      charge = await createPlanCharge(supabase, apiKey, { tenantId, tenantName: name, amount: planAmount, email, cpfCnpj: body.cpfCnpj });
      await supabase.from("whitelabel_tenants").update({ status: "pending" }).eq("id", tenantId);
    }

    return json({ ok: true, mode, tenantId, login: email, tempPassword, apiKey: key, amount: planAmount, invoiceUrl: charge?.invoiceUrl, pixPayload: charge?.pixPayload });
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
