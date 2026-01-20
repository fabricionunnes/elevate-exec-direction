import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { User, Users, Layers, DollarSign, Percent, Hash, Calendar, Building2, AlertCircle } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  target_value: number;
  is_required: boolean;
  sector_id: string | null;
}

interface Salesperson {
  id: string;
  name: string;
  unit_id: string | null;
  team_id: string | null;
}

interface Team {
  id: string;
  name: string;
  unit_id: string | null;
}

interface Sector {
  id: string;
  name: string;
  unit_id: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface KPIAdminEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess?: () => void;
}

type EntryScope = "salesperson" | "team" | "sector";

export function KPIAdminEntryDialog({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}: KPIAdminEntryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entryScope, setEntryScope] = useState<EntryScope>("salesperson");
  
  // Data
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Filters
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("");
  
  // Entry data
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [values, setValues] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState("");
  const [existingEntries, setExistingEntries] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, companyId]);

  useEffect(() => {
    // Reset selections when scope changes
    setSelectedSalesperson("");
    setSelectedTeam("");
    setSelectedSector("");
    setValues({});
    setExistingEntries({});
  }, [entryScope]);

  useEffect(() => {
    // Fetch existing entries when selection changes
    if (entryScope === "salesperson" && selectedSalesperson) {
      fetchExistingEntries();
    } else if (entryScope === "team" && selectedTeam) {
      fetchExistingEntriesForTeam();
    } else if (entryScope === "sector" && selectedSector) {
      fetchExistingEntriesForSector();
    }
  }, [selectedSalesperson, selectedTeam, selectedSector, entryDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpisRes, salespeopleRes, teamsRes, sectorsRes, unitsRes] = await Promise.all([
        supabase.from("company_kpis").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
        supabase.from("company_salespeople").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_teams").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_sectors").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_units").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);

      setKpis((kpisRes.data || []) as KPI[]);
      setSalespeople((salespeopleRes.data || []) as Salesperson[]);
      setTeams((teamsRes.data || []) as Team[]);
      setSectors((sectorsRes.data || []) as Sector[]);
      setUnits((unitsRes.data || []) as Unit[]);

      // Initialize values
      const initialValues: Record<string, number> = {};
      (kpisRes.data || []).forEach((kpi: any) => {
        initialValues[kpi.id] = 0;
      });
      setValues(initialValues);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingEntries = async () => {
    if (!selectedSalesperson) return;
    
    const { data } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("salesperson_id", selectedSalesperson)
      .eq("entry_date", entryDate);

    if (data && data.length > 0) {
      const entriesMap: Record<string, number> = {};
      data.forEach(entry => {
        entriesMap[entry.kpi_id] = entry.value;
      });
      setExistingEntries(entriesMap);
      setValues(prev => ({ ...prev, ...entriesMap }));
    } else {
      setExistingEntries({});
    }
  };

  const fetchExistingEntriesForTeam = async () => {
    if (!selectedTeam) return;
    
    const { data } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("team_id", selectedTeam)
      .eq("entry_date", entryDate)
      .is("salesperson_id", null);

    if (data && data.length > 0) {
      const entriesMap: Record<string, number> = {};
      data.forEach(entry => {
        entriesMap[entry.kpi_id] = entry.value;
      });
      setExistingEntries(entriesMap);
      setValues(prev => ({ ...prev, ...entriesMap }));
    } else {
      setExistingEntries({});
    }
  };

  const fetchExistingEntriesForSector = async () => {
    if (!selectedSector) return;
    
    const { data } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("sector_id", selectedSector)
      .eq("entry_date", entryDate)
      .is("salesperson_id", null)
      .is("team_id", null);

    if (data && data.length > 0) {
      const entriesMap: Record<string, number> = {};
      data.forEach(entry => {
        entriesMap[entry.kpi_id] = entry.value;
      });
      setExistingEntries(entriesMap);
      setValues(prev => ({ ...prev, ...entriesMap }));
    } else {
      setExistingEntries({});
    }
  };

  const getFilteredSalespeople = () => {
    if (selectedUnit === "all") return salespeople;
    return salespeople.filter(sp => sp.unit_id === selectedUnit);
  };

  const getFilteredTeams = () => {
    if (selectedUnit === "all") return teams;
    return teams.filter(t => t.unit_id === selectedUnit);
  };

  const getFilteredSectors = () => {
    if (selectedUnit === "all") return sectors;
    return sectors.filter(s => s.unit_id === selectedUnit || s.unit_id === null);
  };

  const getFilteredKpis = () => {
    if (entryScope === "sector" && selectedSector) {
      // Show KPIs linked to this sector or shared KPIs
      return kpis.filter(kpi => kpi.sector_id === selectedSector || kpi.sector_id === null);
    }
    if (entryScope === "salesperson" && selectedSalesperson) {
      // TODO: Could filter by salesperson's sectors if needed
      return kpis;
    }
    return kpis;
  };

  const handleSubmit = async () => {
    if (entryScope === "salesperson" && !selectedSalesperson) {
      toast.error("Selecione um vendedor");
      return;
    }
    if (entryScope === "team" && !selectedTeam) {
      toast.error("Selecione uma equipe");
      return;
    }
    if (entryScope === "sector" && !selectedSector) {
      toast.error("Selecione um setor");
      return;
    }

    setSaving(true);
    try {
      const filteredKpis = getFilteredKpis();
      
      if (entryScope === "salesperson") {
        // Delete existing entries for this salesperson/date
        await supabase
          .from("kpi_entries")
          .delete()
          .eq("salesperson_id", selectedSalesperson)
          .eq("entry_date", entryDate);

        const sp = salespeople.find(s => s.id === selectedSalesperson);
        
        // Insert new entries
        const entries = filteredKpis.map(kpi => ({
          company_id: companyId,
          salesperson_id: selectedSalesperson,
          kpi_id: kpi.id,
          entry_date: entryDate,
          value: values[kpi.id] || 0,
          observations: observations,
          unit_id: sp?.unit_id || null,
          team_id: sp?.team_id || null,
          sector_id: kpi.sector_id || null,
        }));

        const { error } = await supabase.from("kpi_entries").insert(entries);
        if (error) throw error;

      } else if (entryScope === "team") {
        // Delete existing team-level entries (where salesperson_id is null)
        await supabase
          .from("kpi_entries")
          .delete()
          .eq("team_id", selectedTeam)
          .eq("entry_date", entryDate)
          .is("salesperson_id", null);

        const team = teams.find(t => t.id === selectedTeam);
        
        // Insert team-level entries
        const entries = filteredKpis.map(kpi => ({
          company_id: companyId,
          salesperson_id: null,
          kpi_id: kpi.id,
          entry_date: entryDate,
          value: values[kpi.id] || 0,
          observations: observations,
          unit_id: team?.unit_id || (selectedUnit !== "all" ? selectedUnit : null),
          team_id: selectedTeam,
          sector_id: kpi.sector_id || null,
        }));

        const { error } = await supabase.from("kpi_entries").insert(entries);
        if (error) throw error;

      } else if (entryScope === "sector") {
        // Delete existing sector-level entries (where salesperson_id and team_id are null)
        await supabase
          .from("kpi_entries")
          .delete()
          .eq("sector_id", selectedSector)
          .eq("entry_date", entryDate)
          .is("salesperson_id", null)
          .is("team_id", null);

        const sector = sectors.find(s => s.id === selectedSector);
        
        // Insert sector-level entries
        const entries = filteredKpis.map(kpi => ({
          company_id: companyId,
          salesperson_id: null,
          kpi_id: kpi.id,
          entry_date: entryDate,
          value: values[kpi.id] || 0,
          observations: observations,
          unit_id: sector?.unit_id || (selectedUnit !== "all" ? selectedUnit : null),
          team_id: null,
          sector_id: selectedSector,
        }));

        const { error } = await supabase.from("kpi_entries").insert(entries);
        if (error) throw error;
      }

      toast.success("Lançamento realizado com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving entries:", error);
      toast.error("Erro ao salvar lançamento");
    } finally {
      setSaving(false);
    }
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4 text-green-600" />;
      case "percentage": return <Percent className="h-4 w-4 text-blue-600" />;
      default: return <Hash className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSelectionLabel = () => {
    if (entryScope === "salesperson" && selectedSalesperson) {
      const sp = salespeople.find(s => s.id === selectedSalesperson);
      return sp?.name || "";
    }
    if (entryScope === "team" && selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam);
      return team?.name || "";
    }
    if (entryScope === "sector" && selectedSector) {
      const sector = sectors.find(s => s.id === selectedSector);
      return sector?.name || "";
    }
    return "";
  };

  const hasValidSelection = () => {
    if (entryScope === "salesperson") return !!selectedSalesperson;
    if (entryScope === "team") return !!selectedTeam;
    if (entryScope === "sector") return !!selectedSector;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamento de KPIs</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Entry Scope Tabs */}
            <Tabs value={entryScope} onValueChange={(v) => setEntryScope(v as EntryScope)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="salesperson" className="gap-2">
                  <User className="h-4 w-4" />
                  Vendedor
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-2">
                  <Users className="h-4 w-4" />
                  Equipe
                </TabsTrigger>
                <TabsTrigger value="sector" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Setor
                </TabsTrigger>
              </TabsList>

              {/* Unit Filter (optional) */}
              {units.length > 0 && (
                <div className="mt-4">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Filtrar por Unidade
                  </Label>
                  <Select value={selectedUnit} onValueChange={(v) => {
                    setSelectedUnit(v);
                    setSelectedSalesperson("");
                    setSelectedTeam("");
                    setSelectedSector("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as unidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as unidades</SelectItem>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <TabsContent value="salesperson" className="mt-4 space-y-4">
                <div>
                  <Label>Selecione o Vendedor *</Label>
                  <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredSalespeople().map(sp => (
                        <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="team" className="mt-4 space-y-4">
                <div>
                  <Label>Selecione a Equipe *</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredTeams().map(team => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lançamentos de equipe são consolidados e não vinculados a vendedores individuais
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="sector" className="mt-4 space-y-4">
                <div>
                  <Label>Selecione o Setor *</Label>
                  <Select value={selectedSector} onValueChange={setSelectedSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredSectors().map(sector => (
                        <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lançamentos de setor são consolidados e aparecem apenas os KPIs vinculados a este setor
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Date Selection */}
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data do Lançamento
              </Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
              {Object.keys(existingEntries).length > 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  Já existe lançamento para esta data. Os valores serão atualizados.
                </p>
              )}
            </div>

            {/* Selection Badge */}
            {hasValidSelection() && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Lançando para:</span>
                <Badge variant="secondary" className="gap-1">
                  {entryScope === "salesperson" && <User className="h-3 w-3" />}
                  {entryScope === "team" && <Users className="h-3 w-3" />}
                  {entryScope === "sector" && <Layers className="h-3 w-3" />}
                  {getSelectionLabel()}
                </Badge>
              </div>
            )}

            {/* KPI Fields */}
            {hasValidSelection() && (
              <div className="space-y-4">
                <Label>Indicadores</Label>
                {getFilteredKpis().map(kpi => (
                  <div key={kpi.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getKpiIcon(kpi.kpi_type)}
                      <Label className="font-medium">
                        {kpi.name}
                        {kpi.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {kpi.sector_id && (
                        <Badge variant="outline" className="text-xs">
                          {sectors.find(s => s.id === kpi.sector_id)?.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {kpi.kpi_type === "monetary" ? (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-muted-foreground">R$</span>
                          <CurrencyInput
                            value={values[kpi.id] || 0}
                            onChange={(val) => setValues({ ...values, [kpi.id]: val })}
                            placeholder="0,00"
                            className="flex-1"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="number"
                            step={kpi.kpi_type === "percentage" ? "0.01" : "1"}
                            min="0"
                            value={values[kpi.id] || ""}
                            onChange={(e) => setValues({ ...values, [kpi.id]: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="flex-1"
                          />
                          {kpi.kpi_type === "percentage" && (
                            <span className="text-muted-foreground">%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Observations */}
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Adicione comentários..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                className="flex-1" 
                disabled={saving || !hasValidSelection()}
              >
                {saving ? "Salvando..." : "Salvar Lançamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
