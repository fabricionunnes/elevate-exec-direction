// Exclui um pagamento no Asaas (DELETE /payments/{id}).
// Uso: invocar com { payment_ids: string[] } ou { invoice_ids: string[] } (busca pagarme_charge_id).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function deleteAsaasPayment(paymentId: string, apiKey: string) {
  const r = await fetch(`${ASAAS_BASE}/payments/${paymentId}`, {
    method: "DELETE",
    headers: { access_token: apiKey, "Content-Type": "application/json" },
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  // 404 = já não existe; tratamos como sucesso idempotente
  if (!r.ok && r.status !== 404) {
    return { ok: false, status: r.status, body };
  }
  return { ok: true, status: r.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "ASAAS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let paymentIds: string[] = Array.isArray(body.payment_ids) ? body.payment_ids.filter(Boolean) : [];
    const invoiceIds: string[] = Array.isArray(body.invoice_ids) ? body.invoice_ids.filter(Boolean) : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (invoiceIds.length > 0) {
      const { data } = await supabase
        .from("company_invoices")
        .select("id, pagarme_charge_id")
        .in("id", invoiceIds);
      const extra = (data || []).map((r: any) => r.pagarme_charge_id).filter(Boolean);
      paymentIds = Array.from(new Set([...paymentIds, ...extra]));
    }

    const results: any[] = [];
    for (const pid of paymentIds) {
      try {
        const res = await deleteAsaasPayment(pid, ASAAS_API_KEY);
        results.push({ payment_id: pid, ...res });
      } catch (e: any) {
        results.push({ payment_id: pid, ok: false, error: e.message });
      }
    }

    const deleted = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return new Response(JSON.stringify({ ok: true, deleted, failed_count: failed.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
