import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
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
  ArrowDownCircle,
  AlertTriangle,
  Clock,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { FinancialReceivable, FinancialCategory, FinancialCostCenter, FinancialPaymentMethod, FinancialBankAccount } from "./types";
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

export function ClientReceivablesPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<FinancialReceivable[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FinancialPaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinancialBankAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinancialReceivable | null>(null);
  const [formData, setFormData] = useState({
    client_name: "",
    description: "",
    category_id: "",
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

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Update overdue status first
      await supabase.rpc("update_client_financial_overdue_status");

      // Load receivables
      const { data: recData, error: recError } = await supabase
        .from("client_financial_receivables")
        .select("*, category:client_financial_categories(*), payment_method:client_financial_payment_methods(*)")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });

      if (recError) throw recError;
      setReceivables((recData || []) as FinancialReceivable[]);

      // Load categories
      const { data: catData } = await supabase
        .from("client_financial_categories")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", "income")
        .eq("is_active", true);
      setCategories((catData || []) as FinancialCategory[]);

      // Load payment methods
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
      console.error("Error loading receivables:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.client_name || !formData.amount || !formData.due_date || !formData.bank_account_id) {
      toast.error("Preencha os campos obrigatórios (incluindo banco)");
      return;
    }

    try {
      const { data: inserted, error } = await supabase.from("client_financial_receivables").insert({
        project_id: projectId,
        client_name: formData.client_name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        amount: formData.amount,
        due_date: formData.due_date,
        payment_method_id: formData.payment_method_id || null,
        bank_account_id: formData.bank_account_id,
        notes: formData.notes || null,
        status: parseDateLocal(formData.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) ? "overdue" : "open",
      }).select("id").single();

      if (error) throw error;

      // Sync to Conta Azul (non-blocking)
      syncEntryToContaAzul("receivable", {
        description: formData.description || formData.client_name,
        amount: formData.amount,
        due_date: formData.due_date,
        client_name: formData.client_name,
      }).then(contaAzulId => {
        if (contaAzulId && inserted?.id) {
          supabase.from("client_financial_receivables")
            .update({ conta_azul_id: contaAzulId } as any)
            .eq("id", inserted.id).then(() => {});
        }
      });

      // Log audit
      await logAudit("create", null, formData);

      toast.success("Conta a receber criada com sucesso");
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding receivable:", error);
      toast.error("Erro ao criar conta a receber");
    }
  };

  const handleEdit = async () => {
    if (!selectedItem || !formData.client_name || !formData.amount || !formData.due_date || !formData.bank_account_id) {
      toast.error("Preencha os campos obrigatórios (incluindo banco)");
      return;
    }

    try {
      const { error } = await supabase
        .from("client_financial_receivables")
        .update({
          client_name: formData.client_name,
          description: formData.description || null,
          category_id: formData.category_id || null,
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
        syncEntryToContaAzul("receivable", {
          description: formData.description || formData.client_name,
          amount: formData.amount,
          due_date: formData.due_date,
          client_name: formData.client_name,
        }, itemAny.conta_azul_id);
      }

      await logAudit("update", selectedItem, formData);

      toast.success("Conta atualizada com sucesso");
      setShowEditDialog(false);
      setSelectedItem(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating receivable:", error);
      toast.error("Erro ao atualizar conta");
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from("client_financial_receivables")
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
          "receivable",
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

  const handleCancel = async (item: FinancialReceivable) => {
    try {
      const { error } = await supabase
        .from("client_financial_receivables")
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

  const handleDelete = async (item: FinancialReceivable) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
      const { error } = await supabase
        .from("client_financial_receivables")
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
        table_name: "client_financial_receivables",
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
      client_name: "",
      description: "",
      category_id: "",
      amount: 0,
      due_date: "",
      payment_method_id: "",
      bank_account_id: "",
      notes: "",
    });
  };

  const openEditDialog = (item: FinancialReceivable) => {
    setSelectedItem(item);
    setFormData({
      client_name: item.client_name,
      description: item.description || "",
      category_id: item.category_id || "",
      amount: item.amount,
      due_date: item.due_date,
      payment_method_id: item.payment_method_id || "",
      bank_account_id: item.bank_account_id || "",
      notes: item.notes || "",
    });
    setShowEditDialog(true);
  };

  const openPayDialog = (item: FinancialReceivable) => {
    setSelectedItem(item);
    setPayData({
      paid_at: format(new Date(), "yyyy-MM-dd"),
      paid_amount: item.amount,
    });
    setShowPayDialog(true);
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

  const filteredReceivables = receivables.filter((r) => {
    const matchesSearch =
      r.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter ||
      (statusFilter === "overdue" && r.status === "partial" && r.due_date < new Date().toISOString().slice(0, 10));
    return matchesSearch && matchesStatus;
  });

  const totals = {
    open: receivables.filter((r) => r.status === "open").reduce((sum, r) => sum + r.amount, 0),
    overdue: receivables.filter((r) => r.status === "overdue").reduce((sum, r) => sum + r.amount, 0),
    paid: receivables.filter((r) => r.status === "paid").reduce((sum, r) => sum + (r.paid_amount || r.amount), 0),
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
          <h2 className="text-xl font-semibold">Contas a Receber</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas receitas e recebimentos</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Receita
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
              <span className="text-xs text-muted-foreground">Recebido</span>
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
            placeholder="Buscar por cliente ou descrição..."
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
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
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
                <TableHead>Cliente/Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredReceivables.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.client_name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
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
                              <DropdownMenuItem onClick={() => openPayDialog(item)}>
                                <Check className="h-4 w-4 mr-2" />
                                Marcar como Pago
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {item.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => handleCancel(item)}>
                                <X className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleDelete(item)}
                              className="text-red-600"
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
            <DialogTitle>Nova Conta a Receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do recebimento"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <CurrencyInput
                    value={formData.amount}
                    onChange={(v) => setFormData({ ...formData, amount: v })}
                    className="pl-10"
                  />
                </div>
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
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
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
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Conta a Receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <CurrencyInput
                    value={formData.amount}
                    onChange={(v) => setFormData({ ...formData, amount: v })}
                    className="pl-10"
                  />
                </div>
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
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
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
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
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
            <div className="space-y-2">
              <Label>Data do Recebimento</Label>
              <Input
                type="date"
                value={payData.paid_at}
                onChange={(e) => setPayData({ ...payData, paid_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Recebido</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <CurrencyInput
                  value={payData.paid_amount}
                  onChange={(v) => setPayData({ ...payData, paid_amount: v })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkAsPaid}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientFinancialImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        projectId={projectId}
        type="receivables"
        onImported={loadData}
      />
    </div>
  );
}
