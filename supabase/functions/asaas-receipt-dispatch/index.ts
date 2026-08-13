// asaas-receipt-dispatch: quando um pagamento é RECEBIDO no Asaas, identifica de
// que conta se trata (fatura de cliente ou conta a receber já baixada no Nexus)
// e envia o comprovante em PDF no grupo de WhatsApp do BPO/consultoria.
//
// Regra do Fabrício: o comprovante SÓ vai pro grupo depois da baixa no sistema.
//   - baixa já existe (webhook deu baixa automática ou baixa manual) → envia.
//   - sem baixa → avisa o Fabrício uma única vez pra dar baixa; o cron fica
//     vigiando e, quando a baixa aparecer, envia o comprovante identificado.
//
// Não mexe no asaas-webhook (que movimenta dinheiro): roda como vigia separado,
// via cron, lendo os pagamentos recebidos direto da API do Asaas.
//
// Entradas:
//   {}                          → ciclo normal (cron)
//   { action: "diag" }          → testa a API e o formato do comprovante, sem enviar
//   { action: "test_group" }    → manda mensagem de teste no grupo configurado
//
// Secrets: ASAAS_API_KEY (já existe) · ASAAS_RECEIPT_GROUP_JID (grupo destino)
//          ASAAS_RECEIPT_INSTANCE (opcional; padrão financeirounv)
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AVISO_NUMERO = "5531989840003"; // Fabrício — mesmo destino dos avisos da conciliação
const AVISO_INSTANCE = "financeirounv";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brDate = (iso: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const FORMA: Record<string, string> = {
  PIX: "PIX", BOLETO: "Boleto", CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito", TRANSFER: "Transferência", DEPOSIT: "Depósito",
  RECEIVED_IN_CASH: "Recebido em dinheiro",
};

async function asaas(apiKey: string, path: string) {
  const resp = await fetch(`https://www.asaas.com/api/v3${path}`, {
    headers: { access_token: apiKey, "Content-Type": "application/json" },
  });
  if (!resp.ok) throw new Error(`Asaas ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

async function getInstance(supabase: any, name: string) {
  const { data } = await supabase.from("whatsapp_instances")
    .select("api_url, api_key, instance_name")
    .eq("instance_name", name).maybeSingle();
  if (!data?.api_url || !data?.api_key) return null;
  const base = String(data.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  return { base, key: data.api_key, name: data.instance_name };
}

async function sendText(inst: { base: string; key: string; name: string }, number: string, text: string) {
  const resp = await fetch(`${inst.base}/message/sendText/${inst.name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.key, Authorization: `Bearer ${inst.key}` },
    body: JSON.stringify({ number, text }),
  });
  return resp.ok;
}

async function sendPdf(inst: { base: string; key: string; name: string }, number: string, pdfB64: string, fileName: string, caption: string) {
  const resp = await fetch(`${inst.base}/message/sendMedia/${inst.name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.key, Authorization: `Bearer ${inst.key}` },
    body: JSON.stringify({
      number, mediatype: "document", mimetype: "application/pdf",
      media: pdfB64, fileName, caption,
    }),
  });
  const body = await resp.text();
  if (!resp.ok) console.error("[receipt] sendMedia falhou:", resp.status, body.slice(0, 200));
  return resp.ok;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

/** Comprovante em PDF: usa o oficial do Asaas se ele vier como PDF; senão gera
 *  um recibo UNV com os dados + link do comprovante oficial. */
async function buildReceiptPdf(p: {
  receiptUrl: string | null; customer: string; account: string;
  valueCents: number; billingType: string; paymentDate: string | null; paymentId: string;
}): Promise<Uint8Array> {
  if (p.receiptUrl) {
    try {
      const r = await fetch(p.receiptUrl, { redirect: "follow" });
      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.includes("pdf")) return new Uint8Array(await r.arrayBuffer());
    } catch { /* cai no gerado */ }
  }
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 560]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.05, 0.17, 0.37);
  const grey = rgb(0.35, 0.39, 0.45);

  page.drawRectangle({ x: 0, y: 500, width: 420, height: 60, color: navy });
  page.drawText("UNV — Comprovante de recebimento", { x: 24, y: 524, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Asaas · confirmado", { x: 24, y: 508, size: 9, font, color: rgb(0.75, 0.8, 0.9) });

  let y = 460;
  const row = (label: string, value: string, big = false) => {
    page.drawText(label.toUpperCase(), { x: 24, y, size: 8, font, color: grey });
    const lines = value.match(/.{1,52}(\s|$)|\S+/g) || [value];
    let yy = y - 15;
    for (const ln of lines.slice(0, 3)) {
      page.drawText(ln.trim(), { x: 24, y: yy, size: big ? 20 : 12, font: bold, color: navy });
      yy -= big ? 24 : 15;
    }
    y = yy - 8;
  };
  row("Valor", brl(p.valueCents), true);
  row("Referente a", p.account || "—");
  row("Pagador", p.customer || "—");
  row("Forma de pagamento", FORMA[p.billingType] || p.billingType || "—");
  row("Data do pagamento", brDate(p.paymentDate));
  row("Identificador Asaas", p.paymentId);
  if (p.receiptUrl) {
    page.drawText("Comprovante oficial:", { x: 24, y: 60, size: 8, font, color: grey });
    page.drawText(p.receiptUrl.slice(0, 70), { x: 24, y: 46, size: 8, font, color: navy });
  }
  return await doc.save();
}

/** A baixa existe? Devolve a descrição da conta quando sim. */
async function findBaixa(supabase: any, paymentId: string, valueCents: number, paymentDate: string | null) {
  // 1) fatura de cliente (o webhook grava o payment id em pagarme_charge_id)
  const { data: inv } = await supabase.from("company_invoices")
    .select("id, description, installment_number, total_installments, status, company:onboarding_companies(name)")
    .eq("pagarme_charge_id", paymentId).eq("status", "paid").limit(1).maybeSingle();
  if (inv) {
    const parc = inv.installment_number && inv.total_installments
      ? ` (parcela ${inv.installment_number}/${inv.total_installments})` : "";
    return {
      customer: inv.company?.name || "",
      account: `${inv.description || "Fatura"}${parc} — ${inv.company?.name || "cliente"}`,
    };
  }
  // 2) conta a receber com o payment id gravado
  const { data: rec } = await supabase.from("financial_receivables")
    .select("id, description, notes, status, custom_receiver_name")
    .eq("asaas_payment_id", paymentId).eq("status", "paid").limit(1).maybeSingle();
  if (rec) {
    return { customer: rec.custom_receiver_name || "", account: rec.description || "Conta a receber" };
  }
  // 3) baixa manual sem o payment id: valor exato + data de pagamento igual
  if (paymentDate) {
    const { data: manual } = await supabase.from("financial_receivables")
      .select("id, description, custom_receiver_name")
      .eq("status", "paid").eq("paid_date", paymentDate)
      .gte("paid_amount", (valueCents - 1) / 100).lte("paid_amount", (valueCents + 1) / 100)
      .is("asaas_payment_id", null).limit(2);
    if (manual?.length === 1) {
      // grava o vínculo pra próxima rodada não depender da heurística
      await supabase.from("financial_receivables")
        .update({ asaas_payment_id: paymentId }).eq("id", manual[0].id);
      return { customer: manual[0].custom_receiver_name || "", account: manual[0].description || "Conta a receber" };
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) return json({ error: "ASAAS_API_KEY não configurado" }, 500);
    const groupJid = (Deno.env.get("ASAAS_RECEIPT_GROUP_JID") || "").trim();
    const instName = (Deno.env.get("ASAAS_RECEIPT_INSTANCE") || AVISO_INSTANCE).trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "run");

    if (action === "diag") {
      const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
      const d = await asaas(apiKey, `/payments?status=RECEIVED&limit=3&paymentDate%5Bge%5D=${hoje}`);
      const first = d?.data?.[0] || null;
      let receiptContentType: string | null = null;
      if (first?.transactionReceiptUrl) {
        try {
          const r = await fetch(first.transactionReceiptUrl, { redirect: "follow" });
          receiptContentType = r.headers.get("content-type");
        } catch (e) { receiptContentType = `erro: ${String(e).slice(0, 80)}`; }
      }
      return json({
        ok: true,
        recebidos_hoje: d?.totalCount ?? 0,
        exemplo: first ? {
          id: first.id, value: first.value, billingType: first.billingType,
          paymentDate: first.paymentDate, tem_comprovante_url: !!first.transactionReceiptUrl,
        } : null,
        comprovante_content_type: receiptContentType,
        grupo_configurado: !!groupJid,
        instancia: instName,
      });
    }

    const inst = await getInstance(supabase, instName);
    const instAviso = instName === AVISO_INSTANCE ? inst : await getInstance(supabase, AVISO_INSTANCE);

    if (action === "test_group") {
      if (!groupJid) return json({ error: "ASAAS_RECEIPT_GROUP_JID não configurado" }, 400);
      if (!inst) return json({ error: `instância ${instName} indisponível` }, 500);
      const ok = await sendText(inst, groupJid, "Teste do envio automático de comprovantes Asaas — UNV Nexus. Pode ignorar.");
      return json({ ok, grupo: groupJid, instancia: instName });
    }

    // ── ciclo normal ─────────────────────────────────────────────────────────
    // 1) pagamentos recebidos nos últimos 2 dias (BRT)
    const desde = new Date(Date.now() - 3 * 3600000 - 2 * 86400000).toISOString().slice(0, 10);
    const recebidos: any[] = [];
    for (const st of ["RECEIVED", "RECEIVED_IN_CASH"]) {
      let offset = 0;
      for (let i = 0; i < 6; i++) {
        const d = await asaas(apiKey, `/payments?status=${st}&limit=100&offset=${offset}&paymentDate%5Bge%5D=${desde}`);
        recebidos.push(...(d?.data || []));
        if (!d?.hasMore) break;
        offset += 100;
      }
    }

    // 2) fila: o que ainda não foi visto entra; o que está aguardando é re-checado
    const ids = recebidos.map((p) => String(p.id));
    const { data: existentes } = ids.length
      ? await supabase.from("asaas_receipt_queue").select("asaas_payment_id, status").in("asaas_payment_id", ids)
      : { data: [] };
    const jaVistos = new Map((existentes || []).map((e: any) => [e.asaas_payment_id, e.status]));

    let enviados = 0, avisados = 0, aguardando = 0;
    const processar: { p: any; row: any | null }[] = [];

    for (const p of recebidos) {
      const st = jaVistos.get(String(p.id));
      if (st === "sent") continue;
      processar.push({ p, row: st ? { status: st } : null });
    }
    // também re-checa itens antigos ainda aguardando baixa (fora da janela de 2 dias)
    const { data: pendentes } = await supabase.from("asaas_receipt_queue")
      .select("asaas_payment_id").eq("status", "awaiting_baixa");
    const naJanela = new Set(processar.map((x) => String(x.p.id)));
    for (const pend of pendentes || []) {
      if (naJanela.has(pend.asaas_payment_id)) continue;
      try {
        const p = await asaas(apiKey, `/payments/${pend.asaas_payment_id}`);
        processar.push({ p, row: { status: "awaiting_baixa" } });
      } catch { /* pagamento sumiu; deixa quieto */ }
    }

    for (const { p, row } of processar) {
      const paymentId = String(p.id);
      const valueCents = Math.round((p.value || 0) * 100);
      const payDate = p.paymentDate || p.clientPaymentDate || null;

      const baixa = await findBaixa(supabase, paymentId, valueCents, payDate);

      // nome do pagador (só busca quando ainda não sabemos por outra via)
      let customer = baixa?.customer || "";
      if (!customer && p.customer) {
        try { customer = (await asaas(apiKey, `/customers/${p.customer}`))?.name || ""; } catch { /* segue sem nome */ }
      }

      if (!row) {
        await supabase.from("asaas_receipt_queue").insert({
          asaas_payment_id: paymentId, value_cents: valueCents,
          billing_type: p.billingType || null, payment_date: payDate,
          customer_name: customer || null, account_desc: baixa?.account || null,
          receipt_url: p.transactionReceiptUrl || null,
          status: baixa ? "ready" : "awaiting_baixa",
        });
      }

      if (!baixa) {
        // sem baixa: avisa o Fabrício uma única vez
        const { data: q } = await supabase.from("asaas_receipt_queue")
          .select("id, notified_at").eq("asaas_payment_id", paymentId).maybeSingle();
        if (q && !q.notified_at && instAviso) {
          const ok = await sendText(instAviso, AVISO_NUMERO,
            `Recebimento no Asaas SEM baixa no Nexus:\n\n` +
            `${brl(valueCents)} · ${FORMA[p.billingType] || p.billingType || "-"} · ${brDate(payDate)}\n` +
            `Pagador: ${customer || "não identificado"}\n\n` +
            `Dá a baixa no financeiro que eu envio o comprovante no grupo em seguida.`);
          if (ok) {
            await supabase.from("asaas_receipt_queue")
              .update({ notified_at: new Date().toISOString(), customer_name: customer || null, updated_at: new Date().toISOString() })
              .eq("id", q.id);
            avisados++;
          }
        }
        aguardando++;
        continue;
      }

      // baixa existe: envia no grupo (se o grupo já estiver configurado)
      if (!groupJid || !inst) {
        await supabase.from("asaas_receipt_queue")
          .update({ status: "ready", account_desc: baixa.account, customer_name: customer || null, updated_at: new Date().toISOString() })
          .eq("asaas_payment_id", paymentId);
        continue;
      }

      const pdf = await buildReceiptPdf({
        receiptUrl: p.transactionReceiptUrl || null, customer,
        account: baixa.account, valueCents, billingType: p.billingType || "",
        paymentDate: payDate, paymentId,
      });
      const caption =
        `Comprovante de recebimento\n\n` +
        `${baixa.account}\n` +
        `${brl(valueCents)} · ${FORMA[p.billingType] || p.billingType || "-"} · ${brDate(payDate)}` +
        (customer ? `\nPagador: ${customer}` : "");
      const ok = await sendPdf(inst, groupJid, b64(pdf), `comprovante-${paymentId}.pdf`, caption);
      if (ok) {
        await supabase.from("asaas_receipt_queue")
          .update({ status: "sent", sent_at: new Date().toISOString(), account_desc: baixa.account, customer_name: customer || null, updated_at: new Date().toISOString() })
          .eq("asaas_payment_id", paymentId);
        enviados++;
      }
    }

    return json({ ok: true, recebidos_na_janela: recebidos.length, enviados, avisados_sem_baixa: avisados, aguardando_baixa: aguardando, grupo_configurado: !!groupJid });
  } catch (err) {
    console.error("[asaas-receipt-dispatch] erro:", (err as Error)?.message || err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
