import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit2, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

interface GoalType {
  id: string;
  name: string;
  description: string | null;
  unit_type: string;
  category: string | null;
  has_super_meta: boolean;
  has_hiper_meta: boolean;
  is_active: boolean;
  sort_order: number;
}

const UNIT_TYPES = [
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda (R$)" },
  { value: "percentage", label: "Percentual (%)" },
];

const CATEGORIES = [
  { value: "", label: "Todos" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
  { value: "general", label: "Geral" },
];

export const CRMGoalTypesManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<GoalType | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<GoalType | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_type: "number",
    category: "",
    has_super_meta: true,
    has_hiper_meta: true,
  });

  useEffect(() => {
    loadGoalTypes();
  }, []);

  const loadGoalTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_goal_types")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      setGoalTypes(data || []);
    } catch (error) {
      console.error("Error loading goal types:", error);
      toast.error("Erro ao carregar tipos de meta");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData({
      name: "",
      description: "",
      unit_type: "number",
      category: "",
      has_super_meta: true,
      has_hiper_meta: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (goalType: GoalType) => {
    setEditingType(goalType);
    setFormData({
      name: goalType.name,
      description: goalType.description || "",
      unit_type: goalType.unit_type,
      category: goalType.category || "",
      has_super_meta: goalType.has_super_meta,
      has_hiper_meta: goalType.has_hiper_meta,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        unit_type: formData.unit_type,
        category: formData.category || null,
        has_super_meta: formData.has_super_meta,
        has_hiper_meta: formData.has_hiper_meta,
      };

      if (editingType) {
        const { error } = await supabase
          .from("crm_goal_types")
          .update(payload)
          .eq("id", editingType.id);
        if (error) throw error;
        toast.success("Tipo de meta atualizado");
      } else {
        const maxOrder = Math.max(0, ...goalTypes.map(g => g.sort_order));
        const { error } = await supabase
          .from("crm_goal_types")
          .insert({ ...payload, sort_order: maxOrder + 1 });
        if (error) throw error;
        toast.success("Tipo de meta criado");
      }

      setDialogOpen(false);
      loadGoalTypes();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (goalType: GoalType) => {
    try {
      const { error } = await supabase
        .from("crm_goal_types")
        .update({ is_active: !goalType.is_active })
        .eq("id", goalType.id);

      if (error) throw error;
      toast.success(goalType.is_active ? "Tipo desativado" : "Tipo ativado");
      loadGoalTypes();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;

    try {
      const { error } = await supabase
        .from("crm_goal_types")
        .delete()
        .eq("id", deleteDialog.id);

      if (error) throw error;
      toast.success("Tipo de meta excluído");
      setDeleteDialog(null);
      loadGoalTypes();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const getUnitLabel = (unit: string) => {
    return UNIT_TYPES.find(u => u.value === unit)?.label || unit;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "Todos";
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Tipos de Meta
            </CardTitle>
            <CardDescription>
              Crie e gerencie os tipos de meta disponíveis para o time comercial
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingType ? "Editar Tipo de Meta" : "Novo Tipo de Meta"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Vendas, Agendamentos, No Show..."
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Unidade</Label>
                    <Select
                      value={formData.unit_type}
                      onValueChange={(v) => setFormData(p => ({ ...p, unit_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPES.map(u => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.has_super_meta}
                      onCheckedChange={(v) => setFormData(p => ({ ...p, has_super_meta: v }))}
                    />
                    <Label>Super Meta</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.has_hiper_meta}
                      onCheckedChange={(v) => setFormData(p => ({ ...p, has_hiper_meta: v }))}
                    />
                    <Label>Hiper Meta</Label>
                  </div>
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingType ? "Salvar Alterações" : "Criar Tipo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {goalTypes.map(goalType => (
            <div
              key={goalType.id}
              className={`p-3 rounded-lg border border-border flex items-center justify-between ${!goalType.is_active ? 'opacity-50 bg-muted/50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={!goalType.is_active ? 'line-through' : ''}>
                      {goalType.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getUnitLabel(goalType.unit_type)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryLabel(goalType.category)}
                    </Badge>
                    {!goalType.is_active && (
                      <Badge variant="destructive" className="text-xs">Inativo</Badge>
                    )}
                  </div>
                  {goalType.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {goalType.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={goalType.is_active}
                  onCheckedChange={() => handleToggleActive(goalType)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditDialog(goalType)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setDeleteDialog(goalType)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {goalTypes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum tipo de meta cadastrado
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tipo de Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o tipo "{deleteDialog?.name}"?
              Isso também removerá todas as metas associadas.
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
    </Card>
  );
};
