import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Layers, Building2 } from "lucide-react";

interface Sector {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  unit_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface SectorsTabProps {
  companyId: string;
  isAdmin: boolean;
}

export const SectorsTab = ({ companyId, isAdmin }: SectorsTabProps) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    unit_id: "",
  });

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [sectorsRes, unitsRes] = await Promise.all([
        supabase
          .from("company_sectors")
          .select("*")
          .eq("company_id", companyId)
          .order("sort_order, name"),
        supabase
          .from("company_units")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (sectorsRes.error) throw sectorsRes.error;
      if (unitsRes.error) throw unitsRes.error;

      setSectors(sectorsRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (error) {
      console.error("Error fetching sectors:", error);
      toast.error("Erro ao carregar setores");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do setor é obrigatório");
      return;
    }

    try {
      if (editingSector) {
        const { error } = await supabase
          .from("company_sectors")
          .update({
            name: formData.name,
            code: formData.code || null,
            description: formData.description || null,
            unit_id: formData.unit_id || null,
          })
          .eq("id", editingSector.id);

        if (error) throw error;
        toast.success("Setor atualizado");
      } else {
        const maxOrder = Math.max(...sectors.map(s => s.sort_order), 0);
        const { error } = await supabase
          .from("company_sectors")
          .insert({
            company_id: companyId,
            name: formData.name,
            code: formData.code || null,
            description: formData.description || null,
            unit_id: formData.unit_id || null,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
        toast.success("Setor cadastrado");
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving sector:", error);
      toast.error("Erro ao salvar setor");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este setor? Isso pode afetar KPIs e lançamentos vinculados.")) return;

    try {
      const { error } = await supabase
        .from("company_sectors")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Setor excluído");
      fetchData();
    } catch (error) {
      console.error("Error deleting sector:", error);
      toast.error("Erro ao excluir setor");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("company_sectors")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "Setor ativado" : "Setor desativado");
      fetchData();
    } catch (error) {
      console.error("Error toggling sector:", error);
      toast.error("Erro ao atualizar setor");
    }
  };

  const resetForm = () => {
    setEditingSector(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      unit_id: "",
    });
  };

  const openEditDialog = (sector: Sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      code: sector.code || "",
      description: sector.description || "",
      unit_id: sector.unit_id || "",
    });
    setShowDialog(true);
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "-";
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.name : "-";
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Setores</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre setores para criar KPIs específicos (ex: Pré-Vendas, Vendas, Pós-Vendas)
          </p>
        </div>
        {isAdmin && (
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Setor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSector ? "Editar Setor" : "Novo Setor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Pré-Vendas, Vendas Externas"
                  />
                </div>

                {units.length > 0 && (
                  <div>
                    <Label>Unidade</Label>
                    <Select
                      value={formData.unit_id}
                      onValueChange={(v) => setFormData({ ...formData, unit_id: v === "all" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as unidades</SelectItem>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}


                <div>
                  <Label>Código (opcional)</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: PRE, VND, POS"
                  />
                </div>

                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do setor..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editingSector ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sectors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum setor cadastrado ainda.</p>
            <p className="text-sm">Crie setores para ter KPIs diferentes por área (ex: Pré-Vendas, Vendas).</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                {units.length > 0 && <TableHead>Unidade</TableHead>}
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectors.map((sector) => (
                <TableRow key={sector.id} className={!sector.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      {sector.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sector.code ? (
                      <Badge variant="outline">{sector.code}</Badge>
                    ) : "-"}
                  </TableCell>
                  {units.length > 0 && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{getUnitName(sector.unit_id)}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="max-w-[200px] truncate">
                    {sector.description || "-"}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        checked={sector.is_active}
                        onCheckedChange={(v) => handleToggleActive(sector.id, v)}
                      />
                    ) : (
                      <Badge variant={sector.is_active ? "default" : "secondary"}>
                        {sector.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(sector)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(sector.id)}>
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
