import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Calendar, Building2, Users, Layers, User, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { KPIMonthlyTargetsDialog } from "./KPIMonthlyTargetsDialog";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: "daily" | "weekly" | "monthly";
  target_value: number;
  is_individual: boolean;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  scope: "company" | "sector" | "team" | "salesperson" | "unit";
  sector_id: string | null;
  team_id: string | null;
  salesperson_id: string | null;
  unit_id: string | null;
  is_main_goal: boolean;
  // Multi-select arrays (loaded from junction tables)
  unit_ids?: string[];
  sector_ids?: string[];
  team_ids?: string[];
  salesperson_ids?: string[];
}

interface Sector {
  id: string;
  name: string;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  unit_id: string | null;
  is_active: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  unit_id: string | null;
  team_id: string | null;
  is_active: boolean;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface KPIConfigurationTabProps {
  companyId: string;
  isAdmin: boolean;
  isClient?: boolean;
}

export const KPIConfigurationTab = ({ companyId, isAdmin, isClient = false }: KPIConfigurationTabProps) => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showMonthlyTargets, setShowMonthlyTargets] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    kpi_type: "numeric" as "numeric" | "monetary" | "percentage",
    periodicity: "daily" as "daily" | "weekly" | "monthly",
    target_value: 0,
    is_individual: true,
    is_required: true,
    scope: "company" as "company" | "sector" | "team" | "salesperson" | "unit",
    // Multi-select arrays
    unit_ids: [] as string[],
    sector_ids: [] as string[],
    team_ids: [] as string[],
    salesperson_ids: [] as string[],
    is_main_goal: false,
  });

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [kpisRes, sectorsRes, teamsRes, salespeopleRes, unitsRes] = await Promise.all([
        supabase
          .from("company_kpis")
          .select("*")
          .eq("company_id", companyId)
          .order("sort_order"),
        supabase
          .from("company_sectors")
          .select("id, name, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_teams")
          .select("id, name, unit_id, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_salespeople")
          .select("id, name, unit_id, team_id, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_units")
          .select("id, name, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (kpisRes.error) throw kpisRes.error;

      const kpisData = (kpisRes.data || []) as KPI[];
      
      // Load multi-select relationships for each KPI
      if (kpisData.length > 0) {
        const kpiIds = kpisData.map(k => k.id);
        
        const [kpiUnitsRes, kpiSectorsRes, kpiTeamsRes, kpiSalespeopleRes] = await Promise.all([
          supabase.from("kpi_units").select("kpi_id, unit_id").in("kpi_id", kpiIds),
          supabase.from("kpi_sectors").select("kpi_id, sector_id").in("kpi_id", kpiIds),
          supabase.from("kpi_teams").select("kpi_id, team_id").in("kpi_id", kpiIds),
          supabase.from("kpi_salespeople").select("kpi_id, salesperson_id").in("kpi_id", kpiIds),
        ]);

        // Map relationships to KPIs
        kpisData.forEach(kpi => {
          kpi.unit_ids = (kpiUnitsRes.data || [])
            .filter((r: any) => r.kpi_id === kpi.id)
            .map((r: any) => r.unit_id);
          kpi.sector_ids = (kpiSectorsRes.data || [])
            .filter((r: any) => r.kpi_id === kpi.id)
            .map((r: any) => r.sector_id);
          kpi.team_ids = (kpiTeamsRes.data || [])
            .filter((r: any) => r.kpi_id === kpi.id)
            .map((r: any) => r.team_id);
          kpi.salesperson_ids = (kpiSalespeopleRes.data || [])
            .filter((r: any) => r.kpi_id === kpi.id)
            .map((r: any) => r.salesperson_id);
          
          // Migrate legacy single-select to multi-select arrays
          if (kpi.unit_id && !kpi.unit_ids?.includes(kpi.unit_id)) {
            kpi.unit_ids = [kpi.unit_id, ...(kpi.unit_ids || [])];
          }
          if (kpi.sector_id && !kpi.sector_ids?.includes(kpi.sector_id)) {
            kpi.sector_ids = [kpi.sector_id, ...(kpi.sector_ids || [])];
          }
          if (kpi.team_id && !kpi.team_ids?.includes(kpi.team_id)) {
            kpi.team_ids = [kpi.team_id, ...(kpi.team_ids || [])];
          }
          if (kpi.salesperson_id && !kpi.salesperson_ids?.includes(kpi.salesperson_id)) {
            kpi.salesperson_ids = [kpi.salesperson_id, ...(kpi.salesperson_ids || [])];
          }
        });
      }

      setKpis(kpisData);
      setSectors(sectorsRes.data || []);
      setTeams(teamsRes.data || []);
      setSalespeople(salespeopleRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchKpis = async () => {
    try {
      const { data, error } = await supabase
        .from("company_kpis")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order");

      if (error) throw error;
      setKpis((data || []) as KPI[]);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      toast.error("Erro ao carregar KPIs");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do KPI é obrigatório");
      return;
    }

    // Validate scope-specific fields
    if (formData.scope === "unit" && formData.unit_ids.length === 0) {
      toast.error("Selecione ao menos uma unidade para KPIs de escopo Unidade");
      return;
    }
    if (formData.scope === "sector" && formData.sector_ids.length === 0) {
      toast.error("Selecione ao menos um setor para KPIs de escopo Setor");
      return;
    }
    if (formData.scope === "team" && formData.team_ids.length === 0) {
      toast.error("Selecione ao menos uma equipe para KPIs de escopo Equipe");
      return;
    }
    if (formData.scope === "salesperson" && formData.salesperson_ids.length === 0) {
      toast.error("Selecione ao menos um vendedor para KPIs de escopo Vendedor");
      return;
    }

    try {
      // Keep the first selected item in legacy fields for backward compatibility
      const kpiData = {
        name: formData.name,
        kpi_type: formData.kpi_type,
        periodicity: formData.periodicity,
        target_value: formData.target_value,
        is_individual: formData.is_individual,
        is_required: formData.is_required,
        scope: formData.scope,
        sector_id: formData.scope === "sector" && formData.sector_ids.length > 0 ? formData.sector_ids[0] : null,
        team_id: formData.scope === "team" && formData.team_ids.length > 0 ? formData.team_ids[0] : null,
        salesperson_id: formData.scope === "salesperson" && formData.salesperson_ids.length > 0 ? formData.salesperson_ids[0] : null,
        unit_id: formData.scope === "unit" && formData.unit_ids.length > 0 ? formData.unit_ids[0] : null,
        is_main_goal: formData.is_main_goal,
      };

      let kpiId: string;

      if (editingKpi) {
        const { error } = await supabase
          .from("company_kpis")
          .update(kpiData)
          .eq("id", editingKpi.id);

        if (error) throw error;
        kpiId = editingKpi.id;
      } else {
        const maxOrder = Math.max(...kpis.map(k => k.sort_order), 0);
        const { data, error } = await supabase.from("company_kpis").insert({
          company_id: companyId,
          ...kpiData,
          sort_order: maxOrder + 1,
        }).select("id").single();

        if (error) throw error;
        kpiId = data.id;
      }

      // Update multi-select junction tables
      await Promise.all([
        // Units
        supabase.from("kpi_units").delete().eq("kpi_id", kpiId),
        supabase.from("kpi_sectors").delete().eq("kpi_id", kpiId),
        supabase.from("kpi_teams").delete().eq("kpi_id", kpiId),
        supabase.from("kpi_salespeople").delete().eq("kpi_id", kpiId),
      ]);

      // Insert new relationships based on scope
      const insertPromises = [];
      
      if (formData.scope === "unit" && formData.unit_ids.length > 0) {
        insertPromises.push(
          supabase.from("kpi_units").insert(
            formData.unit_ids.map(uid => ({ kpi_id: kpiId, unit_id: uid }))
          )
        );
      }
      
      if (formData.scope === "sector" && formData.sector_ids.length > 0) {
        insertPromises.push(
          supabase.from("kpi_sectors").insert(
            formData.sector_ids.map(sid => ({ kpi_id: kpiId, sector_id: sid }))
          )
        );
      }
      
      if (formData.scope === "team" && formData.team_ids.length > 0) {
        insertPromises.push(
          supabase.from("kpi_teams").insert(
            formData.team_ids.map(tid => ({ kpi_id: kpiId, team_id: tid }))
          )
        );
      }
      
      if (formData.scope === "salesperson" && formData.salesperson_ids.length > 0) {
        insertPromises.push(
          supabase.from("kpi_salespeople").insert(
            formData.salesperson_ids.map(spid => ({ kpi_id: kpiId, salesperson_id: spid }))
          )
        );
      }

      await Promise.all(insertPromises);

      toast.success(editingKpi ? "KPI atualizado" : "KPI criado");
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast.error("Erro ao salvar KPI");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este KPI?")) return;

    try {
      const { error } = await supabase
        .from("company_kpis")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("KPI excluído");
      fetchKpis();
    } catch (error) {
      console.error("Error deleting KPI:", error);
      toast.error("Erro ao excluir KPI");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("company_kpis")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "KPI ativado" : "KPI desativado");
      fetchData();
    } catch (error) {
      console.error("Error toggling KPI:", error);
      toast.error("Erro ao atualizar KPI");
    }
  };

  const handleMoveUp = async (kpi: KPI) => {
    const currentIndex = kpis.findIndex(k => k.id === kpi.id);
    if (currentIndex <= 0) return;
    
    const prevKpi = kpis[currentIndex - 1];
    
    try {
      await Promise.all([
        supabase
          .from("company_kpis")
          .update({ sort_order: prevKpi.sort_order })
          .eq("id", kpi.id),
        supabase
          .from("company_kpis")
          .update({ sort_order: kpi.sort_order })
          .eq("id", prevKpi.id),
      ]);
      
      fetchData();
    } catch (error) {
      console.error("Error moving KPI:", error);
      toast.error("Erro ao reordenar KPI");
    }
  };

  const handleMoveDown = async (kpi: KPI) => {
    const currentIndex = kpis.findIndex(k => k.id === kpi.id);
    if (currentIndex >= kpis.length - 1) return;
    
    const nextKpi = kpis[currentIndex + 1];
    
    try {
      await Promise.all([
        supabase
          .from("company_kpis")
          .update({ sort_order: nextKpi.sort_order })
          .eq("id", kpi.id),
        supabase
          .from("company_kpis")
          .update({ sort_order: kpi.sort_order })
          .eq("id", nextKpi.id),
      ]);
      
      fetchData();
    } catch (error) {
      console.error("Error moving KPI:", error);
      toast.error("Erro ao reordenar KPI");
    }
  };

  // Drag and drop state
  const [draggedKpiId, setDraggedKpiId] = useState<string | null>(null);
  const [dragOverKpiId, setDragOverKpiId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, kpiId: string) => {
    setDraggedKpiId(kpiId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", kpiId);
  };

  const handleDragOver = (e: React.DragEvent, kpiId: string) => {
    e.preventDefault();
    if (draggedKpiId !== kpiId) {
      setDragOverKpiId(kpiId);
    }
  };

  const handleDragLeave = () => {
    setDragOverKpiId(null);
  };

  const handleDragEnd = () => {
    setDraggedKpiId(null);
    setDragOverKpiId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetKpiId: string) => {
    e.preventDefault();
    setDragOverKpiId(null);
    
    if (!draggedKpiId || draggedKpiId === targetKpiId) {
      setDraggedKpiId(null);
      return;
    }

    const draggedIndex = kpis.findIndex(k => k.id === draggedKpiId);
    const targetIndex = kpis.findIndex(k => k.id === targetKpiId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedKpi = kpis[draggedIndex];
    const targetKpi = kpis[targetIndex];

    try {
      await Promise.all([
        supabase
          .from("company_kpis")
          .update({ sort_order: targetKpi.sort_order })
          .eq("id", draggedKpi.id),
        supabase
          .from("company_kpis")
          .update({ sort_order: draggedKpi.sort_order })
          .eq("id", targetKpi.id),
      ]);
      
      fetchData();
    } catch (error) {
      console.error("Error reordering KPIs:", error);
      toast.error("Erro ao reordenar KPIs");
    }
    
    setDraggedKpiId(null);
  };

  const resetForm = () => {
    setEditingKpi(null);
    setFormData({
      name: "",
      kpi_type: "numeric",
      periodicity: "daily",
      target_value: 0,
      is_individual: true,
      is_required: true,
      scope: "company",
      unit_ids: [],
      sector_ids: [],
      team_ids: [],
      salesperson_ids: [],
      is_main_goal: false,
    });
  };

  const openEditDialog = (kpi: KPI) => {
    setEditingKpi(kpi);
    setFormData({
      name: kpi.name,
      kpi_type: kpi.kpi_type,
      periodicity: kpi.periodicity,
      target_value: kpi.target_value,
      is_individual: kpi.is_individual,
      is_required: kpi.is_required,
      scope: kpi.scope || "company",
      unit_ids: kpi.unit_ids || (kpi.unit_id ? [kpi.unit_id] : []),
      sector_ids: kpi.sector_ids || (kpi.sector_id ? [kpi.sector_id] : []),
      team_ids: kpi.team_ids || (kpi.team_id ? [kpi.team_id] : []),
      salesperson_ids: kpi.salesperson_ids || (kpi.salesperson_id ? [kpi.salesperson_id] : []),
      is_main_goal: kpi.is_main_goal || false,
    });
    setShowDialog(true);
  };

  const toggleArrayItem = (array: string[], item: string): string[] => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };

  const getSectorName = (sectorId: string | null) => {
    if (!sectorId) return null;
    const sector = sectors.find(s => s.id === sectorId);
    return sector ? sector.name : null;
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return null;
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.name : null;
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return null;
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : null;
  };

  const getSalespersonName = (salespersonId: string | null) => {
    if (!salespersonId) return null;
    const sp = salespeople.find(s => s.id === salespersonId);
    return sp ? sp.name : null;
  };

  const getMultipleNames = (ids: string[] | undefined, type: "unit" | "sector" | "team" | "salesperson") => {
    if (!ids || ids.length === 0) return null;
    
    const getName = (id: string) => {
      switch (type) {
        case "unit": return getUnitName(id);
        case "sector": return getSectorName(id);
        case "team": return getTeamName(id);
        case "salesperson": return getSalespersonName(id);
        default: return null;
      }
    };
    
    const names = ids.map(getName).filter(Boolean);
    if (names.length === 0) return null;
    if (names.length <= 2) return names.join(", ");
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "numeric": return "Numérico";
      case "monetary": return "Monetário (R$)";
      case "percentage": return "Percentual (%)";
      default: return type;
    }
  };

  const getPeriodicityLabel = (periodicity: string) => {
    switch (periodicity) {
      case "daily": return "Diária";
      case "weekly": return "Semanal";
      case "monthly": return "Mensal";
      default: return periodicity;
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (type === "percentage") {
      return `${value}%`;
    }
    return value.toLocaleString("pt-BR");
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configuração de KPIs</h3>
          <p className="text-sm text-muted-foreground">
            Configure os indicadores que serão acompanhados para esta empresa
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowMonthlyTargets(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Metas Mensais
            </Button>
          )}
          {isAdmin && (
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo KPI
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingKpi ? "Editar KPI" : "Novo KPI"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do KPI</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Faturamento Diário"
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.kpi_type}
                    onValueChange={(v) => setFormData({ ...formData, kpi_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numérico</SelectItem>
                      <SelectItem value="monetary">Monetário (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Periodicidade da Meta</Label>
                  <Select
                    value={formData.periodicity}
                    onValueChange={(v) => setFormData({ ...formData, periodicity: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diária</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Meta Alvo</Label>
                  {formData.kpi_type === "monetary" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">R$</span>
                      <CurrencyInput
                        value={formData.target_value}
                        onChange={(value) => setFormData({ ...formData, target_value: value })}
                        placeholder="0,00"
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={formData.target_value}
                      onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Label>KPI Individual (por vendedor)</Label>
                  <Switch
                    checked={formData.is_individual}
                    onCheckedChange={(v) => setFormData({ ...formData, is_individual: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Obrigatório no lançamento</Label>
                  <Switch
                    checked={formData.is_required}
                    onCheckedChange={(v) => setFormData({ ...formData, is_required: v })}
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label className="text-primary font-semibold">Meta Principal</Label>
                    <p className="text-xs text-muted-foreground">
                      Usar este KPI como referência para projeções do dashboard
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_main_goal}
                    onCheckedChange={(v) => setFormData({ ...formData, is_main_goal: v })}
                  />
                </div>

                {/* Scope Selection */}
                <div>
                  <Label>Escopo do Lançamento</Label>
                  <Select
                    value={formData.scope}
                    onValueChange={(v) => setFormData({ 
                      ...formData, 
                      scope: v as any,
                      // Reset scope-specific fields when changing scope
                      sector_ids: v === "sector" ? formData.sector_ids : [],
                      team_ids: v === "team" ? formData.team_ids : [],
                      salesperson_ids: v === "salesperson" ? formData.salesperson_ids : [],
                      unit_ids: v === "unit" ? formData.unit_ids : [],
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Empresa (todos lançam)
                        </div>
                      </SelectItem>
                      {units.length > 0 && (
                        <SelectItem value="unit">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Unidades específicas
                          </div>
                        </SelectItem>
                      )}
                      {sectors.length > 0 && (
                        <SelectItem value="sector">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Setores específicos
                          </div>
                        </SelectItem>
                      )}
                      {teams.length > 0 && (
                        <SelectItem value="team">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Equipes específicas
                          </div>
                        </SelectItem>
                      )}
                      {salespeople.length > 0 && (
                        <SelectItem value="salesperson">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Vendedores específicos
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define quem pode/deve lançar este KPI
                  </p>
                </div>

                {/* Unit Multi-Selection */}
                {formData.scope === "unit" && units.length > 0 && (
                  <div>
                    <Label>Unidades * (selecione uma ou mais)</Label>
                    <ScrollArea className="h-[150px] border rounded-md p-2 mt-1">
                      <div className="space-y-2">
                        {units.map((unit) => (
                          <div key={unit.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`unit-${unit.id}`}
                              checked={formData.unit_ids.includes(unit.id)}
                              onCheckedChange={() => 
                                setFormData({ 
                                  ...formData, 
                                  unit_ids: toggleArrayItem(formData.unit_ids, unit.id) 
                                })
                              }
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
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.unit_ids.length} unidade(s) selecionada(s)
                    </p>
                  </div>
                )}

                {/* Sector Multi-Selection */}
                {formData.scope === "sector" && sectors.length > 0 && (
                  <div>
                    <Label>Setores * (selecione um ou mais)</Label>
                    <ScrollArea className="h-[150px] border rounded-md p-2 mt-1">
                      <div className="space-y-2">
                        {sectors.map((sector) => (
                          <div key={sector.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`sector-${sector.id}`}
                              checked={formData.sector_ids.includes(sector.id)}
                              onCheckedChange={() => 
                                setFormData({ 
                                  ...formData, 
                                  sector_ids: toggleArrayItem(formData.sector_ids, sector.id) 
                                })
                              }
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
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.sector_ids.length} setor(es) selecionado(s)
                    </p>
                  </div>
                )}

                {/* Team Multi-Selection */}
                {formData.scope === "team" && teams.length > 0 && (
                  <div>
                    <Label>Equipes * (selecione uma ou mais)</Label>
                    <ScrollArea className="h-[150px] border rounded-md p-2 mt-1">
                      <div className="space-y-2">
                        {teams.map((team) => (
                          <div key={team.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`team-${team.id}`}
                              checked={formData.team_ids.includes(team.id)}
                              onCheckedChange={() => 
                                setFormData({ 
                                  ...formData, 
                                  team_ids: toggleArrayItem(formData.team_ids, team.id) 
                                })
                              }
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
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.team_ids.length} equipe(s) selecionada(s)
                    </p>
                  </div>
                )}

                {/* Salesperson Multi-Selection */}
                {formData.scope === "salesperson" && salespeople.length > 0 && (
                  <div>
                    <Label>Vendedores * (selecione um ou mais)</Label>
                    <ScrollArea className="h-[150px] border rounded-md p-2 mt-1">
                      <div className="space-y-2">
                        {salespeople.map((sp) => (
                          <div key={sp.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`sp-${sp.id}`}
                              checked={formData.salesperson_ids.includes(sp.id)}
                              onCheckedChange={() => 
                                setFormData({ 
                                  ...formData, 
                                  salesperson_ids: toggleArrayItem(formData.salesperson_ids, sp.id) 
                                })
                              }
                            />
                            <label
                              htmlFor={`sp-${sp.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {sp.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.salesperson_ids.length} vendedor(es) selecionado(s)
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editingKpi ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <KPIMonthlyTargetsDialog
        open={showMonthlyTargets}
        onOpenChange={setShowMonthlyTargets}
        companyId={companyId}
        kpis={kpis}
        onSaved={() => fetchData()}
        onAddKPI={() => {
          setShowMonthlyTargets(false);
          resetForm();
          setShowDialog(true);
        }}
        isClient={isClient}
      />

      {kpis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum KPI configurado ainda.</p>
            <p className="text-sm">Crie KPIs para começar a acompanhar os indicadores da empresa.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead className="w-[80px]">Ordem</TableHead>}
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((kpi, index) => (
                <TableRow 
                  key={kpi.id} 
                  className={`${!kpi.is_active ? "opacity-50" : ""} ${draggedKpiId === kpi.id ? "opacity-50 bg-muted" : ""} ${dragOverKpiId === kpi.id ? "border-t-2 border-primary" : ""}`}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, kpi.id)}
                  onDragOver={(e) => handleDragOver(e, kpi.id)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, kpi.id)}
                >
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => handleMoveUp(kpi)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => handleMoveDown(kpi)}
                          disabled={index === kpis.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {kpi.name}
                    {kpi.is_required && (
                      <Badge variant="secondary" className="ml-2">Obrigatório</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getTypeLabel(kpi.kpi_type)}</TableCell>
                  <TableCell>{getPeriodicityLabel(kpi.periodicity)}</TableCell>
                  <TableCell>{formatValue(kpi.target_value, kpi.kpi_type)}</TableCell>
                  <TableCell>
                    <Badge variant={kpi.is_individual ? "default" : "outline"}>
                      {kpi.is_individual ? "Individual" : "Coletivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {kpi.scope === "unit" && (kpi.unit_ids?.length || kpi.unit_id) ? (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {getMultipleNames(kpi.unit_ids, "unit") || getUnitName(kpi.unit_id)}
                      </Badge>
                    ) : kpi.scope === "sector" && (kpi.sector_ids?.length || kpi.sector_id) ? (
                      <Badge variant="outline" className="gap-1">
                        <Layers className="h-3 w-3" />
                        {getMultipleNames(kpi.sector_ids, "sector") || getSectorName(kpi.sector_id)}
                      </Badge>
                    ) : kpi.scope === "team" && (kpi.team_ids?.length || kpi.team_id) ? (
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {getMultipleNames(kpi.team_ids, "team") || getTeamName(kpi.team_id)}
                      </Badge>
                    ) : kpi.scope === "salesperson" && (kpi.salesperson_ids?.length || kpi.salesperson_id) ? (
                      <Badge variant="outline" className="gap-1">
                        <User className="h-3 w-3" />
                        {getMultipleNames(kpi.salesperson_ids, "salesperson") || getSalespersonName(kpi.salesperson_id)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Toda empresa</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={kpi.is_active}
                      onCheckedChange={(v) => handleToggleActive(kpi.id, v)}
                      disabled={!isAdmin}
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(kpi)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(kpi.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
