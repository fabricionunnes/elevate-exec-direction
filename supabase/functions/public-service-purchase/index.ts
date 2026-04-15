import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": apiKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch (_e) {
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

    const body = await req.json();
    const { service_catalog_id, buyer_name, buyer_email, buyer_phone, buyer_document } = body;

    if (!service_catalog_id || !buyer_name || !buyer_email) {
      return new Response(JSON.stringify({ error: "Nome, email e serviço são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get service from catalog
    const { data: service, error: serviceError } = await supabase
      .from("service_catalog")
      .select("*")
      .eq("id", service_catalog_id)
      .eq("is_active", true)
      .single();

    if (serviceError || !service) {
      return new Response(JSON.stringify({ error: "Serviço não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get default Asaas account (UNV)
    const { data: asaasAccounts } = await supabase
      .from("asaas_accounts")
      .select("id, name, api_key_secret_name, is_default")
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    const selectedAccount = asaasAccounts?.find((a: any) => a.is_default) ?? asaasAccounts?.[0];
    const ASAAS_API_KEY = selectedAccount?.api_key_secret_name
      ? Deno.env.get(selectedAccount.api_key_secret_name)
      : Deno.env.get("ASAAS_API_KEY");

    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    // 3. Find or create Asaas customer
    let cleanDoc = (buyer_document || "").replace(/\D/g, "");
    if (cleanDoc.length > 0 && cleanDoc.length <= 11) cleanDoc = cleanDoc.padStart(11, "0");
    else if (cleanDoc.length > 11 && cleanDoc.length <= 14) cleanDoc = cleanDoc.padStart(14, "0");

    const phoneClean = (buyer_phone || "").replace(/\D/g, "");
    const customerPayload: Record<string, unknown> = {
      name: buyer_name,
      email: buyer_email,
      notificationDisabled: true,
    };
    if (cleanDoc) customerPayload.cpfCnpj = cleanDoc;
    if (phoneClean) { customerPayload.mobilePhone = phoneClean; customerPayload.phone = phoneClean; }

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

    const amountCents = service.price * 100;
    const amountValue = service.price;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isRecurring = service.billing_type === "monthly";

    let subscriptionId: string | null = null;
    let invoiceUrl = "";
    let pixQrCode: string | null = null;
    let pixQrCodeUrl: string | null = null;

    if (isRecurring) {
      const subPayload = {
        customer: customerId,
        billingType: "BOLETO",
        value: amountValue,
        cycle: "MONTHLY",
        nextDueDate: tomorrow,
        description: `${service.name} - Assinatura mensal`,
        notificationDisabled: true,
        interest: { value: 1, type: "PERCENTAGE" },
        fine: { value: 2, type: "PERCENTAGE" },
        discount: { value: 5, type: "PERCENTAGE", dueDateLimitDays: 1 },
      };
      const subscription = await asaasRequest("/subscriptions", "POST", ASAAS_API_KEY, subPayload);
      subscriptionId = subscription.id;

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
      } catch (_e) { /* ignore */ }
    } else {
      const payPayload = {
        customer: customerId,
        billingType: "BOLETO",
        value: amountValue,
        dueDate: tomorrow,
        description: `${service.name} - Pagamento único`,
        notificationDisabled: true,
        interest: { value: 1, type: "PERCENTAGE" },
        fine: { value: 2, type: "PERCENTAGE" },
        discount: { value: 5, type: "PERCENTAGE", dueDateLimitDays: 1 },
      };
      const payment = await asaasRequest("/payments", "POST", ASAAS_API_KEY, payPayload);
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

    // 4. Check if buyer already has a company/project
    let companyId: string | null = null;
    let projectId: string | null = null;

    if (cleanDoc) {
      const { data: existingCompany } = await supabase
        .from("onboarding_companies")
        .select("id")
        .eq("cnpj", buyer_document)
        .maybeSingle();
      if (existingCompany) companyId = existingCompany.id;
    }

    if (!companyId) {
      const { data: existingByEmail } = await supabase
        .from("onboarding_companies")
        .select("id")
        .eq("email", buyer_email)
        .maybeSingle();
      if (existingByEmail) companyId = existingByEmail.id;
    }

    if (companyId) {
      const { data: existingProject } = await supabase
        .from("onboarding_projects")
        .select("id")
        .or(`company_id.eq.${companyId},onboarding_company_id.eq.${companyId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingProject) projectId = existingProject.id;
    }

    // 5. Save public purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from("public_service_purchases")
      .insert({
        service_catalog_id,
        menu_key: service.menu_key,
        buyer_name,
        buyer_email,
        buyer_phone: buyer_phone || null,
        buyer_document: buyer_document || null,
        amount_cents: Math.round(amountCents),
        billing_type: service.billing_type,
        status: "pending_payment",
        asaas_customer_id: customerId,
        asaas_payment_id: isRecurring ? null : subscriptionId,
        asaas_subscription_id: isRecurring ? subscriptionId : null,
        invoice_url: invoiceUrl,
        pix_qr_code: pixQrCode,
        pix_qr_code_url: pixQrCodeUrl,
        company_id: companyId,
        project_id: projectId,
      })
      .select("id")
      .single();

    if (purchaseError) {
      console.error("[public-service-purchase] Purchase record error:", purchaseError);
    }

    // 6. If company/project exists, also create records in existing system
    if (companyId && projectId) {
      // Create recurring charge
      const { data: rc } = await supabase
        .from("company_recurring_charges")
        .insert({
          company_id: companyId,
          description: service.name,
          amount_cents: Math.round(amountCents),
          recurrence: isRecurring ? "monthly" : "unique",
          installments: isRecurring ? 12 : 1,
          payment_method: "boleto",
          next_charge_date: tomorrow,
          customer_name: buyer_name,
          customer_email: buyer_email,
          customer_document: buyer_document,
          customer_phone: buyer_phone,
          pagarme_plan_id: subscriptionId,
          pagarme_link_url: invoiceUrl,
          asaas_account_id: selectedAccount?.id ?? null,
          is_active: true,
          notes: `Compra pública: ${service.name} (${service.billing_type})`,
        } as any)
        .select("id")
        .single();

      if (rc?.id) {
        await supabase.from("company_invoices").insert({
          company_id: companyId,
          recurring_charge_id: rc.id,
          description: service.name,
          amount_cents: Math.round(amountCents),
          due_date: tomorrow,
          status: "pending",
          payment_method: "boleto",
          installment_number: 1,
          total_installments: isRecurring ? 12 : 1,
          payment_link_url: invoiceUrl || null,
          notes: `Compra pública: ${service.name}`,
        } as any);
      }

      // Create permission records (disabled until payment)
      const keysToEnable = service.menu_key === "gestao_clientes"
        ? ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"]
        : [service.menu_key];

      for (const key of keysToEnable) {
        const { data: existing } = await supabase
          .from("project_menu_permissions")
          .select("id")
          .eq("project_id", projectId)
          .eq("menu_key", key)
          .maybeSingle();
        if (!existing) {
          await supabase.from("project_menu_permissions").insert({
            project_id: projectId,
            menu_key: key,
            is_enabled: false,
          });
        }
      }

      // Save in service_purchases too
      await supabase.from("service_purchases").upsert({
        project_id: projectId,
        service_catalog_id,
        menu_key: service.menu_key,
        billing_type: service.billing_type || "monthly",
        amount_cents: Math.round(amountCents),
        status: "pending_payment",
        recurring_charge_id: rc?.id || null,
        asaas_subscription_id: subscriptionId,
        purchased_by: null,
      }, { onConflict: "project_id,menu_key" } as any);
    }

    // 7. Notify master/admin staff
    const { data: staffToNotify } = await supabase
      .from("onboarding_staff")
      .select("id")
      .in("role", ["master", "admin"])
      .eq("is_active", true);

    if (staffToNotify?.length) {
      const formatPrice = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
      const notifTitle = `🛒 Nova compra pública: ${service.name}`;
      const notifMessage = `${buyer_name} (${buyer_email}) comprou "${service.name}" (${formatPrice(amountValue)}) pela página de vendas. ${companyId ? "Cliente existente." : "Novo comprador - cadastrar no sistema."}`;

      const notifications = staffToNotify.map((s: any) => ({
        staff_id: s.id,
        type: "service_purchase",
        title: notifTitle,
        message: notifMessage,
        reference_id: purchase?.id || service_catalog_id,
        reference_type: "public_service_purchase",
      }));

      await supabase.from("onboarding_notifications").insert(notifications);
    }

    return new Response(JSON.stringify({
      success: true,
      purchase_id: purchase?.id,
      invoice_url: invoiceUrl,
      pix_qr_code: pixQrCode,
      pix_qr_code_url: pixQrCodeUrl,
      is_existing_client: !!companyId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[public-service-purchase] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
