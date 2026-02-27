import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[Asaas Webhook] Received:", JSON.stringify(body).substring(0, 500));

    const event = body.event;
    const payment = body.payment;

    if (!event || !payment) {
      console.log("[Asaas Webhook] Missing event or payment, ignoring");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const paymentId = payment.id;
    const paymentStatus = payment.status;

    console.log(`[Asaas Webhook] Event: ${event}, Payment: ${paymentId}, Status: ${paymentStatus}`);

    // Map Asaas status to our internal status
    let newStatus: string;
    switch (paymentStatus) {
      case "CONFIRMED":
      case "RECEIVED":
      case "RECEIVED_IN_CASH":
        newStatus = "paid";
        break;
      case "PENDING":
      case "AWAITING_RISK_ANALYSIS":
        newStatus = "pending";
        break;
      case "OVERDUE":
        newStatus = "overdue";
        break;
      case "REFUNDED":
      case "REFUND_REQUESTED":
      case "CHARGEBACK_REQUESTED":
      case "CHARGEBACK_DISPUTE":
        newStatus = "refunded";
        break;
      case "CANCELLED":
      case "DELETED":
        newStatus = "cancelled";
        break;
      default:
        newStatus = paymentStatus?.toLowerCase() || "unknown";
    }

    // Update pagarme_orders by payment ID (stored in pagarme_charge_id)
    const { data: updatedOrders, error } = await supabase
      .from("pagarme_orders")
      .update({
        status: newStatus,
        webhook_received_at: new Date().toISOString(),
        webhook_event: event,
      })
      .eq("pagarme_charge_id", paymentId)
      .select("payment_link_id, amount_cents");

    if (error) {
      console.error("[Asaas Webhook] DB update error:", error);
    } else {
      console.log(`[Asaas Webhook] Updated ${updatedOrders?.length || 0} orders to status: ${newStatus}`);

      // If paid, also update linked company_invoices
      if (newStatus === "paid" && updatedOrders) {
        for (const order of updatedOrders) {
          if (order.payment_link_id) {
            const { error: invError } = await supabase
              .from("company_invoices")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                paid_amount_cents: order.amount_cents,
              })
              .eq("payment_link_id", order.payment_link_id);

            if (invError) {
              console.error("[Asaas Webhook] Invoice update error:", invError);
            } else {
              console.log(`[Asaas Webhook] Invoice with payment_link_id ${order.payment_link_id} marked as paid`);

              // Check if this was the last installment and auto-renew
              const { data: paidInvoice } = await supabase
                .from("company_invoices")
                .select("recurring_charge_id, installment_number, total_installments")
                .eq("payment_link_id", order.payment_link_id)
                .single();

              if (paidInvoice?.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
                console.log(`[Asaas Webhook] Last installment paid, triggering auto-renew for ${paidInvoice.recurring_charge_id}`);
                await supabase.functions.invoke("generate-invoices", {
                  body: { action: "auto_renew", recurring_charge_id: paidInvoice.recurring_charge_id },
                });
              }
            }
          }
        }
      }
    }

    // Also try matching by subscription if present
    if (payment.subscription) {
      const { data: subOrders, error: subError } = await supabase
        .from("pagarme_orders")
        .update({
          status: newStatus,
          webhook_received_at: new Date().toISOString(),
          webhook_event: event,
        })
        .eq("pagarme_order_id", paymentId)
        .is("webhook_received_at", null)
        .select("payment_link_id, amount_cents");

      if (!subError && subOrders?.length && newStatus === "paid") {
        for (const order of subOrders) {
          if (order.payment_link_id) {
            await supabase
              .from("company_invoices")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                paid_amount_cents: order.amount_cents,
              })
              .eq("payment_link_id", order.payment_link_id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Asaas Webhook] Error:", error);
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
