import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Users, Clock, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, Area, AreaChart
} from "recharts";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  companies: any[];
  fullCompanies: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFOChurnRetentionTab({ invoices, companies, fullCompanies, filters, formatCurrency, formatCurrencyCents }: Props) {
  const now = new Date();
  const refDate = filters.month !== "all"
    ? new Date(parseInt(filters.month.split("-")[0]), parseInt(filters.month.split("-")[1]) - 1, 1)
    : now;

  // System-level churned companies
  const systemChurnedIds = useMemo(() => new Set(
    fullCompanies.filter((c: any) => c.status === "churned" || c.status === "cancelled").map((c: any) => c.id)
  ), [fullCompanies]);

  // Monthly churn analysis (last 6 months)
  const monthlyChurn = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const prevD = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      const curCompanies = new Set(invoices.filter(inv => inv.due_date?.startsWith(key) && inv.recurring_charge_id).map(i => i.company_id));
      const prevCompanies = new Set(invoices.filter(inv => inv.due_date?.startsWith(prevKey) && inv.recurring_charge_id).map(i => i.company_id));

      // Invoice-based churn + system churn
      const invoiceChurned = [...prevCompanies].filter(id => !curCompanies.has(id));
      const systemChurnedInPeriod = fullCompanies.filter((c: any) => {
        if (c.contract_end_date && c.contract_end_date.startsWith(key)) return true;
        if ((c.status === "churned" || c.status === "cancelled") && c.status_changed_at?.startsWith(key)) return true;
        return false;
      }).map((c: any) => c.id);
      
      const allChurned = new Set([...invoiceChurned, ...systemChurnedInPeriod]);
      const churnRate = prevCompanies.size > 0 ? (allChurned.size / prevCompanies.size) * 100 : 0;

      // Revenue churn
      const churnedRevenue = invoices
        .filter(inv => inv.due_date?.startsWith(prevKey) && inv.recurring_charge_id && allChurned.has(inv.company_id))
        .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const prevRevenue = invoices
        .filter(inv => inv.due_date?.startsWith(prevKey) && inv.recurring_charge_id)
        .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const revenueChurnRate = prevRevenue > 0 ? (churnedRevenue / prevRevenue) * 100 : 0;

      months.push({
        label, clientChurn: churnRate, revenueChurn: revenueChurnRate,
        activeClients: curCompanies.size, churnedCount: allChurned.size
      });
    }
    return months;
  }, [invoices, fullCompanies, refDate]);

  // Retention cohort analysis
  const cohortRetention = useMemo(() => {
    const cohorts: any[] = [];
    for (let c = 5; c >= 0; c--) {
      const cohortDate = new Date(refDate.getFullYear(), refDate.getMonth() - c, 1);
      const cohortKey = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, "0")}`;
      const cohortLabel = cohortDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      // Companies that started (first invoice) in this cohort month
      const cohortCompanies = new Set<string>();
      invoices.forEach(inv => {
        if (inv.due_date?.startsWith(cohortKey) && inv.recurring_charge_id) {
          // Check if this is their first month
          const hasEarlier = invoices.some(prev => 
            prev.company_id === inv.company_id && prev.recurring_charge_id && prev.due_date < cohortKey
          );
          if (!hasEarlier) cohortCompanies.add(inv.company_id);
        }
      });

      if (cohortCompanies.size === 0) continue;

      const retentionRates: number[] = [];
      for (let m = 1; m <= Math.min(c, 6); m++) {
        const checkDate = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + m, 1);
        const checkKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}`;
        const retained = [...cohortCompanies].filter(id =>
          invoices.some(inv => inv.company_id === id && inv.due_date?.startsWith(checkKey) && inv.recurring_charge_id)
        );
        retentionRates.push((retained.length / cohortCompanies.size) * 100);
      }

      cohorts.push({ label: cohortLabel, size: cohortCompanies.size, retentionRates });
    }
    return cohorts;
  }, [invoices]);

  // Summary metrics
  const summary = useMemo(() => {
    const lastMonth = monthlyChurn[monthlyChurn.length - 1] || { clientChurn: 0, revenueChurn: 0 };
    const avgChurn = monthlyChurn.length > 0
      ? monthlyChurn.reduce((s, m) => s + m.clientChurn, 0) / monthlyChurn.length
      : 0;
    const lifetimeMedio = avgChurn > 0 ? 1 / (avgChurn / 100) : 0;

    // Retention at 3, 6 months
    const ret3 = cohortRetention.find(c => c.retentionRates.length >= 3);
    const ret6 = cohortRetention.find(c => c.retentionRates.length >= 6);

    return {
      clientChurn: lastMonth.clientChurn,
      revenueChurn: lastMonth.revenueChurn,
      avgChurn,
      lifetimeMedio: lifetimeMedio.toFixed(1),
      retention3m: ret3?.retentionRates[2]?.toFixed(1) || "—",
      retention6m: ret6?.retentionRates[5]?.toFixed(1) || "—",
    };
  }, [monthlyChurn, cohortRetention]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Churn & Retenção</h2>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Churn Clientes</p>
            <p className={`text-xl font-bold ${Number(summary.clientChurn) > 5 ? "text-destructive" : "text-emerald-600"}`}>
              {summary.clientChurn.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Churn Receita</p>
            <p className={`text-xl font-bold ${Number(summary.revenueChurn) > 5 ? "text-destructive" : "text-emerald-600"}`}>
              {summary.revenueChurn.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Churn Médio (6m)</p>
            <p className="text-xl font-bold">{summary.avgChurn.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Lifetime Médio</p>
            <p className="text-xl font-bold text-blue-600">{summary.lifetimeMedio} meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Retenção 3m</p>
            <p className="text-xl font-bold text-emerald-600">{summary.retention3m}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Retenção 6m</p>
            <p className="text-xl font-bold text-emerald-600">{summary.retention6m}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Churn Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Churn Mensal (Clientes vs Receita)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyChurn}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis unit="%" className="text-xs" />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar dataKey="clientChurn" name="Churn Clientes %" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="revenueChurn" name="Churn Receita %" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cohort Retention Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Retenção por Cohort</CardTitle>
        </CardHeader>
        <CardContent>
          {cohortRetention.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Cohort</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Tamanho</th>
                    {[1, 2, 3, 4, 5, 6].map(m => (
                      <th key={m} className="text-center p-2 font-medium text-muted-foreground">Mês {m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortRetention.map((cohort, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2 font-medium">{cohort.label}</td>
                      <td className="text-center p-2">{cohort.size}</td>
                      {[0, 1, 2, 3, 4, 5].map(m => (
                        <td key={m} className="text-center p-2">
                          {cohort.retentionRates[m] !== undefined ? (
                            <Badge
                              variant="outline"
                              className={
                                cohort.retentionRates[m] >= 80 ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" :
                                cohort.retentionRates[m] >= 60 ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
                                "bg-destructive/10 text-destructive border-destructive/30"
                              }
                            >
                              {cohort.retentionRates[m].toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Dados insuficientes para análise de cohort
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
