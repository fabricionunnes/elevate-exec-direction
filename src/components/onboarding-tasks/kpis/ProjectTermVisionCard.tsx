import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
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

      let kpiQuery = supabase
        .from("company_kpis")
        .select("id, name, kpi_type, is_main_goal")
        .eq("company_id", companyId)
        .eq("is_active", true);

      const { data: allKpis } = await kpiQuery;
      if (!allKpis || allKpis.length === 0) { setLoading(false); return; }

      let targetKpis = allKpis.filter(k => k.is_main_goal && k.kpi_type === "monetary");
      if (targetKpis.length === 0) targetKpis = allKpis.filter(k => k.kpi_type === "monetary");
      if (targetKpis.length === 0) targetKpis = allKpis.filter(k => k.is_main_goal);
      if (targetKpis.length === 0) { setLoading(false); return; }

      const kpiIds = targetKpis.map(k => k.id);
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

      let allEntries: Array<{ entry_date: string; value: number; salesperson_id: string | null; kpi_id: string }> = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await entryQuery.range(from, from + pageSize - 1);
        if (error) { console.error("Error fetching entries:", error); break; }
        if (data && data.length > 0) { allEntries = [...allEntries, ...data]; from += pageSize; hasMore = data.length === pageSize; }
        else { hasMore = false; }
      }

      if (selectedUnit !== "all" || selectedTeam !== "all" || selectedSector !== "all") {
        const { data: spData } = await supabase.from("company_salespeople").select("id, unit_id, team_id, sector_id").eq("company_id", companyId);
        if (spData) {
          const validSpIds = new Set(spData.filter(sp => {
            if (selectedSalesperson !== "all") return sp.id === selectedSalesperson;
            if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
            if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
            if (selectedSector !== "all" && sp.sector_id !== selectedSector) return false;
            return true;
          }).map(sp => sp.id));
          allEntries = allEntries.filter(e => e.salesperson_id && validSpIds.has(e.salesperson_id));
        }
      }

      const { data: salesHistory } = await supabase.from("company_sales_history").select("month_year, revenue").eq("company_id", companyId);
      const monthlyRevenue: Record<string, number> = {};
      salesHistory?.forEach(sh => { const k = sh.month_year.substring(0, 7); monthlyRevenue[k] = (monthlyRevenue[k] || 0) + (Number(sh.revenue) || 0); });
      const kpiMonthly: Record<string, number> = {};
      allEntries.forEach(e => { const k = format(parseDateLocal(e.entry_date), "yyyy-MM"); kpiMonthly[k] = (kpiMonthly[k] || 0) + (Number(e.value) || 0); });
      Object.keys(kpiMonthly).forEach(k => { if (kpiMonthly[k] > 0) monthlyRevenue[k] = kpiMonthly[k]; });

      const data: ChartDataPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const md = subMonths(now, i);
        const mk = format(md, "yyyy-MM");
        const ml = format(md, "MMMM", { locale: ptBR });
        const sl = format(md, "MMM", { locale: ptBR }).replace(".", "");
        const rev = monthlyRevenue[mk] || 0;
        let qS = 0; for (let j = 1; j <= 3; j++) qS += monthlyRevenue[format(subMonths(md, j), "yyyy-MM")] || 0;
        const yr = md.getFullYear(), mo = md.getMonth();
        let yS = 0, yC = 0; for (let m = 0; m < mo; m++) { yS += monthlyRevenue[format(new Date(yr, m, 1), "yyyy-MM")] || 0; yC++; }
        let mS = 0; for (let j = 1; j <= 12; j++) mS += monthlyRevenue[format(subMonths(md, j), "yyyy-MM")] || 0;
        data.push({ month: mk, monthLabel: ml.charAt(0).toUpperCase() + ml.slice(1), shortLabel: sl.charAt(0).toUpperCase() + sl.slice(1), revenue: rev, qtr: qS / 3, ytd: yC > 0 ? yS / yC : 0, mat: mS / 12 });
      }
      setChartData(data);
      const last = data[data.length - 1];
      const cQ = last?.qtr || 0, cY = last?.ytd || 0, cM = last?.mat || 0, cMo = last?.revenue || 0;
      setKpis({ qtr: cQ, ytd: cY, mat: cM, currentMonth: cMo, qtrVsYtd: cY > 0 ? ((cQ - cY) / cY) * 100 : 0, ytdVsMat: cM > 0 ? ((cY - cM) / cM) * 100 : 0, currentVsQtr: cQ > 0 ? ((cMo - cQ) / cQ) * 100 : 0 });
    } catch (error) { console.error("Error loading term vision data:", error); }
    finally { setLoading(false); }
  };

  const formatCurrency = (v: number) => {
    if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}mi`;
    if (v >= 1000) return `R$ ${Math.round(v / 1000)}mil`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };
  const formatAxis = (v: number) => { if (v >= 1000000) return `${(v / 1000000).toFixed(0)}mi`; if (v >= 1000) return `${Math.round(v / 1000)}k`; return v.toString(); };

  const VarBadge = ({ value, label }: { value: number; label: string }) => {
    const neutral = Math.abs(value) < 0.1;
    const pos = value > 0;
    const Icon = neutral ? Minus : pos ? TrendingUp : TrendingDown;
    const col = neutral ? "rgba(255,255,255,0.3)" : pos ? "#34d399" : "#fb7185";
    return (
      <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: col }}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}% {label}
      </span>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-2xl shadow-2xl p-4 min-w-[180px] border border-white/10" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))", backdropFilter: "blur(16px)" }}>
        <p className="text-[11px] font-bold text-white/50 mb-2.5 tracking-widest uppercase">{payload[0]?.payload?.monthLabel}</p>
        {payload.map((e: any, i: number) => {
          const labels: Record<string, string> = { revenue: "Vendas", qtr: "QTR", ytd: "YTD", mat: "MAT" };
          return (
            <div key={i} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color, boxShadow: `0 0 8px ${e.color}60` }} />
                <span className="text-[11px] text-white/60 font-medium">{labels[e.dataKey] || e.name}</span>
              </div>
              <span className="text-[12px] font-bold text-white">{formatCurrency(e.value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className} style={{ background: "linear-gradient(145deg, #0f172a, #1e293b)" }}>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400 border-t-transparent" />
        </CardContent>
      </Card>
    );
  }
  if (chartData.length === 0) return null;

  const lines = [
    { key: "revenue", label: "VENDAS", color: "#34d399", opacity: 0.25, w: 3, dash: "6 3" },
    { key: "qtr", label: "QTR", color: "#c084fc", opacity: 0.15, w: 2, dash: undefined },
    { key: "ytd", label: "YTD", color: "#60a5fa", opacity: 0.12, w: 2, dash: undefined },
    { key: "mat", label: "MAT", color: "#fbbf24", opacity: 0.10, w: 2, dash: undefined },
  ];

  const cards = [
    { label: "Mês Atual", value: kpis.currentMonth, var: kpis.currentVsQtr, vl: "vs QTR", color: "#34d399" },
    { label: "QTR (3m)", value: kpis.qtr, var: kpis.qtrVsYtd, vl: "vs YTD", color: "#c084fc" },
    { label: "YTD", value: kpis.ytd, var: kpis.ytdVsMat, vl: "vs MAT", color: "#60a5fa" },
    { label: "MAT (12m)", value: kpis.mat, var: null, vl: "", color: "#fbbf24" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={className}>
      <Card className="relative overflow-hidden border-0 shadow-2xl" style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}>
        {/* Ambient glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)" }} />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full blur-[60px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.12), transparent 70%)" }} />
        <div className="absolute top-1/3 left-1/2 w-40 h-40 rounded-full blur-[50px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(96,165,250,0.08), transparent 70%)" }} />

        {/* Header */}
        <div className="relative z-10 px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(96,165,250,0.2))" }}>
            <Activity className="h-5 w-5 text-purple-300" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Visão de Curto, Médio e Longo Prazo</h3>
            <p className="text-[11px] text-white/40 font-medium">Análise de tendência • Últimos 12 meses</p>
          </div>
        </div>

        <CardContent className="space-y-5 relative z-10 pb-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {cards.map((c, idx) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: idx * 0.07 }}
                className="relative overflow-hidden rounded-2xl p-3.5 border border-white/[0.06]"
                style={{ background: `linear-gradient(135deg, ${c.color}15, ${c.color}05)` }}
              >
                <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: `${c.color}99` }}>{c.label}</span>
                <p className="text-xl sm:text-2xl font-extrabold mt-1 tracking-tight text-white">{formatCurrency(c.value)}</p>
                <div className="mt-2">
                  {c.var !== null ? <VarBadge value={c.var} label={c.vl} /> : <span className="text-[10px] text-white/30 font-medium">Média anual</span>}
                </div>
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full opacity-20 blur-md" style={{ backgroundColor: c.color }} />
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl p-3 pt-4 border border-white/[0.06]"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))" }}
          >
            <div className="h-[280px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    {lines.map(l => (
                      <linearGradient key={`a-${l.key}`} id={`a-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={l.color} stopOpacity={l.opacity} />
                        <stop offset="85%" stopColor={l.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                    {lines.map(l => (
                      <filter key={`g-${l.key}`} id={`g-${l.key}`}>
                        <feGaussianBlur stdDeviation="2.5" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)", fontWeight: 600 }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatAxis} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)", fontWeight: 500 }} width={45} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                  {lines.map(l => (
                    <Area
                      key={l.key} type="monotone" dataKey={l.key} name={l.label}
                      stroke={l.color} strokeWidth={l.w} fill={`url(#a-${l.key})`}
                      dot={{ fill: l.color, strokeWidth: 0, r: l.key === "revenue" ? 4 : 2.5 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "#0f172a", fill: l.color }}
                      filter={`url(#g-${l.key})`} strokeDasharray={l.dash}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-2">
            {lines.map(l => (
              <div key={l.key} className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/[0.06]" style={{ background: `linear-gradient(135deg, ${l.color}10, transparent)` }}>
                <div className="relative">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                  <div className="absolute inset-0 w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: l.color, opacity: 0.15, animationDuration: "3s" }} />
                </div>
                <span className="text-[11px] font-bold text-white/60 tracking-wide">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
