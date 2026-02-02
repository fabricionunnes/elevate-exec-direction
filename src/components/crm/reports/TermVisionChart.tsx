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
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { TrendingUp, TrendingDown, Minus, Eye } from "lucide-react";

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  shortLabel: string;
  revenue: number;
  qtr: number;
  ytd: number;
  mat: number;
}

interface TermVisionChartProps {
  className?: string;
}

export const TermVisionChart = ({ className }: TermVisionChartProps) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [kpis, setKpis] = useState({
    qtr: 0,
    ytd: 0,
    mat: 0,
    currentMonth: 0,
    qtrVsYtd: 0,
    ytdVsMat: 0,
    currentVsQtr: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Get data for the last 24 months to calculate MAT properly
      const startDate = subMonths(startOfMonth(now), 24);
      const endDate = endOfMonth(now);
      
      // Fetch all sales data - use pagination to get all records
      let allSalesData: Array<{ sale_date: string; revenue_value: number | null; billing_value: number | null }> = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: salesData, error } = await supabase
          .from("crm_sales")
          .select("sale_date, revenue_value, billing_value")
          .gte("sale_date", format(startDate, "yyyy-MM-dd"))
          .lte("sale_date", format(endDate, "yyyy-MM-dd"))
          .range(from, from + pageSize - 1);
        
        if (error) {
          console.error("Error fetching sales data:", error);
          break;
        }
        
        if (salesData && salesData.length > 0) {
          allSalesData = [...allSalesData, ...salesData];
          from += pageSize;
          hasMore = salesData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log("Total sales records fetched:", allSalesData.length);
      
      // Group by month
      const monthlyRevenue: Record<string, number> = {};
      
      allSalesData.forEach(sale => {
        const saleDate = parseDateLocal(sale.sale_date);
        const monthKey = format(saleDate, "yyyy-MM");
        const value = Number(sale.revenue_value) || Number(sale.billing_value) || 0;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + value;
      });
      
      console.log("Monthly revenue aggregated:", monthlyRevenue);

      // Build chart data for the last 12 months
      const data: ChartDataPoint[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMMM", { locale: ptBR });
        const shortLabel = format(monthDate, "MMM", { locale: ptBR }).replace(".", "");
        const revenue = monthlyRevenue[monthKey] || 0;
        
        // Calculate rolling QTR AVERAGE (last 3 months EXCLUDING current)
        // Ex: if current is Feb 2026, QTR = average of Nov 2025, Dec 2025, Jan 2026
        let qtrSum = 0;
        let qtrCount = 0;
        for (let j = 1; j <= 3; j++) {
          const qtrMonthKey = format(subMonths(monthDate, j), "yyyy-MM");
          const qtrValue = monthlyRevenue[qtrMonthKey] || 0;
          qtrSum += qtrValue;
          if (qtrValue > 0) qtrCount++;
        }
        const qtrAvg = qtrCount > 0 ? qtrSum / 3 : 0;
        
        // Calculate YTD AVERAGE (from January to previous month of current year)
        // Ex: if current is Feb 2026, YTD = average of Jan 2026
        const yearOfMonth = monthDate.getFullYear();
        const monthOfYear = monthDate.getMonth();
        let ytdSum = 0;
        let ytdMonthsCount = 0;
        for (let m = 0; m < monthOfYear; m++) {
          const ytdMonthKey = format(new Date(yearOfMonth, m, 1), "yyyy-MM");
          ytdSum += monthlyRevenue[ytdMonthKey] || 0;
          ytdMonthsCount++;
        }
        const ytdAvg = ytdMonthsCount > 0 ? ytdSum / ytdMonthsCount : 0;
        
        // Calculate rolling MAT AVERAGE (last 12 months EXCLUDING current)
        // Ex: if current is Feb 2026, MAT = average of Feb 2025 to Jan 2026
        let matSum = 0;
        for (let j = 1; j <= 12; j++) {
          const matMonthKey = format(subMonths(monthDate, j), "yyyy-MM");
          matSum += monthlyRevenue[matMonthKey] || 0;
        }
        const matAvg = matSum / 12;
        
        data.push({
          month: monthKey,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          shortLabel: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
          revenue,
          qtr: qtrAvg,
          ytd: ytdAvg,
          mat: matAvg,
        });
      }
      
      setChartData(data);
      
      // Get current KPI values (from the last data point)
      const lastDataPoint = data[data.length - 1];
      const currentQtr = lastDataPoint?.qtr || 0;
      const currentYtd = lastDataPoint?.ytd || 0;
      const currentMat = lastDataPoint?.mat || 0;
      const currentMonthRevenue = lastDataPoint?.revenue || 0;
      
      // Calculate variations
      const qtrVsYtd = currentYtd > 0 ? ((currentQtr - currentYtd) / currentYtd) * 100 : 0;
      const ytdVsMat = currentMat > 0 ? ((currentYtd - currentMat) / currentMat) * 100 : 0;
      const currentVsQtr = currentQtr > 0 ? ((currentMonthRevenue - currentQtr) / currentQtr) * 100 : 0;
      
      setKpis({
        qtr: currentQtr,
        ytd: currentYtd,
        mat: currentMat,
        currentMonth: currentMonthRevenue,
        qtrVsYtd,
        ytdVsMat,
        currentVsQtr,
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

  const VariationBadge = ({ 
    value, 
    label 
  }: { 
    value: number; 
    label: string;
  }) => {
    const isPositive = value > 0;
    const isNeutral = Math.abs(value) < 0.1;
    const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
    const colorClass = isNeutral 
      ? "text-muted-foreground" 
      : isPositive 
        ? "text-green-600" 
        : "text-red-500";
    
    return (
      <span className={`text-xs flex items-center gap-0.5 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}% {label}
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

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-center">
          <CardTitle className="text-base sm:text-lg font-bold">VISÃO DE CURTO, MÉDIO E LONGO PRAZO</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {/* QTR */}
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">QTR</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.qtr)}</p>
            <div className="flex justify-center">
              <VariationBadge value={kpis.qtrVsYtd} label="from YTD" />
            </div>
          </div>
          
          {/* YTD */}
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">YTD</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.ytd)}</p>
            <div className="flex justify-center">
              <VariationBadge value={kpis.ytdVsMat} label="from MAT" />
            </div>
          </div>
          
          {/* MAT */}
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">MAT</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.mat)}</p>
            <div className="flex justify-center">
              <span className="text-xs text-muted-foreground">0.0% from MAT</span>
            </div>
          </div>
          
          {/* Current Month */}
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">RECEITA</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.currentMonth)}</p>
            <div className="flex justify-center">
              <VariationBadge value={kpis.currentVsQtr} label="from QTR" />
            </div>
          </div>
        </div>

        {/* Chart Title */}
        <div className="text-center">
          <h3 className="font-semibold text-base">RECEITA</h3>
        </div>

        {/* Line Chart */}
        <div className="h-[320px] sm:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
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
                width={50}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    revenue: "Receita",
                    qtr: "QTR",
                    ytd: "YTD",
                    mat: "MAT"
                  };
                  return [formatCurrency(value), labels[name] || name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.monthLabel;
                  }
                  return label;
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                payload={[
                  { value: 'RECEITA', type: 'line', color: '#22C55E' },
                  { value: 'QTR', type: 'line', color: '#8B5CF6' },
                  { value: 'YTD', type: 'line', color: '#3B82F6' },
                  { value: 'MAT', type: 'line', color: '#F59E0B' },
                ]}
              />
              
              {/* Revenue - dotted green line */}
              <Line 
                type="monotone"
                dataKey="revenue" 
                name="revenue"
                stroke="#22C55E"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#22C55E", strokeWidth: 0, r: 3 }}
                label={({ x, y, value }) => (
                  <text x={x} y={y - 10} fill="#22C55E" fontSize={9} textAnchor="middle">
                    {formatCurrency(value)}
                  </text>
                )}
              />
              
              {/* QTR - solid purple line */}
              <Line 
                type="monotone"
                dataKey="qtr" 
                name="qtr"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ fill: "#8B5CF6", strokeWidth: 0, r: 2 }}
              />
              
              {/* YTD - solid blue line */}
              <Line 
                type="monotone"
                dataKey="ytd" 
                name="ytd"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: "#3B82F6", strokeWidth: 0, r: 2 }}
              />
              
              {/* MAT - solid orange line */}
              <Line 
                type="monotone"
                dataKey="mat" 
                name="mat"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: "#F59E0B", strokeWidth: 0, r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};