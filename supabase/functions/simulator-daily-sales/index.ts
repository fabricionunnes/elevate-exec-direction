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
    const mode = body.backfill ? "backfill" : "daily";
    const force = !!body.force;

    const br = new Date(Date.now() - 3 * 3600000);
    const y = br.getUTCFullYear(), m = br.getUTCMonth(), todayDay = br.getUTCDate(), dow = br.getUTCDay();
    // seg-sáb: no modo diário, domingo não lança
    if (mode === "daily" && dow === 0 && !force) return j({ ok: true, skip: "domingo" });
    const monthStart = `${y}-${pad(m + 1)}-01`;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const isWork = (d: number) => new Date(Date.UTC(y, m, d)).getUTCDay() !== 0; // exclui domingo (seg-sáb)

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
      const ticket = Math.max(1, target / (vendas ? Math.max(1, Number(vendas.target_value) || 60) : 60));

      // dias úteis (seg-sáb) do mês e decorridos (até hoje)
      let total = 0; const workDays: number[] = [];
      for (let d = 1; d <= lastDay; d++) { if (isWork(d)) { total++; if (d <= todayDay) workDays.push(d); } }

      // lança um dia específico: distribui `amount` entre os vendedores + KPIs auxiliares
      const buildRows = (day: number, amount: number) => {
        const dateISO = `${y}-${pad(m + 1)}-${pad(day)}`;
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

      if (mode === "backfill") {
        // já tem faturamento no mês?
        const { count } = await supabase.from("kpi_entries").select("id", { count: "exact", head: true })
          .eq("kpi_id", fat.id).gte("entry_date", monthStart).lte("entry_date", `${y}-${pad(m + 1)}-${pad(todayDay)}`);
        if ((count ?? 0) > 0 && !force) { out.push({ company: c.name, skip: "já tem lançamentos no mês (use force p/ refazer)" }); continue; }
        // distribui overshoot do mês-até-hoje pelos dias úteis decorridos, com variação diária
        const monthTargetSoFar = target * (workDays.length / total) * OVERSHOOT;
        const dayW = workDays.map(() => 0.7 + Math.random() * 0.8);
        const dwsum = dayW.reduce((a, b) => a + b, 0);
        let inserted = 0;
        for (let k = 0; k < workDays.length; k++) {
          const dayAmount = monthTargetSoFar * dayW[k] / dwsum;
          const rows = buildRows(workDays[k], dayAmount);
          if (rows.length) { await supabase.from("kpi_entries").insert(rows); inserted += rows.length; }
        }
        out.push({ company: c.name, mode, dias: workDays.length, meta: target, alvo_mes: Math.round(monthTargetSoFar), linhas: inserted });
        continue;
      }

      // ── modo diário: incrementa hoje pra manter a projeção acima da meta ──
      if (dow === 0 && !force) continue;
      const { count: todayCount } = await supabase.from("kpi_entries").select("id", { count: "exact", head: true })
        .eq("kpi_id", fat.id).eq("entry_date", `${y}-${pad(m + 1)}-${pad(todayDay)}`);
      if ((todayCount ?? 0) > 0 && !force) { out.push({ company: c.name, skip: "hoje já lançado" }); continue; }

      const { data: fatEntries } = await supabase.from("kpi_entries").select("value")
        .eq("kpi_id", fat.id).gte("entry_date", monthStart).lte("entry_date", `${y}-${pad(m + 1)}-${pad(todayDay)}`);
      const realized = (fatEntries || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      const timeProgress = total ? workDays.length / total : 0;
      const overshootTarget = target * timeProgress * OVERSHOOT;
      const dailyMin = (target / (total || 1)) * 0.5;
      const todayTotal = Math.max(dailyMin, overshootTarget - realized);
      const rows = buildRows(todayDay, todayTotal);
      if (rows.length) await supabase.from("kpi_entries").insert(rows);
      const newRealized = realized + todayTotal;
      const proj = timeProgress > 0 ? (newRealized / target) / timeProgress * 100 : 0;
      out.push({ company: c.name, mode, lancado_hoje: Math.round(todayTotal), realizado_mes: Math.round(newRealized), meta: target, projecao: Math.round(proj) + "%" });
    }

    if (body.dry_run) return j({ ok: true, dry_run: true, note: "dry_run não insere no modo daily/backfill — use force pra rodar", result: out });
    return j({ ok: true, mode, result: out });
  } catch (e) {
    console.error("simulator-daily-sales", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
