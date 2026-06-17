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

async function ensureCustomer(supabase: any, apiKey: string, tenantId: string, name: string, cpfCnpj?: string, email?: string): Promise<string> {
  const { data: tenant } = await supabase.from("whitelabel_tenants").select("asaas_customer_id").eq("id", tenantId).maybeSingle();
  if (tenant?.asaas_customer_id) return tenant.asaas_customer_id;
  const doc = (cpfCnpj || "").replace(/\D/g, "");
  if (!doc) throw new Error("Informe o CPF/CNPJ do cliente para gerar a cobrança.");
  const found = await asaasReq(`/customers?cpfCnpj=${doc}`, "GET", apiKey);
  const customerId = found?.data?.length ? found.data[0].id : (await asaasReq("/customers", "POST", apiKey, { name, cpfCnpj: doc, email: email || undefined })).id;
  await supabase.from("whitelabel_tenants").update({ asaas_customer_id: customerId }).eq("id", tenantId);
  return customerId;
}

async function makeReceivable(supabase: any, tenantId: string, description: string, amount: number, dueDate: string, paymentId: string, invoiceUrl: string | null) {
  await supabase.from("financial_receivables").insert({
    description, amount, due_date: dueDate, status: "pending",
    payment_method: "pix", payment_link: invoiceUrl, asaas_payment_id: paymentId, tenant_id: tenantId,
  });
}

// Cobrança única (ex: setup/implementação). Vence em N dias. Ativa ao pagar.
async function createOneTime(supabase: any, apiKey: string, customerId: string, tenantId: string, name: string, value: number, dueDays: number, label: string) {
  const due = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10);
  const pay = await asaasReq("/payments", "POST", apiKey, {
    customer: customerId, billingType: "PIX", value, dueDate: due,
    description: `Discador — ${label} — ${name}`, externalReference: `dialer_activation:${tenantId}`,
  });
  let pixPayload: string | null = null;
  try { const pix = await asaasReq(`/payments/${pay.id}/pixQrCode`, "GET", apiKey); pixPayload = pix.payload || null; } catch (_e) { /* ok */ }
  const invoiceUrl = pay.invoiceUrl || (pay.id ? `https://www.asaas.com/i/${pay.id}` : null);
  await makeReceivable(supabase, tenantId, `Discador — ${label} — ${name}`, value, due, pay.id, invoiceUrl);
  return { invoiceUrl, pixPayload, paymentId: pay.id };
}

// Mensalidade recorrente (Asaas subscription) — 1ª parcela vence em 30 dias, e repete todo mês.
async function createSubscription(supabase: any, apiKey: string, customerId: string, tenantId: string, name: string, value: number) {
  const next = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const sub = await asaasReq("/subscriptions", "POST", apiKey, {
    customer: customerId, billingType: "PIX", value, nextDueDate: next, cycle: "MONTHLY",
    description: `Discador — mensalidade — ${name}`, externalReference: `dialer_activation:${tenantId}`,
  });
  await supabase.from("whitelabel_tenants").update({ asaas_subscription_id: sub.id }).eq("id", tenantId);
  let invoiceUrl: string | null = null, pixPayload: string | null = null, firstId: string | null = null;
  try {
    const pays = await asaasReq(`/subscriptions/${sub.id}/payments`, "GET", apiKey);
    const first = pays?.data?.[0];
    if (first) {
      firstId = first.id; invoiceUrl = first.invoiceUrl || `https://www.asaas.com/i/${first.id}`;
      try { const pix = await asaasReq(`/payments/${first.id}/pixQrCode`, "GET", apiKey); pixPayload = pix.payload || null; } catch (_e) { /* ok */ }
      await makeReceivable(supabase, tenantId, `Discador — mensalidade — ${name}`, value, next, first.id, invoiceUrl);
    }
  } catch (_e) { /* ok */ }
  return { subscriptionId: sub.id, invoiceUrl, pixPayload, paymentId: firstId };
}

// Aplica a cobrança: liberar grátis (ativa direto) OU gerar setup + mensalidade (cliente pendente).
async function applyBilling(supabase: any, opts: { tenantId: string; name: string; email?: string; cpfCnpj?: string; planPrice?: number | null; maxUsers?: number | null; setupFee?: number | null; freeRelease?: boolean }) {
  const qty = opts.maxUsers && opts.maxUsers > 0 ? opts.maxUsers : 1;
  const monthly = (opts.planPrice ?? 997) * qty;
  const setupFee = opts.setupFee != null ? Number(opts.setupFee) : 0;
  if (opts.freeRelease) {
    await supabase.from("whitelabel_tenants").update({ status: "active" }).eq("id", opts.tenantId);
    return { freeRelease: true, monthlyAmount: monthly };
  }
  if (monthly <= 0 && setupFee <= 0) return { monthlyAmount: 0 };
  const apiKey = await resolveAsaasKey(supabase);
  const customerId = await ensureCustomer(supabase, apiKey, opts.tenantId, opts.name, opts.cpfCnpj, opts.email);
  let setupCharge: any = null, subCharge: any = null;
  if (setupFee > 0) setupCharge = await createOneTime(supabase, apiKey, customerId, opts.tenantId, opts.name, setupFee, 5, "implementação");
  if (monthly > 0) subCharge = await createSubscription(supabase, apiKey, customerId, opts.tenantId, opts.name, monthly);
  await supabase.from("whitelabel_tenants").update({ status: "pending" }).eq("id", opts.tenantId);
  return {
    monthlyAmount: monthly, setupAmount: setupFee,
    setupLink: setupCharge?.invoiceUrl, setupPix: setupCharge?.pixPayload,
    invoiceUrl: subCharge?.invoiceUrl, pixPayload: subCharge?.pixPayload,
  };
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
    const mode = ["existing_portal", "existing_company"].includes(body.mode) ? body.mode : "new";
    const planPrice = body.planPricePerUser != null ? Number(body.planPricePerUser) : null;
    const initialCredit = body.initialCredit != null ? Number(body.initialCredit) : 0;

    if (mode === "existing_company") {
      const companyId: string = body.companyId;
      const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];
      if (!companyId) throw new Error("companyId é obrigatório");
      const { data: company } = await supabase.from("onboarding_companies").select("id, name, tenant_id, cnpj").eq("id", companyId).maybeSingle();
      if (!company) throw new Error("Empresa não encontrada");

      // garante um tenant do discador pra empresa (sem mexer no acesso atual dela)
      let tenantId = company.tenant_id;
      if (!tenantId) {
        const slug = `${slugify(company.name)}-${crypto.randomUUID().slice(0, 6)}`;
        const { data: t } = await supabase.from("whitelabel_tenants").insert({ name: company.name, slug, status: "active" }).select("id").single();
        tenantId = t.id;
        await supabase.from("onboarding_companies").update({ tenant_id: tenantId }).eq("id", companyId);
      }
      await createDialerPipeline(supabase, tenantId);

      // libera o discador nos usuários escolhidos (dialer_tenant_id separado do tenant do portal)
      for (const uid2 of userIds) {
        await supabase.from("onboarding_users").update({ dialer_enabled: true, dialer_tenant_id: tenantId }).eq("id", uid2);
      }

      const { data: key } = await supabase.rpc("dialer_generate_api_key", { p_tenant: tenantId, p_label: company.name });
      if (initialCredit > 0) await supabase.rpc("dialer_credit_wallet", { p_tenant: tenantId, p_amount: initialCredit, p_operation: "adjustment", p_desc: "Crédito inicial", p_ref: null });
      if (planPrice != null) await upsertPricing(supabase, tenantId, planPrice);
      const billing = await applyBilling(supabase, { tenantId, name: company.name, email: body.email, cpfCnpj: body.cpfCnpj || company.cnpj, planPrice, maxUsers: body.maxUsers, setupFee: body.setupFee, freeRelease: body.freeRelease === true });
      return json({ ok: true, mode, tenantId, apiKey: key, usersEnabled: userIds.length, ...billing, message: billing.freeRelease ? `Discador liberado para ${userIds.length} usuário(s) (grátis).` : `Discador liberado para ${userIds.length} usuário(s). Pague para ativar.` });
    }

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
      const billing = await applyBilling(supabase, { tenantId: pu.tenant_id, name: pu.name || "Cliente", email: body.email, cpfCnpj: body.cpfCnpj, planPrice, maxUsers: body.maxUsers, setupFee: body.setupFee, freeRelease: body.freeRelease === true });
      return json({ ok: true, mode, tenantId: pu.tenant_id, apiKey: key, ...billing, message: billing.freeRelease ? "Discador habilitado (grátis)." : "Discador habilitado. Pague para liberar." });
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
    const billing = await applyBilling(supabase, { tenantId, name, email, cpfCnpj: body.cpfCnpj, planPrice, maxUsers, setupFee: body.setupFee, freeRelease: body.freeRelease === true });

    return json({ ok: true, mode, tenantId, login: email, tempPassword, apiKey: key, ...billing });
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
