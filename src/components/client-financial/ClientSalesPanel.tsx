import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2, ShoppingCart, Search, Receipt, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FinancialProduct, FinancialSale, FinancialPaymentMethod } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface Salesperson {
  id: string;
  name: string;
}

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  total: number;
}

interface FormData {
  sale_date: string;
  customer_name: string;
  salesperson_id: string;
  discount: number;
  payment_method_id: string;
  notes: string;
  items: SaleItem[];
}

const initialFormData: FormData = {
  sale_date: new Date().toISOString().split("T")[0],
  customer_name: "",
  salesperson_id: "",
  discount: 0,
  payment_method_id: "",
  notes: "",
  items: [],
};

export function ClientSalesPanel({ projectId, canEdit }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [sales, setSales] = useState<FinancialSale[]>([]);
  const [products, setProducts] = useState<FinancialProduct[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FinancialPaymentMethod[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<FinancialSale | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // First get company_id from project
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company_id")
        .eq("id", projectId)
        .single();

      const cid = project?.onboarding_company_id;
      setCompanyId(cid);

      const [salesRes, productsRes, paymentMethodsRes] = await Promise.all([
        supabase
          .from("client_financial_sales")
          .select(`
            *,
            salesperson:company_salespeople(id, name),
            payment_method:client_financial_payment_methods(*)
          `)
          .eq("project_id", projectId)
          .order("sale_date", { ascending: false }),
        supabase
          .from("client_financial_products")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("client_financial_payment_methods")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
      ]);

      // Fetch salespeople if we have company_id
      let salespeopleData: Salesperson[] = [];
      if (cid) {
        const { data } = await supabase
          .from("company_salespeople")
          .select("id, name")
          .eq("company_id", cid)
          .eq("is_active", true)
          .order("name");
        salespeopleData = data || [];
      }

      if (salesRes.error) throw salesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (paymentMethodsRes.error) throw paymentMethodsRes.error;

      setSales((salesRes.data || []) as FinancialSale[]);
      setProducts(productsRes.data || []);
      setSalespeople(salespeopleData);
      setPaymentMethods(paymentMethodsRes.data || []);
    } catch (error) {
      console.error("Error loading sales:", error);
      toast.error("Erro ao carregar vendas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    if (products.length === 0) {
      toast.error("Cadastre produtos primeiro");
      return;
    }

    const firstProduct = products[0];
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_id: firstProduct.id,
          product_name: firstProduct.name,
          quantity: 1,
          unit_price: firstProduct.unit_price,
          cost_price: firstProduct.cost_price,
          discount: 0,
          total: firstProduct.unit_price,
        },
      ],
    });
  };

  const handleUpdateItem = (index: number, updates: Partial<SaleItem>) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], ...updates };

    // If product changed, update prices
    if (updates.product_id) {
      const product = products.find((p) => p.id === updates.product_id);
      if (product) {
        item.product_name = product.name;
        item.unit_price = product.unit_price;
        item.cost_price = product.cost_price;
      }
    }

    // Recalculate total
    item.total = item.quantity * item.unit_price - item.discount;
    newItems[index] = item;
    setFormData({ ...formData, items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const totalCost = formData.items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
    const total = subtotal - formData.discount;
    return { subtotal, totalCost, total };
  };

  const handleSave = async () => {
    if (formData.items.length === 0) {
      toast.error("Adicione pelo menos um item à venda");
      return;
    }

    try {
      const { subtotal, totalCost, total } = calculateTotals();

      // Create sale
      const { data: saleData, error: saleError } = await supabase
        .from("client_financial_sales")
        .insert({
          project_id: projectId,
          sale_date: formData.sale_date,
          customer_name: formData.customer_name.trim() || null,
          salesperson_id: formData.salesperson_id || null,
          total_amount: total,
          total_cost: totalCost,
          discount: formData.discount,
          payment_method_id: formData.payment_method_id || null,
          notes: formData.notes.trim() || null,
          status: "completed",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const itemsToInsert = formData.items.map((item) => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        discount: item.discount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from("client_financial_sale_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Venda registrada!");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving sale:", error);
      toast.error("Erro ao salvar venda");
    }
  };

  const handleDelete = async () => {
    if (!selectedSale) return;

    try {
      const { error } = await supabase
        .from("client_financial_sales")
        .delete()
        .eq("id", selectedSale.id);

      if (error) throw error;
      toast.success("Venda excluída!");
      setDeleteDialogOpen(false);
      setSelectedSale(null);
      loadData();
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error("Erro ao excluir venda");
    }
  };

  const handleCancelSale = async (sale: FinancialSale) => {
    try {
      const { error } = await supabase
        .from("client_financial_sales")
        .update({ status: "cancelled" })
        .eq("id", sale.id);

      if (error) throw error;
      toast.success("Venda cancelada!");
      loadData();
    } catch (error) {
      console.error("Error cancelling sale:", error);
      toast.error("Erro ao cancelar venda");
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedSale(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      completed: { variant: "default", label: "Concluída" },
      pending: { variant: "secondary", label: "Pendente" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      refunded: { variant: "outline", label: "Reembolsada" },
    };
    const style = styles[status] || styles.pending;
    return <Badge variant={style.variant}>{style.label}</Badge>;
  };

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      !searchTerm ||
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.salesperson?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary calculations
  const completedSales = sales.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalProfit = completedSales.reduce((sum, s) => sum + (s.total_amount - s.total_cost), 0);
  const avgTicket = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { subtotal, total } = calculateTotals();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Registre e acompanhe todas as vendas
          </p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Venda</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data da Venda</Label>
                    <Input
                      type="date"
                      value={formData.sale_date}
                      onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Input
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      placeholder="Nome do cliente"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Select
                      value={formData.salesperson_id || "none"}
                      onValueChange={(value) => setFormData({ ...formData, salesperson_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem vendedor</SelectItem>
                        {salespeople.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select
                      value={formData.payment_method_id || "none"}
                      onValueChange={(value) => setFormData({ ...formData, payment_method_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        {paymentMethods.map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>
                            {pm.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Itens da Venda</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Item
                    </Button>
                  </div>

                  {formData.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Clique em "Adicionar Item" para incluir produtos
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="w-20">Qtd</TableHead>
                            <TableHead className="w-32">Preço</TableHead>
                            <TableHead className="w-32">Total</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Select
                                  value={item.product_id}
                                  onValueChange={(value) => handleUpdateItem(index, { product_id: value })}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(index, { quantity: Number(e.target.value) || 1 })}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <CurrencyInput
                                  value={item.unit_price}
                                  onChange={(value) => handleUpdateItem(index, { unit_price: value })}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(item.total)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Totals */}
                {formData.items.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Desconto:</span>
                      <CurrencyInput
                        value={formData.discount}
                        onChange={(value) => setFormData({ ...formData, discount: value })}
                        className="w-32 h-8 text-right"
                      />
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={formData.items.length === 0}>
                    Registrar Venda
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Vendas</p>
                <p className="text-2xl font-bold">{completedSales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lucro Bruto</p>
                <p className="text-2xl font-bold">{formatCurrency(totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <User className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== "all" ? "Nenhuma venda encontrada" : "Nenhuma venda registrada"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => {
                  const profit = sale.total_amount - sale.total_cost;
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(sale.sale_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>{sale.customer_name || "-"}</TableCell>
                      <TableCell>{sale.salesperson?.name || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={profit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {formatCurrency(profit)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {sale.status === "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelSale(sale)}
                              >
                                Cancelar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedSale(sale);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
