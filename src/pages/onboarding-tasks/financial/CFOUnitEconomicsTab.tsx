import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, DollarSign, TrendingUp, Clock, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  payables: any[];
  companies: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFOUnitEconomicsTab({ invoices, payables, companies, filters, formatCurrency, formatCurrencyCents }: Props) {
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
    const isMRR = (i: any) => (i.total_installments || 1) > 1;
    const recurringInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr) && isMRR(i));
    const mrr = recurringInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const activeCompanies = new Set(recurringInvoices.map(i => i.company_id));
    const ticketMedio = activeCompanies.size > 0 ? mrr / activeCompanies.size : 0;
    let totalChurn = 0;
    let churnMonths = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const prevD = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;
      const cur = new Set(invoices.filter(inv => inv.due_date?.startsWith(key) && isMRR(inv)).map(i => i.company_id));
      const prev = new Set(invoices.filter(inv => inv.due_date?.startsWith(prevKey) && isMRR(inv)).map(i => i.company_id));
      // Only count churn for companies that cancelled (not natural contract end)
      const churned = [...prev].filter(id => {
        if (cur.has(id)) return false;
        const lastInv = invoices.filter(inv => inv.company_id === id && inv.due_date?.startsWith(prevKey) && isMRR(inv))
          .sort((a: any, b: any) => (a.installment_number || 0) - (b.installment_number || 0)).pop();
        if (lastInv && lastInv.installment_number >= lastInv.total_installments) return false;
        return true;
      });
      if (prev.size > 0) { totalChurn += churned.length / prev.size; churnMonths++; }
    }
    const avgChurnRate = churnMonths > 0 ? totalChurn / churnMonths : 0;
    const lifetimeMedio = avgChurnRate > 0 ? 1 / avgChurnRate : 0;
    const ltv = (ticketMedio / 100) * lifetimeMedio;
    const totalCacCost = cacCosts.reduce((s, c) => s + (c.value || 0), 0);
    const newCompanies = [...activeCompanies].filter(id => {
      const hasPrev = invoices.some(inv => inv.company_id === id && isMRR(inv) && inv.due_date < monthStr);
      return !hasPrev;
    });
    const cac = newCompanies.length > 0 ? totalCacCost / newCompanies.length : 0;
    const ltvCac = cac > 0 ? ltv / cac : 0;
    const margemContribuicao = ticketMedio > 0 ? (ticketMedio / 100) * 0.7 : 0;
    const payback = margemContribuicao > 0 ? cac / margemContribuicao : 0;
    const receitaMensal = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    const despesasMes = payables.filter(p => (p.due_date?.startsWith(monthStr) || p.reference_month === monthStr) && p.status === "paid")
      .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    const margemContribuicaoReal = receitaMensal - despesasMes;
    return {
      ticketMedio, mrr, ltv, cac, ltvCac, payback, lifetimeMedio,
      activeCount: activeCompanies.size, newCount: newCompanies.length,
      margemContribuicao: margemContribuicaoReal, receitaMensal
    };
  }, [invoices, payables, cacCosts, monthStr]);

  const ltvCacStyle = metrics.ltvCac < 2
    ? { bg: "from-red-500/20 via-red-500/5 to-transparent", border: "border-red-500/30", text: "text-red-400", badge: "⚠️ Abaixo do ideal", badgeBg: "bg-red-500/15 text-red-400 border-red-500/30" }
    : metrics.ltvCac < 3
    ? { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/30", text: "text-amber-400", badge: "🟡 Aceitável", badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    : { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/30", text: "text-emerald-400", badge: "✅ Saudável", badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };

  const trendData = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const isMRRTrend = (inv: any) => (inv.total_installments || 1) > 1;
      const recurring = invoices.filter(inv => inv.due_date?.startsWith(key) && isMRRTrend(inv));
      const companies = new Set(recurring.map(i => i.company_id));
      const mrr = recurring.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const ticket = companies.size > 0 ? mrr / companies.size / 100 : 0;
      months.push({ label, ticket, clientes: companies.size });
    }
    return months;
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
          Unit Economics
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Indicadores de eficiência e retorno por cliente</p>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={`relative overflow-hidden border ${ltvCacStyle.border} bg-gradient-to-br ${ltvCacStyle.bg} backdrop-blur-xl shadow-lg`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          <CardContent className="pt-5 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg bg-white/5 ${ltvCacStyle.text}`}>
                <Target className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">LTV/CAC</p>
            </div>
            <p className={`text-4xl font-bold ${ltvCacStyle.text}`}>
              {metrics.ltvCac > 0 ? `${metrics.ltvCac.toFixed(1)}x` : "—"}
            </p>
            <Badge variant="outline" className={`mt-2 ${ltvCacStyle.badgeBg}`}>
              {ltvCacStyle.badge}
            </Badge>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 via-cyan-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-cyan-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          <CardContent className="pt-5 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/5 text-cyan-500">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">CAC</p>
            </div>
            <p className="text-4xl font-bold text-cyan-400">
              {metrics.cac > 0 ? formatCurrency(metrics.cac) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">{metrics.newCount} novos clientes no mês</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-emerald-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          <CardContent className="pt-5 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/5 text-emerald-500">
                <TrendingUp className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">LTV</p>
            </div>
            <p className="text-4xl font-bold text-emerald-400">
              {metrics.ltv > 0 ? formatCurrency(metrics.ltv) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">Lifetime: {metrics.lifetimeMedio.toFixed(1)} meses</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-500/20 via-violet-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-violet-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          <CardContent className="pt-5 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/5 text-violet-500">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Payback</p>
            </div>
            <p className="text-4xl font-bold text-violet-400">
              {metrics.payback > 0 ? `${metrics.payback.toFixed(1)} meses` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-blue-500/5">
          <CardContent className="pt-5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Ticket Médio</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrencyCents(metrics.ticketMedio)}</p>
            <p className="text-xs text-muted-foreground mt-1">{metrics.activeCount} clientes ativos</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-emerald-500/5">
          <CardContent className="pt-5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Margem de Contribuição</p>
            <p className={`text-2xl font-bold mt-1 ${metrics.margemContribuicao >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrencyCents(metrics.margemContribuicao)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Receita - Custos Variáveis</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/10 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-indigo-500/5">
          <CardContent className="pt-5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">MRR</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{formatCurrencyCents(metrics.mrr)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Trend */}
      <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Ticket Médio & Base de Clientes (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number, name: string) => name === "ticket" ? formatCurrency(v) : v} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend />
              <Bar yAxisId="left" dataKey="ticket" name="Ticket Médio" fill="hsl(221, 83%, 53%)" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="clientes" name="Clientes" fill="hsl(160, 84%, 39%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
