import { useState, useEffect } from "react";
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
import { format, parseISO, isAfter, isBefore } from "date-fns";
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
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

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
  company?: { name: string } | null;
  category?: { name: string; color: string } | null;
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [editDueDate, setEditDueDate] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    company_id: "",
    category_id: "",
    description: "",
    amount: "",
    due_date: "",
    payment_method: "pix",
    is_recurring: false,
    reference_month: format(new Date(), "yyyy-MM"),
    notes: ""
  });

  const [paymentData, setPaymentData] = useState({
    paid_date: format(new Date(), "yyyy-MM-dd"),
    paid_amount: ""
  });

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

      setReceivables(receivablesData || []);
      setCompanies(companiesData || []);
      setCategories(categoriesData || []);

      // Update overdue status
      const today = format(new Date(), "yyyy-MM-dd");
      const overdueIds = receivablesData
        ?.filter(r => r.status === "pending" && r.due_date < today)
        .map(r => r.id) || [];

      if (overdueIds.length > 0) {
        await supabase
          .from("financial_receivables")
          .update({ status: "overdue" })
          .in("id", overdueIds);
      }

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

  const handleMarkAsPaid = async () => {
    if (!selectedReceivable) return;

    try {
      const { error } = await supabase
        .from("financial_receivables")
        .update({
          status: "paid",
          paid_date: paymentData.paid_date,
          paid_amount: parseFloat(paymentData.paid_amount) || selectedReceivable.amount
        })
        .eq("id", selectedReceivable.id);

      if (error) throw error;

      toast.success("Pagamento registrado com sucesso!");
      setIsPayDialogOpen(false);
      setSelectedReceivable(null);
      loadData();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Erro ao registrar pagamento");
    }
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
      category_id: "",
      description: "",
      amount: "",
      due_date: "",
      payment_method: "pix",
      is_recurring: false,
      reference_month: format(new Date(), "yyyy-MM"),
      notes: ""
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

  const filteredReceivables = receivables.filter((r) => {
    // Only show recurring receivables (from clients without end date and monthly payment)
    if (!r.is_recurring) return false;
    
    const matchesSearch =
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesMonth = !monthFilter || r.due_date.startsWith(monthFilter);
    return matchesSearch && matchesStatus && matchesMonth;
  });

  // Calculate totals
  const totals = {
    pending: receivables.filter(r => r.status === "pending").reduce((sum, r) => sum + Number(r.amount), 0),
    overdue: receivables.filter(r => r.status === "overdue").reduce((sum, r) => sum + Number(r.amount), 0),
    paid: receivables.filter(r => r.status === "paid").reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0)
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select
                      value={formData.company_id}
                      onValueChange={(v) => setFormData({ ...formData, company_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-[180px]"
            />
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
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredReceivables.map((receivable) => (
                  <TableRow key={receivable.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{receivable.description}</p>
                        {receivable.category && (
                          <p className="text-xs text-muted-foreground">{receivable.category.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{receivable.company?.name || "-"}</TableCell>
                    <TableCell>
                      {format(parseISO(receivable.due_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(receivable.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(receivable.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {receivable.status !== "paid" && receivable.status !== "cancelled" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedReceivable(receivable);
                                  setPaymentData({
                                    paid_date: format(new Date(), "yyyy-MM-dd"),
                                    paid_amount: String(receivable.amount)
                                  });
                                  setIsPayDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Dar Baixa
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
              <p className="font-medium">{selectedReceivable?.description}</p>
              <p className="text-sm text-muted-foreground">
                Valor: {selectedReceivable && formatCurrency(selectedReceivable.amount)}
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
                <Label>Valor Recebido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.paid_amount}
                  onChange={(e) => setPaymentData({ ...paymentData, paid_amount: e.target.value })}
                  placeholder={selectedReceivable?.amount.toString()}
                />
              </div>
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
    </div>
  );
}
