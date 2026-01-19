import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
} from "lucide-react";
import { format } from "date-fns";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { FinancialRecurringRule, FinancialCategory, FinancialPaymentMethod } from "./types";

const formatDateDisplay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return format(date, "dd/MM/yyyy");
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export function ClientRecurringPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<FinancialRecurringRule[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FinancialPaymentMethod[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinancialRecurringRule | null>(null);
  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    description: "",
    category_id: "",
    amount: 0,
    frequency: "monthly",
    due_day: 1,
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    client_or_supplier_name: "",
    payment_method_id: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rulesData, error } = await supabase
        .from("client_financial_recurring_rules")
        .select("*, category:client_financial_categories(*), payment_method:client_financial_payment_methods(*)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules((rulesData || []) as FinancialRecurringRule[]);

      const { data: catData } = await supabase
        .from("client_financial_categories")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);
      setCategories((catData || []) as FinancialCategory[]);

      const { data: pmData } = await supabase
        .from("client_financial_payment_methods")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);
      setPaymentMethods(pmData || []);
    } catch (error) {
      console.error("Error loading recurring rules:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.description || !formData.amount || !formData.start_date) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("client_financial_recurring_rules").insert({
        project_id: projectId,
        type: formData.type,
        description: formData.description,
        category_id: formData.category_id || null,
        amount: formData.amount,
        frequency: formData.frequency,
        due_day: formData.due_day,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        client_or_supplier_name: formData.client_or_supplier_name || null,
        payment_method_id: formData.payment_method_id || null,
        is_active: formData.is_active,
      });

      if (error) throw error;
      toast.success("Recorrência criada com sucesso");
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding rule:", error);
      toast.error("Erro ao criar recorrência");
    }
  };

  const handleEdit = async () => {
    if (!selectedItem || !formData.description || !formData.amount) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase
        .from("client_financial_recurring_rules")
        .update({
          type: formData.type,
          description: formData.description,
          category_id: formData.category_id || null,
          amount: formData.amount,
          frequency: formData.frequency,
          due_day: formData.due_day,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          client_or_supplier_name: formData.client_or_supplier_name || null,
          payment_method_id: formData.payment_method_id || null,
          is_active: formData.is_active,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;
      toast.success("Recorrência atualizada");
      setShowEditDialog(false);
      setSelectedItem(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating rule:", error);
      toast.error("Erro ao atualizar");
    }
  };

  const handleToggleActive = async (item: FinancialRecurringRule) => {
    try {
      const { error } = await supabase
        .from("client_financial_recurring_rules")
        .update({ is_active: !item.is_active })
        .eq("id", item.id);

      if (error) throw error;
      toast.success(item.is_active ? "Recorrência desativada" : "Recorrência ativada");
      loadData();
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (item: FinancialRecurringRule) => {
    if (!confirm("Tem certeza que deseja excluir esta recorrência?")) return;

    try {
      const { error } = await supabase
        .from("client_financial_recurring_rules")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      toast.success("Excluído com sucesso");
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    }
  };

  const resetForm = () => {
    setFormData({
      type: "expense",
      description: "",
      category_id: "",
      amount: 0,
      frequency: "monthly",
      due_day: 1,
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      client_or_supplier_name: "",
      payment_method_id: "",
      is_active: true,
    });
  };

  const openEditDialog = (item: FinancialRecurringRule) => {
    setSelectedItem(item);
    setFormData({
      type: item.type,
      description: item.description,
      category_id: item.category_id || "",
      amount: item.amount,
      frequency: item.frequency,
      due_day: item.due_day,
      start_date: item.start_date,
      end_date: item.end_date || "",
      client_or_supplier_name: item.client_or_supplier_name || "",
      payment_method_id: item.payment_method_id || "",
      is_active: item.is_active,
    });
    setShowEditDialog(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);

  const incomeRules = rules.filter(r => r.type === "income");
  const expenseRules = rules.filter(r => r.type === "expense");

  const totalIncome = incomeRules.filter(r => r.is_active).reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenseRules.filter(r => r.is_active).reduce((sum, r) => sum + r.amount, 0);

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
          <h2 className="text-xl font-semibold">Recorrências</h2>
          <p className="text-sm text-muted-foreground">Receitas e despesas recorrentes</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Recorrência
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Receitas Ativas/mês</span>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Despesas Ativas/mês</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Saldo Recorrente/mês</span>
            </div>
            <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Dia Venc.</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    Nenhuma recorrência cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.type === "income" ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          <ArrowDownCircle className="h-3 w-3 mr-1" />
                          Receita
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600">
                          <ArrowUpCircle className="h-3 w-3 mr-1" />
                          Despesa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.description}</div>
                      {item.client_or_supplier_name && (
                        <div className="text-xs text-muted-foreground">{item.client_or_supplier_name}</div>
                      )}
                    </TableCell>
                    <TableCell>{item.category?.name || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>{FREQUENCY_LABELS[item.frequency] || item.frequency}</TableCell>
                    <TableCell>Dia {item.due_day}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={() => handleToggleActive(item)}
                        />
                      ) : (
                        <Badge variant={item.is_active ? "default" : "secondary"}>
                          {item.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
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
            <DialogTitle>Nova Recorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as "income" | "expense", category_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita Recorrente</SelectItem>
                  <SelectItem value="expense">Despesa Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Aluguel, Mensalidade, etc."
              />
            </div>
            <div>
              <Label>{formData.type === "income" ? "Cliente" : "Fornecedor"}</Label>
              <Input
                value={formData.client_or_supplier_name}
                onChange={(e) => setFormData({ ...formData, client_or_supplier_name: e.target.value })}
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
                <Label>Frequência</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dia de Vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: parseInt(e.target.value) || 1 })}
                />
              </div>
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
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Término (opcional)</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Ativa</Label>
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
            <DialogTitle>Editar Recorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as "income" | "expense", category_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita Recorrente</SelectItem>
                  <SelectItem value="expense">Despesa Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>{formData.type === "income" ? "Cliente" : "Fornecedor"}</Label>
              <Input
                value={formData.client_or_supplier_name}
                onChange={(e) => setFormData({ ...formData, client_or_supplier_name: e.target.value })}
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
                <Label>Frequência</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dia de Vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: parseInt(e.target.value) || 1 })}
                />
              </div>
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
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Término (opcional)</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
