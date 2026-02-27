import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, DollarSign, TrendingUp, Clock, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  invoices: any[];
  payables: any[];
  companies: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFOUnitEconomicsTab({ invoices, payables, companies, formatCurrency, formatCurrencyCents }: Props) {
  const [cacCosts, setCacCosts] = useState<any[]>([]);
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    supabase.from("cac_cost_items").select("*")
      .eq("year", now.getFullYear())
      .eq("month", now.getMonth() + 1)
      .then(({ data }) => setCacCosts(data || []));
  }, []);

  const metrics = useMemo(() => {
    // MRR & Ticket
    const recurringInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.recurring_charge_id);
    const mrr = recurringInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const activeCompanies = new Set(recurringInvoices.map(i => i.company_id));
    const ticketMedio = activeCompanies.size > 0 ? mrr / activeCompanies.size : 0;

    // Churn rate (avg last 3 months)
    let totalChurn = 0;
    let churnMonths = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const prevD = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;
      
      const cur = new Set(invoices.filter(inv => inv.due_date?.startsWith(key) && inv.recurring_charge_id).map(i => i.company_id));
      const prev = new Set(invoices.filter(inv => inv.due_date?.startsWith(prevKey) && inv.recurring_charge_id).map(i => i.company_id));
      const churned = [...prev].filter(id => !cur.has(id));
      if (prev.size > 0) {
        totalChurn += churned.length / prev.size;
        churnMonths++;
      }
    }
    const avgChurnRate = churnMonths > 0 ? totalChurn / churnMonths : 0;
    const lifetimeMedio = avgChurnRate > 0 ? 1 / avgChurnRate : 0;

    // LTV
    const ltv = (ticketMedio / 100) * lifetimeMedio;

    // CAC
    const totalCacCost = cacCosts.reduce((s, c) => s + (c.value || 0), 0);
    // New companies this month (first recurring invoice)
    const newCompanies = [...activeCompanies].filter(id => {
      const hasPrev = invoices.some(inv => inv.company_id === id && inv.recurring_charge_id && inv.due_date < monthStr);
      return !hasPrev;
    });
    const cac = newCompanies.length > 0 ? totalCacCost / newCompanies.length : 0;

    // LTV/CAC
    const ltvCac = cac > 0 ? ltv / cac : 0;

    // Payback
    const margemContribuicao = ticketMedio > 0 ? (ticketMedio / 100) * 0.7 : 0; // 70% margin estimate
    const payback = margemContribuicao > 0 ? cac / margemContribuicao : 0;

    // Revenue
    const receitaMensal = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    
    // Variable costs (simplified)
    const despesasMes = payables.filter(p => (p.due_date?.startsWith(monthStr) || p.reference_month === monthStr) && p.status === "paid")
      .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    
    const margemContribuicaoReal = receitaMensal - despesasMes;

    return {
      ticketMedio, mrr, ltv, cac, ltvCac, payback, lifetimeMedio,
      activeCount: activeCompanies.size, newCount: newCompanies.length,
      margemContribuicao: margemContribuicaoReal, receitaMensal
    };
  }, [invoices, payables, cacCosts, monthStr]);

  // LTV/CAC color
  const ltvCacColor = metrics.ltvCac < 2 ? "text-destructive" : metrics.ltvCac < 3 ? "text-amber-600" : "text-emerald-600";
  const ltvCacBg = metrics.ltvCac < 2 ? "bg-destructive/10 border-destructive/30" : metrics.ltvCac < 3 ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30";

  // Monthly CAC/LTV trend
  const trendData = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      const recurring = invoices.filter(inv => inv.due_date?.startsWith(key) && inv.recurring_charge_id);
      const companies = new Set(recurring.map(i => i.company_id));
      const mrr = recurring.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const ticket = companies.size > 0 ? mrr / companies.size / 100 : 0;

      months.push({ label, ticket, clientes: companies.size });
    }
    return months;
  }, [invoices]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Unit Economics</h2>

      {/* Main KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={`border ${ltvCacBg}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className={`h-5 w-5 ${ltvCacColor}`} />
              <p className="text-sm text-muted-foreground">LTV/CAC</p>
            </div>
            <p className={`text-3xl font-bold ${ltvCacColor}`}>
              {metrics.ltvCac > 0 ? `${metrics.ltvCac.toFixed(1)}x` : "—"}
            </p>
            <Badge variant="outline" className={`mt-2 ${ltvCacBg}`}>
              {metrics.ltvCac < 2 ? "⚠️ Abaixo do ideal" : metrics.ltvCac < 3 ? "🟡 Aceitável" : "✅ Saudável"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <p className="text-sm text-muted-foreground">CAC</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {metrics.cac > 0 ? formatCurrency(metrics.cac) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{metrics.newCount} novos clientes no mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">LTV</p>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {metrics.ltv > 0 ? formatCurrency(metrics.ltv) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Lifetime: {metrics.lifetimeMedio.toFixed(1)} meses</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-violet-600" />
              <p className="text-sm text-muted-foreground">Payback</p>
            </div>
            <p className="text-3xl font-bold text-violet-600">
              {metrics.payback > 0 ? `${metrics.payback.toFixed(1)} meses` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold">{formatCurrencyCents(metrics.ticketMedio)}</p>
            <p className="text-xs text-muted-foreground">{metrics.activeCount} clientes ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Margem de Contribuição</p>
            <p className={`text-2xl font-bold ${metrics.margemContribuicao >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrencyCents(metrics.margemContribuicao)}
            </p>
            <p className="text-xs text-muted-foreground">Receita - Custos Variáveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">MRR</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrencyCents(metrics.mrr)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Ticket Médio & Base de Clientes (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip formatter={(v: number, name: string) => name === "ticket" ? formatCurrency(v) : v} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar yAxisId="left" dataKey="ticket" name="Ticket Médio" fill="hsl(221, 83%, 53%)" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="clientes" name="Clientes" fill="hsl(142, 76%, 36%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
