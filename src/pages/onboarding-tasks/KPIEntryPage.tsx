import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Calendar, User, DollarSign, Percent, Hash, AlertCircle, Building2, Users, Layers } from "lucide-react";
import { toDateString } from "@/lib/dateUtils";
import { SalespersonDailyGoalCard } from "@/components/onboarding-tasks/kpis/SalespersonDailyGoalCard";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: string;
  target_value: number;
  is_required: boolean;
  sector_id: string | null;
  scope: "company" | "sector" | "team" | "salesperson" | "unit" | null;
  team_id: string | null;
  unit_id: string | null;
  salesperson_id: string | null;
}

interface Salesperson {
  id: string;
  name: string;
  access_code: string;
  company_id: string;
  unit_id: string | null;
  team_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

export default function KPIEntryPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [step, setStep] = useState<"auth" | "entry" | "success">(codeFromUrl ? "auth" : "auth");
  const [accessCode, setAccessCode] = useState(codeFromUrl || "");
  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [salespersonSectors, setSalespersonSectors] = useState<string[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [entryDate, setEntryDate] = useState(toDateString(new Date()));
  const [values, setValues] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(!!codeFromUrl); // Start loading if code is in URL
  const [existingEntries, setExistingEntries] = useState<Record<string, number>>({});
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);

  useEffect(() => {
    if (codeFromUrl && companyId && !autoAuthAttempted) {
      setAutoAuthAttempted(true);
      handleAuthenticateWithCode(codeFromUrl);
    }
  }, [codeFromUrl, companyId, autoAuthAttempted]);

  const handleAuthenticate = async () => {
    if (!accessCode.trim()) {
      toast.error("Digite seu código de acesso");
      return;
    }
    await handleAuthenticateWithCode(accessCode.trim());
  };

  const handleAuthenticateWithCode = async (code: string) => {
    if (!code) return;

    setLoading(true);
    try {
      // Find salesperson by access code
      const { data: salespersonData, error: spError } = await supabase
        .from("company_salespeople")
        .select("*")
        .eq("access_code", code)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .single();

      if (spError || !salespersonData) {
        toast.error("Código de acesso inválido");
        return;
      }

      setSalesperson(salespersonData);

      // Fetch company
      const { data: companyData } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("id", companyId)
        .single();

      setCompany(companyData);

      // Fetch team if salesperson has one
      if (salespersonData.team_id) {
        const { data: teamData } = await supabase
          .from("company_teams")
          .select("id, name")
          .eq("id", salespersonData.team_id)
          .single();
        setTeam(teamData);
      }

      // Fetch salesperson's sectors (many-to-many relationship)
      const { data: spSectorsData } = await supabase
        .from("salesperson_sectors")
        .select("sector_id")
        .eq("salesperson_id", salespersonData.id);

      const sectorIds = (spSectorsData || []).map((s: any) => s.sector_id);
      setSalespersonSectors(sectorIds);

      // Fetch sector details if salesperson has sectors
      if (sectorIds.length > 0) {
        const { data: sectorsData } = await supabase
          .from("company_sectors")
          .select("id, name")
          .in("id", sectorIds);
        setSectors(sectorsData || []);
      }

      // Fetch units
      const { data: unitsData } = await supabase
        .from("company_units")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      setUnits(unitsData || []);
      
      // Set default unit if salesperson has one
      if (salespersonData.unit_id) {
        setSelectedUnit(salespersonData.unit_id);
      } else if (unitsData && unitsData.length > 0) {
        setSelectedUnit(unitsData[0].id);
      }

      // Fetch active KPIs - filter by salesperson's sectors
      let kpisQuery = supabase
        .from("company_kpis")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order");

      const { data: allKpisData, error: kpisError } = await kpisQuery;

      if (kpisError) throw kpisError;

      // Fetch multi-select relationships
      const kpiIds = (allKpisData || []).map((k: any) => k.id);
      const [kpiUnitsRes, kpiSectorsRes, kpiTeamsRes, kpiSalespeopleRes] = await Promise.all([
        kpiIds.length > 0 ? supabase.from("kpi_units").select("kpi_id, unit_id").in("kpi_id", kpiIds) : Promise.resolve({ data: [] }),
        kpiIds.length > 0 ? supabase.from("kpi_sectors").select("kpi_id, sector_id").in("kpi_id", kpiIds) : Promise.resolve({ data: [] }),
        kpiIds.length > 0 ? supabase.from("kpi_teams").select("kpi_id, team_id").in("kpi_id", kpiIds) : Promise.resolve({ data: [] }),
        kpiIds.length > 0 ? supabase.from("kpi_salespeople").select("kpi_id, salesperson_id").in("kpi_id", kpiIds) : Promise.resolve({ data: [] }),
      ]);

      // Build lookup maps for multi-select relationships
      const kpiUnitIds = new Map<string, string[]>();
      const kpiSectorIds = new Map<string, string[]>();
      const kpiTeamIds = new Map<string, string[]>();
      const kpiSalespersonIds = new Map<string, string[]>();

      (kpiUnitsRes.data || []).forEach((r: any) => {
        if (!kpiUnitIds.has(r.kpi_id)) kpiUnitIds.set(r.kpi_id, []);
        kpiUnitIds.get(r.kpi_id)!.push(r.unit_id);
      });
      (kpiSectorsRes.data || []).forEach((r: any) => {
        if (!kpiSectorIds.has(r.kpi_id)) kpiSectorIds.set(r.kpi_id, []);
        kpiSectorIds.get(r.kpi_id)!.push(r.sector_id);
      });
      (kpiTeamsRes.data || []).forEach((r: any) => {
        if (!kpiTeamIds.has(r.kpi_id)) kpiTeamIds.set(r.kpi_id, []);
        kpiTeamIds.get(r.kpi_id)!.push(r.team_id);
      });
      (kpiSalespeopleRes.data || []).forEach((r: any) => {
        if (!kpiSalespersonIds.has(r.kpi_id)) kpiSalespersonIds.set(r.kpi_id, []);
        kpiSalespersonIds.get(r.kpi_id)!.push(r.salesperson_id);
      });

      // Filter KPIs based on scope - show KPIs that match the salesperson's context
      // Logic: A salesperson sees a KPI if:
      // 1. The KPI has NO specific scope restrictions (company-wide)
      // 2. The KPI's scope matches the salesperson's context (same sector/team/unit/salesperson)
      let filteredKpis = (allKpisData || []) as KPI[];
      
      console.log("[KPIEntry] Filtering KPIs for salesperson:", {
        salespersonId: salespersonData.id,
        unitId: salespersonData.unit_id,
        teamId: salespersonData.team_id,
        sectorIds,
        totalKpis: filteredKpis.length
      });
      
      filteredKpis = filteredKpis.filter(kpi => {
        // Check if KPI has any specific scope restriction
        const hasSpecificScope = kpi.scope && kpi.scope !== 'company';
        
        // Get multi-select IDs for this KPI (fallback to legacy single fields)
        const unitIdsForKpi = kpiUnitIds.get(kpi.id) || (kpi.unit_id ? [kpi.unit_id] : []);
        const sectorIdsForKpi = kpiSectorIds.get(kpi.id) || (kpi.sector_id ? [kpi.sector_id] : []);
        const teamIdsForKpi = kpiTeamIds.get(kpi.id) || (kpi.team_id ? [kpi.team_id] : []);
        const salespersonIdsForKpi = kpiSalespersonIds.get(kpi.id) || (kpi.salesperson_id ? [kpi.salesperson_id] : []);

        const hasUnitRestriction = unitIdsForKpi.length > 0;
        const hasSectorRestriction = sectorIdsForKpi.length > 0;
        const hasTeamRestriction = teamIdsForKpi.length > 0;
        const hasSalespersonRestriction = salespersonIdsForKpi.length > 0;
        
        // If KPI is salesperson-specific, only those salespeople see it
        if (kpi.scope === 'salesperson' && hasSalespersonRestriction) {
          return salespersonIdsForKpi.includes(salespersonData.id);
        }
        
        // If KPI is team-specific, only salespeople in those teams see it
        if (kpi.scope === 'team' && hasTeamRestriction) {
          return salespersonData.team_id && teamIdsForKpi.includes(salespersonData.team_id);
        }
        
        // If KPI is sector-specific, only salespeople in those sectors see it
        if (kpi.scope === 'sector' && hasSectorRestriction) {
          return sectorIds.some(sid => sectorIdsForKpi.includes(sid));
        }
        
        // If KPI is unit-specific, only salespeople in those units see it
        if (kpi.scope === 'unit' && hasUnitRestriction) {
          return salespersonData.unit_id && unitIdsForKpi.includes(salespersonData.unit_id);
        }
        
        // For company scope or no scope, check if there are additional restrictions
        // If KPI has a unit restriction (without explicit scope), salesperson must match
        if (hasUnitRestriction && !hasSpecificScope) {
          if (salespersonData.unit_id && !unitIdsForKpi.includes(salespersonData.unit_id)) {
            return false;
          }
        }
        
        // Legacy: If KPI has sector restriction without explicit scope, respect it
        if (hasSectorRestriction && !hasSpecificScope) {
          if (sectorIds.length > 0 && !sectorIds.some(sid => sectorIdsForKpi.includes(sid))) {
            return false;
          }
        }
        
        // Legacy: If KPI has team restriction without explicit scope, respect it
        if (hasTeamRestriction && !hasSpecificScope) {
          if (salespersonData.team_id && !teamIdsForKpi.includes(salespersonData.team_id)) {
            return false;
          }
        }
        
        // KPI passes all filters - show it
        return true;
      });
      
      console.log("[KPIEntry] Filtered KPIs:", filteredKpis.length, filteredKpis.map(k => k.name));

      setKpis(filteredKpis);

      // Initialize values
      const initialValues: Record<string, number> = {};
      filteredKpis.forEach(kpi => {
        initialValues[kpi.id] = 0;
      });
      setValues(initialValues);

      // Check for existing entries today
      await fetchExistingEntries(salespersonData.id, entryDate);

      setStep("entry");
    } catch (error) {
      console.error("Error authenticating:", error);
      toast.error("Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingEntries = async (salespersonId: string, date: string) => {
    const { data } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("salesperson_id", salespersonId)
      .eq("entry_date", date);

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

  const handleDateChange = async (newDate: string) => {
    setEntryDate(newDate);
    if (salesperson) {
      await fetchExistingEntries(salesperson.id, newDate);
    }
  };

  const handleSubmit = async () => {
    if (!salesperson) return;

    // Validate required fields - allow 0 as a valid value
    const requiredKpis = kpis.filter(k => k.is_required);
    for (const kpi of requiredKpis) {
      if (values[kpi.id] === undefined || values[kpi.id] === null || isNaN(values[kpi.id])) {
        toast.error(`O campo "${kpi.name}" é obrigatório`);
        return;
      }
    }

    setLoading(true);
    try {
      // Delete existing entries for this date/salesperson (upsert approach)
      await supabase
        .from("kpi_entries")
        .delete()
        .eq("salesperson_id", salesperson.id)
        .eq("entry_date", entryDate);

      // Insert new entries with team_id and sector_id
      const entries = kpis.map(kpi => ({
        company_id: companyId,
        salesperson_id: salesperson.id,
        kpi_id: kpi.id,
        entry_date: entryDate,
        value: values[kpi.id] || 0,
        observations: observations,
        unit_id: selectedUnit || salesperson.unit_id || null,
        team_id: salesperson.team_id || null,
        sector_id: kpi.sector_id || (salespersonSectors.length === 1 ? salespersonSectors[0] : null),
      }));

      const { error } = await supabase.from("kpi_entries").insert(entries);

      if (error) throw error;

      setStep("success");
      toast.success("Lançamento realizado com sucesso!");
    } catch (error) {
      console.error("Error submitting entries:", error);
      toast.error("Erro ao salvar lançamento");
    } finally {
      setLoading(false);
    }
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4 text-green-600" />;
      case "percentage": return <Percent className="h-4 w-4 text-blue-600" />;
      default: return <Hash className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatPlaceholder = (type: string) => {
    switch (type) {
      case "monetary": return "0,00";
      case "percentage": return "0";
      default: return "0";
    }
  };

  if (step === "auth") {
    // If we have a code from URL and are still loading, show loading state
    if (codeFromUrl && loading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Autenticando...</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Lançamento de Vendas</CardTitle>
            <CardDescription>Digite seu código de acesso para continuar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Código de Acesso</Label>
              <Input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Digite seu código"
                className="text-center text-lg tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
              />
            </div>
            <Button onClick={handleAuthenticate} className="w-full" disabled={loading}>
              {loading ? "Verificando..." : "Acessar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Lançamento Realizado!</h2>
            <p className="text-muted-foreground mb-6">
              Seus dados foram salvos com sucesso.
            </p>
            <div className="space-y-2">
              <Button onClick={() => {
                setValues({});
                setObservations("");
                setEntryDate(toDateString(new Date()));
                setStep("entry");
              }} className="w-full">
                Fazer Novo Lançamento
              </Button>
              <Button variant="outline" onClick={() => window.close()} className="w-full">
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle>Lançamento de Vendas</CardTitle>
                <CardDescription>{company?.name}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {salesperson?.name}
                </Badge>
                {team && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {team.name}
                  </Badge>
                )}
                {sectors.length > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Layers className="h-3 w-3" />
                    {sectors.map(s => s.name).join(", ")}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Selection */}
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data do Lançamento
              </Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={toDateString(new Date())}
              />
              {Object.keys(existingEntries).length > 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  Já existe lançamento para esta data. Os valores serão atualizados.
                </p>
              )}
            </div>

            {/* Unit Selection */}
            {units.length > 0 && (
              <div>
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Unidade / Filial
                </Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Salesperson Daily Goal */}
            {salesperson && companyId && (
              <SalespersonDailyGoalCard
                companyId={companyId}
                salespersonId={salesperson.id}
                salespersonName={salesperson.name}
              />
            )}

            {/* KPI Fields */}
            <div className="space-y-4">
              <Label>Indicadores</Label>
              {kpis.map(kpi => (
                <div key={kpi.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getKpiIcon(kpi.kpi_type)}
                    <Label className="font-medium">
                      {kpi.name}
                      {kpi.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
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
                          placeholder={formatPlaceholder(kpi.kpi_type)}
                          className="flex-1"
                        />
                        {kpi.kpi_type === "percentage" && (
                          <span className="text-muted-foreground">%</span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Meta: {kpi.kpi_type === "monetary" 
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpi.target_value)
                      : kpi.kpi_type === "percentage"
                      ? `${kpi.target_value}%`
                      : kpi.target_value.toLocaleString("pt-BR")
                    } ({kpi.periodicity === "daily" ? "diária" : kpi.periodicity === "weekly" ? "semanal" : "mensal"})
                  </p>
                </div>
              ))}
            </div>

            {/* Observations */}
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Adicione comentários sobre o dia..."
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
