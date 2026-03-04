import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Users, Clock, BarChart3, ShieldCheck, Activity } from "lucide-react";
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

const summaryStyles = [
  { bg: "from-rose-500/20 via-rose-500/5 to-transparent", border: "border-rose-500/20", text: "text-rose-400", glow: "shadow-rose-500/10" },
  { bg: "from-orange-500/20 via-orange-500/5 to-transparent", border: "border-orange-500/20", text: "text-orange-400", glow: "shadow-orange-500/10" },
  { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20", text: "text-amber-400", glow: "shadow-amber-500/10" },
  { bg: "from-blue-500/20 via-blue-500/5 to-transparent", border: "border-blue-500/20", text: "text-blue-400", glow: "shadow-blue-500/10" },
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
  { bg: "from-teal-500/20 via-teal-500/5 to-transparent", border: "border-teal-500/20", text: "text-teal-400", glow: "shadow-teal-500/10" },
];

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

      const isMRR = (i: any) => (i.total_installments || 1) > 1;
      const curCompanies = new Set(invoices.filter(inv => inv.due_date?.startsWith(key) && isMRR(inv)).map(i => i.company_id));
      const prevCompanies = new Set(invoices.filter(inv => inv.due_date?.startsWith(prevKey) && isMRR(inv)).map(i => i.company_id));

      // Invoice-based churn + system churn
      // Only count as churn if company cancelled with remaining installments
      const invoiceChurned = [...prevCompanies].filter(id => {
        if (curCompanies.has(id)) return false;
        const lastInv = invoices
          .filter(i => i.company_id === id && i.due_date?.startsWith(prevKey) && isMRR(i))
          .sort((a: any, b: any) => (a.installment_number || 0) - (b.installment_number || 0))
          .pop();
        if (lastInv && lastInv.installment_number >= lastInv.total_installments) return false;
        return true;
      });
      const systemChurnedInPeriod = fullCompanies.filter((c: any) => {
        if (c.contract_end_date && c.contract_end_date.startsWith(key)) return true;
        if ((c.status === "churned" || c.status === "cancelled") && c.status_changed_at?.startsWith(key)) return true;
        return false;
      }).map((c: any) => c.id);
      
      const allChurned = new Set([...invoiceChurned, ...systemChurnedInPeriod]);
      const churnRate = prevCompanies.size > 0 ? (allChurned.size / prevCompanies.size) * 100 : 0;

      // Revenue churn (only MRR invoices)
      const churnedRevenue = invoices
        .filter(inv => inv.due_date?.startsWith(prevKey) && isMRR(inv) && allChurned.has(inv.company_id))
        .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const prevRevenue = invoices
        .filter(inv => inv.due_date?.startsWith(prevKey) && isMRR(inv))
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
      const isMRRCohort = (i: any) => (i.total_installments || 1) > 1;
      invoices.forEach(inv => {
        if (inv.due_date?.startsWith(cohortKey) && isMRRCohort(inv)) {
          // Check if this is their first month
          const hasEarlier = invoices.some(prev => 
            prev.company_id === inv.company_id && isMRRCohort(prev) && prev.due_date < cohortKey
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
          invoices.some(inv => inv.company_id === id && inv.due_date?.startsWith(checkKey) && (inv.total_installments || 1) > 1)
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

  const summaryCards = [
    { label: "Churn Clientes", value: `${summary.clientChurn.toFixed(1)}%` },
    { label: "Churn Receita", value: `${summary.revenueChurn.toFixed(1)}%` },
    { label: "Churn Médio (6m)", value: `${summary.avgChurn.toFixed(1)}%` },
    { label: "Lifetime Médio", value: `${summary.lifetimeMedio} meses` },
    { label: "Retenção 3m", value: `${summary.retention3m}%` },
    { label: "Retenção 6m", value: `${summary.retention6m}%` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
          Churn & Retenção
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Análise de perda e retenção de clientes</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map((card, idx) => {
          const s = summaryStyles[idx];
          return (
            <Card key={idx} className={`relative overflow-hidden border ${s.border} bg-gradient-to-br ${s.bg} backdrop-blur-xl shadow-lg ${s.glow} hover:scale-[1.02] transition-all duration-300`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <CardContent className="pt-4 pb-3 relative">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.text}`}>{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Churn Trend Chart */}
      <Card className="border-rose-500/10 bg-gradient-to-br from-rose-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-rose-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Churn Mensal (Clientes vs Receita)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyChurn}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis unit="%" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="clientChurn" name="Churn Clientes %" fill="hsl(350, 89%, 60%)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="revenueChurn" name="Churn Receita %" fill="hsl(25, 95%, 53%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cohort Retention Table */}
      <Card className="border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            Retenção por Cohort
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cohortRetention.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left p-2 font-medium text-muted-foreground">Cohort</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Tamanho</th>
                    {[1, 2, 3, 4, 5, 6].map(m => (
                      <th key={m} className="text-center p-2 font-medium text-muted-foreground">Mês {m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortRetention.map((cohort, idx) => (
                    <tr key={idx} className="border-b border-white/5 last:border-0">
                      <td className="p-2 font-medium">{cohort.label}</td>
                      <td className="text-center p-2">
                        <Badge variant="outline" className="bg-white/5 border-white/10">{cohort.size}</Badge>
                      </td>
                      {[0, 1, 2, 3, 4, 5].map(m => (
                        <td key={m} className="text-center p-2">
                          {cohort.retentionRates[m] !== undefined ? (
                            <Badge
                              variant="outline"
                              className={
                                cohort.retentionRates[m] >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                                cohort.retentionRates[m] >= 60 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                                "bg-red-500/15 text-red-400 border-red-500/30"
                              }
                            >
                              {cohort.retentionRates[m].toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
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
