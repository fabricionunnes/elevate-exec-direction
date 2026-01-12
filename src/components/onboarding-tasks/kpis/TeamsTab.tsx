import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

interface Team {
  id: string;
  company_id: string;
  unit_id: string | null;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  salespeople_count?: number;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface TeamsTabProps {
  companyId: string;
  isAdmin: boolean;
}

export function TeamsTab({ companyId, isAdmin }: TeamsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    unit_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teams with salespeople count
      const { data: teamsData, error: teamsError } = await supabase
        .from("company_teams")
        .select("*")
        .eq("company_id", companyId)
        .order("name");

      if (teamsError) throw teamsError;

      // Count salespeople per team
      const { data: salespeopleData } = await supabase
        .from("company_salespeople")
        .select("team_id")
        .eq("company_id", companyId)
        .not("team_id", "is", null);

      const countMap: Record<string, number> = {};
      salespeopleData?.forEach((sp) => {
        if (sp.team_id) {
          countMap[sp.team_id] = (countMap[sp.team_id] || 0) + 1;
        }
      });

      const teamsWithCount = (teamsData || []).map((team) => ({
        ...team,
        salespeople_count: countMap[team.id] || 0,
      }));

      setTeams(teamsWithCount);

      // Fetch units
      const { data: unitsData, error: unitsError } = await supabase
        .from("company_units")
        .select("id, name, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (unitsError) throw unitsError;
      setUnits(unitsData || []);
    } catch (error: any) {
      toast.error("Erro ao carregar equipes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const resetForm = () => {
    setFormData({ name: "", code: "", unit_id: "" });
    setEditingTeam(null);
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      code: team.code || "",
      unit_id: team.unit_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da equipe é obrigatório");
      return;
    }

    try {
      const payload = {
        company_id: companyId,
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        unit_id: formData.unit_id || null,
      };

      if (editingTeam) {
        const { error } = await supabase
          .from("company_teams")
          .update(payload)
          .eq("id", editingTeam.id);
        if (error) throw error;
        toast.success("Equipe atualizada com sucesso");
      } else {
        const { error } = await supabase.from("company_teams").insert(payload);
        if (error) throw error;
        toast.success("Equipe cadastrada com sucesso");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar equipe: " + error.message);
    }
  };

  const handleDelete = async (team: Team) => {
    if (team.salespeople_count && team.salespeople_count > 0) {
      toast.error(
        `Não é possível excluir. Existem ${team.salespeople_count} vendedor(es) vinculados a esta equipe.`
      );
      return;
    }

    if (!confirm(`Deseja realmente excluir a equipe "${team.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("company_teams")
        .delete()
        .eq("id", team.id);
      if (error) throw error;
      toast.success("Equipe excluída com sucesso");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir equipe: " + error.message);
    }
  };

  const handleToggleActive = async (team: Team) => {
    try {
      const { error } = await supabase
        .from("company_teams")
        .update({ is_active: !team.is_active })
        .eq("id", team.id);
      if (error) throw error;
      toast.success(
        team.is_active ? "Equipe desativada" : "Equipe ativada"
      );
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "-";
    const unit = units.find((u) => u.id === unitId);
    return unit?.name || "-";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-muted-foreground">Carregando equipes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Equipe
          </Button>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma equipe cadastrada</p>
          {isAdmin && (
            <p className="text-sm mt-1">
              Clique em "Nova Equipe" para começar
            </p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Vendedores</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.code || "-"}</TableCell>
                  <TableCell>{getUnitName(team.unit_id)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {team.salespeople_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {isAdmin ? (
                      <Switch
                        checked={team.is_active}
                        onCheckedChange={() => handleToggleActive(team)}
                      />
                    ) : (
                      <Badge
                        variant={team.is_active ? "default" : "secondary"}
                      >
                        {team.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(team)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(team)}
                          disabled={
                            team.salespeople_count !== undefined &&
                            team.salespeople_count > 0
                          }
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? "Editar Equipe" : "Nova Equipe"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Equipe *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Equipe Alfa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código (opcional)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="Ex: EQ-01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unidade (opcional)</Label>
              <Select
                value={formData.unit_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, unit_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vincular a equipe a uma unidade é opcional
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTeam ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
