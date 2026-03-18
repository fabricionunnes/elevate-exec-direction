import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  console.log(`Asaas ${method} ${path}`);
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": apiKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {};
  }
  if (!res.ok) throw new Error(data.errors?.[0]?.description || data.message || JSON.stringify(data));
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      project_id,
      service_catalog_id,
      menu_key,
      billing_type,
      amount_cents,
      service_name,
      purchased_by, // onboarding_user id
    } = await req.json();

    if (!project_id || !service_catalog_id || !menu_key || !amount_cents || !purchased_by) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get company data from project
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("company_id, onboarding_companies(id, name, email, document, phone, address, address_number, address_complement, address_neighborhood, address_zipcode)")
      .eq("id", project_id)
      .single();

    if (!project?.company_id) {
      return new Response(JSON.stringify({ error: "Projeto sem empresa vinculada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company = project.onboarding_companies as any;

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
    if (company.address_zipcode) customerPayload.postalCode = company.address_zipcode.replace(/\D/g, "");
    if (company.address) customerPayload.address = company.address;
    if (company.address_number) customerPayload.addressNumber = company.address_number;
    if (company.address_complement) customerPayload.complement = company.address_complement;
    if (company.address_neighborhood) customerPayload.province = company.address_neighborhood;

    let customerId: string | null = null;
    if (cleanDoc) {
      const existing = await asaasRequest(`/customers?cpfCnpj=${cleanDoc}`, "GET", ASAAS_API_KEY);
      if (existing.data?.length > 0) {
        customerId = existing.data[0].id;
        try { await asaasRequest(`/customers/${customerId}`, "PUT", ASAAS_API_KEY, customerPayload); } catch {}
      }
    }
    if (!customerId) {
      const newCust = await asaasRequest("/customers", "POST", ASAAS_API_KEY, customerPayload);
      customerId = newCust.id;
    }

    console.log("Asaas customer:", customerId);

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
      console.log("Subscription created:", subscriptionId);

      // Get first payment invoice URL
      await new Promise(r => setTimeout(r, 2000));
      try {
        const payments = await asaasRequest(`/subscriptions/${subscriptionId}/payments`, "GET", ASAAS_API_KEY);
        if (payments.data?.length > 0) {
          const first = payments.data[0];
          invoiceUrl = first.invoiceUrl || first.bankSlipUrl || "";
          if (!invoiceUrl && first.id) invoiceUrl = `https://www.asaas.com/i/${first.id}`;
          // Also try to get PIX
          if (first.id) {
            try {
              const pix = await asaasRequest(`/payments/${first.id}/pixQrCode`, "GET", ASAAS_API_KEY);
              if (pix.payload) { pixQrCode = pix.payload; pixQrCodeUrl = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null; }
            } catch {}
          }
        }
      } catch (e) { console.error("Error getting sub payments:", e); }
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
      console.log("One-time payment created:", payment.id);
      invoiceUrl = payment.invoiceUrl || payment.bankSlipUrl || "";
      if (!invoiceUrl && payment.id) invoiceUrl = `https://www.asaas.com/i/${payment.id}`;

      // Try to get PIX
      if (payment.id) {
        try {
          const pix = await asaasRequest(`/payments/${payment.id}/pixQrCode`, "GET", ASAAS_API_KEY);
          if (pix.payload) { pixQrCode = pix.payload; pixQrCodeUrl = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null; }
        } catch {}
      }

      // Store the payment ID as subscription ID for webhook matching
      subscriptionId = payment.id;
    }

    // 4. Create recurring charge record
    const { data: recurringCharge } = await supabase
      .from("company_recurring_charges")
      .insert({
        company_id: project.company_id,
        description: service_name,
        amount_cents,
        recurrence: isRecurring ? "monthly" : "monthly",
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

    // 5. Create first invoice
    if (recurringCharge?.id) {
      await supabase.from("company_invoices").insert({
        company_id: project.company_id,
        recurring_charge_id: recurringCharge.id,
        description: service_name,
        amount_cents,
        due_date: tomorrow,
        status: "pending",
        installment_number: 1,
        total_installments: isRecurring ? 12 : 1,
        payment_link_url: invoiceUrl,
      });
    }

    // 6. Enable permission in project_menu_permissions
    // For gestao_clientes, enable all related keys
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

      if (existing) {
        await supabase
          .from("project_menu_permissions")
          .update({ is_enabled: true })
          .eq("id", existing.id);
      } else {
        await supabase.from("project_menu_permissions").insert({
          project_id,
          menu_key: key,
          is_enabled: true,
        });
      }
    }

    // 7. Save purchase record
    await supabase.from("service_purchases").insert({
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

    console.log("Service purchase completed:", { menu_key, billing_type, subscriptionId });

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
  } catch (error) {
    console.error("Service purchase error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
