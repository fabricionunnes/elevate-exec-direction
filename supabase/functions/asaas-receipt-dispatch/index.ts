// asaas-receipt-dispatch: vigia as CONTAS A PAGAR pagas pelo Asaas (Pix,
// transferência, boleto), identifica de que conta se trata no Nexus e envia o
// comprovante em PDF no grupo de WhatsApp do BPO (BPO UNI VENDAS).
//
// Regra do Fabrício: o comprovante SÓ vai pro grupo depois da baixa no sistema.
//   - baixa existe em financial_payables → envia o comprovante identificado.
//   - sem baixa → avisa o Fabrício uma única vez pra dar baixa; o cron fica
//     vigiando e envia assim que a baixa aparecer.
// Só dinheiro SAINDO. Contas a receber ficam de fora (decisão de 13/08/2026).
//
// Fonte: extrato do Asaas (/financialTransactions), débitos TRANSFER e
// BILL_PAYMENT — a chave de API atual não tem permissão de "saque", então a
// lista de transferências (/transfers) fica indisponível; se essa permissão
// for liberada no painel do Asaas, o comprovante oficial passa a ser anexado
// automaticamente no lugar do recibo gerado.
//
// Entradas:
//   {}                       → ciclo normal (cron 87, a cada 15 min)
//   { action: "diag" }       → resumo do extrato recente, sem enviar nada
//   { action: "test_group" } → mensagem de teste no grupo configurado
//
// Secrets: ASAAS_API_KEY (existe) · ASAAS_RECEIPT_GROUP_JID (grupo destino)
//          ASAAS_RECEIPT_INSTANCE (padrão financeirounv)
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AVISO_NUMERO = "5531989840003"; // Fabrício — mesmo destino dos avisos da conciliação
const AVISO_INSTANCE = "financeirounv";

// débitos do extrato que são pagamento de verdade (taxas e antecipação ficam fora)
const PAY_TYPES = new Set(["TRANSFER", "BILL_PAYMENT", "PIX_TRANSACTION_DEBIT"]);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const brl = (cents: number) =>
  (Math.abs(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brDate = (iso: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** "Transação via Pix com chave para FULANO DA SILVA" → { forma, beneficiario } */
function parseDescricao(descr: string, entryType: string) {
  const d = descr || "";
  const m = d.match(/\bpara\s+(.{3,60})$/i);
  const beneficiario = m ? m[1].trim() : "";
  let forma = "Transferência";
  if (/pix/i.test(d)) forma = "Pix";
  else if (entryType === "BILL_PAYMENT" || /pagamento de conta|boleto/i.test(d)) forma = "Boleto / pagamento de conta";
  return { forma, beneficiario };
}

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

/** comprovante oficial do Asaas. Fontes, em ordem:
 *  1) asaas_transfer_receipts — alimentada pelo webhook TRANSFER_DONE/BILL_PAYMENT
 *  2) API /transfers (se a chave ganhar a permissão de saque)
 *  Sem oficial em PDF, cai no recibo UNV gerado. */
async function fetchAsPdf(url: string): Promise<Uint8Array | null> {
  try {
    for (const u of [url.replace(/\/$/, "") + "/pdf", url]) {
      const r = await fetch(u, { redirect: "follow", headers: { Accept: "application/pdf" } });
      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.includes("pdf")) return new Uint8Array(await r.arrayBuffer());
    }
  } catch { /* segue */ }
  return null;
}

async function officialReceipt(supabase: any, apiKey: string, valueCents: number, date: string): Promise<Uint8Array | null> {
  // 1) webhook já entregou o comprovante desta transferência?
  const { data: wr } = await supabase.from("asaas_transfer_receipts")
    .select("receipt_url").eq("value_cents", Math.abs(valueCents))
    .gte("transfer_date", new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10))
    .lte("transfer_date", new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10))
    .not("receipt_url", "is", null).limit(2);
  if (wr?.length === 1) {
    const pdf = await fetchAsPdf(wr[0].receipt_url);
    if (pdf) return pdf;
  }
  // 2) API direta (precisa da permissão de saque na chave)
  try {
    const d = await asaas(apiKey, `/transfers?dateCreated%5Bge%5D=${date}&dateCreated%5Ble%5D=${date}&limit=50`);
    const alvo = (d?.data || []).find((t: any) => Math.round((t.value || 0) * 100) === Math.abs(valueCents));
    if (alvo?.transactionReceiptUrl) {
      const pdf = await fetchAsPdf(alvo.transactionReceiptUrl);
      if (pdf) return pdf;
    }
  } catch { /* sem permissão de saque: segue com o recibo gerado */ }
  return null;
}

async function buildReceiptPdf(p: {
  account: string; beneficiario: string; valueCents: number;
  forma: string; paymentDate: string | null; txId: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 560]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.05, 0.17, 0.37);
  const grey = rgb(0.35, 0.39, 0.45);

  page.drawRectangle({ x: 0, y: 500, width: 420, height: 60, color: navy });
  page.drawText("UNV — Comprovante de pagamento", { x: 24, y: 524, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Asaas · débito confirmado no extrato", { x: 24, y: 508, size: 9, font, color: rgb(0.75, 0.8, 0.9) });

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
  row("Valor pago", brl(p.valueCents), true);
  row("Referente a", p.account || "—");
  row("Pago a", p.beneficiario || "—");
  row("Forma", p.forma);
  row("Data do pagamento", brDate(p.paymentDate));
  row("Identificador (extrato Asaas)", p.txId);
  page.drawText("Pagador: UNV Holdings — conta Asaas", { x: 24, y: 46, size: 8, font, color: grey });
  return await doc.save();
}

/** A baixa da conta a pagar existe? Devolve a descrição quando sim. */
async function findBaixaPagar(supabase: any, txId: string, valueCents: number, payDate: string | null, ambiguous = false) {
  // 1) já vinculada a este débito do extrato
  const { data: linked } = await supabase.from("financial_payables")
    .select("id, supplier_name, description")
    .eq("asaas_transaction_id", txId).eq("status", "paid").limit(1).maybeSingle();
  if (linked) {
    return { account: [linked.description, linked.supplier_name].filter(Boolean).join(" — ") || "Conta a pagar" };
  }
  // 2) baixa manual: valor pago igual e data de pagamento igual (ou véspera —
  //    baixa lançada no dia seguinte ao débito é comum). Com DOIS débitos de
  //    mesmo valor na janela, não arrisca: já amarrou processo trabalhista no
  //    Pix do Facebook (05/08, dois Pix de R$ 1.500 no mesmo dia).
  if (payDate && !ambiguous) {
    const abs = Math.abs(valueCents);
    const { data: cands } = await supabase.from("financial_payables")
      .select("id, supplier_name, description, paid_date")
      .eq("status", "paid").is("asaas_transaction_id", null)
      .gte("paid_amount", (abs - 1) / 100).lte("paid_amount", (abs + 1) / 100)
      .gte("paid_date", new Date(new Date(payDate).getTime() - 86400000).toISOString().slice(0, 10))
      .lte("paid_date", new Date(new Date(payDate).getTime() + 2 * 86400000).toISOString().slice(0, 10))
      .limit(2);
    if (cands?.length === 1) {
      await supabase.from("financial_payables")
        .update({ asaas_transaction_id: txId }).eq("id", cands[0].id);
      return { account: [cands[0].description, cands[0].supplier_name].filter(Boolean).join(" — ") || "Conta a pagar" };
    }
  }
  return null;
}

/** contas agregadas (pró-labore, verba de tráfego): uma conta a pagar baixada
 *  no total do mês ↔ várias transferências parciais no extrato. O casamento é
 *  pelo beneficiário, via asaas_receipt_rules. */
function matchRule(rules: { beneficiary_pattern: string; account_label: string }[], beneficiario: string) {
  const b = (beneficiario || "").toLowerCase();
  if (!b) return null;
  const r = rules.find((x) => b.includes(x.beneficiary_pattern.toLowerCase()));
  return r ? { account: r.account_label } : null;
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

    // extrato dos últimos 3 dias (BRT)
    const desde = new Date(Date.now() - 3 * 3600000 - 3 * 86400000).toISOString().slice(0, 10);
    const fetchDebitos = async () => {
      const rows: any[] = [];
      for (let page = 0; page < 6; page++) {
        const d = await asaas(apiKey, `/financialTransactions?limit=100&offset=${page * 100}&startDate=${desde}`);
        const data = d?.data || [];
        rows.push(...data);
        if (!d?.hasMore) break;
      }
      return rows.filter((t) =>
        Math.round((t.value || 0) * 100) < 0 && PAY_TYPES.has(String(t.type || t.transactionType || "")));
    };

    const { data: rulesData } = await supabase.from("asaas_receipt_rules")
      .select("beneficiary_pattern, account_label").eq("active", true);
    const rules = (rulesData || []) as { beneficiary_pattern: string; account_label: string }[];

    if (action === "list") {
      // lista os pagamentos desde uma data, com a conta identificada quando houver baixa
      const ini = String(body.since || "").slice(0, 10) || desde;
      const rows: any[] = [];
      for (let page = 0; page < 12; page++) {
        const d = await asaas(apiKey, `/financialTransactions?limit=100&offset=${page * 100}&startDate=${ini}`);
        rows.push(...(d?.data || []));
        if (!d?.hasMore) break;
      }
      const debs = rows.filter((t) =>
        Math.round((t.value || 0) * 100) < 0 && PAY_TYPES.has(String(t.type || t.transactionType || "")));
      const contagem = new Map<number, number>();
      for (const t of debs) {
        const v = Math.round((t.value || 0) * 100);
        contagem.set(v, (contagem.get(v) || 0) + 1);
      }
      const out = [];
      for (const t of debs) {
        const txId = String(t.id);
        const valueCents = Math.round((t.value || 0) * 100);
        const payDate = String(t.date || "").slice(0, 10) || null;
        const { forma, beneficiario } = parseDescricao(String(t.description || ""), String(t.type || ""));
        const baixa = await findBaixaPagar(supabase, txId, valueCents, payDate, (contagem.get(valueCents) || 0) > 1)
          || matchRule(rules, beneficiario);
        out.push({ id: txId, valor_cents: valueCents, data: payDate, forma, beneficiario,
                   conta: baixa?.account || null, tem_baixa: !!baixa });
      }
      return json({ ok: true, desde: ini, pagamentos: out });
    }

    if (action === "diag") {
      const deb = await fetchDebitos();
      return json({
        ok: true,
        janela_desde: desde,
        debitos_de_pagamento: deb.length,
        exemplos: deb.slice(0, 4).map((t) => ({
          id: t.id, valor: t.value, tipo: t.type || t.transactionType,
          data: t.date, descricao: String(t.description || "").slice(0, 70),
        })),
        grupo_configurado: !!groupJid,
        instancia: instName,
      });
    }

    const inst = await getInstance(supabase, instName);
    const instAviso = instName === AVISO_INSTANCE ? inst : await getInstance(supabase, AVISO_INSTANCE);

    if (action === "test_group") {
      if (!groupJid) return json({ error: "ASAAS_RECEIPT_GROUP_JID não configurado" }, 400);
      if (!inst) return json({ error: `instância ${instName} indisponível` }, 500);
      const ok = await sendText(inst, groupJid, "Teste do envio automático de comprovantes de pagamento (Asaas) — UNV Nexus. Pode ignorar.");
      return json({ ok, grupo: groupJid, instancia: instName });
    }

    // ── lote de envio (17h, ou manual com {since}) ──────────────────────────
    if (action === "send_ready") {
      if (!groupJid) return json({ error: "ASAAS_RECEIPT_GROUP_JID não configurado" }, 400);
      if (!inst) return json({ error: `instância ${instName} indisponível` }, 500);
      const ini = String(body.since || "").slice(0, 10) || desde;
      const rows: any[] = [];
      for (let page = 0; page < 12; page++) {
        const d = await asaas(apiKey, `/financialTransactions?limit=100&offset=${page * 100}&startDate=${ini}`);
        rows.push(...(d?.data || []));
        if (!d?.hasMore) break;
      }
      const debs = rows.filter((t) =>
        Math.round((t.value || 0) * 100) < 0 && PAY_TYPES.has(String(t.type || t.transactionType || "")));
      const contagem = new Map<number, number>();
      for (const t of debs) {
        const v = Math.round((t.value || 0) * 100);
        contagem.set(v, (contagem.get(v) || 0) + 1);
      }
      const idsAll = debs.map((t) => String(t.id));
      const { data: fila } = idsAll.length
        ? await supabase.from("asaas_receipt_queue").select("asaas_payment_id, status").in("asaas_payment_id", idsAll)
        : { data: [] };
      const statusPorId = new Map((fila || []).map((e: any) => [e.asaas_payment_id, e.status]));

      let mandados = 0, pulados = 0, semBaixaCt = 0;
      for (const t of debs) {
        const txId = String(t.id);
        if (statusPorId.get(txId) === "sent") { pulados++; continue; }
        const valueCents = Math.round((t.value || 0) * 100);
        const payDate = String(t.date || "").slice(0, 10) || null;
        const { forma, beneficiario } = parseDescricao(String(t.description || ""), String(t.type || ""));
        const baixa = await findBaixaPagar(supabase, txId, valueCents, payDate, (contagem.get(valueCents) || 0) > 1)
          || matchRule(rules, beneficiario);
        // include_pending: manda também o que ainda não tem baixa (o texto fica
        // com o beneficiário do extrato no lugar da conta interna)
        if (!baixa && !body.include_pending) { semBaixaCt++; continue; }

        const rotulo = baixa?.account || beneficiario || forma;
        const oficial = payDate ? await officialReceipt(supabase, apiKey, valueCents, payDate) : null;
        const pdf = oficial || await buildReceiptPdf({
          account: baixa?.account || `Pagamento a ${beneficiario || "beneficiário não identificado"}`,
          beneficiario, valueCents, forma, paymentDate: payDate, txId,
        });
        const caption =
          `${rotulo}\n` +
          `${brl(valueCents)} · ${forma} · ${brDate(payDate)}` +
          (baixa && beneficiario ? `\nPago a: ${beneficiario}` : "");
        const ok = await sendPdf(inst, groupJid, b64(pdf), `comprovante-${txId.replace(/[^\w-]/g, "")}.pdf`, caption);
        if (ok) {
          const registro = {
            asaas_payment_id: txId, value_cents: valueCents, billing_type: forma,
            payment_date: payDate, customer_name: beneficiario || null,
            account_desc: baixa?.account || null, status: "sent",
            sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          };
          if (statusPorId.has(txId)) {
            await supabase.from("asaas_receipt_queue").update(registro).eq("asaas_payment_id", txId);
          } else {
            await supabase.from("asaas_receipt_queue").insert(registro);
          }
          mandados++;
          await new Promise((r) => setTimeout(r, 1500)); // respiro entre mensagens no grupo
        }
      }
      return json({ ok: true, desde: ini, enviados: mandados, ja_enviados_antes: pulados, sem_baixa: semBaixaCt });
    }

    // ── ciclo normal ─────────────────────────────────────────────────────────
    const debitos = await fetchDebitos();

    const ids = debitos.map((t) => String(t.id));
    const { data: existentes } = ids.length
      ? await supabase.from("asaas_receipt_queue").select("asaas_payment_id, status").in("asaas_payment_id", ids)
      : { data: [] };
    const jaVistos = new Map((existentes || []).map((e: any) => [e.asaas_payment_id, e.status]));

    const processar: { t: any; novo: boolean }[] = [];
    for (const t of debitos) {
      const st = jaVistos.get(String(t.id));
      if (st === "sent") continue;
      processar.push({ t, novo: !st });
    }
    // re-checa pendências antigas fora da janela
    const naJanela = new Set(processar.map((x) => String(x.t.id)));
    const { data: pendentes } = await supabase.from("asaas_receipt_queue")
      .select("asaas_payment_id, value_cents, payment_date, account_desc, customer_name, billing_type")
      .in("status", ["awaiting_baixa", "ready"]);
    for (const pend of pendentes || []) {
      if (naJanela.has(pend.asaas_payment_id)) continue;
      processar.push({
        t: {
          id: pend.asaas_payment_id, value: pend.value_cents / 100, date: pend.payment_date,
          type: "TRANSFER", description: pend.customer_name ? `para ${pend.customer_name}` : "",
        }, novo: false,
      });
    }

    let enviados = 0, avisados = 0, aguardando = 0;
    const semBaixa: { qId: string; linha: string }[] = [];
    const contagem = new Map<number, number>();
    for (const { t } of processar) {
      const v = Math.round((t.value || 0) * 100);
      contagem.set(v, (contagem.get(v) || 0) + 1);
    }
    for (const { t, novo } of processar) {
      const txId = String(t.id);
      const valueCents = Math.round((t.value || 0) * 100);
      const payDate = String(t.date || "").slice(0, 10) || null;
      const { forma, beneficiario } = parseDescricao(String(t.description || ""), String(t.type || ""));

      const baixa = await findBaixaPagar(supabase, txId, valueCents, payDate, (contagem.get(valueCents) || 0) > 1)
        || matchRule(rules, beneficiario);

      if (novo) {
        await supabase.from("asaas_receipt_queue").insert({
          asaas_payment_id: txId, value_cents: valueCents,
          billing_type: forma, payment_date: payDate,
          customer_name: beneficiario || null, account_desc: baixa?.account || null,
          status: baixa ? "ready" : "awaiting_baixa",
        });
      }

      if (!baixa) {
        const { data: q } = await supabase.from("asaas_receipt_queue")
          .select("id, notified_at").eq("asaas_payment_id", txId).maybeSingle();
        if (q && !q.notified_at) {
          // acumula pra avisar tudo numa mensagem só no fim do ciclo
          semBaixa.push({ qId: q.id, linha: `• ${brl(valueCents)} · ${forma} · ${brDate(payDate)}${beneficiario ? ` · ${beneficiario}` : ""}` });
        }
        aguardando++;
        continue;
      }

      // com baixa: fica pronto; quem envia é o lote diário das 17h (send_ready)
      await supabase.from("asaas_receipt_queue")
        .update({ status: "ready", account_desc: baixa.account, updated_at: new Date().toISOString() })
        .eq("asaas_payment_id", txId);
    }

    // um aviso só, com todos os pagamentos sem baixa deste ciclo
    if (semBaixa.length && instAviso) {
      const cab = semBaixa.length === 1
        ? "Pagamento no Asaas SEM baixa no contas a pagar:"
        : `${semBaixa.length} pagamentos no Asaas SEM baixa no contas a pagar:`;
      const ok = await sendText(instAviso, AVISO_NUMERO,
        `${cab}\n\n${semBaixa.map((x) => x.linha).join("\n")}\n\n` +
        `Dá a baixa no financeiro que eu envio os comprovantes no grupo do BPO em seguida.`);
      if (ok) {
        for (const x of semBaixa) {
          await supabase.from("asaas_receipt_queue")
            .update({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", x.qId);
        }
        avisados = semBaixa.length;
      }
    }

    return json({ ok: true, debitos_na_janela: debitos.length, enviados, avisados_sem_baixa: avisados, aguardando_baixa: aguardando, grupo_configurado: !!groupJid });
  } catch (err) {
    console.error("[asaas-receipt-dispatch] erro:", (err as Error)?.message || err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
