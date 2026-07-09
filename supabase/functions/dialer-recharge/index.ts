// dialer-recharge: cria uma recarga da carteira do discador via Asaas (PIX). O webhook credita ao pagar.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  const resp = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${resp.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // resolve a chave do Asaas (conta default), com fallback pro env
    let apiKey = Deno.env.get("ASAAS_API_KEY") || "";
    const { data: acc } = await supabase.from("asaas_accounts").select("api_key_secret_name").eq("is_default", true).eq("is_active", true).maybeSingle();
    if (acc?.api_key_secret_name) {
      const fromSecret = Deno.env.get(acc.api_key_secret_name);
      if (fromSecret) apiKey = fromSecret;
    }
    if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const tenantId: string = body.tenantId;
    const amount = Number(body.amount);
    if (!tenantId) throw new Error("tenantId é obrigatório");
    if (!amount || amount < 5) throw new Error("Valor mínimo de recarga: R$ 5,00");

    // resolve o cliente Asaas
    const { data: tenant } = await supabase.from("whitelabel_tenants").select("name, asaas_customer_id").eq("id", tenantId).maybeSingle();
    let customerId: string | null = body.asaasCustomerId || tenant?.asaas_customer_id || null;
    if (!customerId) {
      const cpfCnpj = (body.cpfCnpj || "").replace(/\D/g, "");
      if (!cpfCnpj) throw new Error("Cliente Asaas não configurado. Informe cpfCnpj (e nome/email) para criar.");
      const found = await asaasRequest(`/customers?cpfCnpj=${cpfCnpj}`, "GET", apiKey);
      if (found?.data?.length) customerId = found.data[0].id;
      else {
        const created = await asaasRequest("/customers", "POST", apiKey, {
          name: body.name || tenant?.name || "Cliente Discador",
          cpfCnpj, email: body.email || undefined, mobilePhone: body.phone || undefined,
        });
        customerId = created.id;
      }
      if (customerId) await supabase.from("whitelabel_tenants").update({ asaas_customer_id: customerId }).eq("id", tenantId);
    }

    // cria o registro da recarga (pra mapear no webhook)
    const { data: recharge, error: rErr } = await supabase.from("dialer_recharges")
      .insert({ tenant_id: tenantId, amount, status: "pending", created_by: body.createdBy || null })
      .select("id").single();
    if (rErr) throw rErr;
    const rechargeId = recharge.id;

    // cria a cobrança PIX no Asaas
    const today = new Date();
    const due = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const payment = await asaasRequest("/payments", "POST", apiKey, {
      customer: customerId,
      billingType: "PIX",
      value: amount,
      dueDate: due,
      description: `Recarga discador — ${tenant?.name || tenantId}`,
      externalReference: `dialer_recharge:${rechargeId}`,
    });

    let pixPayload: string | null = null;
    let pixImage: string | null = null;
    try {
      const pix = await asaasRequest(`/payments/${payment.id}/pixQrCode`, "GET", apiKey);
      pixPayload = pix.payload || null;
      pixImage = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null;
    } catch (_e) { /* sem QR ainda */ }

    const invoiceUrl = payment.invoiceUrl || (payment.id ? `https://www.asaas.com/i/${payment.id}` : null);
    await supabase.from("dialer_recharges").update({
      asaas_payment_id: payment.id, invoice_url: invoiceUrl, pix_payload: pixPayload,
    }).eq("id", rechargeId);

    return new Response(JSON.stringify({
      ok: true, rechargeId, asaasPaymentId: payment.id, amount,
      invoiceUrl, pixPayload, pixQrCodeImage: pixImage,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
