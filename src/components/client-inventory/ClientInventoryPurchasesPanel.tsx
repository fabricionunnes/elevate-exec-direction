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
import { Plus, Trash2, ShoppingCart, Search, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InventoryPurchase, InventorySupplier, InventoryProduct } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface PurchaseItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
  product?: InventoryProduct;
}

export function ClientInventoryPurchasesPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: "",
    purchase_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    invoice_number: "",
    payment_method: "",
    notes: "",
  });
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, suppliersRes, productsRes] = await Promise.all([
        supabase
          .from("client_inventory_purchases")
          .select("*, supplier:client_inventory_suppliers(*), items:client_inventory_purchase_items(*, product:client_inventory_products(*))")
          .eq("project_id", projectId)
          .order("purchase_date", { ascending: false }),
        supabase
          .from("client_inventory_suppliers")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("client_inventory_products")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
      ]);

      setPurchases(purchasesRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error("Error loading purchases:", error);
      toast.error("Erro ao carregar compras");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setFormData({
      supplier_id: "",
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      invoice_number: "",
      payment_method: "",
      notes: "",
    });
    setItems([]);
    setShowDialog(true);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: 1, unit_cost: 0 }]);
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill cost from product
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].unit_cost = product.average_cost || 0;
        newItems[index].product = product;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  };

  const handleSave = async () => {
    if (!formData.supplier_id) {
      toast.error("Selecione um fornecedor");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    if (items.some((i) => !i.product_id)) {
      toast.error("Selecione o produto em todos os itens");
      return;
    }

    setSaving(true);
    try {
      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from("client_inventory_purchases")
        .insert({
          project_id: projectId,
          supplier_id: formData.supplier_id,
          purchase_date: formData.purchase_date,
          due_date: formData.due_date || null,
          invoice_number: formData.invoice_number || null,
          payment_method: formData.payment_method || null,
          notes: formData.notes || null,
          total_amount: calculateTotal(),
          status: "pending",
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const itemsPayload = items.map((item) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from("client_inventory_purchase_items")
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      toast.success("Compra registrada com sucesso");
      setShowDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving purchase:", error);
      toast.error(error.message || "Erro ao salvar compra");
    } finally {
      setSaving(false);
    }
  };

  const confirmPurchase = async (purchase: InventoryPurchase) => {
    try {
      // Update stock for each item
      for (const item of purchase.items || []) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) continue;

        const newStock = Number(product.current_stock) + Number(item.quantity);
        
        // Calculate new average cost
        const oldValue = Number(product.current_stock) * Number(product.average_cost);
        const newValue = Number(item.quantity) * Number(item.unit_cost);
        const newAvgCost = newStock > 0 ? (oldValue + newValue) / newStock : item.unit_cost;

        // Update product stock
        await supabase
          .from("client_inventory_products")
          .update({
            current_stock: newStock,
            average_cost: newAvgCost,
          })
          .eq("id", item.product_id);

        // Create movement
        await supabase.from("client_inventory_movements").insert({
          project_id: projectId,
          product_id: item.product_id,
          movement_type: "purchase",
          quantity: item.quantity,
          quantity_before: product.current_stock,
          quantity_after: newStock,
          reference_type: "purchase",
          reference_id: purchase.id,
        });
      }

      // Create payable
      const { data: payable } = await supabase
        .from("client_financial_payables")
        .insert({
          project_id: projectId,
          supplier_name: purchase.supplier?.name || "Fornecedor",
          description: `Compra #${purchase.invoice_number || purchase.id.slice(0, 8)}`,
          amount: purchase.total_amount,
          due_date: purchase.due_date || purchase.purchase_date,
          status: "open",
        })
        .select()
        .single();

      // Update purchase status
      await supabase
        .from("client_inventory_purchases")
        .update({
          status: "confirmed",
          payable_id: payable?.id,
        })
        .eq("id", purchase.id);

      toast.success("Compra confirmada! Estoque atualizado e conta a pagar gerada.");
      loadData();
    } catch (error: any) {
      console.error("Error confirming purchase:", error);
      toast.error(error.message || "Erro ao confirmar compra");
    }
  };

  const cancelPurchase = async (purchase: InventoryPurchase) => {
    if (!confirm("Cancelar esta compra?")) return;

    try {
      await supabase
        .from("client_inventory_purchases")
        .update({ status: "cancelled" })
        .eq("id", purchase.id);

      toast.success("Compra cancelada");
      loadData();
    } catch (error: any) {
      console.error("Error cancelling purchase:", error);
      toast.error(error.message || "Erro ao cancelar compra");
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
      case "confirmed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Confirmada</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPurchases = purchases.filter((p) =>
    p.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-xl font-semibold">Compras</h2>
          <p className="text-sm text-muted-foreground">
            Registre compras para dar entrada no estoque
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar compras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Compra
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
                <TableHead>Fornecedor</TableHead>
                <TableHead>NF/Ref</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-32"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8">
                    <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma compra encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      {format(new Date(purchase.purchase_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{purchase.supplier?.name || "-"}</p>
                    </TableCell>
                    <TableCell>
                      {purchase.invoice_number || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(purchase.total_amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        {purchase.status === "pending" && (
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmPurchase(purchase)}
                              title="Confirmar"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => cancelPurchase(purchase)}
                              title="Cancelar"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor *</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data da Compra</Label>
                <Input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Nº Nota Fiscal</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Número da NF"
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens da Compra</Label>
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
                  {items.map((item, index) => (
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
                                {p.name} ({p.base_unit})
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
                          value={item.unit_cost}
                          onChange={(e) => updateItem(index, "unit_cost", Number(e.target.value))}
                          placeholder="Custo unit."
                        />
                      </div>
                      <div className="w-24 text-right font-medium">
                        {formatCurrency(item.quantity * item.unit_cost)}
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
                  ))}

                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-xl font-bold">{formatCurrency(calculateTotal())}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
              {saving ? "Salvando..." : "Salvar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
