import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const data = body.data;

    console.log("Dom Pagamentos webhook received:", event, "ID:", data?.id);

    if (!event || !data?.id) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const transactionId = String(data.id);

    // Map Dom Pagamentos events to our statuses
    let newStatus: string | null = null;

    switch (event) {
      case "CHARGE-PAID":
      case "CHARGE-AUTHORIZED":
        newStatus = "paid";
        break;
      case "CHARGE-PENDING":
        newStatus = "pending";
        break;
      case "CHARGE-REFUSED":
      case "CHARGE-FAILED":
        newStatus = "failed";
        break;
      case "CHARGE-REFUNDED":
        newStatus = "refunded";
        break;
      case "CHARGE-CHARGEBACK":
        newStatus = "chargeback";
        break;
      default:
        console.log("Unhandled Dom event:", event);
        return new Response(JSON.stringify({ received: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Find the order by transaction ID
    const { data: order, error: orderError } = await supabase
      .from("pagarme_orders")
      .select("id, status, payment_link_id, amount_cents")
      .eq("pagarme_order_id", transactionId)
      .eq("provider", "dompagamentos")
      .maybeSingle();

    if (orderError) {
      console.error("Error finding order:", orderError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order) {
      console.log("Order not found for transaction:", transactionId);
      return new Response(JSON.stringify({ received: true, order_not_found: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if already paid/refunded
    if (
      (order.status === "paid" && newStatus === "paid") ||
      (order.status === "refunded" && newStatus === "refunded")
    ) {
      console.log("Order already in status:", order.status, "- skipping");
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order status
    await supabase
      .from("pagarme_orders")
      .update({ status: newStatus })
      .eq("id", order.id);

    // If paid, update linked invoice
    if (newStatus === "paid" && order.payment_link_id) {
      const { data: invoice } = await supabase
        .from("company_invoices")
        .select("id, status, paid_at")
        .eq("payment_link_id", order.payment_link_id)
        .maybeSingle();

      // Respect manual interventions
      if (
        invoice &&
        !["paid", "partial", "cancelled"].includes(invoice.status || "") &&
        !invoice.paid_at
      ) {
        await supabase
          .from("company_invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_amount_cents: order.amount_cents,
          })
          .eq("id", invoice.id);
      }
    }

    // If refunded, revert invoice
    if (newStatus === "refunded" && order.payment_link_id) {
      await supabase
        .from("company_invoices")
        .update({ status: "pending", paid_at: null, paid_amount_cents: 0 })
        .eq("payment_link_id", order.payment_link_id)
        .eq("status", "paid");
    }

    console.log(`Order ${order.id} updated to ${newStatus}`);

    return new Response(
      JSON.stringify({ received: true, order_id: order.id, new_status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dom webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
