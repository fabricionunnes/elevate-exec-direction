import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Tag,
  Building,
  CreditCard,
} from "lucide-react";
import type { FinancialCategory, FinancialCostCenter, FinancialPaymentMethod } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

const CATEGORY_COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", 
  "#6366f1", "#14b8a6", "#f97316", "#ef4444", "#84cc16",
];

export function ClientFinancialSettingsPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("categories");
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [costCenters, setCostCenters] = useState<FinancialCostCenter[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FinancialPaymentMethod[]>([]);
  
  // Category dialog
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "expense" as "income" | "expense",
    description: "",
    color: CATEGORY_COLORS[0],
    is_active: true,
  });

  // Cost center dialog
  const [showCostCenterDialog, setShowCostCenterDialog] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<FinancialCostCenter | null>(null);
  const [costCenterForm, setCostCenterForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  // Payment method dialog
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<FinancialPaymentMethod | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, ccRes, pmRes] = await Promise.all([
        supabase.from("client_financial_categories").select("*").eq("project_id", projectId).order("name"),
        supabase.from("client_financial_cost_centers").select("*").eq("project_id", projectId).order("name"),
        supabase.from("client_financial_payment_methods").select("*").eq("project_id", projectId).order("name"),
      ]);

      setCategories((catRes.data || []) as FinancialCategory[]);
      setCostCenters((ccRes.data || []) as FinancialCostCenter[]);
      setPaymentMethods(pmRes.data || []);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const handleSaveCategory = async () => {
    if (!categoryForm.name) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("client_financial_categories")
          .update({
            name: categoryForm.name,
            type: categoryForm.type,
            description: categoryForm.description || null,
            color: categoryForm.color,
            is_active: categoryForm.is_active,
          })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast.success("Categoria atualizada");
      } else {
        const { error } = await supabase
          .from("client_financial_categories")
          .insert({
            project_id: projectId,
            name: categoryForm.name,
            type: categoryForm.type,
            description: categoryForm.description || null,
            color: categoryForm.color,
            is_active: categoryForm.is_active,
          });
        if (error) throw error;
        toast.success("Categoria criada");
      }
      
      setShowCategoryDialog(false);
      setEditingCategory(null);
      resetCategoryForm();
      loadData();
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Erro ao salvar categoria");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    try {
      const { error } = await supabase.from("client_financial_categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("Categoria excluída");
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    }
  };

  const openEditCategory = (item: FinancialCategory) => {
    setEditingCategory(item);
    setCategoryForm({
      name: item.name,
      type: item.type as "income" | "expense",
      description: item.description || "",
      color: item.color,
      is_active: item.is_active,
    });
    setShowCategoryDialog(true);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      type: "expense",
      description: "",
      color: CATEGORY_COLORS[0],
      is_active: true,
    });
  };

  // Cost center handlers
  const handleSaveCostCenter = async () => {
    if (!costCenterForm.name) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingCostCenter) {
        const { error } = await supabase
          .from("client_financial_cost_centers")
          .update({
            name: costCenterForm.name,
            description: costCenterForm.description || null,
            is_active: costCenterForm.is_active,
          })
          .eq("id", editingCostCenter.id);
        if (error) throw error;
        toast.success("Centro de custo atualizado");
      } else {
        const { error } = await supabase
          .from("client_financial_cost_centers")
          .insert({
            project_id: projectId,
            name: costCenterForm.name,
            description: costCenterForm.description || null,
            is_active: costCenterForm.is_active,
          });
        if (error) throw error;
        toast.success("Centro de custo criado");
      }
      
      setShowCostCenterDialog(false);
      setEditingCostCenter(null);
      resetCostCenterForm();
      loadData();
    } catch (error) {
      console.error("Error saving cost center:", error);
      toast.error("Erro ao salvar");
    }
  };

  const handleDeleteCostCenter = async (id: string) => {
    if (!confirm("Excluir este centro de custo?")) return;
    try {
      const { error } = await supabase.from("client_financial_cost_centers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Centro de custo excluído");
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    }
  };

  const openEditCostCenter = (item: FinancialCostCenter) => {
    setEditingCostCenter(item);
    setCostCenterForm({
      name: item.name,
      description: item.description || "",
      is_active: item.is_active,
    });
    setShowCostCenterDialog(true);
  };

  const resetCostCenterForm = () => {
    setCostCenterForm({
      name: "",
      description: "",
      is_active: true,
    });
  };

  // Payment method handlers
  const handleSavePaymentMethod = async () => {
    if (!paymentMethodForm.name) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingPaymentMethod) {
        const { error } = await supabase
          .from("client_financial_payment_methods")
          .update({
            name: paymentMethodForm.name,
            is_active: paymentMethodForm.is_active,
          })
          .eq("id", editingPaymentMethod.id);
        if (error) throw error;
        toast.success("Forma de pagamento atualizada");
      } else {
        const { error } = await supabase
          .from("client_financial_payment_methods")
          .insert({
            project_id: projectId,
            name: paymentMethodForm.name,
            is_active: paymentMethodForm.is_active,
          });
        if (error) throw error;
        toast.success("Forma de pagamento criada");
      }
      
      setShowPaymentMethodDialog(false);
      setEditingPaymentMethod(null);
      resetPaymentMethodForm();
      loadData();
    } catch (error) {
      console.error("Error saving payment method:", error);
      toast.error("Erro ao salvar");
    }
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (!confirm("Excluir esta forma de pagamento?")) return;
    try {
      const { error } = await supabase.from("client_financial_payment_methods").delete().eq("id", id);
      if (error) throw error;
      toast.success("Forma de pagamento excluída");
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    }
  };

  const openEditPaymentMethod = (item: FinancialPaymentMethod) => {
    setEditingPaymentMethod(item);
    setPaymentMethodForm({
      name: item.name,
      is_active: item.is_active,
    });
    setShowPaymentMethodDialog(true);
  };

  const resetPaymentMethodForm = () => {
    setPaymentMethodForm({
      name: "",
      is_active: true,
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Configurações Financeiras</h2>
          <p className="text-sm text-muted-foreground">Categorias, centros de custo e formas de pagamento</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="costcenters" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Centros de Custo
          </TabsTrigger>
          <TabsTrigger value="paymentmethods" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Formas de Pagamento
          </TabsTrigger>
        </TabsList>

        {/* Categories */}
        <TabsContent value="categories" className="mt-4">
          <div className="space-y-4">
            {canEdit && (
              <Button onClick={() => { resetCategoryForm(); setShowCategoryDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {/* Income categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-green-600">Categorias de Receita</CardTitle>
                </CardHeader>
                <CardContent>
                  {incomeCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria de receita</p>
                  ) : (
                    <div className="space-y-2">
                      {incomeCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className={!cat.is_active ? "text-muted-foreground line-through" : ""}>
                              {cat.name}
                            </span>
                            {!cat.is_active && <Badge variant="secondary">Inativo</Badge>}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCategory(cat)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expense categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600">Categorias de Despesa</CardTitle>
                </CardHeader>
                <CardContent>
                  {expenseCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria de despesa</p>
                  ) : (
                    <div className="space-y-2">
                      {expenseCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className={!cat.is_active ? "text-muted-foreground line-through" : ""}>
                              {cat.name}
                            </span>
                            {!cat.is_active && <Badge variant="secondary">Inativo</Badge>}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCategory(cat)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Cost Centers */}
        <TabsContent value="costcenters" className="mt-4">
          <div className="space-y-4">
            {canEdit && (
              <Button onClick={() => { resetCostCenterForm(); setShowCostCenterDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Centro de Custo
              </Button>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead className="w-[100px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costCenters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 4 : 3} className="text-center py-8 text-muted-foreground">
                          Nenhum centro de custo cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      costCenters.map(cc => (
                        <TableRow key={cc.id}>
                          <TableCell className="font-medium">{cc.name}</TableCell>
                          <TableCell>{cc.description || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={cc.is_active ? "default" : "secondary"}>
                              {cc.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCostCenter(cc)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCostCenter(cc.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
          </div>
        </TabsContent>

        {/* Payment Methods */}
        <TabsContent value="paymentmethods" className="mt-4">
          <div className="space-y-4">
            {canEdit && (
              <Button onClick={() => { resetPaymentMethodForm(); setShowPaymentMethodDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Forma de Pagamento
              </Button>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead className="w-[100px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentMethods.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 3 : 2} className="text-center py-8 text-muted-foreground">
                          Nenhuma forma de pagamento cadastrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      paymentMethods.map(pm => (
                        <TableRow key={pm.id}>
                          <TableCell className="font-medium">{pm.name}</TableCell>
                          <TableCell>
                            <Badge variant={pm.is_active ? "default" : "secondary"}>
                              {pm.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPaymentMethod(pm)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePaymentMethod(pm.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Nome da categoria"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={categoryForm.type}
                onValueChange={(v) => setCategoryForm({ ...categoryForm, type: v as "income" | "expense" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {CATEGORY_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${categoryForm.color === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryForm({ ...categoryForm, color })}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_active: checked })}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategory}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cost Center Dialog */}
      <Dialog open={showCostCenterDialog} onOpenChange={setShowCostCenterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCostCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={costCenterForm.name}
                onChange={(e) => setCostCenterForm({ ...costCenterForm, name: e.target.value })}
                placeholder="Nome do centro de custo"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={costCenterForm.description}
                onChange={(e) => setCostCenterForm({ ...costCenterForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={costCenterForm.is_active}
                onCheckedChange={(checked) => setCostCenterForm({ ...costCenterForm, is_active: checked })}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostCenterDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCostCenter}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPaymentMethod ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={paymentMethodForm.name}
                onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                placeholder="Ex: Pix, Boleto, Cartão..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={paymentMethodForm.is_active}
                onCheckedChange={(checked) => setPaymentMethodForm({ ...paymentMethodForm, is_active: checked })}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentMethodDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePaymentMethod}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
