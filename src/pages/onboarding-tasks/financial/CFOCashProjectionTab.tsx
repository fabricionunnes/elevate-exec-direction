import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, TrendingDown, Clock, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, ReferenceLine, BarChart, Bar
} from "recharts";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

const summaryStyles = [
  { bg: "from-cyan-500/20 via-cyan-500/5 to-transparent", border: "border-cyan-500/20", text: "text-cyan-400", glow: "shadow-cyan-500/10", icon: Wallet },
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10", icon: TrendingUp },
  { bg: "from-rose-500/20 via-rose-500/5 to-transparent", border: "border-rose-500/20", text: "text-rose-400", glow: "shadow-rose-500/10", icon: TrendingDown },
  { bg: "from-blue-500/20 via-blue-500/5 to-transparent", border: "border-blue-500/20", text: "text-blue-400", glow: "shadow-blue-500/10", icon: ArrowDownToLine },
  { bg: "from-orange-500/20 via-orange-500/5 to-transparent", border: "border-orange-500/20", text: "text-orange-400", glow: "shadow-orange-500/10", icon: ArrowUpFromLine },
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10", icon: Clock },
];

export default function CFOCashProjectionTab({ invoices, payables, banks, filters, formatCurrency, formatCurrencyCents }: Props) {
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

  const summaryCards = [
    { label: "Caixa Atual", value: formatCurrencyCents(cashFlow.caixaAtual) },
    { label: "Entradas (Mês)", value: formatCurrencyCents(cashFlow.entradasMes) },
    { label: "Saídas (Mês)", value: formatCurrencyCents(cashFlow.saidasMes) },
    { label: "A Receber", value: formatCurrencyCents(cashFlow.entradasPrevistas) },
    { label: "A Pagar", value: formatCurrencyCents(cashFlow.saidasPrevistas) },
    { label: "Runway", value: cashFlow.runway >= 999 ? "∞" : `${cashFlow.runway.toFixed(1)} meses` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Caixa & Projeção
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Fluxo de caixa atual e projeção de 12 meses</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map((card, idx) => {
          const s = summaryStyles[idx];
          const Icon = s.icon;
          const isRunway = idx === 5;
          const runwayDanger = isRunway && cashFlow.runway < 6;
          return (
            <Card key={idx} className={`relative overflow-hidden border ${runwayDanger ? "border-red-500/30" : s.border} bg-gradient-to-br ${runwayDanger ? "from-red-500/20 via-red-500/5 to-transparent" : s.bg} backdrop-blur-xl shadow-lg ${runwayDanger ? "shadow-red-500/10" : s.glow} hover:scale-[1.02] transition-all duration-300`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <CardContent className="pt-4 pb-3 relative">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded-lg bg-white/5 ${runwayDanger ? "text-red-500" : s.text}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${runwayDanger ? "text-red-400" : s.text}`}>{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Projection Chart */}
      <Card className="border-cyan-500/10 bg-gradient-to-br from-cyan-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-cyan-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            Projeção de Caixa (12 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={projection}>
              <defs>
                <linearGradient id="cashInGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cashOutGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(350, 89%, 60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(350, 89%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(160, 84%, 39%)" fill="url(#cashInGrad)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(350, 89%, 60%)" fill="url(#cashOutGrad)" strokeWidth={2.5} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground) / 0.3)" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cash Flow Bar */}
      <Card className="border-indigo-500/10 bg-gradient-to-br from-indigo-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-indigo-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            Saldo Acumulado Projetado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={projection.filter((_, i) => i >= 3)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Bar dataKey="saldo" name="Saldo Projetado" fill="hsl(221, 83%, 53%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
