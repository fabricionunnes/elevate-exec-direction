import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Flame, CalendarDays, TrendingUp } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, getDay, getDate } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";

interface SalesHeatmapChartsProps {
  companyId: string;
  kpiIds?: string[];
  selectedSalesperson?: string;
  selectedUnit?: string;
  selectedTeam?: string;
  selectedSector?: string;
  titleSuffix?: string;
}

interface EntryRow {
  entry_date: string;
  value: number;
  salesperson_id: string | null;
  unit_id: string | null;
  team_id: string | null;
}

interface SalespersonRow {
  id: string;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

// Estilos 3D (leves, em CSS) — cores vêm por variável, mantendo o tema
const style3d = `
.shm3d{ --shm-persp:600px; }
.shm3d-col-wrap{ perspective:var(--shm-persp); display:flex; align-items:flex-end; width:100%; height:100%; }
.shm3d-col{ width:100%; border-radius:7px 7px 2px 2px; position:relative; transform-style:preserve-3d;
  transform:rotateX(10deg); background:linear-gradient(180deg, var(--c1), var(--c2));
  box-shadow:0 12px 20px -12px var(--csh); transition:filter .15s; }
.shm3d-col::before{ content:""; position:absolute; top:-6px; left:0; right:0; height:6px; border-radius:7px 7px 0 0;
  background:var(--c0); transform:rotateX(58deg); transform-origin:bottom; }
.shm3d-col::after{ content:""; position:absolute; top:0; bottom:0; right:-5px; width:5px; border-radius:0 5px 5px 0;
  background:var(--c3); transform:rotateY(56deg); transform-origin:left; opacity:.8; }
.shm3d-col:hover{ filter:brightness(1.08); }
.shm3d-bar-track{ perspective:var(--shm-persp); height:26px; }
.shm3d-bar{ height:100%; border-radius:6px; position:relative; transform-style:preserve-3d; transform:rotateX(13deg);
  background:linear-gradient(180deg, var(--c1), var(--c2)); box-shadow:0 8px 14px -8px var(--csh); }
.shm3d-bar::after{ content:""; position:absolute; left:0; right:0; bottom:-5px; height:5px; border-radius:0 0 6px 6px;
  background:var(--c3); transform:rotateX(-60deg); transform-origin:top; opacity:.85; }
@media (prefers-reduced-motion: reduce){ .shm3d-col,.shm3d-bar{ transform:none; } }
`;

// Roxo (dia do mês) e verde (dia da semana) — mesmas cores já usadas no dashboard
const VIOLET = { c0: "#a78bfa", c1: "#8b5cf6", c2: "#6d28d9", c3: "#4c1d95", csh: "rgba(109,40,217,.4)" };
const VIOLET_SOFT = { c0: "#c4b5fd", c1: "#a78bfa", c2: "#8b5cf6", c3: "#6d28d9", csh: "rgba(139,92,246,.3)" };
const EMERALD = { c0: "#6ee7b7", c1: "#34d399", c2: "#059669", c3: "#065f46", csh: "rgba(5,150,105,.4)" };
const EMERALD_SOFT = { c0: "#a7f3d0", c1: "#6ee7b7", c2: "#34d399", c3: "#059669", csh: "rgba(52,211,153,.3)" };
const AMBER = { c0: "#fcd34d", c1: "#f59e0b", c2: "#d97706", c3: "#b45309", csh: "rgba(217,119,6,.45)" };
const varsOf = (c: typeof VIOLET) =>
  ({ "--c0": c.c0, "--c1": c.c1, "--c2": c.c2, "--c3": c.c3, "--csh": c.csh }) as React.CSSProperties;

export const SalesHeatmapCharts = ({
  companyId,
  kpiIds,
  selectedSalesperson,
  selectedUnit,
  selectedTeam,
  selectedSector,
  titleSuffix,
}: SalesHeatmapChartsProps) => {
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<EntryRow[]>([]);
  const [salespeopleMap, setSalespeopleMap] = useState<Record<string, SalespersonRow>>({});

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const endDate = endOfMonth(new Date());
        const startDate = startOfMonth(subMonths(new Date(), 5));

        let query = supabase
          .from("kpi_entries")
          .select("entry_date, value, salesperson_id, unit_id, team_id")
          .eq("company_id", companyId)
          .gte("entry_date", format(startDate, "yyyy-MM-dd"))
          .lte("entry_date", format(endDate, "yyyy-MM-dd"));

        if (kpiIds && kpiIds.length > 0) query = query.in("kpi_id", kpiIds);
        if (selectedSalesperson && selectedSalesperson !== "all") query = query.eq("salesperson_id", selectedSalesperson);

        const [{ data, error }, { data: spData }] = await Promise.all([
          query,
          supabase.from("company_salespeople").select("id, unit_id, team_id, sector_id").eq("company_id", companyId),
        ]);
        if (error) throw error;
        const map: Record<string, SalespersonRow> = {};
        (spData || []).forEach((sp: SalespersonRow) => { map[sp.id] = sp; });
        setSalespeopleMap(map);
        setAllEntries((data || []) as EntryRow[]);
      } catch (err) {
        console.error("Error fetching heatmap data:", err);
        setAllEntries([]);
      } finally {
        setLoading(false);
      }
    };
    if (companyId) fetchEntries();
  }, [companyId, kpiIds, selectedSalesperson]);

  const entries = useMemo(() => {
    return allEntries.filter((e) => {
      const sp = e.salesperson_id ? salespeopleMap[e.salesperson_id] : undefined;
      if (selectedUnit && selectedUnit !== "all" && e.unit_id !== selectedUnit && sp?.unit_id !== selectedUnit) return false;
      if (selectedTeam && selectedTeam !== "all" && e.team_id !== selectedTeam && sp?.team_id !== selectedTeam) return false;
      if (selectedSector && selectedSector !== "all" && sp?.sector_id !== selectedSector) return false;
      return true;
    });
  }, [allEntries, salespeopleMap, selectedUnit, selectedTeam, selectedSector]);

  // Média por dia da semana
  const weekdayData = useMemo(() => {
    const totals = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    entries.forEach((e) => {
      const dow = getDay(parseDateLocal(e.entry_date));
      totals[dow] += e.value; counts[dow] += 1;
    });
    const avg = totals.map((t, i) => (counts[i] > 0 ? t / counts[i] : 0));
    const maxAvg = Math.max(1, ...avg);
    return WEEKDAY_LABELS.map((label, i) => ({ label, fullLabel: WEEKDAY_FULL[i], total: totals[i], avg: avg[i], count: counts[i], maxAvg }));
  }, [entries]);

  const bestWeekday = useMemo(() => {
    const withVal = weekdayData.filter((d) => d.avg > 0);
    if (!withVal.length) return null;
    const top = [...withVal].sort((a, b) => b.avg - a.avg)[0];
    const low = [...withVal].sort((a, b) => a.avg - b.avg)[0];
    return { top, ratio: low.avg > 0 ? top.avg / low.avg : 0 };
  }, [weekdayData]);

  // Por quinzena, por semana do mês e melhores dias
  const monthPattern = useMemo(() => {
    const fort = [0, 0]; // 1ª (1-15), 2ª (16-31)
    const weeks = [0, 0, 0, 0, 0]; // S1..S5
    const byDay: Record<number, number> = {};
    entries.forEach((e) => {
      const day = getDate(parseDateLocal(e.entry_date));
      fort[day <= 15 ? 0 : 1] += e.value;
      const w = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4;
      weeks[w] += e.value;
      byDay[day] = (byDay[day] || 0) + e.value;
    });
    const weekMax = Math.max(1, ...weeks);
    const peakWeek = weeks.indexOf(Math.max(...weeks));
    const fortMax = Math.max(1, ...fort);
    const topDays = Object.entries(byDay)
      .map(([d, v]) => ({ day: Number(d), value: v }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
    const topDaysMax = Math.max(1, ...topDays.map((d) => d.value));
    return { fort, fortMax, weeks, weekMax, peakWeek, topDays, topDaysMax };
  }, [entries]);

  if (loading) {
    return (
      <Card><CardContent className="p-6"><div className="flex items-center justify-center h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></CardContent></Card>
    );
  }
  if (entries.length === 0) return null;

  const WEEK_LABELS = ["1–7", "8–14", "15–21", "22–28", "29+"];
  const fortRatio = monthPattern.fort[1] > 0 ? monthPattern.fort[0] / monthPattern.fort[1] : 0;
  const bestFort = monthPattern.fort[0] >= monthPattern.fort[1] ? 0 : 1;

  return (
    <>
      <style>{style3d}</style>
      <div className="grid gap-4 md:grid-cols-2 shm3d">
        {/* ── DIA DA SEMANA (colunas 3D) ── */}
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-500" />
              Vendas por Dia da Semana{titleSuffix ? ` — ${titleSuffix}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Média de vendas nos últimos 6 meses</p>
          </CardHeader>
          <CardContent className="pb-5">
            {bestWeekday && (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 flex items-center gap-3">
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">{bestWeekday.top.label}</span>
                <span className="text-xs text-muted-foreground leading-snug">
                  é o dia que mais vende — média de <b className="text-foreground">{formatCurrency(bestWeekday.top.avg)}</b>
                  {bestWeekday.ratio > 1.2 && <>, ~{bestWeekday.ratio.toFixed(1)}× o dia mais fraco</>}.
                </span>
              </div>
            )}
            <div className="flex items-end gap-2 pt-2">
              {weekdayData.map((d) => {
                const h = d.maxAvg > 0 ? Math.max(4, (d.avg / d.maxAvg) * 100) : 4;
                const isTop = bestWeekday?.top.label === d.label && d.avg > 0;
                const pal = d.avg === 0 ? VIOLET_SOFT : isTop ? EMERALD : EMERALD_SOFT;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-foreground">{d.avg > 0 ? formatCurrency(d.avg) : "—"}</span>
                    <div className="w-full flex items-end" style={{ height: 118 }}>
                      <div className="shm3d-col-wrap" style={{ height: `${h}%` }}>
                        <div className="shm3d-col" style={{ ...varsOf(pal), height: "100%", opacity: d.avg === 0 ? 0.35 : 1 }} />
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium ${isTop ? "text-foreground" : "text-muted-foreground"}`}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── QUANDO A EMPRESA MAIS VENDE (quinzena + semana + melhores dias) ── */}
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-violet-500" />
              Quando a empresa mais vende{titleSuffix ? ` — ${titleSuffix}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Padrão por quinzena, semana e dia — últimos 6 meses</p>
          </CardHeader>
          <CardContent className="pb-5 space-y-5">
            {/* insight quinzena */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 flex items-center gap-3">
              <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400 leading-none whitespace-nowrap">
                {fortRatio >= 1.1 ? `${fortRatio.toFixed(1)}×` : (monthPattern.fort[1] > monthPattern.fort[0] ? `${(1 / (fortRatio || 1)).toFixed(1)}×` : "≈")}
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                A <b className="text-foreground">{bestFort === 0 ? "1ª quinzena" : "2ª quinzena"}</b> concentra as vendas
                {bestFort === 0 && fortRatio >= 1.1 && <> ({fortRatio.toFixed(1)}× a 2ª)</>}
                {bestFort === 1 && fortRatio > 0 && fortRatio < 0.9 && <> ({(1 / fortRatio).toFixed(1)}× a 1ª)</>}.
              </span>
            </div>

            {/* Quinzena — 2 barras 3D horizontais */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-bold mb-2.5">Por quinzena</p>
              <div className="flex flex-col gap-2.5">
                {[0, 1].map((i) => (
                  <div key={i} className="grid items-center gap-3" style={{ gridTemplateColumns: "84px 1fr auto" }}>
                    <span className={`text-xs font-semibold ${i === bestFort ? "text-foreground" : "text-muted-foreground"}`}>
                      {i === 0 ? "1ª (1–15)" : "2ª (16–31)"}
                    </span>
                    <div className="shm3d-bar-track">
                      <div className="shm3d-bar" style={{ ...varsOf(i === bestFort ? VIOLET : VIOLET_SOFT), width: `${Math.max(6, (monthPattern.fort[i] / monthPattern.fortMax) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-extrabold text-foreground text-right tabular-nums">{formatCurrency(monthPattern.fort[i])}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Semana do mês — colunas 3D */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-bold mb-2.5">Por semana do mês</p>
              <div className="flex items-end gap-2.5">
                {monthPattern.weeks.map((v, i) => {
                  const h = Math.max(4, (v / monthPattern.weekMax) * 100);
                  const isPeak = i === monthPattern.peakWeek && v > 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="h-[15px] flex items-end">
                        {isPeak && <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-amber-950 bg-amber-400 rounded px-1.5 py-[1px]">Pico</span>}
                      </div>
                      <span className="text-[10.5px] font-bold text-foreground tabular-nums">{formatCurrency(v)}</span>
                      <div className="w-full flex items-end" style={{ height: 104 }}>
                        <div className="shm3d-col-wrap" style={{ height: `${h}%` }}>
                          <div className="shm3d-col" style={{ ...varsOf(isPeak ? AMBER : VIOLET_SOFT), height: "100%" }} />
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium ${isPeak ? "text-foreground" : "text-muted-foreground"}`}>{WEEK_LABELS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Melhores dias do mês */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-bold mb-2.5 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> Dias que mais vendem
              </p>
              <div className="flex flex-col gap-2">
                {monthPattern.topDays.map((d, idx) => (
                  <div key={d.day} className="grid items-center gap-3" style={{ gridTemplateColumns: "56px 1fr auto" }}>
                    <span className="text-xs font-semibold text-muted-foreground">Dia {d.day}</span>
                    <div className="shm3d-bar-track" style={{ height: "20px" }}>
                      <div className="shm3d-bar" style={{ ...varsOf(idx === 0 ? VIOLET : VIOLET_SOFT), width: `${Math.max(6, (d.value / monthPattern.topDaysMax) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-extrabold text-foreground text-right tabular-nums">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
