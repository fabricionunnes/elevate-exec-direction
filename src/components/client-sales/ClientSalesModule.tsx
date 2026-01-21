import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, Search, TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InventoryProduct {
  id: string;
  name: string;
  sku?: string;
  base_unit: string;
  sale_unit?: string;
  conversion_factor: number;
  current_stock: number;
  average_cost: number;
  sale_price: number;
  allow_negative_stock: boolean;
  is_active: boolean;
}

interface Sale {
  id: string;
  project_id: string;
  customer_name?: string;
  customer_document?: string;
  sale_date: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_method?: string;
  payment_status?: string;
  seller_name?: string;
  notes?: string;
  status: string;
  total_cost?: number;
  gross_profit?: number;
  profit_margin?: number;
  created_at: string;
}

interface Props {
  projectId: string;
  userRole?: string;
}

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: InventoryProduct;
}

interface Salesperson {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name?: string;
}

export function ClientSalesModule({ projectId, userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_document: "",
    sale_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "",
    discount_amount: 0,
    notes: "",
    is_paid: true,
    seller_id: "",
    seller_name: "",
    bank_account_id: "",
  });
  const [items, setItems] = useState<SaleItem[]>([]);

  const canEdit = userRole === "client" || userRole === "admin";

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get company_id from project
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company_id")
        .eq("id", projectId)
        .single();

      const companyId = project?.onboarding_company_id;

      const [salesRes, productsRes] = await Promise.all([
        supabase
          .from("client_inventory_sales")
          .select("*")
          .eq("project_id", projectId)
          .order("sale_date", { ascending: false }),
        supabase
          .from("client_inventory_products")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
      ]);

      // Fetch salespeople if we have company_id
      if (companyId) {
        const { data: salespeopleData } = await supabase
          .from("company_salespeople")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name");
        setSalespeople(salespeopleData || []);
      }

      // Fetch bank accounts
      const { data: bankData } = await supabase
        .from("client_financial_bank_accounts")
        .select("id, name, bank_name")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");
      setBankAccounts(bankData || []);

      setSales(salesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error("Error loading sales:", error);
      toast.error("Erro ao carregar vendas");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setFormData({
      customer_name: "",
      customer_document: "",
      sale_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "",
      discount_amount: 0,
      notes: "",
      is_paid: true,
      seller_id: "",
      seller_name: "",
      bank_account_id: "",
    });
    setItems([]);
    setShowDialog(true);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].unit_price = product.sale_price || 0;
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

  const calculateCost = () => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return sum;
      
      const conversionFactor = product.conversion_factor || 1;
      const baseQty = item.quantity / conversionFactor;
      
      return sum + baseQty * Number(product.average_cost);
    }, 0);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    if (items.some((i) => !i.product_id)) {
      toast.error("Selecione o produto em todos os itens");
      return;
    }
    if (!formData.bank_account_id) {
      toast.error("Selecione a conta bancária");
      return;
    }
    if (!formData.payment_method) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    // Check stock availability
    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;
      
      const conversionFactor = product.conversion_factor || 1;
      const baseQty = item.quantity / conversionFactor;
      
      if (!product.allow_negative_stock && baseQty > product.current_stock) {
        toast.error(`Estoque insuficiente para ${product.name}. Disponível: ${product.current_stock} ${product.base_unit}`);
        return;
      }
    }

    setSaving(true);
    try {
      const subtotal = calculateSubtotal();
      const totalCost = calculateCost();
      const finalAmount = calculateTotal();
      const grossProfit = finalAmount - totalCost;
      const profitMargin = finalAmount > 0 ? (grossProfit / finalAmount) * 100 : 0;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("client_inventory_sales")
        .insert({
          project_id: projectId,
          customer_name: formData.customer_name || null,
          customer_document: formData.customer_document || null,
          sale_date: formData.sale_date,
          payment_method: formData.payment_method || null,
          seller_id: formData.seller_id || null,
          seller_name: formData.seller_name || null,
          notes: formData.notes || null,
          total_amount: subtotal,
          discount_amount: formData.discount_amount,
          final_amount: finalAmount,
          total_cost: totalCost,
          gross_profit: grossProfit,
          profit_margin: profitMargin,
          status: "completed",
          payment_status: formData.is_paid ? "paid" : "pending",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items and update stock
      for (const item of items) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) continue;
        
        const conversionFactor = product.conversion_factor || 1;
        const baseQty = item.quantity / conversionFactor;
        const unitCost = product.average_cost;
        const totalItemCost = baseQty * unitCost;

        // Create sale item
        await supabase.from("client_inventory_sale_items").insert({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          quantity_base: baseQty,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          unit_cost: unitCost,
          total_cost: totalItemCost,
        });

        // Update product stock
        const newStock = Number(product.current_stock) - baseQty;
        await supabase
          .from("client_inventory_products")
          .update({ current_stock: newStock })
          .eq("id", item.product_id);

        // Create movement
        await supabase.from("client_inventory_movements").insert({
          project_id: projectId,
          product_id: item.product_id,
          movement_type: "sale",
          quantity: -baseQty,
          quantity_before: product.current_stock,
          quantity_after: newStock,
          reference_type: "sale",
          reference_id: sale.id,
        });
      }

      // Create receivable with correct status
      await supabase.from("client_financial_receivables").insert({
        project_id: projectId,
        client_name: formData.customer_name || "Cliente",
        description: `Venda #${sale.id.slice(0, 8)}`,
        amount: finalAmount,
        due_date: formData.sale_date,
        status: formData.is_paid ? "paid" : "pending",
        paid_at: formData.is_paid ? formData.sale_date : null,
        paid_amount: formData.is_paid ? finalAmount : null,
      });

      toast.success("Venda registrada com sucesso!");
      setShowDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving sale:", error);
      toast.error(error.message || "Erro ao salvar venda");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pendente</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Concluída</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Pago</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">A Receber</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredSales = sales.filter((s) =>
    s.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary
  const totalSales = sales.reduce((sum, s) => sum + s.final_amount, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.gross_profit, 0);
  const totalPending = sales.filter(s => s.payment_status === "pending").reduce((sum, s) => sum + s.final_amount, 0);
  const averageMargin = sales.length > 0 ? sales.reduce((sum, s) => sum + s.profit_margin, 0) / sales.length : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Registre vendas, controle receitas e acompanhe a lucratividade
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vendas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Total Vendas</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalSales)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs">Lucro Total</span>
            </div>
            <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totalProfit)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              <span className="text-xs">A Receber</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs">Margem Média</span>
            </div>
            <p className="text-xl font-bold">{averageMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
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
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma venda encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {format(new Date(sale.sale_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{sale.customer_name || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{sale.seller_name || "-"}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sale.final_amount)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${(sale.gross_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(sale.gross_profit || 0)}
                    </TableCell>
                    <TableCell className={`text-right ${(sale.profit_margin || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(sale.profit_margin || 0).toFixed(1)}%
                    </TableCell>
                    <TableCell>{getPaymentStatusBadge(sale.payment_status || "pending")}</TableCell>
                    <TableCell>{getStatusBadge(sale.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Venda</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cliente</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>

              <div>
                <Label>CPF/CNPJ</Label>
                <Input
                  value={formData.customer_document}
                  onChange={(e) => setFormData({ ...formData, customer_document: e.target.value })}
                  placeholder="Documento"
                />
              </div>

              <div>
                <Label>Data da Venda</Label>
                <Input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Vendedor</Label>
                <Select
                  value={formData.seller_id}
                  onValueChange={(v) => {
                    const salesperson = salespeople.find((sp) => sp.id === v);
                    setFormData({
                      ...formData,
                      seller_id: v,
                      seller_name: salesperson?.name || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vendedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {salespeople.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        Nenhum vendedor cadastrado
                      </SelectItem>
                    ) : (
                      salespeople.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Forma de Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Cartão Crédito</SelectItem>
                    <SelectItem value="debito">Cartão Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
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
                      <SelectItem key={ba.id} value={ba.id}>
                        {ba.name} {ba.bank_name ? `(${ba.bank_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Status */}
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="is_paid"
                checked={formData.is_paid}
                onCheckedChange={(checked) => setFormData({ ...formData, is_paid: checked as boolean })}
              />
              <Label htmlFor="is_paid" className="cursor-pointer">
                Venda já foi paga
              </Label>
              <span className="text-xs text-muted-foreground ml-2">
                {formData.is_paid ? "(Será registrada como receita paga)" : "(Será registrada como conta a receber pendente)"}
              </span>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens da Venda</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  Clique em "Adicionar Item" para incluir produtos
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const product = products.find((p) => p.id === item.product_id);
                    return (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <Select
                            value={item.product_id}
                            onValueChange={(v) => updateItem(index, "product_id", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o produto..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.sale_unit || p.base_unit}) - Est: {p.current_stock} {p.base_unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                            placeholder="Qtd"
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, "unit_price", Number(e.target.value))}
                            placeholder="Preço"
                          />
                        </div>
                        <div className="w-28 text-right font-medium text-sm">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas da venda..."
                  rows={1}
                />
              </div>
            </div>

            {/* Totals */}
            {items.length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                {formData.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Desconto:</span>
                    <span>-{formatCurrency(formData.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Custo total:</span>
                  <span>{formatCurrency(calculateCost())}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
                <div className={`flex justify-between text-sm ${calculateTotal() - calculateCost() >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <span>Lucro estimado:</span>
                  <span>{formatCurrency(calculateTotal() - calculateCost())}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? "Salvando..." : "Registrar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
