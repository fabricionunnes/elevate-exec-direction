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
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyDataPoint {
  month: string;
  monthLabel: string;
  revenue: number;
  target: number;
  salesCount: number;
}

interface MainGoalKpi {
  id: string;
  name: string;
  kpi_type: string;
  target_value: number;
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

interface MonthlySalesChartProps {
  companyId: string;
  projectId?: string;
  companyName?: string;
  salespeople?: Salesperson[];
  sectorTeams?: SectorTeam[];
  selectedUnit?: string;
  selectedTeam?: string;
  selectedSector?: string;
  selectedSalesperson?: string;
}

export const MonthlySalesChart = ({ 
  companyId,
  projectId,
  companyName = "",
  salespeople = [],
  sectorTeams = [],
  selectedUnit,
  selectedTeam,
  selectedSector,
  selectedSalesperson,
}: MonthlySalesChartProps) => {
  const [chartData, setChartData] = useState<MonthlyDataPoint[]>([]);
  const [mainGoalKpi, setMainGoalKpi] = useState<MainGoalKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);

  // Build teamIdsBySectorId map for sector filtering
  const teamIdsBySectorId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach(st => {
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
    if (selectedSalesperson) {
      return new Set([selectedSalesperson]);
    }
    
    let filtered = salespeople;
    
    if (selectedSector) {
      filtered = filtered.filter(sp => salespersonBelongsToSector(sp, selectedSector));
    }
    
    if (selectedTeam) {
      filtered = filtered.filter(sp => sp.team_id === selectedTeam);
    }
    
    if (selectedUnit) {
      // Filter by unit - need to check if salesperson's team is in the unit
      // For now, filter direct unit_id match
      filtered = filtered.filter(sp => sp.unit_id === selectedUnit);
    }
    
    return new Set(filtered.map(sp => sp.id));
  }, [salespeople, selectedSalesperson, selectedSector, selectedTeam, selectedUnit, teamIdsBySectorId]);

  const hasActiveFilters = !!(selectedSalesperson || selectedSector || selectedTeam || selectedUnit);

  useEffect(() => {
    fetchData();
  }, [companyId, selectedSalesperson, selectedSector, selectedTeam, selectedUnit, salespeople.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // First, find the main goal KPI for this company
      // When filters are active, look for KPIs that match the filter scope
      let kpiQuery = supabase
        .from("company_kpis")
        .select("id, name, kpi_type, target_value")
        .eq("company_id", companyId)
        .eq("kpi_type", "monetary");

      // If team is selected, prioritize team-scoped KPI
      if (selectedTeam) {
        kpiQuery = kpiQuery.eq("team_id", selectedTeam);
      }

      const { data: monetaryKpis } = await kpiQuery;
      
      let selectedKpi: MainGoalKpi | null = null;
      
      if (monetaryKpis && monetaryKpis.length > 0) {
        // Look for is_main_goal first
        const mainGoal = monetaryKpis.find((k: any) => k.is_main_goal);
        selectedKpi = (mainGoal || monetaryKpis[0]) as MainGoalKpi;
      } else {
        // Fallback: get any main goal or monetary KPI
        const { data: fallbackKpis } = await supabase
          .from("company_kpis")
          .select("id, name, kpi_type, target_value")
          .eq("company_id", companyId)
          .eq("kpi_type", "monetary")
          .limit(1);
        
        if (fallbackKpis && fallbackKpis.length > 0) {
          selectedKpi = fallbackKpis[0] as MainGoalKpi;
        }
      }

      setMainGoalKpi(selectedKpi);

      // Fetch monthly targets from kpi_monthly_targets table
      let monthlyTargetsMap: Record<string, number> = {};
      if (selectedKpi) {
        const { data: monthlyTargets } = await supabase
          .from("kpi_monthly_targets")
          .select("month_year, target_value")
          .eq("kpi_id", selectedKpi.id);
        
        if (monthlyTargets) {
          monthlyTargets.forEach((mt: MonthlyTarget) => {
            monthlyTargetsMap[mt.month_year] = mt.target_value;
          });
        }
      }

      // Get monthly target for the current KPI
      const getMonthlyTarget = (monthYear: string): number => {
        if (!selectedKpi) return 0;
        
        // Check monthly_targets table first
        const monthKey = format(parseISO(monthYear), "yyyy-MM");
        if (monthlyTargetsMap[monthKey]) {
          return monthlyTargetsMap[monthKey];
        }
        
        // Fallback to base target
        return selectedKpi.target_value || 0;
      };

      let data: MonthlyDataPoint[] = [];

      // When filters are active, calculate from kpi_entries
      if (hasActiveFilters && filteredSalespersonIds.size > 0) {
        // Get all monetary KPIs for aggregation
        const { data: allMonetaryKpis } = await supabase
          .from("company_kpis")
          .select("id")
          .eq("company_id", companyId)
          .eq("kpi_type", "monetary")
          .eq("is_active", true);

        const monetaryKpiIds = (allMonetaryKpis || []).map(k => k.id);

        if (monetaryKpiIds.length > 0) {
          // Fetch ALL kpi_entries for monetary KPIs
          const { data: entries } = await supabase
            .from("kpi_entries")
            .select("*")
            .eq("company_id", companyId)
            .in("kpi_id", monetaryKpiIds);

          if (entries && entries.length > 0) {
            // Filter entries by salesperson
            const filteredEntries = entries.filter(e => 
              filteredSalespersonIds.has(e.salesperson_id)
            );

            // Aggregate by month
            const monthlyAggregation: Record<string, { revenue: number; count: number }> = {};
            
            filteredEntries.forEach(entry => {
              const monthStr = format(parseISO(entry.entry_date), "yyyy-MM-01");
              if (!monthlyAggregation[monthStr]) {
                monthlyAggregation[monthStr] = { revenue: 0, count: 0 };
              }
              monthlyAggregation[monthStr].revenue += entry.value;
              monthlyAggregation[monthStr].count += 1;
            });

            // Convert to chart data
            data = Object.entries(monthlyAggregation).map(([month, agg]) => ({
              month,
              monthLabel: format(parseISO(month), "MMM/yy", { locale: ptBR }),
              revenue: agg.revenue,
              target: getMonthlyTarget(month),
              salesCount: agg.count,
            }));
          }
        }
      } else {
        // No filters - use company_sales_history (historical aggregated data)
        const { data: history, error } = await supabase
          .from("company_sales_history")
          .select("*")
          .eq("company_id", companyId)
          .order("month_year", { ascending: true });

        if (error) throw error;

        if (history && history.length > 0) {
          // Build chart data from history
          data = history.map((entry) => ({
            month: entry.month_year,
            monthLabel: format(parseISO(entry.month_year), "MMM/yy", { locale: ptBR }),
            revenue: entry.revenue || 0,
            target: getMonthlyTarget(entry.month_year),
            salesCount: entry.sales_count || 0,
          }));
        } else {
          // Fallback: if the company has not filled `company_sales_history` yet,
          // build month-by-month revenue from the monetary KPI entries so the chart
          // still shows ALL months with data.
          const { data: allMonetaryKpis } = await supabase
            .from("company_kpis")
            .select("id")
            .eq("company_id", companyId)
            .eq("kpi_type", "monetary")
            .eq("is_active", true);

          const monetaryKpiIds = (allMonetaryKpis || []).map((k) => k.id);

          if (monetaryKpiIds.length > 0) {
            const { data: entries } = await supabase
              .from("kpi_entries")
              .select("entry_date, value")
              .eq("company_id", companyId)
              .in("kpi_id", monetaryKpiIds);

            if (entries && entries.length > 0) {
              const monthlyAggregation: Record<string, number> = {};

              entries.forEach((entry) => {
                if (!entry.entry_date) return;
                const monthStr = format(parseISO(entry.entry_date), "yyyy-MM-01");
                monthlyAggregation[monthStr] = (monthlyAggregation[monthStr] || 0) + (entry.value || 0);
              });

              data = Object.entries(monthlyAggregation).map(([month, revenue]) => ({
                month,
                monthLabel: format(parseISO(month), "MMM/yy", { locale: ptBR }),
                revenue,
                target: getMonthlyTarget(month),
                salesCount: 0,
              }));
            }
          }
        }

        // Also fetch current month data from main goal KPI entries
        const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
        
        if (selectedKpi) {
          const { data: currentEntries } = await supabase
            .from("kpi_entries")
            .select("value")
            .eq("company_id", companyId)
            .eq("kpi_id", selectedKpi.id)
            .gte("entry_date", currentMonthStart);

          if (currentEntries && currentEntries.length > 0) {
            const currentRevenue = currentEntries.reduce((sum, e) => sum + e.value, 0);
            const currentMonthStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
            
            // Check if current month already exists
            const existingIdx = data.findIndex(d => d.month === currentMonthStr);
            if (existingIdx >= 0) {
              data[existingIdx].revenue = Math.max(data[existingIdx].revenue, currentRevenue);
            } else if (currentRevenue > 0) {
              data.push({
                month: currentMonthStr,
                monthLabel: format(new Date(), "MMM/yy", { locale: ptBR }),
                revenue: currentRevenue,
                target: getMonthlyTarget(currentMonthStr),
                salesCount: 0,
              });
            }
          }
        }
      }

      // Sort by date
      data.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

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
  const average = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length
    : 0;

  const bestMonth = chartData.length > 0
    ? chartData.reduce((best, current) => current.revenue > best.revenue ? current : best, chartData[0])
    : null;

  const worstMonth = chartData.length > 0
    ? chartData.reduce((worst, current) => current.revenue < worst.revenue ? current : worst, chartData[0])
    : null;

  // Calculate trend (last 3 months vs previous 3 months)
  const recentMonths = chartData.slice(-3);
  const previousMonths = chartData.slice(-6, -3);
  
  const recentAvg = recentMonths.length > 0
    ? recentMonths.reduce((sum, d) => sum + d.revenue, 0) / recentMonths.length
    : 0;
  
  const previousAvg = previousMonths.length > 0
    ? previousMonths.reduce((sum, d) => sum + d.revenue, 0) / previousMonths.length
    : 0;

  const trendPercent = previousAvg > 0
    ? ((recentAvg - previousAvg) / previousAvg) * 100
    : 0;

  const hasPositiveTrend = trendPercent > 0;

  const generateAIAnalysis = async () => {
    if (chartData.length < 1) {
      setAiAnalysis("Preciso de pelo menos 1 mês de dados para gerar uma análise.");
      setAnalysisGenerated(true);
      return;
    }

    setAiLoading(true);
    try {
      // Build context for AI
      const monthlyDetails = chartData.map(d => 
        `${d.monthLabel}: ${formatFullCurrency(d.revenue)}`
      ).join("\n");

      const prompt = `Analise a evolução de vendas mês a mês desta empresa e identifique padrões, melhores e piores meses, e forneça insights estratégicos.

DADOS DE VENDAS POR MÊS:
${monthlyDetails}

ESTATÍSTICAS:
- Média mensal: ${formatFullCurrency(average)}
- Melhor mês: ${bestMonth?.monthLabel} com ${formatFullCurrency(bestMonth?.revenue || 0)}
- Pior mês: ${worstMonth?.monthLabel} com ${formatFullCurrency(worstMonth?.revenue || 0)}
- Tendência recente: ${hasPositiveTrend ? "+" : ""}${trendPercent.toFixed(1)}% (últimos 3 meses vs anteriores)

INSTRUÇÕES:
1) Identifique os MELHORES meses e analise possíveis razões (sazonalidade, campanhas, eventos do mercado)
2) Identifique os PIORES meses e sugira hipóteses para queda
3) Detecte padrões sazonais se houver (ex: meses de alta/baixa recorrentes)
4) Avalie a tendência recente e projete o que pode acontecer
5) Dê 2-3 recomendações práticas baseadas nos padrões encontrados

FORMATO:
- Use emojis para destacar pontos importantes
- Seja objetivo e direto
- Máximo 5 parágrafos

Empresa: "${companyName || 'cliente'}".`;

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
            Vendas Mês a Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium">Nenhum dado de vendas histórico</p>
            <p className="text-sm">Cadastre o histórico de vendas para visualizar a evolução</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatValueByType = (value: number) => {
    if (!mainGoalKpi) return formatFullCurrency(value);
    
    if (mainGoalKpi.kpi_type === "monetary") {
      return formatFullCurrency(value);
    } else if (mainGoalKpi.kpi_type === "percentage") {
      return `${value.toFixed(1)}%`;
    } else {
      return value.toLocaleString("pt-BR");
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasTarget = data.target > 0;
      const percent = hasTarget ? ((data.revenue / data.target) * 100) : 0;
      
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.monthLabel}</p>
          <div className="space-y-1">
            <p className="text-lg font-bold text-primary">
              Realizado: {formatValueByType(data.revenue)}
            </p>
            {hasTarget && (
              <>
                <p className="text-sm text-muted-foreground">
                  Meta: {formatValueByType(data.target)}
                </p>
                <p className={`text-sm font-medium ${percent >= 100 ? 'text-green-600' : percent >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {percent.toFixed(1)}% da meta
                </p>
              </>
            )}
          </div>
          {data.salesCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{data.salesCount} vendas</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Check if we have targets to display
  const hasTargets = chartData.some(d => d.target > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              {mainGoalKpi ? mainGoalKpi.name : "Meta Principal"} - Mês a Mês
            </CardTitle>
            {mainGoalKpi && (
              <Badge variant="outline" className="text-xs">
                {mainGoalKpi.kpi_type === "monetary" ? "R$" : mainGoalKpi.kpi_type === "percentage" ? "%" : "#"}
              </Badge>
            )}
          </div>
          {chartData.length >= 6 && (
            <Badge 
              variant={hasPositiveTrend ? "default" : "destructive"} 
              className="gap-1"
            >
              {hasPositiveTrend ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {hasPositiveTrend ? "+" : ""}{trendPercent.toFixed(1)}% tendência
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Média Mensal</p>
              <p className="text-sm sm:text-base font-bold truncate">{formatFullCurrency(average)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Meses</p>
              <p className="text-sm sm:text-base font-bold">{chartData.length}</p>
            </CardContent>
          </Card>
          
          {bestMonth && (
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Award className="h-3 w-3 text-green-600" />
                  <p className="text-[10px] sm:text-xs text-green-600 font-medium">Melhor</p>
                </div>
                <p className="text-xs font-bold text-green-700 dark:text-green-300 truncate">
                  {bestMonth.monthLabel}: {formatCurrency(bestMonth.revenue)}
                </p>
              </CardContent>
            </Card>
          )}
          
          {worstMonth && (
            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                  <p className="text-[10px] sm:text-xs text-red-600 font-medium">Menor</p>
                </div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300 truncate">
                  {worstMonth.monthLabel}: {formatCurrency(worstMonth.revenue)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chart */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip content={<CustomTooltip />} />
              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Média: ${formatCurrency(average)}`,
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
              )}
              {/* Target area (if available) */}
              {hasTargets && (
                <Area
                  type="monotone"
                  dataKey="target"
                  name="Meta"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="url(#colorTarget)"
                />
              )}
              {/* Realized area */}
              <Area
                type="monotone"
                dataKey="revenue"
                name="Realizado"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {hasTargets && (
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Realizado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(var(--chart-2))" }} />
              <span className="text-muted-foreground">Meta</span>
            </div>
          </div>
        )}

        {/* AI Analysis Section */}
        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-primary">Análise Inteligente</p>
                  {analysisGenerated && !aiLoading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={generateAIAnalysis}
                      className="h-7 text-xs"
                    >
                      Regenerar
                    </Button>
                  )}
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando dados de vendas...
                  </div>
                ) : aiAnalysis ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {aiAnalysis}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Gere uma análise inteligente sobre a evolução das vendas, identificando melhores e piores meses, padrões sazonais e recomendações.
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
                    {chartData.length < 1 && (
                      <p className="text-xs text-muted-foreground">
                        Necessário pelo menos 1 mês de dados
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
