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

// Avisa o cliente na hora que a fatura nasce: a meta, o que ele entregou, a
// comissão ACORDADA (a regra), o valor do mês e o link pra pagar.
//
// Pra quem vai (Fabrício, 05/10/2026: "a parcela de comissão também deve ser
// enviada para o número do financeiro"): o telefone do dono E o "Telefone
// (financeiro)" do cadastro da empresa, quando forem números diferentes. Antes
// ia só pro dono quando ele tinha telefone, e o financeiro do cliente, que é
// quem paga, não ficava sabendo.
interface AvisoOpts {
  companyId: string; kpiName: string; kpiType: string; meta: number; realizado: number; pct: number;
  payoutCents: number; dueDate: string; competencia: string; token: string | null;
  tierLabel: string | null; tierHit: boolean; regraTexto: string; calculo: string; usaPercent: boolean;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const comDDI = (d: string) => (d.startsWith("55") && d.length >= 12 ? d : `55${d}`);

/** telefones do dono e do financeiro, sem repetir (compara pelos 8 dígitos finais) */
function destinatarios(comp: { owner_phone?: string | null; phone?: string | null } | null): { phone: string; quem: string }[] {
  const out: { phone: string; quem: string }[] = [];
  for (const [raw, quem] of [[comp?.owner_phone, "dono"], [comp?.phone, "financeiro"]] as [unknown, string][]) {
    const d = soDigitos(raw);
    if (d.length < 10) continue;
    const ja = out.find((o) => o.phone.slice(-8) === d.slice(-8));
    if (ja) { ja.quem = `${ja.quem} e ${quem}`; continue; }
    out.push({ phone: comDDI(d), quem });
  }
  return out;
}

function textoAviso(nome: string, o: AvisoOpts): string {
  const [cy, cm] = o.competencia.split("-");
  const compLabel = `${cm}/${cy}`;
  const venc = o.dueDate.split("-").reverse().join("/");
  const link = o.token ? `https://unvholdings.com.br/fatura?token=${o.token}` : null;
  const abertura = o.tierHit
    ? `Parabéns${nome ? `, ${nome}` : ""}! A meta de *${o.kpiName}* foi batida em ${compLabel}${o.tierLabel ? ` (faixa ${o.tierLabel})` : ""}.`
    : `Olá${nome ? `, ${nome}` : ""}! Fechamos a apuração de *${o.kpiName}* de ${compLabel}.`;
  const linhaMeta = o.meta > 0 ? fmtKpi(o.meta, o.kpiType) : "não cadastrada nessa competência";
  const linhaReal = `${fmtKpi(o.realizado, o.kpiType)}${o.meta > 0 ? ` (${o.pct.toFixed(0)}% da meta)` : ""}`;
  const fecho = o.usaPercent
    ? "O valor acompanha o resultado de cada mês."
    : "Essa cobrança não é mensal: ela só acontece nos meses em que a meta é batida.";
  return (
    `${abertura}\n\n` +
    `*Meta:* ${linhaMeta}\n` +
    `*Realizado:* ${linhaReal}\n` +
    `*Comissão acordada:* ${o.regraTexto}\n` +
    `*Comissão do mês:* ${brl(o.payoutCents)}${o.calculo ? ` (${o.calculo})` : ""}\n` +
    `*Vencimento:* ${venc}\n\n` +
    (link ? `Para pagar, é só acessar:\n${link}\n\n` : "") +
    `${fecho} Seguimos juntos!`
  );
}

// deno-lint-ignore no-explicit-any
async function avisarCliente(supabase: any, opts: AvisoOpts, simular = false) {
  try {
    const { data: comp } = await supabase.from("onboarding_companies")
      .select("name, owner_name, owner_phone, phone").eq("id", opts.companyId).maybeSingle();
    const dest = destinatarios(comp);
    const primeiro = String(comp?.owner_name || comp?.name || "").trim().split(/\s+/)[0] || "";
    const nome = primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
    const msg = textoAviso(nome, opts);
    if (simular) return { sent: false, simulado: true, destinatarios: dest.map((d) => `${d.quem}: final ${d.phone.slice(-4)}`), mensagem: msg };
    if (!dest.length) return { sent: false, reason: "empresa sem telefone" };

    const { data: cfg } = await supabase.from("whatsapp_default_config")
      .select("setting_value").eq("setting_key", "default_instance").maybeSingle();
    const { data: inst } = cfg?.setting_value
      ? await supabase.from("whatsapp_instances")
          .select("api_url, api_key, instance_name").eq("instance_name", cfg.setting_value).eq("status", "connected").maybeSingle()
      : { data: null };
    if (!inst?.api_url || !inst?.api_key) return { sent: false, reason: "sem instância padrão conectada" };

    const enviados: string[] = [];
    const falhas: string[] = [];
    for (const d of dest) {
      try {
        const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: inst.api_key, Authorization: `Bearer ${inst.api_key}` },
          body: JSON.stringify({ number: d.phone, text: msg }),
        });
        if (r.ok) enviados.push(d.quem);
        else falhas.push(`${d.quem}: whatsapp ${r.status} ${(await r.text()).slice(0, 80)}`);
      } catch (e) {
        falhas.push(`${d.quem}: ${String((e as Error).message || e).slice(0, 80)}`);
      }
    }
    if (!enviados.length) return { sent: false, reason: falhas.join("; ").slice(0, 200) };
    return { sent: true, para: enviados.join(" + "), falhas: falhas.length ? falhas.join("; ").slice(0, 200) : undefined, phone: dest[0].phone };
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
    .select("id, company_id, kpi_id, basis, is_active, description, due_day, send_whatsapp, use_tiers, use_percent, percent")
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

      // Dois componentes independentes, somados:
      //  1) faixas por meta (use_tiers): paga a maior faixa atingida
      //  2) percentual sobre o vendido (use_percent): percent% do realizado, bata ou não a meta
      const usaFaixas = rule.use_tiers !== false;
      const usaPercent = !!rule.use_percent && Number(rule.percent) > 0;

      const medida = rule.basis === "value" ? realizado : pct;
      const atingidas = usaFaixas ? tiers.filter(t => medida >= Number(t.threshold)) : [];
      const tier = atingidas.length ? atingidas[atingidas.length - 1] : null;
      const semMetaParaFaixa = usaFaixas && rule.basis !== "value" && meta <= 0;
      const faixaCents = tier && !semMetaParaFaixa ? Number(tier.payout_cents) : 0;
      const percentCents = usaPercent ? Math.round(realizado * Number(rule.percent) / 100 * 100) : 0;
      const totalCents = faixaCents + percentCents;

      const baseRun = {
        rule_id: rule.id, company_id: rule.company_id, month_year: competencia, kpi_id: rule.kpi_id,
        meta, realizado, pct: Number(pct.toFixed(2)),
      };

      if (totalCents <= 0) {
        const motivo = semMetaParaFaixa && !usaPercent ? "sem meta cadastrada na competência"
          : usaFaixas && !tier && !usaPercent ? `medida ${medida.toFixed(2)} abaixo da menor faixa`
          : "nada a cobrar (sem faixa atingida e sem percentual)";
        const st = semMetaParaFaixa && !usaPercent ? "no_target" : "no_tier";
        if (!dryRun) await supabase.from("company_commission_runs").insert({ ...baseRun, status: st, payout_cents: 0, detail: motivo });
        results.push({ company_id: rule.company_id, status: st, medida: Number(medida.toFixed(2)), competencia });
        continue;
      }
      const partes = [
        faixaCents > 0 && tier ? `faixa ${tier.label || tier.threshold}: ${brl(faixaCents)}` : "",
        percentCents > 0 ? `${Number(rule.percent)}% sobre ${realizado}: ${brl(percentCents)}` : "",
      ].filter(Boolean).join(" + ");

      // a regra acordada, em texto, pra ir na mensagem do cliente
      const regraFaixas = usaFaixas && tiers.length
        ? tiers.map((t) => `${rule.basis === "value" ? `a partir de ${fmtKpi(Number(t.threshold), kpi.kpi_type)}` : `${Number(t.threshold)}% da meta`}: ${brl(Number(t.payout_cents))}`).join("; ")
        : "";
      const regraPercent = usaPercent ? `${Number(rule.percent)}% sobre o realizado` : "";
      const regraTexto = [regraPercent, regraFaixas].filter(Boolean).join(" + ") || "conforme combinado";
      const calculo = [
        faixaCents > 0 && tier ? `faixa ${tier.label || `${Number(tier.threshold)}${rule.basis === "value" ? "" : "%"}`}: ${brl(faixaCents)}` : "",
        percentCents > 0 ? `${Number(rule.percent)}% de ${fmtKpi(realizado, kpi.kpi_type)}: ${brl(percentCents)}` : "",
      ].filter(Boolean).join(" + ");

      // vencimento: dia configurado do mês ATUAL (o da apuração)
      const dueDay = Math.min(28, Math.max(1, rule.due_day || 5));
      const dueDate = `${ymOf(today)}-${String(dueDay).padStart(2, "0")}`;
      const compLabel = `${String(cm).padStart(2, "0")}/${cy}`;
      const description = (rule.description?.trim() || `Comissão por resultado — ${kpi.name}`) + ` (${compLabel})`;

      const avisoOpts: AvisoOpts = {
        companyId: rule.company_id, kpiName: kpi.name, kpiType: kpi.kpi_type,
        meta, realizado, pct, payoutCents: totalCents, dueDate, competencia, token: null,
        tierLabel: tier?.label || null, tierHit: faixaCents > 0, regraTexto, calculo, usaPercent: percentCents > 0,
      };

      if (dryRun) {
        // a simulação mostra também pra quem iria e o texto exato (sem enviar)
        const previa = await avisarCliente(supabase, avisoOpts, true);
        results.push({ company_id: rule.company_id, status: "dry", tier: tier?.label || null, payout_cents: totalCents, partes, due_date: dueDate, meta, realizado, pct: Number(pct.toFixed(2)), aviso: previa });
        continue;
      }

      const { data: inv, error: invErr } = await supabase.from("company_invoices").insert({
        company_id: rule.company_id,
        description,
        amount_cents: totalCents,
        due_date: dueDate,
        status: "pending",
        notes: `[COMISSAO] competência ${competencia} · ${kpi.name}: ${realizado} de ${meta} (${pct.toFixed(0)}%) · ${partes}`,
        // o aviso desta cobrança é o texto próprio abaixo (explica meta x realizado),
        // então a régua padrão não deve mandar a mensagem genérica de fatura
        send_whatsapp: false,
      }).select("id, public_token").single();
      if (invErr) throw new Error(invErr.message);

      const aviso = await avisarCliente(supabase, { ...avisoOpts, token: inv?.public_token || null });

      await supabase.from("company_commission_runs").insert({
        ...baseRun, tier_id: tier?.id || null, payout_cents: totalCents, invoice_id: inv?.id || null,
        status: "paid_tier",
        detail: `${partes} · fatura ${dueDate} · aviso ao cliente: ${aviso.sent ? `enviado (${(aviso as any).para})` : `não enviado (${aviso.reason})`}`,
      });

      results.push({ company_id: rule.company_id, status: "faturado", payout_cents: totalCents, partes, invoice_id: inv?.id, due_date: dueDate, competencia, aviso });
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
