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
  try { data = text ? JSON.parse(text) : {}; } catch { return {}; }
  if (!res.ok) {
    console.error(`Asaas error (${res.status}):`, text.substring(0, 300));
    throw new Error(data.errors?.[0]?.description || `HTTP ${res.status}`);
  }
  return data;
}

/**
 * Resolve the correct Asaas API key for a recurring charge.
 * If the charge has an asaas_account_id, look up the secret name and get the key.
 * Otherwise, fall back to the default ASAAS_API_KEY.
 */
async function resolveAsaasApiKey(
  supabase: ReturnType<typeof createClient>,
  recurringChargeId?: string,
  fallbackKey?: string | null
): Promise<string | null> {
  if (recurringChargeId) {
    const { data: charge } = await supabase
      .from("company_recurring_charges")
      .select("asaas_account_id")
      .eq("id", recurringChargeId)
      .single();

    if (charge?.asaas_account_id) {
      const { data: account } = await supabase
        .from("asaas_accounts")
        .select("api_key_secret_name")
        .eq("id", charge.asaas_account_id)
        .single();

      if (account?.api_key_secret_name) {
        const key = Deno.env.get(account.api_key_secret_name);
        if (key) {
          console.log(`[resolveAsaasApiKey] Using account: ${account.api_key_secret_name}`);
          return key;
        }
      }
    }
  }
  return fallbackKey || null;
}

/**
 * For a given invoice, try to find the Asaas payment invoiceUrl via the subscription.
 * If found, use that URL. Otherwise, fall back to a direct Asaas charge creation.
 */
async function getOrCreateAsaasPaymentUrl(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  invoice: {
    id: string;
    description: string;
    amount_cents: number;
    company_id: string;
    payment_method?: string;
    due_date: string;
    recurring_charge_id?: string;
  }
): Promise<string> {
  // Try to get subscription ID from recurring charge
  if (invoice.recurring_charge_id) {
    const { data: charge } = await supabase
      .from("company_recurring_charges")
      .select("pagarme_plan_id, customer_document, customer_name, customer_email")
      .eq("id", invoice.recurring_charge_id)
      .single();

    if (charge?.pagarme_plan_id) {
      // Fetch ALL payments from the subscription (paginated if needed)
      try {
        let allPayments: any[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const payments = await asaasRequest(
            `/subscriptions/${charge.pagarme_plan_id}/payments?offset=${offset}&limit=${limit}`,
            "GET",
            apiKey
          );
          if (payments.data?.length > 0) {
            allPayments = allPayments.concat(payments.data);
            offset += limit;
            hasMore = payments.data.length === limit;
          } else {
            hasMore = false;
          }
        }

        if (allPayments.length > 0) {
          // Find payment matching this invoice's due date exactly
          const matching = allPayments.find((p: any) => p.dueDate === invoice.due_date);
          if (matching?.invoiceUrl) {
            console.log(`[getOrCreateAsaasPaymentUrl] Found matching payment for ${invoice.due_date}: ${matching.invoiceUrl}`);
            return matching.invoiceUrl;
          }

          console.log(`[getOrCreateAsaasPaymentUrl] No exact match for ${invoice.due_date} among ${allPayments.length} payments`);
        }
      } catch (e) {
        console.error("Error fetching subscription payments:", e);
      }

      // If subscription exists but no matching payment found, create a standalone charge
      try {
        const sub = await asaasRequest(`/subscriptions/${charge.pagarme_plan_id}`, "GET", apiKey);
        if (sub?.customer) {
          let billingType = "PIX";
          if (invoice.payment_method === "credit_card") billingType = "CREDIT_CARD";
          else if (invoice.payment_method === "boleto") billingType = "BOLETO";

          const payment = await asaasRequest("/payments", "POST", apiKey, {
            customer: sub.customer,
            billingType,
            value: invoice.amount_cents / 100,
            dueDate: invoice.due_date,
            description: invoice.description,
            notificationDisabled: true,
            interest: { value: 1, type: "PERCENTAGE" },
            fine: { value: 2, type: "PERCENTAGE" },
            discount: { value: 5, type: "PERCENTAGE", dueDateLimitDays: 1 },
          });
          if (payment?.invoiceUrl) {
            return payment.invoiceUrl;
          }
        }
      } catch (e) {
        console.error("Error creating standalone Asaas payment:", e);
      }
    }
  }

  return "";
}

/**
 * Sends a WhatsApp notification for an invoice with payment link.
 */
async function sendWhatsAppInvoiceNotification(
  supabase: ReturnType<typeof createClient>,
  invoice: {
    description: string;
    amount_cents: number;
    due_date: string;
    installment_number?: number;
    total_installments?: number;
  },
  paymentUrl: string,
  customerPhone: string,
  customerName: string
) {
  if (!paymentUrl || !customerPhone) return;

  try {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) return;

    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Get WhatsApp instance (prefer default, fallback to any connected)
    const { data: whatsappInstance } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_key, instance_name, is_default")
      .eq("status", "connected")
      .eq("instance_name", "financeirounv")
      .single();

    if (!whatsappInstance?.api_url || !whatsappInstance?.api_key) {
      console.log("No default WhatsApp instance found, skipping notification");
      return;
    }

    const amountFormatted = (invoice.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dueDateFormatted = invoice.due_date.split("-").reverse().join("/");
    const installmentInfo = "";

    // Calculate discount date (1 day before due date) and discounted amount (5%)
    // If discount date is today or in the past, do NOT show the discount line
    const dueDateObj = new Date(invoice.due_date + "T12:00:00");
    const discountDateObj = new Date(dueDateObj);
    discountDateObj.setDate(discountDateObj.getDate() - 1);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const showDiscount = discountDateObj.getTime() >= today.getTime();
    const discountDateFormatted = `${String(discountDateObj.getDate()).padStart(2, "0")}/${String(discountDateObj.getMonth() + 1).padStart(2, "0")}/${discountDateObj.getFullYear()}`;
    const discountedAmount = (invoice.amount_cents * 0.95 / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const discountLine = showDiscount ? `\n\n🏷️ *Desconto de 5%* pagando até *${discountDateFormatted}*! Valor com desconto: *${discountedAmount}*` : "";

    const message = `Olá ${customerName || ""}! 👋\n\nEstamos muito felizes em iniciar mais um mês conosco. 🎉\n\nSegue sua fatura:\n\n📄 *${invoice.description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Vencimento:* ${dueDateFormatted}${installmentInfo}${discountLine}\n\nAcesse o link abaixo para realizar o pagamento:\n\n🔗 ${paymentUrl}\n\nQualquer dúvida, estamos à disposição! ✨`;

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
      console.log(`WhatsApp invoice notification sent to ${formattedPhone}`);
    } else {
      console.error("WhatsApp send failed:", await sendResponse.text());
    }
  } catch (e) {
    console.error("Error sending WhatsApp invoice notification:", e);
  }
}

/**
 * Creates a payment link record and associates it with an invoice.
 * Now uses Asaas invoiceUrl directly when available.
 */
async function createPaymentLinkForInvoice(
  supabase: ReturnType<typeof createClient>,
  apiKey: string | null,
  invoice: {
    id: string;
    description: string;
    amount_cents: number;
    company_id: string;
    payment_method?: string;
    due_date?: string;
    recurring_charge_id?: string;
  }
) {
  let paymentUrl = "";

  // Try to get Asaas payment URL
  if (apiKey && invoice.due_date && invoice.recurring_charge_id) {
    try {
      paymentUrl = await getOrCreateAsaasPaymentUrl(
        supabase,
        apiKey,
        invoice as any
      );
    } catch (e) {
      console.error("Error getting Asaas URL for invoice:", e);
    }
  }

  // Save the URL (Asaas URL or empty) in payment_links
  const { data: linkData, error: linkError } = await supabase
    .from("payment_links")
    .insert({
      description: invoice.description || "Fatura",
      amount_cents: invoice.amount_cents,
      payment_method: invoice.payment_method || "pix",
      installments: 1,
      url: paymentUrl || "pending",
      company_id: invoice.company_id,
    })
    .select("id")
    .single();

  if (linkError || !linkData) {
    console.error(`[generate-invoices] Failed to create payment_link for invoice ${invoice.id}:`, linkError);
    return paymentUrl;
  }

  // If we have an Asaas URL, update the link with it; otherwise keep "pending"
  if (paymentUrl) {
    await supabase.from("payment_links").update({ url: paymentUrl }).eq("id", linkData.id);
  }

  // Update the invoice
  await supabase
    .from("company_invoices")
    .update({
      payment_link_id: linkData.id,
      payment_link_url: paymentUrl || "",
    })
    .eq("id", invoice.id);

  console.log(`[generate-invoices] Created payment_link ${linkData.id} for invoice ${invoice.id}, url=${paymentUrl ? "asaas" : "none"}`);
  return paymentUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || null;

    const reqBody = await req.json();
    const { recurring_charge_id, company_id, action } = reqBody;

    // Action: generate invoices for a recurring charge
    if (action === "generate" && recurring_charge_id) {
      const { data: charge, error } = await supabase
        .from("company_recurring_charges")
        .select("*")
        .eq("id", recurring_charge_id)
        .single();

      if (error || !charge) throw new Error("Cobrança recorrente não encontrada");

      // Generate invoices based on the installments field (default 12)
      let invoices: any[] = [];
      let numInvoices = charge.installments || 12;
      // For quarterly/yearly with default, use sensible defaults
      if (!charge.installments || charge.installments === 1) {
        if (charge.recurrence === "quarterly") numInvoices = 4;
        if (charge.recurrence === "yearly") numInvoices = 1;
      }

      const startDate = new Date(charge.next_charge_date + "T12:00:00");

      for (let i = 0; i < numInvoices; i++) {
        const dueDate = new Date(startDate);
        if (charge.recurrence === "monthly") {
          dueDate.setMonth(dueDate.getMonth() + i);
        } else if (charge.recurrence === "quarterly") {
          dueDate.setMonth(dueDate.getMonth() + i * 3);
        } else if (charge.recurrence === "yearly") {
          dueDate.setFullYear(dueDate.getFullYear() + i);
        }

        const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;

        invoices.push({
          company_id: charge.company_id,
          recurring_charge_id: charge.id,
          description: charge.description,
          amount_cents: charge.amount_cents,
          due_date: dueDateStr,
          status: "pending",
          payment_method: charge.payment_method,
          installment_number: i + 1,
          total_installments: numInvoices,
          late_fee_percent: 2.0,
          daily_interest_percent: 1.0,
          category_id: charge.category_id || null,
          cost_center_id: charge.cost_center_id || null,
          send_whatsapp: charge.send_whatsapp !== false,
        });
      }

      if (invoices.length === 0) {
        return new Response(
          JSON.stringify({ success: true, count: 0, message: "Nenhuma nova parcela para importar" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: inserted, error: insertError } = await supabase
        .from("company_invoices")
        .insert(invoices)
        .select();

      if (insertError) throw insertError;

      // Resolve the correct Asaas API key for this recurring charge (multi-account support)
      const resolvedApiKey = await resolveAsaasApiKey(supabase, recurring_charge_id, ASAAS_API_KEY);

      // Create payment links with Asaas URLs and send WhatsApp for first invoice
      let firstInvoiceUrl = "";
      for (const inv of inserted || []) {
        const url = await createPaymentLinkForInvoice(supabase, resolvedApiKey, {
          id: inv.id,
          description: inv.description,
          amount_cents: inv.amount_cents,
          company_id: inv.company_id,
          payment_method: inv.payment_method,
          due_date: inv.due_date,
          recurring_charge_id: inv.recurring_charge_id,
        });
        if (!firstInvoiceUrl && url) firstInvoiceUrl = url;
      }

      // Send WhatsApp notification for the first pending invoice only (if enabled)
      const firstPendingInv = (inserted || []).find((i: any) => i.status === "pending" && i.send_whatsapp !== false);
      if (charge.send_whatsapp !== false && firstInvoiceUrl && firstPendingInv) {
        let customerPhone = charge.customer_phone || "";
        const customerName = charge.customer_name || "";
        
        if (!customerPhone && charge.company_id) {
          const { data: companyData } = await supabase
            .from("onboarding_companies")
            .select("phone")
            .eq("id", charge.company_id)
            .single();
          if (companyData?.phone) customerPhone = companyData.phone;
        }
        
        if (customerPhone) {
          await sendWhatsAppInvoiceNotification(supabase, {
            description: firstPendingInv.description,
            amount_cents: firstPendingInv.amount_cents,
            due_date: firstPendingInv.due_date,
            installment_number: firstPendingInv.installment_number,
            total_installments: firstPendingInv.total_installments,
          }, firstInvoiceUrl, customerPhone, customerName);
        }
      }

      return new Response(
        JSON.stringify({ success: true, count: inserted?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: update overdue status and calculate fees
    if (action === "update_fees") {
      // Use Brazil timezone (UTC-3) to determine "today" so invoices due today
      // are not prematurely marked as overdue when the server runs in UTC
      const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const today = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}-${String(brNow.getDate()).padStart(2, "0")}`;

      // First, fix any invoices that were incorrectly marked overdue but are due today or in the future
      await supabase
        .from("company_invoices")
        .update({ status: "pending", late_fee_cents: 0, interest_cents: 0, total_with_fees_cents: 0 })
        .eq("status", "overdue")
        .gte("due_date", today);

      const { data: overdueInvoices } = await supabase
        .from("company_invoices")
        .select("*")
        .eq("status", "pending")
        .lt("due_date", today);

      let updated = 0;
      for (const inv of overdueInvoices || []) {
        const dueDate = new Date(inv.due_date + "T12:00:00");
        const now = new Date();
        const daysLate = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (daysLate > 0) {
          const lateFee = Math.round(inv.amount_cents * (inv.late_fee_percent / 100));
          const interest = Math.round(inv.amount_cents * (inv.daily_interest_percent / 100) * daysLate);

          const totalWithFees = inv.amount_cents + lateFee + interest;
          await supabase
            .from("company_invoices")
            .update({
              status: "overdue",
              late_fee_cents: lateFee,
              interest_cents: interest,
              total_with_fees_cents: totalWithFees,
            })
            .eq("id", inv.id);

          updated++;
        }
      }

      // Auto-block companies with invoices overdue > 5 days
      const brNowForBlock = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const fiveDaysAgo = new Date(brNowForBlock);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fiveDaysAgoStr = `${fiveDaysAgo.getFullYear()}-${String(fiveDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(fiveDaysAgo.getDate()).padStart(2, "0")}`;

      // Find companies with overdue invoices > 5 days (check both pending and overdue status)
      const { data: overdueCompanies } = await supabase
        .from("company_invoices")
        .select("company_id")
        .in("status", ["pending", "overdue"])
        .lt("due_date", fiveDaysAgoStr);

      if (overdueCompanies && overdueCompanies.length > 0) {
        const companyIds = [...new Set(overdueCompanies.map(i => i.company_id))];
        for (const cid of companyIds) {
          // Check if company was recently manually unblocked (grace period of 5 days)
          const { data: companyData } = await supabase
            .from("onboarding_companies")
            .select("is_billing_blocked, billing_unblocked_at")
            .eq("id", cid)
            .single();

          if (companyData && !companyData.is_billing_blocked) {
            const unblockedAt = (companyData as any).billing_unblocked_at;
            if (unblockedAt) {
              const unblockedDate = new Date(unblockedAt);
              const gracePeriodEnd = new Date(unblockedDate);
              gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);
              if (new Date() < gracePeriodEnd) {
                // Still within grace period, skip blocking
                continue;
              }
            }

            await supabase
              .from("onboarding_companies")
              .update({
                is_billing_blocked: true,
                billing_blocked_at: new Date().toISOString(),
                billing_blocked_reason: "Bloqueio automático: fatura vencida há mais de 5 dias",
                billing_unblocked_at: null,
              })
              .eq("id", cid)
              .eq("is_billing_blocked", false);
          }
        }
      }

      // Auto-unblock companies that no longer have overdue invoices > 5 days
      // (only those auto-blocked, not manually blocked)
      const { data: blockedCompanies } = await supabase
        .from("onboarding_companies")
        .select("id")
        .eq("is_billing_blocked", true)
        .like("billing_blocked_reason", "Bloqueio automático%");

      if (blockedCompanies) {
        for (const bc of blockedCompanies) {
          const { data: stillOverdue } = await supabase
            .from("company_invoices")
            .select("id")
            .eq("company_id", bc.id)
            .in("status", ["pending", "overdue"])
            .lt("due_date", fiveDaysAgoStr)
            .limit(1);

          if (!stillOverdue || stillOverdue.length === 0) {
            await supabase
              .from("onboarding_companies")
              .update({
                is_billing_blocked: false,
                billing_blocked_at: null,
                billing_blocked_reason: null,
              })
              .eq("id", bc.id);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: get invoices for a company (public by token or authenticated)
    if (action === "get_by_token") {
      const { token } = await req.json();
      const { data: invoice } = await supabase
        .from("company_invoices")
        .select("*")
        .eq("public_token", token)
        .single();

      return new Response(
        JSON.stringify({ invoice }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: auto-renew - delta sync from Asaas subscription
    if (action === "auto_renew" && recurring_charge_id) {
      const { data: charge } = await supabase
        .from("company_recurring_charges")
        .select("*")
        .eq("id", recurring_charge_id)
        .eq("is_active", true)
        .single();

      if (!charge) {
        return new Response(
          JSON.stringify({ success: false, reason: "Recorrência inativa ou não encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delta sync: if Asaas subscription exists, import new payments
      if (charge.pagarme_plan_id && ASAAS_API_KEY) {
        const { data: existingInvoices } = await supabase
          .from("company_invoices")
          .select("due_date")
          .eq("recurring_charge_id", recurring_charge_id);
        const existingDates = new Set((existingInvoices || []).map((i: any) => i.due_date));

        let allPayments: any[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          try {
            const payments = await asaasRequest(
              `/subscriptions/${charge.pagarme_plan_id}/payments?offset=${offset}&limit=${limit}`,
              "GET",
              ASAAS_API_KEY
            );
            if (payments.data?.length > 0) {
              allPayments = allPayments.concat(payments.data);
              offset += limit;
              hasMore = payments.data.length === limit;
            } else {
              hasMore = false;
            }
          } catch (e) {
            console.error("Error fetching Asaas payments for auto_renew:", e);
            hasMore = false;
          }
        }

        const newPayments = allPayments.filter((p: any) => !existingDates.has(p.dueDate));
        if (newPayments.length === 0) {
          console.log(`[auto_renew] No new Asaas payments to import for ${recurring_charge_id}`);
          return new Response(
            JSON.stringify({ success: true, count: 0, message: "Sem novas parcelas no Asaas" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let installmentCounter = existingDates.size;
        const invoices = newPayments.map((payment: any) => {
          installmentCounter++;
          return {
            company_id: charge.company_id,
            recurring_charge_id: charge.id,
            description: charge.description,
            amount_cents: Math.round(payment.value * 100),
            due_date: payment.dueDate,
            status: payment.status === "RECEIVED" || payment.status === "CONFIRMED" ? "paid" : "pending",
            payment_method: charge.payment_method,
            installment_number: installmentCounter,
            total_installments: 0,
            late_fee_percent: 2.0,
            daily_interest_percent: 1.0,
          };
        });

        const { data: inserted, error: insertError } = await supabase
          .from("company_invoices")
          .insert(invoices)
          .select();

        if (insertError) throw insertError;

        // Create payment links
        let firstRenewUrl = "";
        for (const inv of inserted || []) {
          const url = await createPaymentLinkForInvoice(supabase, ASAAS_API_KEY, {
            id: inv.id,
            description: inv.description,
            amount_cents: inv.amount_cents,
            company_id: inv.company_id,
            payment_method: inv.payment_method,
            due_date: inv.due_date,
            recurring_charge_id: inv.recurring_charge_id,
          });
          if (!firstRenewUrl && url) firstRenewUrl = url;
        }

        // Send WhatsApp for first pending invoice (if enabled)
        const firstPendingInv = (inserted || []).find((i: any) => i.status === "pending" && i.send_whatsapp !== false);
        if (charge.send_whatsapp !== false && firstRenewUrl && firstPendingInv) {
          let customerPhone = charge.customer_phone || "";
          const customerName = charge.customer_name || "";
          if (!customerPhone && charge.company_id) {
            const { data: companyData } = await supabase
              .from("onboarding_companies")
              .select("phone")
              .eq("id", charge.company_id)
              .single();
            if (companyData?.phone) customerPhone = companyData.phone;
          }
          if (customerPhone) {
            await sendWhatsAppInvoiceNotification(supabase, {
              description: firstPendingInv.description,
              amount_cents: firstPendingInv.amount_cents,
              due_date: firstPendingInv.due_date,
              installment_number: firstPendingInv.installment_number,
              total_installments: firstPendingInv.total_installments,
            }, firstRenewUrl, customerPhone, customerName);
          }
        }

        // Update next_charge_date
        if (invoices.length > 0) {
          const lastDueDate = invoices[invoices.length - 1].due_date;
          await supabase
            .from("company_recurring_charges")
            .update({ next_charge_date: lastDueDate })
            .eq("id", recurring_charge_id);
        }

        console.log(`[auto_renew] Delta sync: imported ${inserted?.length || 0} new invoices for ${recurring_charge_id}`);

        return new Response(
          JSON.stringify({ success: true, count: inserted?.length || 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: no Asaas subscription, generate next batch
      const { data: pendingInvoices } = await supabase
        .from("company_invoices")
        .select("id")
        .eq("recurring_charge_id", recurring_charge_id)
        .in("status", ["pending", "overdue"])
        .limit(1);

      if (pendingInvoices && pendingInvoices.length > 0) {
        return new Response(
          JSON.stringify({ success: false, reason: "Ainda há parcelas pendentes" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: lastInvoice } = await supabase
        .from("company_invoices")
        .select("due_date")
        .eq("recurring_charge_id", recurring_charge_id)
        .order("due_date", { ascending: false })
        .limit(1)
        .single();

      if (!lastInvoice) {
        return new Response(
          JSON.stringify({ success: false, reason: "Nenhuma fatura anterior encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const lastDate = new Date(lastInvoice.due_date + "T12:00:00");
      if (charge.recurrence === "monthly") {
        lastDate.setMonth(lastDate.getMonth() + 1);
      } else if (charge.recurrence === "quarterly") {
        lastDate.setMonth(lastDate.getMonth() + 3);
      } else if (charge.recurrence === "yearly") {
        lastDate.setFullYear(lastDate.getFullYear() + 1);
      }

      let numInvoices = charge.installments || 12;
      if (!charge.installments || charge.installments === 1) {
        if (charge.recurrence === "quarterly") numInvoices = 4;
        if (charge.recurrence === "yearly") numInvoices = 1;
      }

      const fallbackInvoices = [];
      for (let i = 0; i < numInvoices; i++) {
        const dueDate = new Date(lastDate);
        if (charge.recurrence === "monthly") {
          dueDate.setMonth(dueDate.getMonth() + i);
        } else if (charge.recurrence === "quarterly") {
          dueDate.setMonth(dueDate.getMonth() + i * 3);
        } else if (charge.recurrence === "yearly") {
          dueDate.setFullYear(dueDate.getFullYear() + i);
        }

        const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;

        fallbackInvoices.push({
          company_id: charge.company_id,
          recurring_charge_id: charge.id,
          description: charge.description,
          amount_cents: charge.amount_cents,
          due_date: dueDateStr,
          status: "pending",
          payment_method: charge.payment_method,
          installment_number: i + 1,
          total_installments: numInvoices,
          late_fee_percent: 2.0,
          daily_interest_percent: 1.0,
        });
      }

      const { data: inserted, error: insertError } = await supabase
        .from("company_invoices")
        .insert(fallbackInvoices)
        .select();

      if (insertError) throw insertError;

      let firstRenewUrl = "";
      for (const inv of inserted || []) {
        const url = await createPaymentLinkForInvoice(supabase, ASAAS_API_KEY, {
          id: inv.id,
          description: inv.description,
          amount_cents: inv.amount_cents,
          company_id: inv.company_id,
          payment_method: inv.payment_method,
          due_date: inv.due_date,
          recurring_charge_id: inv.recurring_charge_id,
        });
        if (!firstRenewUrl && url) firstRenewUrl = url;
      }

      if (charge.send_whatsapp !== false && firstRenewUrl && (inserted?.length || 0) > 0) {
        const firstInv = inserted![0];
        let customerPhone = charge.customer_phone || "";
        const customerName = charge.customer_name || "";
        if (!customerPhone && charge.company_id) {
          const { data: companyData } = await supabase
            .from("onboarding_companies")
            .select("phone")
            .eq("id", charge.company_id)
            .single();
          if (companyData?.phone) customerPhone = companyData.phone;
        }
        if (customerPhone) {
          await sendWhatsAppInvoiceNotification(supabase, {
            description: firstInv.description,
            amount_cents: firstInv.amount_cents,
            due_date: firstInv.due_date,
            installment_number: firstInv.installment_number,
            total_installments: firstInv.total_installments,
          }, firstRenewUrl, customerPhone, customerName);
        }
      }

      const firstNewDueDateStr = fallbackInvoices[0].due_date;
      await supabase
        .from("company_recurring_charges")
        .update({ next_charge_date: firstNewDueDateStr })
        .eq("id", recurring_charge_id);

      console.log(`[auto_renew] Fallback: generated ${inserted?.length || 0} new invoices for ${recurring_charge_id}`);

      return new Response(
        JSON.stringify({ success: true, count: inserted?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: cleanup future invoices when recurring charge is deactivated
    // Accepts optional signal_date (ISO string) — the date the client signaled cancellation.
    // Invoices due within 30 days of signal_date are kept (they're owed), the rest are deleted.
    if (action === "cleanup_future_invoices" && recurring_charge_id) {
      const signalDate = reqBody.signal_date ? new Date(reqBody.signal_date) : new Date();
      const cutoffDate = new Date(signalDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

      console.log(`Cleanup: signal_date=${signalDate.toISOString()}, cutoff=${cutoffStr}, recurring=${recurring_charge_id}`);

      const { data: deleted, error: delError } = await supabase
        .from("company_invoices")
        .delete()
        .eq("recurring_charge_id", recurring_charge_id)
        .eq("status", "pending")
        .gt("due_date", cutoffStr)
        .select("id");

      const deletedCount = deleted?.length || 0;
      console.log(`Cleanup: deleted ${deletedCount} future invoices for recurring ${recurring_charge_id}`);

      if (delError) {
        console.error("Cleanup error:", delError);
      }

      return new Response(
        JSON.stringify({ success: true, deleted: deletedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: backfill - re-fetch Asaas URLs for all pending/overdue invoices
    if (action === "backfill_payment_links") {
      const { data: invoicesToFix } = await supabase
        .from("company_invoices")
        .select("id, description, amount_cents, company_id, payment_method, due_date, recurring_charge_id, payment_link_id, payment_link_url")
        .in("status", ["pending", "overdue"]);

      let fixed = 0;
      for (const inv of invoicesToFix || []) {
        // Resolve the correct API key for this invoice's recurring charge
        const invApiKey = inv.recurring_charge_id
          ? await resolveAsaasApiKey(supabase, inv.recurring_charge_id, ASAAS_API_KEY)
          : ASAAS_API_KEY;

        // Re-fetch Asaas URL for each invoice individually
        if (invApiKey && inv.due_date && inv.recurring_charge_id) {
          try {
            const asaasUrl = await getOrCreateAsaasPaymentUrl(supabase, invApiKey, inv);
            if (asaasUrl) {
              // Update the invoice's payment_link_url
              await supabase
                .from("company_invoices")
                .update({ payment_link_url: asaasUrl })
                .eq("id", inv.id);

              // Update the payment_links record too if exists
              if (inv.payment_link_id) {
                await supabase
                  .from("payment_links")
                  .update({ url: asaasUrl })
                  .eq("id", inv.payment_link_id);
              }

              fixed++;
            }
          } catch (e) {
            console.error(`Backfill error for invoice ${inv.id}:`, e);
          }
        } else if (!inv.payment_link_id) {
          // No payment link at all - create one
          await createPaymentLinkForInvoice(supabase, invApiKey, inv);
          fixed++;
        }
      }

      console.log(`Backfill: updated ${fixed} invoices with correct Asaas URLs`);

      return new Response(
        JSON.stringify({ success: true, fixed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate invoices error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
