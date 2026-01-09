import { useState, useEffect } from "react";
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
import { format, parseISO } from "date-fns";
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
  Repeat
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

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

export function PayablesPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);

  const [formData, setFormData] = useState({
    supplier_name: "",
    category_id: "",
    description: "",
    amount: "",
    due_date: "",
    payment_method: "pix",
    is_recurring: false,
    recurrence_type: "monthly",
    cost_center: "",
    reference_month: format(new Date(), "yyyy-MM"),
    notes: "",
    has_installments: false,
    total_installments: "1"
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
        .select(`
          *,
          category:category_id(name, color)
        `)
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

      setPayables(payablesData || []);
      setCategories(categoriesData || []);
      setBankAccounts(banksData || []);

      // Update overdue status
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

    } catch (error) {
      console.error("Error loading payables:", error);
      toast.error("Erro ao carregar contas a pagar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayable = async () => {
    try {
      const totalInstallments = formData.has_installments ? parseInt(formData.total_installments) : 1;
      const baseAmount = parseFloat(formData.amount);
      const installmentAmount = baseAmount / totalInstallments;

      const payablesToInsert = [];
      let currentDueDate = new Date(formData.due_date);

      for (let i = 1; i <= totalInstallments; i++) {
        payablesToInsert.push({
          supplier_name: formData.supplier_name,
          category_id: formData.category_id || null,
          description: totalInstallments > 1 
            ? `${formData.description} (${i}/${totalInstallments})`
            : formData.description,
          amount: installmentAmount,
          due_date: format(currentDueDate, "yyyy-MM-dd"),
          payment_method: formData.payment_method,
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
          cost_center: formData.cost_center || null,
          reference_month: formData.reference_month,
          notes: formData.notes || null,
          installment_number: totalInstallments > 1 ? i : null,
          total_installments: totalInstallments > 1 ? totalInstallments : null,
          status: "pending"
        });

        // Add one month for next installment
        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
      }

      const { error } = await supabase.from("financial_payables").insert(payablesToInsert);

      if (error) throw error;

      toast.success(
        totalInstallments > 1 
          ? `${totalInstallments} parcelas criadas com sucesso!`
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
      const { error } = await supabase
        .from("financial_payables")
        .update({
          status: "paid",
          paid_date: paymentData.paid_date,
          paid_amount: parseFloat(paymentData.paid_amount) || selectedPayable.amount,
          bank_account_id: paymentData.bank_account_id || null
        })
        .eq("id", selectedPayable.id);

      if (error) throw error;

      // Update bank balance manually
      if (paymentData.bank_account_id) {
        const paidAmount = parseFloat(paymentData.paid_amount) || selectedPayable.amount;
        const { data: bankData } = await supabase
          .from("financial_bank_accounts")
          .select("current_balance")
          .eq("id", paymentData.bank_account_id)
          .single();
        
        if (bankData) {
          await supabase
            .from("financial_bank_accounts")
            .update({ current_balance: Number(bankData.current_balance) - paidAmount })
            .eq("id", paymentData.bank_account_id);
        }
      }

      toast.success("Pagamento registrado com sucesso!");
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
      cost_center: "",
      reference_month: format(new Date(), "yyyy-MM"),
      notes: "",
      has_installments: false,
      total_installments: "1"
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Atrasado</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPayables = payables.filter((p) => {
    const matchesSearch = 
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = {
    pending: payables.filter(p => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0),
    overdue: payables.filter(p => p.status === "overdue").reduce((sum, p) => sum + Number(p.amount), 0),
    paid: payables.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0)
  };

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
                  <Input
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    placeholder="Nome do fornecedor"
                  />
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
                      setFormData({ ...formData, is_recurring: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_recurring">Conta Recorrente</Label>
                </div>

                {formData.is_recurring && (
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
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
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
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Atrasados</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a pagar encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayables.map((payable) => (
                  <TableRow key={payable.id}>
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
                    <TableCell>{getStatusBadge(payable.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {payable.status !== "paid" && payable.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPayable(payable);
                                setPaymentData({
                                  paid_date: format(new Date(), "yyyy-MM-dd"),
                                  paid_amount: String(payable.amount),
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
                {selectedPayable?.supplier_name} • {selectedPayable && formatCurrency(selectedPayable.amount)}
              </p>
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
    </div>
  );
}
