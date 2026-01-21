import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Settings, Tag, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { InventoryCategory, InventorySettings } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ClientInventorySettingsPanel({ projectId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", color: "#3b82f6" });

  const { data: settings } = useQuery({
    queryKey: ["inventory-settings", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inventory_settings")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as InventorySettings | null;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inventory_categories")
        .select("*")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data as InventoryCategory[];
    },
  });

  const { data: financialCategories = [] } = useQuery({
    queryKey: ["financial-categories", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_categories")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const upsertSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<InventorySettings>) => {
      if (settings?.id) {
        const { error } = await supabase
          .from("client_inventory_settings")
          .update(newSettings)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_inventory_settings")
          .insert({ project_id: projectId, ...newSettings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-settings", projectId] });
      toast.success("Configurações salvas");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        const { error } = await supabase
          .from("client_inventory_categories")
          .update(categoryForm)
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_inventory_categories")
          .insert({ project_id: projectId, ...categoryForm });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories", projectId] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", color: "#3b82f6" });
      toast.success(editingCategory ? "Categoria atualizada" : "Categoria criada");
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_inventory_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories", projectId] });
      toast.success("Categoria excluída");
    },
    onError: () => toast.error("Erro ao excluir categoria"),
  });

  const openEditCategory = (category: InventoryCategory) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || "", color: category.color });
    setCategoryDialogOpen(true);
  };

  const expenseCategories = financialCategories.filter((c: any) => c.type === "expense");
  const incomeCategories = financialCategories.filter((c: any) => c.type === "income");

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>Configure o comportamento do módulo de estoque</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Permitir estoque negativo</Label>
              <p className="text-sm text-muted-foreground">
                Permite vender mesmo sem estoque disponível
              </p>
            </div>
            <Switch
              checked={settings?.allow_negative_stock ?? false}
              onCheckedChange={(checked) => upsertSettingsMutation.mutate({ allow_negative_stock: checked })}
              disabled={!canEdit}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertas de estoque mínimo</Label>
              <p className="text-sm text-muted-foreground">
                Exibir alertas quando o estoque estiver baixo
              </p>
            </div>
            <Switch
              checked={settings?.alerts_enabled ?? true}
              onCheckedChange={(checked) => upsertSettingsMutation.mutate({ alerts_enabled: checked })}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Financial Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Integração Financeira
          </CardTitle>
          <CardDescription>Configure as categorias financeiras para lançamentos automáticos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Categoria para Compras</Label>
              <Select
                value={settings?.purchase_category_id || ""}
                onValueChange={(value) => upsertSettingsMutation.mutate({ purchase_category_id: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria para Vendas</Label>
              <Select
                value={settings?.sale_category_id || ""}
                onValueChange={(value) => upsertSettingsMutation.mutate({ sale_category_id: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {incomeCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria para Perdas</Label>
              <Select
                value={settings?.loss_category_id || ""}
                onValueChange={(value) => upsertSettingsMutation.mutate({ loss_category_id: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Categorias de Produtos
            </CardTitle>
            <CardDescription>Organize seus produtos por categorias</CardDescription>
          </div>
          {canEdit && (
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: "", description: "", color: "#3b82f6" });
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Ex: Bebidas"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder="Descrição opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => saveCategoryMutation.mutate()}
                    disabled={!categoryForm.name || saveCategoryMutation.isPending}
                  >
                    {saveCategoryMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">Nenhuma categoria cadastrada</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cor</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">{category.description || "-"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditCategory(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
