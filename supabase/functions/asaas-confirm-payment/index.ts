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

    const { data: invoice, error: invError } = await supabase
      .from("company_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      throw new Error("Fatura não encontrada");
    }

    const inv = invoice as any;

    if (!inv.recurring_charge_id) {
      console.log("Invoice has no recurring_charge_id, skipping Asaas sync");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_recurring_charge" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: charge } = await supabase
      .from("company_recurring_charges")
      .select("*")
      .eq("id", inv.recurring_charge_id)
      .single();

    const subscriptionId = (charge as any)?.pagarme_plan_id;
    if (!subscriptionId) {
      console.log("Recurring charge has no Asaas subscription, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revert" && inv.pagarme_charge_id) {
      console.log(`Reverting stored Asaas payment ${inv.pagarme_charge_id}`);
      try {
        await asaasRequest(
          `/payments/${inv.pagarme_charge_id}/undoReceivedInCash`,
          "POST",
          ASAAS_API_KEY
        );
        console.log(`Asaas payment ${inv.pagarme_charge_id} reverted`);
      } catch (e: any) {
        console.error(`Revert error for ${inv.pagarme_charge_id}:`, e.message);
      }
      await supabase
        .from("company_invoices")
        .update({ pagarme_charge_id: null } as any)
        .eq("id", invoice_id);
      return new Response(
        JSON.stringify({ success: true, asaas_payment_id: inv.pagarme_charge_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const invoiceDueDate = inv.due_date;

    if (action === "confirm") {
      const today = new Date().toISOString().split("T")[0];
      if (invoiceDueDate && invoiceDueDate > today) {
        console.log(`Invoice ${invoice_id} has future due date ${invoiceDueDate}, skipping confirm sync`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "future_due_date" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (inv.pagarme_charge_id) {
        console.log(`Invoice ${invoice_id} already linked to Asaas payment ${inv.pagarme_charge_id}, skipping confirm`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "already_synced", asaas_payment_id: inv.pagarme_charge_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const exactPayment = payments.data.find((p: any) => p.dueDate === invoiceDueDate);

      if (!exactPayment) {
        console.log(`No Asaas payment found with exact due date ${invoiceDueDate}`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "no_exact_due_date_match" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(exactPayment.status)) {
        console.log(`Asaas payment ${exactPayment.id} for due date ${invoiceDueDate} is already paid (${exactPayment.status}), skipping confirm`);
        await supabase
          .from("company_invoices")
          .update({ pagarme_charge_id: exactPayment.id } as any)
          .eq("id", invoice_id);

        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "already_paid_in_asaas", asaas_payment_id: exactPayment.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (exactPayment.status !== "PENDING") {
        console.log(`Asaas payment ${exactPayment.id} for due date ${invoiceDueDate} is not pending (${exactPayment.status}), skipping confirm`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "payment_not_pending", payment_status: exactPayment.status }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Confirming Asaas payment ${exactPayment.id} (dueDate: ${exactPayment.dueDate}) for invoice due ${invoiceDueDate}`);

      await asaasRequest(
        `/payments/${exactPayment.id}/receiveInCash`,
        "POST",
        ASAAS_API_KEY,
        {
          paymentDate: new Date().toISOString().split("T")[0],
          value: exactPayment.value,
        }
      );

      await supabase
        .from("company_invoices")
        .update({ pagarme_charge_id: exactPayment.id } as any)
        .eq("id", invoice_id);

      console.log(`Asaas payment ${exactPayment.id} confirmed and stored on invoice`);

      return new Response(
        JSON.stringify({ success: true, asaas_payment_id: exactPayment.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revert") {
      const exactPayment = payments.data.find((p: any) => p.dueDate === invoiceDueDate && p.status === "RECEIVED_IN_CASH");

      if (!exactPayment) {
        console.log("No RECEIVED_IN_CASH Asaas payment found to revert");
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "no_cash_payment" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Reverting Asaas payment ${exactPayment.id} (dueDate: ${exactPayment.dueDate})`);

      await asaasRequest(
        `/payments/${exactPayment.id}/undoReceivedInCash`,
        "POST",
        ASAAS_API_KEY
      );

      await supabase
        .from("company_invoices")
        .update({ pagarme_charge_id: null } as any)
        .eq("id", invoice_id);

      console.log(`Asaas payment ${exactPayment.id} reverted`);

      return new Response(
        JSON.stringify({ success: true, asaas_payment_id: exactPayment.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Asaas confirm error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});