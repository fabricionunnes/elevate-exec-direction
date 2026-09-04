// asaas-reconcile — conciliação bancária automática com o Asaas.
// Importa o extrato, tenta casar cada lançamento com o financeiro do Nexus e
// dá baixa SÓ quando tem certeza. Na dúvida marca "revisar" e avisa — nunca
// mexe no dinheiro no chute.
//
// Confiança:
//   exact → o lançamento traz o paymentId do Asaas e existe recebível com esse
//           mesmo asaas_payment_id. Baixa automática.
//   high  → valor idêntico + vencimento perto (±5 dias) + UM único candidato
//           em aberto. Baixa automática.
//   none  → nenhum ou vários candidatos → status "review", sem baixa.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE = "https://api.asaas.com/v3";
const ASAAS_BANK_ID = "6e9a3135-5826-4633-adf1-a63ef5b70e96"; // financial_banks: Asaas
const AVISO_FALLBACK = "5531989840003";
// Conciliação é assunto do Financeiro: o aviso sai pela instância do setor,
// não pela pessoal do Fabrício.
const AVISO_INSTANCE = "financeirounv";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const cents = (v: number) => Math.round(Number(v || 0) * 100);
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dayDiff = (a: string, b: string) =>
  Math.abs((new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / 86400000);

// movimento interno do Asaas (saída pra conta principal, antecipação): não é
// conta a pagar — é o dinheiro mudando de lugar. Explica boa parte da diferença
// de saldo, então fica identificado em vez de virar "revisar" genérico.
const TRANSFER_TYPES = new Set([
  "TRANSFER", "RECEIVABLE_ANTICIPATION_DEBIT", "RECEIVABLE_ANTICIPATION_GROSS_CREDIT",
  "CONTRACTUAL_EFFECT_SETTLEMENT", "INTERNAL_TRANSFER_CREDIT", "INTERNAL_TRANSFER_DEBIT",
  "RECEIVABLE_ANTICIPATION_FEE",
]);

// lançamentos que são custo da operação do Asaas, não baixa de título
const FEE_TYPES = new Set([
  "PAYMENT_FEE", "PAYMENT_MESSAGING_NOTIFICATION_FEE", "TRANSFER_FEE", "BILL_PAYMENT_FEE",
  "PIX_TRANSACTION_FEE", "ASAAS_CARD_TRANSACTION_FEE", "CREDIT_BUREAU_REPORT_FEE",
  "PAYMENT_SMS_NOTIFICATION_FEE", "INVOICE_FEE", "PHONE_CALL_NOTIFICATION_FEE",
  "INSTANT_TEXT_MESSAGE_FEE",
]);

// Lança no razão interno (extrato do Nexus) o dinheiro de um lançamento do
// extrato do Asaas — uma vez só por lançamento (ledger_posted) e nunca em
// duplicidade com um título que já foi creditado por outro caminho (webhook,
// baixa manual). É isso que faz o saldo interno acompanhar o Asaas sem
// precisar de "ajuste automático".
// O time TAMBÉM lança na mão (baixa de conta a pagar, transferência). Se já
// existe um lançamento manual do mesmo tipo e valor perto da data, o dinheiro
// já está no razão — a conciliação NÃO repete (foi isso que dobrou 4,2 mil em
// 02/09 e 987 em 03/09).
async function jaLancadoManual(supabase: any, bankId: string, tipo: "credit" | "debit", valorCents: number, dia: string) {
  const ini = new Date(new Date(dia + "T12:00:00Z").getTime() - 3 * 86400000).toISOString();
  const fim = new Date(new Date(dia + "T12:00:00Z").getTime() + 4 * 86400000).toISOString();
  const { data } = await supabase.from("financial_bank_transactions").select("id")
    .eq("bank_id", bankId).eq("type", tipo).eq("amount_cents", valorCents)
    .neq("reference_type", "statement_entry")
    .gte("created_at", ini).lte("created_at", fim).limit(1);
  return !!(data && data.length);
}

async function lancarNoRazao(supabase: any, e: any, tipo: "credit" | "debit", descricao: string, refType: string, refId: string | null, dryRun: boolean) {
  if (e.ledger_posted || dryRun) return false;
  if (refId && refType !== "statement_entry") {
    const { data: dup } = await supabase.from("financial_bank_transactions").select("id")
      .eq("reference_type", refType).eq("reference_id", refId).eq("type", tipo).limit(1);
    if (dup?.length) return false;
  }
  const valor = Math.abs(e.amount_cents);
  await supabase.from("financial_bank_transactions").insert({
    bank_id: e.bank_id, type: tipo, amount_cents: valor, description: descricao,
    reference_type: refType, reference_id: refId,
  });
  await supabase.rpc("increment_bank_balance", { p_bank_id: e.bank_id, p_amount: tipo === "credit" ? valor : -valor });
  return true;
}

async function asaasGet(path: string) {
  const r = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: ASAAS_KEY, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Asaas ${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function avisar(supabase: any, texto: string) {
  try {
    const { data: inst } = await supabase.from("whatsapp_instances")
      .select("api_url, api_key, instance_name, provider_type")
      .eq("instance_name", AVISO_INSTANCE).maybeSingle();
    if (!inst?.api_url || !inst?.api_key) return { sent: false, reason: `instância ${AVISO_INSTANCE} indisponível` };
    const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    let isV2 = inst.provider_type === "manager_v2";
    try { if (!isV2) isV2 = new URL(base).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* legado */ }
    const url = isV2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key, Authorization: `Bearer ${inst.api_key}` },
      body: JSON.stringify(isV2 ? { number: AVISO_FALLBACK, text: texto, delay: 0 } : { number: AVISO_FALLBACK, text: texto }),
    });
    return { sent: r.ok, reason: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e) {
    return { sent: false, reason: String((e as Error).message || e).slice(0, 120) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!ASAAS_KEY) return j({ ok: false, error: "ASAAS_API_KEY não configurada" }, 500);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({} as any));
  const dryRun = !!body.dry_run;
  const maxPages = Math.min(20, Math.max(1, Number(body.pages) || 4)); // 100 por página

  try {
    // ── 1) Importa o extrato (só o que ainda não temos) ────────────────────
    let imported = 0, seenExisting = 0;
    const novos: any[] = [];
    for (let page = 0; page < maxPages; page++) {
      const data = await asaasGet(`/financialTransactions?limit=100&offset=${page * 100}`);
      const rows: any[] = data?.data || [];
      if (!rows.length) break;

      const ids = rows.map((r) => r.id);
      const { data: existentes } = await supabase.from("financial_statement_entries")
        .select("external_id").eq("provider", "asaas").in("external_id", ids);
      const known = new Set((existentes || []).map((e: any) => e.external_id));

      const toInsert = rows.filter((r) => !known.has(r.id)).map((r) => ({
        bank_id: ASAAS_BANK_ID,
        provider: "asaas",
        external_id: r.id,
        entry_date: r.date,
        amount_cents: cents(r.value),
        kind: Number(r.value) >= 0 ? "credit" : "debit",
        entry_type: r.type || null,
        description: r.description || null,
        provider_payment_id: r.paymentId || null,
        balance_after_cents: cents(r.balance),
        raw: r,
        status: "pending",
      }));
      seenExisting += rows.length - toInsert.length;

      if (toInsert.length && !dryRun) {
        const { error } = await supabase.from("financial_statement_entries")
          .upsert(toInsert, { onConflict: "provider,external_id", ignoreDuplicates: true });
        if (error) throw new Error(`import: ${error.message}`);
      }
      imported += toInsert.length;
      novos.push(...toInsert);

      // já alcançamos o que estava importado: não precisa varrer o resto
      if (!data?.hasMore || toInsert.length === 0) break;
    }

    // ── 2) Concilia o que está pendente ────────────────────────────────────
    const { data: pendentes } = await supabase.from("financial_statement_entries")
      .select("*").eq("provider", "asaas").eq("status", "pending")
      .order("entry_date", { ascending: false }).limit(500);

    let autoMatched = 0, needsReview = 0, feeCount = 0, transferCount = 0, invoiceCount = 0;
    const revisar: string[] = [];
    const conciliados: string[] = [];

    for (const e of (pendentes || [])) {
      let patch: Record<string, unknown> | null = null;

      // 2a) taxa/custo do Asaas — explica o saldo, não é baixa de título
      if (FEE_TYPES.has(String(e.entry_type))) {
        let feeId: string | null = null;
        // recebimento desta cobrança baixado na mão pelo líquido (bruto − taxa)?
        let taxaJaDescontada = false;
        if (e.provider_payment_id) {
          const { data: recebido } = await supabase.from("financial_statement_entries").select("amount_cents")
            .eq("provider", "asaas").eq("provider_payment_id", e.provider_payment_id).eq("entry_type", "PAYMENT_RECEIVED").limit(1).maybeSingle();
          if (recebido?.amount_cents) {
            taxaJaDescontada = await jaLancadoManual(supabase, e.bank_id, "credit", Number(recebido.amount_cents) - Math.abs(e.amount_cents), e.entry_date);
          }
        }
        if (taxaJaDescontada) {
          patch = { status: "matched", match_kind: "fee", match_confidence: "exact",
            match_reason: "taxa já descontada na baixa manual do recebimento (líquido)", auto_settled: false, ledger_posted: true };
          feeCount++;
        } else if (!dryRun) {
          const { data: pay } = await supabase.from("financial_payables").insert({
            supplier_name: "Asaas", description: e.description || "Taxa Asaas",
            amount: Math.abs(e.amount_cents) / 100, due_date: e.entry_date, status: "paid",
            paid_date: e.entry_date, paid_amount: Math.abs(e.amount_cents) / 100,
            notes: "Conciliação Asaas — taxa identificada no extrato",
          }).select("id").maybeSingle();
          feeId = pay?.id || null;
          await lancarNoRazao(supabase, e, "debit", e.description || "Taxa Asaas", "payable", feeId, dryRun);
        }
        if (!taxaJaDescontada) {
          patch = { status: "matched", match_kind: "fee", match_id: feeId, match_confidence: "exact",
            match_reason: "custo do Asaas (taxa) — conta paga criada e lançada no razão", auto_settled: true, ledger_posted: true };
          feeCount++;
        }
      }

      // 2a2) transferência/antecipação: identifica e tira do meio do caminho
      if (!patch && TRANSFER_TYPES.has(String(e.entry_type))) {
        const tipo = e.kind === "credit" ? "credit" : "debit";
        const manual = await jaLancadoManual(supabase, e.bank_id, tipo, Math.abs(e.amount_cents), e.entry_date);
        if (!manual) {
          await lancarNoRazao(supabase, e, tipo, `Transferência Asaas: ${e.description || e.entry_type}`, "statement_entry", e.id, dryRun);
        }
        patch = { status: "matched", match_kind: "transfer", match_confidence: "exact",
          match_reason: manual ? "transferência já lançada manualmente no razão (pagamento/transferência)" : "movimento interno do Asaas (transferência/antecipação) — lançado no razão",
          auto_settled: false, ledger_posted: true };
        transferCount++;
      }

      // 2b) crédito com paymentId: casa direto pelo id do Asaas
      if (!patch && e.kind === "credit" && e.provider_payment_id) {
        const { data: rec } = await supabase.from("financial_receivables")
          .select("id, status, amount, description").eq("asaas_payment_id", e.provider_payment_id).maybeSingle();
        if (rec) {
          if (rec.status !== "paid" && !dryRun) {
            await supabase.from("financial_receivables").update({
              status: "paid", paid_date: e.entry_date, paid_amount: e.amount_cents / 100,
              updated_at: new Date().toISOString(),
            }).eq("id", rec.id);
          }
          if (rec.status !== "paid") await lancarNoRazao(supabase, e, "credit", `Recebimento Asaas: ${rec.description || ""}`.trim(), "receivable", rec.id, dryRun);
          patch = { status: "matched", match_kind: "receivable", match_id: rec.id, match_confidence: "exact",
            match_reason: `recebível pelo id do Asaas (${e.provider_payment_id})`, auto_settled: rec.status !== "paid", ledger_posted: true };
          if (rec.status !== "paid") { autoMatched++; conciliados.push(`+${brl(e.amount_cents)} ${rec.description || ""}`.trim()); }
        }
      }

      // 2b2) crédito: fatura da empresa pelo id do Asaas
      if (!patch && e.kind === "credit" && e.provider_payment_id) {
        const { data: inv } = await supabase.from("company_invoices")
          .select("id, status, description").eq("pagarme_charge_id", e.provider_payment_id).maybeSingle();
        if (inv) {
          if (inv.status !== "paid" && !dryRun) {
            await supabase.from("company_invoices").update({
              status: "paid", paid_at: new Date(`${e.entry_date}T12:00:00Z`).toISOString(),
              paid_amount_cents: e.amount_cents, updated_at: new Date().toISOString(),
            }).eq("id", inv.id);
          }
          if (inv.status !== "paid") await lancarNoRazao(supabase, e, "credit", `Recebimento Asaas: ${inv.description || ""}`.trim(), "invoice", inv.id, dryRun);
          patch = { status: "matched", match_kind: "invoice", match_id: inv.id, match_confidence: "exact",
            match_reason: `fatura da empresa pelo id do Asaas (${inv.description || ""})`.trim(),
            auto_settled: inv.status !== "paid", ledger_posted: true };
          if (inv.status !== "paid") { autoMatched++; invoiceCount++; conciliados.push(`+${brl(e.amount_cents)} ${inv.description || ""}`.trim()); }
        }
      }

      // 2c) crédito sem id: valor idêntico + data perto + candidato ÚNICO
      if (!patch && e.kind === "credit") {
        const { data: cands } = await supabase.from("financial_receivables")
          .select("id, description, due_date, amount, status")
          .neq("status", "paid").eq("amount", e.amount_cents / 100);
        const perto = (cands || []).filter((c: any) => c.due_date && dayDiff(c.due_date, e.entry_date) <= 5);
        if (perto.length === 1) {
          const c = perto[0];
          if (!dryRun) {
            await supabase.from("financial_receivables").update({
              status: "paid", paid_date: e.entry_date, paid_amount: e.amount_cents / 100,
              updated_at: new Date().toISOString(),
            }).eq("id", c.id);
          }
          await lancarNoRazao(supabase, e, "credit", `Recebimento Asaas: ${c.description || ""}`.trim(), "receivable", c.id, dryRun);
          patch = { status: "matched", match_kind: "receivable", match_id: c.id, match_confidence: "high",
            match_reason: `valor e vencimento batem, candidato único (${c.description || ""})`.trim(), auto_settled: true, ledger_posted: true };
          autoMatched++; conciliados.push(`+${brl(e.amount_cents)} ${c.description || ""}`.trim());
        } else {
          const bruto = Math.abs(e.amount_cents);
          const jaNoRazao = await jaLancadoManual(supabase, e.bank_id, "credit", bruto, e.entry_date)
            || await jaLancadoManual(supabase, e.bank_id, "credit", bruto - 199, e.entry_date)
            || await jaLancadoManual(supabase, e.bank_id, "credit", bruto - 398, e.entry_date);
          patch = { status: "review", match_confidence: "none", ledger_posted: jaNoRazao,
            match_reason: (perto.length === 0 ? "nenhum recebível em aberto com esse valor/vencimento" : `${perto.length} recebíveis possíveis — precisa escolher`)
              + (jaNoRazao ? " · dinheiro já lançado manualmente no razão (só classificar)" : "") };
          needsReview++; revisar.push(`+${brl(e.amount_cents)} ${e.description || ""}`.trim());
        }
      }

      // 2d) débito: casa contra contas a pagar (valor + data), candidato único
      if (!patch && e.kind === "debit") {
        const valor = Math.abs(e.amount_cents) / 100;
        const { data: cands } = await supabase.from("financial_payables")
          .select("id, description, due_date, amount, status").neq("status", "paid").eq("amount", valor);
        const perto = (cands || []).filter((c: any) => c.due_date && dayDiff(c.due_date, e.entry_date) <= 5);
        if (perto.length === 1) {
          const c = perto[0];
          if (!dryRun) {
            await supabase.from("financial_payables").update({
              status: "paid", paid_date: e.entry_date, paid_amount: valor, updated_at: new Date().toISOString(),
            }).eq("id", c.id);
          }
          await lancarNoRazao(supabase, e, "debit", `Pagamento Asaas: ${c.description || ""}`.trim(), "payable", c.id, dryRun);
          patch = { status: "matched", match_kind: "payable", match_id: c.id, match_confidence: "high",
            match_reason: `conta a pagar com valor e vencimento batendo (${c.description || ""})`.trim(), auto_settled: true, ledger_posted: true };
          autoMatched++; conciliados.push(`-${brl(Math.abs(e.amount_cents))} ${c.description || ""}`.trim());
        } else {
          patch = { status: "review", match_confidence: "none",
            match_reason: perto.length === 0 ? "nenhuma conta a pagar em aberto com esse valor/vencimento" : `${perto.length} contas possíveis — precisa escolher` };
          needsReview++; revisar.push(`-${brl(Math.abs(e.amount_cents))} ${e.description || ""}`.trim());
        }
      }

      if (patch && !dryRun) {
        await supabase.from("financial_statement_entries")
          .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", e.id);
      }
    }

    // ── 3) Saldo do provedor x saldo do sistema ────────────────────────────
    let providerBalance: number | null = null;
    try {
      const bal = await asaasGet("/finance/balance");
      providerBalance = cents(bal?.balance);
    } catch { /* saldo é informativo */ }
    const { data: bank } = await supabase.from("financial_banks")
      .select("current_balance_cents").eq("id", ASAAS_BANK_ID).maybeSingle();
    const systemBalance = bank?.current_balance_cents ?? null;
    const diff = providerBalance != null && systemBalance != null ? providerBalance - systemBalance : null;
    // A diferença DEVE ser exatamente a soma do que está na fila de revisão
    // (dinheiro que o Asaas viu e ninguém classificou ainda). O que sobrar
    // além disso aconteceu fora do extrato — aí sim é alerta de verdade.
    const { data: fila } = await supabase.from("financial_statement_entries")
      .select("amount_cents").eq("provider", "asaas").eq("status", "review").eq("ledger_posted", false);
    const filaCents = (fila || []).reduce((s: number, x: any) => s + Number(x.amount_cents || 0), 0);
    const filaQtd = (fila || []).length;
    const inexplicado = diff != null ? diff - filaCents : null;

    // ── 4) Registra a rodada e avisa ───────────────────────────────────────
    let aviso: { sent: boolean; reason?: string } = { sent: false, reason: "dry run" };
    if (!dryRun) {
      const houveNovidade = imported > 0 || autoMatched > 0 || needsReview > 0 || (inexplicado != null && Math.abs(inexplicado) > 1);
      if (houveNovidade) {
        const linhas = [
          "🏦 *Conciliação bancária — Asaas*",
          "",
          `📥 Lançamentos novos no extrato: ${imported}`,
          `✅ Conciliados automaticamente: ${autoMatched}`,
          `⚠️ Precisam da sua revisão: ${needsReview}`,
          feeCount ? `🧾 Taxas do Asaas identificadas: ${feeCount}` : "",
          transferCount ? `🔁 Transferências/antecipações: ${transferCount}` : "",
          "",
          providerBalance != null ? `Saldo no Asaas: ${brl(providerBalance)}` : "",
          systemBalance != null ? `Saldo no sistema: ${brl(systemBalance)}` : "",
          diff != null && diff !== 0
            ? `Diferença: ${brl(diff)}${filaQtd ? ` — ${brl(filaCents)} explicados por ${filaQtd} pendência(s) na fila` : ""}`
            : (diff === 0 ? "✔️ Saldos batendo" : ""),
          inexplicado != null && Math.abs(inexplicado) > 1 ? `❗ Fora do extrato (investigar): ${brl(inexplicado)}` : "",
          conciliados.length ? "\n*Baixados automaticamente:*\n" + conciliados.slice(0, 8).map(s => `• ${s}`).join("\n") : "",
          revisar.length ? "\n*Aguardando você decidir:*\n" + revisar.slice(0, 8).map(s => `• ${s}`).join("\n") : "",
          revisar.length > 8 ? `…e mais ${revisar.length - 8}` : "",
          "\nRevise aqui: unvholdings.com.br/#/onboarding-tasks/financeiro/recorrencias?tab=reconciliation",
        ].filter(Boolean);
        aviso = await avisar(supabase, linhas.join("\n"));
      } else {
        aviso = { sent: false, reason: "nada novo" };
      }

      await supabase.from("financial_reconciliation_runs").insert({
        provider: "asaas", imported, auto_matched: autoMatched, needs_review: needsReview,
        provider_balance_cents: providerBalance, system_balance_cents: systemBalance, diff_cents: diff,
        notified: aviso.sent, detail: aviso.sent ? null : (aviso.reason || null),
      });
    }

    return j({
      ok: true, imported, ja_conhecidos: seenExisting, auto_matched: autoMatched,
      needs_review: needsReview, taxas: feeCount, transferencias: transferCount, faturas: invoiceCount,
      saldo_asaas: providerBalance, saldo_sistema: systemBalance, diferenca: diff, aviso,
    });
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
