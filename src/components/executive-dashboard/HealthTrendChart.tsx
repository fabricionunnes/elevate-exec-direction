import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TrendDataPoint {
  date: string;
  score: number;
}

interface HealthTrendChartProps {
  data: TrendDataPoint[];
  currentAvg: number;
}

export function HealthTrendChart({ data, currentAvg }: HealthTrendChartProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    if (score >= 40) return "#f97316";
    return "#ef4444";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const score = payload[0].value;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-lg font-bold" style={{ color: getScoreColor(score) }}>
            Score: {score.toFixed(1)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Generate sample data if empty
  const chartData = data.length > 0 ? data : Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), "dd/MM"),
    score: currentAvg + (Math.random() - 0.5) * 10,
  }));

  // Calculate trend
  const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
  const secondHalf = chartData.slice(Math.floor(chartData.length / 2));
  const firstAvg = firstHalf.reduce((sum, d) => sum + d.score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.score, 0) / secondHalf.length;
  const trend = secondAvg - firstAvg;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendência de Saúde (30 dias)
          </CardTitle>
          <div className={`text-sm font-medium ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)} pts
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getScoreColor(currentAvg)} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={getScoreColor(currentAvg)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={60} stroke="#eab308" strokeDasharray="3 3" />
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="score"
                stroke={getScoreColor(currentAvg)}
                strokeWidth={2}
                fill="url(#healthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-green-500" />
            Meta (80)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-yellow-500" />
            Atenção (60)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
