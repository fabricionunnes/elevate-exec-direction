import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, DollarSign, TrendingDown, Building2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { differenceInDays } from "date-fns";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  companies: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFODelinquencyTab({ invoices, companies, filters, formatCurrency, formatCurrencyCents }: Props) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const delinquency = useMemo(() => {
    const overdue = invoices.filter(i => i.status === "overdue" || (i.status === "pending" && i.due_date < today));
    const totalOverdue = overdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const totalExpected = invoices.filter(i => i.status !== "cancelled")
      .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const inadimplenciaPercent = totalExpected > 0 ? (totalOverdue / totalExpected) * 100 : 0;
    const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const agingCount = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    overdue.forEach((inv: any) => {
      const days = differenceInDays(now, new Date(inv.due_date));
      const amount = inv.amount_cents || 0;
      if (days <= 30) { aging["0-30"] += amount; agingCount["0-30"]++; }
      else if (days <= 60) { aging["31-60"] += amount; agingCount["31-60"]++; }
      else if (days <= 90) { aging["61-90"] += amount; agingCount["61-90"]++; }
      else { aging["90+"] += amount; agingCount["90+"]++; }
    });
    const latePayments = invoices.filter(i => i.status === "paid" && i.paid_at && i.due_date && i.paid_at > i.due_date);
    const totalLateRecovered = latePayments.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    const totalEverOverdue = totalOverdue + totalLateRecovered;
    const recoveryRate = totalEverOverdue > 0 ? (totalLateRecovered / totalEverOverdue) * 100 : 0;
    const byCompany: Record<string, { name: string; total: number; count: number }> = {};
    const companyMap = new Map(companies.map(c => [c.id, c.name]));
    overdue.forEach((inv: any) => {
      const name = companyMap.get(inv.company_id) || "Desconhecido";
      if (!byCompany[inv.company_id]) byCompany[inv.company_id] = { name, total: 0, count: 0 };
      byCompany[inv.company_id].total += inv.amount_cents || 0;
      byCompany[inv.company_id].count++;
    });
    return {
      totalOverdue, inadimplenciaPercent, aging, agingCount, recoveryRate,
      overdueCount: overdue.length,
      byCompany: Object.values(byCompany).sort((a, b) => b.total - a.total)
    };
  }, [invoices, companies, today]);

  const agingData = [
    { name: "0-30 dias", value: delinquency.aging["0-30"] / 100, count: delinquency.agingCount["0-30"], color: "hsl(38, 92%, 50%)" },
    { name: "31-60 dias", value: delinquency.aging["31-60"] / 100, count: delinquency.agingCount["31-60"], color: "hsl(25, 95%, 53%)" },
    { name: "61-90 dias", value: delinquency.aging["61-90"] / 100, count: delinquency.agingCount["61-90"], color: "hsl(12, 95%, 53%)" },
    { name: "+90 dias", value: delinquency.aging["90+"] / 100, count: delinquency.agingCount["90+"], color: "hsl(350, 89%, 60%)" },
  ];

  const summaryCards = [
    { label: "% Inadimplência", value: `${delinquency.inadimplenciaPercent.toFixed(1)}%`, icon: AlertTriangle, danger: delinquency.inadimplenciaPercent > 8 },
    { label: "Valor em Aberto", value: formatCurrencyCents(delinquency.totalOverdue), icon: DollarSign, sub: `${delinquency.overdueCount} fatura(s)`, danger: true },
    { label: "Taxa de Recuperação", value: `${delinquency.recoveryRate.toFixed(1)}%`, icon: TrendingDown, danger: false },
    { label: "Empresas Inadimplentes", value: delinquency.byCompany.length.toString(), icon: Building2, danger: false },
  ];

  const summaryStyles = [
    { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20", text: "text-amber-400", glow: "shadow-amber-500/10" },
    { bg: "from-red-500/20 via-red-500/5 to-transparent", border: "border-red-500/20", text: "text-red-400", glow: "shadow-red-500/10" },
    { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
    { bg: "from-indigo-500/20 via-indigo-500/5 to-transparent", border: "border-indigo-500/20", text: "text-indigo-400", glow: "shadow-indigo-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
          Inadimplência
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Aging list e análise de recuperação</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {summaryCards.map((card, idx) => {
          const s = summaryStyles[idx];
          const Icon = card.icon;
          return (
            <Card key={idx} className={`relative overflow-hidden border ${s.border} bg-gradient-to-br ${s.bg} backdrop-blur-xl shadow-lg ${s.glow} hover:scale-[1.02] transition-all duration-300`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <CardContent className="pt-4 pb-3 relative">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded-lg bg-white/5 ${s.text}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.text}`}>{card.value}</p>
                {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging Chart */}
        <Card className="border-orange-500/10 bg-gradient-to-br from-orange-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              Aging List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="value" name="Valor" radius={[0, 6, 6, 0]}>
                  {agingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Aging Pie */}
        <Card className="border-rose-500/10 bg-gradient-to-br from-rose-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-rose-500" />
              Distribuição por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={agingData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {agingData.filter(d => d.value > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-emerald-400 text-sm font-medium">
                ✅ Nenhuma inadimplência
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Delinquent Companies */}
      {delinquency.byCompany.length > 0 && (
        <Card className="border-red-500/10 bg-gradient-to-br from-red-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              Maiores Inadimplentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {delinquency.byCompany.slice(0, 10).map((comp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center text-xs font-bold text-red-400">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{comp.name}</p>
                      <p className="text-xs text-muted-foreground">{comp.count} fatura(s) vencida(s)</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-red-400">{formatCurrencyCents(comp.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
