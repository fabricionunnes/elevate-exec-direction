import { useState, useEffect } from "react";
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
  salesCount: number;
}

interface MonthlySalesChartProps {
  companyId: string;
  projectId?: string;
  companyName?: string;
}

export const MonthlySalesChart = ({ 
  companyId,
  projectId,
  companyName = ""
}: MonthlySalesChartProps) => {
  const [chartData, setChartData] = useState<MonthlyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      // Fetch historical data from company_sales_history
      const { data: history, error } = await supabase
        .from("company_sales_history")
        .select("*")
        .eq("company_id", companyId)
        .order("month_year", { ascending: true });

      if (error) throw error;

      // Build chart data from history
      const data: MonthlyDataPoint[] = (history || []).map((entry) => ({
        month: entry.month_year,
        monthLabel: format(parseISO(entry.month_year), "MMM/yy", { locale: ptBR }),
        revenue: entry.revenue || 0,
        salesCount: entry.sales_count || 0,
      }));

      // Also fetch current month data from KPI entries (monetary KPIs)
      const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const { data: currentEntries } = await supabase
        .from("kpi_entries")
        .select(`
          value,
          company_kpis!inner(kpi_type)
        `)
        .eq("company_id", companyId)
        .gte("entry_date", currentMonthStart)
        .eq("company_kpis.kpi_type", "monetary");

      if (currentEntries && currentEntries.length > 0) {
        const currentRevenue = currentEntries.reduce((sum, e) => sum + e.value, 0);
        const currentMonthStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
        
        // Check if current month already exists
        const existingIdx = data.findIndex(d => d.month === currentMonthStr);
        if (existingIdx >= 0) {
          // Update existing
          data[existingIdx].revenue = Math.max(data[existingIdx].revenue, currentRevenue);
        } else if (currentRevenue > 0) {
          // Add current month
          data.push({
            month: currentMonthStr,
            monthLabel: format(new Date(), "MMM/yy", { locale: ptBR }),
            revenue: currentRevenue,
            salesCount: 0,
          });
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
    if (chartData.length < 3) {
      setAiAnalysis("Preciso de pelo menos 3 meses de dados para gerar uma análise significativa.");
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.monthLabel}</p>
          <p className="text-lg font-bold text-primary">{formatFullCurrency(data.revenue)}</p>
          {data.salesCount > 0 && (
            <p className="text-xs text-muted-foreground">{data.salesCount} vendas</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            Vendas Mês a Mês
          </CardTitle>
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
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

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
                      disabled={chartData.length < 3}
                    >
                      <Sparkles className="h-3 w-3" />
                      Gerar Análise
                    </Button>
                    {chartData.length < 3 && (
                      <p className="text-xs text-muted-foreground">
                        Mínimo de 3 meses de dados necessários
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
