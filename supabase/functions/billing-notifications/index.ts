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

    // 2. Calculate all target dates from rules to narrow invoice query
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const targetDates = new Set<string>();
    for (const rule of rules) {
      const d = new Date(today);
      if (rule.trigger_type === "before") {
        d.setDate(d.getDate() + rule.days_offset);
      } else if (rule.trigger_type === "on_due") {
        // d is already today
      } else {
        d.setDate(d.getDate() - rule.days_offset);
      }
      targetDates.add(d.toISOString().split("T")[0]);
    }

    const targetDatesArray = [...targetDates];
    console.log(`[billing-notifications] Target dates: ${targetDatesArray.join(", ")}`);

    // 3. Get WhatsApp instances
    const { data: whatsappInstances } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_key, instance_name, is_default")
      .eq("status", "connected");

    const instanceMap = new Map(
      (whatsappInstances || []).map((i: any) => [i.instance_name, i])
    );

    if (instanceMap.size === 0) {
      return new Response(
        JSON.stringify({ sent: 0, error: "No WhatsApp instance connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Load ONLY invoices matching target dates
    const { data: invoices, error: invError } = await supabase
      .from("company_invoices")
      .select(`
        id, amount_cents, description, due_date, status,
        payment_link_url, daily_interest_percent, late_fee_percent,
        late_fee_cents, interest_cents, installment_number,
        total_installments, company_id, recurring_charge_id, send_whatsapp
      `)
      .in("status", ["pending", "overdue"])
      .in("due_date", targetDatesArray)
      .neq("send_whatsapp", false);

    if (invError) throw invError;
    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No matching invoices for target dates" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[billing-notifications] Found ${invoices.length} invoices matching target dates`);

    // 4b. Try to fetch Asaas payment links for invoices missing one (limited)
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
    if (ASAAS_API_KEY) {
      const needsLink = invoices.filter(
        (inv: any) => (!inv.payment_link_url || !inv.payment_link_url.includes("asaas")) && inv.recurring_charge_id
      );
      
      // Process max 10 to avoid timeout
      for (const inv of needsLink.slice(0, 10)) {
        try {
          const { data: charge } = await supabase
            .from("company_recurring_charges")
            .select("pagarme_plan_id, asaas_account_id")
            .eq("id", inv.recurring_charge_id)
            .single();

          // Resolve the correct API key for this charge's Asaas account
          let apiKeyToUse = ASAAS_API_KEY;
          if (charge?.asaas_account_id) {
            const { data: account } = await supabase
              .from("asaas_accounts")
              .select("api_key_secret_name")
              .eq("id", charge.asaas_account_id)
              .single();
            if (account?.api_key_secret_name) {
              const resolvedKey = Deno.env.get(account.api_key_secret_name);
              if (resolvedKey) apiKeyToUse = resolvedKey;
            }
          }

          if (charge?.pagarme_plan_id) {
            const subsResp = await fetch(
              `https://api.asaas.com/v3/subscriptions/${charge.pagarme_plan_id}/payments?status=PENDING&dueDate=${inv.due_date}`,
              { headers: { "access_token": apiKeyToUse } }
            );
            if (subsResp.ok) {
              const subsData = await subsResp.json();
              const payment = subsData.data?.[0];
              if (payment?.invoiceUrl) {
                inv.payment_link_url = payment.invoiceUrl;
                await supabase.from("company_invoices")
                  .update({ payment_link_url: payment.invoiceUrl })
                  .eq("id", inv.id);
              }
            } else {
              await subsResp.text(); // consume body
            }
          }
        } catch (e) {
          console.error(`[billing-notifications] Error fetching Asaas URL for invoice ${inv.id}:`, e);
        }
      }
    }

    // 5. Load companies for phone + name
    const companyIds = [...new Set(invoices.map((i: any) => i.company_id))];
    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name, phone, email")
      .in("id", companyIds);

    const companyMap = new Map(
      (companies || []).map((c: any) => [c.id, c])
    );

    // 6. Check already sent today to avoid duplicates
    const { data: sentToday } = await supabase
      .from("billing_notification_logs")
      .select("rule_id, invoice_id")
      .gte("sent_at", todayStr + "T00:00:00")
      .eq("status", "sent");

    const sentKeys = new Set(
      (sentToday || []).map((s: any) => `${s.rule_id}:${s.invoice_id}`)
    );

    let totalSent = 0;
    const sendQueue: any[] = [];

    for (const rule of rules) {
      let targetDate: string;
      const d = new Date(today);

      if (rule.trigger_type === "before") {
        d.setDate(d.getDate() + rule.days_offset);
        targetDate = d.toISOString().split("T")[0];
      } else if (rule.trigger_type === "on_due") {
        targetDate = todayStr;
      } else {
        d.setDate(d.getDate() - rule.days_offset);
        targetDate = d.toISOString().split("T")[0];
      }

      const matchingInvoices = invoices.filter((inv: any) => inv.due_date === targetDate);

      for (const invoice of matchingInvoices) {
        if (sentKeys.has(`${rule.id}:${invoice.id}`)) continue;

        const company = companyMap.get(invoice.company_id);
        if (!company?.phone) continue;

        const cleanPhone = company.phone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) continue;
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        const instanceName = rule.whatsapp_instance_name || "financeirounv";
        const whatsappInstance = instanceMap.get(instanceName) || instanceMap.values().next().value;
        if (!whatsappInstance?.api_url || !whatsappInstance?.api_key) continue;

        const message = buildMessage(rule, invoice, company, today);

        sendQueue.push({
          rule, invoice, company, formattedPhone, message,
          instanceName: whatsappInstance.instance_name,
          apiUrl: whatsappInstance.api_url,
          apiKey: whatsappInstance.api_key,
        });
      }
    }

    console.log(`[billing-notifications] Queue: ${sendQueue.length} messages to send`);

    // Send in parallel batches of 5, with 10s timeout each
    const BATCH_SIZE = 5;
    const TIMEOUT_MS = 10000;

    for (let i = 0; i < sendQueue.length; i += BATCH_SIZE) {
      const batch = sendQueue.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
          try {
            const resp = await fetch(
              `${item.apiUrl}/message/sendText/${item.instanceName}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: item.apiKey },
                body: JSON.stringify({ number: item.formattedPhone, text: item.message }),
                signal: controller.signal,
              }
            );
            clearTimeout(timeout);
            const body = await resp.text();
            return { ...item, ok: resp.ok, body };
          } catch (e: any) {
            clearTimeout(timeout);
            return { ...item, ok: false, body: e?.message || "timeout" };
          }
        })
      );

      for (const r of results) {
        const val = r.status === "fulfilled" ? r.value : { ...batch[0], ok: false, body: "rejected" };
        if (val.ok) {
          totalSent++;
          console.log(`[billing-notifications] ✓ Sent to ${val.company.name} (${val.formattedPhone})`);
        } else {
          console.error(`[billing-notifications] ✗ Failed ${val.formattedPhone}: ${val.body}`);
        }
        await supabase.from("billing_notification_logs").insert({
          rule_id: val.rule.id,
          invoice_id: val.invoice.id,
          company_id: val.invoice.company_id,
          phone: val.formattedPhone,
          message_sent: val.message,
          status: val.ok ? "sent" : "failed",
        });
      }
    }

    console.log(`[billing-notifications] Total sent: ${totalSent}/${sendQueue.length}`);

    return new Response(
      JSON.stringify({ sent: totalSent, total: sendQueue.length }),
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

  let interestAmount = 0;
  let lateFeeAmount = 0;
  let totalUpdated = invoice.amount_cents;

  if (today > dueDate) {
    const daysLate = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyInterest = invoice.daily_interest_percent || 0.033;
    interestAmount = Math.round(
      invoice.amount_cents * (dailyInterest / 100) * daysLate
    );
    const lateFeePercent = invoice.late_fee_percent || 2;
    lateFeeAmount = Math.round(invoice.amount_cents * (lateFeePercent / 100));
    totalUpdated = invoice.amount_cents + interestAmount + lateFeeAmount;
  }

  const discountPercent = 5;
  const discountAmount = Math.round(invoice.amount_cents * (discountPercent / 100));
  const totalWithDiscount = invoice.amount_cents - discountAmount;

  const formatBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const parcela = "";

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
