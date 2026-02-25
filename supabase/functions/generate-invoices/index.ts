import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBLISHED_URL = "https://elevate-exec-direction.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { recurring_charge_id, company_id, action } = await req.json();

    // Action: generate invoices for a recurring charge
    if (action === "generate" && recurring_charge_id) {
      const { data: charge, error } = await supabase
        .from("company_recurring_charges")
        .select("*")
        .eq("id", recurring_charge_id)
        .single();

      if (error || !charge) throw new Error("Cobrança recorrente não encontrada");

      // Determine number of invoices to generate based on recurrence
      let numInvoices = 12; // monthly = 12
      if (charge.recurrence === "quarterly") numInvoices = 4;
      if (charge.recurrence === "yearly") numInvoices = 1;

      const startDate = new Date(charge.next_charge_date + "T12:00:00");
      const invoices = [];

      for (let i = 0; i < numInvoices; i++) {
        const dueDate = new Date(startDate);
        if (charge.recurrence === "monthly") {
          dueDate.setMonth(dueDate.getMonth() + i);
        } else if (charge.recurrence === "quarterly") {
          dueDate.setMonth(dueDate.getMonth() + i * 3);
        } else if (charge.recurrence === "yearly") {
          dueDate.setFullYear(dueDate.getFullYear() + i);
        }

        const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;

        invoices.push({
          company_id: charge.company_id,
          recurring_charge_id: charge.id,
          description: charge.description,
          amount_cents: charge.amount_cents,
          due_date: dueDateStr,
          status: "pending",
          payment_method: charge.payment_method,
          installment_number: i + 1,
          total_installments: numInvoices,
          late_fee_percent: 2.0,
          daily_interest_percent: 1.0,
        });
      }

      const { data: inserted, error: insertError } = await supabase
        .from("company_invoices")
        .insert(invoices)
        .select();

      if (insertError) throw insertError;

      // Generate payment links for each invoice
      for (const inv of inserted || []) {
        const encodedDesc = encodeURIComponent(inv.description);
        const paymentUrl = `${PUBLISHED_URL}/#/checkout?link_id=${inv.id}&amount=${inv.amount_cents}&product=${encodedDesc}`;
        const publicUrl = `${PUBLISHED_URL}/#/fatura?token=${inv.public_token}`;

        await supabase
          .from("company_invoices")
          .update({ payment_link_url: paymentUrl })
          .eq("id", inv.id);
      }

      return new Response(
        JSON.stringify({ success: true, count: inserted?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: update overdue status and calculate fees
    if (action === "update_fees") {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Get all pending invoices that are overdue
      const { data: overdueInvoices } = await supabase
        .from("company_invoices")
        .select("*")
        .eq("status", "pending")
        .lt("due_date", today);

      let updated = 0;
      for (const inv of overdueInvoices || []) {
        const dueDate = new Date(inv.due_date + "T12:00:00");
        const now = new Date();
        const daysLate = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (daysLate > 0) {
          // Multa moratória: 2% fixo
          const lateFee = Math.round(inv.amount_cents * (inv.late_fee_percent / 100));
          // Juros de mora: 1% por dia
          const interest = Math.round(inv.amount_cents * (inv.daily_interest_percent / 100) * daysLate);

          const totalWithFees = inv.amount_cents + lateFee + interest;
          await supabase
            .from("company_invoices")
            .update({
              status: "overdue",
              late_fee_cents: lateFee,
              interest_cents: interest,
              total_with_fees_cents: totalWithFees,
            })
            .eq("id", inv.id);

          updated++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: get invoices for a company (public by token or authenticated)
    if (action === "get_by_token") {
      const { token } = await req.json();
      const { data: invoice } = await supabase
        .from("company_invoices")
        .select("*")
        .eq("public_token", token)
        .single();

      return new Response(
        JSON.stringify({ invoice }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: cleanup future invoices when recurring charge is deactivated
    if (action === "cleanup_future_invoices" && recurring_charge_id) {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

      // Delete pending invoices with due_date > 30 days from now
      const { data: deleted, error: delError } = await supabase
        .from("company_invoices")
        .delete()
        .eq("recurring_charge_id", recurring_charge_id)
        .eq("status", "pending")
        .gt("due_date", cutoffStr)
        .select("id");

      const deletedCount = deleted?.length || 0;
      console.log(`Cleanup: deleted ${deletedCount} future invoices for recurring ${recurring_charge_id}`);

      if (delError) {
        console.error("Cleanup error:", delError);
      }

      return new Response(
        JSON.stringify({ success: true, deleted: deletedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate invoices error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
