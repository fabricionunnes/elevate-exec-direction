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
      // Try to find a matching payment by due date in the Asaas subscription
      try {
        const payments = await asaasRequest(
          `/subscriptions/${charge.pagarme_plan_id}/payments`,
          "GET",
          apiKey
        );
        if (payments.data?.length > 0) {
          // Find payment matching this invoice's due date
          const matching = payments.data.find((p: any) => p.dueDate === invoice.due_date);
          if (matching?.invoiceUrl) {
            return matching.invoiceUrl;
          }
          // If no exact match, try first pending payment
          const pending = payments.data.find((p: any) =>
            p.status === "PENDING" || p.status === "OVERDUE"
          );
          if (pending?.invoiceUrl) {
            return pending.invoiceUrl;
          }
        }
      } catch (e) {
        console.error("Error fetching subscription payments:", e);
      }

      // If subscription exists but no matching payment found, create a standalone charge
      try {
        // Get the customer ID from the subscription
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
    return;
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

    const { recurring_charge_id, company_id, action } = await req.json();

    // Action: generate invoices for a recurring charge
    if (action === "generate" && recurring_charge_id) {
      const { data: charge, error } = await supabase
        .from("company_recurring_charges")
        .select("*")
        .eq("id", recurring_charge_id)
        .single();

      if (error || !charge) throw new Error("Cobrança recorrente não encontrada");

      let numInvoices = 12;
      if (charge.recurrence === "quarterly") numInvoices = 4;
      if (charge.recurrence === "yearly") numInvoices = 1;

      const startDate = new Date(charge.next_charge_date + "T12:00:00");
      const invoices = [];

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
        });
      }

      const { data: inserted, error: insertError } = await supabase
        .from("company_invoices")
        .insert(invoices)
        .select();

      if (insertError) throw insertError;

      // Create payment links with Asaas URLs
      for (const inv of inserted || []) {
        await createPaymentLinkForInvoice(supabase, ASAAS_API_KEY, {
          id: inv.id,
          description: inv.description,
          amount_cents: inv.amount_cents,
          company_id: inv.company_id,
          payment_method: inv.payment_method,
          due_date: inv.due_date,
          recurring_charge_id: inv.recurring_charge_id,
        });
      }

      return new Response(
        JSON.stringify({ success: true, count: inserted?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: update overdue status and calculate fees
    if (action === "update_fees") {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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

    // Action: auto-renew invoices when the last installment is paid
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

      let numInvoices = 12;
      if (charge.recurrence === "quarterly") numInvoices = 4;
      if (charge.recurrence === "yearly") numInvoices = 1;

      const invoices = [];
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
        });
      }

      const { data: inserted, error: insertError } = await supabase
        .from("company_invoices")
        .insert(invoices)
        .select();

      if (insertError) throw insertError;

      // Create payment links with Asaas URLs
      for (const inv of inserted || []) {
        await createPaymentLinkForInvoice(supabase, ASAAS_API_KEY, {
          id: inv.id,
          description: inv.description,
          amount_cents: inv.amount_cents,
          company_id: inv.company_id,
          payment_method: inv.payment_method,
          due_date: inv.due_date,
          recurring_charge_id: inv.recurring_charge_id,
        });
      }

      // Update next_charge_date
      const firstNewDueDateStr = invoices[0].due_date;
      await supabase
        .from("company_recurring_charges")
        .update({ next_charge_date: firstNewDueDateStr })
        .eq("id", recurring_charge_id);

      console.log(`Auto-renew: generated ${inserted?.length || 0} new invoices for recurring ${recurring_charge_id}`);

      return new Response(
        JSON.stringify({ success: true, count: inserted?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: cleanup future invoices when recurring charge is deactivated
    if (action === "cleanup_future_invoices" && recurring_charge_id) {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

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

    // Action: backfill - create payment_links for existing invoices that don't have one
    if (action === "backfill_payment_links") {
      const { data: invoicesWithoutLink } = await supabase
        .from("company_invoices")
        .select("id, description, amount_cents, company_id, payment_method, due_date, recurring_charge_id")
        .is("payment_link_id", null)
        .in("status", ["pending", "overdue"]);

      let fixed = 0;
      for (const inv of invoicesWithoutLink || []) {
        await createPaymentLinkForInvoice(supabase, ASAAS_API_KEY, inv);
        fixed++;
      }

      console.log(`Backfill: created payment_links for ${fixed} invoices`);

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
