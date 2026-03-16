import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Minus, GitCompareArrows } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  is_main_goal?: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  team_id: string | null;
  unit_id: string | null;
  sector_id: string | null;
}

interface PeriodComparisonCardProps {
  companyId: string;
  kpis: KPI[];
  salespeople: Salesperson[];
  dateRange: { start: string; end: string };
  selectedKpi?: string;
  selectedSalesperson?: string;
  selectedUnit?: string;
  selectedTeam?: string;
  selectedSector?: string;
  sectorTeams?: { sector_id: string; team_id: string }[];
}

interface ComparisonData {
  kpiId: string;
  kpiName: string;
  kpiType: string;
  currentTotal: number;
  previousTotal: number;
  variation: number; // percentage
}

export const PeriodComparisonCard = ({
  companyId,
  kpis,
  salespeople,
  dateRange,
  selectedKpi = "all",
  selectedSalesperson = "all",
  selectedUnit = "all",
  selectedTeam = "all",
  selectedSector = "all",
  sectorTeams = [],
}: PeriodComparisonCardProps) => {
  const [comparisons, setComparisons] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousPeriodLabel, setPreviousPeriodLabel] = useState("");

  useEffect(() => {
    fetchComparison();
  }, [companyId, dateRange, selectedKpi, selectedSalesperson, selectedUnit, selectedTeam, selectedSector]);

  const getFilteredSalespeopleIds = (): string[] => {
    let filtered = salespeople;
    if (selectedUnit !== "all") {
      filtered = filtered.filter(sp => sp.unit_id === selectedUnit);
    }
    if (selectedSector !== "all") {
      const teamsInSector = sectorTeams.filter(st => st.sector_id === selectedSector).map(st => st.team_id);
      filtered = filtered.filter(sp => sp.team_id && teamsInSector.includes(sp.team_id));
    }
    if (selectedTeam !== "all") {
      filtered = filtered.filter(sp => sp.team_id === selectedTeam);
    }
    if (selectedSalesperson !== "all") {
      filtered = filtered.filter(sp => sp.id === selectedSalesperson);
    }
    return filtered.map(sp => sp.id);
  };

  const fetchComparison = async () => {
    if (!companyId || !dateRange.start || !dateRange.end) return;

    setLoading(true);
    try {
      const startDate = parseDateLocal(dateRange.start);
      const endDate = parseDateLocal(dateRange.end);

      // Previous period = same dates but one month earlier
      const prevStart = subMonths(startDate, 1);
      const prevEnd = subMonths(endDate, 1);

      const prevStartStr = format(prevStart, "yyyy-MM-dd");
      const prevEndStr = format(prevEnd, "yyyy-MM-dd");

      setPreviousPeriodLabel(
        `${format(prevStart, "dd/MM", { locale: ptBR })} - ${format(prevEnd, "dd/MM", { locale: ptBR })}`
      );

      // Fetch both periods in parallel
      const [currentRes, previousRes] = await Promise.all([
        supabase
          .from("kpi_entries")
          .select("kpi_id, salesperson_id, value")
          .eq("company_id", companyId)
          .gte("entry_date", dateRange.start)
          .lte("entry_date", dateRange.end),
        supabase
          .from("kpi_entries")
          .select("kpi_id, salesperson_id, value")
          .eq("company_id", companyId)
          .gte("entry_date", prevStartStr)
          .lte("entry_date", prevEndStr),
      ]);

      if (currentRes.error || previousRes.error) throw currentRes.error || previousRes.error;

      const filteredIds = getFilteredSalespeopleIds();
      const filterEntries = (entries: any[]) =>
        entries.filter(e => filteredIds.includes(e.salesperson_id));

      const currentEntries = filterEntries(currentRes.data || []);
      const previousEntries = filterEntries(previousRes.data || []);

      // Determine which KPIs to show
      const targetKpis = selectedKpi !== "all"
        ? kpis.filter(k => k.id === selectedKpi)
        : kpis.filter(k => k.is_main_goal || k.kpi_type === "monetary");

      // If no main goals, show all
      const effectiveKpis = targetKpis.length > 0 ? targetKpis : kpis;

      const results: ComparisonData[] = effectiveKpis.map(kpi => {
        const currentTotal = currentEntries
          .filter(e => e.kpi_id === kpi.id)
          .reduce((sum, e) => sum + Number(e.value || 0), 0);

        const previousTotal = previousEntries
          .filter(e => e.kpi_id === kpi.id)
          .reduce((sum, e) => sum + Number(e.value || 0), 0);

        const variation = previousTotal > 0
          ? ((currentTotal - previousTotal) / previousTotal) * 100
          : currentTotal > 0 ? 100 : 0;

        return {
          kpiId: kpi.id,
          kpiName: kpi.name,
          kpiType: kpi.kpi_type,
          currentTotal,
          previousTotal,
          variation,
        };
      });

      // Only show KPIs that have data in at least one period
      setComparisons(results.filter(r => r.currentTotal > 0 || r.previousTotal > 0));
    } catch (err) {
      console.error("Error fetching period comparison:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
    }
    if (type === "percentage") return `${value.toFixed(1)}%`;
    return value.toLocaleString("pt-BR");
  };

  const currentLabel = `${format(parseDateLocal(dateRange.start), "dd/MM", { locale: ptBR })} - ${format(parseDateLocal(dateRange.end), "dd/MM", { locale: ptBR })}`;

  if (loading) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-[150px] text-muted-foreground">
            Carregando comparativo...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (comparisons.length === 0) return null;

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/[0.03] via-transparent to-blue-900/[0.04] dark:from-indigo-800/20 dark:via-transparent dark:to-blue-900/15" />
      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <GitCompareArrows className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Comparativo por Período</CardTitle>
              <p className="text-xs text-muted-foreground">
                {currentLabel} vs {previousPeriodLabel}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-3">
        {comparisons.map((comp) => {
          const isPositive = comp.variation > 0;
          const isNeutral = comp.variation === 0;

          return (
            <div
              key={comp.kpiId}
              className="rounded-xl border p-4 bg-card/60 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{comp.kpiName}</span>
                <Badge
                  variant="outline"
                  className={`gap-1 text-xs font-bold border-0 px-2.5 py-1 ${
                    isNeutral
                      ? "bg-muted text-muted-foreground"
                      : isPositive
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}
                >
                  {isNeutral ? (
                    <Minus className="h-3 w-3" />
                  ) : isPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {isNeutral ? "Sem variação" : `${comp.variation > 0 ? "+" : ""}${comp.variation.toFixed(1)}%`}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Período Atual
                  </p>
                  <p className="text-lg font-bold">
                    {formatValue(comp.currentTotal, comp.kpiType)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Período Anterior
                  </p>
                  <p className="text-lg font-bold text-muted-foreground">
                    {formatValue(comp.previousTotal, comp.kpiType)}
                  </p>
                </div>
              </div>

              {/* Visual bar comparison */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">Atual</span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
                      style={{
                        width: `${Math.min(
                          Math.max(comp.currentTotal, comp.previousTotal) > 0
                            ? (comp.currentTotal / Math.max(comp.currentTotal, comp.previousTotal)) * 100
                            : 0,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">Anterior</span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-muted-foreground/30 transition-all"
                      style={{
                        width: `${Math.min(
                          Math.max(comp.currentTotal, comp.previousTotal) > 0
                            ? (comp.previousTotal / Math.max(comp.currentTotal, comp.previousTotal)) * 100
                            : 0,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
