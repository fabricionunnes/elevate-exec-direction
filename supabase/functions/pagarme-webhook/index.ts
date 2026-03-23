import { createClient } from "@supabase/supabase-js";

async function adjustHealthScoreForPayment(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  dueDate: string,
  paidAt: string
) {
  try {
    // Find active project for this company
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("id")
      .eq("onboarding_company_id", companyId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!project) return;

    const due = new Date(dueDate);
    const paid = new Date(paidAt);
    due.setHours(0, 0, 0, 0);
    paid.setHours(0, 0, 0, 0);

    let pointsAdjustment: number;
    let eventDescription: string;

    if (paid < due) {
      pointsAdjustment = 35;
      eventDescription = "Fatura paga antes do vencimento (+35 pontos)";
    } else if (paid.getTime() === due.getTime()) {
      pointsAdjustment = 20;
      eventDescription = "Fatura paga na data de vencimento (+20 pontos)";
    } else {
      pointsAdjustment = 15;
      eventDescription = "Fatura paga após atraso (+15 pontos)";
    }

    // Get current health score
    const { data: currentScore } = await supabase
      .from("client_health_scores")
      .select("id, total_score")
      .eq("project_id", project.id)
      .single();

    if (currentScore) {
      const newTotal = Math.min(100, Math.max(0, Number(currentScore.total_score) + pointsAdjustment));
      
      await supabase
        .from("client_health_scores")
        .update({
          total_score: newTotal,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentScore.id);

      // Log event
      await supabase.from("health_score_events").insert({
        project_id: project.id,
        event_type: "billing_payment",
        event_data: { pointsAdjustment, dueDate, paidAt, description: eventDescription },
        previous_score: Number(currentScore.total_score),
        new_score: newTotal,
        triggered_by: "webhook",
      });

      console.log(`[Pagar.me Webhook] Health score adjusted: ${currentScore.total_score} -> ${newTotal} (${eventDescription})`);
    }
  } catch (error) {
    console.error("[Pagar.me Webhook] Health score adjustment error:", error);
  }
}

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

                  // Adjust health score based on payment timing
                  const { data: paidInvoice } = await supabase
                    .from("company_invoices")
                    .select("company_id, due_date, recurring_charge_id, installment_number, total_installments")
                    .eq("payment_link_id", order.payment_link_id)
                    .single();

                  if (paidInvoice) {
                    // Adjust health score based on payment timing
                    await adjustHealthScoreForPayment(
                      supabase,
                      paidInvoice.company_id,
                      paidInvoice.due_date,
                      new Date().toISOString()
                    );

                    if (paidInvoice.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
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

                  // Adjust health score based on payment timing
                  const { data: paidInvoice } = await supabase
                    .from("company_invoices")
                    .select("company_id, due_date, recurring_charge_id, installment_number, total_installments")
                    .eq("payment_link_id", order.payment_link_id)
                    .single();

                  if (paidInvoice) {
                    await adjustHealthScoreForPayment(
                      supabase,
                      paidInvoice.company_id,
                      paidInvoice.due_date,
                      new Date().toISOString()
                    );

                    if (paidInvoice.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
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
    }

    // Activate pending projects when payment is confirmed
    if (newStatus === "paid" && chargeId) {
      await activatePendingProjects(supabase, chargeId);
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

async function activatePendingProjects(supabase: any, paymentId: string) {
  try {
    const { data: paidInvoices } = await supabase
      .from("company_invoices")
      .select("company_id")
      .eq("pagarme_charge_id", paymentId)
      .eq("status", "paid")
      .not("company_id", "is", null);

    if (!paidInvoices?.length) return;

    for (const inv of paidInvoices) {
      const { data: pendingProjects } = await supabase
        .from("onboarding_projects")
        .select("id, product_name, product_id")
        .eq("onboarding_company_id", inv.company_id)
        .eq("status", "pending");

      if (!pendingProjects?.length) continue;

      for (const project of pendingProjects) {
        await supabase
          .from("onboarding_projects")
          .update({ status: "active" })
          .eq("id", project.id);

        console.log(`[Pagar.me Webhook] Activated pending project ${project.id} for company ${inv.company_id}`);

        const { data: templates } = await supabase
          .from("onboarding_task_templates")
          .select("id, title, description, priority, sort_order, default_days_offset, duration_days, phase, recurrence, phase_order, is_internal")
          .eq("product_id", project.product_id)
          .order("phase_order", { ascending: true })
          .order("sort_order", { ascending: true });

        if (templates?.length) {
          const today = new Date();
          const tasksToInsert = templates.map((tpl: any, idx: number) => {
            let dueDate: string | null = null;
            const offset = (tpl.default_days_offset ?? 0) + (tpl.duration_days ?? 0);
            if (offset > 0) {
              const due = new Date(today);
              due.setDate(due.getDate() + offset);
              dueDate = due.toISOString().split("T")[0];
            }
            return {
              project_id: project.id,
              template_id: tpl.id,
              title: tpl.title,
              description: tpl.description,
              priority: tpl.priority || "medium",
              status: "pending",
              due_date: dueDate,
              sort_order: tpl.sort_order ?? idx,
              tags: tpl.phase ? [tpl.phase] : null,
              recurrence: tpl.recurrence ?? null,
              is_internal: tpl.is_internal ?? false,
            };
          });
          await supabase.from("onboarding_tasks").insert(tasksToInsert);
        }
      }

      await supabase
        .from("onboarding_companies")
        .update({ status: "active", contract_start_date: new Date().toISOString().split("T")[0] })
        .eq("id", inv.company_id)
        .eq("status", "pending");
    }
  } catch (err) {
    console.error("[Pagar.me Webhook] Error activating pending projects:", err);
  }
}
