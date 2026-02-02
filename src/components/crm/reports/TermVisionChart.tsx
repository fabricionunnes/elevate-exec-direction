import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  Cell,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, Eye, Calendar, Clock } from "lucide-react";

interface MonthlyData {
  month: string;
  monthLabel: string;
  shortLabel: string;
  revenue: number;
}

interface TermVisionChartProps {
  className?: string;
}

export const TermVisionChart = ({ className }: TermVisionChartProps) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [kpis, setKpis] = useState({
    qtr: 0,      // Soma dos últimos 3 meses
    ytd: 0,      // Soma de janeiro até mês anterior
    mat: 0,      // Soma dos últimos 12 meses
    currentMonth: 0,  // Mês atual
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed (0 = Janeiro)
      
      // Get data for the last 12 months + current month
      const startDate = subMonths(startOfMonth(now), 12);
      const endDate = endOfMonth(now);
      
      const { data: salesData } = await supabase
        .from("crm_sales")
        .select("sale_date, revenue_value, billing_value")
        .gte("sale_date", format(startDate, "yyyy-MM-dd"))
        .lte("sale_date", format(endDate, "yyyy-MM-dd"));
      
      // Group by month
      const monthlyRevenue: Record<string, number> = {};
      
      (salesData || []).forEach(sale => {
        const monthKey = format(new Date(sale.sale_date), "yyyy-MM");
        const value = parseFloat(String(sale.revenue_value || sale.billing_value || 0));
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + value;
      });

      // Build chart data for the last 12 months (excluding current month for accuracy)
      const data: MonthlyData[] = [];
      
      for (let i = 12; i >= 1; i--) {
        const monthDate = subMonths(now, i);
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMMM", { locale: ptBR });
        const shortLabel = format(monthDate, "MMM", { locale: ptBR }).replace(".", "");
        const revenue = monthlyRevenue[monthKey] || 0;
        
        data.push({
          month: monthKey,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          shortLabel: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
          revenue,
        });
      }
      
      setChartData(data);
      
      // Calculate KPIs based on correct definitions:
      // QTR (Curto prazo): SOMA dos últimos 3 meses passados
      // YTD (Médio prazo): SOMA de janeiro até o mês anterior do ano corrente
      // MAT (Longo prazo): SOMA dos últimos 12 meses
      
      // Current month revenue
      const currentMonthKey = format(now, "yyyy-MM");
      const currentMonthRevenue = monthlyRevenue[currentMonthKey] || 0;
      
      // QTR: Soma dos últimos 3 meses passados (não inclui mês atual)
      let qtrSum = 0;
      for (let i = 1; i <= 3; i++) {
        const monthKey = format(subMonths(now, i), "yyyy-MM");
        qtrSum += monthlyRevenue[monthKey] || 0;
      }
      
      // YTD: Soma de janeiro até o mês anterior (do ano corrente)
      let ytdSum = 0;
      for (let m = 0; m < currentMonth; m++) { // currentMonth é 0-indexed, então < exclui o mês atual
        const ytdMonthKey = format(new Date(currentYear, m, 1), "yyyy-MM");
        ytdSum += monthlyRevenue[ytdMonthKey] || 0;
      }
      
      // MAT: Soma dos últimos 12 meses (não inclui mês atual)
      let matSum = 0;
      for (let i = 1; i <= 12; i++) {
        const monthKey = format(subMonths(now, i), "yyyy-MM");
        matSum += monthlyRevenue[monthKey] || 0;
      }
      
      setKpis({
        qtr: qtrSum,
        ytd: ytdSum,
        mat: matSum,
        currentMonth: currentMonthRevenue,
      });
      
    } catch (error) {
      console.error("Error loading term vision data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)} mi`;
    }
    if (value >= 1000) {
      return `R$ ${Math.round(value / 1000)} mil`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatAxisValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)}mi`;
    }
    if (value >= 1000) {
      return `${Math.round(value / 1000)}k`;
    }
    return value.toString();
  };

  const calculateVariation = (current: number, reference: number) => {
    if (reference === 0) return { value: 0, type: "neutral" as const };
    const variation = ((current - reference) / reference) * 100;
    return {
      value: Math.abs(variation),
      type: variation > 0 ? "positive" as const : variation < 0 ? "negative" as const : "neutral" as const,
    };
  };

  const VariationBadge = ({ 
    value, 
    type, 
    label 
  }: { 
    value: number; 
    type: "positive" | "negative" | "neutral"; 
    label: string;
  }) => {
    const Icon = type === "positive" ? TrendingUp : type === "negative" ? TrendingDown : Minus;
    const colorClass = type === "positive" 
      ? "text-green-600" 
      : type === "negative" 
        ? "text-red-500" 
        : "text-muted-foreground";
    
    return (
      <span className={`text-xs flex items-center gap-0.5 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        {value.toFixed(1)}% {label}
      </span>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  // Variations
  const qtrVsYtd = calculateVariation(kpis.qtr, kpis.ytd);
  const ytdVsMat = calculateVariation(kpis.ytd, kpis.mat);

  // Colors for bars based on performance
  const getBarColor = (revenue: number, index: number) => {
    // Last 3 months (QTR) get purple color
    if (index >= chartData.length - 3) {
      return "#8B5CF6"; // Purple for QTR
    }
    return "#94A3B8"; // Slate for older months
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <CardTitle className="text-base sm:text-lg">Visão de Curto, Médio e Longo Prazo</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {/* QTR */}
          <div className="border rounded-lg p-3 bg-purple-500/5 border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-purple-500" />
              <p className="text-xs font-medium text-purple-600">QTR</p>
            </div>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.qtr)}</p>
            <p className="text-[10px] text-muted-foreground">Últimos 3 meses</p>
          </div>
          
          {/* YTD */}
          <div className="border rounded-lg p-3 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs font-medium text-blue-600">YTD</p>
            </div>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.ytd)}</p>
            <p className="text-[10px] text-muted-foreground">Jan até mês anterior</p>
          </div>
          
          {/* MAT */}
          <div className="border rounded-lg p-3 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
              <p className="text-xs font-medium text-orange-600">MAT</p>
            </div>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.mat)}</p>
            <p className="text-[10px] text-muted-foreground">Últimos 12 meses</p>
          </div>
          
          {/* Current Month */}
          <div className="border rounded-lg p-3 bg-green-500/5 border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <p className="text-xs font-medium text-green-600">Mês Atual</p>
            </div>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.currentMonth)}</p>
            <p className="text-[10px] text-muted-foreground">{format(new Date(), "MMMM", { locale: ptBR })}</p>
          </div>
        </div>

        {/* Bar Chart - Monthly Revenue */}
        <div className="h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis 
                dataKey="shortLabel" 
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tickFormatter={formatAxisValue}
                tick={{ fontSize: 10 }}
                width={45}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), "Receita"]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.monthLabel;
                  }
                  return label;
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
                payload={[
                  { value: 'Receita Mensal', type: 'square', color: '#8B5CF6' },
                ]}
              />
              
              <Bar 
                dataKey="revenue" 
                name="Receita"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.revenue, index)}
                    fillOpacity={index >= chartData.length - 3 ? 1 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500" />
            <span><strong>QTR:</strong> Curto prazo (últimos 3 meses)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span><strong>YTD:</strong> Médio prazo (Jan - mês anterior)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500" />
            <span><strong>MAT:</strong> Longo prazo (últimos 12 meses)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
