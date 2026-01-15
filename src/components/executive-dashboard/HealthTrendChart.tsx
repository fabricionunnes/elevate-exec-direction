import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";

interface TrendDataPoint {
  date: string;
  score: number;
}

interface HealthTrendChartProps {
  data: TrendDataPoint[];
  currentAvg: number;
}

export function HealthTrendChart({ data, currentAvg }: HealthTrendChartProps) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return { main: "#22c55e", light: "#86efac" };
    if (value >= 60) return { main: "#eab308", light: "#fde047" };
    if (value >= 40) return { main: "#f97316", light: "#fdba74" };
    return { main: "#ef4444", light: "#fca5a5" };
  };

  const colors = getScoreColor(currentAvg);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const tooltipColors = getScoreColor(value);
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-lg font-bold" style={{ color: tooltipColors.main }}>
            Score: {value.toFixed(1)}
          </p>
        </div>
      );
    }
    return null;
  };

  const chartData = data.length > 0 ? data : Array.from({ length: 10 }, (_, i) => ({
    date: format(subDays(new Date(), 9 - i), "dd/MM"),
    score: 50 + Math.random() * 30,
  }));

  const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
  const secondHalf = chartData.slice(Math.floor(chartData.length / 2));
  const firstAvg = firstHalf.reduce((sum, d) => sum + d.score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.score, 0) / secondHalf.length;
  const trend = secondAvg - firstAvg;
  const trendIsPositive = trend >= 0;

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl" />
      
      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            Tendência de Saúde (30 dias)
          </CardTitle>
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${
            trendIsPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
          }`}>
            {trendIsPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)} pts
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <motion.div className="h-[180px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.main} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={colors.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1.5} opacity={0.5} />
              <ReferenceLine y={60} stroke="#eab308" strokeDasharray="3 3" strokeWidth={1.5} opacity={0.5} />
              <Area type="monotone" dataKey="score" stroke={colors.main} strokeWidth={3} fill="url(#trendGradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="flex justify-center gap-4 mt-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10">
            <div className="w-4 h-0.5 bg-emerald-500 rounded" />
            <span className="text-xs text-emerald-600 font-medium">Meta (80)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
            <div className="w-4 h-0.5 bg-amber-500 rounded" />
            <span className="text-xs text-amber-600 font-medium">Atenção (60)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
