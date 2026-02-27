import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Loader2, ShieldAlert, Search, RefreshCw, Filter, Download,
  ArrowUpCircle, Calculator, CheckCircle2, Undo2, Clock, AlertTriangle,
  XCircle, CalendarIcon, Landmark, Plus, Trash2, Edit2, LayoutDashboard,
  ArrowDownCircle, FolderTree, FileText, ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import FinancialDashboardTab from "./financial/FinancialDashboardTab";
import FinancialCategoriesTab from "./financial/FinancialCategoriesTab";
import FinancialDRETab from "./financial/FinancialDRETab";
import FinancialDFCTab from "./financial/FinancialDFCTab";

interface RecurringCharge {
  id: string;
  company_id: string;
  description: string;
  amount_cents: number;
  recurrence: string;
  next_billing_date: string | null;
  is_active: boolean;
  created_at: string;
  asaas_subscription_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name?: string;
}

interface FinancialEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  category: string | null;
  reference_month: string;
  paid_amount: number | null;
  paid_at: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  company_id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount_cents: number | null;
  installment_number: number;
  total_installments: number;
  late_fee_cents: number;
  interest_cents: number;
  total_with_fees_cents: number;
  recurring_charge_id: string | null;
  pagarme_charge_id: string | null;
  created_at: string;
  company_name?: string;
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, masterOnly: false },
  { key: "recurring", label: "Contas a Receber", icon: ArrowDownCircle, masterOnly: false },
  { key: "payables", label: "Contas a Pagar", icon: ArrowUpCircle, masterOnly: true },
  { key: "categories", label: "Categorias", icon: FolderTree, masterOnly: true },
  { key: "dre", label: "DRE", icon: FileText, masterOnly: true },
  { key: "dfc", label: "DFC", icon: ArrowRightLeft, masterOnly: true },
  { key: "banks", label: "Bancos", icon: Landmark, masterOnly: true },
];

export default function AllRecurringChargesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data state
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [payables, setPayables] = useState<FinancialEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; invoiceId: string; action: "confirm" | "revert"; description: string }>({
    open: false, invoiceId: "", action: "confirm", description: "",
  });
  const [manualFee, setManualFee] = useState("1.99");
  const [selectedBankId, setSelectedBankId] = useState("none");
  const [banks, setBanks] = useState<any[]>([]);
  const [bankDialog, setBankDialog] = useState<{ open: boolean; bank: any | null }>({ open: false, bank: null });
  const [bankForm, setBankForm] = useState({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });

  // New receivable dialog
  const [receivableDialog, setReceivableDialog] = useState(false);
  const [receivableForm, setReceivableForm] = useState({
    company_id: "", description: "", amount: 0, due_date: "", notes: "",
  });
  const [savingReceivable, setSavingReceivable] = useState(false);

  // New payable dialog
  const [payableDialog, setPayableDialog] = useState(false);
  const [payableForm, setPayableForm] = useState({
    supplier_name: "", description: "", amount: 0, due_date: "", reference_month: "", category: "", notes: "",
  });
  const [savingPayable, setSavingPayable] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedRecurrence, setSelectedRecurrence] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });

  useEffect(() => { checkAccess(); }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding/login"); return; }
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      const role = (staff as any)?.role;
      if (role === "admin" || role === "master") {
        setUserRole(role);
        setActiveTab("dashboard");
        await loadData();
      } else {
        setUserRole(null);
        toast.error("Acesso negado. Este módulo é restrito a administradores.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [chargesRes, companiesRes, payablesRes, invoicesRes, banksRes] = await Promise.all([
        supabase.from("company_recurring_charges").select("*").order("created_at", { ascending: false }),
        supabase.from("onboarding_companies").select("id, name").order("name"),
        supabase.from("financial_payables").select("*").order("due_date", { ascending: false }),
        supabase.from("company_invoices").select("*").order("due_date", { ascending: true }),
        supabase.from("financial_banks").select("*").eq("is_active", true).order("name"),
      ]);
      if (chargesRes.error) throw chargesRes.error;
      if (companiesRes.error) throw companiesRes.error;
      const companiesMap = new Map(companiesRes.data?.map(c => [c.id, c.name]) || []);
      setCharges((chargesRes.data || []).map((ch: any) => ({ ...ch, company_name: companiesMap.get(ch.company_id) || "Empresa desconhecida" })));
      setCompanies(companiesRes.data || []);
      setPayables((payablesRes.data as any) || []);
      setInvoices(((invoicesRes.data as any[]) || []).map((inv: any) => ({ ...inv, company_name: companiesMap.get(inv.company_id) || "Empresa desconhecida" })));
      setBanks((banksRes.data as any) || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    }
  };

  const isMaster = userRole === "master";
  const isAdmin = userRole === "admin" || isMaster;

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match = inv.description?.toLowerCase().includes(s) || inv.company_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (selectedCompany !== "all" && inv.company_id !== selectedCompany) return false;
      if (selectedStatus !== "all") {
        if (selectedStatus === "pending" && inv.status !== "pending") return false;
        if (selectedStatus === "paid" && inv.status !== "paid") return false;
        if (selectedStatus === "overdue" && inv.status !== "overdue") return false;
        if (selectedStatus === "cancelled" && inv.status !== "cancelled") return false;
      }
      if (dateFrom) { if (inv.due_date < format(dateFrom, "yyyy-MM-dd")) return false; }
      if (dateTo) { if (inv.due_date > format(dateTo, "yyyy-MM-dd")) return false; }
      return true;
    });
  }, [invoices, searchTerm, selectedCompany, selectedStatus, dateFrom, dateTo]);

  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      if (searchTerm && !p.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (selectedStatus === "pending" && p.status !== "pending") return false;
      if (selectedStatus === "paid" && p.status !== "paid") return false;
      if (selectedStatus === "overdue" && p.status !== "overdue") return false;
      if (selectedMonth !== "all" && p.reference_month !== selectedMonth) return false;
      return true;
    });
  }, [payables, searchTerm, selectedStatus, selectedMonth]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatCurrencyCents = (cents: number) => formatCurrency(cents / 100);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: "Pendente", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado" };
    return map[s] || s;
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "paid") return "default";
    if (s === "overdue") return "destructive";
    if (s === "cancelled") return "secondary";
    return "outline";
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "paid") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (status === "overdue") return <AlertTriangle className="h-3.5 w-3.5" />;
    if (status === "cancelled") return <XCircle className="h-3.5 w-3.5" />;
    return <Clock className="h-3.5 w-3.5" />;
  };

  const resetFilters = () => {
    const now = new Date();
    setSearchTerm("");
    setSelectedCompany("all");
    setSelectedStatus("all");
    setSelectedMonth("all");
    setSelectedRecurrence("all");
    setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
    setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  };

  // Manual payment (baixa)
  const handleManualPayment = async (invoiceId: string, feeCents: number, bankId: string | null) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const today = new Date().toISOString().split("T")[0];
      const inv = invoices.find(i => i.id === invoiceId);
      const paidAmount = inv?.status === "overdue" ? inv.total_with_fees_cents : inv?.amount_cents;
      const updateData: any = { status: "paid", paid_at: today, paid_amount_cents: paidAmount, payment_fee_cents: feeCents };
      if (bankId) updateData.bank_id = bankId;
      const { error } = await supabase.from("company_invoices").update(updateData).eq("id", invoiceId);
      if (error) throw error;
      if (bankId && paidAmount) {
        const netAmount = paidAmount - feeCents;
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: netAmount });
        await supabase.from("financial_bank_transactions").insert({ bank_id: bankId, type: "credit", amount_cents: netAmount, description: `Recebimento: ${inv?.description} (${inv?.installment_number}/${inv?.total_installments})`, reference_type: "invoice", reference_id: invoiceId } as any);
      }
      const { data, error: fnError } = await supabase.functions.invoke("asaas-confirm-payment", { body: { invoice_id: invoiceId, action: "confirm" } });
      if (fnError) { toast.success("Baixa local realizada (erro ao sincronizar com Asaas)"); }
      else if (data?.skipped) { toast.success("Baixa realizada localmente"); }
      else { toast.success("Baixa realizada e sincronizada com Asaas ✓"); }
      await loadData();
    } catch (err: any) {
      toast.error("Erro ao dar baixa: " + (err.message || "erro"));
    } finally {
      setProcessingInvoiceId(null);
      setConfirmDialog({ open: false, invoiceId: "", action: "confirm", description: "" });
      setManualFee("1.99");
      setSelectedBankId("none");
    }
  };

  // Revert payment (estorno)
  const handleRevertPayment = async (invoiceId: string) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const inv = invoices.find(i => i.id === invoiceId);
      const invAny = inv as any;
      const bankId = invAny?.bank_id;
      const paidAmount = invAny?.paid_amount_cents || invAny?.amount_cents || 0;
      const feeCents = invAny?.payment_fee_cents || 0;
      const { error } = await supabase.from("company_invoices").update({ status: "pending", paid_at: null, paid_amount_cents: null, bank_id: null } as any).eq("id", invoiceId);
      if (error) throw error;
      if (bankId) {
        const netAmount = paidAmount - feeCents;
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: -netAmount });
        await supabase.from("financial_bank_transactions").insert({ bank_id: bankId, type: "debit", amount_cents: netAmount, description: `Estorno: ${inv?.description} (${inv?.installment_number}/${inv?.total_installments})`, reference_type: "invoice", reference_id: invoiceId } as any);
      }
      const { data, error: fnError } = await supabase.functions.invoke("asaas-confirm-payment", { body: { invoice_id: invoiceId, action: "revert" } });
      if (fnError) { toast.success("Estorno local realizado (erro ao sincronizar com Asaas)"); }
      else if (data?.skipped) { toast.success("Estorno realizado localmente"); }
      else { toast.success("Estorno realizado e sincronizado com Asaas ✓"); }
      await loadData();
    } catch (err: any) {
      toast.error("Erro ao estornar: " + (err.message || "erro"));
    } finally {
      setProcessingInvoiceId(null);
      setConfirmDialog({ open: false, invoiceId: "", action: "revert", description: "" });
    }
  };

  // Bank CRUD
  const handleSaveBank = async () => {
    try {
      const balanceCents = Math.round(parseFloat(bankForm.initial_balance || "0") * 100);
      if (!bankForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
      if (bankDialog.bank) {
        const { error } = await supabase.from("financial_banks").update({ name: bankForm.name, bank_code: bankForm.bank_code || null, agency: bankForm.agency || null, account_number: bankForm.account_number || null } as any).eq("id", bankDialog.bank.id);
        if (error) throw error;
        toast.success("Banco atualizado");
      } else {
        const { error } = await supabase.from("financial_banks").insert({ name: bankForm.name, bank_code: bankForm.bank_code || null, agency: bankForm.agency || null, account_number: bankForm.account_number || null, initial_balance_cents: balanceCents, current_balance_cents: balanceCents } as any);
        if (error) throw error;
        toast.success("Banco cadastrado");
      }
      setBankDialog({ open: false, bank: null });
      setBankForm({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });
      await loadData();
    } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm("Excluir este banco?")) return;
    try {
      const { error } = await supabase.from("financial_banks").update({ is_active: false } as any).eq("id", bankId);
      if (error) throw error;
      toast.success("Banco removido");
      await loadData();
    } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
  };

  // Save manual receivable
  const handleSaveReceivable = async () => {
    if (!receivableForm.company_id || !receivableForm.description || !receivableForm.amount || !receivableForm.due_date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSavingReceivable(true);
    try {
      const amountCents = Math.round(receivableForm.amount * 100);
      const { error } = await supabase.from("company_invoices").insert({
        company_id: receivableForm.company_id,
        description: receivableForm.description,
        amount_cents: amountCents,
        due_date: receivableForm.due_date,
        notes: receivableForm.notes || null,
        status: "pending",
        installment_number: 1,
        total_installments: 1,
      });
      if (error) throw error;
      toast.success("Conta a receber lançada com sucesso");
      setReceivableDialog(false);
      setReceivableForm({ company_id: "", description: "", amount: 0, due_date: "", notes: "" });
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSavingReceivable(false);
    }
  };

  // Save manual payable
  const handleSavePayable = async () => {
    if (!payableForm.supplier_name || !payableForm.description || !payableForm.amount || !payableForm.due_date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSavingPayable(true);
    try {
      const now = new Date();
      const refMonth = payableForm.reference_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { error } = await supabase.from("financial_payables").insert({
        supplier_name: payableForm.supplier_name,
        description: payableForm.description,
        amount: payableForm.amount,
        due_date: payableForm.due_date,
        reference_month: refMonth,
        notes: payableForm.notes || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Conta a pagar lançada com sucesso");
      setPayableDialog(false);
      setPayableForm({ supplier_name: "", description: "", amount: 0, due_date: "", reference_month: "", category: "", notes: "" });
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSavingPayable(false);
    }
  };


  const exportCSV = () => {
    let rows: string[][] = [];
    if (activeTab === "payables") {
      rows = [["Descrição", "Valor", "Vencimento", "Status", "Mês Ref", "Pago em"]];
      filteredPayables.forEach(p => {
        rows.push([p.description, formatCurrency(p.amount), p.due_date ? format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy") : "", statusLabel(p.status), p.reference_month, p.paid_at ? format(new Date(p.paid_at), "dd/MM/yyyy") : ""]);
      });
    } else if (activeTab === "recurring") {
      rows = [["Empresa", "Descrição", "Parcela", "Valor", "Vencimento", "Status", "Pago em"]];
      filteredInvoices.forEach(inv => {
        rows.push([inv.company_name || "", inv.description, `${inv.installment_number}/${inv.total_installments}`, formatCurrencyCents(inv.amount_cents), inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "", statusLabel(inv.status), inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy") : ""]);
      });
    }
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const financialMonths = useMemo(() => {
    const set = new Set<string>();
    payables.forEach(p => { if (p.reference_month) set.add(p.reference_month); });
    return Array.from(set).sort().reverse();
  }, [payables]);

  const invoiceSummary = useMemo(() => {
    const pending = filteredInvoices.filter(i => i.status === "pending" || i.status === "overdue");
    const paid = filteredInvoices.filter(i => i.status === "paid");
    const overdue = filteredInvoices.filter(i => i.status === "overdue");
    return {
      totalPending: pending.reduce((s, i) => s + (i.status === "overdue" ? i.total_with_fees_cents : i.amount_cents), 0),
      pendingCount: pending.length,
      totalPaid: paid.reduce((s, i) => s + (i.paid_amount_cents || i.amount_cents), 0),
      paidCount: paid.length,
      totalOverdue: overdue.reduce((s, i) => s + i.total_with_fees_cents, 0),
      overdueCount: overdue.length,
    };
  }, [filteredInvoices]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter(item => !item.masterOnly || isMaster);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <aside className="w-56 border-r bg-card flex flex-col sticky top-0 h-screen">
        <div className="p-4 border-b">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 -ml-2" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4" />
            Nexus
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2 mt-3 px-1">
            <Calculator className="h-5 w-5 text-primary" />
            Financeiro
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); resetFilters(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <FinancialDashboardTab
              invoices={invoices}
              payables={payables}
              banks={banks}
              formatCurrency={formatCurrency}
              formatCurrencyCents={formatCurrencyCents}
            />
          )}

          {/* Contas a Receber */}
          {activeTab === "recurring" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowDownCircle className="h-5 w-5 text-primary" />
                  Contas a Receber
                </h2>
                <Button size="sm" onClick={() => {
                  setReceivableForm({ company_id: "", description: "", amount: 0, due_date: "", notes: "" });
                  setReceivableDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lançamento
                </Button>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Empresas</SelectItem>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A Receber</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrencyCents(invoiceSummary.totalPending)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.pendingCount} parcelas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recebido</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{formatCurrencyCents(invoiceSummary.totalPaid)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.paidCount} parcelas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencido</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrencyCents(invoiceSummary.totalOverdue)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.overdueCount} parcelas</p>
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Parcela</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pago em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</TableCell></TableRow>
                        ) : filteredInvoices.map(inv => {
                          const isProcessing = processingInvoiceId === inv.id;
                          const displayAmount = inv.status === "overdue" ? inv.total_with_fees_cents : inv.amount_cents;
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium text-sm">{inv.company_name}</TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">{inv.description}</TableCell>
                              <TableCell className="text-center text-sm">{inv.installment_number}/{inv.total_installments}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrencyCents(displayAmount)}</TableCell>
                              <TableCell className="text-sm">{inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(inv.status)} className="gap-1 text-xs">
                                  <StatusIcon status={inv.status} />
                                  {statusLabel(inv.status)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy") : "-"}</TableCell>
                              <TableCell>
                                {isAdmin && (
                                  <div className="flex justify-end gap-1">
                                    {inv.status !== "paid" && inv.status !== "cancelled" ? (
                                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" disabled={isProcessing}
                                        onClick={() => setConfirmDialog({ open: true, invoiceId: inv.id, action: "confirm", description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments}) - ${formatCurrencyCents(displayAmount)}` })}>
                                        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                        Baixa
                                      </Button>
                                    ) : isMaster && inv.status === "paid" ? (
                                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isProcessing}
                                        onClick={() => setConfirmDialog({ open: true, invoiceId: inv.id, action: "revert", description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments})` })}>
                                        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                                        Estornar
                                      </Button>
                                    ) : null}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Contas a Pagar */}
          {activeTab === "payables" && isMaster && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-primary" />
                  Contas a Pagar
                </h2>
                <Button size="sm" onClick={() => {
                  setPayableForm({ supplier_name: "", description: "", amount: 0, due_date: "", reference_month: "", category: "", notes: "" });
                  setPayableDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lançamento
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Meses</SelectItem>
                        {financialMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total a Pagar</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrency(filteredPayables.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0))}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pago</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(filteredPayables.filter(p => p.status === "paid").reduce((s, p) => s + (p.paid_amount || p.amount), 0))}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencidos</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrency(filteredPayables.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0))}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Mês Ref</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pago em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayables.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                        ) : filteredPayables.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium max-w-[250px] truncate">{p.description}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{p.due_date ? format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                            <TableCell>{p.reference_month}</TableCell>
                            <TableCell><Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "dd/MM/yyyy") : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Categories */}
          {activeTab === "categories" && isMaster && <FinancialCategoriesTab />}

          {/* DRE */}
          {activeTab === "dre" && isMaster && (
            <FinancialDRETab invoices={invoices} payables={payables} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}

          {/* DFC */}
          {activeTab === "dfc" && isMaster && (
            <FinancialDFCTab invoices={invoices} payables={payables} banks={banks} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}

          {/* Bancos */}
          {activeTab === "banks" && isMaster && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  Contas Bancárias
                </h2>
                <Button size="sm" onClick={() => {
                  setBankForm({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });
                  setBankDialog({ open: true, bank: null });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Banco
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {banks.map((bank: any) => (
                  <Card key={bank.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-primary" />
                          {bank.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setBankForm({ name: bank.name, bank_code: bank.bank_code || "", agency: bank.agency || "", account_number: bank.account_number || "", initial_balance: (bank.initial_balance_cents / 100).toString() });
                            setBankDialog({ open: true, bank });
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBank(bank.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrencyCents(bank.current_balance_cents)}</div>
                      {bank.bank_code && <p className="text-xs text-muted-foreground mt-1">Banco: {bank.bank_code} | Ag: {bank.agency || "-"} | Conta: {bank.account_number || "-"}</p>}
                      <p className="text-xs text-muted-foreground">Saldo inicial: {formatCurrencyCents(bank.initial_balance_cents)}</p>
                    </CardContent>
                  </Card>
                ))}
                {banks.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nenhum banco cadastrado. Clique em "Novo Banco" para começar.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) { setConfirmDialog(prev => ({ ...prev, open: false })); setManualFee("1.99"); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.action === "confirm" ? "Confirmar Baixa Manual" : "Confirmar Estorno"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "confirm"
                ? "Tem certeza que deseja dar baixa nesta parcela? A ação será sincronizada com o Asaas."
                : "Tem certeza que deseja estornar esta parcela? A ação será sincronizada com o Asaas."
              }
              <br />
              <strong className="block mt-2">{confirmDialog.description}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDialog.action === "confirm" && (
            <div className="px-6 pb-2 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Banco (opcional)</label>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({formatCurrencyCents(b.current_balance_cents)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Taxa cobrada (R$)</label>
                <Input type="number" step="0.01" min="0" value={manualFee} onChange={(e) => setManualFee(e.target.value)} placeholder="0.00" className="w-40" />
                <p className="text-xs text-muted-foreground mt-1">Informe a taxa do boleto/pix (padrão: R$ 1,99)</p>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!processingInvoiceId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!processingInvoiceId}
              className={confirmDialog.action === "revert" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (confirmDialog.action === "confirm") {
                  handleManualPayment(confirmDialog.invoiceId, Math.round(parseFloat(manualFee || "0") * 100), selectedBankId !== "none" ? selectedBankId : null);
                } else {
                  handleRevertPayment(confirmDialog.invoiceId);
                }
              }}>
              {processingInvoiceId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {confirmDialog.action === "confirm" ? "Confirmar Baixa" : "Confirmar Estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bank Dialog */}
      <AlertDialog open={bankDialog.open} onOpenChange={(open) => { if (!open) setBankDialog({ open: false, bank: null }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bankDialog.bank ? "Editar Banco" : "Novo Banco"}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome *</label>
              <Input value={bankForm.name} onChange={(e) => setBankForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Banco do Brasil" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Código</label>
                <Input value={bankForm.bank_code} onChange={(e) => setBankForm(p => ({ ...p, bank_code: e.target.value }))} placeholder="001" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Agência</label>
                <Input value={bankForm.agency} onChange={(e) => setBankForm(p => ({ ...p, agency: e.target.value }))} placeholder="1234" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Conta</label>
                <Input value={bankForm.account_number} onChange={(e) => setBankForm(p => ({ ...p, account_number: e.target.value }))} placeholder="12345-6" />
              </div>
            </div>
            {!bankDialog.bank && (
              <div>
                <label className="text-sm font-medium mb-1 block">Saldo Inicial (R$)</label>
                <Input type="number" step="0.01" value={bankForm.initial_balance} onChange={(e) => setBankForm(p => ({ ...p, initial_balance: e.target.value }))} placeholder="0.00" />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveBank}>{bankDialog.bank ? "Salvar" : "Cadastrar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receivable Dialog */}
      <Dialog open={receivableDialog} onOpenChange={setReceivableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empresa *</Label>
              <Select value={receivableForm.company_id} onValueChange={(v) => setReceivableForm(p => ({ ...p, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={receivableForm.description} onChange={(e) => setReceivableForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Consultoria mensal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <CurrencyInput value={receivableForm.amount} onChange={(v) => setReceivableForm(p => ({ ...p, amount: v }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input type="date" value={receivableForm.due_date} onChange={(e) => setReceivableForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={receivableForm.notes} onChange={(e) => setReceivableForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivableDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveReceivable} disabled={savingReceivable}>
              {savingReceivable && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payable Dialog */}
      <Dialog open={payableDialog} onOpenChange={setPayableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fornecedor *</Label>
              <Input value={payableForm.supplier_name} onChange={(e) => setPayableForm(p => ({ ...p, supplier_name: e.target.value }))} placeholder="Ex: Fornecedor XYZ" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={payableForm.description} onChange={(e) => setPayableForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Aluguel do escritório" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <CurrencyInput value={payableForm.amount} onChange={(v) => setPayableForm(p => ({ ...p, amount: v }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input type="date" value={payableForm.due_date} onChange={(e) => setPayableForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês Referência</Label>
                <Input type="month" value={payableForm.reference_month} onChange={(e) => setPayableForm(p => ({ ...p, reference_month: e.target.value }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={payableForm.notes} onChange={(e) => setPayableForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayableDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePayable} disabled={savingPayable}>
              {savingPayable && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
