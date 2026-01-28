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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, Link, Building2, UsersRound, Filter, X, Check } from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  is_active: boolean;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
  unit_ids?: string[];
}

interface Unit {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  unit_id: string | null;
  is_active: boolean;
}

interface Sector {
  id: string;
  name: string;
  unit_id: string | null;
  team_id: string | null;
  is_active: boolean;
}

interface SalespeopleTabProps {
  companyId: string;
  isAdmin: boolean;
}

export const SalespeopleTab = ({ companyId, isAdmin }: SalespeopleTabProps) => {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Salesperson | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    unit_ids: [] as string[],
    sector_id: "",
    team_id: "",
  });

  // Filter states
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterSector, setFilterSector] = useState("all");

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [salespeopleRes, unitsRes, teamsRes, sectorsRes, salespersonUnitsRes] = await Promise.all([
        supabase
          .from("company_salespeople")
          .select("*")
          .eq("company_id", companyId)
          .order("name"),
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
          .from("company_sectors")
          .select("id, name, unit_id, team_id, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_salesperson_units")
          .select("salesperson_id, unit_id"),
      ]);

      if (salespeopleRes.error) throw salespeopleRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (sectorsRes.error) throw sectorsRes.error;
      if (salespersonUnitsRes.error) throw salespersonUnitsRes.error;

      // Map unit_ids to each salesperson
      const salespersonUnitsMap = (salespersonUnitsRes.data || []).reduce((acc, su) => {
        if (!acc[su.salesperson_id]) acc[su.salesperson_id] = [];
        acc[su.salesperson_id].push(su.unit_id);
        return acc;
      }, {} as Record<string, string[]>);

      const salespeopleWithUnits = (salespeopleRes.data || []).map(sp => ({
        ...sp,
        unit_ids: salespersonUnitsMap[sp.id] || (sp.unit_id ? [sp.unit_id] : []),
      }));

      setSalespeople(salespeopleWithUnits);
      setUnits(unitsRes.data || []);
      setTeams(teamsRes.data || []);
      setSectors(sectorsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do vendedor é obrigatório");
      return;
    }

    // If there are multiple units, require at least one unit selection
    if (units.length > 1 && formData.unit_ids.length === 0) {
      toast.error("Selecione pelo menos uma unidade para o vendedor");
      return;
    }

    try {
      // Use first unit_id for legacy column, or auto-assign if only one unit
      const primaryUnitId = formData.unit_ids[0] || (units.length === 1 ? units[0].id : null);
      const teamId = formData.team_id || null;
      const sectorId = formData.sector_id || null;

      let salespersonId: string;

      if (editingPerson) {
        const { error } = await supabase
          .from("company_salespeople")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            unit_id: primaryUnitId,
            team_id: teamId,
            sector_id: sectorId,
          })
          .eq("id", editingPerson.id);

        if (error) throw error;
        salespersonId = editingPerson.id;

        // Update unit associations
        await supabase
          .from("company_salesperson_units")
          .delete()
          .eq("salesperson_id", salespersonId);

        toast.success("Vendedor atualizado");
      } else {
        const { data, error } = await supabase.from("company_salespeople").insert({
          company_id: companyId,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          unit_id: primaryUnitId,
          team_id: teamId,
          sector_id: sectorId,
        }).select("id").single();

        if (error) throw error;
        salespersonId = data.id;
        toast.success("Vendedor cadastrado");
      }

      // Insert unit associations
      const unitIdsToInsert = formData.unit_ids.length > 0 
        ? formData.unit_ids 
        : (units.length === 1 ? [units[0].id] : []);
      
      if (unitIdsToInsert.length > 0) {
        const associations = unitIdsToInsert.map(unitId => ({
          salesperson_id: salespersonId,
          unit_id: unitId,
        }));
        await supabase.from("company_salesperson_units").insert(associations);
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving salesperson:", error);
      toast.error("Erro ao salvar vendedor");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este vendedor?")) return;

    try {
      const { error } = await supabase
        .from("company_salespeople")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Vendedor excluído");
      fetchData();
    } catch (error) {
      console.error("Error deleting salesperson:", error);
      toast.error("Erro ao excluir vendedor");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("company_salespeople")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "Vendedor ativado" : "Vendedor desativado");
      fetchData();
    } catch (error) {
      console.error("Error toggling salesperson:", error);
      toast.error("Erro ao atualizar vendedor");
    }
  };

  const handleRegenerateCode = async (id: string) => {
    try {
      const newCode = Math.random().toString(36).substring(2, 10);
      const { error } = await supabase
        .from("company_salespeople")
        .update({ access_code: newCode })
        .eq("id", id);

      if (error) throw error;
      toast.success("Código de acesso regenerado");
      fetchData();
    } catch (error) {
      console.error("Error regenerating code:", error);
      toast.error("Erro ao regenerar código");
    }
  };

  const copyAccessLink = (person: Salesperson) => {
    const link = `${getPublicBaseUrl()}/#/kpi-entry/${companyId}?code=${person.access_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência");
  };

  const resetForm = () => {
    setEditingPerson(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      unit_ids: [],
      sector_id: "",
      team_id: "",
    });
  };

  const openEditDialog = (person: Salesperson) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      email: person.email || "",
      phone: person.phone || "",
      unit_ids: person.unit_ids || (person.unit_id ? [person.unit_id] : []),
      sector_id: person.sector_id || "",
      team_id: person.team_id || "",
    });
    setShowDialog(true);
  };

  const getSectorName = (sectorId: string | null) => {
    if (!sectorId) return "-";
    const sector = sectors.find((s) => s.id === sectorId);
    return sector ? sector.name : "-";
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "-";
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.name : "-";
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "-";
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : "-";
  };

  // Cascata: Filtrar setores pelas unidades selecionadas
  const formFilteredSectors = formData.unit_ids.length > 0
    ? sectors.filter((s) => !s.unit_id || formData.unit_ids.includes(s.unit_id))
    : sectors;

  // Cascata: Filtrar equipes pelo setor ou unidades selecionadas
  const formFilteredTeams = (() => {
    if (formData.sector_id) {
      const selectedSector = sectors.find(s => s.id === formData.sector_id);
      if (selectedSector?.team_id) {
        // Se o setor tem uma equipe específica, mostrar só ela
        return teams.filter(t => t.id === selectedSector.team_id);
      }
      // Se setor não tem equipe, filtrar por unidade do setor
      if (selectedSector?.unit_id) {
        return teams.filter(t => !t.unit_id || t.unit_id === selectedSector.unit_id);
      }
    }
    if (formData.unit_ids.length > 0) {
      return teams.filter((t) => !t.unit_id || formData.unit_ids.includes(t.unit_id));
    }
    return teams;
  })();

  const toggleUnitSelection = (unitId: string) => {
    setFormData(prev => {
      const newUnitIds = prev.unit_ids.includes(unitId)
        ? prev.unit_ids.filter(id => id !== unitId)
        : [...prev.unit_ids, unitId];
      return { ...prev, unit_ids: newUnitIds, sector_id: "", team_id: "" };
    });
  };

  // Filtered salespeople based on filter states
  const filteredSalespeople = salespeople.filter((sp) => {
    // Filter by unit - check if salesperson has any of the selected units
    if (filterUnit !== "all") {
      const hasUnit = sp.unit_ids?.includes(filterUnit) || sp.unit_id === filterUnit;
      if (!hasUnit) return false;
    }
    
    // Filter by sector - now using sector_id directly
    if (filterSector !== "all" && sp.sector_id !== filterSector) return false;
    
    // Filter by team
    if (filterTeam !== "all" && sp.team_id !== filterTeam) return false;
    
    return true;
  });

  const clearFilters = () => {
    setFilterUnit("all");
    setFilterTeam("all");
    setFilterSector("all");
  };

  const hasActiveFilters = filterUnit !== "all" || filterTeam !== "all" || filterSector !== "all";

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vendedores</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre os vendedores que farão lançamentos de vendas
          </p>
        </div>
        {isAdmin && (
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Vendedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPerson ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do vendedor"
                  />
                </div>

                {units.length > 1 && (
                  <div>
                    <Label>Unidades *</Label>
                    <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2 mt-1">
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
                    {formData.unit_ids.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.unit_ids.length} unidade(s) selecionada(s)
                      </p>
                    )}
                  </div>
                )}

                {formFilteredSectors.length > 0 && (
                  <div>
                    <Label>Setor (opcional)</Label>
                    <Select
                      value={formData.sector_id}
                      onValueChange={(v) => setFormData({ ...formData, sector_id: v === "none" ? "" : v, team_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {formFilteredSectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formFilteredTeams.length > 0 && (
                  <div>
                    <Label>Equipe (opcional)</Label>
                    <Select
                      value={formData.team_id}
                      onValueChange={(v) => setFormData({ ...formData, team_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {formFilteredTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>

                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editingPerson ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter Bar - Show when there's something to filter */}
      {(units.length > 1 || teams.length > 0 || sectors.length > 0) && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtros:</span>
            </div>

            {units.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Unidade:</Label>
                <Select value={filterUnit} onValueChange={(v) => { setFilterUnit(v); setFilterTeam("all"); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sectors.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Setor:</Label>
                <Select value={filterSector} onValueChange={setFilterSector}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sectors
                      .filter((s) => filterUnit === "all" || s.unit_id === filterUnit)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {teams.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Equipe:</Label>
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {teams
                      .filter((t) => filterUnit === "all" || t.unit_id === filterUnit)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </Card>
      )}

      {salespeople.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum vendedor cadastrado ainda.</p>
            <p className="text-sm">Cadastre vendedores para que possam lançar suas vendas.</p>
          </CardContent>
        </Card>
      ) : filteredSalespeople.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum vendedor encontrado com os filtros selecionados.</p>
            <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  {units.length > 0 && <TableHead>Unidades</TableHead>}
                  {sectors.length > 0 && <TableHead>Setor</TableHead>}
                  {teams.length > 0 && <TableHead>Equipe</TableHead>}
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Código de Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[150px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalespeople.map((person) => (
                  <TableRow key={person.id} className={!person.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    {units.length > 0 && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {(person.unit_ids && person.unit_ids.length > 0 ? person.unit_ids : (person.unit_id ? [person.unit_id] : [])).map((unitId, idx) => (
                            <Badge key={unitId} variant="secondary" className="text-xs">
                              {getUnitName(unitId)}
                            </Badge>
                          ))}
                          {(!person.unit_ids || person.unit_ids.length === 0) && !person.unit_id && (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {sectors.length > 0 && (
                      <TableCell>
                        <span className="text-sm">{getSectorName(person.sector_id)}</span>
                      </TableCell>
                    )}
                    {teams.length > 0 && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <UsersRound className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{getTeamName(person.team_id)}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{person.email || "-"}</TableCell>
                    <TableCell>{person.phone || "-"}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{person.access_code}</code>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Switch
                          checked={person.is_active}
                          onCheckedChange={(v) => handleToggleActive(person.id, v)}
                        />
                      ) : (
                        <Badge variant={person.is_active ? "default" : "secondary"}>
                          {person.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => copyAccessLink(person)} title="Copiar link de acesso">
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRegenerateCode(person.id)} title="Regenerar código">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(person)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(person.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};
