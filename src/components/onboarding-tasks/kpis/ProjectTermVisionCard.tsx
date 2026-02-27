import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

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
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}mi`;
    if (value >= 1000) return `R$ ${Math.round(value / 1000)}mil`;
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
    const bgClass = isNeutral
      ? "bg-muted/50"
      : isPositive ? "bg-emerald-500/10" : "bg-rose-500/10";
    const textClass = isNeutral
      ? "text-muted-foreground"
      : isPositive ? "text-emerald-600" : "text-rose-500";

    return (
      <span className={`text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${bgClass} ${textClass}`}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}% {label}
      </span>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 min-w-[160px]">
          <p className="text-xs font-medium text-muted-foreground mb-2 border-b border-border/30 pb-1.5">
            {payload[0]?.payload?.monthLabel}
          </p>
          {payload.map((entry: any, index: number) => {
            const labels: Record<string, string> = {
              revenue: "Vendas", qtr: "QTR", ytd: "YTD", mat: "MAT",
            };
            return (
              <div key={index} className="flex items-center justify-between gap-3 py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-muted-foreground">{labels[entry.dataKey] || entry.name}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: entry.color }}>
                  {formatCurrency(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
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

  const lineConfig = [
    { key: "revenue", label: "VENDAS", color: "#10b981", colorEnd: "#34d399", width: 3, dash: "6 3", dot: 5, glow: true },
    { key: "qtr", label: "QTR", color: "#a78bfa", colorEnd: "#c4b5fd", width: 2.5, dash: undefined, dot: 3, glow: false },
    { key: "ytd", label: "YTD", color: "#60a5fa", colorEnd: "#93c5fd", width: 2.5, dash: undefined, dot: 3, glow: false },
    { key: "mat", label: "MAT", color: "#fbbf24", colorEnd: "#fcd34d", width: 2.5, dash: undefined, dot: 3, glow: false },
  ];

  const kpiCards = [
    { label: "Mês Atual", value: kpis.currentMonth, variation: kpis.currentVsQtr, varLabel: "vs QTR", color: "#10b981", colorEnd: "#34d399", icon: "💰" },
    { label: "QTR", value: kpis.qtr, variation: kpis.qtrVsYtd, varLabel: "vs YTD", color: "#a78bfa", colorEnd: "#c4b5fd", icon: "📊" },
    { label: "YTD", value: kpis.ytd, variation: kpis.ytdVsMat, varLabel: "vs MAT", color: "#60a5fa", colorEnd: "#93c5fd", icon: "📈" },
    { label: "MAT", value: kpis.mat, variation: null, varLabel: "12 meses", color: "#fbbf24", colorEnd: "#fcd34d", icon: "🎯" },
  ];

  return (
    <Card className={`relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/20 ${className || ""}`}>
      {/* Decorative blurs */}
      <div className="absolute -top-24 -right-24 w-56 h-56 bg-gradient-to-br from-violet-500/8 via-fuchsia-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-br from-emerald-500/6 via-cyan-500/4 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-gradient-to-br from-amber-500/4 to-transparent rounded-full blur-2xl pointer-events-none" />

      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/10">
            <BarChart3 className="h-4 w-4 text-violet-500" />
          </div>
          <CardTitle className="text-base sm:text-lg font-bold">
            Visão de Curto, Médio e Longo Prazo
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 relative z-10">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {kpiCards.map((card, idx) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.08 }}
              className="relative overflow-hidden rounded-xl border border-border/50 p-3 bg-gradient-to-br from-background to-muted/30"
            >
              <div
                className="absolute top-0 left-0 w-full h-1 rounded-t-xl"
                style={{ background: `linear-gradient(90deg, ${card.color}, ${card.colorEnd})` }}
              />
              <div
                className="absolute top-0 left-0 w-full h-12 rounded-t-xl opacity-[0.04]"
                style={{ background: `linear-gradient(180deg, ${card.color}, transparent)` }}
              />
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {card.label}
                </span>
                <span className="text-sm">{card.icon}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: card.color }}>
                {formatCurrency(card.value)}
              </p>
              <div className="mt-1.5">
                {card.variation !== null ? (
                  <VariationBadge value={card.variation} label={card.varLabel} />
                ) : (
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/50">
                    Média 12 meses
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="h-[300px] sm:h-[360px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 10, left: -5, bottom: 10 }}>
              <defs>
                {lineConfig.map(l => (
                  <linearGradient key={`stroke-${l.key}`} id={`stroke-${l.key}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={l.color} />
                    <stop offset="100%" stopColor={l.colorEnd} />
                  </linearGradient>
                ))}
                {lineConfig.filter(l => l.glow).map(l => (
                  <filter key={`glow-${l.key}`} id={`glow-${l.key}`}>
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={48}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {lineConfig.map(l => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.label}
                  stroke={`url(#stroke-${l.key})`}
                  strokeWidth={l.width}
                  strokeDasharray={l.dash}
                  dot={{ fill: l.color, strokeWidth: 2, stroke: l.colorEnd, r: l.dot }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))", fill: l.color }}
                  filter={l.glow ? `url(#glow-${l.key})` : undefined}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {lineConfig.map(l => (
            <div key={l.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-muted/30 backdrop-blur-sm">
              <div
                className="w-4 h-1 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${l.color}, ${l.colorEnd})`,
                  ...(l.dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${l.color} 0, ${l.colorEnd} 4px, transparent 4px, transparent 6px)` } : {}),
                }}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
