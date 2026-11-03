// tmb-webhook — recebe os webhooks da TMB (Tem Mais no Boleto). Um endpoint só pros dois:
//  • Webhook VENDAS: objeto com status_pedido ("Efetivado" quando o cliente paga o boleto de entrada,
//    "Cancelado"). Casa com o pagamento do lead pelo código da oferta (code = fim do link) ou pelo
//    id curto que vai no título da oferta ("Nome · 1a2b3c4d").
//  • Webhook FINANCEIRO: array de { dados: { pedido_id, parcela, status_pagamento, repasse, ... } }.
//    "Recebido" lança a parcela no Contas a Receber já paga, com o valor do repasse. Dedup por parcela_id.
// Segurança: se o segredo TMB_WEBHOOK_SECRET existir, exige o cabeçalho x-tmb-token igual a ele
// (na TMB, o campo Chave = "x-tmb-token" e Valor = o segredo). Sempre responde 200 pra TMB não reenviar.
// Docs: .../portal-do-produtor/central-de-ajuda/produto/integracoes/vendas e /financeiro
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("TMB_WEBHOOK_SECRET") || "";
const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
const digits = (v: unknown) => String(v || "").replace(/\D/g, "");
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

async function acharPagamento(supabase: any, opts: { code?: string; titulo?: string; pedido?: string; documento?: string }) {
  const sel = "id, lead_id, status, amount_cents, description, url, provider_ref, installments, receivable_id, lead:crm_leads(name, document)";
  if (opts.pedido) {
    const { data } = await supabase.from("crm_lead_payments").select(sel).eq("provider", "tmb").like("provider_ref", `%:${opts.pedido}`).limit(1).maybeSingle();
    if (data) return data;
  }
  if (opts.code) {
    const { data } = await supabase.from("crm_lead_payments").select(sel).eq("provider", "tmb").or(`provider_ref.eq.${opts.code},provider_ref.like.${opts.code}:%`).limit(1).maybeSingle();
    if (data) return data;
  }
  const prefixo = (opts.titulo || "").match(/·\s*([0-9a-f]{8})\s*$/i)?.[1]?.toLowerCase();
  const doc = digits(opts.documento);
  if (prefixo || doc) {
    const { data: lista } = await supabase.from("crm_lead_payments").select(sel).eq("provider", "tmb").order("created_at", { ascending: false }).limit(300);
    const porId = prefixo ? (lista || []).find((p: any) => String(p.id).toLowerCase().startsWith(prefixo)) : null;
    if (porId) return porId;
    if (doc) {
      const porDoc = (lista || []).find((p: any) => digits(p.lead?.document) === doc && p.status !== "cancelled");
      if (porDoc) return porDoc;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return ok({ ok: false, error: "use POST" });
  if (WEBHOOK_SECRET) {
    const h = req.headers.get("x-tmb-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (h !== WEBHOOK_SECRET) return new Response(JSON.stringify({ ok: false, error: "token inválido" }), { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return ok({ ok: false, error: "JSON inválido" }); }

  try {
    // ── FINANCEIRO: parcelas ─────────────────────────────────────────────
    const itens = Array.isArray(body) ? body : (body?.dados ? [body] : null);
    if (itens) {
      const resultado: string[] = [];
      for (const it of itens) {
        const d = it?.dados || it;
        const pedido = String(d?.pedido_id || "");
        const parcelaId = String(d?.parcela_id || "");
        const status = String(d?.status_pagamento || "");
        if (!pedido || !parcelaId) { resultado.push("item sem pedido/parcela"); continue; }
        const pag = await acharPagamento(supabase, { pedido, documento: d?.cliente_documento });
        if (status !== "Recebido") { resultado.push(`parcela ${parcelaId}: ${status || "sem status"} (nada a lançar)`); continue; }
        // dedup: a parcela já foi lançada?
        const marca = `tmb_parcela:${parcelaId}`;
        const { data: ja } = await supabase.from("financial_receivables").select("id").ilike("notes", `%${marca}%`).limit(1);
        if (ja && ja.length) { resultado.push(`parcela ${parcelaId}: já lançada`); continue; }
        const repasse = Number(d?.repasse || 0);
        const bruto = Number(d?.valor_parcela_sem_juros || 0) || repasse;
        if (!(repasse > 0)) { resultado.push(`parcela ${parcelaId}: repasse zerado`); continue; }
        const pagoEm = String(d?.data_pagamento || "").slice(0, 10) || hojeBR();
        const nomeLead = pag?.lead?.name || d?.cliente || "cliente TMB";
        const totalParc = pag?.installments ? `/${pag.installments}` : "";
        const { data: rec } = await supabase.from("financial_receivables").insert({
          description: `TMB · ${nomeLead} · parcela ${d?.parcela ?? "?"}${totalParc}`,
          amount: bruto, due_date: String(d?.vencimento_parcela || "").slice(0, 10) || pagoEm,
          status: "paid", paid_date: pagoEm, paid_amount: repasse,
          fee_amount: Math.max(0, Math.round((bruto - repasse) * 100) / 100),
          payment_method: "BOLETO", payment_link: pag?.url || null, is_recurring: false,
          notes: `CRM · lead ${nomeLead} · pedido TMB ${pedido} · ${marca}`,
        }).select("id").single();
        // Crédito no banco "TMB" do Financeiro, se existir
        const { data: banco } = await supabase.from("financial_banks").select("id").ilike("name", "TMB%").limit(1).maybeSingle();
        if (banco?.id) {
          await supabase.from("financial_bank_transactions").insert({
            bank_id: banco.id, type: "credit", amount_cents: Math.round(repasse * 100),
            fee_cents: Math.max(0, Math.round((bruto - repasse) * 100)),
            description: `Repasse TMB — ${nomeLead} — parcela ${d?.parcela ?? "?"}${totalParc}`,
            reference_type: pag ? "crm_lead_payment" : "tmb_parcela", reference_id: pag?.id || null,
          });
        }
        if (pag && !pag.receivable_id && rec?.id) await supabase.from("crm_lead_payments").update({ receivable_id: rec.id }).eq("id", pag.id);
        resultado.push(`parcela ${parcelaId}: lançada (${repasse})`);
      }
      return ok({ ok: true, tipo: "financeiro", resultado });
    }

    // ── VENDAS: pedido efetivado / cancelado ─────────────────────────────
    const statusPedido = String(body?.status_pedido || "");
    const code = String(body?.code || "");
    const pedido = String(body?.pedido || body?.id || "");
    const pag = await acharPagamento(supabase, { code, titulo: body?.titulo, pedido, documento: body?.documento });
    if (!pag) return ok({ ok: true, tipo: "vendas", aviso: "pagamento do lead não encontrado", code, pedido });

    const novo = /efetiv/i.test(statusPedido) ? "paid" : /cancel/i.test(statusPedido) ? "cancelled" : null;
    const refBase = String(pag.provider_ref || code || "").split(":")[0];
    const upd: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      payer_email: body?.email || null,
      provider_ref: pedido ? `${refBase}:${pedido}` : pag.provider_ref,
    };
    if (novo) upd.status = novo;
    if (novo === "paid") upd.paid_at = body?.data_efetivado ? new Date(body.data_efetivado).toISOString() : new Date().toISOString();
    if (novo === "cancelled") upd.paid_at = null;
    await supabase.from("crm_lead_payments").update(upd).eq("id", pag.id);

    // Dados que a TMB coletou no checkout voltam pro cadastro do lead (sem sobrescrever)
    if (pag.lead_id && novo === "paid") {
      const { data: ld } = await supabase.from("crm_leads").select("email, document").eq("id", pag.lead_id).maybeSingle();
      const patch: Record<string, unknown> = {};
      if (!ld?.email && body?.email) patch.email = String(body.email);
      if (!digits(ld?.document) && digits(body?.documento)) patch.document = digits(body.documento);
      if (Object.keys(patch).length) await supabase.from("crm_leads").update(patch).eq("id", pag.lead_id);
    }
    return ok({ ok: true, tipo: "vendas", status: novo || statusPedido, pagamento: pag.id });
  } catch (e) {
    console.error("tmb-webhook erro", e);
    return ok({ ok: false, error: String((e as Error)?.message || e) });
  }
});
