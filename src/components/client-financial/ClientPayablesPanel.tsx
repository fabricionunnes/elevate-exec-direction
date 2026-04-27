import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  Check,
  X,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  Split,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { FinancialPayable, FinancialCategory, FinancialPaymentMethod, FinancialCostCenter, FinancialBankAccount } from "./types";
import { ClientFinancialImportDialog } from "./ClientFinancialImportDialog";
import { syncEntryToContaAzul, syncPaymentToContaAzul } from "@/utils/contaAzulSync";
// Parse date string (YYYY-MM-DD) to local Date without timezone shift
const parseDateLocal = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Format Date to display string without timezone shift
const formatDateDisplay = (dateStr: string): string => {
  const date = parseDateLocal(dateStr);
  return format(date, "dd/MM/yyyy");
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ClientPayablesPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [payables, setPayables] = useState<FinancialPayable[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [costCenters, setCostCenters] = useState<FinancialCostCenter[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FinancialPaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinancialBankAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [costCenterFilter, setCostCenterFilter] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInstallmentDialog, setShowInstallmentDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinancialPayable | null>(null);
  const [formData, setFormData] = useState({
    supplier_name: "",
    description: "",
    category_id: "",
    cost_center_id: "",
    amount: 0,
    due_date: "",
    payment_method_id: "",
    bank_account_id: "",
    notes: "",
  });
  const [payData, setPayData] = useState({
    paid_at: format(new Date(), "yyyy-MM-dd"),
    paid_amount: 0,
  });
  const [installmentData, setInstallmentData] = useState({
    num_installments: 2,
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await supabase.rpc("update_client_financial_overdue_status");

      const { data: payData, error: payError } = await supabase
        .from("client_financial_payables")
        .select("*, category:client_financial_categories(*), cost_center:client_financial_cost_centers(*), payment_method:client_financial_payment_methods(*)")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });

      if (payError) throw payError;
      setPayables((payData || []) as FinancialPayable[]);

      const { data: catData } = await supabase
        .from("client_financial_categories")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", "expense")
        .eq("is_active", true);
      setCategories((catData || []) as FinancialCategory[]);

      const { data: ccData } = await supabase
        .from("client_financial_cost_centers")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);
      setCostCenters((ccData || []) as FinancialCostCenter[]);

      const { data: pmData } = await supabase
        .from("client_financial_payment_methods")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);
      setPaymentMethods(pmData || []);

      // Load bank accounts
      const { data: bankData } = await supabase
        .from("client_financial_bank_accounts")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);
      setBankAccounts((bankData || []) as FinancialBankAccount[]);
    } catch (error) {
      console.error("Error loading payables:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.supplier_name || !formData.amount || !formData.due_date || !formData.bank_account_id) {
      toast.error("Preencha os campos obrigatórios (incluindo banco)");
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = parseDateLocal(formData.due_date);

      const { data: inserted, error } = await supabase.from("client_financial_payables").insert({
        project_id: projectId,
        supplier_name: formData.supplier_name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        cost_center_id: formData.cost_center_id || null,
        amount: formData.amount,
        due_date: formData.due_date,
        payment_method_id: formData.payment_method_id || null,
        bank_account_id: formData.bank_account_id,
        notes: formData.notes || null,
        status: dueDate < today ? "overdue" : "open",
      }).select("id").single();

      if (error) throw error;

      // Sync to Conta Azul (non-blocking)
      syncEntryToContaAzul("payable", {
        description: formData.description || formData.supplier_name,
        amount: formData.amount,
        due_date: formData.due_date,
        supplier_name: formData.supplier_name,
      }).then(contaAzulId => {
        if (contaAzulId && inserted?.id) {
          supabase.from("client_financial_payables")
            .update({ conta_azul_id: contaAzulId } as any)
            .eq("id", inserted.id).then(() => {});
        }
      });

      await logAudit("create", null, formData);
      toast.success("Conta a pagar criada com sucesso");
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding payable:", error);
      toast.error("Erro ao criar conta a pagar");
    }
  };

  const handleEdit = async () => {
    if (!selectedItem || !formData.supplier_name || !formData.amount || !formData.due_date || !formData.bank_account_id) {
      toast.error("Preencha os campos obrigatórios (incluindo banco)");
      return;
    }

    try {
      const { error } = await supabase
        .from("client_financial_payables")
        .update({
          supplier_name: formData.supplier_name,
          description: formData.description || null,
          category_id: formData.category_id || null,
          cost_center_id: formData.cost_center_id || null,
          amount: formData.amount,
          due_date: formData.due_date,
          payment_method_id: formData.payment_method_id || null,
          bank_account_id: formData.bank_account_id,
          notes: formData.notes || null,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      // Sync to Conta Azul if has conta_azul_id (non-blocking)
      const itemAny = selectedItem as any;
      if (itemAny.conta_azul_id) {
        syncEntryToContaAzul("payable", {
          description: formData.description || formData.supplier_name,
          amount: formData.amount,
          due_date: formData.due_date,
          supplier_name: formData.supplier_name,
        }, itemAny.conta_azul_id);
      }

      await logAudit("update", selectedItem, formData);
      toast.success("Conta atualizada com sucesso");
      setShowEditDialog(false);
      setSelectedItem(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating payable:", error);
      toast.error("Erro ao atualizar conta");
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from("client_financial_payables")
        .update({
          status: "paid",
          paid_at: payData.paid_at,
          paid_amount: payData.paid_amount || selectedItem.amount,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      // Sync payment to Conta Azul (non-blocking)
      const itemAny = selectedItem as any;
      if (itemAny.conta_azul_id) {
        syncPaymentToContaAzul(
          itemAny.conta_azul_id,
          "payable",
          payData.paid_at,
          payData.paid_amount || selectedItem.amount
        );
      }

      await logAudit("update", selectedItem, { status: "paid", ...payData });
      toast.success("Marcado como pago");
      setShowPayDialog(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Erro ao marcar como pago");
    }
  };

  const handleCreateInstallments = async () => {
    if (!selectedItem || installmentData.num_installments < 2) return;

    try {
      const installments = [];
      const installmentAmount = selectedItem.amount / installmentData.num_installments;
      const baseDate = parseDateLocal(selectedItem.due_date);

      for (let i = 0; i < installmentData.num_installments; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        installments.push({
          project_id: projectId,
          supplier_name: selectedItem.supplier_name,
          description: `${selectedItem.description || selectedItem.supplier_name} - Parcela ${i + 1}/${installmentData.num_installments}`,
          category_id: selectedItem.category_id,
          cost_center_id: selectedItem.cost_center_id,
          amount: installmentAmount,
          due_date: format(dueDate, "yyyy-MM-dd"),
          payment_method_id: selectedItem.payment_method_id,
          notes: selectedItem.notes,
          status: "open",
          installment_number: i + 1,
          total_installments: installmentData.num_installments,
          parent_id: selectedItem.id,
        });
      }

      // Update original as cancelled
      await supabase
        .from("client_financial_payables")
        .update({ status: "cancelled", notes: `Parcelado em ${installmentData.num_installments}x` })
        .eq("id", selectedItem.id);

      // Insert installments
      const { error } = await supabase.from("client_financial_payables").insert(installments);
      if (error) throw error;

      toast.success(`${installmentData.num_installments} parcelas criadas com sucesso`);
      setShowInstallmentDialog(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error("Error creating installments:", error);
      toast.error("Erro ao parcelar");
    }
  };

  const handleCancel = async (item: FinancialPayable) => {
    try {
      const { error } = await supabase
        .from("client_financial_payables")
        .update({ status: "cancelled" })
        .eq("id", item.id);

      if (error) throw error;
      await logAudit("update", item, { status: "cancelled" });
      toast.success("Cancelado com sucesso");
      loadData();
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar");
    }
  };

  const handleDelete = async (item: FinancialPayable) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
      const { error } = await supabase
        .from("client_financial_payables")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      await logAudit("delete", item, null);
      toast.success("Excluído com sucesso");
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    }
  };

  const logAudit = async (action: string, oldData: any, newData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("client_financial_audit_log").insert({
        project_id: projectId,
        table_name: "client_financial_payables",
        record_id: selectedItem?.id || crypto.randomUUID(),
        action,
        old_data: oldData,
        new_data: newData,
        changed_by: user?.id,
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_name: "",
      description: "",
      category_id: "",
      cost_center_id: "",
      amount: 0,
      due_date: "",
      payment_method_id: "",
      bank_account_id: "",
      notes: "",
    });
  };

  const openEditDialog = (item: FinancialPayable) => {
    setSelectedItem(item);
    setFormData({
      supplier_name: item.supplier_name,
      description: item.description || "",
      category_id: item.category_id || "",
      cost_center_id: item.cost_center_id || "",
      amount: item.amount,
      due_date: item.due_date,
      payment_method_id: item.payment_method_id || "",
      bank_account_id: item.bank_account_id || "",
      notes: item.notes || "",
    });
    setShowEditDialog(true);
  };

  const openPayDialog = (item: FinancialPayable) => {
    setSelectedItem(item);
    setPayData({
      paid_at: format(new Date(), "yyyy-MM-dd"),
      paid_amount: item.amount,
    });
    setShowPayDialog(true);
  };

  const openInstallmentDialog = (item: FinancialPayable) => {
    setSelectedItem(item);
    setInstallmentData({ num_installments: 2 });
    setShowInstallmentDialog(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Em aberto</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600">Pago</Badge>;
      case "overdue":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600">Vencido</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-600">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPayables = payables.filter((p) => {
    const matchesSearch =
      p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(p.status) ||
      (statusFilter.includes("overdue") && (p.status as string) === "partial" && p.due_date < new Date().toISOString().slice(0, 10));
    const matchesCategory = categoryFilter.length === 0 || (p.category_id && categoryFilter.includes(p.category_id));
    const matchesCostCenter = costCenterFilter.length === 0 || (p.cost_center_id && costCenterFilter.includes(p.cost_center_id));
    return matchesSearch && matchesStatus && matchesCategory && matchesCostCenter;
  });

  const totals = {
    open: payables.filter((p) => p.status === "open").reduce((sum, p) => sum + p.amount, 0),
    overdue: payables.filter((p) => p.status === "overdue").reduce((sum, p) => sum + p.amount, 0),
    paid: payables.filter((p) => p.status === "paid").reduce((sum, p) => sum + (p.paid_amount || p.amount), 0),
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contas a Pagar</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas despesas e pagamentos</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Em Aberto</span>
            </div>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(totals.open)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Vencido</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Pago</span>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totals.paid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por fornecedor ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Pendente</SelectItem>
            <SelectItem value="partial">Pago Parcial</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor/Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a pagar encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayables.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.supplier_name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      )}
                      {item.installment_number && (
                        <div className="text-xs text-muted-foreground">
                          Parcela {item.installment_number}/{item.total_installments}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.category?.name || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      {formatDateDisplay(item.due_date)}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.status !== "paid" && item.status !== "cancelled" && (
                              <>
                                <DropdownMenuItem onClick={() => openPayDialog(item)}>
                                  <Check className="h-4 w-4 mr-2" />
                                  Marcar como Pago
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openInstallmentDialog(item)}>
                                  <Split className="h-4 w-4 mr-2" />
                                  Parcelar
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {item.status !== "cancelled" && item.status !== "paid" && (
                              <DropdownMenuItem onClick={() => handleCancel(item)}>
                                <X className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleDelete(item)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fornecedor *</Label>
              <Input
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do pagamento"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <CurrencyInput
                  value={formData.amount}
                  onChange={(value) => setFormData({ ...formData, amount: value })}
                />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select
                  value={formData.cost_center_id}
                  onValueChange={(v) => setFormData({ ...formData, cost_center_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.payment_method_id}
                onValueChange={(v) => setFormData({ ...formData, payment_method_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta Bancária *</Label>
              <Select
                value={formData.bank_account_id}
                onValueChange={(v) => setFormData({ ...formData, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>{ba.name} {ba.bank_name ? `(${ba.bank_name})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fornecedor *</Label>
              <Input
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <CurrencyInput
                  value={formData.amount}
                  onChange={(value) => setFormData({ ...formData, amount: value })}
                />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select
                  value={formData.cost_center_id}
                  onValueChange={(v) => setFormData({ ...formData, cost_center_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.payment_method_id}
                onValueChange={(v) => setFormData({ ...formData, payment_method_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta Bancária *</Label>
              <Select
                value={formData.bank_account_id}
                onValueChange={(v) => setFormData({ ...formData, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>{ba.name} {ba.bank_name ? `(${ba.bank_name})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={payData.paid_at}
                onChange={(e) => setPayData({ ...payData, paid_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Valor Pago</Label>
              <CurrencyInput
                value={payData.paid_amount}
                onChange={(value) => setPayData({ ...payData, paid_amount: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancelar</Button>
            <Button onClick={handleMarkAsPaid}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Installment Dialog */}
      <Dialog open={showInstallmentDialog} onOpenChange={setShowInstallmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parcelar Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Valor total: {selectedItem && formatCurrency(selectedItem.amount)}
            </p>
            <div>
              <Label>Número de Parcelas</Label>
              <Input
                type="number"
                min={2}
                max={48}
                value={installmentData.num_installments}
                onChange={(e) => setInstallmentData({ num_installments: parseInt(e.target.value) || 2 })}
              />
            </div>
            {selectedItem && installmentData.num_installments >= 2 && (
              <p className="text-sm text-muted-foreground">
                Valor por parcela: {formatCurrency(selectedItem.amount / installmentData.num_installments)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstallmentDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstallments}>Parcelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientFinancialImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        projectId={projectId}
        type="payables"
        onImported={loadData}
      />
    </div>
  );
}
