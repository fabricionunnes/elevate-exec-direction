import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Flame, CalendarDays } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, getDay, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function getColorIntensity(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-muted/40";
  const ratio = value / max;
  if (ratio >= 0.85) return "bg-emerald-500 text-white";
  if (ratio >= 0.65) return "bg-emerald-400 text-white";
  if (ratio >= 0.45) return "bg-emerald-300 text-emerald-900";
  if (ratio >= 0.25) return "bg-emerald-200 text-emerald-800";
  if (ratio > 0) return "bg-emerald-100 text-emerald-700";
  return "bg-muted/40";
}

function getMonthDayColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-muted/30";
  const ratio = value / max;
  if (ratio >= 0.85) return "bg-violet-500 text-white";
  if (ratio >= 0.65) return "bg-violet-400 text-white";
  if (ratio >= 0.45) return "bg-violet-300 text-violet-900";
  if (ratio >= 0.25) return "bg-violet-200 text-violet-800";
  if (ratio > 0) return "bg-violet-100 text-violet-700";
  return "bg-muted/30";
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

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
  const [entries, setEntries] = useState<EntryRow[]>([]);

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        // Fetch last 6 months of data for heatmap analysis
        const endDate = endOfMonth(new Date());
        const startDate = startOfMonth(subMonths(new Date(), 5));

        let query = supabase
          .from("kpi_entries")
          .select("entry_date, value")
          .eq("company_id", companyId)
          .gte("entry_date", format(startDate, "yyyy-MM-dd"))
          .lte("entry_date", format(endDate, "yyyy-MM-dd"));

        if (kpiIds && kpiIds.length > 0) {
          query = query.in("kpi_id", kpiIds);
        }
        if (selectedSalesperson && selectedSalesperson !== "all") {
          query = query.eq("salesperson_id", selectedSalesperson);
        }
        if (selectedUnit && selectedUnit !== "all") {
          query = query.eq("unit_id", selectedUnit);
        }
        if (selectedTeam && selectedTeam !== "all") {
          query = query.eq("team_id", selectedTeam);
        }

        const { data, error } = await query;
        if (error) throw error;
        setEntries((data || []) as EntryRow[]);
      } catch (err) {
        console.error("Error fetching heatmap data:", err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    if (companyId) fetchEntries();
  }, [companyId, kpiIds, selectedSalesperson, selectedUnit, selectedTeam, selectedSector]);

  // Day of week aggregation
  const weekdayData = useMemo(() => {
    const totals = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    entries.forEach((e) => {
      const date = parseDateLocal(e.entry_date);
      const dow = getDay(date);
      totals[dow] += e.value;
      counts[dow] += 1;
    });
    const avg = totals.map((t, i) => (counts[i] > 0 ? t / counts[i] : 0));
    const maxAvg = Math.max(...avg);
    return WEEKDAY_LABELS.map((label, i) => ({
      label,
      fullLabel: WEEKDAY_FULL[i],
      total: totals[i],
      avg: avg[i],
      count: counts[i],
      maxAvg,
    }));
  }, [entries]);

  // Day of month aggregation across last 6 months
  const monthDayData = useMemo(() => {
    const endDate = endOfMonth(new Date());
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(format(subMonths(new Date(), i), "yyyy-MM"));
    }

    // Build grid: rows = days (1-31), columns = months
    const grid: Record<string, Record<number, number>> = {};
    months.forEach((m) => {
      grid[m] = {};
    });

    entries.forEach((e) => {
      const date = parseDateLocal(e.entry_date);
      const monthKey = format(date, "yyyy-MM");
      const day = getDate(date);
      if (grid[monthKey]) {
        grid[monthKey][day] = (grid[monthKey][day] || 0) + e.value;
      }
    });

    // Find max value across all cells
    let maxVal = 0;
    months.forEach((m) => {
      Object.values(grid[m]).forEach((v) => {
        if (v > maxVal) maxVal = v;
      });
    });

    return { months, grid, maxVal };
  }, [entries]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) return null;

  const monthLabels = monthDayData.months.map((m) => {
    const [year, month] = m.split("-");
    return format(new Date(parseInt(year), parseInt(month) - 1, 1), "MMM/yy", { locale: ptBR });
  });

  return (
    <TooltipProvider>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Day of Week Heatmap */}
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-500" />
              Vendas por Dia da Semana{titleSuffix ? ` — ${titleSuffix}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Média de vendas nos últimos 6 meses</p>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-col gap-2">
              {weekdayData.map((d) => (
                <Tooltip key={d.label}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 group cursor-default">
                      <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">{d.label}</span>
                      <div className="flex-1 relative">
                        <div
                          className={`h-9 rounded-lg transition-all flex items-center px-3 ${getColorIntensity(d.avg, d.maxAvg)}`}
                          style={{
                            width: d.maxAvg > 0 ? `${Math.max(15, (d.avg / d.maxAvg) * 100)}%` : "15%",
                          }}
                        >
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {d.avg > 0 ? formatCurrency(d.avg) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{d.fullLabel}</p>
                      <p>Média: {formatCurrency(d.avg)}</p>
                      <p>Total: {formatCurrency(d.total)}</p>
                      <p>Lançamentos: {d.count}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1 mt-4 justify-end">
              <span className="text-[10px] text-muted-foreground mr-1">Menor</span>
              {["bg-emerald-100", "bg-emerald-200", "bg-emerald-300", "bg-emerald-400", "bg-emerald-500"].map((c) => (
                <div key={c} className={`w-4 h-3 rounded-sm ${c}`} />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">Maior</span>
            </div>
          </CardContent>
        </Card>

        {/* Day of Month Heatmap */}
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-violet-500" />
              Vendas por Dia do Mês{titleSuffix ? ` — ${titleSuffix}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Comparativo dos últimos 6 meses</p>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                {/* Header row with month labels */}
                <div className="flex gap-[2px] mb-1">
                  <div className="w-8 shrink-0" />
                  {monthLabels.map((label, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center text-[10px] font-medium text-muted-foreground capitalize"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Grid rows - days 1-31 */}
                <div className="flex flex-col gap-[2px]">
                  {Array.from({ length: 31 }, (_, dayIdx) => {
                    const day = dayIdx + 1;
                    const rowValues = monthDayData.months.map((m) => monthDayData.grid[m][day] || 0);
                    const rowMax = Math.max(0, ...rowValues);
                    const hasAnyValue = rowMax > 0;
                    // Show all days up to 28, then only those with data
                    if (day > 28 && !hasAnyValue) return null;

                    return (
                      <div key={day} className="flex gap-[2px] items-center">
                        <span className="w-8 shrink-0 text-[10px] text-muted-foreground text-right pr-2 font-medium">
                          {day}
                        </span>
                        {monthDayData.months.map((m) => {
                          const val = monthDayData.grid[m][day] || 0;
                          return (
                            <Tooltip key={m}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex-1 h-5 rounded-[3px] transition-all cursor-default ${getMonthDayColor(val, rowMax)}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-semibold">
                                  Dia {day} - {format(new Date(parseInt(m.split("-")[0]), parseInt(m.split("-")[1]) - 1, 1), "MMMM/yyyy", { locale: ptBR })}
                                </p>
                                <p>{val > 0 ? formatCurrency(val) : "Sem vendas"}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-1 mt-3 justify-end">
                  <span className="text-[10px] text-muted-foreground mr-1">Menor</span>
                  {["bg-violet-100", "bg-violet-200", "bg-violet-300", "bg-violet-400", "bg-violet-500"].map((c) => (
                    <div key={c} className={`w-4 h-3 rounded-sm ${c}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">Maior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};
