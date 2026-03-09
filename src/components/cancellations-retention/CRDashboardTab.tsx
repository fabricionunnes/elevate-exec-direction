import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, AlertTriangle, ShieldAlert, ShieldCheck, XCircle, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { format, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projects: any[];
  companies: any[];
  retentionAttempts: any[];
  filters: { period: string; consultant: string; segment: string; reason: string };
}

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
    { label: "Empresas Ativas", value: stats.activeCompanies, icon: Building2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Em Aviso", value: stats.inNotice, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Cancelamentos", value: stats.cancelled, icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Retenções", value: stats.retained, icon: ShieldCheck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Taxa de Retenção", value: `${stats.retentionRate}%`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Taxa de Churn", value: `${stats.churnRate}%`, icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Cancelamentos vs Retenções por Mês</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="cancelamentos" name="Cancelamentos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="retencoes" name="Retenções" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução da Taxa de Churn (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={churnEvolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="taxa" name="Churn %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
