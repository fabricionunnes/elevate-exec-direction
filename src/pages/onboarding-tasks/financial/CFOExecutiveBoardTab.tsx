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

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  companies: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFOExecutiveBoardTab({ invoices, payables, banks, companies, formatCurrency, formatCurrencyCents }: Props) {
  const [period, setPeriod] = useState("current");
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("financial_alert_config").select("*").eq("is_active", true)
      .then(({ data }) => setAlerts(data || []));
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonthStr = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

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

    // Active companies
    const activeCompanyIds = new Set(
      invoices.filter(i => i.status === "paid" && i.due_date?.startsWith(monthStr)).map(i => i.company_id)
    );

    // Churn: companies that had invoices last month but not this month
    const prevCompanyIds = new Set(
      invoices.filter(i => i.status === "paid" && i.due_date?.startsWith(prevMonthStr)).map(i => i.company_id)
    );
    const churned = [...prevCompanyIds].filter(id => !activeCompanyIds.has(id));
    const churnRate = prevCompanyIds.size > 0 ? (churned.length / prevCompanyIds.size) * 100 : 0;

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
  }, [invoices, payables, banks]);

  // Monthly trend data (last 6 months)
  const trendData = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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
  }, [invoices, payables]);

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
    { label: "Receita Total", value: formatCurrencyCents(metrics.receitaTotal), icon: DollarSign, color: "text-emerald-600", change: metrics.revenueChange },
    { label: "MRR Atual", value: formatCurrencyCents(metrics.mrr), icon: TrendingUp, color: "text-blue-600" },
    { label: "Receita Não Recorrente", value: formatCurrencyCents(metrics.receitaNaoRecorrente), icon: BarChart3, color: "text-violet-600" },
    { label: "EBITDA", value: formatCurrencyCents(metrics.ebitda), icon: Target, color: metrics.ebitda >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Margem EBITDA", value: `${metrics.margemEbitda.toFixed(1)}%`, icon: Percent, color: metrics.margemEbitda >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Caixa Atual", value: formatCurrencyCents(metrics.caixaAtual), icon: Wallet, color: "text-blue-600" },
    { label: "Burn Rate", value: formatCurrencyCents(metrics.burnRate), icon: TrendingDown, color: "text-orange-600" },
    { label: "Runway", value: `${metrics.runway >= 999 ? "∞" : metrics.runway.toFixed(1)} meses`, icon: Clock, color: metrics.runway < 6 ? "text-destructive" : "text-emerald-600" },
    { label: "Clientes Ativos", value: metrics.activeCompanies.toString(), icon: Users, color: "text-blue-600" },
    { label: "Churn", value: `${metrics.churnRate.toFixed(1)}%`, icon: TrendingDown, color: metrics.churnRate > 5 ? "text-destructive" : "text-emerald-600" },
    { label: "Inadimplência", value: `${metrics.inadimplencia.toFixed(1)}%`, icon: AlertTriangle, color: metrics.inadimplencia > 8 ? "text-destructive" : "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Executive Board</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
            <div key={alert.key} className={`flex items-center gap-3 p-3 rounded-lg border ${alert.severity === "critical" ? "bg-destructive/10 border-destructive/30" : "bg-amber-500/10 border-amber-500/30"}`}>
              <ShieldAlert className={`h-5 w-5 ${alert.severity === "critical" ? "text-destructive" : "text-amber-500"}`} />
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
          return (
            <Card key={idx} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between mb-2">
                  <Icon className={`h-5 w-5 ${kpi.color} opacity-70`} />
                  {kpi.change !== undefined && (
                    <span className={`text-xs font-medium flex items-center gap-0.5 ${kpi.change >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {kpi.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Receita vs Despesa (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(142, 76%, 36%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">EBITDA & MRR (Tendência)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%, 0.1)" strokeWidth={2} />
                <Area type="monotone" dataKey="ebitda" name="EBITDA" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%, 0.1)" strokeWidth={2} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bank Balances */}
      {banks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Saldos Bancários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {banks.map((bank: any) => (
                <div key={bank.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{bank.name}</p>
                    <p className="text-lg font-bold">{formatCurrencyCents(bank.current_balance_cents || 0)}</p>
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
