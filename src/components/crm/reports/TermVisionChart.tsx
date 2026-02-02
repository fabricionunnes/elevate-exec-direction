import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  ReferenceLine 
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MonthlyData {
  month: string;
  monthLabel: string;
  revenue: number;
  qtr: number | null;
  ytd: number | null;
  mat: number | null;
}

interface TermVisionChartProps {
  className?: string;
}

export const TermVisionChart = ({ className }: TermVisionChartProps) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [kpis, setKpis] = useState({
    qtr: 0,
    ytd: 0,
    mat: 0,
    currentMonth: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      
      // Get data for the last 12 months
      const startDate = subMonths(startOfMonth(now), 12);
      const endDate = endOfMonth(subMonths(now, 1)); // Up to last month
      
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

      // Build chart data for the last 12 months
      const data: MonthlyData[] = [];
      let matSum = 0;
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i + 1); // +1 because we exclude current month
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMMM", { locale: ptBR });
        const revenue = monthlyRevenue[monthKey] || 0;
        
        matSum += revenue;
        
        // Calculate QTR (last 3 months average up to this point)
        let qtrValue: number | null = null;
        if (i <= 2) { // Only show QTR for the last 3 months
          let qtrSum = 0;
          for (let j = 0; j < 3; j++) {
            const qtrMonthDate = subMonths(now, i + 1 + j);
            const qtrMonthKey = format(qtrMonthDate, "yyyy-MM");
            qtrSum += monthlyRevenue[qtrMonthKey] || 0;
          }
          qtrValue = qtrSum / 3;
        }
        
        // Calculate YTD (January to this month, if within same year)
        let ytdValue: number | null = null;
        const monthYear = monthDate.getFullYear();
        const monthIndex = monthDate.getMonth();
        
        if (monthYear === currentYear || (monthYear === currentYear - 1 && monthIndex >= currentMonth)) {
          // Calculate YTD up to this month
          let ytdSum = 0;
          let ytdCount = 0;
          for (let m = 0; m <= monthIndex; m++) {
            const ytdMonthDate = new Date(monthYear, m, 1);
            const ytdMonthKey = format(ytdMonthDate, "yyyy-MM");
            if (monthlyRevenue[ytdMonthKey] !== undefined) {
              ytdSum += monthlyRevenue[ytdMonthKey];
              ytdCount++;
            }
          }
          ytdValue = ytdCount > 0 ? ytdSum / ytdCount : null;
        }
        
        // Calculate MAT (rolling 12-month average up to this point)
        let matValue: number | null = null;
        let matSumCalc = 0;
        let matCount = 0;
        for (let m = 0; m < 12; m++) {
          const matMonthDate = subMonths(monthDate, m);
          const matMonthKey = format(matMonthDate, "yyyy-MM");
          if (monthlyRevenue[matMonthKey] !== undefined) {
            matSumCalc += monthlyRevenue[matMonthKey];
            matCount++;
          }
        }
        matValue = matCount > 0 ? matSumCalc / matCount : null;
        
        data.push({
          month: monthKey,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          revenue,
          qtr: qtrValue,
          ytd: ytdValue,
          mat: matValue,
        });
      }
      
      setChartData(data);
      
      // Calculate KPIs
      const lastMonth = subMonths(now, 1);
      const lastMonthKey = format(lastMonth, "yyyy-MM");
      const currentMonthRevenue = monthlyRevenue[lastMonthKey] || 0;
      
      // QTR: Average of last 3 months
      let qtrSum = 0;
      for (let i = 1; i <= 3; i++) {
        const monthKey = format(subMonths(now, i), "yyyy-MM");
        qtrSum += monthlyRevenue[monthKey] || 0;
      }
      const qtrAvg = qtrSum / 3;
      
      // YTD: Average from January to last month of current year
      let ytdSum = 0;
      let ytdCount = 0;
      for (let m = 0; m < currentMonth; m++) {
        const ytdMonthKey = format(new Date(currentYear, m, 1), "yyyy-MM");
        if (monthlyRevenue[ytdMonthKey] !== undefined) {
          ytdSum += monthlyRevenue[ytdMonthKey];
          ytdCount++;
        }
      }
      const ytdAvg = ytdCount > 0 ? ytdSum / ytdCount : 0;
      
      // MAT: Average of last 12 months
      let matSumKpi = 0;
      let matCountKpi = 0;
      for (let i = 1; i <= 12; i++) {
        const monthKey = format(subMonths(now, i), "yyyy-MM");
        if (monthlyRevenue[monthKey] !== undefined) {
          matSumKpi += monthlyRevenue[monthKey];
          matCountKpi++;
        }
      }
      const matAvg = matCountKpi > 0 ? matSumKpi / matCountKpi : 0;
      
      setKpis({
        qtr: qtrAvg,
        ytd: ytdAvg,
        mat: matAvg,
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
      return `${(value / 1000000).toFixed(0)} mi`;
    }
    if (value >= 1000) {
      return `${Math.round(value / 1000)} mil`;
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

  const qtrVsYtd = calculateVariation(kpis.qtr, kpis.ytd);
  const ytdVsMat = calculateVariation(kpis.ytd, kpis.mat);
  const matVsMat = { value: 0, type: "neutral" as const }; // MAT compares to itself
  const currentVsQtr = calculateVariation(kpis.currentMonth, kpis.qtr);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">Visão de Curto, Médio e Longo Prazo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="border rounded-lg p-3 text-center bg-card">
            <p className="text-xs text-muted-foreground mb-1">QTR</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.qtr)}</p>
            <VariationBadge 
              value={qtrVsYtd.value} 
              type={qtrVsYtd.type} 
              label="vs YTD" 
            />
          </div>
          
          <div className="border rounded-lg p-3 text-center bg-card">
            <p className="text-xs text-muted-foreground mb-1">YTD</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.ytd)}</p>
            <VariationBadge 
              value={ytdVsMat.value} 
              type={ytdVsMat.type} 
              label="vs MAT" 
            />
          </div>
          
          <div className="border rounded-lg p-3 text-center bg-card">
            <p className="text-xs text-muted-foreground mb-1">MAT</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.mat)}</p>
            <span className="text-xs text-muted-foreground">Média 12 meses</span>
          </div>
          
          <div className="border rounded-lg p-3 text-center bg-card">
            <p className="text-xs text-muted-foreground mb-1">RECEITA</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(kpis.currentMonth)}</p>
            <VariationBadge 
              value={currentVsQtr.value} 
              type={currentVsQtr.type} 
              label="vs QTR" 
            />
          </div>
        </div>

        {/* Chart */}
        <div className="h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tickFormatter={formatAxisValue}
                tick={{ fontSize: 10 }}
                width={50}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), ""]}
                labelFormatter={(label) => label}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
              />
              
              {/* Revenue line (dashed) */}
              <Line 
                type="monotone" 
                dataKey="revenue" 
                name="RECEITA"
                stroke="#22C55E"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                connectNulls
              />
              
              {/* QTR line */}
              <Line 
                type="monotone" 
                dataKey="qtr" 
                name="QTR"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              
              {/* YTD line */}
              <Line 
                type="monotone" 
                dataKey="ytd" 
                name="YTD"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              
              {/* MAT line */}
              <Line 
                type="monotone" 
                dataKey="mat" 
                name="MAT"
                stroke="#F97316"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>QTR (Curto prazo):</strong> Média dos últimos 3 meses</p>
          <p><strong>YTD (Médio prazo):</strong> Média de janeiro até o mês anterior</p>
          <p><strong>MAT (Longo prazo):</strong> Média dos últimos 12 meses</p>
        </div>
      </CardContent>
    </Card>
  );
};
