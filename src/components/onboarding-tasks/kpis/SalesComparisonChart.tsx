import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowRight, BarChart3 } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SalesHistoryEntry {
  id: string;
  month_year: string;
  revenue: number;
  sales_count: number | null;
  is_pre_unv: boolean;
}

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  revenue: number;
  isPreUnv: boolean;
  fill: string;
}

interface SalesComparisonChartProps {
  companyId: string;
  contractStartDate?: string | null;
  currentMonthRevenue?: number;
  refreshKey?: number;
}

export const SalesComparisonChart = ({ 
  companyId, 
  contractStartDate, 
  currentMonthRevenue = 0,
  refreshKey = 0 
}: SalesComparisonChartProps) => {
  const [historyData, setHistoryData] = useState<SalesHistoryEntry[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [companyId, currentMonthRevenue, refreshKey]);

  const fetchData = async () => {
    try {
      // Fetch historical data
      const { data: history, error } = await supabase
        .from("company_sales_history")
        .select("*")
        .eq("company_id", companyId)
        .order("month_year", { ascending: true });

      if (error) throw error;
      setHistoryData(history || []);

      // Build chart data
      const data: ChartDataPoint[] = (history || []).map((entry) => ({
        month: entry.month_year,
        monthLabel: format(parseISO(entry.month_year), "MMM/yy", { locale: ptBR }),
        revenue: entry.revenue,
        isPreUnv: entry.is_pre_unv,
        fill: entry.is_pre_unv ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))",
      }));

      // Add current month if we have revenue data
      if (currentMonthRevenue > 0) {
        const currentMonth = startOfMonth(new Date());
        const currentMonthStr = format(currentMonth, "yyyy-MM-dd");
        
        // Check if current month already exists in history
        const hasCurrentMonth = data.some(
          (d) => d.month === currentMonthStr
        );

        if (!hasCurrentMonth) {
          data.push({
            month: currentMonthStr,
            monthLabel: format(currentMonth, "MMM/yy", { locale: ptBR }),
            revenue: currentMonthRevenue,
            isPreUnv: false,
            fill: "hsl(var(--primary))",
          });
        }
      }

      // Sort by date
      data.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      setChartData(data);
    } catch (error) {
      console.error("Error fetching sales comparison data:", error);
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

  // Calculate averages
  const preUnvData = chartData.filter((d) => d.isPreUnv);
  const postUnvData = chartData.filter((d) => !d.isPreUnv);

  const preUnvAvg = preUnvData.length > 0
    ? preUnvData.reduce((sum, d) => sum + d.revenue, 0) / preUnvData.length
    : 0;

  const postUnvAvg = postUnvData.length > 0
    ? postUnvData.reduce((sum, d) => sum + d.revenue, 0) / postUnvData.length
    : 0;

  const growthPercent = preUnvAvg > 0
    ? ((postUnvAvg - preUnvAvg) / preUnvAvg) * 100
    : 0;

  const hasGrowth = growthPercent > 0;

  if (loading) {
    return null;
  }

  if (chartData.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.monthLabel}</p>
          <p className="text-lg font-bold">{formatFullCurrency(data.revenue)}</p>
          <p className={`text-xs ${data.isPreUnv ? "text-orange-500" : "text-primary"}`}>
            {data.isPreUnv ? "Antes da UNV" : "Depois da UNV"}
          </p>
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
            <BarChart3 className="h-5 w-5" />
            Comparativo de Vendas: Antes vs Depois da UNV
          </CardTitle>
          {preUnvData.length > 0 && postUnvData.length > 0 && (
            <Badge 
              variant={hasGrowth ? "default" : "destructive"} 
              className="gap-1"
            >
              {hasGrowth ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {hasGrowth ? "+" : ""}{growthPercent.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
            <CardContent className="p-2 sm:pt-4 sm:px-4">
              <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 font-medium leading-tight">
                Média Antes da UNV
              </p>
              <p className="text-sm sm:text-lg font-bold text-orange-700 dark:text-orange-300 truncate">
                {preUnvData.length > 0 ? formatFullCurrency(preUnvAvg) : "—"}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {preUnvData.length} mês{preUnvData.length !== 1 ? "es" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 flex items-center justify-center">
            <CardContent className="p-2 sm:pt-4 text-center">
              <ArrowRight className="h-5 w-5 sm:h-8 sm:w-8 mx-auto text-muted-foreground" />
              {preUnvData.length > 0 && postUnvData.length > 0 && (
                <p className={`text-xs sm:text-sm font-bold mt-1 ${hasGrowth ? "text-green-600" : "text-red-600"}`}>
                  {hasGrowth ? "+" : ""}{formatFullCurrency(postUnvAvg - preUnvAvg)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-2 sm:pt-4 sm:px-4">
              <p className="text-[10px] sm:text-xs text-primary font-medium leading-tight">
                Média Depois da UNV
              </p>
              <p className="text-sm sm:text-lg font-bold text-primary truncate">
                {postUnvData.length > 0 ? formatFullCurrency(postUnvAvg) : "—"}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {postUnvData.length} mês{postUnvData.length !== 1 ? "es" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
              <Legend 
                formatter={(value) => (
                  <span className="text-sm">{value}</span>
                )}
              />
              {preUnvAvg > 0 && (
                <ReferenceLine
                  y={preUnvAvg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Média Antes: ${formatCurrency(preUnvAvg)}`,
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
              )}
              <Bar
                dataKey="revenue"
                name="Faturamento"
                radius={[4, 4, 0, 0]}
                fill="hsl(var(--primary))"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted-foreground" />
            <span>Antes da UNV</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary" />
            <span>Depois da UNV</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
