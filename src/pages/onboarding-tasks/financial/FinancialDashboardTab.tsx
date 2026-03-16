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
  BarChart3, Activity, Building2, Clock, CalendarCheck, CalendarClock
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line, Area, AreaChart 
} from "recharts";
import { DashboardDetailDialog } from "./DashboardDetailDialog";
import { BankStatementDialog } from "@/components/financial/BankStatementDialog";

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
  className = "",
  onClick,
}: { 
  children: React.ReactNode; 
  gradient: string; 
  className?: string;
  onClick?: () => void;
}) => (
  <div 
    className={`relative overflow-hidden rounded-2xl border border-border/30 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${onClick ? "cursor-pointer" : ""} ${className}`}
    style={{ background: gradient }}
    onClick={onClick}
  >
    <div className="relative">{children}</div>
  </div>
);

// Section header component
const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-1">
    <Icon className="h-4 w-4 text-primary/60" />
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
  </div>
);

export default function FinancialDashboardTab({ invoices, payables, banks, charges = [], formatCurrency, formatCurrencyCents, hasPerm }: Props) {
  const canSeePayables = !hasPerm || hasPerm("fin_payables_view");
  const canSeeBanks = !hasPerm || hasPerm("fin_bank_balances");
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  
  // Dialog states
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; title: string; items: any[]; type: "receivable" | "payable" }>({
    open: false, title: "", items: [], type: "receivable"
  });
  const [bankStatementOpen, setBankStatementOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<any>(null);

  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  
  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
    else setSelectedMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
    else setSelectedMonth(m => m + 1);
  };
  const goToCurrentMonth = () => { setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth()); };

  // Filtered items for the month
  const monthInvoices = useMemo(() => invoices.filter(i => i.due_date?.startsWith(monthStr)), [invoices, monthStr]);
  const monthPayables = useMemo(() => payables.filter(p => p.due_date?.startsWith(monthStr) || p.reference_month === monthStr), [payables, monthStr]);

  // Breakdowns for receivables
  const receivableBreakdown = useMemo(() => {
    const overdue = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date < todayStr);
    const dueToday = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date === todayStr);
    const restOfMonth = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date > todayStr);
    return { overdue, dueToday, restOfMonth };
  }, [monthInvoices, todayStr]);

  // Breakdowns for payables
  const payableBreakdown = useMemo(() => {
    const overdue = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < todayStr);
    const dueToday = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date === todayStr);
    const restOfMonth = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date > todayStr);
    return { overdue, dueToday, restOfMonth };
  }, [monthPayables, todayStr]);

  // Summary cards
  const summary = useMemo(() => {
    const receitaRecebida = monthInvoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0);
    const receitaPendente = monthInvoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + i.amount_cents, 0);
    const despesaPaga = monthPayables.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    const despesaPendente = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled").reduce((s: number, p: any) => s + (p.amount || 0) * 100, 0);
    const totalBancos = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0);
    const resultado = receitaRecebida - despesaPaga;

    return { receitaRecebida, receitaPendente, despesaPaga, despesaPendente, totalBancos, resultado };
  }, [monthInvoices, monthPayables, banks]);

  // Inadimplência mensal
  const inadimplencia = useMemo(() => {
    const overdue = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date < todayStr);
    const overdueCount = overdue.length;
    const overdueValue = overdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    const alreadyDue = monthInvoices.filter(i => i.due_date < todayStr && i.status !== "cancelled");
    const alreadyDueValue = alreadyDue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const alreadyDueCount = alreadyDue.length;

    const pctQty = alreadyDueCount > 0 ? (overdueCount / alreadyDueCount) * 100 : 0;
    const pctValue = alreadyDueValue > 0 ? (overdueValue / alreadyDueValue) * 100 : 0;

    return { pctQty, pctValue, overdueCount, total: alreadyDueCount, overdueValue, totalValue: alreadyDueValue };
  }, [monthInvoices, todayStr]);

  // Total em atraso geral
  const totalOverdueGeral = useMemo(() => {
    const allOverdue = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date && i.due_date < todayStr);
    return {
      count: allOverdue.length,
      value: allOverdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0),
    };
  }, [invoices, todayStr]);

  // Contas a pagar em atraso no período
  const payablesOverduePeriod = useMemo(() => {
    const overdue = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < todayStr);
    return {
      count: overdue.length,
      value: overdue.reduce((s: number, p: any) => s + ((p.amount || 0) * 100), 0),
    };
  }, [monthPayables, todayStr]);

  // Total contas a pagar em atraso geral
  const payablesOverdueGeral = useMemo(() => {
    const allOverdue = payables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < todayStr);
    return {
      count: allOverdue.length,
      value: allOverdue.reduce((s: number, p: any) => s + ((p.amount || 0) * 100), 0),
    };
  }, [payables, todayStr]);

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

  // Monthly chart data - 12 months
  const monthlyData = useMemo(() => {
    const months: { month: string; label: string; receita: number; despesa: number; resultado: number }[] = [];

    for (let i = 11; i >= 0; i--) {
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
    const paid = monthInvoices.filter(i => i.status === "paid").length;
    const pending = monthInvoices.filter(i => i.status === "pending").length;
    const overdue = monthInvoices.filter(i => i.status === "overdue").length;
    return [
      { name: "Recebido", value: paid, color: "#10b981" },
      { name: "Pendente", value: pending, color: "#f59e0b" },
      { name: "Vencido", value: overdue, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [monthInvoices]);

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  const inadimplenciaColor = (pct: number) =>
    pct > 10 ? "#ef4444" : pct > 5 ? "#f59e0b" : "#10b981";

  const openDetail = (title: string, items: any[], type: "receivable" | "payable") => {
    setDetailDialog({ open: true, title, items, type });
  };

  const openBankStatement = (bank: any) => {
    // Map to the shape BankStatementDialog expects
    setSelectedBankAccount({
      id: bank.id,
      name: bank.name,
      bank_name: bank.bank_name || bank.name,
      account_type: bank.account_type || "checking",
      current_balance: (bank.current_balance_cents || 0) / 100,
      initial_balance: (bank.initial_balance_cents || 0) / 100,
      agency: bank.agency || null,
      account_number: bank.account_number || null,
    });
    setBankStatementOpen(true);
  };

  const sumCents = (items: any[]) => items.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const sumPayable = (items: any[]) => items.reduce((s: number, p: any) => s + ((p.amount || 0) * 100), 0);

  return (
    <div className="space-y-8">
      {/* Month Picker */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-2xl border border-border/40 bg-card/60">
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

      {/* ═══ RESUMO DO MÊS ═══ */}
      <div>
        <SectionHeader icon={Wallet} title="Resumo do Mês" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mt-3">
          <GradientCard gradient="linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Receita Recebida</span>
              </div>
              <div className="text-xl font-bold text-emerald-600">{formatCurrencyCents(summary.receitaRecebida)}</div>
              <p className="text-[11px] text-emerald-600/60">Recebido no mês</p>
            </div>
          </GradientCard>

          <GradientCard 
            gradient="linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)"
            onClick={() => openDetail(`A Receber — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled"), "receivable")}
          >
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">A Receber</span>
              </div>
              <div className="text-xl font-bold text-indigo-600">{formatCurrencyCents(summary.receitaPendente)}</div>
              <p className="text-[11px] text-indigo-600/60">Pendente no mês • Clique para ver</p>
            </div>
          </GradientCard>

          {canSeePayables && (
            <GradientCard gradient="linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)">
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Despesas Pagas</span>
                </div>
                <div className="text-xl font-bold text-red-600">{formatCurrencyCents(summary.despesaPaga)}</div>
                <p className="text-[11px] text-red-600/60">Pago no mês</p>
              </div>
            </GradientCard>
          )}

          {canSeePayables && (
            <GradientCard 
              gradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
              onClick={() => openDetail(`A Pagar — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled"), "payable")}
            >
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Banknote className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">A Pagar</span>
                </div>
                <div className="text-xl font-bold text-amber-600">{formatCurrencyCents(summary.despesaPendente)}</div>
                <p className="text-[11px] text-amber-600/60">Pendente no mês • Clique para ver</p>
              </div>
            </GradientCard>
          )}

          {canSeePayables && (
            <GradientCard gradient={summary.resultado >= 0 ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" : "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)"}>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${summary.resultado >= 0 ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                    <Activity className={`h-3.5 w-3.5 ${summary.resultado >= 0 ? "text-emerald-600" : "text-red-600"}`} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Resultado</span>
                </div>
                <div className={`text-xl font-bold ${summary.resultado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrencyCents(summary.resultado)}
                </div>
                <p className="text-[11px] text-muted-foreground">Receita − Despesa</p>
              </div>
            </GradientCard>
          )}

          {canSeeBanks && (
            <GradientCard gradient="linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)">
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <PiggyBank className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Saldo Bancário</span>
                </div>
                <div className="text-xl font-bold text-violet-600">{formatCurrencyCents(summary.totalBancos)}</div>
                <p className="text-[11px] text-violet-600/60">{banks.length} conta(s)</p>
              </div>
            </GradientCard>
          )}
        </div>
      </div>

      {/* ═══ DETALHAMENTO A RECEBER / A PAGAR ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* A Receber breakdown */}
        <div>
          <SectionHeader icon={ArrowDownRight} title="A Receber — Detalhamento" />
          <div className="grid gap-3 grid-cols-3 mt-3">
            <GradientCard 
              gradient="linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)"
              onClick={() => openDetail(`Vencidos — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, receivableBreakdown.overdue, "receivable")}
            >
              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-[11px] font-medium text-muted-foreground">Vencidos</span>
                </div>
                <div className="text-lg font-bold text-red-600">{formatCurrencyCents(sumCents(receivableBreakdown.overdue))}</div>
                <p className="text-[10px] text-red-600/60">{receivableBreakdown.overdue.length} fatura(s)</p>
              </div>
            </GradientCard>

            <GradientCard 
              gradient="linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)"
              onClick={() => openDetail(`Vencem Hoje — ${todayStr}`, receivableBreakdown.dueToday, "receivable")}
            >
              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-orange-600" />
                  <span className="text-[11px] font-medium text-muted-foreground">Vencem Hoje</span>
                </div>
                <div className="text-lg font-bold text-orange-600">{formatCurrencyCents(sumCents(receivableBreakdown.dueToday))}</div>
                <p className="text-[10px] text-orange-600/60">{receivableBreakdown.dueToday.length} fatura(s)</p>
              </div>
            </GradientCard>

            <GradientCard 
              gradient="linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)"
              onClick={() => openDetail(`Restante do Mês — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, receivableBreakdown.restOfMonth, "receivable")}
            >
              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-[11px] font-medium text-muted-foreground">Restante</span>
                </div>
                <div className="text-lg font-bold text-indigo-600">{formatCurrencyCents(sumCents(receivableBreakdown.restOfMonth))}</div>
                <p className="text-[10px] text-indigo-600/60">{receivableBreakdown.restOfMonth.length} fatura(s)</p>
              </div>
            </GradientCard>
          </div>
        </div>

        {/* A Pagar breakdown */}
        {canSeePayables && (
          <div>
            <SectionHeader icon={ArrowUpRight} title="A Pagar — Detalhamento" />
            <div className="grid gap-3 grid-cols-3 mt-3">
              <GradientCard 
                gradient="linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)"
                onClick={() => openDetail(`Pagáveis Vencidos — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, payableBreakdown.overdue, "payable")}
              >
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-[11px] font-medium text-muted-foreground">Vencidos</span>
                  </div>
                  <div className="text-lg font-bold text-red-600">{formatCurrencyCents(sumPayable(payableBreakdown.overdue))}</div>
                  <p className="text-[10px] text-red-600/60">{payableBreakdown.overdue.length} conta(s)</p>
                </div>
              </GradientCard>

              <GradientCard 
                gradient="linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)"
                onClick={() => openDetail(`Pagáveis Vencem Hoje — ${todayStr}`, payableBreakdown.dueToday, "payable")}
              >
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-orange-600" />
                    <span className="text-[11px] font-medium text-muted-foreground">Vencem Hoje</span>
                  </div>
                  <div className="text-lg font-bold text-orange-600">{formatCurrencyCents(sumPayable(payableBreakdown.dueToday))}</div>
                  <p className="text-[10px] text-orange-600/60">{payableBreakdown.dueToday.length} conta(s)</p>
                </div>
              </GradientCard>

              <GradientCard 
                gradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                onClick={() => openDetail(`Pagáveis Restante do Mês — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, payableBreakdown.restOfMonth, "payable")}
              >
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[11px] font-medium text-muted-foreground">Restante</span>
                  </div>
                  <div className="text-lg font-bold text-amber-600">{formatCurrencyCents(sumPayable(payableBreakdown.restOfMonth))}</div>
                  <p className="text-[10px] text-amber-600/60">{payableBreakdown.restOfMonth.length} conta(s)</p>
                </div>
              </GradientCard>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ATRASOS ═══ */}
      <div>
        <SectionHeader icon={AlertTriangle} title="Atrasos - Contas a Receber" />
        <div className="grid gap-3 md:grid-cols-3 mt-3">
          <GradientCard gradient={`linear-gradient(135deg, ${inadimplencia.pctValue > 10 ? '#fef2f2 0%, #fecaca' : inadimplencia.pctValue > 5 ? '#fffbeb 0%, #fef3c7' : '#ecfdf5 0%, #d1fae5'} 100%)`}>
            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${inadimplencia.pctValue > 10 ? 'bg-red-500/15' : inadimplencia.pctValue > 5 ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
                  <ShieldAlert className={`h-4 w-4 ${inadimplencia.pctValue > 10 ? 'text-red-600' : inadimplencia.pctValue > 5 ? 'text-amber-600' : 'text-emerald-600'}`} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Inadimplência do Período</span>
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <div className="text-2xl font-bold" style={{ color: inadimplenciaColor(inadimplencia.pctValue) }}>
                    {inadimplencia.pctValue.toFixed(1)}%
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">por valor</p>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: inadimplenciaColor(inadimplencia.pctQty) }}>
                    {inadimplencia.pctQty.toFixed(1)}%
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">por qtd</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{inadimplencia.overdueCount} de {inadimplencia.total} fatura(s) vencida(s) em {MONTH_LABELS[selectedMonth]}/{selectedYear}</p>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)">
            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Recebíveis em Atraso no Período</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrencyCents(inadimplencia.overdueValue)}</div>
              <p className="text-xs text-orange-600/60">{inadimplencia.overdueCount} fatura(s) vencida(s) em {MONTH_LABELS[selectedMonth]}/{selectedYear}</p>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)">
            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Recebíveis em Atraso (Geral)</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{formatCurrencyCents(totalOverdueGeral.value)}</div>
              <p className="text-xs text-red-600/60">{totalOverdueGeral.count} fatura(s) vencida(s) no total</p>
            </div>
          </GradientCard>
        </div>
      </div>

      {/* ═══ ATRASOS - CONTAS A PAGAR ═══ */}
      {canSeePayables && (
      <div>
        <SectionHeader icon={ArrowUpRight} title="Atrasos - Contas a Pagar" />
        <div className="grid gap-3 md:grid-cols-2 mt-3">
          <GradientCard gradient="linear-gradient(135deg, #fefce8 0%, #fde68a 100%)">
            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Pagáveis em Atraso no Período</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">{formatCurrencyCents(payablesOverduePeriod.value)}</div>
              <p className="text-xs text-amber-600/60">{payablesOverduePeriod.count} conta(s) vencida(s) em {MONTH_LABELS[selectedMonth]}/{selectedYear}</p>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #fdf2f8 0%, #fbcfe8 100%)">
            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-pink-600" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Pagáveis em Atraso (Geral)</span>
              </div>
              <div className="text-2xl font-bold text-pink-600">{formatCurrencyCents(payablesOverdueGeral.value)}</div>
              <p className="text-xs text-pink-600/60">{payablesOverdueGeral.count} conta(s) vencida(s) no total</p>
            </div>
          </GradientCard>
        </div>
      </div>
      )}

      {/* ═══ INDICADORES DE RECORRÊNCIA ═══ */}
      <div>
        <SectionHeader icon={RefreshCw} title="Indicadores de Recorrência" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mt-3">
          <GradientCard gradient="linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Inadimplência Mensal</span>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <div className="text-xl font-bold" style={{ color: inadimplenciaColor(inadimplencia.pctQty) }}>
                    {inadimplencia.pctQty.toFixed(1)}%
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">por qtd</p>
                </div>
                <div className="h-6 w-px bg-border" />
                <div>
                  <div className="text-xl font-bold" style={{ color: inadimplenciaColor(inadimplencia.pctValue) }}>
                    {inadimplencia.pctValue.toFixed(1)}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">por val</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {inadimplencia.overdueCount}/{inadimplencia.total} faturas • {formatCurrencyCents(inadimplencia.overdueValue)} de {formatCurrencyCents(inadimplencia.totalValue)}
              </p>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">MRR Atual</span>
              </div>
              <div className="text-xl font-bold text-blue-600">{formatCurrencyCents(mrr)}</div>
              <p className="text-[11px] text-muted-foreground">
                {charges.filter(c => c.is_active).length} recorrência(s) ativa(s)
              </p>
              <div className="px-2 py-0.5 rounded-md bg-blue-500/10 inline-block">
                <span className="text-[10px] font-medium text-blue-600">ARR: {formatCurrencyCents(mrr * 12)}</span>
              </div>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">MRR Acrescentado</span>
              </div>
              <div className="text-xl font-bold text-emerald-600">+{formatCurrencyCents(mrrMovement.added)}</div>
              <p className="text-[11px] text-muted-foreground">{mrrMovement.addedCount} nova(s) recorrência(s)</p>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">MRR Perdido</span>
              </div>
              <div className="text-xl font-bold text-red-600">-{formatCurrencyCents(mrrMovement.lost)}</div>
              <p className="text-[11px] text-muted-foreground">{mrrMovement.lostCount} encerrada(s)</p>
              {mrrMovement.net !== 0 && (
                <div className={`px-2 py-0.5 rounded-md inline-block ${mrrMovement.net >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  <span className={`text-[10px] font-medium ${mrrMovement.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    Líquido: {mrrMovement.net >= 0 ? "+" : ""}{formatCurrencyCents(mrrMovement.net)}
                  </span>
                </div>
              )}
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Ticket Médio</span>
              </div>
              <div className="text-xl font-bold text-purple-600">{formatCurrencyCents(ticketMedio)}</div>
              <p className="text-[11px] text-muted-foreground">
                {charges.filter(c => c.is_active).length} recorrência(s) ativa(s)
              </p>
            </div>
          </GradientCard>

          <GradientCard gradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <ShoppingCart className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Vendas Novas</span>
              </div>
              <div className="text-xl font-bold text-amber-600">{formatCurrencyCents(vendasNovas.value)}</div>
              <p className="text-[11px] text-muted-foreground">{vendasNovas.count} fatura(s) avulsa(s)</p>
            </div>
          </GradientCard>
        </div>
      </div>

      {/* ═══ GRÁFICOS ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {canSeePayables ? (
          <GradientCard gradient="linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" className="lg:col-span-2">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-foreground">Receitas vs Despesas (12 meses)</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
        ) : null}

        <GradientCard gradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)">
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
      {canSeePayables && (
        <GradientCard gradient="linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(16,185,129,0.03) 100%)">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-foreground">Resultado Mensal (12 meses)</h3>
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
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
      )}

      {/* ═══ CONTAS BANCÁRIAS ═══ */}
      {banks.length > 0 && canSeeBanks && (
        <div>
          <SectionHeader icon={Building2} title="Contas Bancárias" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mt-3">
            {banks.map((bank: any) => (
              <GradientCard 
                key={bank.id} 
                gradient="linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.03) 100%)"
                onClick={() => openBankStatement(bank)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{bank.name}</p>
                    <p className={`text-lg font-bold ${(bank.current_balance_cents || 0) >= 0 ? "text-violet-600" : "text-destructive"}`}>
                      {formatCurrencyCents(bank.current_balance_cents || 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Clique para ver extrato</p>
                  </div>
                </div>
              </GradientCard>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Saldo Total</span>
            <span className={`text-lg font-bold ${summary.totalBancos >= 0 ? "text-violet-600" : "text-destructive"}`}>
              {formatCurrencyCents(summary.totalBancos)}
            </span>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <DashboardDetailDialog
        open={detailDialog.open}
        onOpenChange={(open) => setDetailDialog(prev => ({ ...prev, open }))}
        title={detailDialog.title}
        items={detailDialog.items}
        type={detailDialog.type}
        formatCurrencyCents={formatCurrencyCents}
        formatCurrency={formatCurrency}
      />

      {/* Bank Statement Dialog */}
      <BankStatementDialog
        account={selectedBankAccount}
        open={bankStatementOpen}
        onOpenChange={setBankStatementOpen}
        formatCurrency={(v) => formatCurrency(v)}
      />
    </div>
  );
}
