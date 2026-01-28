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
import { Plus, Pencil, Trash2, Users, Layers } from "lucide-react";

interface Team {
  id: string;
  company_id: string;
  unit_id: string | null;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  salespeople_count?: number;
  sector_ids?: string[];
}

interface Sector {
  id: string;
  name: string;
  unit_id: string | null;
  is_active: boolean;
}

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface TeamsTabProps {
  companyId: string;
  isAdmin: boolean;
}

export function TeamsTab({ companyId, isAdmin }: TeamsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorTeams, setSectorTeams] = useState<SectorTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    sector_ids: [] as string[],
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

      // Fetch sector-team associations (sectors that contain teams)
      const { data: sectorTeamsData, error: sectorTeamsError } = await supabase
        .from("company_sector_teams")
        .select("sector_id, team_id");

      if (sectorTeamsError) throw sectorTeamsError;
      setSectorTeams(sectorTeamsData || []);

      const teamsWithCount = (teamsData || []).map((team) => ({
        ...team,
        salespeople_count: countMap[team.id] || 0,
        sector_ids: (sectorTeamsData || [])
          .filter(st => st.team_id === team.id)
          .map(st => st.sector_id),
      }));

      setTeams(teamsWithCount);

      // Fetch sectors
      const { data: sectorsData, error: sectorsError } = await supabase
        .from("company_sectors")
        .select("id, name, unit_id, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (sectorsError) throw sectorsError;
      setSectors(sectorsData || []);
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
    setFormData({ name: "", code: "", sector_ids: [] });
    setEditingTeam(null);
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      code: team.code || "",
      sector_ids: team.sector_ids || [],
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
      };

      let teamId: string;

      if (editingTeam) {
        const { error } = await supabase
          .from("company_teams")
          .update(payload)
          .eq("id", editingTeam.id);
        if (error) throw error;
        teamId = editingTeam.id;

        // Remove existing sector associations for this team
        await supabase
          .from("company_sector_teams")
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

      // Insert new sector associations
      if (formData.sector_ids.length > 0) {
        const sectorAssociations = formData.sector_ids.map(sectorId => ({
          sector_id: sectorId,
          team_id: teamId,
        }));
        
        const { error: assocError } = await supabase
          .from("company_sector_teams")
          .insert(sectorAssociations);
        
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

  const getSectorNames = (sectorIds: string[] | undefined) => {
    if (!sectorIds || sectorIds.length === 0) return "-";
    const names = sectorIds
      .map(id => sectors.find(s => s.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "-";
  };

  const toggleSectorSelection = (sectorId: string) => {
    setFormData(prev => {
      const isSelected = prev.sector_ids.includes(sectorId);
      return {
        ...prev,
        sector_ids: isSelected
          ? prev.sector_ids.filter(id => id !== sectorId)
          : [...prev.sector_ids, sectorId],
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
                <TableHead>Setores</TableHead>
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
                      {team.sector_ids && team.sector_ids.length > 0 ? (
                        team.sector_ids.map(sectorId => {
                          const sector = sectors.find(s => s.id === sectorId);
                          return sector ? (
                            <Badge key={sectorId} variant="outline" className="text-xs">
                              <Layers className="h-3 w-3 mr-1" />
                              {sector.name}
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

            {sectors.length > 0 && (
              <div className="space-y-2">
                <Label>Setores</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                  {sectors.map((sector) => (
                    <div key={sector.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sector-${sector.id}`}
                        checked={formData.sector_ids.includes(sector.id)}
                        onCheckedChange={() => toggleSectorSelection(sector.id)}
                      />
                      <label
                        htmlFor={`sector-${sector.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {sector.name}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione um ou mais setores para esta equipe
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
