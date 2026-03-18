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
    const paymentNetValue = payment.netValue;
    const paymentDiscount = payment.discount?.value || 0; // discount amount from Asaas
    const paymentValueCents = Math.round((paymentValue || 0) * 100);

    console.log(`[Asaas Webhook] Event: ${event}, Payment: ${paymentId}, Status: ${paymentStatus} -> ${newStatus}, Subscription: ${subscriptionId}, DueDate: ${dueDate}, Value: ${paymentValue}, Discount: ${paymentDiscount}`);

    // Idempotency: if payment is already confirmed and bank was credited, skip
    if (newStatus === "paid") {
      // Check 1: invoice matched by pagarme_charge_id
      const { data: alreadyPaid } = await supabase
        .from("company_invoices")
        .select("id")
        .eq("pagarme_charge_id", paymentId)
        .eq("status", "paid")
        .limit(1);

      if (alreadyPaid?.length) {
        const invoiceId = alreadyPaid[0].id;
        const { data: existingBankTx } = await supabase
          .from("financial_bank_transactions")
          .select("id")
          .eq("reference_id", invoiceId)
          .eq("reference_type", "invoice")
          .eq("type", "credit")
          .limit(1);

        if (existingBankTx?.length) {
          console.log(`[Asaas Webhook] Payment ${paymentId} already processed for invoice ${invoiceId}, skipping duplicate`);
          return new Response(JSON.stringify({ received: true, matched: true, deduplicated: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Check 2: if subscription+dueDate matches an invoice that is already paid or partial (manual payment)
      if (subscriptionId && dueDate) {
        const { data: manuallyPaidCharges } = await supabase
          .from("company_recurring_charges")
          .select("id")
          .eq("pagarme_plan_id", subscriptionId);

        if (manuallyPaidCharges?.length) {
          const { data: manuallyPaidInv } = await supabase
            .from("company_invoices")
            .select("id, status, paid_at")
            .eq("recurring_charge_id", manuallyPaidCharges[0].id)
            .eq("due_date", dueDate)
            .in("status", ["paid", "partial"])
            .not("paid_at", "is", null)
            .limit(1);

          if (manuallyPaidInv?.length) {
            console.log(`[Asaas Webhook] Invoice ${manuallyPaidInv[0].id} already has manual payment (status: ${manuallyPaidInv[0].status}), skipping webhook processing`);
            return new Response(JSON.stringify({ received: true, matched: true, manual_payment: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

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
        await markInvoicesPaid(supabase, orderMatches, paymentValueCents);
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

        if (newStatus === "paid" && (invoice.status === "paid" || invoice.status === "partial")) {
          console.log(`[Asaas Webhook] Invoice ${invoice.id} already has payment (status: ${invoice.status}), skipping`);
          matched = true;
        } else if (newStatus === "paid" && invoice.status !== "paid") {
          // Detect discount: if Asaas paid value < invoice amount, there's a discount
          const discountCents = paymentValueCents > 0 && paymentValueCents < invoice.amount_cents
            ? invoice.amount_cents - paymentValueCents
            : 0;
          const actualPaidCents = paymentValueCents > 0 ? paymentValueCents : invoice.amount_cents;

          await supabase
            .from("company_invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              paid_amount_cents: actualPaidCents,
              discount_cents: discountCents,
              payment_fee_cents: 199,
            })
            .eq("id", invoice.id);
          matched = true;
          if (discountCents > 0) {
            console.log(`[Asaas Webhook] Invoice ${invoice.id} marked as paid with discount: ${discountCents} cents (direct match)`);
          } else {
            console.log(`[Asaas Webhook] Invoice ${invoice.id} marked as paid (direct match)`);
          }

          // Credit Asaas bank account with actual paid amount (minus fee)
          await creditAsaasBank(supabase, actualPaidCents, `Fatura ${invoice.id}${discountCents > 0 ? ` (desconto R$${(discountCents/100).toFixed(2)})` : ''}`, invoice.id, invoice.recurring_charge_id);

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
          // Skip invoices that are already paid, partial (manual payment), or cancelled
          const { data: invoices, error: invErr } = await supabase
            .from("company_invoices")
            .select("id, payment_link_id, amount_cents, installment_number, total_installments, recurring_charge_id, status, paid_at")
            .eq("recurring_charge_id", recurringChargeId)
            .eq("due_date", dueDate)
            .not("status", "in", '("paid","partial","cancelled")');

          if (!invErr && invoices?.length) {
            const invoice = invoices[0];
            console.log(`[Asaas Webhook] Matched invoice ${invoice.id} (installment ${invoice.installment_number}/${invoice.total_installments})`);

            if (newStatus === "paid") {
              // Detect discount: if Asaas paid value < invoice amount, there's a discount
              const discountCents = paymentValueCents > 0 && paymentValueCents < invoice.amount_cents
                ? invoice.amount_cents - paymentValueCents
                : 0;
              const actualPaidCents = paymentValueCents > 0 ? paymentValueCents : invoice.amount_cents;

              const { error: updateErr } = await supabase
                .from("company_invoices")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  paid_amount_cents: actualPaidCents,
                  discount_cents: discountCents,
                  pagarme_charge_id: paymentId,
                  payment_fee_cents: 199,
                })
                .eq("id", invoice.id);

              if (updateErr) {
                console.error("[Asaas Webhook] Invoice update error:", updateErr);
              } else {
                if (discountCents > 0) {
                  console.log(`[Asaas Webhook] Invoice ${invoice.id} marked as paid with discount: ${discountCents} cents`);
                } else {
                  console.log(`[Asaas Webhook] Invoice ${invoice.id} marked as paid`);
                }
                matched = true;

                // Credit Asaas bank account with actual paid amount (minus fee)
                await creditAsaasBank(supabase, actualPaidCents, `Fatura ${invoice.id} (parcela ${invoice.installment_number}/${invoice.total_installments})${discountCents > 0 ? ` desconto R$${(discountCents/100).toFixed(2)}` : ''}`, invoice.id, invoice.recurring_charge_id);

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

    // Handle service purchase permission management
    await handleServicePurchasePermissions(supabase, subscriptionId, paymentId, newStatus);

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

async function creditAsaasBank(supabase: any, amountCents: number, description: string, invoiceId: string, recurringChargeId?: string | null) {
  try {
    const feeCents = 199; // R$ 1,99
    const netAmount = amountCents - feeCents;
    if (netAmount <= 0) return;

    // Deduplication: check if ANY credit already exists for this invoice (manual or Asaas)
    const { data: existingTx } = await supabase
      .from("financial_bank_transactions")
      .select("id")
      .eq("reference_id", invoiceId)
      .eq("reference_type", "invoice")
      .eq("type", "credit")
      .limit(1);

    if (existingTx?.length) {
      console.log(`[Asaas Webhook] Bank credit already exists for invoice ${invoiceId} (may be manual), skipping duplicate`);
      return;
    }

    // Determine which bank to credit based on the Asaas account used
    let bankId: string | null = null;

    if (recurringChargeId) {
      // Look up which Asaas account this recurring charge uses
      const { data: charge } = await supabase
        .from("company_recurring_charges")
        .select("asaas_account_id")
        .eq("id", recurringChargeId)
        .single();

      if (charge?.asaas_account_id) {
        const { data: account } = await supabase
          .from("asaas_accounts")
          .select("name")
          .eq("id", charge.asaas_account_id)
          .single();

        if (account?.name) {
          // Map Asaas account name to bank name
          // "UNV" -> "Asaas", "UN Social" -> "Asaas UNV Social"
          const bankSearchName = account.name.toLowerCase().includes("social") ? "Asaas UNV Social" : "Asaas";
          const { data: banks } = await supabase
            .from("financial_banks")
            .select("id")
            .eq("name", bankSearchName)
            .eq("is_active", true)
            .limit(1);

          if (banks?.length) {
            bankId = banks[0].id;
            console.log(`[Asaas Webhook] Resolved bank "${bankSearchName}" (${bankId}) for Asaas account "${account.name}"`);
          }
        }
      }
    }

    // Fallback: find default "Asaas" bank
    if (!bankId) {
      const { data: banks } = await supabase
        .from("financial_banks")
        .select("id")
        .eq("name", "Asaas")
        .eq("is_active", true)
        .limit(1);

      if (!banks?.length) {
        console.log("[Asaas Webhook] No 'Asaas' bank account found, skipping balance credit");
        return;
      }
      bankId = banks[0].id;
    }

    // Increment bank balance
    await supabase.rpc("increment_bank_balance", { p_bank_id: bankId, p_amount: netAmount });

    // Record transaction
    await supabase.from("financial_bank_transactions").insert({
      bank_id: bankId,
      type: "credit",
      amount_cents: netAmount,
      description: `Recebimento Asaas: ${description} (taxa R$1,99 deduzida)`,
      reference_type: "invoice",
      reference_id: invoiceId,
    });

    console.log(`[Asaas Webhook] Credited bank ${bankId}: ${netAmount} cents (invoice ${invoiceId})`);
  } catch (err) {
    console.error("[Asaas Webhook] Error crediting bank:", err);
  }
}

async function markInvoicesPaid(supabase: any, orders: any[], paymentValueCents: number = 0) {
  for (const order of orders) {
    if (!order.payment_link_id) continue;

    // First get the invoice to calculate discount
    const { data: invoiceForDiscount } = await supabase
      .from("company_invoices")
      .select("id, amount_cents")
      .eq("payment_link_id", order.payment_link_id)
      .neq("status", "paid")
      .limit(1)
      .single();

    const invoiceAmountCents = invoiceForDiscount?.amount_cents || order.amount_cents;
    const discountCents = paymentValueCents > 0 && paymentValueCents < invoiceAmountCents
      ? invoiceAmountCents - paymentValueCents
      : 0;
    const actualPaidCents = paymentValueCents > 0 ? paymentValueCents : invoiceAmountCents;

    const { error } = await supabase
      .from("company_invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_amount_cents: actualPaidCents,
        discount_cents: discountCents,
        payment_fee_cents: 199,
      })
      .eq("payment_link_id", order.payment_link_id);

    if (error) {
      console.error("[Asaas Webhook] Invoice update error:", error);
    } else {
      if (discountCents > 0) {
        console.log(`[Asaas Webhook] Invoice paid with discount: ${discountCents} cents via payment_link_id ${order.payment_link_id}`);
      } else {
        console.log(`[Asaas Webhook] Invoice paid via payment_link_id ${order.payment_link_id}`);
      }

      // Credit Asaas bank account with actual paid amount
      const { data: paidInvForBank } = await supabase
        .from("company_invoices")
        .select("id, amount_cents, description, installment_number, total_installments, recurring_charge_id, discount_cents")
        .eq("payment_link_id", order.payment_link_id)
        .eq("status", "paid")
        .limit(1)
        .single();

      if (paidInvForBank) {
        await creditAsaasBank(
          supabase, 
          actualPaidCents, 
          `Fatura ${paidInvForBank.description || paidInvForBank.id} (${paidInvForBank.installment_number}/${paidInvForBank.total_installments})${discountCents > 0 ? ` desconto R$${(discountCents/100).toFixed(2)}` : ''}`,
          paidInvForBank.id,
          paidInvForBank.recurring_charge_id
        );
      }

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

async function handleServicePurchasePermissions(supabase: any, subscriptionId: string | null, paymentId: string, newStatus: string) {
  try {
    // Check if this payment/subscription is linked to a service purchase
    const searchId = subscriptionId || paymentId;
    if (!searchId) return;

    const { data: purchases } = await supabase
      .from("service_purchases")
      .select("id, project_id, menu_key, billing_type, status")
      .eq("asaas_subscription_id", searchId);

    if (!purchases?.length) return;

    for (const purchase of purchases) {
      const isRecurring = purchase.billing_type === "monthly";

      if (newStatus === "paid") {
        // Reactivate if blocked
        if (purchase.status === "blocked") {
          console.log(`[Asaas Webhook] Reactivating service purchase ${purchase.id} (${purchase.menu_key})`);
          await supabase
            .from("service_purchases")
            .update({ status: "active", blocked_at: null })
            .eq("id", purchase.id);

          // Re-enable permission
          const keysToEnable = purchase.menu_key === "gestao_clientes"
            ? ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"]
            : [purchase.menu_key];

          for (const key of keysToEnable) {
            await supabase
              .from("project_menu_permissions")
              .update({ is_enabled: true })
              .eq("project_id", purchase.project_id)
              .eq("menu_key", key);
          }
        }
      } else if (newStatus === "overdue" && isRecurring) {
        // Block recurring service on overdue
        if (purchase.status === "active") {
          console.log(`[Asaas Webhook] Blocking service purchase ${purchase.id} (${purchase.menu_key}) due to overdue payment`);
          await supabase
            .from("service_purchases")
            .update({ status: "blocked", blocked_at: new Date().toISOString() })
            .eq("id", purchase.id);

          // Disable permission
          const keysToDisable = purchase.menu_key === "gestao_clientes"
            ? ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"]
            : [purchase.menu_key];

          for (const key of keysToDisable) {
            await supabase
              .from("project_menu_permissions")
              .update({ is_enabled: false })
              .eq("project_id", purchase.project_id)
              .eq("menu_key", key);
          }
        }
      }
    }
  } catch (err) {
    console.error("[Asaas Webhook] Error handling service purchase permissions:", err);
  }
}
}
