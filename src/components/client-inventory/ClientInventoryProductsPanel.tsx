import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle } from "lucide-react";
import type { InventoryProduct, InventoryCategory } from "./types";
import { BASE_UNITS, SALE_UNITS } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ClientInventoryProductsPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category_id: "",
    base_unit: "UN",
    sale_unit: "UN",
    conversion_factor: 1,
    min_stock: 0,
    sale_price: 0,
    allow_fractional: false,
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from("client_inventory_products")
          .select("*, category:client_inventory_categories(*)")
          .eq("project_id", projectId)
          .order("name"),
        supabase
          .from("client_inventory_categories")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
      ]);

      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleBaseUnitChange = (unit: string) => {
    const saleUnits = SALE_UNITS[unit] || SALE_UNITS.UN;
    setFormData({
      ...formData,
      base_unit: unit,
      sale_unit: saleUnits[0].value,
      conversion_factor: saleUnits[0].factor,
    });
  };

  const handleSaleUnitChange = (unit: string) => {
    const saleUnits = SALE_UNITS[formData.base_unit] || SALE_UNITS.UN;
    const found = saleUnits.find((u) => u.value === unit);
    setFormData({
      ...formData,
      sale_unit: unit,
      conversion_factor: found?.factor || 1,
    });
  };

  const openNew = () => {
    setEditing(null);
    setFormData({
      name: "",
      sku: "",
      description: "",
      category_id: "",
      base_unit: "UN",
      sale_unit: "UN",
      conversion_factor: 1,
      min_stock: 0,
      sale_price: 0,
      allow_fractional: false,
    });
    setShowDialog(true);
  };

  const openEdit = (product: InventoryProduct) => {
    setEditing(product);
    setFormData({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      category_id: product.category_id || "",
      base_unit: product.base_unit,
      sale_unit: product.sale_unit || product.base_unit,
      conversion_factor: product.conversion_factor,
      min_stock: product.min_stock,
      sale_price: product.sale_price,
      allow_fractional: product.allow_fractional,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        description: formData.description.trim() || null,
        category_id: formData.category_id || null,
        base_unit: formData.base_unit,
        sale_unit: formData.sale_unit,
        conversion_factor: formData.conversion_factor,
        min_stock: formData.min_stock,
        sale_price: formData.sale_price,
        allow_fractional: formData.allow_fractional,
      };

      if (editing) {
        const { error } = await supabase
          .from("client_inventory_products")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Produto atualizado");
      } else {
        const { error } = await supabase
          .from("client_inventory_products")
          .insert(payload);
        if (error) throw error;
        toast.success("Produto criado");
      }

      setShowDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: InventoryProduct) => {
    if (!confirm(`Excluir produto "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("client_inventory_products")
        .delete()
        .eq("id", product.id);
      if (error) throw error;
      toast.success("Produto excluído");
      loadData();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error(error.message || "Erro ao excluir produto");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
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
          <h2 className="text-xl font-semibold">Produtos</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo
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
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-right">Custo Médio</TableHead>
                <TableHead className="text-right">Preço Venda</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                {canEdit && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 7 : 6} className="text-center py-8">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum produto encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const isLowStock = product.current_stock <= product.min_stock;
                  const margin = product.sale_price > 0 && product.average_cost > 0
                    ? ((product.sale_price - product.average_cost) / product.sale_price) * 100
                    : 0;

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isLowStock && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.category ? (
                          <Badge variant="outline" style={{ borderColor: product.category.color }}>
                            {product.category.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={isLowStock ? "text-amber-500 font-bold" : ""}>
                          {product.current_stock} {product.base_unit}
                        </span>
                        {product.min_stock > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Mín: {product.min_stock}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.average_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.sale_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                          {margin.toFixed(1)}%
                        </span>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(product)}
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

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do produto"
                />
              </div>

              <div>
                <Label>SKU / Código</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Código interno"
                />
              </div>

              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Unidade Base</Label>
                <Select
                  value={formData.base_unit}
                  onValueChange={handleBaseUnitChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label} ({u.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Unidade de Venda</Label>
                <Select
                  value={formData.sale_unit}
                  onValueChange={handleSaleUnitChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(SALE_UNITS[formData.base_unit] || SALE_UNITS.UN).map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label} ({u.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.conversion_factor !== 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    1 {formData.base_unit} = {formData.conversion_factor} {formData.sale_unit}
                  </p>
                )}
              </div>

              <div>
                <Label>Estoque Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  step={formData.allow_fractional ? "0.01" : "1"}
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>Preço de Venda (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  id="allow_fractional"
                  checked={formData.allow_fractional}
                  onCheckedChange={(v) => setFormData({ ...formData, allow_fractional: v })}
                />
                <Label htmlFor="allow_fractional">Permitir estoque fracionado</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
