import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, AlertTriangle, ShieldCheck, XCircle, TrendingDown, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Area, AreaChart,
} from "recharts";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projects: any[];
  companies: any[];
  retentionAttempts: any[];
  filters: { period: string; consultant: string; segment: string; reason: string };
}

const GradientDefs = () => (
  <defs>
    <linearGradient id="gradCancel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#fb7185" stopOpacity={0.6} />
    </linearGradient>
    <linearGradient id="gradRetain" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.6} />
    </linearGradient>
    <linearGradient id="gradChurn" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8} />
      <stop offset="100%" stopColor="#e11d48" stopOpacity={1} />
    </linearGradient>
    <linearGradient id="gradChurnArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
    </linearGradient>
  </defs>
);

export function CRDashboardTab({ projects, companies, retentionAttempts, filters }: Props) {
  const stats = useMemo(() => {
    const activeCompanies = companies.filter(c => c.status === "active").length;
    const inNotice = projects.filter(p => p.status === "cancellation_signaled" || p.status === "notice_period").length;
    const cancelled = projects.filter(p => p.status === "closed" && p.churn_date).length;
    const retained = retentionAttempts.filter(r => r.result === "retained").length;
    const totalAttempts = retentionAttempts.length;
    const retentionRate = totalAttempts > 0 ? ((retained / totalAttempts) * 100).toFixed(1) : "0";
    const churnRate = (activeCompanies + cancelled) > 0 ? ((cancelled / (activeCompanies + cancelled)) * 100).toFixed(1) : "0";
    return { activeCompanies, inNotice, cancelled, retained, totalAttempts, retentionRate, churnRate };
  }, [projects, companies, retentionAttempts]);

  const monthlyData = useMemo(() => {
    const months: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM/yy", { locale: ptBR });
      const cancelledInMonth = projects.filter(p => p.churn_date?.startsWith(key)).length;
      const retainedInMonth = retentionAttempts.filter(r => r.attempt_date?.startsWith(key) && r.result === "retained").length;
      months.push({ label, cancelamentos: cancelledInMonth, retencoes: retainedInMonth });
    }
    return months;
  }, [projects, retentionAttempts]);

  const churnEvolution = useMemo(() => {
    const months: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM/yy", { locale: ptBR });
      const activeAtMonth = companies.filter(c => {
        const created = c.created_at?.substring(0, 7);
        return created && created <= key && (c.status === "active" || (c.status_changed_at && c.status_changed_at.substring(0, 7) >= key));
      }).length;
      const cancelledInMonth = projects.filter(p => p.churn_date?.startsWith(key)).length;
      const rate = activeAtMonth > 0 ? ((cancelledInMonth / activeAtMonth) * 100) : 0;
      months.push({ label, taxa: parseFloat(rate.toFixed(1)) });
    }
    return months;
  }, [projects, companies]);

  const cards = [
    { label: "Empresas Ativas", value: stats.activeCompanies, icon: Building2, gradient: "from-emerald-500 to-teal-400", shadow: "shadow-emerald-500/20" },
    { label: "Em Aviso", value: stats.inNotice, icon: AlertTriangle, gradient: "from-amber-500 to-orange-400", shadow: "shadow-amber-500/20" },
    { label: "Cancelamentos", value: stats.cancelled, icon: XCircle, gradient: "from-rose-500 to-pink-400", shadow: "shadow-rose-500/20" },
    { label: "Retenções", value: stats.retained, icon: ShieldCheck, gradient: "from-indigo-500 to-violet-400", shadow: "shadow-indigo-500/20" },
    { label: "Taxa Retenção", value: `${stats.retentionRate}%`, icon: TrendingUp, gradient: "from-cyan-500 to-blue-400", shadow: "shadow-cyan-500/20" },
    { label: "Taxa Churn", value: `${stats.churnRate}%`, icon: TrendingDown, gradient: "from-red-500 to-rose-400", shadow: "shadow-red-500/20" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label} className={`relative overflow-hidden border-0 shadow-lg ${card.shadow} hover:scale-[1.03] transition-transform duration-200`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-[0.08]`} />
            <CardContent className="p-4 relative">
              <div className="flex flex-col gap-2">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} w-fit shadow-md`}>
                  <card.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
                  <p className="text-2xl font-black tracking-tight">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-rose-500 to-indigo-500" />
              Cancelamentos vs Retenções por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData} barGap={4}>
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: 13 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cancelamentos" name="Cancelamentos" fill="url(#gradCancel)" radius={[8, 8, 4, 4]} maxBarSize={35} />
                <Bar dataKey="retencoes" name="Retenções" fill="url(#gradRetain)" radius={[8, 8, 4, 4]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-rose-500 to-red-600" />
              Evolução da Taxa de Churn (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={churnEvolution}>
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: 13 }}
                />
                <Area type="monotone" dataKey="taxa" name="Churn %" stroke="#f43f5e" strokeWidth={3} fill="url(#gradChurnArea)" dot={{ r: 5, fill: "#f43f5e", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, stroke: "#f43f5e", strokeWidth: 2, fill: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
