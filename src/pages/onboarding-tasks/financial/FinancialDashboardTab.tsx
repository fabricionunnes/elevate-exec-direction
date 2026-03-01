import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Wallet, ShieldAlert, ShoppingCart, RefreshCw,
  CalendarIcon, ChevronLeft, ChevronRight, Banknote, CreditCard, PiggyBank,
  BarChart3, Activity
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
  hasPerm?: (key: string) => boolean;
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

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Gradient card wrapper component
const GradientCard = ({ 
  children, 
  gradient, 
  className = "" 
}: { 
  children: React.ReactNode; 
  gradient: string; 
  className?: string;
}) => (
  <div className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-xl shadow-lg ${className}`}
    style={{ background: gradient }}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    <div className="relative">{children}</div>
  </div>
);

export default function FinancialDashboardTab({ invoices, payables, banks, charges = [], formatCurrency, formatCurrencyCents, hasPerm }: Props) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  
  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  
  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
    else setSelectedMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
    else setSelectedMonth(m => m + 1);
  };
  const goToCurrentMonth = () => { setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth()); };

  // Summary cards
  const summary = useMemo(() => {
    const monthInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr));
    const monthPayables = payables.filter(p => p.due_date?.startsWith(monthStr) || p.reference_month === monthStr);

    const receitaRecebida = monthInvoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0);
    const receitaPendente = monthInvoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + i.amount_cents, 0);
    const despesaPaga = monthPayables.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    const despesaPendente = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled").reduce((s: number, p: any) => s + (p.amount || 0) * 100, 0);
    const totalBancos = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0);
    const resultado = receitaRecebida - despesaPaga;

    return { receitaRecebida, receitaPendente, despesaPaga, despesaPendente, totalBancos, resultado };
  }, [invoices, payables, banks, monthStr]);

  // Inadimplência mensal
  const inadimplencia = useMemo(() => {
    const monthInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr));
    const total = monthInvoices.length;
    const totalValue = monthInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    
    // Sempre usar a data de HOJE como referência — só é inadimplente o que já venceu de fato
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const overdue = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date < todayStr);
    const overdueCount = overdue.length;
    const overdueValue = overdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // Base para % = apenas faturas já vencidas (due_date < hoje), não o total do mês inteiro
    const alreadyDue = monthInvoices.filter(i => i.due_date < todayStr && i.status !== "cancelled");
    const alreadyDueValue = alreadyDue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const alreadyDueCount = alreadyDue.length;

    const pctQty = alreadyDueCount > 0 ? (overdueCount / alreadyDueCount) * 100 : 0;
    const pctValue = alreadyDueValue > 0 ? (overdueValue / alreadyDueValue) * 100 : 0;

    return { pctQty, pctValue, overdueCount, total: alreadyDueCount, overdueValue, totalValue: alreadyDueValue };
  }, [invoices, monthStr]);

  // Total em atraso geral (todas as faturas, sem filtro de mês)
  const totalOverdueGeral = useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const allOverdue = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date && i.due_date < todayStr);
    return {
      count: allOverdue.length,
      value: allOverdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0),
    };
  }, [invoices]);

  // MRR
  const mrr = useMemo(() => {
    const activeCharges = charges.filter(c => c.is_active);
    return activeCharges.reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
  }, [charges]);

  // Ticket Médio das recorrências
  const ticketMedio = useMemo(() => {
    const activeCharges = charges.filter(c => c.is_active);
    if (activeCharges.length === 0) return 0;
    return mrr / activeCharges.length;
  }, [charges, mrr]);

  // MRR Movement
  const mrrMovement = useMemo(() => {
    const added = charges
      .filter(c => c.is_active && c.created_at?.startsWith(monthStr))
      .reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
    const addedCount = charges.filter(c => c.is_active && c.created_at?.startsWith(monthStr)).length;

    const lost = charges
      .filter(c => !c.is_active && c.updated_at?.startsWith(monthStr))
      .reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
    const lostCount = charges.filter(c => !c.is_active && c.updated_at?.startsWith(monthStr)).length;

    return { added, addedCount, lost, lostCount, net: added - lost };
  }, [charges, monthStr]);

  // Vendas Novas
  const vendasNovas = useMemo(() => {
    const novas = invoices.filter(i => !i.recurring_charge_id && i.created_at?.startsWith(monthStr));
    const count = novas.length;
    const value = novas.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    return { count, value };
  }, [invoices, monthStr]);

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const months: { month: string; label: string; receita: number; despesa: number; resultado: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
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
  }, [invoices, payables, selectedYear, selectedMonth]);

  // Status distribution
  const statusData = useMemo(() => {
    const monthInv = invoices.filter(i => i.due_date?.startsWith(monthStr));
    const paid = monthInv.filter(i => i.status === "paid").length;
    const pending = monthInv.filter(i => i.status === "pending").length;
    const overdue = monthInv.filter(i => i.status === "overdue").length;
    return [
      { name: "Recebido", value: paid, color: "#10b981" },
      { name: "Pendente", value: pending, color: "#f59e0b" },
      { name: "Vencido", value: overdue, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [invoices, monthStr]);

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  const inadimplenciaColor = (pct: number) =>
    pct > 10 ? "#ef4444" : pct > 5 ? "#f59e0b" : "#10b981";

  return (
    <div className="space-y-6">
      {/* Month Picker — modern glass bar */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Período:</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[110px] h-8 text-sm rounded-lg border-border/50 bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_LABELS.map((label, i) => (
              <SelectItem key={i} value={String(i)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[90px] h-8 text-sm rounded-lg border-border/50 bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentMonth && (
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/10" onClick={goToCurrentMonth}>
            Mês atual
          </Button>
        )}
        <div className="ml-auto px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
          {MONTH_LABELS[selectedMonth]} {selectedYear}
        </div>
      </div>

      {/* Summary Cards — Vibrant gradients */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <GradientCard gradient="linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(6,95,70,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Receita Recebida</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{formatCurrencyCents(summary.receitaRecebida)}</div>
            <p className="text-[11px] text-emerald-400/70 mt-1">Recebido no mês</p>
          </div>
        </GradientCard>

        <GradientCard gradient="linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(67,56,202,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">A Receber</span>
            </div>
            <div className="text-2xl font-bold text-indigo-400">{formatCurrencyCents(summary.receitaPendente)}</div>
            <p className="text-[11px] text-indigo-400/70 mt-1">Pendente no mês</p>
          </div>
        </GradientCard>

        <GradientCard gradient="linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(153,27,27,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <ArrowDownRight className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Despesas Pagas</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{formatCurrencyCents(summary.despesaPaga)}</div>
            <p className="text-[11px] text-red-400/70 mt-1">Pago no mês</p>
          </div>
        </GradientCard>

        <GradientCard gradient="linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(146,64,14,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Banknote className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">A Pagar</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{formatCurrencyCents(summary.despesaPendente)}</div>
            <p className="text-[11px] text-amber-400/70 mt-1">Pendente no mês</p>
          </div>
        </GradientCard>

        <GradientCard gradient={`linear-gradient(135deg, ${summary.resultado >= 0 ? "rgba(16,185,129,0.18) 0%, rgba(6,95,70,0.1)" : "rgba(239,68,68,0.18) 0%, rgba(153,27,27,0.1)"} 100%)`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${summary.resultado >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                <Activity className={`h-4 w-4 ${summary.resultado >= 0 ? "text-emerald-400" : "text-red-400"}`} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Resultado</span>
            </div>
            <div className={`text-2xl font-bold ${summary.resultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrencyCents(summary.resultado)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Receita − Despesa</p>
          </div>
        </GradientCard>

        <GradientCard gradient="linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(91,33,182,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-violet-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Saldo Bancário</span>
            </div>
            <div className="text-2xl font-bold text-violet-400">{formatCurrencyCents(summary.totalBancos)}</div>
            <p className="text-[11px] text-violet-400/70 mt-1">{banks.length} conta(s)</p>
          </div>
        </GradientCard>
      </div>

      {/* Cards de Atraso */}
      <div className="grid gap-4 md:grid-cols-2">
        <GradientCard gradient="linear-gradient(135deg, rgba(251,146,60,0.18) 0%, rgba(194,65,12,0.1) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Em Atraso no Período</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{formatCurrencyCents(inadimplencia.overdueValue)}</div>
            <p className="text-[11px] text-orange-400/70 mt-1">{inadimplencia.overdueCount} fatura(s) vencida(s) em {MONTH_LABELS[selectedMonth]}/{selectedYear}</p>
          </div>
        </GradientCard>

        <GradientCard gradient="linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(153,27,27,0.1) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total em Atraso (Geral)</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{formatCurrencyCents(totalOverdueGeral.value)}</div>
            <p className="text-[11px] text-red-400/70 mt-1">{totalOverdueGeral.count} fatura(s) vencida(s) no total</p>
          </div>
        </GradientCard>
      </div>

      {/* Inadimplência + MRR + Movimentação + Vendas */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {/* Inadimplência */}
        <GradientCard gradient="linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(153,27,27,0.06) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Inadimplência Mensal</span>
            </div>
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-2xl font-bold" style={{ color: inadimplenciaColor(inadimplencia.pctQty) }}>
                  {inadimplencia.pctQty.toFixed(1)}%
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">por qtd</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-2xl font-bold" style={{ color: inadimplenciaColor(inadimplencia.pctValue) }}>
                  {inadimplencia.pctValue.toFixed(1)}%
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">por valor</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
              {inadimplencia.overdueCount}/{inadimplencia.total} faturas • {formatCurrencyCents(inadimplencia.overdueValue)} de {formatCurrencyCents(inadimplencia.totalValue)}
            </p>
          </div>
        </GradientCard>

        {/* MRR */}
        <GradientCard gradient="linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(29,78,216,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">MRR Atual</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{formatCurrencyCents(mrr)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {charges.filter(c => c.is_active).length} recorrência(s) ativa(s)
            </p>
            <div className="mt-2 px-2 py-1 rounded-md bg-blue-500/10 inline-block">
              <span className="text-[11px] font-medium text-blue-400">ARR: {formatCurrencyCents(mrr * 12)}</span>
            </div>
          </div>
        </GradientCard>

        {/* MRR Acrescentado */}
        <GradientCard gradient="linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(6,95,70,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">MRR Acrescentado</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">+{formatCurrencyCents(mrrMovement.added)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{mrrMovement.addedCount} nova(s) recorrência(s)</p>
          </div>
        </GradientCard>

        {/* MRR Perdido */}
        <GradientCard gradient="linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(153,27,27,0.06) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <ArrowDownRight className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">MRR Perdido</span>
            </div>
            <div className="text-2xl font-bold text-red-400">-{formatCurrencyCents(mrrMovement.lost)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{mrrMovement.lostCount} encerrada(s)</p>
            {mrrMovement.net !== 0 && (
              <div className={`mt-2 px-2 py-1 rounded-md inline-block ${mrrMovement.net >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <span className={`text-[11px] font-medium ${mrrMovement.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  Líquido: {mrrMovement.net >= 0 ? "+" : ""}{formatCurrencyCents(mrrMovement.net)}
                </span>
              </div>
            )}
          </div>
        </GradientCard>

        {/* Ticket Médio */}
        <GradientCard gradient="linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(126,34,206,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Ticket Médio</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{formatCurrencyCents(ticketMedio)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {charges.filter(c => c.is_active).length} recorrência(s) ativa(s)
            </p>
          </div>
        </GradientCard>

        {/* Vendas Novas */}
        <GradientCard gradient="linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(146,64,14,0.08) 100%)">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Vendas Novas</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{formatCurrencyCents(vendasNovas.value)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{vendasNovas.count} fatura(s) avulsa(s)</p>
          </div>
        </GradientCard>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GradientCard gradient="linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.03) 100%)" className="lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-foreground">Receitas vs Despesas (6 meses)</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ 
                    background: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
                  }}
                />
                <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GradientCard>

        <GradientCard gradient="linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(239,68,68,0.03) 100%)">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">Status dos Recebíveis</h3>
            </div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie 
                    data={statusData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={65} 
                    outerRadius={105} 
                    dataKey="value" 
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px" 
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </div>
        </GradientCard>
      </div>

      {/* Resultado mensal */}
      <GradientCard gradient="linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(16,185,129,0.03) 100%)">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-foreground">Resultado Mensal</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gradientResultado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  background: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
                }}
              />
              <Area type="monotone" dataKey="resultado" name="Resultado" stroke="#3b82f6" fill="url(#gradientResultado)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GradientCard>

      {/* Banks Overview */}
      {banks.length > 0 && (!hasPerm || hasPerm("fin_bank_balances")) && (
        <GradientCard gradient="linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.03) 100%)">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-foreground">Saldos por Conta</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {banks.map((bank: any) => (
                <div key={bank.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{bank.name}</p>
                    <p className="text-lg font-bold text-violet-400">{formatCurrencyCents(bank.current_balance_cents)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GradientCard>
      )}
    </div>
  );
}
