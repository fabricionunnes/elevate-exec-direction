import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function mapAsaasStatus(paymentStatus: string): string {
  switch (paymentStatus) {
    case "CONFIRMED":
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "pending";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "refunded";
    case "CANCELLED":
    case "DELETED":
      return "cancelled";
    default:
      return paymentStatus?.toLowerCase() || "unknown";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[Asaas Webhook] Received:", JSON.stringify(body).substring(0, 800));

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
    const newStatus = mapAsaasStatus(paymentStatus);
    const subscriptionId = payment.subscription;
    const dueDate = payment.dueDate;
    const paymentValue = payment.value;

    console.log(`[Asaas Webhook] Event: ${event}, Payment: ${paymentId}, Status: ${paymentStatus} -> ${newStatus}, Subscription: ${subscriptionId}, DueDate: ${dueDate}`);

    // Strategy 1: Try matching via pagarme_charge_id (checkout-originated payments)
    let matched = false;
    const { data: orderMatches, error: orderErr } = await supabase
      .from("pagarme_orders")
      .update({
        status: newStatus,
        webhook_received_at: new Date().toISOString(),
        webhook_event: event,
      })
      .eq("pagarme_charge_id", paymentId)
      .select("payment_link_id, amount_cents");

    if (!orderErr && orderMatches?.length) {
      matched = true;
      console.log(`[Asaas Webhook] Matched ${orderMatches.length} orders by charge_id`);
      if (newStatus === "paid") {
        await markInvoicesPaid(supabase, orderMatches);
      }
    }

    // Strategy 2: Match via subscription -> recurring_charge -> invoice by dueDate
    if (!matched && subscriptionId && dueDate) {
      console.log(`[Asaas Webhook] Trying subscription match: ${subscriptionId}, dueDate: ${dueDate}`);

      // Strategy 2a: First check if any invoice already has this payment ID stored (manual confirm flow)
      const { data: directMatch } = await supabase
        .from("company_invoices")
        .select("id, payment_link_id, amount_cents, installment_number, total_installments, recurring_charge_id, status")
        .eq("pagarme_charge_id", paymentId)
        .limit(1);

      if (directMatch?.length) {
        const invoice = directMatch[0];
        console.log(`[Asaas Webhook] Direct match by pagarme_charge_id: invoice ${invoice.id} (status: ${invoice.status})`);

        if (newStatus === "paid" && invoice.status === "paid") {
          console.log(`[Asaas Webhook] Invoice ${invoice.id} already paid, skipping`);
          matched = true;
        } else if (newStatus === "paid" && invoice.status !== "paid") {
          await supabase
            .from("company_invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              paid_amount_cents: invoice.amount_cents,
            })
            .eq("id", invoice.id);
          matched = true;
          console.log(`[Asaas Webhook] Invoice ${invoice.id} marked as paid (direct match)`);

          if (invoice.installment_number === invoice.total_installments && invoice.recurring_charge_id) {
            await supabase.functions.invoke("generate-invoices", {
              body: { action: "auto_renew", recurring_charge_id: invoice.recurring_charge_id },
            });
          }
        } else if (newStatus === "pending") {
          // Revert scenario
          const due = new Date(dueDate + "T12:00:00");
          const revertStatus = due < new Date() ? "overdue" : "pending";
          await supabase
            .from("company_invoices")
            .update({
              status: revertStatus,
              paid_at: null,
              paid_amount_cents: null,
              pagarme_charge_id: null,
            })
            .eq("id", invoice.id);
          matched = true;
          console.log(`[Asaas Webhook] Invoice ${invoice.id} reverted to ${revertStatus} (direct match)`);
        } else {
          await supabase
            .from("company_invoices")
            .update({ status: newStatus })
            .eq("id", invoice.id);
          matched = true;
        }
      }

      // Strategy 2b: Match via subscription -> recurring_charge -> invoice by dueDate
      if (!matched) {
        const { data: charges } = await supabase
          .from("company_recurring_charges")
          .select("id")
          .eq("pagarme_plan_id", subscriptionId);

        if (charges?.length) {
          const recurringChargeId = charges[0].id;
          console.log(`[Asaas Webhook] Found recurring_charge: ${recurringChargeId}`);

          // Find matching invoice by recurring_charge_id + due_date
          const { data: invoices, error: invErr } = await supabase
            .from("company_invoices")
            .select("id, payment_link_id, amount_cents, installment_number, total_installments, recurring_charge_id, status")
            .eq("recurring_charge_id", recurringChargeId)
            .eq("due_date", dueDate)
            .neq("status", "paid");

          if (!invErr && invoices?.length) {
            const invoice = invoices[0];
            console.log(`[Asaas Webhook] Matched invoice ${invoice.id} (installment ${invoice.installment_number}/${invoice.total_installments})`);

            if (newStatus === "paid") {
              const { error: updateErr } = await supabase
                .from("company_invoices")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  paid_amount_cents: invoice.amount_cents,
                  pagarme_charge_id: paymentId,
                })
                .eq("id", invoice.id);

              if (updateErr) {
                console.error("[Asaas Webhook] Invoice update error:", updateErr);
              } else {
                console.log(`[Asaas Webhook] Invoice ${invoice.id} marked as paid`);
                matched = true;

                supabase.functions.invoke("notify-payment-confirmed", {
                  body: { invoice_id: invoice.id },
                }).catch((e: any) => console.error("[Asaas Webhook] WhatsApp notify error:", e));

                if (invoice.installment_number === invoice.total_installments) {
                  console.log(`[Asaas Webhook] Last installment paid, triggering auto-renew`);
                  await supabase.functions.invoke("generate-invoices", {
                    body: { action: "auto_renew", recurring_charge_id: recurringChargeId },
                  });
                }
              }
            } else {
              await supabase
                .from("company_invoices")
                .update({
                  status: newStatus,
                  pagarme_charge_id: paymentId,
                })
                .eq("id", invoice.id);
              matched = true;
            }
          }
        }
      }
    }

    if (!matched) {
      console.log(`[Asaas Webhook] No match found for payment ${paymentId}`);
    }

    return new Response(JSON.stringify({ received: true, matched }), {
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

async function markInvoicesPaid(supabase: any, orders: any[]) {
  for (const order of orders) {
    if (!order.payment_link_id) continue;

    const { error } = await supabase
      .from("company_invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_amount_cents: order.amount_cents,
      })
      .eq("payment_link_id", order.payment_link_id);

    if (error) {
      console.error("[Asaas Webhook] Invoice update error:", error);
    } else {
      console.log(`[Asaas Webhook] Invoice paid via payment_link_id ${order.payment_link_id}`);

      // Send WhatsApp payment confirmation (non-blocking)
      const { data: paidInvForNotif } = await supabase
        .from("company_invoices")
        .select("id")
        .eq("payment_link_id", order.payment_link_id)
        .eq("status", "paid")
        .limit(1)
        .single();

      if (paidInvForNotif?.id) {
        supabase.functions.invoke("notify-payment-confirmed", {
          body: { invoice_id: paidInvForNotif.id },
        }).catch((e: any) => console.error("[Asaas Webhook] WhatsApp notify error:", e));
      }

      const { data: paidInvoice } = await supabase
        .from("company_invoices")
        .select("recurring_charge_id, installment_number, total_installments")
        .eq("payment_link_id", order.payment_link_id)
        .single();

      if (paidInvoice?.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
        await supabase.functions.invoke("generate-invoices", {
          body: { action: "auto_renew", recurring_charge_id: paidInvoice.recurring_charge_id },
        });
      }
    }
  }
}
