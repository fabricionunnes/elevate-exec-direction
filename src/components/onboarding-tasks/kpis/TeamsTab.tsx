import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Building2 } from "lucide-react";

interface Team {
  id: string;
  company_id: string;
  unit_id: string | null;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  salespeople_count?: number;
  unit_ids?: string[];
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface TeamUnit {
  team_id: string;
  unit_id: string;
}

interface TeamsTabProps {
  companyId: string;
  isAdmin: boolean;
}

export function TeamsTab({ companyId, isAdmin }: TeamsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teamUnits, setTeamUnits] = useState<TeamUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    unit_ids: [] as string[],
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

      // Fetch team-unit associations
      const { data: teamUnitsData, error: teamUnitsError } = await supabase
        .from("company_team_units")
        .select("team_id, unit_id");

      if (teamUnitsError) throw teamUnitsError;
      setTeamUnits(teamUnitsData || []);

      const teamsWithCount = (teamsData || []).map((team) => ({
        ...team,
        salespeople_count: countMap[team.id] || 0,
        unit_ids: (teamUnitsData || [])
          .filter(tu => tu.team_id === team.id)
          .map(tu => tu.unit_id),
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
    setFormData({ name: "", code: "", unit_ids: [] });
    setEditingTeam(null);
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      code: team.code || "",
      unit_ids: team.unit_ids || [],
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
        unit_id: formData.unit_ids.length === 1 ? formData.unit_ids[0] : null, // Legacy compatibility
      };

      let teamId: string;

      if (editingTeam) {
        const { error } = await supabase
          .from("company_teams")
          .update(payload)
          .eq("id", editingTeam.id);
        if (error) throw error;
        teamId = editingTeam.id;

        // Remove existing unit associations
        await supabase
          .from("company_team_units")
          .delete()
          .eq("team_id", teamId);

        toast.success("Equipe atualizada com sucesso");
      } else {
        const { data, error } = await supabase
          .from("company_teams")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        teamId = data.id;
        toast.success("Equipe cadastrada com sucesso");
      }

      // Insert new unit associations
      if (formData.unit_ids.length > 0) {
        const unitAssociations = formData.unit_ids.map(unitId => ({
          team_id: teamId,
          unit_id: unitId,
        }));
        
        const { error: assocError } = await supabase
          .from("company_team_units")
          .insert(unitAssociations);
        
        if (assocError) throw assocError;
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

  const getUnitNames = (unitIds: string[] | undefined) => {
    if (!unitIds || unitIds.length === 0) return "-";
    const names = unitIds
      .map(id => units.find(u => u.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "-";
  };

  const toggleUnitSelection = (unitId: string) => {
    setFormData(prev => {
      const isSelected = prev.unit_ids.includes(unitId);
      return {
        ...prev,
        unit_ids: isSelected
          ? prev.unit_ids.filter(id => id !== unitId)
          : [...prev.unit_ids, unitId],
      };
    });
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
                <TableHead>Unidades</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {team.unit_ids && team.unit_ids.length > 0 ? (
                        team.unit_ids.map(unitId => {
                          const unit = units.find(u => u.id === unitId);
                          return unit ? (
                            <Badge key={unitId} variant="outline" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {unit.name}
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
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

            {units.length > 0 && (
              <div className="space-y-2">
                <Label>Unidades</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                  {units.map((unit) => (
                    <div key={unit.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`unit-${unit.id}`}
                        checked={formData.unit_ids.includes(unit.id)}
                        onCheckedChange={() => toggleUnitSelection(unit.id)}
                      />
                      <label
                        htmlFor={`unit-${unit.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {unit.name}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais unidades para esta equipe
                </p>
              </div>
            )}
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
