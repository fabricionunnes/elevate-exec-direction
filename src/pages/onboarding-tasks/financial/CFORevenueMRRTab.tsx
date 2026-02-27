import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell, Area, AreaChart
} from "recharts";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  companies: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFORevenueMRRTab({ invoices, companies, filters, formatCurrency, formatCurrencyCents }: Props) {
  const now = new Date();
  const refDate = filters.month !== "all"
    ? new Date(parseInt(filters.month.split("-")[0]), parseInt(filters.month.split("-")[1]) - 1, 1)
    : now;
  const monthStr = filters.month !== "all" ? filters.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthStr = (() => {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const mrrBreakdown = useMemo(() => {
    // Current MRR: recurring invoices this month
    const currentRecurring = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.recurring_charge_id);
    const mrrAtual = currentRecurring.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // Previous MRR
    const prevRecurring = invoices.filter(i => i.due_date?.startsWith(prevMonthStr) && i.recurring_charge_id);
    const mrrAnterior = prevRecurring.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // New MRR: companies with recurring invoices this month but not last month
    const currentCompanies = new Set(currentRecurring.map(i => i.company_id));
    const prevCompanies = new Set(prevRecurring.map(i => i.company_id));

    const newCompanies = [...currentCompanies].filter(id => !prevCompanies.has(id));
    const novoMrr = currentRecurring.filter(i => newCompanies.includes(i.company_id))
      .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // Churn MRR: companies that left
    const churnedCompanies = [...prevCompanies].filter(id => !currentCompanies.has(id));
    const mrrChurn = prevRecurring.filter(i => churnedCompanies.includes(i.company_id))
      .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // Expansion/Contraction for continuing companies
    const continuingCompanies = [...currentCompanies].filter(id => prevCompanies.has(id));
    let expansion = 0;
    let contraction = 0;
    continuingCompanies.forEach(compId => {
      const curVal = currentRecurring.filter(i => i.company_id === compId).reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const prevVal = prevRecurring.filter(i => i.company_id === compId).reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const diff = curVal - prevVal;
      if (diff > 0) expansion += diff;
      if (diff < 0) contraction += Math.abs(diff);
    });

    const netNewMrr = novoMrr + expansion - contraction - mrrChurn;

    return { mrrAtual, mrrAnterior, novoMrr, expansion, contraction, mrrChurn, netNewMrr };
  }, [invoices, monthStr, prevMonthStr]);

  // Ticket Médio
  const ticketMedio = useMemo(() => {
    const paidInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.status === "paid");
    const companiesWithPayment = new Set(paidInvoices.map(i => i.company_id));
    const totalRevenue = paidInvoices.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    const geral = companiesWithPayment.size > 0 ? totalRevenue / companiesWithPayment.size : 0;
    return { geral, clientCount: companiesWithPayment.size };
  }, [invoices, monthStr]);

  // MRR trend (6 months)
  const mrrTrend = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      const recurring = invoices.filter(inv => inv.due_date?.startsWith(key) && inv.recurring_charge_id)
        .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0) / 100;
      const nonRecurring = invoices.filter(inv => inv.due_date?.startsWith(key) && !inv.recurring_charge_id && inv.status === "paid")
        .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100;

      months.push({ label, mrr: recurring, naoRecorrente: nonRecurring, total: recurring + nonRecurring });
    }
    return months;
  }, [invoices]);

  const breakdownCards = [
    { label: "MRR Atual", value: mrrBreakdown.mrrAtual, color: "text-blue-600", icon: DollarSign },
    { label: "Novo MRR", value: mrrBreakdown.novoMrr, color: "text-emerald-600", icon: ArrowUpRight },
    { label: "MRR Expansão", value: mrrBreakdown.expansion, color: "text-green-600", icon: TrendingUp },
    { label: "MRR Contração", value: mrrBreakdown.contraction, color: "text-amber-600", icon: TrendingDown, negative: true },
    { label: "MRR Churn", value: mrrBreakdown.mrrChurn, color: "text-destructive", icon: ArrowDownRight, negative: true },
    { label: "Net New MRR", value: mrrBreakdown.netNewMrr, color: mrrBreakdown.netNewMrr >= 0 ? "text-emerald-600" : "text-destructive", icon: TrendingUp },
  ];

  const breakdownPie = [
    { name: "Novo MRR", value: mrrBreakdown.novoMrr / 100, color: "hsl(142, 76%, 36%)" },
    { name: "Expansão", value: mrrBreakdown.expansion / 100, color: "hsl(160, 60%, 45%)" },
    { name: "Contração", value: mrrBreakdown.contraction / 100, color: "hsl(38, 92%, 50%)" },
    { name: "Churn", value: mrrBreakdown.mrrChurn / 100, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Receita & MRR</h2>

      {/* MRR Breakdown Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {breakdownCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${card.color}`} />
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
                <p className={`text-lg font-bold ${card.color}`}>
                  {card.negative ? "-" : ""}{formatCurrencyCents(card.value)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ticket Médio */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-muted-foreground">Ticket Médio Geral</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{formatCurrencyCents(ticketMedio.geral)}</p>
            <p className="text-xs text-muted-foreground mt-1">{ticketMedio.clientCount} clientes pagantes no mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-1">MRR vs Mês Anterior</p>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">{formatCurrencyCents(mrrBreakdown.mrrAtual)}</p>
              {mrrBreakdown.mrrAnterior > 0 && (
                <Badge variant={mrrBreakdown.mrrAtual >= mrrBreakdown.mrrAnterior ? "default" : "destructive"}>
                  {mrrBreakdown.mrrAtual >= mrrBreakdown.mrrAnterior ? "+" : ""}
                  {(((mrrBreakdown.mrrAtual - mrrBreakdown.mrrAnterior) / mrrBreakdown.mrrAnterior) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Anterior: {formatCurrencyCents(mrrBreakdown.mrrAnterior)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução MRR (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mrrTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%, 0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="naoRecorrente" name="Não Recorrente" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%, 0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">MRR Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={breakdownPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {breakdownPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de movimentação MRR</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
