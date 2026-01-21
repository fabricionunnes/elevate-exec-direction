import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, ClipboardList, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InventorySale, InventoryProduct } from "./types";
import { SALE_UNITS } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: InventoryProduct;
}

export function ClientInventorySalesPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<InventorySale[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
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
  });
  const [items, setItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, productsRes] = await Promise.all([
        supabase
          .from("client_inventory_sales")
          .select("*, items:client_inventory_sale_items(*, product:client_inventory_products(*))")
          .eq("project_id", projectId)
          .order("sale_date", { ascending: false }),
        supabase
          .from("client_inventory_products")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
      ]);

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
      
      // Convert sale unit quantity to base unit quantity
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
          notes: formData.notes || null,
          total_amount: subtotal,
          discount_amount: formData.discount_amount,
          final_amount: finalAmount,
          total_cost: totalCost,
          gross_profit: grossProfit,
          profit_margin: profitMargin,
          status: "completed",
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

      // Create receivable
      await supabase.from("client_financial_receivables").insert({
        project_id: projectId,
        client_name: formData.customer_name || "Cliente",
        description: `Venda #${sale.id.slice(0, 8)}`,
        amount: finalAmount,
        due_date: formData.sale_date,
        status: "paid",
        paid_at: formData.sale_date,
        paid_amount: finalAmount,
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

  const filteredSales = sales.filter((s) =>
    s.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Vendas (Saída de Estoque)</h2>
          <p className="text-sm text-muted-foreground">
            Registre vendas para dar saída no estoque
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
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
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sale.final_amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(sale.total_cost)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${sale.gross_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(sale.gross_profit)}
                    </TableCell>
                    <TableCell className={`text-right ${sale.profit_margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {sale.profit_margin.toFixed(1)}%
                    </TableCell>
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
                            placeholder="Preço unit."
                          />
                        </div>
                        <div className="w-24 text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Totals */}
            {items.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Desconto</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) })}
                    className="w-32 h-8 text-right"
                  />
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="text-green-600">{formatCurrency(calculateTotal())}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>CMV (Custo)</span>
                  <span>{formatCurrency(calculateCost())}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Lucro Bruto</span>
                  <span className={calculateTotal() - calculateCost() >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(calculateTotal() - calculateCost())}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Registrar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
