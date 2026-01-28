import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Pencil, Trash2, Layers, Building2, Users } from "lucide-react";

interface Sector {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  unit_id: string | null;
  team_id: string | null;
  is_active: boolean;
  sort_order: number;
  team_ids?: string[];
}

interface Team {
  id: string;
  name: string;
  unit_id: string | null;
  is_active: boolean;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface SectorsTabProps {
  companyId: string;
  isAdmin: boolean;
}

export const SectorsTab = ({ companyId, isAdmin }: SectorsTabProps) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sectorTeams, setSectorTeams] = useState<SectorTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    unit_id: "",
    team_ids: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [sectorsRes, unitsRes, teamsRes, sectorTeamsRes] = await Promise.all([
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
        supabase
          .from("company_teams")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_sector_teams")
          .select("sector_id, team_id"),
      ]);

      if (sectorsRes.error) throw sectorsRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (sectorTeamsRes.error) throw sectorTeamsRes.error;

      setSectorTeams(sectorTeamsRes.data || []);

      // Add team_ids to sectors
      const sectorsWithTeams = (sectorsRes.data || []).map(sector => ({
        ...sector,
        team_ids: (sectorTeamsRes.data || [])
          .filter(st => st.sector_id === sector.id)
          .map(st => st.team_id),
      }));

      setSectors(sectorsWithTeams);
      setUnits(unitsRes.data || []);
      setTeams(teamsRes.data || []);
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
      let sectorId: string;

      if (editingSector) {
        const { error } = await supabase
          .from("company_sectors")
          .update({
            name: formData.name,
            code: formData.code || null,
            description: formData.description || null,
            unit_id: formData.unit_id || null,
            team_id: formData.team_ids.length === 1 ? formData.team_ids[0] : null, // Legacy compatibility
          })
          .eq("id", editingSector.id);

        if (error) throw error;
        sectorId = editingSector.id;

        // Remove existing team associations
        await supabase
          .from("company_sector_teams")
          .delete()
          .eq("sector_id", sectorId);

        toast.success("Setor atualizado");
      } else {
        const maxOrder = Math.max(...sectors.map(s => s.sort_order), 0);
        const { data, error } = await supabase
          .from("company_sectors")
          .insert({
            company_id: companyId,
            name: formData.name,
            code: formData.code || null,
            description: formData.description || null,
            unit_id: formData.unit_id || null,
            team_id: formData.team_ids.length === 1 ? formData.team_ids[0] : null, // Legacy compatibility
            sort_order: maxOrder + 1,
          })
          .select("id")
          .single();

        if (error) throw error;
        sectorId = data.id;
        toast.success("Setor cadastrado");
      }

      // Insert new team associations
      if (formData.team_ids.length > 0) {
        const teamAssociations = formData.team_ids.map(teamId => ({
          sector_id: sectorId,
          team_id: teamId,
        }));
        
        const { error: assocError } = await supabase
          .from("company_sector_teams")
          .insert(teamAssociations);
        
        if (assocError) throw assocError;
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
      team_ids: [],
    });
  };

  const openEditDialog = (sector: Sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      code: sector.code || "",
      description: sector.description || "",
      unit_id: sector.unit_id || "",
      team_ids: sector.team_ids || [],
    });
    setShowDialog(true);
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "-";
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.name : "-";
  };

  const getTeamNames = (teamIds: string[] | undefined) => {
    if (!teamIds || teamIds.length === 0) return null;
    return teamIds
      .map(id => teams.find(t => t.id === id)?.name)
      .filter(Boolean);
  };

  const toggleTeamSelection = (teamId: string) => {
    setFormData(prev => {
      const isSelected = prev.team_ids.includes(teamId);
      return {
        ...prev,
        team_ids: isSelected
          ? prev.team_ids.filter(id => id !== teamId)
          : [...prev.team_ids, teamId],
      };
    });
  };

  // Filtrar equipes pela unidade selecionada (cascata)
  const filteredTeams = formData.unit_id
    ? teams.filter(t => !t.unit_id || t.unit_id === formData.unit_id)
    : teams;

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

                {filteredTeams.length > 0 && (
                  <div className="space-y-2">
                    <Label>Equipes</Label>
                    <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                      {filteredTeams.map((team) => (
                        <div key={team.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`team-${team.id}`}
                            checked={formData.team_ids.includes(team.id)}
                            onCheckedChange={() => toggleTeamSelection(team.id)}
                          />
                          <label
                            htmlFor={`team-${team.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {team.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecione uma ou mais equipes para este setor
                    </p>
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
                {teams.length > 0 && <TableHead>Equipes</TableHead>}
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
                  {teams.length > 0 && (
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {sector.team_ids && sector.team_ids.length > 0 ? (
                          sector.team_ids.map(teamId => {
                            const team = teams.find(t => t.id === teamId);
                            return team ? (
                              <Badge key={teamId} variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {team.name}
                              </Badge>
                            ) : null;
                          })
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
