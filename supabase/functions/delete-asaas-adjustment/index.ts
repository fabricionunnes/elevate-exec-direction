import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Exclui um "Ajuste automático Asaas" (conta a receber OU a pagar criada pela
// conciliação) e REVERTE o saldo do banco Asaas — o oposto do que o asaas-sync fez:
//   - receivable (foi crédito, +saldo) -> subtrai do saldo
//   - payable    (foi débito, -saldo) -> soma de volta ao saldo
// Também apaga a transação do extrato (financial_bank_transactions) que gerou o ajuste.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { kind, id } = await req.json().catch(() => ({}));
    if (!id || (kind !== "receivable" && kind !== "payable")) {
      return json({ ok: false, error: "bad_request", detail: "informe kind ('receivable'|'payable') e id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const table = kind === "receivable" ? "financial_receivables" : "financial_payables";

    const { data: row, error: rowErr } = await supabase
      .from(table)
      .select("id, amount, description")
      .eq("id", id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return json({ ok: false, error: "not_found" }, 404);

    // Trava de segurança: só reverte saldo de linhas que são realmente ajuste do Asaas
    const isAdjustment = typeof row.description === "string" && row.description.startsWith("Ajuste automático Asaas");
    if (!isAdjustment) {
      return json({ ok: false, error: "not_adjustment", detail: "esta linha não é um ajuste automático do Asaas" }, 400);
    }

    const amountCents = Math.round(Number(row.amount || 0) * 100);
    // receivable somou ao saldo -> agora subtrai; payable subtraiu -> agora soma de volta
    const delta = kind === "receivable" ? -amountCents : amountCents;

    // Banco Asaas
    const { data: bank } = await supabase
      .from("financial_banks")
      .select("id, current_balance_cents")
      .eq("name", "Asaas")
      .eq("is_active", true)
      .maybeSingle();

    let balanceChanged = false;
    let newBalanceCents: number | null = null;

    if (bank && amountCents !== 0) {
      // Update otimista com algumas tentativas (mesmo padrão do asaas-sync)
      let attempts = 0;
      while (attempts < 4) {
        attempts++;
        const { data: cur } = await supabase
          .from("financial_banks")
          .select("current_balance_cents")
          .eq("id", bank.id)
          .maybeSingle();
        const stored = Number(cur?.current_balance_cents || 0);
        const target = stored + delta;
        const { data: updated, error: updErr } = await supabase
          .from("financial_banks")
          .update({ current_balance_cents: target, updated_at: new Date().toISOString() })
          .eq("id", bank.id)
          .eq("current_balance_cents", stored)
          .select("id");
        if (updErr) throw updErr;
        if (updated?.length) {
          balanceChanged = true;
          newBalanceCents = target;
          break;
        }
      }
      if (!balanceChanged) {
        return json({ ok: false, error: "balance_lock", detail: "saldo do banco mudou durante a operação, tente de novo" }, 409);
      }
    }

    // Apaga a transação do extrato que originou o ajuste (mesma descrição + tipo da conciliação)
    const { data: tx } = await supabase
      .from("financial_bank_transactions")
      .select("id")
      .eq("reference_type", "asaas_balance_reconciliation")
      .eq("description", row.description)
      .limit(1)
      .maybeSingle();
    if (tx?.id) {
      await supabase.from("financial_bank_transactions").delete().eq("id", tx.id);
    }

    // Apaga a conta a receber/pagar
    const { error: delErr } = await supabase.from(table).delete().eq("id", id);
    if (delErr) throw delErr;

    return json({
      ok: true,
      kind,
      reverted_cents: amountCents,
      balance_changed: balanceChanged,
      new_balance_cents: newBalanceCents,
      transaction_deleted: !!tx?.id,
    });
  } catch (e) {
    console.error("[delete-asaas-adjustment]", e);
    return json({ ok: false, error: "internal", detail: String((e as Error)?.message || e) }, 500);
  }
});
