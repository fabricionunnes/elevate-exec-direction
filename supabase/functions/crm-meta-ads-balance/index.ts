// crm-meta-ads-balance — lê no Meta a situação e o saldo de cada conta de anúncios
// conectada ao CRM e grava em crm_meta_ads_accounts.
//
// Por quê: a conta UNV é pré-paga e ficou com saldo R$ 0,00 em 30/09/2026. As
// campanhas continuaram "ativas" sem entregar e ninguém foi avisado: o Nexus só
// sabia do gasto, não do saldo. Com isto o Painel de Controle mostra o saldo e
// alerta antes de zerar.
//
// Aviso (Fabrício, 05/10/2026: "o Marcelo me avisar quando o saldo estiver
// acabando"): em conta pré-paga, compara o saldo com o gasto médio diário e
// manda WhatsApp pelo número do Marcelo quando está baixo (até 3 dias de
// campanha), crítico (até 1 dia) ou zerado, e quando é recarregado. Um aviso
// por mudança de nível e um lembrete por dia enquanto não resolver, só entre
// 8h e 20h de Brasília.
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

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const horaBrasilia = () => (new Date().getUTCHours() + 21) % 24;

// deno-lint-ignore no-explicit-any
async function enviarWhatsApp(supabase: any, phone: string, text: string): Promise<{ ok: boolean; via?: string }> {
  // sai pelo número do Marcelo; se ele estiver desconectado, pelo do Fabrício (mesmo padrão dos outros avisos)
  for (const nome of ["marceloalmeida", "fabricionunnes"]) {
    try {
      const { data: inst } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type")
        .eq("instance_name", nome).eq("status", "connected").maybeSingle();
      if (!inst?.api_url || !inst?.api_key) continue;
      let host = ""; try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
      const v2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
      const url = v2 ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text` : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key }, body: JSON.stringify({ number: phone, text }), signal: AbortSignal.timeout(20000) });
      if (r.ok) return { ok: true, via: nome };
    } catch (e) { console.error("[crm-meta-ads-balance] whatsapp", nome, String(e)); }
  }
  return { ok: false };
}

type Nivel = "ok" | "baixo" | "critico" | "zerado";
function nivelDoSaldo(saldo: number, mediaDia: number): { nivel: Nivel; dias: number | null } {
  const dias = mediaDia > 0 ? saldo / mediaDia : null;
  if (saldo <= 1) return { nivel: "zerado", dias: 0 };
  if ((dias != null && dias <= 1) || saldo < 50) return { nivel: "critico", dias };
  if ((dias != null && dias <= 3) || saldo < 150) return { nivel: "baixo", dias };
  return { nivel: "ok", dias };
}
function textoAviso(conta: string, nivel: Nivel, saldo: number, mediaDia: number, dias: number | null, ultimoGasto: string | null): string {
  const ritmo = mediaDia > 0 ? ` No ritmo atual, de ${brl(mediaDia)} por dia,` : "";
  const d = dias != null ? (dias < 1 ? " dura menos de um dia." : ` dura mais ${Math.floor(dias)} ${Math.floor(dias) === 1 ? "dia" : "dias"}.`) : "";
  if (nivel === "zerado") {
    const desde = ultimoGasto ? ` O último dia com entrega foi ${ultimoGasto.split("-").reverse().slice(0, 2).join("/")}.` : "";
    return `Fabrício, o saldo da conta ${conta} no Meta Ads zerou. As campanhas continuam ativas, mas sem crédito não entregam.${desde} Recarrega no Gerenciador de Anúncios pra voltar a captar lead.`;
  }
  if (nivel === "critico") return `Fabrício, o saldo da conta ${conta} no Meta Ads está no fim: ${brl(saldo)}.${ritmo}${d} Recarrega hoje pra campanha não parar.`;
  return `Fabrício, o saldo da conta ${conta} no Meta Ads está acabando: ${brl(saldo)}.${ritmo}${d} Vale recarregar pra não ficar sem captar lead.`;
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

    const opc = await req.json().catch(() => ({} as Record<string, unknown>));
    const dry = opc.dry_run === true;
    const { data: cfg } = await supabase.from("ai_usage_config").select("telefone").eq("id", true).maybeSingle();
    const telefone = String(cfg?.telefone || "5531989840003");
    const { data: contas } = await supabase.from("crm_meta_ads_accounts").select("id, ad_account_id, access_token, ad_account_name, balance_alert_level, balance_alert_at").eq("is_connected", true);
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

        // ── aviso de saldo (só conta pré-paga com saldo lido) ──
        let aviso: Record<string, unknown> | null = null;
        if (prepaga && saldo != null) {
          // gasto médio dos últimos 7 dias em que houve entrega (olhando 21 dias pra trás)
          const desde = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
          const { data: linhas } = await supabase.from("crm_meta_ads_campaigns").select("date_start, spend").eq("account_id", c.id).gte("date_start", desde).gt("spend", 0).limit(1000);
          const porDia = new Map<string, number>();
          for (const l of linhas || []) porDia.set(l.date_start, (porDia.get(l.date_start) || 0) + Number(l.spend || 0));
          const diasOrd = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]));
          const ult7 = diasOrd.slice(0, 7);
          const media = ult7.length ? Math.round((ult7.reduce((t, x) => t + x[1], 0) / ult7.length) * 100) / 100 : 0;
          const ultimoGasto = diasOrd[0]?.[0] || null;
          const { nivel, dias } = nivelDoSaldo(saldo, media);
          const anterior = (c.balance_alert_level || "ok") as Nivel;
          const horasDesde = c.balance_alert_at ? (Date.now() - new Date(c.balance_alert_at).getTime()) / 3600000 : Infinity;
          const h = horaBrasilia();
          const horarioOk = h >= 8 && h < 20;
          let texto = "";
          if (nivel !== "ok" && (nivel !== anterior || horasDesde >= 24)) texto = textoAviso(c.ad_account_name || "UNV", nivel, saldo, media, dias, ultimoGasto);
          else if (nivel === "ok" && anterior !== "ok") texto = `Fabrício, a conta ${c.ad_account_name || "UNV"} no Meta Ads foi recarregada. Saldo atual: ${brl(saldo)}.${media > 0 && dias != null ? ` No ritmo de ${brl(media)} por dia, dá pra uns ${Math.floor(dias)} dias.` : ""}`;
          aviso = { nivel, anterior, media_dia: media, dias_de_saldo: dias == null ? null : Math.round(dias * 10) / 10, texto: texto || null, enviado: false };
          if (texto && !dry && (horarioOk || opc.force === true)) {
            const env = await enviarWhatsApp(supabase, telefone, texto);
            aviso.enviado = env.ok; aviso.via = env.via || null;
            if (env.ok) await supabase.from("crm_meta_ads_accounts").update({ balance_alert_level: nivel, balance_alert_at: agora, daily_spend_avg: media }).eq("id", c.id);
          } else if (!dry) {
            await supabase.from("crm_meta_ads_accounts").update({ daily_spend_avg: media }).eq("id", c.id);
            if (texto && !horarioOk) aviso.motivo = "fora do horário (8h às 20h), sai na próxima checagem dentro do horário";
          }
        }
        out.push({ conta: c.ad_account_name, ok: true, situacao: patch.meta_account_status_label, pre_paga: prepaga, saldo, forma_pagamento: patch.funding_source, aviso });
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
