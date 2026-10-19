// trafego-pago-sync (19/10/2026): série DIÁRIA por campanha das contas Meta dos clientes
// (meta_ads_accounts, token por projeto) + situação da conta (status, saldo, forma de pagamento).
// Alimenta o menu "Tráfego pago" (RPC trafego_pago_painel). Fora do CI: deploy manual.
// Entrada: { days?: number (padrão 3), project_id?: uuid, dry_run?: boolean }
// Auth: header x-trafego-secret = TRAFEGO_SYNC_SECRET (cron) OU JWT de staff logado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trafego-secret" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const GRAPH = "https://graph.facebook.com/v21.0";
const STATUS: Record<number, string> = { 1: "Ativa", 2: "Desativada", 3: "Não liquidada", 7: "Em análise", 8: "Pagamento pendente", 9: "Período de carência", 100: "Fechamento pendente", 101: "Fechada", 201: "Ativa", 202: "Fechada" };

function saldoDoTexto(s: unknown): number | null {
  // "Saldo disponível (R$273,77 BRL)" → 273.77
  const m = String(s || "").match(/R\$\s?([\d.]+,\d{2}|[\d.]+)/);
  if (!m) return null;
  const t = m[1].includes(",") ? m[1].replace(/\./g, "").replace(",", ".") : m[1];
  const v = Number(t); return Number.isFinite(v) ? v : null;
}
function acoes(row: any) {
  const a: any[] = row?.actions || []; const av: any[] = row?.action_values || [];
  const v = (t: string) => Number((a.find((x) => x.action_type === t) || {}).value || 0);
  const vv = (t: string) => Number((av.find((x) => x.action_type === t) || {}).value || 0);
  return {
    leads: v("lead") || v("onsite_conversion.lead_grouped") || v("offsite_conversion.fb_pixel_lead"),
    conversas: v("onsite_conversion.messaging_conversation_started_7d") || v("onsite_conversion.total_messaging_connection"),
    compras: v("purchase") || v("omni_purchase") || v("offsite_conversion.fb_pixel_purchase") || v("onsite_web_purchase"),
    receita: vv("purchase") || vv("omni_purchase") || vv("offsite_conversion.fb_pixel_purchase") || vv("onsite_web_purchase"),
  };
}
async function graphTodas(url: string): Promise<any[]> {
  const out: any[] = []; let next: string | null = url; let voltas = 0;
  while (next && voltas < 40) {
    const r = await fetch(next, { signal: AbortSignal.timeout(60000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(String(d?.error?.message || `HTTP ${r.status}`).slice(0, 300));
    out.push(...(d.data || [])); next = d?.paging?.next || null; voltas++;
  }
  return out;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const segredo = Deno.env.get("TRAFEGO_SYNC_SECRET") || "";
    const viaSegredo = !!segredo && req.headers.get("x-trafego-secret") === segredo;
    if (!viaSegredo) {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } as any };
      if (!u?.user) return json({ ok: false, error: "não autorizado" }, 401);
      const { data: staff } = await sb.from("onboarding_staff").select("id").eq("user_id", u.user.id).eq("is_active", true).limit(1);
      if (!(staff || []).length) return json({ ok: false, error: "não autorizado" }, 403);
    }
    const body = await req.json().catch(() => ({} as any));
    const days = Math.min(Math.max(Number(body.days || 3), 1), 90);
    const dry = body.dry_run === true;
    const hoje = new Date(Date.now() - 3 * 3600000); // BRT
    const since = ymd(new Date(hoje.getTime() - days * 86400000)), until = ymd(hoje);

    let q = sb.from("meta_ads_accounts").select("id, project_id, ad_account_id, ad_account_name, access_token, is_connected").eq("is_connected", true);
    if (body.project_id) q = q.eq("project_id", body.project_id);
    const { data: contasBrutas } = await q;
    // A mesma conta Meta pode estar ligada a dois projetos da mesma empresa (Agile Save: 265fc3c9 e
    // 4963a31a). Sincronizar nos dois dobraria o gasto. Fica UM projeto por conta: o UNV Ads, senão o
    // mais recente. O outro só aparece como "mesma conta de outro projeto".
    const ids = [...new Set((contasBrutas || []).map((c: any) => c.project_id))];
    const { data: projs } = ids.length ? await sb.from("onboarding_projects").select("id, product_name, status").in("id", ids) : { data: [] as any[] };
    const prod = new Map((projs || []).map((p: any) => [p.id, p]));
    const porConta = new Map<string, any[]>();
    for (const c of contasBrutas || []) { const k = String(c.ad_account_id).replace(/^act_/, ""); porConta.set(k, [...(porConta.get(k) || []), c]); }
    const contas: any[] = []; const out: any[] = [];
    for (const lista of porConta.values()) {
      const ordem = [...lista].sort((a, b) => {
        const pa = prod.get(a.project_id), pb = prod.get(b.project_id);
        const sa = (pa?.product_name === "UNV Ads" ? 2 : 0) + (pa?.status === "active" ? 1 : 0);
        const sbb = (pb?.product_name === "UNV Ads" ? 2 : 0) + (pb?.status === "active" ? 1 : 0);
        return sbb - sa;
      });
      contas.push(ordem[0]);
      for (const dup of ordem.slice(1)) {
        out.push({ empresa: dup.ad_account_name, project_id: dup.project_id, ok: true, pulado: "mesma conta do projeto " + ordem[0].project_id });
        if (!dry) await sb.from("meta_ads_accounts").update({ sync_error: "mesma conta Meta já sincronizada em outro projeto desta empresa", last_synced_at: new Date().toISOString() }).eq("id", dup.id);
      }
    }
    for (const c of contas) {
      const actId = String(c.ad_account_id).startsWith("act_") ? c.ad_account_id : `act_${c.ad_account_id}`;
      const agora = new Date().toISOString();
      const res: any = { empresa: c.ad_account_name, project_id: c.project_id, de: since, ate: until };
      try {
        // 1) série diária por campanha
        const campos = "campaign_id,campaign_name,objective,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values";
        const url = `${GRAPH}/${actId}/insights?level=campaign&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&fields=${campos}&limit=500&access_token=${encodeURIComponent(c.access_token)}`;
        const linhas = await graphTodas(url);
        const regs = linhas.map((r) => {
          const a = acoes(r);
          return {
            project_id: c.project_id, dia: r.date_start, campaign_id: String(r.campaign_id), campaign_name: r.campaign_name || null, objective: r.objective || null,
            spend: Number(r.spend || 0), impressions: Number(r.impressions || 0), reach: Number(r.reach || 0), clicks: Number(r.clicks || 0),
            link_clicks: Number(r.inline_link_clicks || 0), leads: a.leads, conversas: a.conversas, compras: a.compras, receita: a.receita, synced_at: agora,
          };
        });
        res.linhas = regs.length; res.gasto = Math.round(regs.reduce((s, r) => s + r.spend, 0) * 100) / 100;
        res.leads = regs.reduce((s, r) => s + r.leads, 0); res.conversas = regs.reduce((s, r) => s + r.conversas, 0);
        if (!dry) {
          for (let i = 0; i < regs.length; i += 500) {
            const { error } = await sb.from("trafego_diario").upsert(regs.slice(i, i + 500), { onConflict: "project_id,campaign_id,dia" });
            if (error) throw new Error("gravar: " + error.message);
          }
        }
        // 2) situação da conta e saldo
        const r2 = await fetch(`${GRAPH}/${actId}?fields=name,account_status,disable_reason,amount_spent,spend_cap,balance,currency,is_prepay_account,funding_source_details&access_token=${encodeURIComponent(c.access_token)}`, { signal: AbortSignal.timeout(20000) });
        const d = await r2.json().catch(() => ({}));
        const patch: Record<string, unknown> = { last_synced_at: agora, sync_error: null };
        if (!r2.ok || d.error) {
          patch.balance_error = String(d?.error?.message || `HTTP ${r2.status}`).slice(0, 300); patch.balance_checked_at = agora;
        } else {
          const prepaga = d.is_prepay_account === true;
          const gasto = Number(d.amount_spent || 0) / 100, teto = Number(d.spend_cap || 0) / 100;
          let saldo: number | null = null;
          if (prepaga) { saldo = saldoDoTexto(d?.funding_source_details?.display_string); if (saldo == null && teto > 0) saldo = Math.max(0, Math.round((teto - gasto) * 100) / 100); }
          Object.assign(patch, {
            meta_account_status: Number(d.account_status) || null,
            meta_account_status_label: STATUS[Number(d.account_status)] || String(d.account_status ?? ""),
            is_prepaid: prepaga, available_balance: saldo, amount_owed: Number(d.balance || 0) / 100,
            funding_source: d?.funding_source_details?.display_string || null, currency: d.currency || null,
            balance_checked_at: agora, balance_error: null,
          });
          res.situacao = patch.meta_account_status_label; res.prepaga = prepaga; res.saldo = saldo; res.forma_pagamento = patch.funding_source;
        }
        if (!dry) await sb.from("meta_ads_accounts").update(patch).eq("id", c.id);
        res.ok = true;
      } catch (e) {
        const msg = String((e as Error).message || e).slice(0, 300);
        res.ok = false; res.erro = msg;
        if (!dry) await sb.from("meta_ads_accounts").update({ sync_error: msg, last_synced_at: agora }).eq("id", c.id);
      }
      out.push(res);
    }
    return json({ ok: true, contas: out.length, dry_run: dry, resultados: out });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
