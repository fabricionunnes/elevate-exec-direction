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
      .select("id, description, amount_cents, due_date, installment_number, total_installments, paid_at, paid_amount_cents, recurring_charge_id, company_id")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      console.error("[notify-payment-confirmed] Invoice not found:", invErr);
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    if (!customerPhone) {
      console.log("[notify-payment-confirmed] No phone found, skipping WhatsApp");
      return new Response(JSON.stringify({ skipped: true, reason: "no_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp instance
    const { data: whatsappInstance } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_key, instance_name, is_default")
      .eq("status", "connected")
      .order("is_default", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (!whatsappInstance?.api_url || !whatsappInstance?.api_key) {
      console.log("[notify-payment-confirmed] No WhatsApp instance, skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "no_whatsapp" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format message
    const amountPaid = (invoice.paid_amount_cents || invoice.amount_cents) / 100;
    const amountFormatted = amountPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dueFormatted = invoice.due_date ? invoice.due_date.split("-").reverse().join("/") : "";
    const paidAtFormatted = invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR");

    const installmentInfo = invoice.total_installments > 1
      ? `\n📋 *Parcela:* ${invoice.installment_number}/${invoice.total_installments}`
      : "";

    const message = `✅ *Pagamento Confirmado!*\n\nOlá ${companyName}! 👋\n\nConfirmamos o recebimento do seu pagamento:\n\n📄 *${invoice.description || "Fatura"}*\n💰 *Valor:* ${amountFormatted}${installmentInfo}\n📅 *Vencimento:* ${dueFormatted}\n🗓️ *Pago em:* ${paidAtFormatted}\n\nObrigado pelo pagamento! ✨`;

    const formattedPhone = customerPhone.startsWith("55") ? customerPhone : `55${customerPhone}`;

    const sendResponse = await fetch(
      `${whatsappInstance.api_url}/message/sendText/${whatsappInstance.instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: whatsappInstance.api_key,
        },
        body: JSON.stringify({ number: formattedPhone, text: message }),
      }
    );

    if (sendResponse.ok) {
      console.log(`[notify-payment-confirmed] WhatsApp sent to ${formattedPhone} for invoice ${invoice_id}`);
    } else {
      console.error("[notify-payment-confirmed] WhatsApp send failed:", await sendResponse.text());
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
