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

    const { invoice_id, new_due_date } = await req.json();

    if (!invoice_id || !new_due_date) {
      return new Response(
        JSON.stringify({ error: "invoice_id e new_due_date são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(new_due_date)) {
      return new Response(
        JSON.stringify({ error: "Formato de data inválido. Use YYYY-MM-DD" }),
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

    const inv = invoice as any;
    const oldDueDate = inv.due_date;

    // Update locally first
    const today = new Date().toISOString().split("T")[0];
    const newStatus = new_due_date < today ? "overdue" : (inv.status === "overdue" ? "pending" : inv.status);

    const { error: updateError } = await supabase
      .from("company_invoices")
      .update({
        due_date: new_due_date,
        status: newStatus,
      } as any)
      .eq("id", invoice_id);

    if (updateError) throw updateError;

    console.log(`Invoice ${invoice_id} due date updated: ${oldDueDate} -> ${new_due_date}`);

    // Try to sync with Asaas
    let asaasSynced = false;
    let asaasPaymentId = null;

    if (inv.recurring_charge_id) {
      const { data: charge } = await supabase
        .from("company_recurring_charges")
        .select("*")
        .eq("id", inv.recurring_charge_id)
        .single();

      const subscriptionId = (charge as any)?.pagarme_plan_id;

      if (subscriptionId) {
        // List payments from the Asaas subscription
        const payments = await asaasRequest(
          `/subscriptions/${subscriptionId}/payments`,
          "GET",
          ASAAS_API_KEY
        );

        if (payments.data?.length) {
          console.log(`Found ${payments.data.length} payments for subscription ${subscriptionId}`);
          console.log(`Looking for: pagarme_charge_id=${inv.pagarme_charge_id}, oldDueDate=${oldDueDate}, amount=${inv.amount_cents / 100}`);
          
          // Log all payments for debugging
          payments.data.forEach((p: any) => {
            console.log(`  Payment: id=${p.id}, dueDate=${p.dueDate}, status=${p.status}, value=${p.value}`);
          });

          // Find matching payment: direct match by stored ID, or by old due date
          let targetPayment = null;

          // Try stored Asaas payment ID first
          if (inv.pagarme_charge_id) {
            targetPayment = payments.data.find((p: any) => p.id === inv.pagarme_charge_id);
            if (targetPayment) console.log(`Matched by pagarme_charge_id: ${targetPayment.id}`);
          }

          // Fallback: match by old due date (any non-paid/cancelled status)
          if (!targetPayment) {
            targetPayment = payments.data.find((p: any) =>
              p.dueDate === oldDueDate && !["RECEIVED", "RECEIVED_IN_CASH", "CONFIRMED", "REFUNDED", "CANCELLED"].includes(p.status)
            );
            if (targetPayment) console.log(`Matched by oldDueDate: ${targetPayment.id}`);
          }

          // Fallback: match by new due date (in case it was already partially updated)
          if (!targetPayment) {
            targetPayment = payments.data.find((p: any) =>
              p.dueDate === new_due_date && !["RECEIVED", "RECEIVED_IN_CASH", "CONFIRMED", "REFUNDED", "CANCELLED"].includes(p.status)
            );
            if (targetPayment) console.log(`Matched by new_due_date: ${targetPayment.id}`);
          }

          // Fallback: match by amount and any pending-like status
          if (!targetPayment) {
            const invoiceAmount = inv.amount_cents / 100;
            targetPayment = payments.data
              .filter((p: any) =>
                !["RECEIVED", "RECEIVED_IN_CASH", "CONFIRMED", "REFUNDED", "CANCELLED"].includes(p.status) &&
                Math.abs(p.value - invoiceAmount) < 0.01
              )
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
            if (targetPayment) console.log(`Matched by amount fallback: ${targetPayment.id}`);
          }

          if (targetPayment) {
            console.log(`Updating Asaas payment ${targetPayment.id} due date to ${new_due_date}`);

            await asaasRequest(
              `/payments/${targetPayment.id}`,
              "PUT",
              ASAAS_API_KEY,
              { dueDate: new_due_date }
            );

            asaasSynced = true;
            asaasPaymentId = targetPayment.id;

            // Store the Asaas payment ID if not already stored
            if (!inv.pagarme_charge_id) {
              await supabase
                .from("company_invoices")
                .update({ pagarme_charge_id: targetPayment.id } as any)
                .eq("id", invoice_id);
            }

            console.log(`Asaas payment ${targetPayment.id} due date updated successfully`);
          } else {
            console.log("No matching pending Asaas payment found to update");
          }
        }
      } else {
        console.log("No Asaas subscription found, local-only update");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        old_due_date: oldDueDate,
        new_due_date,
        asaas_synced: asaasSynced,
        asaas_payment_id: asaasPaymentId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update due date error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
