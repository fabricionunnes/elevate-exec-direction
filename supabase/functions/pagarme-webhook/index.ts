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
    console.log("[Pagar.me Webhook] Received:", JSON.stringify(body).substring(0, 500));

    // Pagar.me sends webhook events with type and data
    const eventType = body.type;
    const data = body.data;

    if (!eventType || !data) {
      console.log("[Pagar.me Webhook] Missing type or data, ignoring");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle charge events (payment status updates)
    if (eventType.startsWith("charge.")) {
      const chargeId = data.id;
      const chargeStatus = data.status;
      const orderId = data.order?.id;

      console.log(`[Pagar.me Webhook] Charge event: ${eventType}, charge: ${chargeId}, status: ${chargeStatus}, order: ${orderId}`);

      // Map Pagar.me status to our status
      let newStatus: string;
      switch (chargeStatus) {
        case "paid":
          newStatus = "paid";
          break;
        case "canceled":
        case "cancelled":
          newStatus = "cancelled";
          break;
        case "failed":
          newStatus = "failed";
          break;
        case "refunded":
          newStatus = "refunded";
          break;
        case "pending":
        case "processing":
          newStatus = "pending";
          break;
        default:
          newStatus = chargeStatus || "unknown";
      }

      // Update by pagarme_order_id or pagarme_charge_id
      const updateFilter: Record<string, string> = {};
      if (orderId) {
        updateFilter.pagarme_order_id = orderId;
      } else if (chargeId) {
        updateFilter.pagarme_charge_id = chargeId;
      }

      if (Object.keys(updateFilter).length > 0) {
        const { data: updatedOrders, error } = await supabase
          .from("pagarme_orders")
          .update({
            status: newStatus,
            webhook_received_at: new Date().toISOString(),
            webhook_event: eventType,
          })
          .match(updateFilter)
          .select("payment_link_id, amount_cents");

        if (error) {
          console.error("[Pagar.me Webhook] DB update error:", error);
        } else {
          console.log(`[Pagar.me Webhook] Order updated to status: ${newStatus}`);

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
                  console.error("[Pagar.me Webhook] Invoice update error:", invError);
                } else {
                  console.log(`[Pagar.me Webhook] Invoice with payment_link_id ${order.payment_link_id} marked as paid`);

                  // Check if this was the last installment and auto-renew
                  const { data: paidInvoice } = await supabase
                    .from("company_invoices")
                    .select("recurring_charge_id, installment_number, total_installments")
                    .eq("payment_link_id", order.payment_link_id)
                    .single();

                  if (paidInvoice?.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
                    console.log(`[Pagar.me Webhook] Last installment paid, triggering auto-renew for ${paidInvoice.recurring_charge_id}`);
                    await supabase.functions.invoke("generate-invoices", {
                      body: { action: "auto_renew", recurring_charge_id: paidInvoice.recurring_charge_id },
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Handle order events
    if (eventType.startsWith("order.")) {
      const orderId = data.id;
      const orderStatus = data.status;

      console.log(`[Pagar.me Webhook] Order event: ${eventType}, order: ${orderId}, status: ${orderStatus}`);

      if (orderId) {
        let newStatus: string;
        switch (orderStatus) {
          case "paid":
            newStatus = "paid";
            break;
          case "canceled":
          case "cancelled":
            newStatus = "cancelled";
            break;
          case "failed":
            newStatus = "failed";
            break;
          default:
            newStatus = orderStatus || "pending";
        }

        const { data: updatedOrders, error } = await supabase
          .from("pagarme_orders")
          .update({
            status: newStatus,
            webhook_received_at: new Date().toISOString(),
            webhook_event: eventType,
          })
          .eq("pagarme_order_id", orderId)
          .select("payment_link_id, amount_cents");

        if (error) {
          console.error("[Pagar.me Webhook] DB update error:", error);
        } else {
          console.log(`[Pagar.me Webhook] Order ${orderId} updated to: ${newStatus}`);

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
                  console.error("[Pagar.me Webhook] Invoice update error:", invError);
                } else {
                  console.log(`[Pagar.me Webhook] Invoice with payment_link_id ${order.payment_link_id} marked as paid`);

                  // Check if this was the last installment and auto-renew
                  const { data: paidInvoice } = await supabase
                    .from("company_invoices")
                    .select("recurring_charge_id, installment_number, total_installments")
                    .eq("payment_link_id", order.payment_link_id)
                    .single();

                  if (paidInvoice?.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
                    console.log(`[Pagar.me Webhook] Last installment paid, triggering auto-renew for ${paidInvoice.recurring_charge_id}`);
                    await supabase.functions.invoke("generate-invoices", {
                      body: { action: "auto_renew", recurring_charge_id: paidInvoice.recurring_charge_id },
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Pagar.me Webhook] Error:", error);
    // Still return 200 to prevent retries on processing errors
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
