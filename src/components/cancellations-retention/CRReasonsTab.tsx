import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projects: any[];
  companies: any[];
}

const REASON_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  falta_resultado: "Falta de resultado",
  mudanca_estrategia: "Mudança de estratégia",
  encerramento_empresa: "Encerramento",
  insatisfacao_servico: "Insatisfação",
  outro: "Outro",
};

const VIBRANT_COLORS = [
  "#f43f5e", "#f97316", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899",
  "#eab308", "#6366f1", "#14b8a6", "#e11d48",
];

const percentTooltipFormatter = (value: number) => `${value.toFixed(1)}%`;

const GradientDefs = () => (
  <defs>
    {VIBRANT_COLORS.map((color, i) => (
      <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={color} stopOpacity={0.85} />
        <stop offset="100%" stopColor={color} stopOpacity={1} />
      </linearGradient>
    ))}
    {VIBRANT_COLORS.map((color, i) => (
      <linearGradient key={`v${i}`} id={`barGradV${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
        <stop offset="100%" stopColor={color} stopOpacity={0.65} />
      </linearGradient>
    ))}
  </defs>
);

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, reason }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.04) return null;
  return (
    <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11} fontWeight={600}>
      {reason}: {(percent * 100).toFixed(1)}%
    </text>
  );
};

export function CRReasonsTab({ projects, companies }: Props) {
  const cancelled = projects.filter(p => p.status === "closed" && p.churn_reason);
  const totalCancelled = cancelled.length;

  const reasonFrequency = useMemo(() => {
    const map: Record<string, number> = {};
    cancelled.forEach(p => {
      const r = p.churn_reason || "outro";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map)
      .map(([reason, count]) => ({
        reason: REASON_LABELS[reason] || reason,
        count,
        percent: totalCancelled > 0 ? (count / totalCancelled) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cancelled, totalCancelled]);

  const reasonByConsultant = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    cancelled.forEach(p => {
      const name = p.consultant_name || p.cs_name || "Sem consultor";
      const reason = REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro";
      if (!map[name]) map[name] = {};
      map[name][reason] = (map[name][reason] || 0) + 1;
    });
    return Object.entries(map).map(([name, reasons]) => {
      const total = Object.values(reasons).reduce((s, v) => s + v, 0);
      const entry: any = { name: name.length > 15 ? name.substring(0, 15) + "..." : name, total };
      Object.entries(reasons).forEach(([r, count]) => {
        entry[r] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      });
      return entry;
    }).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [cancelled]);

  const reasonBySegment = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    cancelled.forEach(p => {
      const company = companies.find(c => c.id === p.onboarding_company_id);
      const segment = company?.segment || "Sem segmento";
      const reason = REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro";
      if (!map[segment]) map[segment] = {};
      map[segment][reason] = (map[segment][reason] || 0) + 1;
    });
    return Object.entries(map).map(([segment, reasons]) => {
      const total = Object.values(reasons).reduce((s, v) => s + v, 0);
      const entry: any = { segment: segment.length > 20 ? segment.substring(0, 20) + "..." : segment, total };
      Object.entries(reasons).forEach(([r, count]) => {
        entry[r] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      });
      return entry;
    }).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [cancelled, companies]);

  const reasonByMonth = useMemo(() => {
    const months: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM/yy", { locale: ptBR });
      const monthCancelled = cancelled.filter(p => p.churn_date?.startsWith(key));
      const total = monthCancelled.length;
      const entry: any = { label };
      const countMap: Record<string, number> = {};
      monthCancelled.forEach(p => {
        const r = REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro";
        countMap[r] = (countMap[r] || 0) + 1;
      });
      Object.entries(countMap).forEach(([r, count]) => {
        entry[r] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      });
      months.push(entry);
    }
    return months;
  }, [cancelled]);

  const allReasons = [...new Set(cancelled.map(p => REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro"))];

  const tooltipStyle = { borderRadius: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: 13 };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* 3D-style Donut Chart */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-400" />
              Motivos Mais Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reasonFrequency.length > 0 ? (
              <div style={{ perspective: "800px" }}>
                <div style={{ transform: "rotateX(8deg)", transformOrigin: "center center" }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={reasonFrequency}
                        dataKey="percent"
                        nameKey="reason"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={105}
                        paddingAngle={3}
                        cornerRadius={6}
                        label={renderCustomLabel}
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {reasonFrequency.map((_, i) => (
                          <Cell key={i} fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" }} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Motivos por Consultor */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
              Motivos por Consultor (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reasonByConsultant.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={reasonByConsultant} layout="vertical" barGap={2}>
                  <GradientDefs />
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={percentTooltipFormatter} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  {allReasons.map((r, i) => (
                    <Bar key={r} dataKey={r} stackId="a" fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} radius={i === allReasons.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Motivos por Segmento */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
              Motivos por Segmento (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reasonBySegment.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={reasonBySegment} layout="vertical" barGap={2}>
                  <GradientDefs />
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="segment" type="category" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={percentTooltipFormatter} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  {allReasons.map((r, i) => (
                    <Bar key={r} dataKey={r} stackId="a" fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} radius={i === allReasons.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Evolução dos Motivos */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-amber-500 to-pink-500" />
              Evolução dos Motivos (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reasonByMonth.length > 0 ? (
              <div style={{ perspective: "900px" }}>
                <div style={{ transform: "rotateX(5deg) rotateY(-2deg)", transformOrigin: "center bottom" }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={reasonByMonth} barGap={1}>
                      <GradientDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={percentTooltipFormatter} contentStyle={tooltipStyle} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      {allReasons.map((r, i) => (
                        <Bar key={r} dataKey={r} stackId="a" fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} radius={i === allReasons.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
