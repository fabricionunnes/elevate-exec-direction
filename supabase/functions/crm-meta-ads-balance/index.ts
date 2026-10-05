// crm-meta-ads-balance — lê no Meta a situação e o saldo de cada conta de anúncios
// conectada ao CRM e grava em crm_meta_ads_accounts.
//
// Por quê: a conta UNV é pré-paga e ficou com saldo R$ 0,00 em 30/09/2026. As
// campanhas continuaram "ativas" sem entregar e ninguém foi avisado: o Nexus só
// sabia do gasto, não do saldo. Com isto o Painel de Controle mostra o saldo e
// alerta antes de zerar.
//
// Quem pode chamar: o cron (header x-meta-balance-secret) ou staff master/admin
// logado (botão "Atualizar agora" do painel).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("META_BALANCE_SECRET") || "";
const GRAPH = "https://graph.facebook.com/v21.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-meta-balance-secret",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const STATUS: Record<number, string> = {
  1: "Ativa", 2: "Desativada", 3: "Com pagamento pendente", 7: "Em análise de risco",
  8: "Aguardando pagamento", 9: "Em período de carência", 100: "Fechamento pendente", 101: "Fechada",
};

/** "Saldo disponível (R$1.234,56 BRL)" -> 1234.56 */
function saldoDoTexto(txt: string | undefined | null): number | null {
  if (!txt) return null;
  const m = String(txt).match(/([\d.]+,\d{2})/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // autorização: segredo do cron ou staff master/admin logado
    const viaSegredo = SECRET && req.headers.get("x-meta-balance-secret") === SECRET;
    if (!viaSegredo) {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } as any };
      if (!u?.user) return json({ ok: false, error: "não autorizado" }, 401);
      const { data: staff } = await supabase.from("onboarding_staff").select("role, is_active").eq("user_id", u.user.id).eq("is_active", true);
      if (!(staff || []).some((s: any) => s.role === "master" || s.role === "admin")) return json({ ok: false, error: "não autorizado" }, 403);
    }

    const { data: contas } = await supabase.from("crm_meta_ads_accounts").select("id, ad_account_id, access_token, ad_account_name").eq("is_connected", true);
    const out: any[] = [];
    for (const c of contas || []) {
      const act = String(c.ad_account_id).startsWith("act_") ? c.ad_account_id : `act_${c.ad_account_id}`;
      const agora = new Date().toISOString();
      try {
        const url = `${GRAPH}/${act}?fields=name,account_status,disable_reason,amount_spent,spend_cap,balance,currency,is_prepay_account,funding_source_details&access_token=${encodeURIComponent(c.access_token)}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) {
          const msg = String(d?.error?.message || `HTTP ${r.status}`).slice(0, 300);
          await supabase.from("crm_meta_ads_accounts").update({ balance_checked_at: agora, balance_error: msg }).eq("id", c.id);
          out.push({ conta: c.ad_account_name, ok: false, erro: msg });
          continue;
        }
        const prepaga = d.is_prepay_account === true;
        const gasto = Number(d.amount_spent || 0) / 100;
        const teto = Number(d.spend_cap || 0) / 100;
        // pré-paga: o que sobra é o texto "Saldo disponível"; se não vier, teto menos gasto
        let saldo: number | null = null;
        if (prepaga) {
          saldo = saldoDoTexto(d?.funding_source_details?.display_string);
          if (saldo == null && teto > 0) saldo = Math.max(0, Math.round((teto - gasto) * 100) / 100);
        }
        const patch = {
          meta_account_status: Number(d.account_status) || null,
          meta_account_status_label: STATUS[Number(d.account_status)] || String(d.account_status ?? ""),
          is_prepaid: prepaga,
          available_balance: saldo,
          amount_owed: Number(d.balance || 0) / 100,
          funding_source: d?.funding_source_details?.display_string || null,
          currency: d.currency || null,
          balance_checked_at: agora,
          balance_error: null,
        };
        await supabase.from("crm_meta_ads_accounts").update(patch).eq("id", c.id);
        out.push({ conta: c.ad_account_name, ok: true, situacao: patch.meta_account_status_label, pre_paga: prepaga, saldo, forma_pagamento: patch.funding_source });
      } catch (e) {
        const msg = String((e as Error)?.message || e).slice(0, 300);
        await supabase.from("crm_meta_ads_accounts").update({ balance_checked_at: agora, balance_error: msg }).eq("id", c.id);
        out.push({ conta: c.ad_account_name, ok: false, erro: msg });
      }
    }
    return json({ ok: true, contas: out });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
