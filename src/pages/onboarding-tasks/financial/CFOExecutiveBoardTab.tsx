import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, Users, 
  Wallet, Target, BarChart3, Percent, Clock, ShieldAlert, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  LineChart, Line, Area, AreaChart, Legend, ReferenceLine
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  companies: any[];
  fullCompanies: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

const kpiGradients = [
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", glow: "shadow-emerald-500/10", text: "text-emerald-400", icon: "text-emerald-500" },
  { bg: "from-blue-500/20 via-blue-500/5 to-transparent", border: "border-blue-500/20", glow: "shadow-blue-500/10", text: "text-blue-400", icon: "text-blue-500" },
  { bg: "from-violet-500/20 via-violet-500/5 to-transparent", border: "border-violet-500/20", glow: "shadow-violet-500/10", text: "text-violet-400", icon: "text-violet-500" },
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", glow: "shadow-emerald-500/10", text: "text-emerald-400", icon: "text-emerald-500" },
  { bg: "from-teal-500/20 via-teal-500/5 to-transparent", border: "border-teal-500/20", glow: "shadow-teal-500/10", text: "text-teal-400", icon: "text-teal-500" },
  { bg: "from-cyan-500/20 via-cyan-500/5 to-transparent", border: "border-cyan-500/20", glow: "shadow-cyan-500/10", text: "text-cyan-400", icon: "text-cyan-500" },
  { bg: "from-orange-500/20 via-orange-500/5 to-transparent", border: "border-orange-500/20", glow: "shadow-orange-500/10", text: "text-orange-400", icon: "text-orange-500" },
  { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20", glow: "shadow-amber-500/10", text: "text-amber-400", icon: "text-amber-500" },
  { bg: "from-indigo-500/20 via-indigo-500/5 to-transparent", border: "border-indigo-500/20", glow: "shadow-indigo-500/10", text: "text-indigo-400", icon: "text-indigo-500" },
  { bg: "from-rose-500/20 via-rose-500/5 to-transparent", border: "border-rose-500/20", glow: "shadow-rose-500/10", text: "text-rose-400", icon: "text-rose-500" },
  { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20", glow: "shadow-amber-500/10", text: "text-amber-400", icon: "text-amber-500" },
];

export default function CFOExecutiveBoardTab({ invoices, payables, banks, companies, fullCompanies, filters, formatCurrency, formatCurrencyCents }: Props) {
  const [period, setPeriod] = useState("current");
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("financial_alert_config").select("*").eq("is_active", true)
      .then(({ data }) => setAlerts(data || []));
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const selectedMonth = filters.month !== "all" ? filters.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStr = selectedMonth;
    const prevDate = filters.month !== "all" 
      ? new Date(parseInt(filters.month.split("-")[0]), parseInt(filters.month.split("-")[1]) - 2, 1)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    // Revenue this month (paid invoices)
    const monthInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr));
    const receitaTotal = monthInvoices.filter(i => i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    
    const prevMonthInvoices = invoices.filter(i => i.due_date?.startsWith(prevMonthStr));
    const receitaPrev = prevMonthInvoices.filter(i => i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);

    // MRR: recurring invoices (those linked to recurring_charge_id)
    const recurringInvoices = monthInvoices.filter(i => i.recurring_charge_id);
    const mrr = recurringInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // Non-recurring revenue
    const receitaNaoRecorrente = receitaTotal - mrr;

    // Expenses this month
    const monthPayables = payables.filter(p => p.due_date?.startsWith(monthStr) || p.reference_month === monthStr);
    const despesaTotal = monthPayables.filter((p: any) => p.status === "paid")
      .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);

    // EBITDA = Revenue - Expenses (simplified)
    const ebitda = receitaTotal - despesaTotal;
    const margemEbitda = receitaTotal > 0 ? (ebitda / receitaTotal) * 100 : 0;

    // Cash
    const caixaAtual = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0);

    // Burn Rate (average monthly expenses over last 3 months)
    const burnMonths: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const desp = payables.filter((p: any) => (p.due_date?.startsWith(key) || p.reference_month === key) && p.status === "paid")
        .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
      burnMonths.push(desp);
    }
    const burnRate = burnMonths.length > 0 ? burnMonths.reduce((a, b) => a + b, 0) / burnMonths.length : 0;

    // Runway
    const runway = burnRate > 0 ? caixaAtual / burnRate : 999;

    // Active companies from invoices
    const activeCompanyIds = new Set(
      invoices.filter(i => i.status === "paid" && i.due_date?.startsWith(monthStr)).map(i => i.company_id)
    );

    // Churn: use real system data from fullCompanies
    // Companies with status 'churned', 'cancelled', or contract ended
    const churnedFromSystem = fullCompanies.filter((c: any) => {
      if (c.status === 'churned' || c.status === 'cancelled') return true;
      if (c.contract_end_date && c.contract_end_date <= monthStr + "-31") {
        // Check if contract ended in this period
        const endMonth = c.contract_end_date.substring(0, 7);
        return endMonth === monthStr;
      }
      return false;
    });

    // Also detect invoice-based churn: companies that had invoices last month but not this month
    const prevCompanyIds = new Set(
      invoices.filter(i => i.status === "paid" && i.due_date?.startsWith(prevMonthStr)).map(i => i.company_id)
    );
    const invoiceChurned = [...prevCompanyIds].filter(id => !activeCompanyIds.has(id));
    
    // Combine both sources, deduplicate
    const allChurnedIds = new Set([
      ...churnedFromSystem.map((c: any) => c.id),
      ...invoiceChurned
    ]);
    const churnRate = prevCompanyIds.size > 0 ? (allChurnedIds.size / prevCompanyIds.size) * 100 : 0;

    // Delinquency
    const overdueInvoices = invoices.filter(i => i.status === "overdue");
    const overdueTotal = overdueInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const totalExpected = monthInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const inadimplencia = totalExpected > 0 ? (overdueTotal / totalExpected) * 100 : 0;

    // CAC (simplified: total marketing+commercial payables / new companies)
    const cac = 0; // Will need cac_cost_items data
    const ltv = mrr > 0 && churnRate > 0 ? (mrr / 100) / (churnRate / 100) : 0;
    const ltvCac = cac > 0 ? ltv / cac : 0;

    // Revenue variation
    const revenueChange = receitaPrev > 0 ? ((receitaTotal - receitaPrev) / receitaPrev) * 100 : 0;

    return {
      receitaTotal, mrr, receitaNaoRecorrente, ebitda, margemEbitda,
      caixaAtual, burnRate, runway, cac, ltv, ltvCac, churnRate, inadimplencia,
      revenueChange, activeCompanies: activeCompanyIds.size
    };
  }, [invoices, payables, banks, fullCompanies, filters.month]);

  // Monthly trend data (last 6 months)
  const trendData = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    const refDate = filters.month !== "all" 
      ? new Date(parseInt(filters.month.split("-")[0]), parseInt(filters.month.split("-")[1]) - 1, 1)
      : now;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      const rec = invoices.filter(inv => inv.due_date?.startsWith(key) && inv.status === "paid")
        .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100;
      const recurringRec = invoices.filter(inv => inv.due_date?.startsWith(key) && inv.status === "paid" && inv.recurring_charge_id)
        .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0) / 100;
      const desp = payables.filter((p: any) => (p.due_date?.startsWith(key) || p.reference_month === key) && p.status === "paid")
        .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);

      months.push({ label, receita: rec, mrr: recurringRec, despesa: desp, ebitda: rec - desp });
    }
    return months;
  }, [invoices, payables, filters.month]);

  // Active alerts
  const activeAlerts = useMemo(() => {
    const triggered: { key: string; label: string; severity: string; value: string }[] = [];
    const metricsMap: Record<string, number> = {
      ltv_cac_ratio: metrics.ltvCac,
      churn_rate: metrics.churnRate,
      payroll_revenue_ratio: 0, // Would need payroll data
      runway_months: metrics.runway,
      delinquency_rate: metrics.inadimplencia,
    };

    alerts.forEach(alert => {
      const val = metricsMap[alert.alert_key];
      if (val === undefined) return;
      let triggered_flag = false;
      if (alert.comparison === "lt" && val < alert.threshold) triggered_flag = true;
      if (alert.comparison === "gt" && val > alert.threshold) triggered_flag = true;
      if (triggered_flag) {
        triggered.push({ key: alert.alert_key, label: alert.label, severity: alert.severity, value: val.toFixed(1) });
      }
    });
    return triggered;
  }, [alerts, metrics]);

  const kpiCards = [
    { label: "Receita Total", value: formatCurrencyCents(metrics.receitaTotal), icon: DollarSign, change: metrics.revenueChange },
    { label: "MRR Atual", value: formatCurrencyCents(metrics.mrr), icon: TrendingUp },
    { label: "Receita Não Recorrente", value: formatCurrencyCents(metrics.receitaNaoRecorrente), icon: BarChart3 },
    { label: "EBITDA", value: formatCurrencyCents(metrics.ebitda), icon: Target },
    { label: "Margem EBITDA", value: `${metrics.margemEbitda.toFixed(1)}%`, icon: Percent },
    { label: "Caixa Atual", value: formatCurrencyCents(metrics.caixaAtual), icon: Wallet },
    { label: "Burn Rate", value: formatCurrencyCents(metrics.burnRate), icon: TrendingDown },
    { label: "Runway", value: `${metrics.runway >= 999 ? "∞" : metrics.runway.toFixed(1)} meses`, icon: Clock },
    { label: "Clientes Ativos", value: metrics.activeCompanies.toString(), icon: Users },
    { label: "Churn", value: `${metrics.churnRate.toFixed(1)}%`, icon: TrendingDown },
    { label: "Inadimplência", value: `${metrics.inadimplencia.toFixed(1)}%`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            Executive Board
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Visão consolidada dos indicadores estratégicos</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] backdrop-blur-sm bg-card/50 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês Atual</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="year">Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map(alert => (
            <div key={alert.key} className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur-sm ${alert.severity === "critical" ? "bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/5" : "bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5"}`}>
              <ShieldAlert className={`h-5 w-5 ${alert.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
              <span className="text-sm font-medium">{alert.label}</span>
              <Badge variant={alert.severity === "critical" ? "destructive" : "outline"} className="ml-auto">
                Valor: {alert.value}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          const g = kpiGradients[idx % kpiGradients.length];
          return (
            <Card key={idx} className={`relative overflow-hidden border ${g.border} bg-gradient-to-br ${g.bg} backdrop-blur-xl shadow-lg ${g.glow} hover:scale-[1.02] transition-all duration-300`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <CardContent className="pt-4 pb-3 relative">
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-1.5 rounded-lg bg-white/5 ${g.icon}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {kpi.change !== undefined && (
                    <span className={`text-xs font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${kpi.change >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                      {kpi.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${g.text}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              Receita vs Despesa (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, backdropFilter: "blur(12px)" }} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(160, 84%, 39%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(350, 89%, 60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-violet-500/10 bg-gradient-to-br from-violet-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              EBITDA & MRR (Tendência)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(221, 83%, 53%)" fill="url(#mrrGrad)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="ebitda" name="EBITDA" stroke="hsl(160, 84%, 39%)" fill="url(#ebitdaGrad)" strokeWidth={2.5} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground) / 0.3)" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bank Balances */}
      {banks.length > 0 && (
        <Card className="border-cyan-500/10 bg-gradient-to-br from-cyan-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-500" />
              Saldos Bancários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {banks.map((bank: any) => (
                <div key={bank.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <Wallet className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{bank.name}</p>
                    <p className="text-lg font-bold text-cyan-400">{formatCurrencyCents(bank.current_balance_cents || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
