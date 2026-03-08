import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Copy, ExternalLink, Link2, ArrowLeft, Filter } from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";

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
}

interface OrgEntity {
  id: string;
  name: string;
}

interface ClientSalesLinksPanelProps {
  companyId: string;
  onBack?: () => void;
  canAddSalespeople?: boolean;
}

export const ClientSalesLinksPanel = ({
  companyId,
  onBack,
  canAddSalespeople = true,
}: ClientSalesLinksPanelProps) => {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });

  // Filters
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterSector, setFilterSector] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");

  // Org data
  const [units, setUnits] = useState<OrgEntity[]>([]);
  const [sectors, setSectors] = useState<OrgEntity[]>([]);
  const [teams, setTeams] = useState<OrgEntity[]>([]);
  const [sectorTeams, setSectorTeams] = useState<{ sector_id: string; team_id: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [spRes, unitsRes, sectorsRes, teamsRes, stRes] = await Promise.all([
        supabase
          .from("company_salespeople")
          .select("id, name, email, phone, access_code, is_active, unit_id, team_id, sector_id")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("company_units")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_sectors")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_teams")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_sector_teams")
          .select("sector_id, team_id"),
      ]);

      if (spRes.error) throw spRes.error;
      setSalespeople(spRes.data || []);
      setUnits(unitsRes.data || []);
      setSectors(sectorsRes.data || []);
      setTeams(teamsRes.data || []);
      setSectorTeams(stRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Build sector→teams map for cascading filter
  const teamIdsBySectorId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach(({ sector_id, team_id }) => {
      if (!map[sector_id]) map[sector_id] = new Set();
      map[sector_id].add(team_id);
    });
    return map;
  }, [sectorTeams]);

  // Available sectors filtered by unit (sectors that have salespeople in the selected unit)
  const filteredSectors = useMemo(() => {
    if (filterUnit === "all") return sectors;
    // Show sectors whose salespeople belong to the selected unit
    const sectorIds = new Set(
      salespeople
        .filter((sp) => sp.is_active && sp.unit_id === filterUnit && sp.sector_id)
        .map((sp) => sp.sector_id!)
    );
    return sectors.filter((s) => sectorIds.has(s.id));
  }, [sectors, filterUnit, salespeople]);

  // Available teams filtered by sector
  const filteredTeams = useMemo(() => {
    if (filterSector === "all") return teams;
    const teamIds = teamIdsBySectorId[filterSector] || new Set();
    return teams.filter((t) => teamIds.has(t.id));
  }, [teams, filterSector, teamIdsBySectorId]);

  // Reset cascading filters
  useEffect(() => {
    setFilterSector("all");
    setFilterTeam("all");
  }, [filterUnit]);

  useEffect(() => {
    setFilterTeam("all");
  }, [filterSector]);

  const filteredSalespeople = useMemo(() => {
    return salespeople.filter((sp) => {
      if (!sp.is_active) return false;
      if (filterUnit !== "all" && sp.unit_id !== filterUnit) return false;
      if (filterSector !== "all") {
        // Direct match or via team
        const sectorTeamIds = teamIdsBySectorId[filterSector] || new Set();
        const matchesDirect = sp.sector_id === filterSector;
        const matchesViaTeam = sp.team_id ? sectorTeamIds.has(sp.team_id) : false;
        if (!matchesDirect && !matchesViaTeam) return false;
      }
      if (filterTeam !== "all" && sp.team_id !== filterTeam) return false;
      return true;
    });
  }, [salespeople, filterUnit, filterSector, filterTeam, teamIdsBySectorId]);

  const getEntryLink = (accessCode: string) => {
    return `${getPublicBaseUrl()}/#/kpi-entry/${companyId}?code=${accessCode}`;
  };

  const copyLink = (person: Salesperson) => {
    navigator.clipboard.writeText(getEntryLink(person.access_code));
    toast.success(`Link do ${person.name} copiado!`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const openLink = (person: Salesperson) => {
    window.open(getEntryLink(person.access_code), "_blank");
  };

  const handleAddSalesperson = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("company_salespeople").insert({
        company_id: companyId,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
      });

      if (error) throw error;
      toast.success("Vendedor cadastrado!");
      setShowAddDialog(false);
      setFormData({ name: "", email: "", phone: "" });
      fetchData();
    } catch (error: any) {
      console.error("Error adding salesperson:", error);
      toast.error(error.message || "Erro ao cadastrar vendedor");
    } finally {
      setSaving(false);
    }
  };

  const hasFilters = units.length > 0 || sectors.length > 0 || teams.length > 0;

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Links de Lançamento
            </h3>
            <p className="text-sm text-muted-foreground">
              Links individuais para cada vendedor lançar vendas
            </p>
          </div>
        </div>
        {canAddSalespeople && (
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        )}
      </div>

      {/* Filters */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {units.length > 0 && (
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Unidades</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sectors.length > 0 && (
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Setores</SelectItem>
                {filteredSectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {teams.length > 0 && (
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Equipes</SelectItem>
                {filteredTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Salespeople list */}
      {filteredSalespeople.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum vendedor ativo encontrado.</p>
            {canAddSalespeople && filterUnit === "all" && filterSector === "all" && filterTeam === "all" && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Vendedor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSalespeople.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {person.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="font-mono cursor-pointer hover:bg-secondary/80"
                      onClick={() => copyCode(person.access_code)}
                    >
                      {person.access_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyLink(person)}
                        title="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openLink(person)}
                        title="Abrir link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Salesperson Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Vendedor</DialogTitle>
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
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSalesperson} disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
