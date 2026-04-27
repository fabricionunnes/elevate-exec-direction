import { useState, useEffect } from "react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { PeriodNavigator, getDateRangeForPeriod } from "./PeriodNavigator";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  MoreVertical,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Repeat,
  CalendarDays,
  Copy,
  Pencil
} from "lucide-react";
import { PayableEditDialog } from "./PayableActionDialogs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useFinancialPermissions } from "@/hooks/useFinancialPermissions";
import { sendPaymentNotification } from "@/utils/paymentNotification";

interface Payable {
  id: string;
  supplier_name: string;
  category_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  paid_amount: number | null;
  status: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  payment_method: string | null;
  cost_center: string | null;
  cost_center_id: string | null;
  notes: string | null;
  installment_number: number | null;
  total_installments: number | null;
  category?: { name: string; color: string } | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
}

interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
}

export function PayablesPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [costCenterFilter, setCostCenterFilter] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<import("./PeriodNavigator").PeriodType>("this_month");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Payable | null>(null);
  const [deleteScope, setDeleteScope] = useState<"single" | "future">("single");
  const [isEditPayableOpen, setIsEditPayableOpen] = useState(false);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const { isMaster } = useFinancialPermissions();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    supplier_name: "",
    category_id: "",
    description: "",
    amount: "",
    due_date: "",
    payment_method: "pix",
    is_recurring: false,
    recurrence_type: "monthly",
    recurring_count: "12",
    cost_center: "",
    reference_month: format(new Date(), "yyyy-MM"),
    notes: "",
    has_installments: false,
    total_installments: "1",
    cost_type: "" as "" | "fixed" | "variable"
  });

  const [paymentData, setPaymentData] = useState({
    paid_date: format(new Date(), "yyyy-MM-dd"),
    paid_amount: "",
    bank_account_id: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: payablesData, error: payablesError } = await supabase
        .from("financial_payables")
        .select(`*`)
        .order("due_date", { ascending: true });

      if (payablesError) throw payablesError;

      const { data: categoriesData } = await supabase
        .from("financial_categories")
        .select("id, name, color")
        .eq("type", "expense")
        .eq("is_active", true)
        .order("sort_order");

      const { data: banksData } = await supabase
        .from("financial_bank_accounts")
        .select("id, name, bank_name")
        .eq("is_active", true)
        .order("name");

      let suppliersData: any[] = [];
      try {
        const { data: sData } = await (supabase as any)
          .from("financial_suppliers")
          .select("id, name, is_active")
          .eq("is_active", true)
          .order("name");
        suppliersData = sData || [];
      } catch (e) {
        console.warn("Could not load suppliers:", e);
      }

      setCategories(categoriesData || []);
      setBankAccounts(banksData || []);
      setSuppliers(suppliersData);

      // Update overdue status for pending items past due date
      const today = format(new Date(), "yyyy-MM-dd");
      const overdueIds = payablesData
        ?.filter(p => p.status === "pending" && p.due_date < today)
        .map(p => p.id) || [];

      if (overdueIds.length > 0) {
        await supabase
          .from("financial_payables")
          .update({ status: "overdue" })
          .in("id", overdueIds);
      }

      // Update local state with corrected overdue statuses
      const overdueSet = new Set(overdueIds);
      const correctedPayables = (payablesData || []).map(p => 
        overdueSet.has(p.id) ? { ...p, status: "overdue" } : p
      );
      setPayables(correctedPayables);

    } catch (error) {
      console.error("Error loading payables:", error);
      toast.error("Erro ao carregar contas a pagar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayable = async () => {
    try {
      const baseAmount = parseFloat(formData.amount);
      
      // Determine how many entries to create
      let totalEntries: number;
      if (formData.is_recurring) {
        totalEntries = parseInt(formData.recurring_count) || 12;
      } else if (formData.has_installments) {
        totalEntries = parseInt(formData.total_installments) || 1;
      } else {
        totalEntries = 1;
      }

      const entryAmount = formData.has_installments && !formData.is_recurring
        ? baseAmount / totalEntries
        : baseAmount;

      // Determine month offset based on recurrence type
      const getMonthOffset = (recurrenceType: string): number => {
        switch (recurrenceType) {
          case "monthly": return 1;
          case "quarterly": return 3;
          case "semiannual": return 6;
          case "annual": return 12;
          default: return 1;
        }
      };

      const isWeekly = formData.recurrence_type === "weekly";
      const monthOffset = formData.is_recurring && !isWeekly
        ? getMonthOffset(formData.recurrence_type) 
        : 1;

      const payablesToInsert = [];
      let currentDueDate = new Date(formData.due_date);

      for (let i = 1; i <= totalEntries; i++) {
        const refMonth = format(currentDueDate, "yyyy-MM");
        payablesToInsert.push({
          supplier_name: formData.supplier_name,
          category_id: formData.category_id || null,
          description: totalEntries > 1
            ? `${formData.description} (${i}/${totalEntries})`
            : formData.description,
          amount: entryAmount,
          due_date: format(currentDueDate, "yyyy-MM-dd"),
          payment_method: formData.payment_method,
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
          cost_center: formData.cost_center || null,
          reference_month: refMonth,
          notes: formData.notes || null,
          installment_number: totalEntries > 1 ? i : null,
          total_installments: totalEntries > 1 ? totalEntries : null,
          status: "pending",
          cost_type: formData.cost_type || null
        });

        // Advance date
        if (isWeekly) {
          currentDueDate.setDate(currentDueDate.getDate() + 7);
        } else {
          currentDueDate.setMonth(currentDueDate.getMonth() + monthOffset);
        }
      }

      console.log("Inserting payables:", JSON.stringify(payablesToInsert, null, 2));
      const { error } = await supabase.from("financial_payables").insert(payablesToInsert);

      if (error) {
        console.error("Insert error details:", JSON.stringify(error));
        throw error;
      }

      toast.success(
        totalEntries > 1
          ? `${totalEntries} lançamentos criados com sucesso!`
          : "Conta a pagar criada com sucesso!"
      );
      setIsAddDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding payable:", error);
      toast.error("Erro ao criar conta a pagar");
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedPayable) return;

    try {
      const newPayment = parseFloat(paymentData.paid_amount) || 0;
      const previouslyPaid = selectedPayable.status === "partial" ? (selectedPayable.paid_amount || 0) : 0;
      const totalPaid = previouslyPaid + newPayment;
      const isFullyPaid = totalPaid >= selectedPayable.amount;

      const { error } = await supabase
        .from("financial_payables")
        .update({
          status: isFullyPaid ? "paid" : "partial",
          paid_date: paymentData.paid_date,
          paid_amount: totalPaid,
          bank_account_id: paymentData.bank_account_id || null
        })
        .eq("id", selectedPayable.id);

      if (error) throw error;

      // Update bank balance - debit only the new payment amount
      if (paymentData.bank_account_id && newPayment > 0) {
        const { data: bankData } = await supabase
          .from("financial_bank_accounts")
          .select("current_balance")
          .eq("id", paymentData.bank_account_id)
          .single();
        
        if (bankData) {
          await supabase
            .from("financial_bank_accounts")
            .update({ current_balance: Number(bankData.current_balance) - newPayment })
            .eq("id", paymentData.bank_account_id);
        }
      }

      // Send payment notification
      const supplierName = selectedPayable.supplier_name || "Fornecedor não identificado";
      sendPaymentNotification(supplierName, newPayment, selectedPayable.description);

      toast.success(isFullyPaid ? "Pagamento total registrado!" : "Pagamento parcial registrado!");
      setIsPayDialogOpen(false);
      setSelectedPayable(null);
      loadData();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Erro ao registrar pagamento");
    }
  };

  const handleCancelPayable = async (id: string) => {
    try {
      const { error } = await supabase
        .from("financial_payables")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      toast.success("Conta cancelada");
      loadData();
    } catch (error) {
      console.error("Error cancelling payable:", error);
      toast.error("Erro ao cancelar conta");
    }
  };

  const handleReopenPayable = async (payable: Payable) => {
    try {
      // If there was a bank account linked, reverse the balance
      const { data: payableData } = await supabase
        .from("financial_payables")
        .select("paid_amount, bank_account_id")
        .eq("id", payable.id)
        .single();

      if (payableData?.bank_account_id && payableData?.paid_amount) {
        const { data: bankData } = await supabase
          .from("financial_bank_accounts")
          .select("current_balance")
          .eq("id", payableData.bank_account_id)
          .single();

        if (bankData) {
          await supabase
            .from("financial_bank_accounts")
            .update({ current_balance: Number(bankData.current_balance) + Number(payableData.paid_amount) })
            .eq("id", payableData.bank_account_id);
        }
      }

      const { error } = await supabase
        .from("financial_payables")
        .update({ status: "pending", paid_date: null, paid_amount: null, bank_account_id: null })
        .eq("id", payable.id);

      if (error) throw error;

      toast.success("Conta reaberta com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error reopening payable:", error);
      toast.error("Erro ao reabrir conta");
    }
  };

  const handleDeletePayable = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteScope === "single") {
        const { error } = await supabase
          .from("financial_payables")
          .delete()
          .eq("id", deleteTarget.id);
        if (error) throw error;
        toast.success("Conta excluída com sucesso!");
      } else {
        // Delete this and all future unpaid with same supplier
        const { error } = await supabase
          .from("financial_payables")
          .delete()
          .eq("supplier_name", deleteTarget.supplier_name)
          .gte("installment_number", deleteTarget.installment_number || 0)
          .in("status", ["pending", "overdue", "partial", "cancelled"]);
        if (error) throw error;
        toast.success("Contas excluídas com sucesso!");
      }
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteScope("single");
      loadData();
    } catch (error) {
      console.error("Error deleting payable:", error);
      toast.error("Erro ao excluir conta");
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_name: "",
      category_id: "",
      description: "",
      amount: "",
      due_date: "",
      payment_method: "pix",
      is_recurring: false,
      recurrence_type: "monthly",
      recurring_count: "12",
      cost_center: "",
      reference_month: format(new Date(), "yyyy-MM"),
      notes: "",
      has_installments: false,
      total_installments: "1",
      cost_type: "" as "" | "fixed" | "variable"
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getStatusBadge = (status: string, dueDate?: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const isOverduePartial = status === "partial" && dueDate && dueDate < today;
    if (isOverduePartial) {
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Vencido (Parcial)</Badge>;
    }
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</Badge>;
      case "partial":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20"><Clock className="h-3 w-3 mr-1" /> Pago Parcial</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Vencido</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Using PeriodNavigator's getDateRangeForPeriod instead of local function

  const filteredPayables = payables.filter((p) => {
    const matchesSearch = 
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(p.status) || 
      (statusFilter.includes("overdue") && p.status === "partial" && p.due_date < format(new Date(), "yyyy-MM-dd"));
    const matchesCategory = categoryFilter.length === 0 || (p.category_id && categoryFilter.includes(p.category_id));
    const matchesCostCenter = costCenterFilter.length === 0 || (p.cost_center && costCenterFilter.includes(p.cost_center));
    
    // Period filter
    const { start, end } = getDateRangeForPeriod(periodFilter, periodOffset);
    let matchesPeriod = true;
    if (start && end) {
      const dueDate = parseISO(p.due_date);
      matchesPeriod = dueDate >= startOfDay(start) && dueDate <= endOfDay(end);
    }
    
    return matchesSearch && matchesStatus && matchesCategory && matchesCostCenter && matchesPeriod;
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const totals = {
    pending: filteredPayables.filter(p => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0),
    overdue: filteredPayables
      .filter(p => p.status === "overdue")
      .reduce((sum, p) => sum + Number(p.amount), 0)
      + filteredPayables
        .filter(p => p.status === "partial" && p.due_date < today)
        .reduce((sum, p) => sum + (Number(p.amount) - Number(p.paid_amount || 0)), 0),
    paid: filteredPayables.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0)
  };

  const totalPages = Math.ceil(filteredPayables.length / pageSize);
  const paginatedPayables = filteredPayables.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

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
          <h2 className="text-2xl font-bold">Contas a Pagar</h2>
          <p className="text-muted-foreground">
            Gerencie suas despesas e pagamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                <DialogTitle>Nova Conta a Pagar</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Fornecedor *</Label>
                  {suppliers.length > 0 ? (
                    <Select
                      value={formData.supplier_name}
                      onValueChange={(v) => setFormData({ ...formData, supplier_name: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={formData.supplier_name}
                      onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                      placeholder="Nome do fornecedor"
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
                  <div className="space-y-2">
                    <Label>Centro de Custo</Label>
                    <Input
                      value={formData.cost_center}
                      onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                      placeholder="Ex: Marketing"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Custo</Label>
                  <Select
                    value={formData.cost_type}
                    onValueChange={(v) => setFormData({ ...formData, cost_type: v as "" | "fixed" | "variable" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Custo Fixo</SelectItem>
                      <SelectItem value="variable">Custo Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Assinatura HubSpot"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Total *</Label>
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

                {!formData.is_recurring && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_installments"
                    checked={formData.has_installments}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, has_installments: checked as boolean })
                    }
                  />
                  <Label htmlFor="has_installments">Parcelar pagamento</Label>
                </div>
                )}

                {formData.has_installments && (
                  <div className="space-y-2">
                    <Label>Número de Parcelas</Label>
                    <Input
                      type="number"
                      min="2"
                      max="48"
                      value={formData.total_installments}
                      onChange={(e) => setFormData({ ...formData, total_installments: e.target.value })}
                    />
                    {formData.amount && formData.total_installments && (
                      <p className="text-sm text-muted-foreground">
                        {formData.total_installments}x de {formatCurrency(parseFloat(formData.amount) / parseInt(formData.total_installments))}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, is_recurring: checked as boolean, has_installments: false })
                    }
                  />
                  <Label htmlFor="is_recurring">Conta Recorrente</Label>
                </div>

                {formData.is_recurring && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Recorrência</Label>
                      <Select
                        value={formData.recurrence_type}
                        onValueChange={(v) => setFormData({ ...formData, recurrence_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de lançamentos</Label>
                      <Input
                        type="number"
                        min="2"
                        max="60"
                        value={formData.recurring_count}
                        onChange={(e) => setFormData({ ...formData, recurring_count: e.target.value })}
                      />
                      {formData.amount && formData.recurring_count && (
                        <p className="text-sm text-muted-foreground">
                          {formData.recurring_count}x de {formatCurrency(parseFloat(formData.amount))} ({formData.recurrence_type === "weekly" ? "semanal" : formData.recurrence_type === "monthly" ? "mensal" : formData.recurrence_type === "quarterly" ? "trimestral" : formData.recurrence_type === "semiannual" ? "semestral" : "anual"})
                        </p>
                      )}
                    </div>
                  </div>
                )}

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
                    onClick={handleAddPayable}
                    disabled={!formData.supplier_name || !formData.description || !formData.amount || !formData.due_date}
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
                <p className="text-sm text-muted-foreground">Pago</p>
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
                placeholder="Buscar por descrição ou fornecedor..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
                className="pl-10"
              />
            </div>
            <PeriodNavigator
              period={periodFilter}
              offset={periodOffset}
              onPeriodChange={(v) => { setPeriodFilter(v); setCurrentPage(0); }}
              onOffsetChange={(o) => { setPeriodOffset(o); setCurrentPage(0); }}
            />
            <MultiSelectFilter
              options={[
                { value: "pending", label: "Pendentes" },
                { value: "partial", label: "Pago Parcial" },
                { value: "overdue", label: "Vencidos" },
                { value: "paid", label: "Pagos" },
                { value: "cancelled", label: "Cancelados" },
              ]}
              selected={statusFilter}
              onChange={(v) => { setStatusFilter(v); setCurrentPage(0); }}
              placeholder="Status"
              allLabel="Todos"
              className="w-[180px]"
            />
            <MultiSelectFilter
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              selected={categoryFilter}
              onChange={(v) => { setCategoryFilter(v); setCurrentPage(0); }}
              placeholder="Categoria"
              allLabel="Todas as categorias"
              className="w-[200px]"
            />
            <MultiSelectFilter
              options={costCenters.map((cc: any) => ({ value: cc.id ?? cc.name, label: cc.name }))}
              selected={costCenterFilter}
              onChange={(v) => { setCostCenterFilter(v); setCurrentPage(0); }}
              placeholder="Centro de Custo"
              allLabel="Todos os Centros de Custo"
              className="w-[220px]"
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
                    checked={paginatedPayables.length > 0 && paginatedPayables.every(p => selectedIds.has(p.id))}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      paginatedPayables.forEach(p => checked ? next.add(p.id) : next.delete(p.id));
                      setSelectedIds(next);
                    }}
                  />
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a pagar encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayables.map((payable) => (
                  <TableRow key={payable.id} data-state={selectedIds.has(payable.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(payable.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          checked ? next.add(payable.id) : next.delete(payable.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {payable.is_recurring && (
                          <Repeat className="h-3 w-3 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{payable.description}</p>
                          {payable.category && (
                            <p className="text-xs text-muted-foreground">{payable.category.name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{payable.supplier_name}</TableCell>
                    <TableCell>
                      {format(parseISO(payable.due_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payable.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payable.status, payable.due_date)}</TableCell>
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
                              setSelectedPayable(payable);
                              setIsEditPayableOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {payable.status !== "paid" && payable.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPayable(payable);
                                const remaining = payable.status === "partial"
                                  ? payable.amount - (payable.paid_amount || 0)
                                  : payable.amount;
                                setPaymentData({
                                  paid_date: format(new Date(), "yyyy-MM-dd"),
                                  paid_amount: String(remaining),
                                  bank_account_id: ""
                                });
                                setIsPayDialogOpen(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          {payable.status !== "cancelled" && payable.status !== "paid" && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleCancelPayable(payable.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                          {(payable.status === "paid" || payable.status === "partial" || payable.status === "cancelled") && (
                            <DropdownMenuItem
                              onClick={() => handleReopenPayable(payable)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reabrir
                            </DropdownMenuItem>
                          )}
                          {isMaster && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setDeleteTarget(payable);
                                setDeleteScope("single");
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setFormData({
                                supplier_name: payable.supplier_name,
                                category_id: payable.category_id || "",
                                description: payable.description,
                                amount: String(payable.amount),
                                due_date: payable.due_date,
                                payment_method: payable.payment_method || "pix",
                                is_recurring: false,
                                recurrence_type: "monthly",
                                recurring_count: "12",
                                cost_center: payable.cost_center || "",
                                reference_month: format(new Date(), "yyyy-MM"),
                                notes: payable.notes || "",
                                has_installments: false,
                                total_installments: "1",
                                cost_type: "" as "" | "fixed" | "variable"
                              });
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
                Total a pagar:{" "}
                <strong className="text-primary">
                  {formatCurrency(
                    payables
                      .filter(p => selectedIds.has(p.id))
                      .reduce((sum, p) => {
                        if (p.status === "partial" && p.paid_amount) {
                          return sum + (p.amount - p.paid_amount);
                        }
                        return sum + Number(p.amount);
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
          {filteredPayables.length} registro(s)
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
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{selectedPayable?.description}</p>
              <p className="text-sm text-muted-foreground">
                {selectedPayable?.supplier_name} • Valor total: {selectedPayable && formatCurrency(selectedPayable.amount)}
              </p>
              {selectedPayable?.status === "partial" && selectedPayable.paid_amount && (
                <div className="mt-2 text-sm space-y-1">
                  <p className="text-emerald-600">Já pago: {formatCurrency(selectedPayable.paid_amount)}</p>
                  <p className="text-orange-600 font-medium">Restante: {formatCurrency(selectedPayable.amount - selectedPayable.paid_amount)}</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={paymentData.paid_date}
                  onChange={(e) => setPaymentData({ ...paymentData, paid_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Pago</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.paid_amount}
                  onChange={(e) => setPaymentData({ ...paymentData, paid_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select
                value={paymentData.bank_account_id}
                onValueChange={(v) => setPaymentData({ ...paymentData, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name} ({bank.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleMarkAsPaid}>
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta a Pagar</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <div className="space-y-4">
                  <p>
                    Deseja excluir <strong>{deleteTarget.description}</strong> ({deleteTarget.supplier_name})?
                  </p>
                  {deleteTarget.installment_number && deleteTarget.total_installments && deleteTarget.total_installments > 1 && (
                    <RadioGroup value={deleteScope} onValueChange={(v) => setDeleteScope(v as "single" | "future")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id="delete-single" />
                        <Label htmlFor="delete-single">Somente esta</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="future" id="delete-future" />
                        <Label htmlFor="delete-future">Esta e todas as futuras não pagas</Label>
                      </div>
                    </RadioGroup>
                  )}
                  <p className="text-sm text-destructive">Esta ação não pode ser desfeita.</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Payable Dialog */}
      <PayableEditDialog
        open={isEditPayableOpen}
        onOpenChange={setIsEditPayableOpen}
        payable={selectedPayable}
        categories={categories}
        costCenters={costCenters}
        suppliers={suppliers}
        onSuccess={() => { loadData(); }}
        onSuppliersRefresh={() => { loadData(); }}
      />
    </div>
  );
}
