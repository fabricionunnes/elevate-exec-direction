import { createClient } from "@supabase/supabase-js";

const PUBLISHED_URL = "https://elevate-exec-direction.lovable.app";

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
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error(`Asaas non-JSON (${res.status}):`, text.substring(0, 300));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {};
  }
  if (!res.ok) {
    console.error(`Asaas error (${res.status}):`, JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || data.message || JSON.stringify(data));
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    const {
      description,
      amount_cents,
      payment_method,
      recurrence,
      customer_name,
      customer_email,
      customer_document,
      customer_phone,
      company_id,
      recurring_charge_id,
      next_charge_date,
    } = await req.json();

    if (!description || !amount_cents || !recurrence || !customer_name || !customer_email) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Find or create customer
    let cleanDoc = customer_document?.replace(/\D/g, "") || "";
    // Pad CPF to 11 digits or CNPJ to 14 digits
    if (cleanDoc.length > 0 && cleanDoc.length <= 11) {
      cleanDoc = cleanDoc.padStart(11, "0");
    } else if (cleanDoc.length > 11 && cleanDoc.length <= 14) {
      cleanDoc = cleanDoc.padStart(14, "0");
    }
    let customerId: string | null = null;

    // Fetch company address for Asaas customer
    let compAddr: Record<string, string | null> = {};
    if (company_id) {
      const supabaseAddr = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: compData } = await supabaseAddr
        .from("onboarding_companies")
        .select("address, address_number, address_complement, address_neighborhood, address_zipcode, address_city, address_state, phone")
        .eq("id", company_id)
        .single();
      if (compData) compAddr = compData;
    }

    // Build customer payload with address and phone
    const phoneToUse = (customer_phone || compAddr.phone || "").replace(/\D/g, "");
    const customerPayload: Record<string, unknown> = {
      name: customer_name,
      email: customer_email,
      notificationDisabled: true,
    };
    if (cleanDoc) customerPayload.cpfCnpj = cleanDoc;
    if (phoneToUse) {
      customerPayload.mobilePhone = phoneToUse;
      customerPayload.phone = phoneToUse;
    }
    if (compAddr.address_zipcode) customerPayload.postalCode = compAddr.address_zipcode.replace(/\D/g, "");
    if (compAddr.address) customerPayload.address = compAddr.address;
    if (compAddr.address_number) customerPayload.addressNumber = compAddr.address_number;
    if (compAddr.address_complement) customerPayload.complement = compAddr.address_complement;
    if (compAddr.address_neighborhood) customerPayload.province = compAddr.address_neighborhood;

    if (cleanDoc) {
      const existing = await asaasRequest(`/customers?cpfCnpj=${cleanDoc}`, "GET", ASAAS_API_KEY);
      if (existing.data?.length > 0) {
        customerId = existing.data[0].id;
        console.log("Found existing Asaas customer:", customerId, "- updating with address/phone");
        try {
          await asaasRequest(`/customers/${customerId}`, "PUT", ASAAS_API_KEY, customerPayload);
        } catch (e) {
          console.error("Error updating Asaas customer:", e);
        }
      }
    }

    if (!customerId) {
      const newCustomer = await asaasRequest("/customers", "POST", ASAAS_API_KEY, customerPayload);
      customerId = newCustomer.id;
    }

    console.log("Asaas customer:", customerId);

    // Step 2: Map recurrence to Asaas cycle
    let cycle = "MONTHLY";
    if (recurrence === "quarterly") cycle = "QUARTERLY";
    else if (recurrence === "yearly") cycle = "YEARLY";

    // Step 3: Map payment method
    let billingType = "PIX";
    if (payment_method === "credit_card") billingType = "CREDIT_CARD";
    else if (payment_method === "boleto") billingType = "BOLETO";

    // Step 4: Create subscription in Asaas
    const amountValue = amount_cents / 100;
    const nextDueDate = next_charge_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const subscriptionPayload: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: amountValue,
      cycle,
      nextDueDate,
      description,
      notificationDisabled: true,
      interest: { value: 1, type: "PERCENTAGE" },
      fine: { value: 2, type: "PERCENTAGE" },
      discount: { value: 5, type: "PERCENTAGE", dueDateLimitDays: 1 },
    };

    const subscription = await asaasRequest("/subscriptions", "POST", ASAAS_API_KEY, subscriptionPayload);
    console.log("Asaas subscription created:", subscription.id);

    // Step 5: Get the invoice URL from the first Asaas payment
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let invoiceUrl = "";
    try {
      const payments = await asaasRequest(`/subscriptions/${subscription.id}/payments`, "GET", ASAAS_API_KEY);
      if (payments.data?.length > 0) {
        invoiceUrl = payments.data[0].invoiceUrl || "";
      }
    } catch (e) {
      console.error("Error getting subscription payments:", e);
    }

    console.log("Asaas invoiceUrl:", invoiceUrl);

    // Step 6: Update the recurring charge record
    if (recurring_charge_id) {
      await supabase
        .from("company_recurring_charges")
        .update({
          pagarme_plan_id: subscription.id,
          pagarme_link_url: invoiceUrl,
        } as any)
        .eq("id", recurring_charge_id);
    }

    // Step 7: Send WhatsApp notification with invoice URL
    if (invoiceUrl) {
      try {
        // Use customer_phone from request, fallback to company phone
        let phoneToSend = (customer_phone || "").replace(/\D/g, "");

        if (!phoneToSend && recurring_charge_id) {
          const { data: chargeData } = await supabase
            .from("company_recurring_charges")
            .select("customer_phone, company_id")
            .eq("id", recurring_charge_id)
            .single();

          if (chargeData?.customer_phone) {
            phoneToSend = chargeData.customer_phone.replace(/\D/g, "");
          } else if (chargeData?.company_id) {
            const { data: companyData } = await supabase
              .from("onboarding_companies")
              .select("phone")
              .eq("id", chargeData.company_id)
              .single();
            if (companyData?.phone) {
              phoneToSend = companyData.phone.replace(/\D/g, "");
            }
          }
        }

        if (!phoneToSend && company_id) {
          const { data: companyData } = await supabase
            .from("onboarding_companies")
            .select("phone")
            .eq("id", company_id)
            .single();
          if (companyData?.phone) {
            phoneToSend = companyData.phone.replace(/\D/g, "");
          }
        }

        if (phoneToSend) {
          const formattedPhone = phoneToSend.startsWith("55") ? phoneToSend : `55${phoneToSend}`;
          
          // Get WhatsApp instance (prefer default, fallback to any connected)
          const { data: whatsappInstance } = await supabase
            .from("whatsapp_instances")
            .select("api_url, api_key, instance_name, is_default")
            .eq("status", "connected")
            .order("is_default", { ascending: false, nullsFirst: false })
            .limit(1)
            .single();

          if (whatsappInstance?.api_url && whatsappInstance?.api_key) {
            const amountFormatted = (amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const message = `Olá ${customer_name || ""}! 👋\n\nSua cobrança recorrente foi criada com sucesso:\n\n📄 *${description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Recorrência:* ${recurrence === "monthly" ? "Mensal" : recurrence === "quarterly" ? "Trimestral" : "Anual"}\n\nAcesse o link abaixo para realizar o pagamento:\n\n🔗 ${invoiceUrl}\n\nObrigado! ✨`;

            const sendResponse = await fetch(`${whatsappInstance.api_url}/message/sendText/${whatsappInstance.instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: whatsappInstance.api_key,
              },
              body: JSON.stringify({
                number: formattedPhone,
                text: message,
              }),
            });

            if (sendResponse.ok) {
              console.log("WhatsApp notification sent successfully");
            } else {
              console.error("WhatsApp send failed:", await sendResponse.text());
            }
          } else {
            console.log("No default WhatsApp instance found, skipping notification");
          }
        } else {
          console.log("No customer phone found, skipping WhatsApp notification");
        }
      } catch (whatsappError) {
        console.error("Error sending WhatsApp notification:", whatsappError);
        // Don't fail the entire request if WhatsApp fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        invoice_url: invoiceUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Asaas subscription error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
