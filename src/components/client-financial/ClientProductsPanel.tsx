import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { FinancialProduct, FinancialCategory } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface FormData {
  name: string;
  description: string;
  sku: string;
  unit_price: number;
  cost_price: number;
  category_id: string;
  is_active: boolean;
}

const initialFormData: FormData = {
  name: "",
  description: "",
  sku: "",
  unit_price: 0,
  cost_price: 0,
  category_id: "",
  is_active: true,
};

export function ClientProductsPanel({ projectId, canEdit }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<FinancialProduct[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FinancialProduct | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from("client_financial_products")
          .select("*, category:client_financial_categories(*)")
          .eq("project_id", projectId)
          .order("name"),
        supabase
          .from("client_financial_categories")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    try {
      const dataToSave = {
        project_id: projectId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        sku: formData.sku.trim() || null,
        unit_price: formData.unit_price,
        cost_price: formData.cost_price,
        category_id: formData.category_id || null,
        is_active: formData.is_active,
      };

      if (selectedProduct) {
        const { error } = await supabase
          .from("client_financial_products")
          .update(dataToSave)
          .eq("id", selectedProduct.id);

        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("client_financial_products")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Produto cadastrado!");
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Erro ao salvar produto");
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from("client_financial_products")
        .delete()
        .eq("id", selectedProduct.id);

      if (error) throw error;
      toast.success("Produto excluído!");
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      if (error.code === "23503") {
        toast.error("Não é possível excluir um produto com vendas associadas");
      } else {
        toast.error("Erro ao excluir produto");
      }
    }
  };

  const openEditDialog = (product: FinancialProduct) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      sku: product.sku || "",
      unit_price: product.unit_price,
      cost_price: product.cost_price,
      category_id: product.category_id || "",
      is_active: product.is_active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedProduct(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = products.filter((p) => p.is_active).length;
  const avgMargin =
    products.length > 0
      ? products.reduce((sum, p) => {
          const margin = p.unit_price > 0 ? ((p.unit_price - p.cost_price) / p.unit_price) * 100 : 0;
          return sum + margin;
        }, 0) / products.length
      : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Produtos e Serviços</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre produtos e serviços para lançar vendas
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
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedProduct ? "Editar Produto" : "Novo Produto"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do produto ou serviço"
                  />
                </div>

                <div className="space-y-2">
                  <Label>SKU / Código</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Código do produto"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do produto"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preço de Venda</Label>
                    <CurrencyInput
                      value={formData.unit_price}
                      onChange={(value) => setFormData({ ...formData, unit_price: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo</Label>
                    <CurrencyInput
                      value={formData.cost_price}
                      onChange={(value) => setFormData({ ...formData, cost_price: value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem categoria</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Produto ativo</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Produtos</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Produtos Ativos</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margem Média</p>
                <p className="text-2xl font-bold">{avgMargin.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const margin = product.unit_price > 0
                    ? ((product.unit_price - product.cost_price) / product.unit_price) * 100
                    : 0;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                      <TableCell>{product.category?.name || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(product.unit_price)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(product.cost_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-rose-600"}>
                          {margin.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedProduct(product);
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
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedProduct?.name}"? Esta ação não pode ser desfeita.
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
