import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Wallet, ShieldAlert, ShoppingCart, RefreshCw
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line, Area, AreaChart 
} from "recharts";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  charges?: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

const toMonthlyMRR = (amountCents: number, recurrence: string): number => {
  switch (recurrence) {
    case "monthly": return amountCents;
    case "quarterly": return amountCents / 3;
    case "semiannual": return amountCents / 6;
    case "annual": return amountCents / 12;
    default: return amountCents;
  }
};

export default function FinancialDashboardTab({ invoices, payables, banks, charges = [], formatCurrency, formatCurrencyCents }: Props) {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentYear = new Date().getFullYear();

  // Summary cards
  const summary = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const monthInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr));
    const monthPayables = payables.filter(p => p.due_date?.startsWith(monthStr) || p.reference_month === monthStr);

    const receitaRecebida = monthInvoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0);
    const receitaPendente = monthInvoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + i.amount_cents, 0);
    const despesaPaga = monthPayables.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    const despesaPendente = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled").reduce((s: number, p: any) => s + (p.amount || 0) * 100, 0);
    const totalBancos = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0);
    const resultado = receitaRecebida - despesaPaga;

    return { receitaRecebida, receitaPendente, despesaPaga, despesaPendente, totalBancos, resultado };
  }, [invoices, payables, banks]);

  // Inadimplência mensal
  const inadimplencia = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr));
    const total = monthInvoices.length;
    const totalValue = monthInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const overdue = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date < todayStr);
    const overdueCount = overdue.length;
    const overdueValue = overdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    const pctQty = total > 0 ? (overdueCount / total) * 100 : 0;
    const pctValue = totalValue > 0 ? (overdueValue / totalValue) * 100 : 0;

    return { pctQty, pctValue, overdueCount, total, overdueValue, totalValue };
  }, [invoices]);

  // MRR (from active recurring charges)
  const mrr = useMemo(() => {
    const activeCharges = charges.filter(c => c.is_active);
    return activeCharges.reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
  }, [charges]);

  // MRR Movement (added vs lost this month)
  const mrrMovement = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    // MRR added: charges created this month and currently active
    const added = charges
      .filter(c => c.is_active && c.created_at?.startsWith(monthStr))
      .reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
    const addedCount = charges.filter(c => c.is_active && c.created_at?.startsWith(monthStr)).length;

    // MRR lost: charges deactivated this month (is_active=false, updated_at in current month)
    const lost = charges
      .filter(c => !c.is_active && c.updated_at?.startsWith(monthStr))
      .reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
    const lostCount = charges.filter(c => !c.is_active && c.updated_at?.startsWith(monthStr)).length;

    return { added, addedCount, lost, lostCount, net: added - lost };
  }, [charges]);

  // Vendas Novas (standalone invoices created this month)
  const vendasNovas = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const novas = invoices.filter(i => !i.recurring_charge_id && i.created_at?.startsWith(monthStr));
    const count = novas.length;
    const value = novas.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    return { count, value };
  }, [invoices]);

  // Monthly chart data (last 6 months)
  const monthlyData = useMemo(() => {
    const months: { month: string; label: string; receita: number; despesa: number; resultado: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      const rec = invoices
        .filter(inv => inv.due_date?.startsWith(key) && inv.status === "paid")
        .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0) / 100;

      const desp = payables
        .filter((p: any) => (p.due_date?.startsWith(key) || p.reference_month === key) && p.status === "paid")
        .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);

      months.push({ month: key, label, receita: rec, despesa: desp, resultado: rec - desp });
    }
    return months;
  }, [invoices, payables]);

  // Status distribution for receivables
  const statusData = useMemo(() => {
    const paid = invoices.filter(i => i.status === "paid").length;
    const pending = invoices.filter(i => i.status === "pending").length;
    const overdue = invoices.filter(i => i.status === "overdue").length;
    return [
      { name: "Recebido", value: paid, color: "hsl(var(--primary))" },
      { name: "Pendente", value: pending, color: "hsl(var(--muted-foreground))" },
      { name: "Vencido", value: overdue, color: "hsl(var(--destructive))" },
    ].filter(d => d.value > 0);
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Receita Recebida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600">{formatCurrencyCents(summary.receitaRecebida)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Mês atual
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">A Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrencyCents(summary.receitaPendente)}</div>
            <p className="text-xs text-muted-foreground">Pendente no mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Despesas Pagas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">{formatCurrencyCents(summary.despesaPaga)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <ArrowDownRight className="h-3 w-3 text-destructive" /> Mês atual
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">A Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrencyCents(summary.despesaPendente)}</div>
            <p className="text-xs text-muted-foreground">Pendente no mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${summary.resultado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrencyCents(summary.resultado)}
            </div>
            <p className="text-xs text-muted-foreground">Receita - Despesa</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Saldo Bancário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrencyCents(summary.totalBancos)}</div>
            <p className="text-xs text-muted-foreground">{banks.length} conta(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Inadimplência + MRR + Movimentação + Vendas Novas */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              Inadimplência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-4">
              <div>
                <div className={`text-2xl font-bold ${inadimplencia.pctQty > 10 ? "text-destructive" : inadimplencia.pctQty > 5 ? "text-amber-500" : "text-emerald-600"}`}>
                  {inadimplencia.pctQty.toFixed(1)}%
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">por qtd</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className={`text-2xl font-bold ${inadimplencia.pctValue > 10 ? "text-destructive" : inadimplencia.pctValue > 5 ? "text-amber-500" : "text-emerald-600"}`}>
                  {inadimplencia.pctValue.toFixed(1)}%
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">por valor</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {inadimplencia.overdueCount} de {inadimplencia.total} faturas • {formatCurrencyCents(inadimplencia.overdueValue)} de {formatCurrencyCents(inadimplencia.totalValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              MRR Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyCents(mrr)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {charges.filter(c => c.is_active).length} recorrência(s) ativa(s)
            </p>
            <p className="text-xs text-muted-foreground">
              ARR: {formatCurrencyCents(mrr * 12)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              MRR Acrescentado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">+{formatCurrencyCents(mrrMovement.added)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mrrMovement.addedCount} nova(s) recorrência(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
              MRR Perdido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">-{formatCurrencyCents(mrrMovement.lost)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mrrMovement.lostCount} recorrência(s) encerrada(s)
            </p>
            {mrrMovement.net !== 0 && (
              <p className={`text-xs font-medium mt-1 ${mrrMovement.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                Líquido: {mrrMovement.net >= 0 ? "+" : ""}{formatCurrencyCents(mrrMovement.net)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />
              Vendas Novas (Avulsas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyCents(vendasNovas.value)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {vendasNovas.count} fatura(s) avulsa(s) no mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Receitas vs Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="receita" name="Receita" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Status dos Recebíveis</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resultado mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Resultado Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Area type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Banks Overview */}
      {banks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Saldos por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {banks.map((bank: any) => (
                <div key={bank.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{bank.name}</p>
                    <p className="text-lg font-bold">{formatCurrencyCents(bank.current_balance_cents)}</p>
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
