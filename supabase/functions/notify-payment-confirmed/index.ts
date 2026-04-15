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
    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch invoice with company info
    const { data: invoice, error: invErr } = await supabase
      .from("company_invoices")
      .select("id, description, amount_cents, due_date, installment_number, total_installments, paid_at, paid_amount_cents, recurring_charge_id, company_id, bank_id")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      console.error("[notify-payment-confirmed] Invoice not found:", invErr);
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedDescription = (invoice.description || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (normalizedDescription.includes("mansao empreendedora")) {
      console.log(`[notify-payment-confirmed] Notifications skipped for invoice ${invoice_id} (${invoice.description})`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "notifications_disabled_for_mansao_empreendedora" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get bank name if available
    let bankName = "";
    if (invoice.bank_id) {
      const { data: bank } = await supabase
        .from("financial_banks")
        .select("name")
        .eq("id", invoice.bank_id)
        .single();
      if (bank) bankName = bank.name;
    }

    // Get company info (name, phone, email)
    let companyName = "";
    let customerPhone = "";

    if (invoice.company_id) {
      const { data: company } = await supabase
        .from("onboarding_companies")
        .select("name, phone, email")
        .eq("id", invoice.company_id)
        .single();

      if (company) {
        companyName = company.name || "";
        customerPhone = (company.phone || "").replace(/\D/g, "");
      }
    }

    // If no phone from company, try recurring charge customer_phone
    if (!customerPhone && invoice.recurring_charge_id) {
      const { data: rc } = await supabase
        .from("company_recurring_charges")
        .select("customer_phone, customer_name")
        .eq("id", invoice.recurring_charge_id)
        .single();

      if (rc?.customer_phone) {
        customerPhone = rc.customer_phone.replace(/\D/g, "");
      }
      if (!companyName && rc?.customer_name) {
        companyName = rc.customer_name;
      }
    }

    // Format message values
    // For customer message: show original invoice amount (what the customer paid)
    // For internal message: show net amount received (after fees)
    const customerAmount = invoice.amount_cents / 100;
    const customerAmountFormatted = customerAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const netAmount = (invoice.paid_amount_cents || invoice.amount_cents) / 100;
    const netAmountFormatted = netAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dueFormatted = invoice.due_date ? invoice.due_date.split("-").reverse().join("/") : "";
    const paidAtFormatted = invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR");

    // --- Send internal notification to fixed number via "Financeiro UNV" instance ---
    try {
      const NOTIFY_PHONE = "5531989840003";

      // Find the "financeiro-unv" WhatsApp instance
      // Allow sending regardless of local status (connected/connecting) - delegate validation to server
      const { data: finInstance } = await supabase
        .from("whatsapp_instances")
        .select("api_url, api_key, instance_name")
        .eq("instance_name", "financeirounv")
        .maybeSingle();

      if (finInstance?.api_url && finInstance?.api_key) {
        const bankInfo = bankName ? `\n🏦 *Banco:* ${bankName}` : "";
        const internalMsg = `💰 *Pagamento Recebido!*\n\n🏢 *Empresa:* ${companyName || "N/A"}\n📄 *Descrição:* ${invoice.description || "Mensalidade"}\n💵 *Valor líquido:* ${netAmountFormatted}${bankInfo}\n📅 *Pago em:* ${paidAtFormatted}`;

        const intResponse = await fetch(
          `${finInstance.api_url}/message/sendText/${finInstance.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: finInstance.api_key },
            body: JSON.stringify({ number: NOTIFY_PHONE, text: internalMsg }),
          }
        );

        if (intResponse.ok) {
          console.log(`[notify-payment-confirmed] Internal WhatsApp sent to ${NOTIFY_PHONE} via financeiro-unv`);
        } else {
          console.error("[notify-payment-confirmed] Internal WhatsApp send failed:", await intResponse.text());
        }
      } else {
        console.log("[notify-payment-confirmed] financeiro-unv instance not found or not connected, skipping internal notification");
      }
    } catch (intErr) {
      console.error("[notify-payment-confirmed] Error sending internal WhatsApp notification:", intErr);
    }

    // --- Send customer notification ---
    if (!customerPhone) {
      console.log("[notify-payment-confirmed] No phone found, skipping customer WhatsApp");
    } else {
      // Get default WhatsApp instance from config
      const { data: defaultConfig } = await supabase
        .from("whatsapp_default_config")
        .select("setting_value")
        .eq("setting_key", "default_instance")
        .maybeSingle();

      const defaultInstanceName = defaultConfig?.setting_value || "financeirounv";

      // Allow sending regardless of local status - delegate validation to server
      const { data: whatsappInstance } = await supabase
        .from("whatsapp_instances")
        .select("api_url, api_key, instance_name")
        .eq("instance_name", defaultInstanceName)
        .maybeSingle();

      if (whatsappInstance?.api_url && whatsappInstance?.api_key) {
        const message = `✅ *Pagamento Confirmado!*\n\nOlá ${companyName}! 👋\n\nConfirmamos o recebimento do seu pagamento:\n\n📄 *${invoice.description || "Mensalidade"}*\n📅 *Vencimento:* ${dueFormatted}\n🗓️ *Pago em:* ${paidAtFormatted}\n\nObrigado pelo pagamento! ✨`;

        const formattedPhone = customerPhone.startsWith("55") ? customerPhone : `55${customerPhone}`;

        const sendResponse = await fetch(
          `${whatsappInstance.api_url}/message/sendText/${whatsappInstance.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: whatsappInstance.api_key },
            body: JSON.stringify({ number: formattedPhone, text: message }),
          }
        );

        if (sendResponse.ok) {
          console.log(`[notify-payment-confirmed] WhatsApp sent to ${formattedPhone} for invoice ${invoice_id}`);
        } else {
          console.error("[notify-payment-confirmed] WhatsApp send failed:", await sendResponse.text());
        }
      }
    }


    // Send internal notifications to staff with receivables access
    try {
      // Get master/admin staff
      const { data: masterStaff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("is_active", true)
        .in("role", ["master", "admin"]);

      // Get staff with fin_receivables_view permission
      const { data: permStaff } = await supabase
        .from("staff_financial_permissions")
        .select("staff_id")
        .eq("permission_key", "fin_receivables_view");

      const staffIds = new Set<string>();
      (masterStaff || []).forEach((s: any) => staffIds.add(s.id));
      (permStaff || []).forEach((s: any) => staffIds.add(s.staff_id));

      if (staffIds.size > 0) {
        const title = `💰 Pagamento confirmado: ${companyName}`;
        const notifMessage = `Pagamento de ${netAmountFormatted} confirmado - ${invoice.description || "Mensalidade"} para ${companyName}.`;

        const notifications = Array.from(staffIds).map(staffId => ({
          staff_id: staffId,
          type: "payment_confirmed",
          title,
          message: notifMessage,
        }));

        await supabase.from("onboarding_notifications").insert(notifications);
        console.log(`[notify-payment-confirmed] Internal notifications sent to ${staffIds.size} staff`);
      }
    } catch (notifErr) {
      console.error("[notify-payment-confirmed] Error sending internal notifications:", notifErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-payment-confirmed] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
