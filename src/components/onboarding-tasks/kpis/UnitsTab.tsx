import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

interface Unit {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface UnitsTabProps {
  companyId: string;
  isAdmin: boolean;
}

export const UnitsTab = ({ companyId, isAdmin }: UnitsTabProps) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
  });

  useEffect(() => {
    fetchUnits();
  }, [companyId]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("company_units")
        .select("*")
        .eq("company_id", companyId)
        .order("name");

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast.error("Erro ao carregar unidades");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da unidade é obrigatório");
      return;
    }

    try {
      if (editingUnit) {
        const { error } = await supabase
          .from("company_units")
          .update({
            name: formData.name,
            code: formData.code || null,
          })
          .eq("id", editingUnit.id);

        if (error) throw error;
        toast.success("Unidade atualizada");
      } else {
        const { error } = await supabase.from("company_units").insert({
          company_id: companyId,
          name: formData.name,
          code: formData.code || null,
        });

        if (error) throw error;
        toast.success("Unidade cadastrada");
      }

      setShowDialog(false);
      resetForm();
      fetchUnits();
    } catch (error) {
      console.error("Error saving unit:", error);
      toast.error("Erro ao salvar unidade");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta unidade?")) return;

    try {
      const { error } = await supabase
        .from("company_units")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Unidade excluída");
      fetchUnits();
    } catch (error) {
      console.error("Error deleting unit:", error);
      toast.error("Erro ao excluir unidade");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("company_units")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "Unidade ativada" : "Unidade desativada");
      fetchUnits();
    } catch (error) {
      console.error("Error toggling unit:", error);
      toast.error("Erro ao atualizar unidade");
    }
  };

  const resetForm = () => {
    setEditingUnit(null);
    setFormData({
      name: "",
      code: "",
    });
  };

  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      code: unit.code || "",
    });
    setShowDialog(true);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Unidades / Filiais</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre as unidades ou filiais da empresa para segmentar os lançamentos de KPIs
          </p>
        </div>
        {isAdmin && (
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingUnit ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Filial Centro"
                  />
                </div>

                <div>
                  <Label>Código (opcional)</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: FIL001"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editingUnit ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {units.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma unidade cadastrada ainda.</p>
            <p className="text-sm">Cadastre unidades para segmentar os lançamentos por filial.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id} className={!unit.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>{unit.code || "-"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        checked={unit.is_active}
                        onCheckedChange={(v) => handleToggleActive(unit.id, v)}
                      />
                    ) : (
                      <Badge variant={unit.is_active ? "default" : "secondary"}>
                        {unit.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(unit.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
