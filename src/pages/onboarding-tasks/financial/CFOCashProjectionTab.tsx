import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, TrendingDown, Clock, AlertTriangle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, ReferenceLine, BarChart, Bar
} from "recharts";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFOCashProjectionTab({ invoices, payables, banks, formatCurrency, formatCurrencyCents }: Props) {
  const now = new Date();

  const cashFlow = useMemo(() => {
    const caixaAtual = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0);

    // Avg monthly entries/exits (last 3 months)
    let totalEntradas = 0, totalSaidas = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      totalEntradas += invoices.filter(inv => inv.due_date?.startsWith(key) && inv.status === "paid")
        .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
      totalSaidas += payables.filter((p: any) => (p.due_date?.startsWith(key) || p.reference_month === key) && p.status === "paid")
        .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    }
    const avgEntradas = totalEntradas / 3;
    const avgSaidas = totalSaidas / 3;

    // Current month actuals
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const entradasMes = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    const saidasMes = payables.filter((p: any) => (p.due_date?.startsWith(monthStr) || p.reference_month === monthStr) && p.status === "paid")
      .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);

    // Pending entries/exits
    const entradasPrevistas = invoices.filter(i => i.due_date?.startsWith(monthStr) && (i.status === "pending" || i.status === "overdue"))
      .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const saidasPrevistas = payables.filter((p: any) => (p.due_date?.startsWith(monthStr) || p.reference_month === monthStr) && p.status !== "paid" && p.status !== "cancelled")
      .reduce((s: number, p: any) => s + (p.amount || 0) * 100, 0);

    const burnRate = avgSaidas;
    const runway = burnRate > 0 ? caixaAtual / burnRate : 999;
    const caixaFinal = caixaAtual + entradasPrevistas - saidasPrevistas;

    return {
      caixaAtual, entradasMes, saidasMes, entradasPrevistas, saidasPrevistas,
      avgEntradas, avgSaidas, burnRate, runway, caixaFinal
    };
  }, [invoices, payables, banks]);

  // 12 month projection
  const projection = useMemo(() => {
    const months: any[] = [];
    let saldo = cashFlow.caixaAtual;

    // Past 3 months (actuals)
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      const entradas = invoices.filter(inv => inv.due_date?.startsWith(key) && inv.status === "paid")
        .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100;
      const saidas = payables.filter((p: any) => (p.due_date?.startsWith(key) || p.reference_month === key) && p.status === "paid")
        .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);

      months.push({ label, entradas, saidas, saldo: (entradas - saidas), tipo: "Realizado" });
    }

    // Future 12 months (projected)
    // Growth rate estimate
    const growthRate = 1.03; // 3% monthly growth estimate
    let projectedEntry = cashFlow.avgEntradas / 100;
    let projectedExit = cashFlow.avgSaidas / 100;

    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      projectedEntry *= growthRate;
      projectedExit *= 1.02; // 2% cost growth

      saldo += (projectedEntry - projectedExit) * 100;
      months.push({
        label, entradas: projectedEntry, saidas: projectedExit,
        saldo: saldo / 100, tipo: "Projetado"
      });
    }
    return months;
  }, [invoices, payables, cashFlow]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Caixa & Projeção</h2>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-blue-600" /></div>
            <p className="text-xs text-muted-foreground">Caixa Atual</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrencyCents(cashFlow.caixaAtual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
            <p className="text-xs text-muted-foreground">Entradas (Mês)</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrencyCents(cashFlow.entradasMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-destructive" /></div>
            <p className="text-xs text-muted-foreground">Saídas (Mês)</p>
            <p className="text-xl font-bold text-destructive">{formatCurrencyCents(cashFlow.saidasMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">A Receber</p>
            <p className="text-xl font-bold">{formatCurrencyCents(cashFlow.entradasPrevistas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">A Pagar</p>
            <p className="text-xl font-bold">{formatCurrencyCents(cashFlow.saidasPrevistas)}</p>
          </CardContent>
        </Card>
        <Card className={cashFlow.runway < 6 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`h-4 w-4 ${cashFlow.runway < 6 ? "text-destructive" : "text-emerald-600"}`} />
            </div>
            <p className="text-xs text-muted-foreground">Runway</p>
            <p className={`text-xl font-bold ${cashFlow.runway < 6 ? "text-destructive" : "text-emerald-600"}`}>
              {cashFlow.runway >= 999 ? "∞" : `${cashFlow.runway.toFixed(1)} meses`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projection Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Projeção de Caixa (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={projection}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%, 0.1)" strokeWidth={2} />
              <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.1)" strokeWidth={2} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cash Flow Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Saldo Acumulado Projetado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={projection.filter((_, i) => i >= 3)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="saldo" name="Saldo Projetado" fill="hsl(221, 83%, 53%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
