import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

// Metric card — clean, no gradients
const MetricCard = ({
  label,
  value,
  sub,
  icon: Icon,
  valueClass = "text-foreground",
  onClick,
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  valueClass?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}) => (
  <Card
    className={`min-w-0 overflow-hidden ${onClick ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
    onClick={onClick}
  >
    <CardContent className="min-w-0 space-y-1.5 p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate text-xs font-medium">{label}</span>
      </div>
      <p className={`min-w-0 break-words text-[clamp(1rem,4.2vw,1.25rem)] font-bold leading-tight ${valueClass}`}>{value}</p>
      {sub && <p className="break-words text-[11px] leading-snug text-muted-foreground">{sub}</p>}
      {badge}
    </CardContent>
  </Card>
);

// Section divider
const Section = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
  <div className="flex items-center gap-2 pt-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export default function FinancialDashboardTab({ invoices, payables, banks, charges = [], formatCurrency, formatCurrencyCents, hasPerm }: Props) {
  const canSeePayables = !hasPerm || hasPerm("fin_payables_view");
  const canSeeBanks = !hasPerm || hasPerm("fin_bank_balances");
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  
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

  const monthInvoices = useMemo(() => invoices.filter(i => i.due_date?.startsWith(monthStr)), [invoices, monthStr]);
  const monthPayables = useMemo(() => payables.filter(p => p.due_date?.startsWith(monthStr) || p.reference_month === monthStr), [payables, monthStr]);

  const receivableBreakdown = useMemo(() => {
    const overdue = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date < todayStr);
    const dueToday = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date === todayStr);
    const restOfMonth = monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date > todayStr);
    return { overdue, dueToday, restOfMonth };
  }, [monthInvoices, todayStr]);

  const payableBreakdown = useMemo(() => {
    const overdue = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < todayStr);
    const dueToday = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date === todayStr);
    const restOfMonth = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date > todayStr);
    return { overdue, dueToday, restOfMonth };
  }, [monthPayables, todayStr]);

  const summary = useMemo(() => {
    // Receita Recebida: filtra por paid_at no mês (não por due_date)
    const paidInMonth = invoices.filter(i => i.status === "paid" && i.paid_at?.startsWith(monthStr));
    const receitaRecebida = paidInMonth.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0);
    const receitaPendente = monthInvoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + i.amount_cents, 0);
    // Despesa Paga: filtra por paid_date no mês (não por due_date)
    const paidPayablesInMonth = payables.filter((p: any) => p.status === "paid" && p.paid_date?.startsWith(monthStr));
    const despesaPaga = paidPayablesInMonth.reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0) * 100, 0);
    const despesaPendente = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled").reduce((s: number, p: any) => s + (p.amount || 0) * 100, 0);
    const totalBancos = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0);
    const resultado = receitaRecebida - despesaPaga;
    return { receitaRecebida, receitaPendente, despesaPaga, despesaPendente, totalBancos, resultado };
  }, [invoices, payables, monthInvoices, monthPayables, banks, monthStr]);

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

  const totalOverdueGeral = useMemo(() => {
    const allOverdue = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.due_date && i.due_date < todayStr);
    return { count: allOverdue.length, value: allOverdue.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0) };
  }, [invoices, todayStr]);

  const payablesOverduePeriod = useMemo(() => {
    const overdue = monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < todayStr);
    return { count: overdue.length, value: overdue.reduce((s: number, p: any) => s + ((p.amount || 0) * 100), 0) };
  }, [monthPayables, todayStr]);

  const payablesOverdueGeral = useMemo(() => {
    const allOverdue = payables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < todayStr);
    return { count: allOverdue.length, value: allOverdue.reduce((s: number, p: any) => s + ((p.amount || 0) * 100), 0) };
  }, [payables, todayStr]);

  const mrr = useMemo(() => {
    const activeCharges = charges.filter(c => c.is_active);
    return activeCharges.reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
  }, [charges]);

  const ticketMedio = useMemo(() => {
    const activeCharges = charges.filter(c => c.is_active);
    if (activeCharges.length === 0) return 0;
    return mrr / activeCharges.length;
  }, [charges, mrr]);

  const mrrMovement = useMemo(() => {
    const added = charges.filter(c => c.is_active && c.created_at?.startsWith(monthStr)).reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
    const addedCount = charges.filter(c => c.is_active && c.created_at?.startsWith(monthStr)).length;
    const lost = charges.filter(c => !c.is_active && c.updated_at?.startsWith(monthStr)).reduce((s, c) => s + toMonthlyMRR(c.amount_cents || 0, c.recurrence || "monthly"), 0);
    const lostCount = charges.filter(c => !c.is_active && c.updated_at?.startsWith(monthStr)).length;
    return { added, addedCount, lost, lostCount, net: added - lost };
  }, [charges, monthStr]);

  const vendasNovas = useMemo(() => {
    const novas = invoices.filter(i => !i.recurring_charge_id && i.created_at?.startsWith(monthStr));
    return { count: novas.length, value: novas.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0) };
  }, [invoices, monthStr]);

  const monthlyData = useMemo(() => {
    const months: { month: string; label: string; receita: number; despesa: number; resultado: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const rec = invoices.filter(inv => inv.due_date?.startsWith(key) && inv.status === "paid").reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0) / 100;
      const desp = payables.filter((p: any) => (p.due_date?.startsWith(key) || p.reference_month === key) && p.status === "paid").reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);
      months.push({ month: key, label, receita: rec, despesa: desp, resultado: rec - desp });
    }
    return months;
  }, [invoices, payables, selectedYear, selectedMonth]);

  const statusData = useMemo(() => {
    const paid = monthInvoices.filter(i => i.status === "paid").length;
    const pending = monthInvoices.filter(i => i.status === "pending").length;
    const overdue = monthInvoices.filter(i => i.status === "overdue").length;
    return [
      { name: "Recebido", value: paid, color: "hsl(var(--primary))" },
      { name: "Pendente", value: pending, color: "hsl(var(--muted-foreground))" },
      { name: "Vencido", value: overdue, color: "hsl(var(--destructive))" },
    ].filter(d => d.value > 0);
  }, [monthInvoices]);

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  const openDetail = (title: string, items: any[], type: "receivable" | "payable") => {
    setDetailDialog({ open: true, title, items, type });
  };

  const openBankStatement = (bank: any) => {
    setSelectedBankAccount({
      id: bank.id, name: bank.name, bank_name: bank.bank_name || bank.name,
      account_type: bank.account_type || "checking",
      current_balance: (bank.current_balance_cents || 0) / 100,
      initial_balance: (bank.initial_balance_cents || 0) / 100,
      agency: bank.agency || null, account_number: bank.account_number || null,
    });
    setBankStatementOpen(true);
  };

  const sumCents = (items: any[]) => items.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const sumPayable = (items: any[]) => items.reduce((s: number, p: any) => s + ((p.amount || 0) * 100), 0);

  const inadColor = (pct: number) => pct > 10 ? "text-destructive" : pct > 5 ? "text-amber-500" : "text-emerald-600";

  return (
    <div className="space-y-6">
      {/* Month Picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Período:</span>
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevMonth}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[100px] h-7 text-sm border-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.map((label, i) => (
                <SelectItem key={i} value={String(i)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[80px] h-7 text-sm border-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {!isCurrentMonth && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToCurrentMonth}>
            Mês atual
          </Button>
        )}
      </div>

      {/* ═══ RESUMO DO MÊS ═══ */}
      <Section title="Resumo do Mês" icon={Wallet} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Receita Recebida"
          value={formatCurrencyCents(summary.receitaRecebida)}
          sub="Recebido no mês"
          icon={ArrowUpRight}
          valueClass="text-emerald-600"
        />
        <MetricCard
          label="A Receber"
          value={formatCurrencyCents(summary.receitaPendente)}
          sub="Pendente no mês"
          icon={CreditCard}
          valueClass="text-foreground"
          onClick={() => openDetail(`A Receber — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, monthInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled"), "receivable")}
        />
        {canSeePayables && (
          <MetricCard
            label="Despesas Pagas"
            value={formatCurrencyCents(summary.despesaPaga)}
            sub="Pago no mês"
            icon={ArrowDownRight}
            valueClass="text-destructive"
          />
        )}
        {canSeePayables && (
          <MetricCard
            label="A Pagar"
            value={formatCurrencyCents(summary.despesaPendente)}
            sub="Pendente no mês"
            icon={Banknote}
            valueClass="text-foreground"
            onClick={() => openDetail(`A Pagar — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, monthPayables.filter((p: any) => p.status !== "paid" && p.status !== "cancelled"), "payable")}
          />
        )}
        {canSeePayables && (
          <MetricCard
            label="Resultado"
            value={formatCurrencyCents(summary.resultado)}
            sub="Receita − Despesa"
            icon={Activity}
            valueClass={summary.resultado >= 0 ? "text-emerald-600" : "text-destructive"}
          />
        )}
        {canSeeBanks && (
          <MetricCard
            label="Saldo Bancário"
            value={formatCurrencyCents(summary.totalBancos)}
            sub={`${banks.length} conta(s)`}
            icon={PiggyBank}
            valueClass="text-foreground"
          />
        )}
      </div>

      {/* ═══ DETALHAMENTO A RECEBER / A PAGAR ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Section title="A Receber — Detalhamento" icon={ArrowDownRight} />
          <div className="grid gap-3 grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3">
            <MetricCard
              label="Vencidos"
              value={formatCurrencyCents(sumCents(receivableBreakdown.overdue))}
              sub={`${receivableBreakdown.overdue.length} fatura(s)`}
              icon={AlertTriangle}
              valueClass="text-destructive"
              onClick={() => openDetail(`Vencidos — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, receivableBreakdown.overdue, "receivable")}
            />
            <MetricCard
              label="Vencem Hoje"
              value={formatCurrencyCents(sumCents(receivableBreakdown.dueToday))}
              sub={`${receivableBreakdown.dueToday.length} fatura(s)`}
              icon={Clock}
              valueClass="text-amber-500"
              onClick={() => openDetail(`Vencem Hoje — ${todayStr}`, receivableBreakdown.dueToday, "receivable")}
            />
            <MetricCard
              label="Restante"
              value={formatCurrencyCents(sumCents(receivableBreakdown.restOfMonth))}
              sub={`${receivableBreakdown.restOfMonth.length} fatura(s)`}
              icon={CalendarClock}
              valueClass="text-foreground"
              onClick={() => openDetail(`Restante do Mês — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, receivableBreakdown.restOfMonth, "receivable")}
            />
          </div>
        </div>

        {canSeePayables && (
          <div className="space-y-3">
            <Section title="A Pagar — Detalhamento" icon={ArrowUpRight} />
            <div className="grid gap-3 grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3">
              <MetricCard
                label="Vencidos"
                value={formatCurrencyCents(sumPayable(payableBreakdown.overdue))}
                sub={`${payableBreakdown.overdue.length} conta(s)`}
                icon={AlertTriangle}
                valueClass="text-destructive"
                onClick={() => openDetail(`Pagáveis Vencidos — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, payableBreakdown.overdue, "payable")}
              />
              <MetricCard
                label="Vencem Hoje"
                value={formatCurrencyCents(sumPayable(payableBreakdown.dueToday))}
                sub={`${payableBreakdown.dueToday.length} conta(s)`}
                icon={Clock}
                valueClass="text-amber-500"
                onClick={() => openDetail(`Pagáveis Vencem Hoje — ${todayStr}`, payableBreakdown.dueToday, "payable")}
              />
              <MetricCard
                label="Restante"
                value={formatCurrencyCents(sumPayable(payableBreakdown.restOfMonth))}
                sub={`${payableBreakdown.restOfMonth.length} conta(s)`}
                icon={CalendarClock}
                valueClass="text-foreground"
                onClick={() => openDetail(`Pagáveis Restante do Mês — ${MONTH_LABELS[selectedMonth]}/${selectedYear}`, payableBreakdown.restOfMonth, "payable")}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══ ATRASOS ═══ */}
      <Section title="Atrasos - Contas a Receber" icon={AlertTriangle} />
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Inadimplência do Período</span>
            </div>
            <div className="flex items-baseline gap-4">
              <div>
                <p className={`text-2xl font-bold ${inadColor(inadimplencia.pctValue)}`}>
                  {inadimplencia.pctValue.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">por valor</p>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <p className={`text-2xl font-bold ${inadColor(inadimplencia.pctQty)}`}>
                  {inadimplencia.pctQty.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">por qtd</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {inadimplencia.overdueCount} de {inadimplencia.total} fatura(s) em {MONTH_LABELS[selectedMonth]}/{selectedYear}
            </p>
          </CardContent>
        </Card>

        <MetricCard
          label="Recebíveis em Atraso no Período"
          value={formatCurrencyCents(inadimplencia.overdueValue)}
          sub={`${inadimplencia.overdueCount} fatura(s) em ${MONTH_LABELS[selectedMonth]}/${selectedYear}`}
          icon={AlertTriangle}
          valueClass="text-destructive"
        />

        <MetricCard
          label="Total Recebíveis em Atraso (Geral)"
          value={formatCurrencyCents(totalOverdueGeral.value)}
          sub={`${totalOverdueGeral.count} fatura(s) vencida(s) no total`}
          icon={ShieldAlert}
          valueClass="text-destructive"
        />
      </div>

      {/* ═══ ATRASOS - CONTAS A PAGAR ═══ */}
      {canSeePayables && (
        <>
          <Section title="Atrasos - Contas a Pagar" icon={ArrowUpRight} />
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              label="Pagáveis em Atraso no Período"
              value={formatCurrencyCents(payablesOverduePeriod.value)}
              sub={`${payablesOverduePeriod.count} conta(s) em ${MONTH_LABELS[selectedMonth]}/${selectedYear}`}
              icon={Wallet}
              valueClass="text-amber-500"
            />
            <MetricCard
              label="Total Pagáveis em Atraso (Geral)"
              value={formatCurrencyCents(payablesOverdueGeral.value)}
              sub={`${payablesOverdueGeral.count} conta(s) vencida(s) no total`}
              icon={ShieldAlert}
              valueClass="text-destructive"
            />
          </div>
        </>
      )}

      {/* ═══ INDICADORES DE RECORRÊNCIA ═══ */}
      <Section title="Indicadores de Recorrência" icon={RefreshCw} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Inadimplência</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div>
                <p className={`text-lg font-bold ${inadColor(inadimplencia.pctQty)}`}>{inadimplencia.pctQty.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">QTD</p>
              </div>
              <div className="h-5 w-px bg-border" />
              <div>
                <p className={`text-lg font-bold ${inadColor(inadimplencia.pctValue)}`}>{inadimplencia.pctValue.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">VAL</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {inadimplencia.overdueCount}/{inadimplencia.total} faturas • {formatCurrencyCents(inadimplencia.overdueValue)} de {formatCurrencyCents(inadimplencia.totalValue)}
            </p>
          </CardContent>
        </Card>

        <MetricCard
          label="MRR Atual"
          value={formatCurrencyCents(mrr)}
          sub={`${charges.filter(c => c.is_active).length} recorrência(s) ativa(s)`}
          icon={RefreshCw}
          valueClass="text-primary"
          badge={
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
              ARR: {formatCurrencyCents(mrr * 12)}
            </span>
          }
        />

        <MetricCard
          label="MRR Acrescentado"
          value={`+${formatCurrencyCents(mrrMovement.added)}`}
          sub={`${mrrMovement.addedCount} nova(s) recorrência(s)`}
          icon={ArrowUpRight}
          valueClass="text-emerald-600"
        />

        <MetricCard
          label="MRR Perdido"
          value={`-${formatCurrencyCents(mrrMovement.lost)}`}
          sub={`${mrrMovement.lostCount} encerrada(s)`}
          icon={ArrowDownRight}
          valueClass="text-destructive"
          badge={mrrMovement.net !== 0 ? (
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${mrrMovement.net >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
              Líquido: {mrrMovement.net >= 0 ? "+" : ""}{formatCurrencyCents(mrrMovement.net)}
            </span>
          ) : undefined}
        />

        <MetricCard
          label="Ticket Médio"
          value={formatCurrencyCents(ticketMedio)}
          sub={`${charges.filter(c => c.is_active).length} recorrência(s) ativa(s)`}
          icon={DollarSign}
          valueClass="text-foreground"
        />

        <MetricCard
          label="Vendas Novas"
          value={formatCurrencyCents(vendasNovas.value)}
          sub={`${vendasNovas.count} fatura(s) avulsa(s)`}
          icon={ShoppingCart}
          valueClass="text-foreground"
        />
      </div>

      {/* ═══ GRÁFICOS ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {canSeePayables && (
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Receitas vs Despesas (12 meses)</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Status dos Recebíveis</h3>
            </div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%" cy="50%"
                    innerRadius={65} outerRadius={105}
                    dataKey="value" strokeWidth={2}
                    stroke="hsl(var(--background))"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
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
      {canSeePayables && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Resultado Mensal (12 meses)</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gradientResultado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Area type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--primary))" fill="url(#gradientResultado)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ═══ CONTAS BANCÁRIAS ═══ */}
      {banks.length > 0 && canSeeBanks && (
        <>
          <Section title="Contas Bancárias" icon={Building2} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {banks.map((bank: any) => (
              <Card key={bank.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => openBankStatement(bank)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{bank.name}</p>
                    <p className={`text-lg font-bold ${(bank.current_balance_cents || 0) >= 0 ? "text-foreground" : "text-destructive"}`}>
                      {formatCurrencyCents(bank.current_balance_cents || 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <span className="text-sm font-medium text-muted-foreground">Saldo Total</span>
            <span className={`text-lg font-bold ${summary.totalBancos >= 0 ? "text-foreground" : "text-destructive"}`}>
              {formatCurrencyCents(summary.totalBancos)}
            </span>
          </div>
        </>
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
