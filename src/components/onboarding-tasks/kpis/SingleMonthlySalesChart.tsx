import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Sparkles, Loader2, Calendar, Award, AlertTriangle } from "lucide-react";
import { format, parseISO, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyDataPoint {
  month: string;
  monthLabel: string;
  revenue: number;
  target: number;
  salesCount: number;
}

interface MonthlyTarget {
  month_year: string;
  target_value: number;
}

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface Salesperson {
  id: string;
  team_id: string | null;
  sector_id: string | null;
  unit_id?: string | null;
}

interface SingleMonthlySalesChartProps {
  companyId: string;
  projectId?: string;
  companyName?: string;
  salespeople?: Salesperson[];
  sectorTeams?: SectorTeam[];
  selectedUnit?: string;
  selectedTeam?: string;
  selectedSector?: string;
  selectedSalesperson?: string;
  // For single KPI mode
  kpiId?: string;
  // For combined mode
  kpiIds?: string[];
  kpiName: string;
  kpiTargetValue: number;
}

export const SingleMonthlySalesChart = ({
  companyId,
  projectId,
  companyName = "",
  salespeople = [],
  sectorTeams = [],
  selectedUnit,
  selectedTeam,
  selectedSector,
  selectedSalesperson,
  kpiId,
  kpiIds,
  kpiName,
  kpiTargetValue,
}: SingleMonthlySalesChartProps) => {
  const normalizeFilter = (value?: string) => {
    if (!value) return undefined;
    const v = String(value).trim();
    if (!v || v === "all") return undefined;
    return v;
  };

  const unitFilter = normalizeFilter(selectedUnit);
  const teamFilter = normalizeFilter(selectedTeam);
  const sectorFilter = normalizeFilter(selectedSector);
  const salespersonFilter = normalizeFilter(selectedSalesperson);

  const [chartData, setChartData] = useState<MonthlyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);

  // Build teamIdsBySectorId map for sector filtering
  const teamIdsBySectorId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach((st) => {
      if (!map[st.sector_id]) {
        map[st.sector_id] = new Set();
      }
      map[st.sector_id].add(st.team_id);
    });
    return map;
  }, [sectorTeams]);

  // Check if a salesperson belongs to a sector (directly or via team)
  const salespersonBelongsToSector = (sp: Salesperson, sectorId: string): boolean => {
    if (sp.sector_id === sectorId) return true;
    if (sp.team_id) {
      const teamsInSector = teamIdsBySectorId[sectorId];
      if (teamsInSector && teamsInSector.has(sp.team_id)) return true;
    }
    return false;
  };

  // Get filtered salesperson IDs based on current filters
  const filteredSalespersonIds = useMemo(() => {
    if (salespersonFilter) {
      return new Set([salespersonFilter]);
    }

    let filtered = salespeople;

    if (sectorFilter) {
      filtered = filtered.filter((sp) => salespersonBelongsToSector(sp, sectorFilter));
    }

    if (teamFilter) {
      filtered = filtered.filter((sp) => sp.team_id === teamFilter);
    }

    if (unitFilter) {
      filtered = filtered.filter((sp) => sp.unit_id === unitFilter);
    }

    return new Set(filtered.map((sp) => sp.id));
  }, [salespeople, salespersonFilter, sectorFilter, teamFilter, unitFilter, teamIdsBySectorId]);

  const hasActiveFilters = !!(salespersonFilter || sectorFilter || teamFilter || unitFilter);

  // Determine which KPI IDs to fetch
  const targetKpiIds = useMemo(() => {
    if (kpiId) return [kpiId];
    if (kpiIds && kpiIds.length > 0) return kpiIds;
    return [];
  }, [kpiId, kpiIds]);

  useEffect(() => {
    fetchData();
  }, [companyId, salespersonFilter, sectorFilter, teamFilter, unitFilter, salespeople.length, targetKpiIds.join(",")]);

  const fetchData = async () => {
    if (targetKpiIds.length === 0) {
      setChartData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const fetchAllEntriesForKpis = async (kpiIdsList: string[]) => {
        const pageSize = 1000;
        let from = 0;
        const all: Array<{ entry_date: string; value: number | null; salesperson_id?: string | null; kpi_id?: string | null }> = [];

        while (true) {
          const { data, error } = await supabase
            .from("kpi_entries")
            .select("entry_date,value,salesperson_id,kpi_id")
            .eq("company_id", companyId)
            .in("kpi_id", kpiIdsList)
            .range(from, from + pageSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        return all;
      };

      // Fetch monthly targets
      let monthlyTargetsMap: Record<string, number> = {};
      if (kpiId) {
        const { data: monthlyTargets } = await supabase
          .from("kpi_monthly_targets")
          .select("month_year, target_value")
          .eq("kpi_id", kpiId);

        if (monthlyTargets) {
          monthlyTargets.forEach((mt: MonthlyTarget) => {
            monthlyTargetsMap[mt.month_year] = mt.target_value;
          });
        }
      }

      const getMonthlyTarget = (monthYear: string): number => {
        const monthKey = format(parseISO(monthYear), "yyyy-MM");
        if (monthlyTargetsMap[monthKey]) {
          return monthlyTargetsMap[monthKey];
        }
        return kpiTargetValue || 0;
      };

      // Fetch sales history for this company
      const { data: salesHistory } = await supabase
        .from("company_sales_history")
        .select("month_year, revenue, sales_count")
        .eq("company_id", companyId);

      // Build monthly aggregation from sales history first (lower priority)
      const monthlyAggregation: Record<string, { revenue: number; count: number }> = {};

      salesHistory?.forEach((sh) => {
        // month_year can be "YYYY-MM-01" or "YYYY-MM" - normalize to "YYYY-MM-01"
        const raw = sh.month_year.substring(0, 7); // "YYYY-MM"
        const monthStr = raw + "-01";
        if (!monthlyAggregation[monthStr]) {
          monthlyAggregation[monthStr] = { revenue: 0, count: 0 };
        }
        monthlyAggregation[monthStr].revenue += Number(sh.revenue) || 0;
        monthlyAggregation[monthStr].count += Number(sh.sales_count) || 0;
      });

      // Overlay with kpi_entries (higher priority)
      const entries = await fetchAllEntriesForKpis(targetKpiIds);

      if (entries && entries.length > 0) {
        let filteredEntries = entries;

        // If filters are active, filter by salesperson
        if (hasActiveFilters && filteredSalespersonIds.size > 0) {
          filteredEntries = entries.filter(
            (e) => !!e.salesperson_id && filteredSalespersonIds.has(e.salesperson_id)
          );
        }

        // Aggregate kpi_entries by month
        const kpiMonthlyAgg: Record<string, { revenue: number; count: number }> = {};
        filteredEntries.forEach((entry) => {
          if (!entry.entry_date) return;
          const monthStr = format(parseISO(entry.entry_date), "yyyy-MM-01");
          if (!kpiMonthlyAgg[monthStr]) {
            kpiMonthlyAgg[monthStr] = { revenue: 0, count: 0 };
          }
          kpiMonthlyAgg[monthStr].revenue += entry.value || 0;
          kpiMonthlyAgg[monthStr].count += 1;
        });

        // Merge: kpi_entries override sales history for same month
        Object.entries(kpiMonthlyAgg).forEach(([monthStr, agg]) => {
          if (agg.revenue > 0) {
            monthlyAggregation[monthStr] = agg;
          }
        });
      }

      // Always build last 12 months
      const now = new Date();
      let data: MonthlyDataPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStr = format(startOfMonth(monthDate), "yyyy-MM-01");
        const agg = monthlyAggregation[monthStr] || { revenue: 0, count: 0 };
        data.push({
          month: monthStr,
          monthLabel: format(parseISO(monthStr), "MMM/yy", { locale: ptBR }),
          revenue: agg.revenue,
          target: getMonthlyTarget(monthStr),
          salesCount: agg.count,
        });
      }

      setChartData(data);
      setAiAnalysis(null);
      setAnalysisGenerated(false);
    } catch (error) {
      console.error("Error fetching monthly sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate statistics
  const average =
    chartData.length > 0
      ? chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length
      : 0;

  const bestMonth =
    chartData.length > 0
      ? chartData.reduce((best, current) => (current.revenue > best.revenue ? current : best), chartData[0])
      : null;

  const worstMonth =
    chartData.length > 0
      ? chartData.reduce((worst, current) => (current.revenue < worst.revenue ? current : worst), chartData[0])
      : null;

  // Calculate trend (last 3 months vs previous 3 months)
  const recentMonths = chartData.slice(-3);
  const previousMonths = chartData.slice(-6, -3);

  const recentAvg =
    recentMonths.length > 0
      ? recentMonths.reduce((sum, d) => sum + d.revenue, 0) / recentMonths.length
      : 0;

  const previousAvg =
    previousMonths.length > 0
      ? previousMonths.reduce((sum, d) => sum + d.revenue, 0) / previousMonths.length
      : 0;

  const trendPercent = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

  const hasPositiveTrend = trendPercent > 0;

  const generateAIAnalysis = async () => {
    if (chartData.length < 1) {
      setAiAnalysis("Preciso de pelo menos 1 mês de dados para gerar uma análise.");
      setAnalysisGenerated(true);
      return;
    }

    setAiLoading(true);
    try {
      const monthlyDetails = chartData
        .map((d) => `${d.monthLabel}: ${formatFullCurrency(d.revenue)}`)
        .join("\n");

      const prompt = `Analise a evolução de ${kpiName} mês a mês desta empresa e identifique padrões, melhores e piores meses, e forneça insights estratégicos.

DADOS POR MÊS:
${monthlyDetails}

ESTATÍSTICAS:
- Média mensal: ${formatFullCurrency(average)}
- Melhor mês: ${bestMonth?.monthLabel} com ${formatFullCurrency(bestMonth?.revenue || 0)}
- Pior mês: ${worstMonth?.monthLabel} com ${formatFullCurrency(worstMonth?.revenue || 0)}
- Tendência recente: ${hasPositiveTrend ? "+" : ""}${trendPercent.toFixed(1)}% (últimos 3 meses vs anteriores)

INSTRUÇÕES:
1) Identifique os MELHORES meses e analise possíveis razões
2) Identifique os PIORES meses e sugira hipóteses
3) Detecte padrões sazonais
4) Avalie a tendência recente
5) Dê 2-3 recomendações práticas

FORMATO:
- Use emojis
- Seja objetivo
- Máximo 5 parágrafos

Empresa: "${companyName || "cliente"}".`;

      const { data, error } = await supabase.functions.invoke("onboarding-ai-chat", {
        body: {
          projectId: projectId || companyId,
          companyId,
          message: prompt,
          history: [],
        },
      });

      if (error) throw error;

      setAiAnalysis(data?.response || data?.message || data?.content || "Análise não disponível.");
      setAnalysisGenerated(true);
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      setAiAnalysis("Não foi possível gerar a análise no momento. Tente novamente.");
      setAnalysisGenerated(true);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            {kpiName} - Mês a Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium">Nenhum dado de {kpiName} histórico</p>
            <p className="text-sm">Cadastre o histórico para visualizar a evolução</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasTarget = data.target > 0;
      const percent = hasTarget ? (data.revenue / data.target) * 100 : 0;

      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.monthLabel}</p>
          <div className="space-y-1">
            <p className="text-lg font-bold text-primary">
              Realizado: {formatFullCurrency(data.revenue)}
            </p>
            {hasTarget && (
              <>
                <p className="text-sm text-muted-foreground">Meta: {formatFullCurrency(data.target)}</p>
                <p
                  className={`text-sm font-medium ${
                    percent >= 100 ? "text-green-600" : percent >= 70 ? "text-amber-600" : "text-red-600"
                  }`}
                >
                  {percent.toFixed(1)}% da meta
                </p>
              </>
            )}
          </div>
          {data.salesCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{data.salesCount} lançamentos</p>
          )}
        </div>
      );
    }
    return null;
  };

  const hasTargets = chartData.some((d) => d.target > 0);

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/[0.03] via-transparent to-primary/[0.04] dark:from-indigo-800/20 dark:via-transparent dark:to-primary/15" />
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-radial from-primary/[0.07] to-transparent rounded-full blur-3xl" />

      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-primary text-white shadow-lg shadow-indigo-500/20">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{kpiName} - Mês a Mês</CardTitle>
              <p className="text-xs text-muted-foreground">{chartData.length} meses de histórico</p>
            </div>
          </div>
          {chartData.length >= 6 && (
            <Badge
              variant="outline"
              className={`gap-1.5 px-3 py-1 text-sm font-bold border-0 shadow-sm ${
                hasPositiveTrend
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {hasPositiveTrend ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {hasPositiveTrend ? "+" : ""}{trendPercent.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="relative overflow-hidden rounded-xl border p-3 bg-card/80 backdrop-blur-sm text-center">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/40 to-primary/10" />
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Média Mensal</p>
            <p className="text-sm sm:text-base font-bold truncate mt-0.5">{formatFullCurrency(average)}</p>
          </div>

          <div className="relative overflow-hidden rounded-xl border p-3 bg-card/80 backdrop-blur-sm text-center">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/10" />
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Meses</p>
            <p className="text-sm sm:text-base font-bold mt-0.5">{chartData.length}</p>
          </div>

          {bestMonth && (
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 p-3 bg-emerald-500/[0.03] text-center">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Award className="h-3 w-3 text-emerald-600" />
                <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Melhor</p>
              </div>
              <p className="text-xs font-bold truncate">
                {bestMonth.monthLabel}: {formatCurrency(bestMonth.revenue)}
              </p>
            </div>
          )}

          {worstMonth && (
            <div className="relative overflow-hidden rounded-xl border border-red-500/20 p-3 bg-red-500/[0.03] text-center">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-400 to-orange-500" />
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                <p className="text-[10px] sm:text-xs text-red-600 font-medium">Menor</p>
              </div>
              <p className="text-xs font-bold truncate">
                {worstMonth.monthLabel}: {formatCurrency(worstMonth.revenue)}
              </p>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="h-[300px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id={`colorRevenue-${kpiName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`colorTarget-${kpiName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="6 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Média: ${formatCurrency(average)}`,
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
              )}
              {hasTargets && (
                <Area
                  type="monotone"
                  dataKey="target"
                  name="Meta"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill={`url(#colorTarget-${kpiName})`}
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="revenue"
                name="Realizado"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill={`url(#colorRevenue-${kpiName})`}
                dot={{ r: 3, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {hasTargets && (
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/30" />
              <span className="text-xs text-muted-foreground">Realizado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: "hsl(var(--chart-2))" }} />
              <span className="text-xs text-muted-foreground">Meta</span>
            </div>
          </div>
        )}

        {/* AI Analysis Section */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/5 via-primary/10 to-violet-500/5 p-4">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-violet-500 to-primary" />
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">Análise Inteligente</p>
                {analysisGenerated && !aiLoading && (
                  <Button variant="ghost" size="sm" onClick={generateAIAnalysis} className="h-7 text-xs">
                    Regenerar
                  </Button>
                )}
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando dados...
                </div>
              ) : aiAnalysis ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {aiAnalysis}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Gere uma análise inteligente sobre a evolução, identificando melhores e piores meses.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateAIAnalysis}
                    className="gap-2"
                    disabled={chartData.length < 1}
                  >
                    <Sparkles className="h-3 w-3" />
                    Gerar Análise
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
