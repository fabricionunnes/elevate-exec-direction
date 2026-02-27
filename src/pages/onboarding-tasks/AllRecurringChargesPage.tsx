import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  Download,
  ArrowUpCircle,
  Calculator,
  CheckCircle2,
  Undo2,
  Clock,
  AlertTriangle,
  XCircle,
  CalendarIcon,
  Landmark,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

export default function AllRecurringChargesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("recurring");

  // Recurring charges state
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // Financial entries state
  const [payables, setPayables] = useState<FinancialEntry[]>([]);

  // Invoices state (for Recorrências tab)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; invoiceId: string; action: "confirm" | "revert"; description: string }>({
    open: false, invoiceId: "", action: "confirm", description: "",
  });
  const [manualFee, setManualFee] = useState("1.99");
  const [selectedBankId, setSelectedBankId] = useState("none");

  // Banks state
  const [banks, setBanks] = useState<any[]>([]);
  const [bankDialog, setBankDialog] = useState<{ open: boolean; bank: any | null }>({ open: false, bank: null });
  const [bankForm, setBankForm] = useState({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });

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

  useEffect(() => {
    checkAccess();
  }, []);

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
        if (role === "master") {
          setActiveTab("payables");
        } else {
          setActiveTab("recurring");
        }
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
        supabase
          .from("company_recurring_charges")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("onboarding_companies")
          .select("id, name")
          .order("name"),
        supabase
          .from("financial_payables")
          .select("*")
          .order("due_date", { ascending: false }),
        supabase
          .from("company_invoices")
          .select("*")
          .order("due_date", { ascending: true }),
        supabase
          .from("financial_banks")
          .select("*")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (chargesRes.error) throw chargesRes.error;
      if (companiesRes.error) throw companiesRes.error;

      const companiesMap = new Map(companiesRes.data?.map(c => [c.id, c.name]) || []);
      const enriched = (chargesRes.data || []).map((ch: any) => ({
        ...ch,
        company_name: companiesMap.get(ch.company_id) || "Empresa desconhecida",
      }));

      const invoicesEnriched = ((invoicesRes.data as any[]) || []).map((inv: any) => ({
        ...inv,
        company_name: companiesMap.get(inv.company_id) || "Empresa desconhecida",
      }));

      setCharges(enriched);
      setCompanies(companiesRes.data || []);
      setPayables((payablesRes.data as any) || []);
      setInvoices(invoicesEnriched);
      setBanks((banksRes.data as any) || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    }
  };

  const isMaster = userRole === "master";
  const isAdmin = userRole === "admin" || isMaster;

  // Invoice months for filter
  const invoiceMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(inv => {
      if (inv.due_date) set.add(inv.due_date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          inv.description?.toLowerCase().includes(s) ||
          inv.company_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (selectedCompany !== "all" && inv.company_id !== selectedCompany) return false;
      if (selectedStatus !== "all") {
        if (selectedStatus === "pending" && inv.status !== "pending") return false;
        if (selectedStatus === "paid" && inv.status !== "paid") return false;
        if (selectedStatus === "overdue" && inv.status !== "overdue") return false;
        if (selectedStatus === "cancelled" && inv.status !== "cancelled") return false;
      }
      if (dateFrom) {
        const fromStr = format(dateFrom, "yyyy-MM-dd");
        if (inv.due_date < fromStr) return false;
      }
      if (dateTo) {
        const toStr = format(dateTo, "yyyy-MM-dd");
        if (inv.due_date > toStr) return false;
      }
      return true;
    });
  }, [invoices, searchTerm, selectedCompany, selectedStatus, dateFrom, dateTo]);

  const filteredCharges = useMemo(() => {
    return charges.filter(ch => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          ch.description?.toLowerCase().includes(s) ||
          ch.customer_name?.toLowerCase().includes(s) ||
          ch.customer_email?.toLowerCase().includes(s) ||
          ch.company_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (selectedCompany !== "all" && ch.company_id !== selectedCompany) return false;
      if (selectedStatus === "active" && !ch.is_active) return false;
      if (selectedStatus === "inactive" && ch.is_active) return false;
      if (selectedRecurrence !== "all" && ch.recurrence !== selectedRecurrence) return false;
      return true;
    });
  }, [charges, searchTerm, selectedCompany, selectedStatus, selectedRecurrence]);

  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!p.description?.toLowerCase().includes(s)) return false;
      }
      if (selectedStatus === "pending" && p.status !== "pending") return false;
      if (selectedStatus === "paid" && p.status !== "paid") return false;
      if (selectedStatus === "overdue" && p.status !== "overdue") return false;
      if (selectedMonth !== "all" && p.reference_month !== selectedMonth) return false;
      return true;
    });
  }, [payables, searchTerm, selectedStatus, selectedMonth]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatCurrencyCents = (cents: number) => formatCurrency(cents / 100);

  const recurrenceLabel = (r: string) => {
    const map: Record<string, string> = {
      monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual", weekly: "Semanal",
    };
    return map[r] || r;
  };

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

  // Manual payment confirmation (baixa) with Asaas sync
  const handleManualPayment = async (invoiceId: string, feeCents: number, bankId: string | null) => {
    setProcessingInvoiceId(invoiceId);
    try {
      // 1. Update locally
      const today = new Date().toISOString().split("T")[0];
      const inv = invoices.find(i => i.id === invoiceId);
      const paidAmount = inv?.status === "overdue" ? inv.total_with_fees_cents : inv?.amount_cents;

      const updateData: any = {
        status: "paid",
        paid_at: today,
        paid_amount_cents: paidAmount,
        payment_fee_cents: feeCents,
      };
      if (bankId) updateData.bank_id = bankId;

      const { error } = await supabase
        .from("company_invoices")
        .update(updateData)
        .eq("id", invoiceId);

      if (error) throw error;

      // 2. Update bank balance (credit - add money, minus fee)
      if (bankId && paidAmount) {
        const netAmount = paidAmount - feeCents;
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: netAmount });
        await supabase.from("financial_bank_transactions").insert({
          bank_id: bankId,
          type: "credit",
          amount_cents: netAmount,
          description: `Recebimento: ${inv?.description} (${inv?.installment_number}/${inv?.total_installments})`,
          reference_type: "invoice",
          reference_id: invoiceId,
        } as any);
      }

      // 3. Sync with Asaas
      const { data, error: fnError } = await supabase.functions.invoke("asaas-confirm-payment", {
        body: { invoice_id: invoiceId, action: "confirm" },
      });

      if (fnError) {
        console.error("Asaas sync error:", fnError);
        toast.success("Baixa local realizada (erro ao sincronizar com Asaas)");
      } else if (data?.skipped) {
        toast.success("Baixa realizada localmente");
      } else {
        toast.success("Baixa realizada e sincronizada com Asaas ✓");
      }

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

  // Revert payment (estorno) with Asaas sync
  const handleRevertPayment = async (invoiceId: string) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const inv = invoices.find(i => i.id === invoiceId);
      const invAny = inv as any;
      const bankId = invAny?.bank_id;
      const paidAmount = invAny?.paid_amount_cents || invAny?.amount_cents || 0;
      const feeCents = invAny?.payment_fee_cents || 0;

      // 1. Update locally
      const { error } = await supabase
        .from("company_invoices")
        .update({
          status: "pending",
          paid_at: null,
          paid_amount_cents: null,
          bank_id: null,
        } as any)
        .eq("id", invoiceId);

      if (error) throw error;

      // 2. Reverse bank balance
      if (bankId) {
        const netAmount = paidAmount - feeCents;
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: -netAmount });
        await supabase.from("financial_bank_transactions").insert({
          bank_id: bankId,
          type: "debit",
          amount_cents: netAmount,
          description: `Estorno: ${inv?.description} (${inv?.installment_number}/${inv?.total_installments})`,
          reference_type: "invoice",
          reference_id: invoiceId,
        } as any);
      }

      // 3. Sync with Asaas
      const { data, error: fnError } = await supabase.functions.invoke("asaas-confirm-payment", {
        body: { invoice_id: invoiceId, action: "revert" },
      });

      if (fnError) {
        console.error("Asaas revert error:", fnError);
        toast.success("Estorno local realizado (erro ao sincronizar com Asaas)");
      } else if (data?.skipped) {
        toast.success("Estorno realizado localmente");
      } else {
        toast.success("Estorno realizado e sincronizado com Asaas ✓");
      }

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
        const { error } = await supabase
          .from("financial_banks")
          .update({
            name: bankForm.name,
            bank_code: bankForm.bank_code || null,
            agency: bankForm.agency || null,
            account_number: bankForm.account_number || null,
          } as any)
          .eq("id", bankDialog.bank.id);
        if (error) throw error;
        toast.success("Banco atualizado");
      } else {
        const { error } = await supabase
          .from("financial_banks")
          .insert({
            name: bankForm.name,
            bank_code: bankForm.bank_code || null,
            agency: bankForm.agency || null,
            account_number: bankForm.account_number || null,
            initial_balance_cents: balanceCents,
            current_balance_cents: balanceCents,
          } as any);
        if (error) throw error;
        toast.success("Banco cadastrado");
      }
      setBankDialog({ open: false, bank: null });
      setBankForm({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm("Excluir este banco?")) return;
    try {
      const { error } = await supabase.from("financial_banks").update({ is_active: false } as any).eq("id", bankId);
      if (error) throw error;
      toast.success("Banco removido");
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
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
        rows.push([
          inv.company_name || "",
          inv.description,
          `${inv.installment_number}/${inv.total_installments}`,
          formatCurrencyCents(inv.amount_cents),
          inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "",
          statusLabel(inv.status),
          inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy") : "",
        ]);
      });
    } else {
      rows = [["Empresa", "Descrição", "Valor", "Recorrência", "Status", "Criado em"]];
      filteredCharges.forEach(ch => {
        rows.push([ch.company_name || "", ch.description, formatCurrencyCents(ch.amount_cents), recurrenceLabel(ch.recurrence), ch.is_active ? "Ativa" : "Inativa", ch.created_at ? format(new Date(ch.created_at), "dd/MM/yyyy") : ""]);
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

  // Financial months for payables filter
  const financialMonths = useMemo(() => {
    const set = new Set<string>();
    payables.forEach(p => { if (p.reference_month) set.add(p.reference_month); });
    return Array.from(set).sort().reverse();
  }, [payables]);

  // Invoice summary stats
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
          <Button onClick={() => navigate("/onboarding-tasks/staff")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Nexus
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks/staff")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nexus
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Financeiro
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetFilters(); }}>
          <TabsList>
            <TabsTrigger value="recurring" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recorrências
            </TabsTrigger>
            {isMaster && (
              <TabsTrigger value="payables" className="gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Contas a Pagar
              </TabsTrigger>
            )}
            {isMaster && (
              <TabsTrigger value="banks" className="gap-2">
                <Landmark className="h-4 w-4" />
                Bancos
              </TabsTrigger>
            )}
          </TabsList>

          {/* Filters */}
          <Card className="mt-4">
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
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {(activeTab === "recurring") && (
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {activeTab === "recurring" ? (
                      <>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>

                {activeTab === "recurring" && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    {(dateFrom || dateTo) && (
                      <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                        Limpar datas
                      </Button>
                    )}
                  </>
                )}

                {activeTab === "payables" && (
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {financialMonths.map(m => (
                        <SelectItem key={m} value={m}>
                          {format(new Date(m + "-01"), "MMMM yyyy", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recorrências - Now shows invoices */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total a Receber</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrencyCents(invoiceSummary.totalPending)}
                  </div>
                  <p className="text-xs text-muted-foreground">{invoiceSummary.pendingCount} parcela(s) pendente(s)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Recebido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrencyCents(invoiceSummary.totalPaid)}
                  </div>
                  <p className="text-xs text-muted-foreground">{invoiceSummary.paidCount} parcela(s) paga(s)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Vencidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrencyCents(invoiceSummary.totalOverdue)}
                  </div>
                  <p className="text-xs text-muted-foreground">{invoiceSummary.overdueCount} parcela(s)</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma parcela encontrada</TableCell>
                        </TableRow>
                      ) : filteredInvoices.map(inv => {
                        const isOverdue = inv.status === "overdue";
                        const isPaid = inv.status === "paid";
                        const isCancelled = inv.status === "cancelled";
                        const displayAmount = isOverdue ? inv.total_with_fees_cents : inv.amount_cents;
                        const isProcessing = processingInvoiceId === inv.id;

                        return (
                          <TableRow key={inv.id} className={isOverdue ? "bg-destructive/5" : isPaid ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
                            <TableCell className="font-medium max-w-[180px] truncate">{inv.company_name}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{inv.description}</TableCell>
                            <TableCell className="text-sm">{inv.installment_number}/{inv.total_installments}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrencyCents(displayAmount)}
                              {isOverdue && inv.amount_cents !== inv.total_with_fees_cents && (
                                <div className="text-xs text-destructive">
                                  (original: {formatCurrencyCents(inv.amount_cents)})
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(inv.status)} className="gap-1">
                                <StatusIcon status={inv.status} />
                                {statusLabel(inv.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(inv as any).payment_fee_cents ? formatCurrencyCents((inv as any).payment_fee_cents) : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy") : "-"}
                              {isPaid && inv.paid_amount_cents && inv.paid_amount_cents !== inv.amount_cents && (
                                <div className="text-xs">({formatCurrencyCents(inv.paid_amount_cents)})</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isCancelled && (
                                <div className="flex items-center justify-center gap-1">
                                  {!isPaid ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      disabled={isProcessing}
                                      onClick={() => setConfirmDialog({
                                        open: true,
                                        invoiceId: inv.id,
                                        action: "confirm",
                                        description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments}) - ${formatCurrencyCents(displayAmount)}`,
                                      })}
                                    >
                                      {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                      Baixa
                                    </Button>
                                  ) : isMaster ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={isProcessing}
                                      onClick={() => setConfirmDialog({
                                        open: true,
                                        invoiceId: inv.id,
                                        action: "revert",
                                        description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments})`,
                                      })}
                                    >
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
          </TabsContent>

          {/* Contas a Pagar - Master only */}
          {isMaster && (
            <TabsContent value="payables" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total a Pagar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(filteredPayables.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">{filteredPayables.filter(p => p.status !== "paid").length} pendentes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(filteredPayables.filter(p => p.status === "paid").reduce((s, p) => s + (p.paid_amount || p.amount), 0))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Vencidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(filteredPayables.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0))}
                    </div>
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
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                          </TableRow>
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
            </TabsContent>
          )}
          {/* Bancos Tab */}
          {isMaster && (
            <TabsContent value="banks" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Contas Bancárias</h2>
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
                            setBankForm({
                              name: bank.name,
                              bank_code: bank.bank_code || "",
                              agency: bank.agency || "",
                              account_number: bank.account_number || "",
                              initial_balance: (bank.initial_balance_cents / 100).toString(),
                            });
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
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) { setConfirmDialog(prev => ({ ...prev, open: false })); setManualFee("1.99"); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "confirm" ? "Confirmar Baixa Manual" : "Confirmar Estorno"}
            </AlertDialogTitle>
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {banks.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({formatCurrencyCents(b.current_balance_cents)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Taxa cobrada (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualFee}
                  onChange={(e) => setManualFee(e.target.value)}
                  placeholder="0.00"
                  className="w-40"
                />
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
                  const feeCents = Math.round(parseFloat(manualFee || "0") * 100);
                  const bankId = selectedBankId !== "none" ? selectedBankId : null;
                  handleManualPayment(confirmDialog.invoiceId, feeCents, bankId);
                } else {
                  handleRevertPayment(confirmDialog.invoiceId);
                }
              }}
            >
              {processingInvoiceId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
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
            <AlertDialogAction onClick={handleSaveBank}>
              {bankDialog.bank ? "Salvar" : "Cadastrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
