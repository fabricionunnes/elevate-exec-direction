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
import { Plus, Trash2, FileText, Search, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InventoryBudget, InventorySupplier, InventoryProduct } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface BudgetItem {
  product_id: string;
  quantity: number;
  estimated_unit_cost: number;
  product?: InventoryProduct;
}

export function ClientInventoryBudgetsPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<InventoryBudget[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: "",
    budget_date: format(new Date(), "yyyy-MM-dd"),
    validity_date: "",
    notes: "",
  });
  const [items, setItems] = useState<BudgetItem[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetsRes, suppliersRes, productsRes] = await Promise.all([
        supabase
          .from("client_inventory_budgets")
          .select("*, supplier:client_inventory_suppliers(*), items:client_inventory_budget_items(*, product:client_inventory_products(*))")
          .eq("project_id", projectId)
          .order("budget_date", { ascending: false }),
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

      setBudgets(budgetsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error("Error loading budgets:", error);
      toast.error("Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setFormData({
      supplier_id: "",
      budget_date: format(new Date(), "yyyy-MM-dd"),
      validity_date: "",
      notes: "",
    });
    setItems([]);
    setShowDialog(true);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: 1, estimated_unit_cost: 0 }]);
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].estimated_unit_cost = product.average_cost || 0;
        newItems[index].product = product;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.estimated_unit_cost, 0);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    setSaving(true);
    try {
      const { data: budget, error: budgetError } = await supabase
        .from("client_inventory_budgets")
        .insert({
          project_id: projectId,
          supplier_id: formData.supplier_id || null,
          budget_date: formData.budget_date,
          validity_date: formData.validity_date || null,
          notes: formData.notes || null,
          total_amount: calculateTotal(),
          status: "negotiating",
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      const itemsPayload = items.map((item) => ({
        budget_id: budget.id,
        product_id: item.product_id,
        quantity: item.quantity,
        estimated_unit_cost: item.estimated_unit_cost,
        estimated_total: item.quantity * item.estimated_unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from("client_inventory_budget_items")
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      toast.success("Orçamento criado com sucesso");
      setShowDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving budget:", error);
      toast.error(error.message || "Erro ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (budget: InventoryBudget, status: string) => {
    try {
      await supabase
        .from("client_inventory_budgets")
        .update({ status })
        .eq("id", budget.id);

      toast.success("Status atualizado");
      loadData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Erro ao atualizar status");
    }
  };

  const convertToPurchase = async (budget: InventoryBudget) => {
    try {
      // Create purchase from budget
      const { data: purchase, error: purchaseError } = await supabase
        .from("client_inventory_purchases")
        .insert({
          project_id: projectId,
          supplier_id: budget.supplier_id,
          purchase_date: format(new Date(), "yyyy-MM-dd"),
          total_amount: budget.total_amount,
          notes: `Convertido do orçamento de ${format(new Date(budget.budget_date), "dd/MM/yyyy")}`,
          status: "pending",
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items from budget items
      const purchaseItems = (budget.items || []).map((item) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.estimated_unit_cost,
        total_cost: item.estimated_total,
      }));

      if (purchaseItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("client_inventory_purchase_items")
          .insert(purchaseItems);
        if (itemsError) throw itemsError;
      }

      // Update budget status
      await supabase
        .from("client_inventory_budgets")
        .update({ status: "converted", converted_purchase_id: purchase.id })
        .eq("id", budget.id);

      toast.success("Orçamento convertido em compra!");
      loadData();
    } catch (error: any) {
      console.error("Error converting budget:", error);
      toast.error(error.message || "Erro ao converter orçamento");
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
      case "negotiating":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Em negociação</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Reprovado</Badge>;
      case "converted":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Convertido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredBudgets = budgets.filter((b) =>
    b.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-xl font-semibold">Orçamentos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie orçamentos de fornecedores
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar orçamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
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
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-48"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBudgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum orçamento encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBudgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell>
                      {format(new Date(budget.budget_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{budget.supplier?.name || "-"}</p>
                    </TableCell>
                    <TableCell>
                      {budget.validity_date
                        ? format(new Date(budget.validity_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(budget.total_amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(budget.status)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {budget.status === "negotiating" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateStatus(budget, "approved")}
                              >
                                Aprovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateStatus(budget, "rejected")}
                              >
                                Reprovar
                              </Button>
                            </>
                          )}
                          {budget.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => convertToPurchase(budget)}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Converter em Compra
                            </Button>
                          )}
                        </div>
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
            <DialogTitle>Novo Orçamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor</Label>
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
                <Label>Data do Orçamento</Label>
                <Input
                  type="date"
                  value={formData.budget_date}
                  onChange={(e) => setFormData({ ...formData, budget_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={formData.validity_date}
                  onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens do Orçamento</Label>
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
                          value={item.estimated_unit_cost}
                          onChange={(e) => updateItem(index, "estimated_unit_cost", Number(e.target.value))}
                          placeholder="Custo est."
                        />
                      </div>
                      <div className="w-24 text-right font-medium">
                        {formatCurrency(item.quantity * item.estimated_unit_cost)}
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
                      <p className="text-sm text-muted-foreground">Total Estimado</p>
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
              {saving ? "Salvando..." : "Salvar Orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
