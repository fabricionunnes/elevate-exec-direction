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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {};
  }
  if (!res.ok) {
    console.error(`Asaas error (${res.status}):`, JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || JSON.stringify(data));
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

    const { invoice_id, action } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get invoice details
    const { data: invoice, error: invError } = await supabase
      .from("company_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      throw new Error("Fatura não encontrada");
    }

    // Get the recurring charge to find the Asaas subscription ID
    const recurringChargeId = (invoice as any).recurring_charge_id;
    if (!recurringChargeId) {
      console.log("Invoice has no recurring_charge_id, skipping Asaas sync");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_recurring_charge" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: charge } = await supabase
      .from("company_recurring_charges")
      .select("*")
      .eq("id", recurringChargeId)
      .single();

    const subscriptionId = (charge as any)?.pagarme_plan_id; // Reused column for Asaas subscription ID
    if (!subscriptionId) {
      console.log("Recurring charge has no Asaas subscription, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List payments from the Asaas subscription
    const payments = await asaasRequest(
      `/subscriptions/${subscriptionId}/payments`,
      "GET",
      ASAAS_API_KEY
    );

    if (!payments.data?.length) {
      console.log("No Asaas payments found for subscription");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_payments" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find matching payment by due date and amount
    const invoiceDueDate = (invoice as any).due_date;
    const invoiceAmount = (invoice as any).amount_cents / 100;

    const matchingPayment = payments.data.find((p: any) => {
      const sameDue = p.dueDate === invoiceDueDate;
      const sameAmount = Math.abs(p.value - invoiceAmount) < 0.01;
      return sameDue && sameAmount && p.status !== "RECEIVED" && p.status !== "CONFIRMED";
    });

    if (!matchingPayment) {
      // Try to find by installment number or closest date
      const pendingPayments = payments.data
        .filter((p: any) => p.status !== "RECEIVED" && p.status !== "CONFIRMED")
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      if (pendingPayments.length === 0) {
        console.log("All Asaas payments already confirmed");
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "already_paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use the first pending payment as fallback
      const fallbackPayment = pendingPayments[0];
      console.log(`No exact match, using fallback payment ${fallbackPayment.id}`);

      if (action === "confirm") {
        await asaasRequest(
          `/payments/${fallbackPayment.id}/receiveInCash`,
          "POST",
          ASAAS_API_KEY,
          {
            paymentDate: new Date().toISOString().split("T")[0],
            value: fallbackPayment.value,
          }
        );
        console.log(`Asaas payment ${fallbackPayment.id} confirmed via receiveInCash`);
      } else if (action === "revert") {
        await asaasRequest(
          `/payments/${fallbackPayment.id}/undoReceivedInCash`,
          "POST",
          ASAAS_API_KEY
        );
        console.log(`Asaas payment ${fallbackPayment.id} reverted`);
      }

      return new Response(
        JSON.stringify({ success: true, asaas_payment_id: fallbackPayment.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Confirm or revert the matching payment
    if (action === "confirm") {
      await asaasRequest(
        `/payments/${matchingPayment.id}/receiveInCash`,
        "POST",
        ASAAS_API_KEY,
        {
          paymentDate: new Date().toISOString().split("T")[0],
          value: matchingPayment.value,
        }
      );
      console.log(`Asaas payment ${matchingPayment.id} confirmed via receiveInCash`);
    } else if (action === "revert") {
      await asaasRequest(
        `/payments/${matchingPayment.id}/undoReceivedInCash`,
        "POST",
        ASAAS_API_KEY
      );
      console.log(`Asaas payment ${matchingPayment.id} reverted`);
    }

    return new Response(
      JSON.stringify({ success: true, asaas_payment_id: matchingPayment.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Asaas confirm error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
