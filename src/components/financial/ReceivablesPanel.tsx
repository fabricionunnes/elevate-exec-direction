import { useState, useEffect, useMemo } from "react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { PeriodNavigator, getDateRangeForPeriod } from "./PeriodNavigator";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  MoreVertical,
  Loader2,
  RefreshCw,
  ExternalLink,
  CalendarDays,
  Copy,
  Pencil
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { sendPaymentNotification } from "@/utils/paymentNotification";
import { ReceivablePaymentDialog } from "./ReceivablePaymentDialog";
import { EditPaymentsDialog } from "./EditPaymentsDialog";
import { ReceivableEditDialog } from "./ReceivableEditDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";

interface Receivable {
  id: string;
  company_id: string | null;
  contract_id: string | null;
  category_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  paid_amount: number | null;
  status: string;
  is_recurring: boolean;
  payment_method: string | null;
  payment_link: string | null;
  reference_month: string | null;
  notes: string | null;
  custom_receiver_name?: string | null;
  company?: { name: string } | null;
  category?: { name: string; color: string } | null;
  project_status?: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export function ReceivablesPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<import("./PeriodNavigator").PeriodType>("this_month");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditPaymentsOpen, setIsEditPaymentsOpen] = useState(false);
  const [isEditReceivableOpen, setIsEditReceivableOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    company_id: "",
    custom_receiver_name: "",
    category_id: "",
    description: "",
    amount: "",
    due_date: "",
    payment_method: "pix",
    is_recurring: false,
    reference_month: format(new Date(), "yyyy-MM"),
    notes: ""
  });
  const [showCustomReceiver, setShowCustomReceiver] = useState(false);

  // paymentData removed — now using ReceivablePaymentDialog

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load receivables with relations
      const { data: receivablesData, error: receivablesError } = await supabase
        .from("financial_receivables")
        .select(`
          *,
          company:company_id(name),
          category:category_id(name, color)
        `)
        .order("due_date", { ascending: true });

      if (receivablesError) throw receivablesError;

      // Load companies from Nexus
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      // Load income categories
      const { data: categoriesData } = await supabase
        .from("financial_categories")
        .select("id, name, color")
        .eq("type", "income")
        .eq("is_active", true)
        .order("sort_order");

      // Load project statuses by company
      const companyIds = [...new Set((receivablesData || []).map(r => r.company_id).filter(Boolean))];
      const projectStatusMap: Record<string, string> = {};
      if (companyIds.length > 0) {
        const { data: projects } = await supabase
          .from("onboarding_projects")
          .select("onboarding_company_id, status")
          .in("onboarding_company_id", companyIds);
        projects?.forEach(p => {
          if (p.onboarding_company_id) {
            projectStatusMap[p.onboarding_company_id] = p.status;
          }
        });
      }

      const enrichedReceivables = (receivablesData || []).map(r => ({
        ...r,
        project_status: r.company_id ? projectStatusMap[r.company_id] || null : null
      }));

      setCompanies(companiesData || []);
      setCategories(categoriesData || []);

      // Update overdue status using local date to avoid timezone issues
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      
      // Mark pending items with due_date BEFORE today as overdue
      const overdueIds = receivablesData
        ?.filter(r => r.status === "pending" && r.due_date < today)
        .map(r => r.id) || [];

      if (overdueIds.length > 0) {
        await supabase
          .from("financial_receivables")
          .update({ status: "overdue" })
          .in("id", overdueIds);
      }

      // Repair: revert items incorrectly marked overdue when due_date is today or future
      const repairIds = receivablesData
        ?.filter(r => r.status === "overdue" && r.due_date >= today)
        .map(r => r.id) || [];

      if (repairIds.length > 0) {
        await supabase
          .from("financial_receivables")
          .update({ status: "pending" })
          .in("id", repairIds);
      }

      // Update local state with corrected statuses
      const overdueSet = new Set(overdueIds);
      const repairSet = new Set(repairIds);
      const correctedReceivables = enrichedReceivables.map(r => {
        if (repairSet.has(r.id)) return { ...r, status: "pending" };
        if (overdueSet.has(r.id)) return { ...r, status: "overdue" };
        return r;
      });
      setReceivables(correctedReceivables);

    } catch (error) {
      console.error("Error loading receivables:", error);
      toast.error("Erro ao carregar contas a receber");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReceivable = async () => {
    try {
      const { error } = await supabase.from("financial_receivables").insert({
        company_id: formData.company_id || null,
        custom_receiver_name: !formData.company_id && formData.custom_receiver_name ? formData.custom_receiver_name : null,
        category_id: formData.category_id || null,
        description: formData.description,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        payment_method: formData.payment_method,
        is_recurring: formData.is_recurring,
        reference_month: formData.reference_month,
        notes: formData.notes || null,
        status: "pending"
      });

      if (error) throw error;

      toast.success("Conta a receber criada com sucesso!");
      setIsAddDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding receivable:", error);
      toast.error("Erro ao criar conta a receber");
    }
  };

  const handlePaymentSuccess = () => {
    if (selectedReceivable) {
      const companyName = selectedReceivable.company?.name || selectedReceivable.custom_receiver_name || "Empresa não identificada";
      sendPaymentNotification(companyName, selectedReceivable.amount, selectedReceivable.description);
    }
    setIsPayDialogOpen(false);
    setSelectedReceivable(null);
    loadData();
  };

  const handleCancelReceivable = async (id: string) => {
    try {
      const { error } = await supabase
        .from("financial_receivables")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      toast.success("Conta cancelada");
      loadData();
    } catch (error) {
      console.error("Error cancelling receivable:", error);
      toast.error("Erro ao cancelar conta");
    }
  };

  const handleEditDueDate = async () => {
    if (!selectedReceivable || !editDueDate) return;

    try {
      const { error } = await supabase
        .from("financial_receivables")
        .update({ due_date: editDueDate })
        .eq("id", selectedReceivable.id);

      if (error) throw error;

      toast.success("Vencimento atualizado com sucesso!");
      setIsEditDialogOpen(false);
      setSelectedReceivable(null);
      loadData();
    } catch (error) {
      console.error("Error updating due date:", error);
      toast.error("Erro ao atualizar vencimento");
    }
  };

  const generateRecurringReceivables = async () => {
    setIsGeneratingRecurring(true);
    try {
      // Get active companies with contract value
      const { data: activeCompanies, error: companiesError } = await supabase
        .from("onboarding_companies")
        .select("id, name, contract_value")
        .eq("status", "active")
        .gt("contract_value", 0);

      if (companiesError) throw companiesError;

      if (!activeCompanies || activeCompanies.length === 0) {
        toast.info("Nenhum cliente recorrente encontrado");
        setIsGeneratingRecurring(false);
        return;
      }

      const currentMonth = format(new Date(), "yyyy-MM");
      const defaultPaymentDay = 10;
      
      // Check which companies already have receivables for this month
      const { data: existingReceivables } = await supabase
        .from("financial_receivables")
        .select("company_id")
        .eq("reference_month", currentMonth)
        .eq("is_recurring", true);

      const existingCompanyIds = new Set(existingReceivables?.map(r => r.company_id) || []);

      // Filter companies that don't have receivables yet
      const companiesToGenerate = activeCompanies.filter(c => !existingCompanyIds.has(c.id));

      if (companiesToGenerate.length === 0) {
        toast.info("Todas as contas recorrentes já foram geradas para este mês");
        setIsGeneratingRecurring(false);
        return;
      }

      // Generate receivables for each company
      const receivablesToInsert = companiesToGenerate.map(company => {
        const dueDate = new Date();
        dueDate.setDate(defaultPaymentDay);
        
        return {
          company_id: company.id,
          description: `Mensalidade ${format(new Date(), "MMMM/yyyy", { locale: ptBR })} - ${company.name}`,
          amount: Number(company.contract_value),
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "pending",
          is_recurring: true,
          reference_month: currentMonth,
          payment_method: "pix"
        };
      });

      const { error: insertError } = await supabase
        .from("financial_receivables")
        .insert(receivablesToInsert);

      if (insertError) throw insertError;

      toast.success(`${companiesToGenerate.length} contas recorrentes geradas com sucesso!`);
      loadData();
    } catch (error) {
      console.error("Error generating recurring receivables:", error);
      toast.error("Erro ao gerar contas recorrentes");
    } finally {
      setIsGeneratingRecurring(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_id: "",
      custom_receiver_name: "",
      category_id: "",
      description: "",
      amount: "",
      due_date: "",
      payment_method: "pix",
      is_recurring: false,
      reference_month: format(new Date(), "yyyy-MM"),
      notes: ""
    });
    setShowCustomReceiver(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getStatusBadge = (status: string, dueDate?: string) => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const isDueToday = dueDate === todayStr && status === "pending";
    const isPastDue = dueDate && dueDate < todayStr && status === "pending";

    const isOverduePartial = status === "partial" && dueDate && dueDate < todayStr;
    if (isOverduePartial) {
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Vencido (Parcial)</Badge>;
    }
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</Badge>;
      case "partial":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20"><Clock className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case "pending":
        if (isPastDue) {
          return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Vencido</Badge>;
        }
        if (isDueToday) {
          return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" /> Vence Hoje</Badge>;
        }
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Vencido</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProjectStatusBadge = (status: string | null | undefined) => {
    if (!status) return <span className="text-muted-foreground text-xs">—</span>;
    const map: Record<string, { label: string; className: string }> = {
      active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
      notice: { label: "Aviso", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
      cancellation_signaled: { label: "Cancel. Sinalizado", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
      closed: { label: "Encerrado", className: "bg-red-500/10 text-red-600 border-red-500/20" },
      completed: { label: "Concluído", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
      paused: { label: "Pausado", className: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
    };
    const s = map[status] || { label: status, className: "bg-gray-500/10 text-gray-600 border-gray-500/20" };
    return <Badge className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };


  const minDate = "2025-01";
  
  // Using PeriodNavigator's getDateRangeForPeriod instead of local function

  const filteredReceivables = receivables.filter((r) => {
    // Only show receivables from January 2025 onwards
    if (r.due_date < minDate) return false;
    
    const matchesSearch =
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.custom_receiver_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(r.status) ||
      (statusFilter.includes("overdue") && r.status === "partial" && r.due_date < format(new Date(), "yyyy-MM-dd"));
    const matchesCategory = categoryFilter.length === 0 || (r.category_id && categoryFilter.includes(r.category_id));
    
    // Period filter
    const { start, end } = getDateRangeForPeriod(periodFilter, periodOffset);
    let matchesPeriod = true;
    if (start && end) {
      const dueDate = parseISO(r.due_date);
      matchesPeriod = dueDate >= startOfDay(start) && dueDate <= endOfDay(end);
    }
    
    return matchesSearch && matchesStatus && matchesCategory && matchesPeriod;
  });

  // Calculate totals based on filtered data
  const todayForTotals = format(new Date(), "yyyy-MM-dd");
  
  const paidReceivables = filteredReceivables.filter(r => r.status === "paid");
  const totalReceived = paidReceivables.reduce((sum, r) => {
    // paid_amount is already the net credited amount (after fees and discounts)
    return sum + Number(r.paid_amount || r.amount);
  }, 0);
  
  const totals = {
    pending: filteredReceivables.filter(r => r.status === "pending" && !(r.due_date < todayForTotals)).reduce((sum, r) => sum + Number(r.amount), 0),
    overdue: filteredReceivables.filter(r => r.status === "overdue" || (r.status === "pending" && r.due_date < todayForTotals)).reduce((sum, r) => sum + Number(r.amount), 0),
    paid: totalReceived
  };

  const totalPages = Math.ceil(filteredReceivables.length / pageSize);
  const paginatedReceivables = filteredReceivables.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Contas a Receber</h2>
          <p className="text-muted-foreground">
            Gerencie suas receitas e cobranças
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={generateRecurringReceivables}
            disabled={isGeneratingRecurring}
          >
            {isGeneratingRecurring ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Gerar Recorrentes
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Conta a Receber</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Recebedor / Empresa *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-0.5 px-2 text-xs"
                      onClick={() => {
                        setShowCustomReceiver(!showCustomReceiver);
                        if (!showCustomReceiver) {
                          setFormData({ ...formData, company_id: "", custom_receiver_name: "" });
                        } else {
                          setFormData({ ...formData, custom_receiver_name: "" });
                        }
                      }}
                    >
                      {showCustomReceiver ? "Selecionar empresa" : "+ Novo recebedor"}
                    </Button>
                  </div>
                  {showCustomReceiver ? (
                    <Input
                      value={formData.custom_receiver_name}
                      onChange={(e) => setFormData({ ...formData, custom_receiver_name: e.target.value, company_id: "" })}
                      placeholder="Digite o nome do recebedor"
                    />
                  ) : (
                    <SearchableSelect
                      value={formData.company_id}
                      onValueChange={(v) => setFormData({ ...formData, company_id: v })}
                      options={companies.map((c) => ({ value: c.id, label: c.name }))}
                      placeholder="Pesquisar empresa..."
                      emptyMessage="Nenhuma empresa encontrada."
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Mensalidade Janeiro/2025"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento *</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                        <SelectItem value="transfer">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mês de Referência</Label>
                    <Input
                      type="month"
                      value={formData.reference_month}
                      onChange={(e) => setFormData({ ...formData, reference_month: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Anotações sobre esta conta..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddReceivable}
                    disabled={!formData.description || !formData.amount || !formData.due_date}
                  >
                    Criar Conta
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totals.pending)}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Atraso</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recebido</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.paid)}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <PeriodNavigator
              period={periodFilter}
              offset={periodOffset}
              onPeriodChange={setPeriodFilter}
              onOffsetChange={setPeriodOffset}
            />
            <MultiSelectFilter
              options={[
                { value: "pending", label: "Pendentes" },
                { value: "partial", label: "Parciais" },
                { value: "overdue", label: "Atrasados" },
                { value: "paid", label: "Pagos" },
                { value: "cancelled", label: "Cancelados" },
              ]}
              selected={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status"
              allLabel="Todos"
              className="w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={paginatedReceivables.length > 0 && paginatedReceivables.every(r => selectedIds.has(r.id))}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      paginatedReceivables.forEach(r => checked ? next.add(r.id) : next.delete(r.id));
                      setSelectedIds(next);
                    }}
                  />
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReceivables.map((receivable) => (
                  <TableRow key={receivable.id} data-state={selectedIds.has(receivable.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(receivable.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          checked ? next.add(receivable.id) : next.delete(receivable.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{receivable.description}</p>
                        {receivable.category && (
                          <p className="text-xs text-muted-foreground">{receivable.category.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{receivable.company?.name || receivable.custom_receiver_name || "-"}</TableCell>
                    <TableCell>
                      {format(parseISO(receivable.due_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div>
                        <span>{formatCurrency(receivable.amount)}</span>
                        {receivable.status === "partial" && receivable.paid_amount != null && receivable.paid_amount > 0 && (
                          <p className="text-xs text-orange-600">
                            Pago: {formatCurrency(receivable.paid_amount)} • Resta: {formatCurrency(receivable.amount - receivable.paid_amount)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(receivable.status, receivable.due_date)}</TableCell>
                    <TableCell>{getProjectStatusBadge(receivable.project_status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedReceivable(receivable);
                              setIsEditReceivableOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {receivable.status !== "paid" && receivable.status !== "cancelled" && (
                            <>
                              <DropdownMenuItem
                              onClick={() => {
                                  setSelectedReceivable(receivable);
                                  setIsPayDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {receivable.status === "partial" ? "Continuar Baixa" : "Dar Baixa"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedReceivable(receivable);
                                  setEditDueDate(receivable.due_date);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                Editar Vencimento
                              </DropdownMenuItem>
                            </>
                          )}
                          {(receivable.status === "partial" || receivable.status === "paid") && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedReceivable(receivable);
                                setIsEditPaymentsOpen(true);
                              }}
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Editar Pagamentos
                            </DropdownMenuItem>
                          )}
                          {receivable.payment_link && (
                            <DropdownMenuItem
                              onClick={() => window.open(receivable.payment_link!, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Link de Pagamento
                            </DropdownMenuItem>
                          )}
                          {receivable.status !== "cancelled" && receivable.status !== "paid" && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleCancelReceivable(receivable.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setFormData({
                                company_id: receivable.company_id || "",
                                custom_receiver_name: receivable.custom_receiver_name || "",
                                category_id: receivable.category_id || "",
                                description: receivable.description,
                                amount: String(receivable.amount),
                                due_date: receivable.due_date,
                                payment_method: receivable.payment_method || "pix",
                                is_recurring: receivable.is_recurring,
                                reference_month: receivable.reference_month || format(new Date(), "yyyy-MM"),
                                notes: receivable.notes || ""
                              });
                              setShowCustomReceiver(!!receivable.custom_receiver_name);
                              setIsAddDialogOpen(true);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selection Summary */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
              <div className="h-4 w-px bg-border" />
              <span className="text-sm">
                Total a receber:{" "}
                <strong className="text-primary">
                  {formatCurrency(
                    filteredReceivables
                      .filter(r => selectedIds.has(r.id))
                      .reduce((sum, r) => {
                        if (r.status === "partial" && r.paid_amount) {
                          return sum + (r.amount - r.paid_amount);
                        }
                        return sum + Number(r.amount);
                      }, 0)
                  )}
                </strong>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filteredReceivables.length} registro(s)
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 por página</SelectItem>
              <SelectItem value="50">50 por página</SelectItem>
              <SelectItem value="100">100 por página</SelectItem>
            </SelectContent>
          </Select>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-2">{currentPage + 1}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                Próximo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <ReceivablePaymentDialog
        open={isPayDialogOpen}
        onOpenChange={setIsPayDialogOpen}
        receivable={selectedReceivable}
        onSuccess={handlePaymentSuccess}
      />

      {/* Edit Due Date Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vencimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{selectedReceivable?.description}</p>
              <p className="text-sm text-muted-foreground">
                {selectedReceivable?.company?.name}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Nova Data de Vencimento</Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditDueDate}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payments Dialog */}
      <EditPaymentsDialog
        open={isEditPaymentsOpen}
        onOpenChange={setIsEditPaymentsOpen}
        receivable={selectedReceivable}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Edit Receivable Dialog */}
      <ReceivableEditDialog
        open={isEditReceivableOpen}
        onOpenChange={setIsEditReceivableOpen}
        receivable={selectedReceivable}
        companies={companies}
        categories={categories}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
