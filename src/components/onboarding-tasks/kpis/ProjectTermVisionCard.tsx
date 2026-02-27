import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  shortLabel: string;
  revenue: number;
  qtr: number;
  ytd: number;
  mat: number;
}

interface ProjectTermVisionCardProps {
  companyId: string;
  projectId?: string;
  selectedSalesperson?: string;
  selectedUnit?: string;
  selectedTeam?: string;
  selectedSector?: string;
  className?: string;
}

export const ProjectTermVisionCard = ({
  companyId,
  projectId,
  selectedSalesperson = "all",
  selectedUnit = "all",
  selectedTeam = "all",
  selectedSector = "all",
  className,
}: ProjectTermVisionCardProps) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [kpis, setKpis] = useState({
    qtr: 0, ytd: 0, mat: 0, currentMonth: 0,
    qtrVsYtd: 0, ytdVsMat: 0, currentVsQtr: 0,
  });

  useEffect(() => {
    loadData();
  }, [companyId, selectedSalesperson, selectedUnit, selectedTeam, selectedSector]);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();

      // 1. Get monetary/main KPIs for this company
      let kpiQuery = supabase
        .from("company_kpis")
        .select("id, name, kpi_type, is_main_goal")
        .eq("company_id", companyId)
        .eq("is_active", true);

      const { data: allKpis } = await kpiQuery;
      if (!allKpis || allKpis.length === 0) { setLoading(false); return; }

      // Prefer monetary KPIs marked as main_goal, then all monetary, then main_goal
      let targetKpis = allKpis.filter(k => k.is_main_goal && k.kpi_type === "monetary");
      if (targetKpis.length === 0) targetKpis = allKpis.filter(k => k.kpi_type === "monetary");
      if (targetKpis.length === 0) targetKpis = allKpis.filter(k => k.is_main_goal);
      if (targetKpis.length === 0) { setLoading(false); return; }

      const kpiIds = targetKpis.map(k => k.id);

      // 2. Fetch entries for last 24 months
      const startDate = subMonths(startOfMonth(now), 24);
      const endDate = endOfMonth(now);

      let entryQuery = supabase
        .from("kpi_entries")
        .select("entry_date, value, salesperson_id, kpi_id")
        .in("kpi_id", kpiIds)
        .gte("entry_date", format(startDate, "yyyy-MM-dd"))
        .lte("entry_date", format(endDate, "yyyy-MM-dd"));

      if (selectedSalesperson !== "all") {
        entryQuery = entryQuery.eq("salesperson_id", selectedSalesperson);
      }

      // Paginate
      let allEntries: Array<{ entry_date: string; value: number; salesperson_id: string | null; kpi_id: string }> = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await entryQuery.range(from, from + pageSize - 1);
        if (error) { console.error("Error fetching entries:", error); break; }
        if (data && data.length > 0) {
          allEntries = [...allEntries, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Filter by unit/team/sector if needed (need salespeople mapping)
      if (selectedUnit !== "all" || selectedTeam !== "all" || selectedSector !== "all") {
        const { data: spData } = await supabase
          .from("company_salespeople")
          .select("id, unit_id, team_id, sector_id")
          .eq("company_id", companyId);

        if (spData) {
          const validSpIds = new Set(
            spData
              .filter(sp => {
                if (selectedSalesperson !== "all") return sp.id === selectedSalesperson;
                if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
                if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
                if (selectedSector !== "all" && sp.sector_id !== selectedSector) return false;
                return true;
              })
              .map(sp => sp.id)
          );
          allEntries = allEntries.filter(e => e.salesperson_id && validSpIds.has(e.salesperson_id));
        }
      }

      // 3. Fetch sales history (company_sales_history) for historical data
      const { data: salesHistory } = await supabase
        .from("company_sales_history")
        .select("month_year, revenue")
        .eq("company_id", companyId);

      // 4. Group kpi_entries by month
      const monthlyRevenue: Record<string, number> = {};

      // First, seed with sales history (lower priority)
      salesHistory?.forEach(sh => {
        // month_year can be "YYYY-MM-01" or "YYYY-MM" format
        const monthKey = sh.month_year.substring(0, 7); // Extract "YYYY-MM"
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (Number(sh.revenue) || 0);
      });

      // Then overlay with kpi_entries (higher priority - replaces history for same month)
      const kpiMonthlyRevenue: Record<string, number> = {};
      allEntries.forEach(entry => {
        const d = parseDateLocal(entry.entry_date);
        const monthKey = format(d, "yyyy-MM");
        kpiMonthlyRevenue[monthKey] = (kpiMonthlyRevenue[monthKey] || 0) + (Number(entry.value) || 0);
      });

      // Merge: use kpi_entries when available, otherwise keep sales history
      Object.keys(kpiMonthlyRevenue).forEach(monthKey => {
        if (kpiMonthlyRevenue[monthKey] > 0) {
          monthlyRevenue[monthKey] = kpiMonthlyRevenue[monthKey];
        }
      });

      // 4. Build chart data for last 12 months
      const data: ChartDataPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMMM", { locale: ptBR });
        const shortLabel = format(monthDate, "MMM", { locale: ptBR }).replace(".", "");
        const revenue = monthlyRevenue[monthKey] || 0;

        // QTR: average of last 3 months (excluding current)
        let qtrSum = 0;
        for (let j = 1; j <= 3; j++) {
          qtrSum += monthlyRevenue[format(subMonths(monthDate, j), "yyyy-MM")] || 0;
        }
        const qtrAvg = qtrSum / 3;

        // YTD: average from Jan to previous month of same year
        const yearOfMonth = monthDate.getFullYear();
        const monthOfYear = monthDate.getMonth();
        let ytdSum = 0;
        let ytdCount = 0;
        for (let m = 0; m < monthOfYear; m++) {
          ytdSum += monthlyRevenue[format(new Date(yearOfMonth, m, 1), "yyyy-MM")] || 0;
          ytdCount++;
        }
        const ytdAvg = ytdCount > 0 ? ytdSum / ytdCount : 0;

        // MAT: average of last 12 months (excluding current)
        let matSum = 0;
        for (let j = 1; j <= 12; j++) {
          matSum += monthlyRevenue[format(subMonths(monthDate, j), "yyyy-MM")] || 0;
        }
        const matAvg = matSum / 12;

        data.push({
          month: monthKey,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          shortLabel: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
          revenue, qtr: qtrAvg, ytd: ytdAvg, mat: matAvg,
        });
      }

      setChartData(data);

      // KPI values from last data point
      const last = data[data.length - 1];
      const cQtr = last?.qtr || 0;
      const cYtd = last?.ytd || 0;
      const cMat = last?.mat || 0;
      const cMonth = last?.revenue || 0;

      setKpis({
        qtr: cQtr, ytd: cYtd, mat: cMat, currentMonth: cMonth,
        qtrVsYtd: cYtd > 0 ? ((cQtr - cYtd) / cYtd) * 100 : 0,
        ytdVsMat: cMat > 0 ? ((cYtd - cMat) / cMat) * 100 : 0,
        currentVsQtr: cQtr > 0 ? ((cMonth - cQtr) / cQtr) * 100 : 0,
      });
    } catch (error) {
      console.error("Error loading term vision data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`;
    if (value >= 1000) return `R$ ${Math.round(value / 1000)} mil`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
  };

  const formatAxisValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}mi`;
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return value.toString();
  };

  const VariationBadge = ({ value, label }: { value: number; label: string }) => {
    const isNeutral = Math.abs(value) < 0.1;
    const isPositive = value > 0;
    const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
    const colorClass = isNeutral
      ? "text-muted-foreground"
      : isPositive ? "text-green-600" : "text-red-500";

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

  if (chartData.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg font-bold text-center">
          VISÃO DE CURTO, MÉDIO E LONGO PRAZO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">QTR</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.qtr)}</p>
            <div className="flex justify-center">
              <VariationBadge value={kpis.qtrVsYtd} label="from YTD" />
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">YTD</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.ytd)}</p>
            <div className="flex justify-center">
              <VariationBadge value={kpis.ytdVsMat} label="from MAT" />
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">MAT</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.mat)}</p>
            <div className="flex justify-center">
              <span className="text-xs text-muted-foreground">Média 12 meses</span>
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs font-medium text-muted-foreground text-center mb-1">VENDAS</p>
            <p className="text-lg sm:text-xl font-bold text-center">{formatCurrency(kpis.currentMonth)}</p>
            <div className="flex justify-center">
              <VariationBadge value={kpis.currentVsQtr} label="from QTR" />
            </div>
          </div>
        </div>

        {/* Chart Title */}
        <div className="text-center">
          <h3 className="font-semibold text-base">VENDAS</h3>
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
              <YAxis tickFormatter={formatAxisValue} tick={{ fontSize: 10 }} width={50} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    revenue: "Vendas", qtr: "QTR", ytd: "YTD", mat: "MAT",
                  };
                  return [formatCurrency(value), labels[name] || name];
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.monthLabel || ""
                }
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                payload={[
                  { value: "VENDAS", type: "line", color: "#22C55E" },
                  { value: "QTR", type: "line", color: "#8B5CF6" },
                  { value: "YTD", type: "line", color: "#3B82F6" },
                  { value: "MAT", type: "line", color: "#F59E0B" },
                ]}
              />
              <Line
                type="monotone" dataKey="revenue" name="revenue"
                stroke="#22C55E" strokeWidth={2} strokeDasharray="5 5"
                dot={{ fill: "#22C55E", strokeWidth: 0, r: 3 }}
                label={({ x, y, value }) => (
                  <text x={x} y={y - 10} fill="#22C55E" fontSize={9} textAnchor="middle">
                    {formatCurrency(value as number)}
                  </text>
                )}
              />
              <Line type="monotone" dataKey="qtr" name="qtr" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: "#8B5CF6", strokeWidth: 0, r: 2 }} />
              <Line type="monotone" dataKey="ytd" name="ytd" stroke="#3B82F6" strokeWidth={2} dot={{ fill: "#3B82F6", strokeWidth: 0, r: 2 }} />
              <Line type="monotone" dataKey="mat" name="mat" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", strokeWidth: 0, r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
