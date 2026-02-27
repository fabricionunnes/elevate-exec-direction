import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Load active billing rules
    const { data: rules, error: rulesError } = await supabase
      .from("billing_notification_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No active rules" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get WhatsApp instance
    const { data: whatsappInstance } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_key, instance_name, is_default")
      .eq("status", "connected")
      .order("is_default", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (!whatsappInstance?.api_url || !whatsappInstance?.api_key) {
      return new Response(
        JSON.stringify({ sent: 0, error: "No WhatsApp instance connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Load all pending/overdue invoices with company info
    const { data: invoices, error: invError } = await supabase
      .from("company_invoices")
      .select(`
        id,
        amount_cents,
        description,
        due_date,
        status,
        payment_link_url,
        daily_interest_percent,
        late_fee_percent,
        late_fee_cents,
        interest_cents,
        installment_number,
        total_installments,
        company_id
      `)
      .in("status", ["pending", "overdue"]);

    if (invError) throw invError;
    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No pending invoices" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Load companies for phone + name
    const companyIds = [...new Set(invoices.map((i) => i.company_id))];
    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name, phone, email")
      .in("id", companyIds);

    const companyMap = new Map(
      (companies || []).map((c) => [c.id, c])
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    let totalSent = 0;

    for (const rule of rules) {
      // Calculate target date based on rule
      let targetDate: string;
      const d = new Date(today);

      if (rule.trigger_type === "before") {
        // We want invoices due in X days from now
        d.setDate(d.getDate() + rule.days_offset);
        targetDate = d.toISOString().split("T")[0];
      } else if (rule.trigger_type === "on_due") {
        targetDate = todayStr;
      } else {
        // after: invoices that were due X days ago
        d.setDate(d.getDate() - rule.days_offset);
        targetDate = d.toISOString().split("T")[0];
      }

      // Filter matching invoices
      const matchingInvoices = invoices.filter((inv) => inv.due_date === targetDate);

      for (const invoice of matchingInvoices) {
        const company = companyMap.get(invoice.company_id);
        if (!company?.phone) continue;

        const cleanPhone = company.phone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) continue;
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        // Build message from template
        const message = buildMessage(rule, invoice, company, today);

        // Send WhatsApp
        try {
          const sendResponse = await fetch(
            `${whatsappInstance.api_url}/message/sendText/${whatsappInstance.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: whatsappInstance.api_key,
              },
              body: JSON.stringify({
                number: formattedPhone,
                text: message,
              }),
            }
          );

          if (sendResponse.ok) {
            totalSent++;
            // Log
            await supabase.from("billing_notification_logs").insert({
              rule_id: rule.id,
              invoice_id: invoice.id,
              company_id: invoice.company_id,
              phone: formattedPhone,
              message_sent: message,
              status: "sent",
            });
          } else {
            const errText = await sendResponse.text();
            console.error(`Failed to send to ${formattedPhone}:`, errText);
            await supabase.from("billing_notification_logs").insert({
              rule_id: rule.id,
              invoice_id: invoice.id,
              company_id: invoice.company_id,
              phone: formattedPhone,
              message_sent: message,
              status: "failed",
            });
          }
        } catch (e) {
          console.error(`Error sending to ${formattedPhone}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("billing-notifications error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildMessage(
  rule: any,
  invoice: any,
  company: any,
  today: Date
): string {
  const amountBRL = (invoice.amount_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const dueDateParts = invoice.due_date.split("-");
  const dueDateFormatted = `${dueDateParts[2]}/${dueDateParts[1]}/${dueDateParts[0]}`;
  const dueDate = new Date(invoice.due_date + "T00:00:00");

  // Calculate interest and late fees
  let interestAmount = 0;
  let lateFeeAmount = 0;
  let totalUpdated = invoice.amount_cents;

  if (today > dueDate) {
    const daysLate = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Daily interest (default 1% / 30 = ~0.033% per day)
    const dailyInterest = invoice.daily_interest_percent || 0.033;
    interestAmount = Math.round(
      invoice.amount_cents * (dailyInterest / 100) * daysLate
    );

    // Late fee (default 2%)
    const lateFeePercent = invoice.late_fee_percent || 2;
    lateFeeAmount = Math.round(invoice.amount_cents * (lateFeePercent / 100));

    totalUpdated = invoice.amount_cents + interestAmount + lateFeeAmount;
  }

  // Calculate discount (5% if paying early)
  const discountPercent = 5;
  const discountAmount = Math.round(invoice.amount_cents * (discountPercent / 100));
  const totalWithDiscount = invoice.amount_cents - discountAmount;

  const formatBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const parcela =
    invoice.total_installments && invoice.total_installments > 1
      ? `${invoice.installment_number || 1}/${invoice.total_installments}`
      : "";

  let msg = rule.message_template;
  msg = msg.replace(/\{\{nome_cliente\}\}/g, company.name || "");
  msg = msg.replace(/\{\{valor\}\}/g, amountBRL);
  msg = msg.replace(/\{\{vencimento\}\}/g, dueDateFormatted);
  msg = msg.replace(/\{\{descricao\}\}/g, invoice.description || "Fatura");
  msg = msg.replace(/\{\{link_pagamento\}\}/g, invoice.payment_link_url || "");
  msg = msg.replace(/\{\{juros\}\}/g, formatBRL(interestAmount));
  msg = msg.replace(/\{\{multa\}\}/g, formatBRL(lateFeeAmount));
  msg = msg.replace(/\{\{total_atualizado\}\}/g, formatBRL(totalUpdated));
  msg = msg.replace(/\{\{desconto\}\}/g, formatBRL(discountAmount));
  msg = msg.replace(/\{\{total_com_desconto\}\}/g, formatBRL(totalWithDiscount));
  msg = msg.replace(/\{\{parcela\}\}/g, parcela);

  return msg;
}
