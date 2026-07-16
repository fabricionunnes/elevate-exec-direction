import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const pad = (n: number) => String(n).padStart(2, "0");
const OVERSHOOT = 1.08; // projeta ~108% da meta

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.backfill ? "backfill" : body.history ? "history" : "daily";
    const force = !!body.force;
    const monthsBack = Math.min(Math.max(parseInt(String(body.months ?? 12), 10) || 12, 1), 24);

    const br = new Date(Date.now() - 3 * 3600000);
    const y = br.getUTCFullYear(), m = br.getUTCMonth(), todayDay = br.getUTCDate(), dow = br.getUTCDay();
    if (mode === "daily" && dow === 0 && !force) return j({ ok: true, skip: "domingo" });

    // dias úteis (seg-sáb) de um mês qualquer
    const workDaysOf = (yy: number, mm: number) => {
      const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
      const days: number[] = [];
      for (let d = 1; d <= last; d++) if (new Date(Date.UTC(yy, mm, d)).getUTCDay() !== 0) days.push(d);
      return days;
    };

    const { data: comps } = await supabase.from("onboarding_companies").select("id, name").eq("is_simulator", true);
    const out: any[] = [];

    for (const c of (comps || [])) {
      const { data: kpis } = await supabase.from("company_kpis")
        .select("id, name, kpi_type, is_main_goal, target_value").eq("company_id", c.id);
      const fat = (kpis || []).find((k: any) => k.is_main_goal && k.kpi_type === "monetary");
      if (!fat || Number(fat.target_value) <= 0) { out.push({ company: c.name, skip: "sem meta de faturamento" }); continue; }
      const vendas = (kpis || []).find((k: any) => /venda/i.test(k.name) && k.kpi_type !== "monetary");
      const atend = (kpis || []).find((k: any) => /atendimento/i.test(k.name));
      const agend = (kpis || []).find((k: any) => /agendamento/i.test(k.name));

      const { data: sps } = await supabase.from("company_salespeople")
        .select("id, unit_id, team_id, sector_id").eq("company_id", c.id).eq("is_active", true);
      if (!sps || sps.length === 0) { out.push({ company: c.name, skip: "sem vendedores" }); continue; }

      const target = Number(fat.target_value);
      const vendasTarget = vendas ? Math.max(1, Number(vendas.target_value) || 60) : 60;
      const ticket = Math.max(1, target / vendasTarget);

      // lança um dia específico (yy/mm/day): distribui `amount` entre os vendedores + KPIs auxiliares
      const buildRows = (yy: number, mm: number, day: number, amount: number) => {
        const dateISO = `${yy}-${pad(mm + 1)}-${pad(day)}`;
        const weights = sps.map(() => 0.6 + Math.random() * 0.9);
        const wsum = weights.reduce((a, b) => a + b, 0);
        const rows: any[] = [];
        sps.forEach((sp: any, i: number) => {
          const amt = Math.max(0, Math.round(amount * weights[i] / wsum));
          const base = { company_id: c.id, salesperson_id: sp.id, entry_date: dateISO, unit_id: sp.unit_id, team_id: sp.team_id, sector_id: sp.sector_id };
          if (amt > 0) rows.push({ ...base, kpi_id: fat.id, value: amt });
          if (vendas && amt > 0) rows.push({ ...base, kpi_id: vendas.id, value: Math.max(1, Math.round(amt / ticket)) });
          if (atend) rows.push({ ...base, kpi_id: atend.id, value: 6 + Math.round(Math.random() * 12) });
          if (agend) rows.push({ ...base, kpi_id: agend.id, value: 2 + Math.round(Math.random() * 5) });
        });
        return rows;
      };

      // distribui um total pelo conjunto de dias úteis, com variação diária, e insere
      const spreadMonth = async (yy: number, mm: number, days: number[], monthTotal: number) => {
        const dayW = days.map(() => 0.7 + Math.random() * 0.8);
        const dwsum = dayW.reduce((a, b) => a + b, 0);
        let inserted = 0;
        for (let k = 0; k < days.length; k++) {
          const rows = buildRows(yy, mm, days[k], monthTotal * dayW[k] / dwsum);
          if (rows.length) { await supabase.from("kpi_entries").insert(rows); inserted += rows.length; }
        }
        return inserted;
      };

      // ─────────────── HISTÓRICO: últimos N meses fechados ───────────────
      if (mode === "history") {
        const monthsOut: any[] = [];
        for (let back = monthsBack; back >= 1; back--) {
          const dt = new Date(Date.UTC(y, m - back, 1));
          const yy = dt.getUTCFullYear(), mm = dt.getUTCMonth();
          const monthKey = `${yy}-${pad(mm + 1)}`;
          const first = `${monthKey}-01`;
          const last = `${monthKey}-${pad(new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())}`;

          // idempotência por mês
          const { count } = await supabase.from("kpi_entries").select("id", { count: "exact", head: true })
            .eq("kpi_id", fat.id).gte("entry_date", first).lte("entry_date", last);
          if ((count ?? 0) > 0 && !force) { monthsOut.push({ mes: monthKey, skip: "já tem lançamentos" }); continue; }

          // curva de crescimento: mês mais antigo ~55% da meta atual, recente ~100%
          const idx = (monthsBack - back) / Math.max(1, monthsBack - 1); // 0..1 (antigo→recente)
          const season = 1 + 0.06 * Math.sin((mm / 12) * Math.PI * 2); // leve sazonalidade
          const monthTarget = Math.round(target * (0.55 + 0.45 * idx) * season);
          const monthTargetVendas = Math.max(1, Math.round(monthTarget / ticket));
          // realizado sempre acima da meta do mês (102%–114%)
          const monthReal = monthTarget * (1.02 + Math.random() * 0.12);

          // grava metas mensais (empresa) — Faturamento + Vendas
          const targetRows = [
            { kpi_id: fat.id, company_id: c.id, month_year: monthKey, level_name: "Meta", target_value: monthTarget },
          ];
          if (vendas) targetRows.push({ kpi_id: vendas.id, company_id: c.id, month_year: monthKey, level_name: "Meta", target_value: monthTargetVendas });
          for (const tr of targetRows) {
            const { count: tc } = await supabase.from("kpi_monthly_targets").select("id", { count: "exact", head: true })
              .eq("kpi_id", tr.kpi_id).eq("company_id", c.id).eq("month_year", monthKey).is("salesperson_id", null);
            if ((tc ?? 0) === 0) await supabase.from("kpi_monthly_targets").insert(tr);
          }

          const days = workDaysOf(yy, mm);
          const linhas = await spreadMonth(yy, mm, days, monthReal);
          monthsOut.push({ mes: monthKey, meta: monthTarget, realizado: Math.round(monthReal), pct: Math.round(monthReal / monthTarget * 100) + "%", dias: days.length, linhas });
        }
        out.push({ company: c.name, mode, meses: monthsOut });
        continue;
      }

      // ─────────────── BACKFILL: mês corrente até hoje ───────────────
      if (mode === "backfill") {
        const monthStart = `${y}-${pad(m + 1)}-01`;
        const todayISO = `${y}-${pad(m + 1)}-${pad(todayDay)}`;
        const { count } = await supabase.from("kpi_entries").select("id", { count: "exact", head: true })
          .eq("kpi_id", fat.id).gte("entry_date", monthStart).lte("entry_date", todayISO);
        if ((count ?? 0) > 0 && !force) { out.push({ company: c.name, skip: "já tem lançamentos no mês (use force p/ refazer)" }); continue; }
        const allDays = workDaysOf(y, m);
        const elapsed = allDays.filter((d) => d <= todayDay);
        const monthTargetSoFar = target * (elapsed.length / allDays.length) * OVERSHOOT;
        const linhas = await spreadMonth(y, m, elapsed, monthTargetSoFar);
        out.push({ company: c.name, mode, dias: elapsed.length, meta: target, alvo_mes: Math.round(monthTargetSoFar), linhas });
        continue;
      }

      // ─────────────── DIÁRIO: incrementa hoje mantendo projeção acima da meta ───────────────
      if (dow === 0 && !force) continue;
      const monthStart = `${y}-${pad(m + 1)}-01`;
      const todayISO = `${y}-${pad(m + 1)}-${pad(todayDay)}`;
      const { count: todayCount } = await supabase.from("kpi_entries").select("id", { count: "exact", head: true })
        .eq("kpi_id", fat.id).eq("entry_date", todayISO);
      if ((todayCount ?? 0) > 0 && !force) { out.push({ company: c.name, skip: "hoje já lançado" }); continue; }

      const { data: fatEntries } = await supabase.from("kpi_entries").select("value")
        .eq("kpi_id", fat.id).gte("entry_date", monthStart).lte("entry_date", todayISO);
      const realized = (fatEntries || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      const allDays = workDaysOf(y, m);
      const elapsed = allDays.filter((d) => d <= todayDay);
      const timeProgress = allDays.length ? elapsed.length / allDays.length : 0;
      const overshootTarget = target * timeProgress * OVERSHOOT;
      const dailyMin = (target / (allDays.length || 1)) * 0.5;
      const todayTotal = Math.max(dailyMin, overshootTarget - realized);
      const rows = buildRows(y, m, todayDay, todayTotal);
      if (rows.length) await supabase.from("kpi_entries").insert(rows);
      const newRealized = realized + todayTotal;
      const proj = timeProgress > 0 ? (newRealized / target) / timeProgress * 100 : 0;
      out.push({ company: c.name, mode, lancado_hoje: Math.round(todayTotal), realizado_mes: Math.round(newRealized), meta: target, projecao: Math.round(proj) + "%" });
    }

    return j({ ok: true, mode, result: out });
  } catch (e) {
    console.error("simulator-daily-sales", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
