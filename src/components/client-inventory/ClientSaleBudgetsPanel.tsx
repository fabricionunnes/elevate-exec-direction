import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  ShoppingCart,
  FileText,
  Trash2,
  Eye,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SaleBudget, SaleBudgetItem, InventoryProduct, ClientCustomer } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface BudgetItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: InventoryProduct;
}

export function ClientSaleBudgetsPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<SaleBudget[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [customers, setCustomers] = useState<ClientCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    budget_date: format(new Date(), "yyyy-MM-dd"),
    validity_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    discount_amount: 0,
    notes: "",
  });
  const [items, setItems] = useState<BudgetItem[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load budgets
      const { data: budgetsData, error: budgetsError } = await supabase
        .from("client_sale_budgets")
        .select(`
          *,
          items:client_sale_budget_items(
            *,
            product:client_inventory_products(*)
          ),
          customer:client_customers(*)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (budgetsError) throw budgetsError;

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from("client_inventory_products")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");

      if (productsError) throw productsError;

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from("client_customers")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");

      if (customersError) throw customersError;

      setBudgets((budgetsData as unknown as SaleBudget[]) || []);
      setProducts((productsData as InventoryProduct[]) || []);
      setCustomers((customersData as ClientCustomer[]) || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setFormData({
      customer_id: "",
      customer_name: "",
      budget_date: format(new Date(), "yyyy-MM-dd"),
      validity_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      discount_amount: 0,
      notes: "",
    });
    setItems([]);
    setShowDialog(true);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill price when product is selected
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].unit_price = product.sale_price;
        newItems[index].product = product;
      }
    }

    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - formData.discount_amount;
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    if (items.some((item) => !item.product_id)) {
      toast.error("Selecione todos os produtos");
      return;
    }

    setSaving(true);
    try {
      // Generate budget number
      const budgetNumber = `ORC-${Date.now().toString().slice(-8)}`;

      // Create budget
      const { data: budget, error: budgetError } = await supabase
        .from("client_sale_budgets")
        .insert({
          project_id: projectId,
          customer_id: formData.customer_id || null,
          customer_name: formData.customer_name || customers.find((c) => c.id === formData.customer_id)?.name,
          budget_number: budgetNumber,
          budget_date: formData.budget_date,
          validity_date: formData.validity_date,
          total_amount: calculateSubtotal(),
          discount_amount: formData.discount_amount,
          final_amount: calculateTotal(),
          notes: formData.notes,
          status: "pending",
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      // Create items
      const itemsToInsert = items.map((item) => ({
        budget_id: budget.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("client_sale_budget_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Orçamento criado com sucesso");
      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving budget:", error);
      toast.error("Erro ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (budget: SaleBudget, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("client_sale_budgets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", budget.id);

      if (error) throw error;
      toast.success(`Orçamento ${newStatus === "approved" ? "aprovado" : "rejeitado"}`);
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const convertToSale = async (budget: SaleBudget) => {
    if (!confirm("Deseja converter este orçamento em venda? O estoque será atualizado.")) {
      return;
    }

    try {
      // Check stock availability
      for (const item of budget.items || []) {
        const product = products.find((p) => p.id === item.product_id);
        if (product && product.current_stock < item.quantity) {
          toast.error(`Estoque insuficiente para ${product.name}`);
          return;
        }
      }

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("client_inventory_sales")
        .insert({
          project_id: projectId,
          customer_id: budget.customer_id,
          customer_name: budget.customer_name,
          sale_date: format(new Date(), "yyyy-MM-dd"),
          total_amount: budget.total_amount,
          discount_amount: budget.discount_amount,
          final_amount: budget.final_amount,
          notes: `Convertido do orçamento ${budget.budget_number}`,
          status: "completed",
          payment_status: "pending",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items and update stock
      for (const item of budget.items || []) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) continue;

        const quantityBefore = product.current_stock;
        const quantityAfter = quantityBefore - item.quantity;

        // Create sale item
        await supabase.from("client_inventory_sale_items").insert({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity_base: item.quantity,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_cost: product.average_cost,
          total_price: item.total_price,
          total_cost: item.quantity * product.average_cost,
        });

        // Update product stock
        await supabase
          .from("client_inventory_products")
          .update({
            current_stock: quantityAfter,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.product_id);

        // Create movement
        await supabase.from("client_inventory_movements").insert({
          project_id: projectId,
          product_id: item.product_id,
          movement_type: "sale",
          quantity: -item.quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          reference_id: sale.id,
          notes: `Venda convertida do orçamento ${budget.budget_number}`,
        });
      }

      // Update budget status
      await supabase
        .from("client_sale_budgets")
        .update({
          status: "converted",
          converted_sale_id: sale.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", budget.id);

      toast.success("Orçamento convertido em venda com sucesso");
      loadData();
    } catch (error) {
      console.error("Error converting to sale:", error);
      toast.error("Erro ao converter orçamento");
    }
  };

  const deleteBudget = async (budget: SaleBudget) => {
    if (!confirm("Deseja excluir este orçamento?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("client_sale_budgets")
        .delete()
        .eq("id", budget.id);

      if (error) throw error;
      toast.success("Orçamento excluído");
      loadData();
    } catch (error) {
      console.error("Error deleting budget:", error);
      toast.error("Erro ao excluir orçamento");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      approved: { variant: "default", label: "Aprovado" },
      rejected: { variant: "destructive", label: "Rejeitado" },
      converted: { variant: "outline", label: "Convertido" },
      expired: { variant: "destructive", label: "Expirado" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredBudgets = budgets.filter((b) => {
    const matchesSearch =
      (b.customer_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (b.budget_number?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar orçamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
              <SelectItem value="converted">Convertido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{budgets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {budgets.filter((b) => b.status === "pending").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Aprovados</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {budgets.filter((b) => b.status === "approved").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Convertidos</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {budgets.filter((b) => b.status === "converted").length}
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
                <TableHead>Orçamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="hidden md:table-cell">Validade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBudgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum orçamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredBudgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell className="font-mono text-sm">
                      {budget.budget_number || "-"}
                    </TableCell>
                    <TableCell>{budget.customer_name || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {format(new Date(budget.budget_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {budget.validity_date
                        ? format(new Date(budget.validity_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(budget.final_amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(budget.status)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {budget.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => updateStatus(budget, "approved")}>
                                  <Check className="h-4 w-4 mr-2 text-green-500" />
                                  Aprovar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(budget, "rejected")}>
                                  <X className="h-4 w-4 mr-2 text-red-500" />
                                  Rejeitar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {budget.status === "approved" && (
                              <>
                                <DropdownMenuItem onClick={() => convertToSale(budget)}>
                                  <ShoppingCart className="h-4 w-4 mr-2 text-purple-500" />
                                  Converter em Venda
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => deleteBudget(budget)}
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

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Orçamento de Venda</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente Cadastrado</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(v) => {
                    const customer = customers.find((c) => c.id === v);
                    setFormData({
                      ...formData,
                      customer_id: v,
                      customer_name: customer?.name || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ou Digite o Nome</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_name: e.target.value, customer_id: "" })
                  }
                  placeholder="Nome do cliente"
                />
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Orçamento</Label>
                <Input
                  type="date"
                  value={formData.budget_date}
                  onChange={(e) => setFormData({ ...formData, budget_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={formData.validity_date}
                  onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens do Orçamento</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item adicionado
                </p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {items.map((item, index) => (
                    <div key={index} className="p-3 grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={item.product_id}
                          onValueChange={(v) => updateItem(index, "product_id", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Preço Un.</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <Label className="text-xs">Total</Label>
                        <p className="text-sm font-medium py-2">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </p>
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desconto e Observações */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.discount_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
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

            {/* Totais */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Desconto:</span>
                <span className="text-red-600">-{formatCurrency(formData.discount_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="text-green-600">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Criar Orçamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
