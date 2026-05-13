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
    // Tolerate empty / non-JSON bodies (Asaas validation pings, GET checks, etc.)
    const rawBody = await req.text();
    if (!rawBody || !rawBody.trim()) {
      console.log("[Asaas Webhook] Empty body received (likely a validation ping). Responding 200 OK.");
      return new Response(JSON.stringify({ received: true, ping: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Asaas Webhook] Invalid JSON body:", rawBody.substring(0, 300));
      return new Response(JSON.stringify({ received: true, error: "invalid_json" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      // Check 1: invoice matched by stored Asaas payment id.
      // The payment id is unique and must win even if Asaas dueDate was shifted after the invoice was generated.
      const idempotencyQuery = supabase
        .from("company_invoices")
        .select("id")
        .eq("pagarme_charge_id", paymentId)
        .eq("status", "paid");
      const { data: alreadyPaid } = await idempotencyQuery.limit(1);

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

      // Strategy 2a: First check if any invoice already has this payment ID stored.
      // Do NOT filter by dueDate here: Asaas can shift due dates after creation, while payment.id remains unique.
      const directMatchQuery = supabase
        .from("company_invoices")
        .select("id, payment_link_id, amount_cents, installment_number, total_installments, recurring_charge_id, status, description, company_id")
        .eq("pagarme_charge_id", paymentId);
      const { data: directMatch } = await directMatchQuery.limit(1);

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
              payment_fee_cents: 0,
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
          // Auto-reconcile financial_receivables
          reconcileReceivable(supabase, invoice.id, null, actualPaidCents, invoice.description || '', dueDate).catch(() => {});

          // Notify payment confirmed (WhatsApp + internal notifications)
          supabase.functions.invoke("notify-payment-confirmed", {
            body: { invoice_id: invoice.id },
          }).catch((e: any) => console.error("[Asaas Webhook] WhatsApp notify error:", e));

          if (invoice.installment_number === invoice.total_installments && invoice.recurring_charge_id) {
            const skip = await hasEquivalentPendingElsewhere(supabase, invoice.company_id, invoice.amount_cents, invoice.recurring_charge_id);
            if (skip) {
              console.log(`[Asaas Webhook] Skipping auto-renew for ${invoice.recurring_charge_id}: equivalent pending invoice already exists for company ${invoice.company_id}`);
            } else {
              await supabase.functions.invoke("generate-invoices", {
                body: { action: "auto_renew", recurring_charge_id: invoice.recurring_charge_id },
              });
            }
          }
        } else if (invoice.status === "paid" || invoice.status === "partial") {
          // Never overwrite a manually-paid invoice with overdue/pending from Asaas
          console.log(`[Asaas Webhook] Invoice ${invoice.id} already paid/partial locally; ignoring webhook status ${newStatus}`);
          matched = true;
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
            .select("id, payment_link_id, amount_cents, installment_number, total_installments, recurring_charge_id, status, paid_at, description, company_id")
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
                  payment_fee_cents: 0,
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
                // Auto-reconcile financial_receivables
                reconcileReceivable(supabase, invoice.id, null, actualPaidCents, invoice.description || '', dueDate).catch(() => {});

                supabase.functions.invoke("notify-payment-confirmed", {
                  body: { invoice_id: invoice.id },
                }).catch((e: any) => console.error("[Asaas Webhook] WhatsApp notify error:", e));

                if (invoice.installment_number === invoice.total_installments) {
                  const skip = await hasEquivalentPendingElsewhere(supabase, invoice.company_id, invoice.amount_cents, recurringChargeId);
                  if (skip) {
                    console.log(`[Asaas Webhook] Skipping auto-renew for ${recurringChargeId}: equivalent pending invoice already exists for company ${invoice.company_id}`);
                  } else {
                    console.log(`[Asaas Webhook] Last installment paid, triggering auto-renew`);
                    await supabase.functions.invoke("generate-invoices", {
                      body: { action: "auto_renew", recurring_charge_id: recurringChargeId },
                    });
                  }
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

    // Strategy 3: Match by Asaas invoiceUrl against company_invoices.payment_link_url.
    // Catches standalone payments (no subscription field) that were created by asaas-sync
    // for recurring charges.
    if (!matched && payment.invoiceUrl) {
      const { data: urlMatches } = await supabase
        .from("company_invoices")
        .select("id, payment_link_id, amount_cents, installment_number, total_installments, recurring_charge_id, status, description, company_id")
        .eq("payment_link_url", payment.invoiceUrl)
        .limit(1);

      if (urlMatches?.length) {
        const invoice = urlMatches[0];
        console.log(`[Asaas Webhook] Matched invoice ${invoice.id} by invoiceUrl (status: ${invoice.status})`);

        if (newStatus === "paid" && (invoice.status === "paid" || invoice.status === "partial")) {
          console.log(`[Asaas Webhook] Invoice ${invoice.id} already has payment, skipping`);
          matched = true;
        } else if (newStatus === "paid") {
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
              pagarme_charge_id: paymentId,
              payment_fee_cents: 0,
            })
            .eq("id", invoice.id);
          matched = true;
          console.log(`[Asaas Webhook] Invoice ${invoice.id} marked paid via invoiceUrl${discountCents > 0 ? ` (discount ${discountCents} cents)` : ''}`);

          await creditAsaasBank(supabase, actualPaidCents, `Fatura ${invoice.id}${invoice.installment_number ? ` (parcela ${invoice.installment_number}/${invoice.total_installments})` : ''}${discountCents > 0 ? ` desconto R$${(discountCents/100).toFixed(2)}` : ''}`, invoice.id, invoice.recurring_charge_id);
          reconcileReceivable(supabase, invoice.id, null, actualPaidCents, invoice.description || '', dueDate).catch(() => {});

          supabase.functions.invoke("notify-payment-confirmed", {
            body: { invoice_id: invoice.id },
          }).catch((e: any) => console.error("[Asaas Webhook] WhatsApp notify error:", e));

          if (invoice.installment_number === invoice.total_installments && invoice.recurring_charge_id) {
            const skip = await hasEquivalentPendingElsewhere(supabase, invoice.company_id, invoice.amount_cents, invoice.recurring_charge_id);
            if (!skip) {
              await supabase.functions.invoke("generate-invoices", {
                body: { action: "auto_renew", recurring_charge_id: invoice.recurring_charge_id },
              });
            }
          }
        } else if (newStatus === "pending") {
          const due = new Date(dueDate + "T12:00:00");
          const revertStatus = due < new Date() ? "overdue" : "pending";
          await supabase
            .from("company_invoices")
            .update({ status: revertStatus, paid_at: null, paid_amount_cents: null, pagarme_charge_id: null })
            .eq("id", invoice.id);
          matched = true;
        } else {
          await supabase.from("company_invoices").update({ status: newStatus }).eq("id", invoice.id);
          matched = true;
        }
      }
    }

    if (!matched) {
      console.log(`[Asaas Webhook] No match found for payment ${paymentId}`);
    }

    // Handle service purchase permission management
    await handleServicePurchasePermissions(supabase, subscriptionId, paymentId, newStatus, paymentValueCents, dueDate);

    // Move CRM lead to "won" stage when public service purchase is paid
    if (newStatus === "paid") {
      await movePublicPurchaseLeadToWon(supabase, subscriptionId, paymentId, paymentValue, paymentNetValue, paymentDiscount);
      await activatePendingProjects(supabase, paymentId);
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

async function hasEquivalentPendingElsewhere(
  supabase: any,
  companyId: string | null | undefined,
  amountCents: number,
  excludeRecurringChargeId: string,
): Promise<boolean> {
  if (!companyId || !amountCents) return false;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("company_invoices")
      .select("id")
      .eq("company_id", companyId)
      .eq("amount_cents", amountCents)
      .in("status", ["pending", "overdue"])
      .gte("due_date", today)
      .neq("recurring_charge_id", excludeRecurringChargeId)
      .limit(1);
    return !!(data && data.length);
  } catch (e) {
    console.error("[Asaas Webhook] hasEquivalentPendingElsewhere error:", e);
    return false;
  }
}

async function creditAsaasBank(supabase: any, amountCents: number, description: string, invoiceId: string, recurringChargeId?: string | null) {
  try {
    // Determine which bank to credit based on the Asaas account used
    let bankId: string | null = null;
    let isSocialAccount = false;

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
          isSocialAccount = account.name.toLowerCase().includes("social");
          // Map Asaas account name to bank name
          // "UNV" -> "Asaas", "UN Social" -> "Asaas UNV Social"
          const bankSearchName = isSocialAccount ? "Asaas UNV Social" : "Asaas";
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

    // Credit GROSS amount — fees are no longer deducted automatically.
    // If the operator wants to register a fee, they should do it manually in the baixa dialog.
    const feeCents = 0;
    const netAmount = amountCents;
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

    // Update invoice with correct fee
    await supabase
      .from("company_invoices")
      .update({ payment_fee_cents: feeCents })
      .eq("id", invoiceId);

    // Increment bank balance
    await supabase.rpc("increment_bank_balance", { p_bank_id: bankId, p_amount: netAmount });

    // Record transaction
    await supabase.from("financial_bank_transactions").insert({
      bank_id: bankId,
      type: "credit",
      amount_cents: netAmount,
      description: `Recebimento Asaas: ${description}`,
      reference_type: "invoice",
      reference_id: invoiceId,
    });

    console.log(`[Asaas Webhook] Credited bank ${bankId}: ${netAmount} cents, fee: ${feeCents} cents (invoice ${invoiceId})`);
  } catch (err) {
    console.error("[Asaas Webhook] Error crediting bank:", err);
  }
}

// Auto-reconcile financial_receivables when a company_invoice is paid
async function reconcileReceivable(supabase: any, invoiceId: string, companyId: string | null, paidAmountCents: number, description: string, dueDate?: string) {
  try {
    if (!companyId) {
      const { data: inv } = await supabase
        .from("company_invoices")
        .select("company_id")
        .eq("id", invoiceId)
        .single();
      companyId = inv?.company_id;
    }
    if (!companyId) return;

    let query = supabase
      .from("financial_receivables")
      .select("id, amount, status, description")
      .eq("company_id", companyId)
      .not("status", "in", '("paid","cancelled")');

    if (dueDate) {
      query = query.eq("due_date", dueDate);
    }

    const { data: receivables } = await query.order("due_date", { ascending: true }).limit(5);
    if (!receivables?.length) return;

    const match = receivables.find((r: any) => 
      description && r.description && (
        r.description.toLowerCase().includes(description.toLowerCase()) ||
        description.toLowerCase().includes(r.description.toLowerCase())
      )
    ) || (dueDate ? receivables[0] : null);

    if (!match) return;

    const paidReais = paidAmountCents / 100;
    const isPartial = paidReais < match.amount;

    await supabase
      .from("financial_receivables")
      .update({
        status: isPartial ? "partial" : "paid",
        paid_date: new Date().toISOString().split("T")[0],
        paid_amount: paidReais,
      })
      .eq("id", match.id);

    console.log(`[Asaas Webhook] Auto-reconciled financial_receivable ${match.id} -> ${isPartial ? 'partial' : 'paid'}`);
  } catch (err) {
    console.error("[Asaas Webhook] Error reconciling receivable:", err);
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
        payment_fee_cents: 0,
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
        // Auto-reconcile financial_receivables
        reconcileReceivable(supabase, paidInvForBank.id, null, actualPaidCents, paidInvForBank.description || '', '').catch(() => {});
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
}

async function handleServicePurchasePermissions(supabase: any, subscriptionId: string | null, paymentId: string, newStatus: string, paymentValueCents: number = 0, dueDate?: string) {
  try {
    // Check if this payment/subscription is linked to a service purchase
    const searchId = subscriptionId || paymentId;
    if (!searchId) return;

    const { data: purchases } = await supabase
      .from("service_purchases")
      .select("id, project_id, menu_key, billing_type, status, recurring_charge_id")
      .eq("asaas_subscription_id", searchId);

    if (!purchases?.length) return;

    for (const purchase of purchases) {
      const isRecurring = purchase.billing_type === "monthly";

      if (newStatus === "paid") {
        // Activate on first payment (pending_payment -> active) OR reactivate if blocked
        if (purchase.status === "pending_payment" || purchase.status === "blocked") {
          console.log(`[Asaas Webhook] Activating service purchase ${purchase.id} (${purchase.menu_key}) from status: ${purchase.status}`);
          await supabase
            .from("service_purchases")
            .update({ status: "active", blocked_at: null })
            .eq("id", purchase.id);

          // Enable permissions
          const keysToEnable = purchase.menu_key === "gestao_clientes"
            ? ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"]
            : [purchase.menu_key];

          for (const key of keysToEnable) {
            const { data: updated } = await supabase
              .from("project_menu_permissions")
              .update({ is_enabled: true })
              .eq("project_id", purchase.project_id)
              .eq("menu_key", key)
              .select("id");

            if (!updated?.length) {
              await supabase
                .from("project_menu_permissions")
                .upsert({
                  project_id: purchase.project_id,
                  menu_key: key,
                  is_enabled: true,
                }, { onConflict: "project_id,menu_key" });
            }
          }
          console.log(`[Asaas Webhook] Permissions enabled for ${keysToEnable.join(", ")} on project ${purchase.project_id}`);
        }

        // Also mark the related invoice as paid if not already matched
        if (purchase.recurring_charge_id) {
          const invoiceFilter: any = { recurring_charge_id: purchase.recurring_charge_id };
          
          // Build query to find unpaid invoice
          let query = supabase
            .from("company_invoices")
            .select("id, amount_cents, installment_number, total_installments, status, paid_at")
            .eq("recurring_charge_id", purchase.recurring_charge_id)
            .not("status", "in", '("paid","partial","cancelled")');
          
          if (dueDate) {
            query = query.eq("due_date", dueDate);
          }
          
          const { data: invoices } = await query.order("due_date", { ascending: true }).limit(1);
          
          if (invoices?.length) {
            const invoice = invoices[0];
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
                pagarme_charge_id: paymentId,
                payment_fee_cents: 0,
              })
              .eq("id", invoice.id);

            console.log(`[Asaas Webhook] Service purchase invoice ${invoice.id} marked as paid`);

            // Credit bank
            await creditAsaasBank(supabase, actualPaidCents, `Serviço: ${purchase.menu_key} (fatura ${invoice.id})`, invoice.id, purchase.recurring_charge_id);
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

async function activatePendingProjects(supabase: any, paymentId: string) {
  try {
    // Find invoices paid by this payment (via pagarme_charge_id or payment_link)
    const { data: paidInvoices } = await supabase
      .from("company_invoices")
      .select("company_id")
      .eq("pagarme_charge_id", paymentId)
      .eq("status", "paid")
      .not("company_id", "is", null);

    if (!paidInvoices?.length) return;

    for (const inv of paidInvoices) {
      // Find pending projects for this company
      const { data: pendingProjects } = await supabase
        .from("onboarding_projects")
        .select("id, product_name, product_id")
        .eq("onboarding_company_id", inv.company_id)
        .eq("status", "pending");

      if (!pendingProjects?.length) continue;

      for (const project of pendingProjects) {
        // Activate project
        await supabase
          .from("onboarding_projects")
          .update({ status: "active" })
          .eq("id", project.id);

        console.log(`[Asaas Webhook] Activated pending project ${project.id} (${project.product_name}) for company ${inv.company_id}`);

        // Create tasks from templates
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
          console.log(`[Asaas Webhook] Created ${templates.length} tasks for project ${project.id}`);
        }
      }

      // Activate the company
      await supabase
        .from("onboarding_companies")
        .update({ status: "active", contract_start_date: new Date().toISOString().split("T")[0] })
        .eq("id", inv.company_id)
        .eq("status", "pending");
    }
  } catch (err) {
    console.error("[Asaas Webhook] Error activating pending projects:", err);
  }
}

async function movePublicPurchaseLeadToWon(supabase: any, subscriptionId: string | null, paymentId: string, paymentValue?: number, paymentNetValue?: number, paymentDiscount?: number) {
  try {
    const searchId = subscriptionId || paymentId;
    if (!searchId) return;

    // Find public_service_purchases linked to this payment
    let query = supabase
      .from("public_service_purchases")
      .select("id, crm_lead_id, user_provisioned, amount_cents, buyer_name, buyer_email, menu_key, company_id, service_catalog_id")

    if (subscriptionId) {
      query = query.eq("asaas_subscription_id", subscriptionId);
    } else {
      query = query.eq("asaas_payment_id", paymentId);
    }

    const { data: purchases } = await query;
    if (!purchases?.length) return;

    for (const purchase of purchases) {
      // Move CRM lead to won stage
      const leadId = purchase.crm_lead_id;
      if (leadId) {
        const { data: lead } = await supabase
          .from("crm_leads")
          .select("id, pipeline_id, stage_id")
          .eq("id", leadId)
          .single();

        if (lead) {
          const { data: wonStage } = await supabase
            .from("crm_stages")
            .select("id")
            .eq("pipeline_id", lead.pipeline_id)
            .eq("final_type", "won")
            .limit(1)
            .maybeSingle();

          if (wonStage && lead.stage_id !== wonStage.id) {
            await supabase
              .from("crm_leads")
              .update({
                stage_id: wonStage.id,
                closed_at: new Date().toISOString(),
              })
              .eq("id", leadId);
            console.log(`[Asaas Webhook] CRM lead ${leadId} moved to won stage (payment confirmed)`);
          }
        }
      }

      // Create financial_receivables record (paid) for the purchase
      await createReceivableForPublicPurchase(supabase, purchase, paymentValue, paymentNetValue, paymentDiscount);

      // Provision user account (create login + send email)
      if (!purchase.user_provisioned) {
        try {
          await supabase.functions.invoke("provision-service-buyer", {
            body: { purchase_id: purchase.id },
          });
          console.log(`[Asaas Webhook] User provisioned for purchase ${purchase.id}`);
        } catch (provErr) {
          console.error(`[Asaas Webhook] Provision error for purchase ${purchase.id}:`, provErr);
        }
      }

      // Update purchase status to paid
      await supabase
        .from("public_service_purchases")
        .update({ status: "paid", converted_at: new Date().toISOString() })
        .eq("id", purchase.id);
    }
  } catch (err) {
    console.error("[Asaas Webhook] Error moving public purchase lead to won:", err);
  }
}

async function createReceivableForPublicPurchase(supabase: any, purchase: any, paymentValue?: number, paymentNetValue?: number, paymentDiscount?: number) {
  try {
    // Check if receivable already exists for this purchase
    const { data: existing } = await supabase
      .from("financial_receivables")
      .select("id")
      .eq("notes", `public_service_purchase:${purchase.id}`)
      .limit(1);

    if (existing?.length) {
      console.log(`[Asaas Webhook] Receivable already exists for public purchase ${purchase.id}`);
      return;
    }

    // Get service name
    let serviceName = purchase.menu_key || "Módulo Extra";
    if (purchase.service_catalog_id) {
      const { data: catalog } = await supabase
        .from("service_catalog")
        .select("name")
        .eq("id", purchase.service_catalog_id)
        .single();
      if (catalog?.name) serviceName = catalog.name;
    }

    const grossAmount = (purchase.amount_cents || 0) / 100;
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toISOString().substring(0, 7);

    // Calculate fee (difference between gross and net) 
    const feeAmount = paymentValue && paymentNetValue ? paymentValue - paymentNetValue : 0;
    // Discount from Asaas (antecipation discount or payment discount)
    const discountAmount = paymentDiscount || 0;
    // Net paid amount
    const paidAmount = paymentNetValue || grossAmount;

    await supabase.from("financial_receivables").insert({
      company_id: purchase.company_id || null,
      description: `Venda Online: ${serviceName} - ${purchase.buyer_name}`,
      amount: grossAmount,
      due_date: today,
      paid_date: today,
      paid_amount: paidAmount,
      status: "paid",
      payment_method: "pix",
      fee_amount: feeAmount > 0 ? feeAmount : 0,
      discount_amount: discountAmount > 0 ? discountAmount : 0,
      reference_month: currentMonth,
      custom_receiver_name: !purchase.company_id ? purchase.buyer_name : null,
      notes: `public_service_purchase:${purchase.id}`,
    });

    console.log(`[Asaas Webhook] Created financial_receivable for public purchase ${purchase.id}: R$${grossAmount} (fee: R$${feeAmount.toFixed(2)}, discount: R$${discountAmount.toFixed(2)}, net: R$${paidAmount.toFixed(2)})`);

    // Also credit the Asaas bank account
    const netCents = Math.round(paidAmount * 100);
    if (netCents > 0) {
      // Find Asaas bank
      const { data: banks } = await supabase
        .from("financial_banks")
        .select("id")
        .eq("name", "Asaas")
        .eq("is_active", true)
        .limit(1);

      if (banks?.length) {
        // Check dedup
        const { data: existingTx } = await supabase
          .from("financial_bank_transactions")
          .select("id")
          .eq("reference_id", purchase.id)
          .eq("reference_type", "public_purchase")
          .eq("type", "credit")
          .limit(1);

        if (!existingTx?.length) {
          await supabase.rpc("increment_bank_balance", { p_bank_id: banks[0].id, p_amount: netCents });
          await supabase.from("financial_bank_transactions").insert({
            bank_id: banks[0].id,
            type: "credit",
            amount_cents: netCents,
            description: `Venda Online: ${serviceName} - ${purchase.buyer_name} (taxa R$${feeAmount.toFixed(2)} deduzida)`,
            reference_type: "public_purchase",
            reference_id: purchase.id,
          });
          console.log(`[Asaas Webhook] Credited Asaas bank: ${netCents} cents for public purchase ${purchase.id}`);
        }
      }
    }
  } catch (err) {
    console.error("[Asaas Webhook] Error creating receivable for public purchase:", err);
  }
}
