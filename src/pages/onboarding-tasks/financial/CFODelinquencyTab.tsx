import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, DollarSign, TrendingDown } from "lucide-react";
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

    // Aging buckets
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

    // Recovery rate: paid late invoices / total overdue
    const latePayments = invoices.filter(i => i.status === "paid" && i.paid_at && i.due_date && i.paid_at > i.due_date);
    const totalLateRecovered = latePayments.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    const totalEverOverdue = totalOverdue + totalLateRecovered;
    const recoveryRate = totalEverOverdue > 0 ? (totalLateRecovered / totalEverOverdue) * 100 : 0;

    // By company
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
    { name: "+90 dias", value: delinquency.aging["90+"] / 100, count: delinquency.agingCount["90+"], color: "hsl(var(--destructive))" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Inadimplência</h2>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className={delinquency.inadimplenciaPercent > 8 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${delinquency.inadimplenciaPercent > 8 ? "text-destructive" : "text-amber-600"}`} />
            </div>
            <p className="text-xs text-muted-foreground">% Inadimplência</p>
            <p className={`text-2xl font-bold ${delinquency.inadimplenciaPercent > 8 ? "text-destructive" : "text-amber-600"}`}>
              {delinquency.inadimplenciaPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-destructive" /></div>
            <p className="text-xs text-muted-foreground">Valor em Aberto</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrencyCents(delinquency.totalOverdue)}</p>
            <p className="text-xs text-muted-foreground">{delinquency.overdueCount} fatura(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-emerald-600" /></div>
            <p className="text-xs text-muted-foreground">Taxa de Recuperação</p>
            <p className="text-2xl font-bold text-emerald-600">{delinquency.recoveryRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Empresas Inadimplentes</p>
            <p className="text-2xl font-bold">{delinquency.byCompany.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Aging List</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]}>
                  {agingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Aging Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Período</CardTitle>
          </CardHeader>
          <CardContent>
            {agingData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={agingData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {agingData.filter(d => d.value > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-emerald-600 text-sm font-medium">
                ✅ Nenhuma inadimplência
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Delinquent Companies */}
      {delinquency.byCompany.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Maiores Inadimplentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {delinquency.byCompany.slice(0, 10).map((comp, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{comp.name}</p>
                    <p className="text-xs text-muted-foreground">{comp.count} fatura(s) vencida(s)</p>
                  </div>
                  <p className="text-sm font-bold text-destructive">{formatCurrencyCents(comp.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
