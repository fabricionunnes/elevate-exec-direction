// commission-engine — apura a comissão por resultado do cliente.
// Roda no dia 1 (cron): olha a competência do mês ANTERIOR, compara realizado
// x meta do KPI escolhido, acha a MAIOR faixa atingida e gera a fatura da
// empresa vencendo no dia configurado (padrão 5) do mês ATUAL.
// Idempotente por (regra, competência) — rodar de novo não duplica fatura.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// "agora" em Brasília
const nowBRT = () => new Date(Date.now() - 3 * 3600000);
const ymOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

interface Tier { id: string; threshold: number; payout_cents: number; label: string | null }

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtKpi = (v: number, t: string) =>
  t === "monetary" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : t === "percentage" ? `${v.toFixed(1)}%`
    : v.toLocaleString("pt-BR");

// Avisa o cliente na hora que a fatura nasce: o que era a meta, o que ele
// entregou, quanto é a comissão e o link pra pagar. Deixa explícito que é
// pontual — só nos meses em que a meta é batida.
async function avisarCliente(
  supabase: any,
  opts: {
    companyId: string; kpiName: string; kpiType: string; meta: number; realizado: number; pct: number;
    payoutCents: number; dueDate: string; competencia: string; token: string | null; tierLabel: string | null;
  },
) {
  try {
    const { data: comp } = await supabase.from("onboarding_companies")
      .select("name, owner_name, owner_phone, phone").eq("id", opts.companyId).maybeSingle();
    const raw = String(comp?.owner_phone || comp?.phone || "").replace(/\D/g, "");
    if (!raw || raw.length < 10) return { sent: false, reason: "empresa sem telefone" };
    const phone = raw.startsWith("55") ? raw : `55${raw}`;

    const { data: cfg } = await supabase.from("whatsapp_default_config")
      .select("setting_value").eq("setting_key", "default_instance").maybeSingle();
    const { data: inst } = cfg?.setting_value
      ? await supabase.from("whatsapp_instances")
          .select("api_url, api_key, instance_name").eq("instance_name", cfg.setting_value).eq("status", "connected").maybeSingle()
      : { data: null };
    if (!inst?.api_url || !inst?.api_key) return { sent: false, reason: "sem instância padrão conectada" };

    const [cy, cm] = opts.competencia.split("-");
    const compLabel = `${cm}/${cy}`;
    const venc = opts.dueDate.split("-").reverse().join("/");
    const link = opts.token ? `https://unvholdings.com.br/fatura?token=${opts.token}` : null;
    const nome = String(comp?.owner_name || comp?.name || "").split(" ")[0];

    const msg =
      `Parabéns${nome ? `, ${nome}` : ""}! 🏆\n\n` +
      `A meta de *${opts.kpiName}* foi batida em ${compLabel}${opts.tierLabel ? ` (faixa ${opts.tierLabel})` : ""}.\n\n` +
      `🎯 *Meta:* ${fmtKpi(opts.meta, opts.kpiType)}\n` +
      `✅ *Realizado:* ${fmtKpi(opts.realizado, opts.kpiType)}${opts.meta > 0 ? ` (${opts.pct.toFixed(0)}% da meta)` : ""}\n` +
      `💰 *Comissão por resultado:* ${brl(opts.payoutCents)}\n` +
      `📅 *Vencimento:* ${venc}\n\n` +
      (link ? `Para pagar, é só acessar:\n🔗 ${link}\n\n` : "") +
      `Essa cobrança não é mensal: ela só acontece nos meses em que a meta é batida. Seguimos juntos! 🚀`;

    const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key, Authorization: `Bearer ${inst.api_key}` },
      body: JSON.stringify({ number: phone, text: msg }),
    });
    if (!r.ok) return { sent: false, reason: `whatsapp ${r.status}: ${(await r.text()).slice(0, 120)}` };
    return { sent: true, phone };
  } catch (e) {
    return { sent: false, reason: String((e as Error).message || e).slice(0, 160) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({} as any));
  const dryRun = !!body.dry_run;

  // competência apurada: mês anterior ao de hoje (ou a passada em month_year)
  const today = nowBRT();
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const competencia: string = body.month_year || ymOf(prev);
  const [cy, cm] = competencia.split("-").map(Number);
  const monthStart = `${competencia}-01`;
  const monthEnd = `${competencia}-${String(new Date(Date.UTC(cy, cm, 0)).getUTCDate()).padStart(2, "0")}`;

  let rulesQ = supabase.from("company_commission_rules")
    .select("id, company_id, kpi_id, basis, is_active, description, due_day, send_whatsapp")
    .eq("is_active", true);
  if (body.company_id) rulesQ = rulesQ.eq("company_id", body.company_id);
  const { data: rules, error: rErr } = await rulesQ;
  if (rErr) return j({ ok: false, error: rErr.message }, 500);

  const results: any[] = [];

  for (const rule of rules || []) {
    try {
      // já apurado nessa competência? não repete (a não ser em dry_run)
      const { data: prevRun } = await supabase.from("company_commission_runs")
        .select("id, status, payout_cents, invoice_id").eq("rule_id", rule.id).eq("month_year", competencia).maybeSingle();
      if (prevRun && !dryRun) { results.push({ company_id: rule.company_id, skip: "já apurado", run: prevRun.id }); continue; }

      const { data: kpi } = await supabase.from("company_kpis")
        .select("id, name, kpi_type").eq("id", rule.kpi_id).maybeSingle();
      if (!kpi) { results.push({ company_id: rule.company_id, skip: "KPI não encontrado" }); continue; }

      // realizado do mês (soma dos lançamentos do KPI, empresa toda)
      let realizado = 0;
      let from = 0;
      while (true) {
        const { data: page } = await supabase.from("kpi_entries")
          .select("value").eq("company_id", rule.company_id).eq("kpi_id", rule.kpi_id)
          .gte("entry_date", monthStart).lte("entry_date", monthEnd)
          .order("id").range(from, from + 999);
        if (!page?.length) break;
        realizado += page.reduce((s: number, r: any) => s + Number(r.value || 0), 0);
        if (page.length < 1000) break;
        from += 1000;
      }

      // meta do mês: nível "Meta" da empresa (sem recorte por vendedor/equipe);
      // se não houver linha geral, soma as metas por vendedor — mesma leitura do quadro.
      const { data: targets } = await supabase.from("kpi_monthly_targets")
        .select("target_value, level_name, salesperson_id, unit_id, team_id, sector_id")
        .eq("company_id", rule.company_id).eq("kpi_id", rule.kpi_id).eq("month_year", competencia);
      const isMetaLevel = (n: string) => (n || "").toLowerCase().trim() === "meta";
      const geral = (targets || []).filter((t: any) => isMetaLevel(t.level_name) && !t.salesperson_id && !t.unit_id && !t.team_id && !t.sector_id);
      const porVendedor = (targets || []).filter((t: any) => isMetaLevel(t.level_name) && t.salesperson_id);
      const meta = geral.length
        ? Number(geral[0].target_value || 0)
        : porVendedor.reduce((s: number, t: any) => s + Number(t.target_value || 0), 0);

      const pct = meta > 0 ? (realizado / meta) * 100 : 0;

      const { data: tiersRaw } = await supabase.from("company_commission_tiers")
        .select("id, threshold, payout_cents, label").eq("rule_id", rule.id).order("threshold", { ascending: true });
      const tiers = (tiersRaw || []) as Tier[];

      // base da faixa: % da meta ou valor absoluto do KPI
      const medida = rule.basis === "value" ? realizado : pct;
      const atingidas = tiers.filter(t => medida >= Number(t.threshold));
      const tier = atingidas.length ? atingidas[atingidas.length - 1] : null;

      const baseRun = {
        rule_id: rule.id, company_id: rule.company_id, month_year: competencia, kpi_id: rule.kpi_id,
        meta, realizado, pct: Number(pct.toFixed(2)),
      };

      if (rule.basis !== "value" && meta <= 0) {
        if (!dryRun) await supabase.from("company_commission_runs").insert({ ...baseRun, status: "no_target", payout_cents: 0, detail: "sem meta cadastrada na competência" });
        results.push({ company_id: rule.company_id, status: "no_target", competencia });
        continue;
      }

      if (!tier) {
        if (!dryRun) await supabase.from("company_commission_runs").insert({ ...baseRun, status: "no_tier", payout_cents: 0, detail: `medida ${medida.toFixed(2)} abaixo da menor faixa` });
        results.push({ company_id: rule.company_id, status: "no_tier", medida: Number(medida.toFixed(2)), competencia });
        continue;
      }

      // vencimento: dia configurado do mês ATUAL (o da apuração)
      const dueDay = Math.min(28, Math.max(1, rule.due_day || 5));
      const dueDate = `${ymOf(today)}-${String(dueDay).padStart(2, "0")}`;
      const compLabel = `${String(cm).padStart(2, "0")}/${cy}`;
      const description = (rule.description?.trim() || `Comissão por resultado — ${kpi.name}`) + ` (${compLabel})`;

      if (dryRun) {
        results.push({ company_id: rule.company_id, status: "dry", tier: tier.label, payout_cents: tier.payout_cents, due_date: dueDate, meta, realizado, pct: Number(pct.toFixed(2)) });
        continue;
      }

      const { data: inv, error: invErr } = await supabase.from("company_invoices").insert({
        company_id: rule.company_id,
        description,
        amount_cents: tier.payout_cents,
        due_date: dueDate,
        status: "pending",
        notes: `[COMISSAO] competência ${competencia} · ${kpi.name}: ${realizado} de ${meta} (${pct.toFixed(0)}%) · faixa ${tier.label || tier.threshold}`,
        // o aviso desta cobrança é o texto próprio abaixo (explica meta x realizado),
        // então a régua padrão não deve mandar a mensagem genérica de fatura
        send_whatsapp: false,
      }).select("id, public_token").single();
      if (invErr) throw new Error(invErr.message);

      const aviso = await avisarCliente(supabase, {
        companyId: rule.company_id, kpiName: kpi.name, kpiType: kpi.kpi_type,
        meta, realizado, pct, payoutCents: tier.payout_cents, dueDate, competencia,
        token: inv?.public_token || null, tierLabel: tier.label,
      });

      await supabase.from("company_commission_runs").insert({
        ...baseRun, tier_id: tier.id, payout_cents: tier.payout_cents, invoice_id: inv?.id || null,
        status: "paid_tier",
        detail: `faixa ${tier.label || tier.threshold} · fatura ${dueDate} · aviso ao cliente: ${aviso.sent ? "enviado" : `não enviado (${aviso.reason})`}`,
      });

      results.push({ company_id: rule.company_id, status: "faturado", payout_cents: tier.payout_cents, invoice_id: inv?.id, due_date: dueDate, competencia, aviso });
    } catch (e) {
      const msg = String((e as Error).message || e);
      if (!dryRun) {
        await supabase.from("company_commission_runs").insert({
          rule_id: rule.id, company_id: rule.company_id, month_year: competencia, kpi_id: rule.kpi_id,
          status: "error", payout_cents: 0, detail: msg.slice(0, 400),
        }).select("id");
      }
      results.push({ company_id: rule.company_id, status: "error", error: msg });
    }
  }

  return j({ ok: true, competencia, regras: (rules || []).length, results });
});
