// asaas-reconcile — conciliação bancária automática com o Asaas.
// Importa o extrato, tenta casar cada lançamento com o financeiro do Nexus e
// dá baixa SÓ quando tem certeza. Na dúvida marca "revisar" e avisa — nunca
// mexe no dinheiro no chute.
//
// 25/09/2026 — o saldo estava R$ 2.228 abaixo do Asaas. Causa: classificar e
// entrar dinheiro eram a MESMA decisão. Um recebimento sem título casado ficava
// na fila de revisão e o dinheiro não entrava no razão, então a fila virava
// diferença permanente de saldo (10 pendências, R$ 2.989,43, paradas desde 01/09).
// Agora são duas decisões separadas:
//   dinheiro  → todo lançamento do extrato entra no razão, sempre, uma vez só.
//   classificação → continua na fila pra alguém dizer de qual título é.
// No fim da rodada o saldo é conferido contra /finance/balance e, se sobrar
// diferença, ela vira UM lançamento nomeado (resíduo) em vez do antigo "ajuste
// automático" às cegas. Cada conta Asaas tem o saldo real gravado no banco
// (provider_balance_cents) — quem não tem secret válida aparece como erro em
// vez de mostrar número velho como se fosse certo.
//
// Confiança:
//   exact → o lançamento traz o paymentId do Asaas e existe recebível com esse
//           mesmo asaas_payment_id. Baixa automática.
//   high  → valor idêntico + vencimento perto (±5 dias) + UM único candidato
//           em aberto. Baixa automática.
//   none  → nenhum ou vários candidatos → status "review", sem baixa.
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE = "https://api.asaas.com/v3";
const ASAAS_BANK_ID = "6e9a3135-5826-4633-adf1-a63ef5b70e96"; // financial_banks: Asaas
const AVISO_FALLBACK = "5531989840003";
// Conciliação é assunto do Financeiro: o aviso sai pela instância do setor,
// não pela pessoal do Fabrício.
const AVISO_INSTANCE = "financeirounv";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const j = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });
const cents = (v)=>Math.round(Number(v || 0) * 100);
const brl = (c)=>(c / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
const dayDiff = (a, b)=>Math.abs((new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / 86400000);
// movimento interno do Asaas (saída pra conta principal, antecipação): não é
// conta a pagar — é o dinheiro mudando de lugar. Explica boa parte da diferença
// de saldo, então fica identificado em vez de virar "revisar" genérico.
const TRANSFER_TYPES = new Set([
  "TRANSFER",
  "RECEIVABLE_ANTICIPATION_DEBIT",
  "RECEIVABLE_ANTICIPATION_GROSS_CREDIT",
  "CONTRACTUAL_EFFECT_SETTLEMENT",
  "INTERNAL_TRANSFER_CREDIT",
  "INTERNAL_TRANSFER_DEBIT",
  "RECEIVABLE_ANTICIPATION_FEE"
]);
// lançamentos que são custo da operação do Asaas, não baixa de título
const FEE_TYPES = new Set([
  "PAYMENT_FEE",
  "PAYMENT_MESSAGING_NOTIFICATION_FEE",
  "TRANSFER_FEE",
  "BILL_PAYMENT_FEE",
  "PIX_TRANSACTION_FEE",
  "ASAAS_CARD_TRANSACTION_FEE",
  "CREDIT_BUREAU_REPORT_FEE",
  "PAYMENT_SMS_NOTIFICATION_FEE",
  "INVOICE_FEE",
  "PHONE_CALL_NOTIFICATION_FEE",
  "INSTANT_TEXT_MESSAGE_FEE"
]);
// Nome legível pro lançamento no razão quando o extrato não casa com título.
const ROTULO = {
  PAYMENT_RECEIVED: "Recebimento Asaas sem título",
  PIX_TRANSACTION_DEBIT_REFUND: "Estorno de Pix",
  BILL_PAYMENT: "Pagamento de conta pelo Asaas",
  BILL_PAYMENT_CANCELLED: "Pagamento de conta cancelado",
  PAYMENT_REFUND: "Estorno de cobrança",
  PAYMENT_CHARGEBACK: "Chargeback",
  PAYMENT_REVERSAL: "Reversão de pagamento",
  ASAAS_CARD_TRANSACTION: "Compra no cartão Asaas",
};
const rotulo = (e) => ROTULO[String(e.entry_type)] || e.description || e.entry_type || "Lançamento do extrato Asaas";

// Lança no razão interno (extrato do Nexus) o dinheiro de um lançamento do
// extrato do Asaas — uma vez só por lançamento (ledger_posted) e nunca em
// duplicidade com um título que já foi creditado por outro caminho (webhook,
// baixa manual). É isso que faz o saldo interno acompanhar o Asaas sem
// precisar de "ajuste automático".
// O time TAMBÉM lança na mão (baixa de conta a pagar, transferência). Se já
// existe um lançamento manual do mesmo tipo e valor perto da data, o dinheiro
// já está no razão — a conciliação NÃO repete (foi isso que dobrou 4,2 mil em
// 02/09 e 987 em 03/09).
async function jaLancadoManual(supabase, bankId, tipo, valorCents, dia) {
  const ini = new Date(new Date(dia + "T12:00:00Z").getTime() - 3 * 86400000).toISOString();
  const fim = new Date(new Date(dia + "T12:00:00Z").getTime() + 4 * 86400000).toISOString();
  const { data } = await supabase.from("financial_bank_transactions").select("id").eq("bank_id", bankId).eq("type", tipo).eq("amount_cents", valorCents).neq("reference_type", "statement_entry").gte("created_at", ini).lte("created_at", fim).limit(1);
  return !!(data && data.length);
}
async function lancarNoRazao(supabase, e, tipo, descricao, refType, refId, dryRun) {
  if (e.ledger_posted || dryRun) return false;
  if (refId && refType !== "statement_entry") {
    const { data: dup } = await supabase.from("financial_bank_transactions").select("id").eq("reference_type", refType).eq("reference_id", refId).eq("type", tipo).limit(1);
    if (dup?.length) return false;
  }
  const valor = Math.abs(e.amount_cents);
  await supabase.from("financial_bank_transactions").insert({
    bank_id: e.bank_id,
    type: tipo,
    amount_cents: valor,
    description: descricao,
    reference_type: refType,
    reference_id: refId
  });
  await supabase.rpc("increment_bank_balance", {
    p_bank_id: e.bank_id,
    p_amount: tipo === "credit" ? valor : -valor
  });
  return true;
}
async function asaasGet(path) {
  const r = await fetch(`${ASAAS_BASE}${path}`, {
    headers: {
      access_token: ASAAS_KEY,
      "Content-Type": "application/json"
    }
  });
  if (!r.ok) throw new Error(`Asaas ${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function avisar(supabase, texto) {
  try {
    const { data: inst } = await supabase.from("whatsapp_instances").select("api_url, api_key, instance_name, provider_type").eq("instance_name", AVISO_INSTANCE).maybeSingle();
    if (!inst?.api_url || !inst?.api_key) return {
      sent: false,
      reason: `instância ${AVISO_INSTANCE} indisponível`
    };
    const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    let isV2 = inst.provider_type === "manager_v2";
    try {
      if (!isV2) isV2 = new URL(base).hostname.toLowerCase().endsWith(".stevo.chat");
    } catch  {}
    const url = isV2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: inst.api_key,
        Authorization: `Bearer ${inst.api_key}`
      },
      body: JSON.stringify(isV2 ? {
        number: AVISO_FALLBACK,
        text: texto,
        delay: 0
      } : {
        number: AVISO_FALLBACK,
        text: texto
      })
    });
    return {
      sent: r.ok,
      reason: r.ok ? undefined : `HTTP ${r.status}`
    };
  } catch (e) {
    return {
      sent: false,
      reason: String(e.message || e).slice(0, 120)
    };
  }
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: cors
  });
  if (!ASAAS_KEY) return j({
    ok: false,
    error: "ASAAS_API_KEY não configurada"
  }, 500);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(()=>({}));
  const dryRun = !!body.dry_run;
  const maxPages = Math.min(20, Math.max(1, Number(body.pages) || 4)); // 100 por página
  try {
    // ── 1) Importa o extrato (só o que ainda não temos) ────────────────────
    let imported = 0, seenExisting = 0;
    const novos = [];
    for(let page = 0; page < maxPages; page++){
      const data = await asaasGet(`/financialTransactions?limit=100&offset=${page * 100}`);
      const rows = data?.data || [];
      if (!rows.length) break;
      const ids = rows.map((r)=>r.id);
      const { data: existentes } = await supabase.from("financial_statement_entries").select("external_id").eq("provider", "asaas").in("external_id", ids);
      const known = new Set((existentes || []).map((e)=>e.external_id));
      const toInsert = rows.filter((r)=>!known.has(r.id)).map((r)=>({
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
          status: "pending"
        }));
      seenExisting += rows.length - toInsert.length;
      if (toInsert.length && !dryRun) {
        const { error } = await supabase.from("financial_statement_entries").upsert(toInsert, {
          onConflict: "provider,external_id",
          ignoreDuplicates: true
        });
        if (error) throw new Error(`import: ${error.message}`);
      }
      imported += toInsert.length;
      novos.push(...toInsert);
      // já alcançamos o que estava importado: não precisa varrer o resto
      if (!data?.hasMore || toInsert.length === 0) break;
    }
    // ── 2) Concilia o que está pendente ────────────────────────────────────
    const { data: pendentes } = await supabase.from("financial_statement_entries").select("*").eq("provider", "asaas").eq("status", "pending").order("entry_date", {
      ascending: false
    }).limit(500);
    let autoMatched = 0, needsReview = 0, feeCount = 0, transferCount = 0, invoiceCount = 0, semTitulo = 0;
    const revisar = [];
    const conciliados = [];
    for (const e of pendentes || []){
      let patch = null;
      // 2a) taxa/custo do Asaas — explica o saldo, não é baixa de título
      if (FEE_TYPES.has(String(e.entry_type))) {
        let feeId = null;
        // recebimento desta cobrança baixado na mão pelo líquido (bruto − taxa)?
        let taxaJaDescontada = false;
        if (e.provider_payment_id) {
          const { data: recebido } = await supabase.from("financial_statement_entries").select("amount_cents").eq("provider", "asaas").eq("provider_payment_id", e.provider_payment_id).eq("entry_type", "PAYMENT_RECEIVED").limit(1).maybeSingle();
          if (recebido?.amount_cents) {
            taxaJaDescontada = await jaLancadoManual(supabase, e.bank_id, "credit", Number(recebido.amount_cents) - Math.abs(e.amount_cents), e.entry_date);
          }
        }
        if (taxaJaDescontada) {
          patch = {
            status: "matched",
            match_kind: "fee",
            match_confidence: "exact",
            match_reason: "taxa já descontada na baixa manual do recebimento (líquido)",
            auto_settled: false,
            ledger_posted: true
          };
          feeCount++;
        } else if (!dryRun) {
          const { data: pay } = await supabase.from("financial_payables").insert({
            supplier_name: "Asaas",
            description: e.description || "Taxa Asaas",
            amount: Math.abs(e.amount_cents) / 100,
            due_date: e.entry_date,
            status: "paid",
            paid_date: e.entry_date,
            paid_amount: Math.abs(e.amount_cents) / 100,
            notes: "Conciliação Asaas — taxa identificada no extrato"
          }).select("id").maybeSingle();
          feeId = pay?.id || null;
          await lancarNoRazao(supabase, e, "debit", e.description || "Taxa Asaas", "payable", feeId, dryRun);
        }
        if (!taxaJaDescontada) {
          patch = {
            status: "matched",
            match_kind: "fee",
            match_id: feeId,
            match_confidence: "exact",
            match_reason: "custo do Asaas (taxa) — conta paga criada e lançada no razão",
            auto_settled: true,
            ledger_posted: true
          };
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
        patch = {
          status: "matched",
          match_kind: "transfer",
          match_confidence: "exact",
          match_reason: manual ? "transferência já lançada manualmente no razão (pagamento/transferência)" : "movimento interno do Asaas (transferência/antecipação) — lançado no razão",
          auto_settled: false,
          ledger_posted: true
        };
        transferCount++;
      }
      // 2b) crédito com paymentId: casa direto pelo id do Asaas
      if (!patch && e.kind === "credit" && e.provider_payment_id) {
        const { data: rec } = await supabase.from("financial_receivables").select("id, status, amount, description").eq("asaas_payment_id", e.provider_payment_id).maybeSingle();
        if (rec) {
          if (rec.status !== "paid" && !dryRun) {
            await supabase.from("financial_receivables").update({
              status: "paid",
              paid_date: e.entry_date,
              paid_amount: e.amount_cents / 100,
              updated_at: new Date().toISOString()
            }).eq("id", rec.id);
          }
          if (rec.status !== "paid") await lancarNoRazao(supabase, e, "credit", `Recebimento Asaas: ${rec.description || ""}`.trim(), "receivable", rec.id, dryRun);
          patch = {
            status: "matched",
            match_kind: "receivable",
            match_id: rec.id,
            match_confidence: "exact",
            match_reason: `recebível pelo id do Asaas (${e.provider_payment_id})`,
            auto_settled: rec.status !== "paid",
            ledger_posted: true
          };
          if (rec.status !== "paid") {
            autoMatched++;
            conciliados.push(`+${brl(e.amount_cents)} ${rec.description || ""}`.trim());
          }
        }
      }
      // 2b2) crédito: fatura da empresa pelo id do Asaas
      if (!patch && e.kind === "credit" && e.provider_payment_id) {
        const { data: inv } = await supabase.from("company_invoices").select("id, status, description").eq("pagarme_charge_id", e.provider_payment_id).maybeSingle();
        if (inv) {
          if (inv.status !== "paid" && !dryRun) {
            await supabase.from("company_invoices").update({
              status: "paid",
              paid_at: new Date(`${e.entry_date}T12:00:00Z`).toISOString(),
              paid_amount_cents: e.amount_cents,
              updated_at: new Date().toISOString()
            }).eq("id", inv.id);
          }
          if (inv.status !== "paid") await lancarNoRazao(supabase, e, "credit", `Recebimento Asaas: ${inv.description || ""}`.trim(), "invoice", inv.id, dryRun);
          patch = {
            status: "matched",
            match_kind: "invoice",
            match_id: inv.id,
            match_confidence: "exact",
            match_reason: `fatura da empresa pelo id do Asaas (${inv.description || ""})`.trim(),
            auto_settled: inv.status !== "paid",
            ledger_posted: true
          };
          if (inv.status !== "paid") {
            autoMatched++;
            invoiceCount++;
            conciliados.push(`+${brl(e.amount_cents)} ${inv.description || ""}`.trim());
          }
        }
      }
      // 2c) crédito sem id: valor idêntico + data perto + candidato ÚNICO
      if (!patch && e.kind === "credit") {
        const { data: cands } = await supabase.from("financial_receivables").select("id, description, due_date, amount, status").neq("status", "paid").eq("amount", e.amount_cents / 100);
        const perto = (cands || []).filter((c)=>c.due_date && dayDiff(c.due_date, e.entry_date) <= 5);
        if (perto.length === 1) {
          const c = perto[0];
          if (!dryRun) {
            await supabase.from("financial_receivables").update({
              status: "paid",
              paid_date: e.entry_date,
              paid_amount: e.amount_cents / 100,
              updated_at: new Date().toISOString()
            }).eq("id", c.id);
          }
          await lancarNoRazao(supabase, e, "credit", `Recebimento Asaas: ${c.description || ""}`.trim(), "receivable", c.id, dryRun);
          patch = {
            status: "matched",
            match_kind: "receivable",
            match_id: c.id,
            match_confidence: "high",
            match_reason: `valor e vencimento batem, candidato único (${c.description || ""})`.trim(),
            auto_settled: true,
            ledger_posted: true
          };
          autoMatched++;
          conciliados.push(`+${brl(e.amount_cents)} ${c.description || ""}`.trim());
        } else {
          const bruto = Math.abs(e.amount_cents);
          const jaNoRazao = await jaLancadoManual(supabase, e.bank_id, "credit", bruto, e.entry_date) || await jaLancadoManual(supabase, e.bank_id, "credit", bruto - 199, e.entry_date) || await jaLancadoManual(supabase, e.bank_id, "credit", bruto - 398, e.entry_date);
          // Não achou título — mas o dinheiro ENTROU na conta. Lança no razão
          // agora e deixa na fila só a classificação. Era isso que fazia a fila
          // virar diferença de saldo.
          const lancou = jaNoRazao ? false : await lancarNoRazao(supabase, e, "credit", `${rotulo(e)}${e.description ? ` — ${e.description}` : ""}`, "statement_entry", e.id, dryRun);
          patch = {
            status: "review",
            match_confidence: "none",
            ledger_posted: jaNoRazao || lancou,
            match_reason: (perto.length === 0 ? "nenhum recebível em aberto com esse valor/vencimento" : `${perto.length} recebíveis possíveis — precisa escolher`) + (jaNoRazao ? " · dinheiro já lançado manualmente no razão (só classificar)" : lancou ? " · dinheiro já entrou no razão pelo extrato (falta só dizer de qual título é)" : "")
          };
          needsReview++;
          if (lancou) semTitulo++;
          revisar.push(`+${brl(e.amount_cents)} ${e.description || ""}`.trim());
        }
      }
      // 2d) débito: casa contra contas a pagar (valor + data), candidato único
      if (!patch && e.kind === "debit") {
        const valor = Math.abs(e.amount_cents) / 100;
        const { data: cands } = await supabase.from("financial_payables").select("id, description, due_date, amount, status").neq("status", "paid").eq("amount", valor);
        const perto = (cands || []).filter((c)=>c.due_date && dayDiff(c.due_date, e.entry_date) <= 5);
        if (perto.length === 1) {
          const c = perto[0];
          if (!dryRun) {
            await supabase.from("financial_payables").update({
              status: "paid",
              paid_date: e.entry_date,
              paid_amount: valor,
              updated_at: new Date().toISOString()
            }).eq("id", c.id);
          }
          await lancarNoRazao(supabase, e, "debit", `Pagamento Asaas: ${c.description || ""}`.trim(), "payable", c.id, dryRun);
          patch = {
            status: "matched",
            match_kind: "payable",
            match_id: c.id,
            match_confidence: "high",
            match_reason: `conta a pagar com valor e vencimento batendo (${c.description || ""})`.trim(),
            auto_settled: true,
            ledger_posted: true
          };
          autoMatched++;
          conciliados.push(`-${brl(Math.abs(e.amount_cents))} ${c.description || ""}`.trim());
        } else {
          const jaNoRazao = await jaLancadoManual(supabase, e.bank_id, "debit", Math.abs(e.amount_cents), e.entry_date);
          // Saída sem conta a pagar casada: o dinheiro SAIU do Asaas. Lança no
          // razão e deixa na fila só a classificação.
          const lancou = jaNoRazao ? false : await lancarNoRazao(supabase, e, "debit", `${rotulo(e)}${e.description ? ` — ${e.description}` : ""}`, "statement_entry", e.id, dryRun);
          patch = {
            status: "review",
            match_confidence: "none",
            ledger_posted: jaNoRazao || lancou,
            match_reason: (perto.length === 0 ? "nenhuma conta a pagar em aberto com esse valor/vencimento" : `${perto.length} contas possíveis — precisa escolher`) + (jaNoRazao ? " · dinheiro já lançado manualmente no razão (só classificar)" : lancou ? " · dinheiro já saiu no razão pelo extrato (falta só dizer de qual conta é)" : "")
          };
          needsReview++;
          if (lancou) semTitulo++;
          revisar.push(`-${brl(Math.abs(e.amount_cents))} ${e.description || ""}`.trim());
        }
      }
      if (patch && !dryRun) {
        await supabase.from("financial_statement_entries").update({
          ...patch,
          updated_at: new Date().toISOString()
        }).eq("id", e.id);
      }
    }
    // ── 2.5) Fila antiga: dinheiro que ficou de fora do razão ──────────────
    // Pendências já classificadas como "revisar" em rodadas anteriores nunca
    // tiveram o dinheiro lançado. Enquanto ninguém resolvia, o saldo ficava
    // errado. Lança agora — a classificação continua pendente.
    let filaQuitada = 0, filaQuitadaCents = 0;
    {
      const { data: atrasadas } = await supabase.from("financial_statement_entries")
        .select("*").eq("provider", "asaas").eq("status", "review").eq("ledger_posted", false)
        .order("entry_date", { ascending: true }).limit(300);
      for (const e of atrasadas || []) {
        const tipo = e.kind === "credit" ? "credit" : "debit";
        const bruto = Math.abs(e.amount_cents);
        const manual = await jaLancadoManual(supabase, e.bank_id, tipo, bruto, e.entry_date)
          || (tipo === "credit" && (await jaLancadoManual(supabase, e.bank_id, "credit", bruto - 199, e.entry_date)
            || await jaLancadoManual(supabase, e.bank_id, "credit", bruto - 398, e.entry_date)));
        const lancou = manual ? false : await lancarNoRazao(supabase, e, tipo, `${rotulo(e)}${e.description ? ` — ${e.description}` : ""}`, "statement_entry", e.id, dryRun);
        if (!dryRun && (manual || lancou)) {
          await supabase.from("financial_statement_entries").update({
            ledger_posted: true,
            match_reason: `${e.match_reason || ""}${e.match_reason ? " · " : ""}${manual ? "dinheiro já estava no razão (lançamento manual)" : "dinheiro lançado no razão pelo extrato — falta só classificar"}`.slice(0, 500),
            updated_at: new Date().toISOString()
          }).eq("id", e.id);
        }
        if (lancou) { filaQuitada++; filaQuitadaCents += tipo === "credit" ? bruto : -bruto; }
      }
    }

    // ── 3) Saldo real de cada conta Asaas ──────────────────────────────────
    // Lê /finance/balance de TODAS as contas cadastradas e grava o número real
    // no banco. Conta sem secret válida vira erro visível, não número velho
    // fingindo estar certo.
    const contas = [];
    {
      const { data: accs } = await supabase.from("asaas_accounts")
        .select("id, name, api_key_secret_name, bank_id, is_active").eq("is_active", true);
      // a conta principal usa ASAAS_API_KEY e pode não estar cadastrada
      const lista = (accs || []).filter((a) => a.bank_id);
      if (!lista.some((a) => a.bank_id === ASAAS_BANK_ID)) {
        lista.push({ id: null, name: "Asaas Principal", api_key_secret_name: "ASAAS_API_KEY", bank_id: ASAAS_BANK_ID });
      }
      // As chaves das contas extras não ficam nos secrets do projeto: quem as
      // cadastra (tenant-asaas-account) grava em tenant_integration_secrets.
      // Procurar só no Deno.env fazia a UNV Social parecer sem chave.
      const nomes = lista.map((a) => a.api_key_secret_name).filter(Boolean);
      const { data: guardadas } = nomes.length
        ? await supabase.from("tenant_integration_secrets")
            .select("secret_name, secret_value").eq("provider", "asaas").in("secret_name", nomes)
        : { data: [] };
      const noBanco = new Map((guardadas || []).filter((x) => x.secret_value).map((x) => [x.secret_name, x.secret_value]));

      for (const a of lista) {
        const key = (a.api_key_secret_name
          ? Deno.env.get(a.api_key_secret_name) || noBanco.get(a.api_key_secret_name)
          : null) || null;
        let saldo = null, erro = null;
        if (!key) {
          erro = `chave ${a.api_key_secret_name || "(não informada)"} não existe nem nos secrets nem em tenant_integration_secrets — saldo desta conta não pode ser conferido`;
        } else {
          try {
            const r = await fetch(`${ASAAS_BASE}/finance/balance`, { headers: { access_token: key, "Content-Type": "application/json" } });
            if (!r.ok) erro = `Asaas respondeu HTTP ${r.status}`;
            else saldo = cents((await r.json())?.balance);
          } catch (err) {
            erro = String(err?.message || err).slice(0, 160);
          }
        }
        const { data: bk } = await supabase.from("financial_banks")
          .select("name, current_balance_cents").eq("id", a.bank_id).maybeSingle();
        if (!dryRun) {
          await supabase.from("financial_banks").update({
            provider_balance_cents: saldo,
            provider_balance_at: new Date().toISOString(),
            provider_balance_error: erro
          }).eq("id", a.bank_id);
        }
        contas.push({
          bank_id: a.bank_id, conta: bk?.name || a.name,
          saldo_asaas: saldo, saldo_nexus: bk?.current_balance_cents ?? null,
          diferenca: saldo != null && bk ? saldo - Number(bk.current_balance_cents || 0) : null,
          erro
        });
      }
    }

    // Conta principal: é dela que a conciliação linha a linha cuida.
    const principal = contas.find((c) => c.bank_id === ASAAS_BANK_ID) || null;
    let providerBalance = principal?.saldo_asaas ?? null;
    let systemBalance = principal?.saldo_nexus ?? null;
    let diff = principal?.diferenca ?? null;

    // ── 3.1) Resíduo: o que sobrou depois de lançar TODO o extrato ──────────
    // Todo lançamento do extrato já está no razão neste ponto. Se ainda sobra
    // diferença, ela veio de fora do extrato (movimento mais antigo que a
    // janela lida, lançamento manual errado, saldo inicial). Vira UM lançamento
    // nomeado, não o antigo "ajuste automático" sem origem.
    let residuo = null;
    if (!dryRun && diff != null && Math.abs(diff) > 0) {
      const desc = `Resíduo da conciliação Asaas: saldo real ${brl(providerBalance)} contra ${brl(systemBalance)} no razão (${diff > 0 ? "+" : "-"}${brl(Math.abs(diff))}). Todo o extrato do período já foi lançado — esta diferença vem de fora do extrato.`;
      const { error: errMov } = await supabase.from("financial_bank_transactions").insert({
        bank_id: ASAAS_BANK_ID,
        type: diff > 0 ? "credit" : "debit",
        amount_cents: Math.abs(diff),
        description: desc,
        reference_type: "asaas_saldo_residuo"
      });
      if (!errMov) {
        await supabase.from("financial_banks").update({
          current_balance_cents: providerBalance,
          updated_at: new Date().toISOString()
        }).eq("id", ASAAS_BANK_ID);
        residuo = { cents: diff, descricao: desc };
        systemBalance = providerBalance;
        diff = 0;
      }
    }

    // A fila que sobrou é só classificação — dinheiro já entrou. Se algum item
    // ainda está sem razão, aparece aqui.
    const { data: fila } = await supabase.from("financial_statement_entries").select("amount_cents").eq("provider", "asaas").eq("status", "review").eq("ledger_posted", false);
    const filaCents = (fila || []).reduce((s, x)=>s + Number(x.amount_cents || 0), 0);
    const filaQtd = (fila || []).length;
    const { count: aClassificar } = await supabase.from("financial_statement_entries")
      .select("id", { count: "exact", head: true }).eq("provider", "asaas").eq("status", "review");
    const inexplicado = diff != null ? diff - filaCents : null;
    // ── 4) Registra a rodada e avisa ───────────────────────────────────────
    let aviso = {
      sent: false,
      reason: "dry run"
    };
    if (!dryRun) {
      const semSecret = contas.filter((c)=>c.erro);
      const houveNovidade = imported > 0 || autoMatched > 0 || needsReview > 0 || filaQuitada > 0 || residuo != null || semSecret.length > 0;
      if (houveNovidade) {
        const linhas = [
          "🏦 *Conciliação bancária — Asaas*",
          "",
          `📥 Lançamentos novos no extrato: ${imported}`,
          `✅ Conciliados automaticamente: ${autoMatched}`,
          feeCount ? `🧾 Taxas do Asaas identificadas: ${feeCount}` : "",
          transferCount ? `🔁 Transferências/antecipações: ${transferCount}` : "",
          semTitulo ? `💰 Lançados no razão sem título casado: ${semTitulo}` : "",
          filaQuitada ? `🧹 Pendências antigas que entraram no razão agora: ${filaQuitada} (${brl(filaQuitadaCents)})` : "",
          "",
          "*Saldo por conta*",
          ...contas.map((c)=> c.erro
            ? `• ${c.conta}: ❌ ${c.erro}`
            : `• ${c.conta}: Asaas ${brl(c.saldo_asaas)} · Nexus ${brl(c.saldo_nexus)}${c.bank_id === ASAAS_BANK_ID && residuo ? " (ajustado agora)" : c.diferenca ? ` · diferença ${brl(c.diferenca)}` : " ✔️"}`),
          "",
          residuo ? `🔧 Resíduo lançado: ${brl(residuo.cents)} — saldo do razão igualado ao Asaas` : (diff === 0 ? "✔️ Saldo do razão bate com o Asaas" : ""),
          inexplicado != null && Math.abs(inexplicado) > 1 ? `❗ Fora do extrato (investigar): ${brl(inexplicado)}` : "",
          aClassificar ? `\n📋 ${aClassificar} lançamento(s) no extrato ainda sem título. O dinheiro já está no saldo — falta só dizer de qual título é.` : "",
          conciliados.length ? "\n*Baixados automaticamente:*\n" + conciliados.slice(0, 8).map((s)=>`• ${s}`).join("\n") : "",
          revisar.length ? "\n*Aguardando classificação:*\n" + revisar.slice(0, 8).map((s)=>`• ${s}`).join("\n") : "",
          revisar.length > 8 ? `…e mais ${revisar.length - 8}` : "",
          "\nRevise aqui: unvholdings.com.br/#/onboarding-tasks/financeiro/recorrencias?tab=reconciliation"
        ].filter(Boolean);
        aviso = await avisar(supabase, linhas.join("\n"));
      } else {
        aviso = {
          sent: false,
          reason: "nada novo"
        };
      }
      await supabase.from("financial_reconciliation_runs").insert({
        provider: "asaas",
        imported,
        auto_matched: autoMatched,
        needs_review: needsReview,
        provider_balance_cents: providerBalance,
        system_balance_cents: systemBalance,
        diff_cents: diff,
        notified: aviso.sent,
        detail: aviso.sent ? null : aviso.reason || null
      });
    }
    return j({
      ok: true,
      imported,
      ja_conhecidos: seenExisting,
      auto_matched: autoMatched,
      needs_review: needsReview,
      taxas: feeCount,
      transferencias: transferCount,
      faturas: invoiceCount,
      sem_titulo_lancados: semTitulo,
      fila_antiga_quitada: filaQuitada,
      fila_antiga_cents: filaQuitadaCents,
      saldo_asaas: providerBalance,
      saldo_sistema: systemBalance,
      diferenca: diff,
      residuo,
      a_classificar: aClassificar ?? null,
      contas,
      aviso
    });
  } catch (e) {
    return j({
      ok: false,
      error: String(e.message || e)
    }, 500);
  }
});
