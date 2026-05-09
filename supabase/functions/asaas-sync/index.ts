// Sincronização periódica com Asaas: busca pagamentos RECEIVED/CONFIRMED dos últimos N dias
// e replay via asaas-webhook (idempotente). Detecta divergências e envia alerta WhatsApp.
// Roda em background (EdgeRuntime.waitUntil) para evitar timeout de 150s.
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

async function runSync(days: number) {
  const startedAt = Date.now();
  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  if (!ASAAS_API_KEY) {
    console.error("[asaas-sync] ASAAS_API_KEY not configured");
    return;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  let processed = 0;
  let credited = 0;
  let skipped = 0;
  const divergences: any[] = [];
  const errors: any[] = [];

  try {
    for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
      let offset = 0;
      const limit = 100;
      while (true) {
        const data = await asaasGet(
          `/payments?status=${status}&paymentDateGe=${since}&limit=${limit}&offset=${offset}`,
          ASAAS_API_KEY,
        );
        const payments = data.data || [];
        if (!payments.length) break;

        // Processa em paralelo (lotes de 5) p/ acelerar
        const batchSize = 5;
        for (let i = 0; i < payments.length; i += batchSize) {
          const batch = payments.slice(i, i + batchSize);
          await Promise.all(batch.map(async (payment: any) => {
            processed++;
            try {
              const { data: inv } = await supabase
                .from("company_invoices")
                .select("id, paid_amount_cents")
                .eq("pagarme_charge_id", payment.id)
                .maybeSingle();

              const replay = await supabase.functions.invoke("asaas-webhook", {
                body: {
                  event: payment.status === "RECEIVED_IN_CASH"
                    ? "PAYMENT_RECEIVED_IN_CASH"
                    : payment.status === "RECEIVED"
                      ? "PAYMENT_RECEIVED"
                      : "PAYMENT_CONFIRMED",
                  payment,
                },
              });

              const result = replay.data || {};
              if (result.deduplicated || result.manual_payment) skipped++;
              else credited++;

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
                  await supabase
                    .from("company_invoices")
                    .update({ paid_amount_cents: expectedPaidCents })
                    .eq("id", inv.id);
                }
              }
            } catch (e: any) {
              errors.push({ payment_id: payment.id, error: e.message });
            }
          }));
        }

        if (payments.length < limit) break;
        offset += limit;
        if (offset > 2000) break;
      }
    }

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

    await supabase.from("asaas_sync_runs").insert({
      window_days: days,
      processed,
      credited,
      skipped,
      divergences: divergences.length,
      errors: errors.length,
      summary,
    }).then(() => {}, () => {});

    console.log("[asaas-sync] DONE", summary);
  } catch (err: any) {
    console.error("[asaas-sync] FATAL", err);
    await supabase.from("asaas_sync_runs").insert({
      window_days: days,
      processed,
      credited,
      skipped,
      divergences: divergences.length,
      errors: errors.length + 1,
      summary: { ok: false, error: err.message, processed, credited, skipped },
    }).then(() => {}, () => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const days = Number(body.days ?? 7);

  // @ts-ignore — EdgeRuntime existe em Supabase Edge Functions
  EdgeRuntime.waitUntil(runSync(days));

  return new Response(
    JSON.stringify({ ok: true, queued: true, window_days: days, message: "Sync iniciado em background. Veja resultado em asaas_sync_runs." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
