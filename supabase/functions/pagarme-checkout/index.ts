import { createClient } from "@supabase/supabase-js";

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
    const PAGARME_API_KEY = Deno.env.get("PAGARME_API_KEY");
    if (!PAGARME_API_KEY) {
      throw new Error("PAGARME_API_KEY not configured");
    }

    // Debug: log key info (prefix only, never full key)
    console.log("Pagar.me key info:", {
      length: PAGARME_API_KEY.length,
      prefix: PAGARME_API_KEY.substring(0, 8),
      hasColon: PAGARME_API_KEY.includes(":"),
    });

    const body = await req.json();

    // If test mode, just validate the key
    if (body.test_key === true) {
      const testResp = await fetch("https://api.pagar.me/core/v5/orders?size=1", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(PAGARME_API_KEY + ":")}`,
        },
      });
      const testData = await testResp.json();
      return new Response(
        JSON.stringify({
          key_valid: testResp.ok,
          status: testResp.status,
          key_length: PAGARME_API_KEY.length,
          key_prefix: PAGARME_API_KEY.substring(0, 8),
          response_preview: JSON.stringify(testData).substring(0, 200),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_id,
      product_name,
      amount_cents,
      payment_method,
      installments = 1,
      card_token,
      card_number,
      card_expiry,
      card_cvv,
      card_holder,
      payment_link_id,
    } = body;

    // Validate required fields
    if (!customer_name || !customer_email || !product_id || !amount_cents || !payment_method) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Pagar.me order payload
    const nameParts = customer_name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const customer: Record<string, unknown> = {
      name: customer_name,
      email: customer_email,
      type: "individual",
    };

    if (customer_phone) {
      const cleanPhone = customer_phone.replace(/\D/g, "");
      customer.phones = {
        mobile_phone: {
          country_code: "55",
          area_code: cleanPhone.substring(0, 2),
          number: cleanPhone.substring(2),
        },
      };
    }

    if (customer_document) {
      customer.document = customer_document.replace(/\D/g, "");
      customer.document_type = customer.document.length > 11 ? "CNPJ" : "CPF";
    }

    // Build payment object based on method
    let payment: Record<string, unknown> = {};

    if (payment_method === "credit_card") {
      if (card_token) {
        // Tokenized card flow
        payment = {
          payment_method: "credit_card",
          credit_card: {
            installments,
            card_token,
            statement_descriptor: "UNV",
            card: {
              billing_address: {
                line_1: "N/A",
                zip_code: "00000000",
                city: "São Paulo",
                state: "SP",
                country: "BR",
              },
            },
          },
        };
      } else if (card_number && card_expiry && card_cvv && card_holder) {
        // Raw card data flow
        const [expMonth, expYear] = (card_expiry || "").split("/");
        payment = {
          payment_method: "credit_card",
          credit_card: {
            installments,
            statement_descriptor: "UNV",
            card: {
              number: card_number.replace(/\s/g, ""),
              holder_name: card_holder,
              exp_month: parseInt(expMonth, 10),
              exp_year: parseInt(expYear, 10),
              cvv: card_cvv,
              billing_address: {
                line_1: "N/A",
                zip_code: "00000000",
                city: "São Paulo",
                state: "SP",
                country: "BR",
              },
            },
          },
        };
      } else {
        return new Response(
          JSON.stringify({ error: "Dados do cartão são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (payment_method === "pix") {
      payment = {
        payment_method: "pix",
        pix: {
          expires_in: 3600, // 1 hour
        },
      };
    } else if (payment_method === "boleto") {
      payment = {
        payment_method: "boleto",
        boleto: {
          instructions: `Pagamento referente a ${product_name}`,
          due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          document_number: "0001",
          type: "DM",
        },
      };
    }

    // Create order on Pagar.me
    const pagarmeResponse = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(PAGARME_API_KEY + ":")}`,
      },
      body: JSON.stringify({
        items: [
          {
            amount: amount_cents,
            description: product_name,
            quantity: 1,
            code: product_id,
          },
        ],
        customer,
        payments: [{ ...payment, amount: amount_cents }],
      }),
    });

    const pagarmeData = await pagarmeResponse.json();

    if (!pagarmeResponse.ok) {
      console.error("Pagar.me error:", JSON.stringify(pagarmeData));
      return new Response(
        JSON.stringify({
          error: "Erro ao processar pagamento",
          details: pagarmeData.message || pagarmeData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract charge info
    const charge = pagarmeData.charges?.[0];
    const lastTransaction = charge?.last_transaction;

    // Save order to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderData: Record<string, unknown> = {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_id,
      product_name,
      amount_cents,
      payment_method,
      installments,
      status: charge?.status === "paid" ? "paid" : "pending",
      pagarme_order_id: pagarmeData.id,
      pagarme_charge_id: charge?.id,
      payment_link_id: payment_link_id || null,
    };

    // Add PIX data
    if (payment_method === "pix" && lastTransaction) {
      orderData.pix_qr_code = lastTransaction.qr_code;
      orderData.pix_qr_code_url = lastTransaction.qr_code_url;
      orderData.pix_expires_at = lastTransaction.expires_at;
    }

    // Add boleto data
    if (payment_method === "boleto" && lastTransaction) {
      orderData.boleto_url = lastTransaction.url;
      orderData.boleto_barcode = lastTransaction.barcode;
      orderData.boleto_due_date = lastTransaction.due_at;
    }

    await supabase.from("pagarme_orders").insert(orderData);

    // If payment is immediately confirmed (credit card) and linked to an invoice, mark it as paid
    if (charge?.status === "paid" && payment_link_id) {
      const { error: invoiceError } = await supabase
        .from("company_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_amount_cents: amount_cents,
        })
        .eq("payment_link_id", payment_link_id);

      if (invoiceError) {
        console.error("Error updating invoice status:", invoiceError);
      } else {
        console.log(`Invoice with payment_link_id ${payment_link_id} marked as paid`);

        // Check if this was the last installment and auto-renew
        const { data: paidInvoice } = await supabase
          .from("company_invoices")
          .select("recurring_charge_id, installment_number, total_installments")
          .eq("payment_link_id", payment_link_id)
          .single();

        if (paidInvoice?.recurring_charge_id && paidInvoice.installment_number === paidInvoice.total_installments) {
          console.log(`Last installment paid, triggering auto-renew for ${paidInvoice.recurring_charge_id}`);
          await supabase.functions.invoke("generate-invoices", {
            body: { action: "auto_renew", recurring_charge_id: paidInvoice.recurring_charge_id },
          });
        }
      }
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      order_id: pagarmeData.id,
      status: charge?.status,
      payment_method,
    };

    if (payment_method === "pix") {
      response.pix_qr_code = lastTransaction?.qr_code;
      response.pix_qr_code_url = lastTransaction?.qr_code_url;
      response.pix_expires_at = lastTransaction?.expires_at;
    }

    if (payment_method === "boleto") {
      response.boleto_url = lastTransaction?.url;
      response.boleto_barcode = lastTransaction?.barcode;
    }

    if (payment_method === "credit_card") {
      response.paid = charge?.status === "paid";
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
