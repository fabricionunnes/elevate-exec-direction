import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  console.log(`[Asaas] ${method} ${path}`);
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": apiKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {};
  }
  if (!res.ok) throw new Error(data.errors?.[0]?.description || data.message || JSON.stringify(data));
  return data;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[asaas-service-purchase] Request received");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const reqBody = await req.json();
    console.log("[asaas-service-purchase] Body keys:", Object.keys(reqBody));

    const {
      project_id,
      service_catalog_id,
      menu_key,
      billing_type,
      amount_cents,
      service_name,
      purchased_by,
    } = reqBody;

    if (!project_id || !service_catalog_id || !menu_key || !amount_cents || !purchased_by) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get project
    console.log("[asaas-service-purchase] Fetching project:", project_id);
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select("company_id, onboarding_company_id")
      .eq("id", project_id)
      .single();

    if (projectError) {
      console.error("[asaas-service-purchase] Project error:", projectError);
      throw new Error("Erro ao buscar projeto");
    }

    const companyId = project?.company_id || project?.onboarding_company_id;
    console.log("[asaas-service-purchase] companyId:", companyId);

    if (!companyId) {
      return new Response(JSON.stringify({ error: "Projeto sem empresa vinculada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company data
    const { data: company, error: companyError } = await supabase
      .from("onboarding_companies")
      .select("id, name, email, document, phone, address, address_number, address_complement, address_neighborhood, address_zipcode")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("[asaas-service-purchase] Company error:", companyError);
      throw new Error("Erro ao buscar empresa");
    }
    console.log("[asaas-service-purchase] Company:", company.name);

    // 2. Get default Asaas account
    const { data: defaultAccount } = await supabase
      .from("asaas_accounts")
      .select("id, api_key_secret_name")
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    let ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    let asaasAccountId: string | null = null;

    if (defaultAccount?.api_key_secret_name) {
      const key = Deno.env.get(defaultAccount.api_key_secret_name);
      if (key) {
        ASAAS_API_KEY = key;
        asaasAccountId = defaultAccount.id;
      }
    }

    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    // 3. Find or create Asaas customer
    let cleanDoc = (company.document || "").replace(/\D/g, "");
    if (cleanDoc.length > 0 && cleanDoc.length <= 11) cleanDoc = cleanDoc.padStart(11, "0");
    else if (cleanDoc.length > 11 && cleanDoc.length <= 14) cleanDoc = cleanDoc.padStart(14, "0");

    const phoneToUse = (company.phone || "").replace(/\D/g, "");
    const customerPayload: Record<string, unknown> = {
      name: company.name || "Cliente",
      email: company.email || `${project_id}@placeholder.com`,
      notificationDisabled: true,
    };
    if (cleanDoc) customerPayload.cpfCnpj = cleanDoc;
    if (phoneToUse) { customerPayload.mobilePhone = phoneToUse; customerPayload.phone = phoneToUse; }
    if (company.address_zipcode) customerPayload.postalCode = (company.address_zipcode as string).replace(/\D/g, "");
    if (company.address) customerPayload.address = company.address;
    if (company.address_number) customerPayload.addressNumber = company.address_number;
    if (company.address_complement) customerPayload.complement = company.address_complement;
    if (company.address_neighborhood) customerPayload.province = company.address_neighborhood;

    let customerId: string | null = null;
    if (cleanDoc) {
      const existing = await asaasRequest(`/customers?cpfCnpj=${cleanDoc}`, "GET", ASAAS_API_KEY);
      if (existing.data?.length > 0) {
        customerId = existing.data[0].id;
        try { await asaasRequest(`/customers/${customerId}`, "PUT", ASAAS_API_KEY, customerPayload); } catch (_e) { /* ignore */ }
      }
    }
    if (!customerId) {
      const newCust = await asaasRequest("/customers", "POST", ASAAS_API_KEY, customerPayload);
      customerId = newCust.id;
    }

    console.log("[asaas-service-purchase] Asaas customer:", customerId);

    const amountValue = amount_cents / 100;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isRecurring = billing_type === "monthly";

    let subscriptionId: string | null = null;
    let invoiceUrl = "";
    let pixQrCode: string | null = null;
    let pixQrCodeUrl: string | null = null;

    if (isRecurring) {
      // Create MONTHLY subscription
      const subPayload = {
        customer: customerId,
        billingType: "BOLETO",
        value: amountValue,
        cycle: "MONTHLY",
        nextDueDate: tomorrow,
        description: `${service_name} - Assinatura mensal`,
        notificationDisabled: true,
        interest: { value: 1, type: "PERCENTAGE" },
        fine: { value: 2, type: "PERCENTAGE" },
        discount: { value: 5, type: "PERCENTAGE", dueDateLimitDays: 1 },
      };
      const subscription = await asaasRequest("/subscriptions", "POST", ASAAS_API_KEY, subPayload);
      subscriptionId = subscription.id;
      console.log("[asaas-service-purchase] Subscription created:", subscriptionId);

      // Get first payment invoice URL
      await new Promise(r => setTimeout(r, 2000));
      try {
        const payments = await asaasRequest(`/subscriptions/${subscriptionId}/payments`, "GET", ASAAS_API_KEY);
        if (payments.data?.length > 0) {
          const first = payments.data[0];
          invoiceUrl = first.invoiceUrl || first.bankSlipUrl || "";
          if (!invoiceUrl && first.id) invoiceUrl = `https://www.asaas.com/i/${first.id}`;
          if (first.id) {
            try {
              const pix = await asaasRequest(`/payments/${first.id}/pixQrCode`, "GET", ASAAS_API_KEY);
              if (pix.payload) { pixQrCode = pix.payload; pixQrCodeUrl = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null; }
            } catch (_e) { /* ignore */ }
          }
        }
      } catch (e) { console.error("[asaas-service-purchase] Error getting sub payments:", e); }
    } else {
      // One-time: create single BOLETO payment
      const payPayload = {
        customer: customerId,
        billingType: "BOLETO",
        value: amountValue,
        dueDate: tomorrow,
        description: `${service_name} - Pagamento único`,
        notificationDisabled: true,
        interest: { value: 1, type: "PERCENTAGE" },
        fine: { value: 2, type: "PERCENTAGE" },
        discount: { value: 5, type: "PERCENTAGE", dueDateLimitDays: 1 },
      };
      const payment = await asaasRequest("/payments", "POST", ASAAS_API_KEY, payPayload);
      console.log("[asaas-service-purchase] One-time payment created:", payment.id);
      invoiceUrl = payment.invoiceUrl || payment.bankSlipUrl || "";
      if (!invoiceUrl && payment.id) invoiceUrl = `https://www.asaas.com/i/${payment.id}`;

      if (payment.id) {
        try {
          const pix = await asaasRequest(`/payments/${payment.id}/pixQrCode`, "GET", ASAAS_API_KEY);
          if (pix.payload) { pixQrCode = pix.payload; pixQrCodeUrl = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null; }
        } catch (_e) { /* ignore */ }
      }

      subscriptionId = payment.id;
    }

    // 4. Create recurring charge record
    const { data: recurringCharge, error: rcError } = await supabase
      .from("company_recurring_charges")
      .insert({
        company_id: companyId,
        description: service_name,
        amount_cents,
        recurrence: "monthly",
        installments: isRecurring ? 12 : 1,
        payment_method: "boleto",
        next_charge_date: tomorrow,
        customer_name: company.name,
        customer_email: company.email,
        customer_document: company.document,
        customer_phone: company.phone,
        pagarme_plan_id: subscriptionId,
        pagarme_link_url: invoiceUrl,
        asaas_account_id: asaasAccountId,
        is_active: true,
        notes: `Compra self-service: ${service_name} (${billing_type})`,
      } as any)
      .select("id")
      .single();

    if (rcError) console.error("[asaas-service-purchase] Recurring charge error:", rcError);

    // 5. Create first invoice
    if (recurringCharge?.id) {
      const { error: invError } = await supabase.from("company_invoices").insert({
        company_id: companyId,
        recurring_charge_id: recurringCharge.id,
        description: service_name,
        amount_cents,
        due_date: tomorrow,
        status: "pending",
        installment_number: 1,
        total_installments: isRecurring ? 12 : 1,
        payment_link_url: invoiceUrl,
      });
      if (invError) console.error("[asaas-service-purchase] Invoice error:", invError);
    }

    // 6. Create permission records (disabled - will be enabled by webhook after payment)
    const keysToEnable = menu_key === "gestao_clientes"
      ? ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"]
      : [menu_key];

    for (const key of keysToEnable) {
      const { data: existing } = await supabase
        .from("project_menu_permissions")
        .select("id")
        .eq("project_id", project_id)
        .eq("menu_key", key)
        .single();

      if (!existing) {
        await supabase.from("project_menu_permissions").insert({
          project_id,
          menu_key: key,
          is_enabled: false,
        });
      }
    }

    // 7. Save purchase record
    const { error: purchaseError } = await supabase.from("service_purchases").insert({
      project_id,
      service_catalog_id,
      menu_key,
      billing_type: billing_type || "monthly",
      amount_cents,
      status: "active",
      recurring_charge_id: recurringCharge?.id || null,
      asaas_subscription_id: subscriptionId,
      purchased_by,
    });
    if (purchaseError) console.error("[asaas-service-purchase] Purchase record error:", purchaseError);

    // 8. Create financial receivable
    const amountReais = amount_cents / 100;
    const { error: frError } = await supabase.from("financial_receivables").insert({
      company_id: companyId,
      description: `Compra self-service: ${service_name}`,
      amount: amountReais,
      due_date: tomorrow,
      status: "open",
      payment_method: "boleto",
      payment_link: invoiceUrl || null,
      is_recurring: isRecurring,
      notes: `Contratação via catálogo de serviços pelo cliente. Menu: ${menu_key}`,
    });
    if (frError) console.error("[asaas-service-purchase] Financial receivable error:", frError);

    // 9. Notify master and admin staff
    const { data: staffToNotify } = await supabase
      .from("onboarding_staff")
      .select("id")
      .in("role", ["master", "admin"])
      .eq("is_active", true);

    if (staffToNotify?.length) {
      const companyName = company.name || "Cliente";
      const notifTitle = `🛒 Nova compra: ${service_name}`;
      const notifMessage = `${companyName} contratou "${service_name}" (${formatPrice(amountReais)}) pelo catálogo de serviços. ${isRecurring ? "Recorrência mensal." : "Pagamento único."}`;

      const notifications = staffToNotify.map((s: any) => ({
        staff_id: s.id,
        project_id,
        type: "service_purchase",
        title: notifTitle,
        message: notifMessage,
        reference_id: service_catalog_id,
        reference_type: "service_catalog",
      }));

      await supabase.from("onboarding_notifications").insert(notifications);
      console.log(`[asaas-service-purchase] Notified ${staffToNotify.length} staff members`);
    }

    console.log("[asaas-service-purchase] Completed:", { menu_key, billing_type, subscriptionId });

    return new Response(JSON.stringify({
      success: true,
      subscription_id: subscriptionId,
      invoice_url: invoiceUrl,
      pix_qr_code: pixQrCode,
      pix_qr_code_url: pixQrCodeUrl,
      recurring_charge_id: recurringCharge?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[asaas-service-purchase] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
