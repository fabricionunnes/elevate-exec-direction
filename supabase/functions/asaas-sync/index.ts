// Sincronização periódica com Asaas: busca pagamentos RECEIVED/CONFIRMED dos últimos N dias
// e replay via asaas-webhook (idempotente). Detecta divergências e envia alerta WhatsApp.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasGet(path: string, apiKey: string) {
  const r = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: apiKey, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Asaas ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Number(body.days ?? 7);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    let offset = 0;
    const limit = 100;
    let processed = 0;
    let credited = 0;
    let skipped = 0;
    let divergences: any[] = [];
    let errors: any[] = [];

    while (true) {
      const data = await asaasGet(
        `/payments?status=RECEIVED&paymentDateGe=${since}&limit=${limit}&offset=${offset}`,
        ASAAS_API_KEY,
      );
      const data2 = await asaasGet(
        `/payments?status=CONFIRMED&paymentDateGe=${since}&limit=${limit}&offset=${offset}`,
        ASAAS_API_KEY,
      );
      const payments = [...(data.data || []), ...(data2.data || [])];
      if (!payments.length) break;

      for (const payment of payments) {
        processed++;
        try {
          // Detect divergence vs invoice
          const { data: inv } = await supabase
            .from("company_invoices")
            .select("id, amount_cents, paid_amount_cents, status, discount_cents, payment_fee_cents")
            .eq("pagarme_charge_id", payment.id)
            .maybeSingle();

          const replay = await supabase.functions.invoke("asaas-webhook", {
            body: {
              event: payment.status === "RECEIVED" ? "PAYMENT_RECEIVED" : "PAYMENT_CONFIRMED",
              payment,
            },
          });

          const result = replay.data || {};
          if (result.deduplicated || result.manual_payment) skipped++;
          else credited++;

          // Re-fetch invoice to detect divergence
          if (inv) {
            const expectedPaidCents = Math.round((payment.value || 0) * 100);
            if (inv.paid_amount_cents && Math.abs(inv.paid_amount_cents - expectedPaidCents) > 1) {
              divergences.push({
                invoice_id: inv.id,
                payment_id: payment.id,
                expected_cents: expectedPaidCents,
                stored_cents: inv.paid_amount_cents,
                diff_cents: expectedPaidCents - inv.paid_amount_cents,
              });
              // Auto-adjust
              await supabase
                .from("company_invoices")
                .update({ paid_amount_cents: expectedPaidCents })
                .eq("id", inv.id);
            }
          }
        } catch (e: any) {
          errors.push({ payment_id: payment.id, error: e.message });
        }
      }

      if (payments.length < limit * 2) break;
      offset += limit;
      if (offset > 2000) break; // safety
    }

    // Notify divergences via WhatsApp (master)
    if (divergences.length > 0) {
      try {
        await supabase.functions.invoke("notify-internal", {
          body: {
            type: "asaas_sync_divergence",
            message: `🔔 *Sync Asaas — Divergências detectadas*\n\n` +
              `${divergences.length} fatura(s) com valor divergente foram ajustadas automaticamente.\n\n` +
              divergences.slice(0, 5).map((d) =>
                `• Invoice ${d.invoice_id.slice(0, 8)}: diff R$${(d.diff_cents / 100).toFixed(2)}`
              ).join("\n"),
          },
        });
      } catch (_) { /* best effort */ }
    }

    const summary = {
      ok: true,
      duration_ms: Date.now() - startedAt,
      window_days: days,
      processed,
      credited,
      skipped,
      divergences: divergences.length,
      errors: errors.length,
      divergence_details: divergences,
      error_details: errors.slice(0, 10),
    };

    // Log into a sync history table
    await supabase.from("asaas_sync_runs").insert({
      window_days: days,
      processed,
      credited,
      skipped,
      divergences: divergences.length,
      errors: errors.length,
      summary,
    }).then(() => {}, () => {});

    console.log("[asaas-sync]", summary);
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[asaas-sync] FATAL", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
