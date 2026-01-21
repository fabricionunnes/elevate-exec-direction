import { useState, useEffect, useMemo } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, ShoppingCart, Search, Receipt, User, Calendar, CreditCard, Check, ChevronsUpDown, Package, FileText } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
  const [salespersonOpen, setSalespersonOpen] = useState(false);
  const [salespersonSearch, setSalespersonSearch] = useState("");

  // Filtered salespeople based on search
  const filteredSalespeople = useMemo(() => {
    if (!salespersonSearch) return salespeople;
    return salespeople.filter((sp) =>
      sp.name.toLowerCase().includes(salespersonSearch.toLowerCase())
    );
  }, [salespeople, salespersonSearch]);

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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Nova Venda
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 pt-4">
                {/* Section: Informações Gerais */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações Gerais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Data da Venda
                      </Label>
                      <Input
                        type="date"
                        value={formData.sale_date}
                        onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Cliente
                      </Label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="Nome do cliente (opcional)"
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Vendedor e Pagamento */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Vendedor & Pagamento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                    {/* Salesperson Combobox with search */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Vendedor
                      </Label>
                      <Popover open={salespersonOpen} onOpenChange={setSalespersonOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={salespersonOpen}
                            className="w-full justify-between bg-background font-normal"
                          >
                            {formData.salesperson_id
                              ? salespeople.find((sp) => sp.id === formData.salesperson_id)?.name
                              : "Selecione o vendedor..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Buscar vendedor..." 
                              value={salespersonSearch}
                              onValueChange={setSalespersonSearch}
                            />
                            <CommandList>
                              <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    setFormData({ ...formData, salesperson_id: "" });
                                    setSalespersonOpen(false);
                                    setSalespersonSearch("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      !formData.salesperson_id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="text-muted-foreground">Sem vendedor</span>
                                </CommandItem>
                                {filteredSalespeople.map((sp) => (
                                  <CommandItem
                                    key={sp.id}
                                    value={sp.id}
                                    onSelect={() => {
                                      setFormData({ ...formData, salesperson_id: sp.id });
                                      setSalespersonOpen(false);
                                      setSalespersonSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.salesperson_id === sp.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {sp.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Forma de Pagamento
                      </Label>
                      <Select
                        value={formData.payment_method_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, payment_method_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger className="bg-background">
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
                </div>

                {/* Section: Itens da Venda */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Itens da Venda
                    </h3>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Adicionar Item
                    </Button>
                  </div>

                  {formData.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/20">
                      <Package className="h-10 w-10 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground text-center">
                        Nenhum item adicionado
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Clique em "Adicionar Item" para incluir produtos
                      </p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Produto</TableHead>
                            <TableHead className="w-24 font-semibold">Qtd</TableHead>
                            <TableHead className="w-36 font-semibold">Preço Unit.</TableHead>
                            <TableHead className="w-32 font-semibold text-right">Total</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.items.map((item, index) => (
                            <TableRow key={index} className="group">
                              <TableCell>
                                <Select
                                  value={item.product_id}
                                  onValueChange={(value) => handleUpdateItem(index, { product_id: value })}
                                >
                                  <SelectTrigger className="h-9">
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
                                  className="h-9"
                                />
                              </TableCell>
                              <TableCell>
                                <CurrencyInput
                                  value={item.unit_price}
                                  onChange={(value) => handleUpdateItem(index, { unit_price: value })}
                                  className="h-9"
                                />
                              </TableCell>
                              <TableCell className="font-semibold text-right">
                                {formatCurrency(item.total)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity"
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
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 space-y-3 border border-primary/20">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Desconto:</span>
                      <CurrencyInput
                        value={formData.discount}
                        onChange={(value) => setFormData({ ...formData, discount: value })}
                        className="w-36 h-9 text-right"
                      />
                    </div>
                    <div className="flex justify-between items-center font-bold text-xl border-t border-primary/20 pt-3">
                      <span>Total:</span>
                      <span className="text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={formData.items.length === 0} className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
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
