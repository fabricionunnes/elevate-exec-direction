import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, FunnelChart, Funnel, LabelList, Cell } from "recharts";
import { format, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Target, Users, DollarSign, Percent, Hash, CalendarDays, Building2, Check, Filter, UsersRound, Layers, ExternalLink } from "lucide-react";
import { parseDateLocal } from "@/lib/dateUtils";
import { CampaignDashboardWidget } from "../endomarketing/CampaignDashboardWidget";
import { GamificationDashboardWidget } from "../gamification/GamificationDashboardWidget";
import { SalesHistoryDialog } from "./SalesHistoryDialog";
import { SalesComparisonChart } from "./SalesComparisonChart";
import { CACCalculatorCard } from "@/components/client-portal/CACCalculatorCard";
import { KPIEntriesHistoryDialog } from "./KPIEntriesHistoryDialog";
import { SalespeopleComparisonTable } from "./SalespeopleComparisonTable";
import { MonthlySalesChart } from "./MonthlySalesChart";
import { PerformanceComparisonCard } from "./PerformanceComparisonCard";
import { DailyGoalCard } from "./DailyGoalCard";
import { ProjectTermVisionCard } from "./ProjectTermVisionCard";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: "daily" | "weekly" | "monthly";
  target_value: number;
  effective_target?: number; // Monthly target or default target
  monthly_targets?: Record<string, number>; // Multiple target levels: { "Meta": 100, "Super Meta": 150 }
  is_individual: boolean;
  is_active: boolean;
  sector_id?: string | null;
  scope?: "company" | "sector" | "team" | "salesperson" | null;
  team_id?: string | null;
  salesperson_id?: string | null;
  unit_id?: string | null;
  is_main_goal?: boolean;
}

interface Sector {
  id: string;
  name: string;
  unit_id: string | null;
  is_active: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  is_active: boolean;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
}

interface Team {
  id: string;
  name: string;
  unit_id: string | null;
  is_active: boolean;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  entry_date: string;
  value: number;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface KPIDashboardTabProps {
  companyId: string;
  projectId?: string;
  canDeleteEntries?: boolean; // Admin, CS, or consultant
  canEditSalesHistory?: boolean; // Admin, CS, consultant, or client
  salespersonId?: string | null; // Filter all data by this salesperson (for vendedor role)
}

// Raw monthly targets storage (all scopes: company, unit, salesperson)
interface MonthlyTarget {
  id: string;
  kpi_id: string;
  level_name: string;
  level_order: number;
  target_value: number;
  unit_id: string | null;
  team_id: string | null;
  salesperson_id: string | null;
}

export const KPIDashboardTab = ({ 
  companyId, 
  projectId, 
  canDeleteEntries = false, 
  canEditSalesHistory = false,
  salespersonId,
}: KPIDashboardTabProps) => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorTeams, setSectorTeams] = useState<{ sector_id: string; team_id: string }[]>([]);
  const [teamUnits, setTeamUnits] = useState<{ team_id: string; unit_id: string }[]>([]);
  const [allMonthlyTargets, setAllMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [selectedKpi, setSelectedKpi] = useState<string>("all");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [salesHistoryRefreshKey, setSalesHistoryRefreshKey] = useState(0);
  const [contractStartDate, setContractStartDate] = useState<string | null>(null);
  const [salespersonAccessCode, setSalespersonAccessCode] = useState<string | null>(null);

  const applyMonthRange = (monthsAgo: number) => {
    const base = subMonths(new Date(), monthsAgo);
    setDateRange({
      start: format(startOfMonth(base), "yyyy-MM-dd"),
      end: format(endOfMonth(base), "yyyy-MM-dd"),
    });
  };

  useEffect(() => {
    fetchData();
  }, [companyId, dateRange, salespersonId]);

  // If salespersonId is set, auto-select that salesperson
  useEffect(() => {
    if (salespersonId) {
      setSelectedSalesperson(salespersonId);
    }
  }, [salespersonId]);

  const fetchData = async () => {
    console.log("[KPIDashboardTab] Fetching data for companyId:", companyId);
    
    if (!companyId) {
      console.warn("[KPIDashboardTab] No companyId provided");
      setLoading(false);
      return;
    }

    // Validate date range - don't fetch if dates are empty
    if (!dateRange.start || !dateRange.end) {
      console.warn("[KPIDashboardTab] Invalid date range - start or end is empty");
      setLoading(false);
      return;
    }

    try {
      // Get the month from the selected date range for monthly targets
      const selectedMonthYear = format(parseDateLocal(dateRange.start), "yyyy-MM");

      // Build entries query - filter by salesperson if provided
      let entriesQuery = supabase.from("kpi_entries").select("*").eq("company_id", companyId).gte("entry_date", dateRange.start).lte("entry_date", dateRange.end);
      if (salespersonId) {
        entriesQuery = entriesQuery.eq("salesperson_id", salespersonId);
      }

      const [kpisRes, salespeopleRes, entriesRes, unitsRes, teamsRes, sectorsRes, companyRes, monthlyTargetsRes, sectorTeamsRes, teamUnitsRes] = await Promise.all([
        supabase.from("company_kpis").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
        salespersonId 
          ? supabase.from("company_salespeople").select("*").eq("id", salespersonId)
          : supabase.from("company_salespeople").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        entriesQuery,
        supabase.from("company_units").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_teams").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_sectors").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("onboarding_companies").select("contract_start_date").eq("id", companyId).single(),
        supabase.from("kpi_monthly_targets").select("*").eq("company_id", companyId).eq("month_year", selectedMonthYear).order("level_order"),
        supabase.from("company_sector_teams").select("sector_id, team_id"),
        supabase.from("company_team_units").select("team_id, unit_id"),
      ]);

      console.log("[KPIDashboardTab] Results:", {
        kpis: kpisRes.data?.length || 0,
        kpisError: kpisRes.error,
        salespeople: salespeopleRes.data?.length || 0,
        salespeopleError: salespeopleRes.error,
        entries: entriesRes.data?.length || 0,
        entriesError: entriesRes.error,
        units: unitsRes.data?.length || 0,
        unitsError: unitsRes.error,
        teams: teamsRes.data?.length || 0,
        teamsError: teamsRes.error,
        sectors: sectorsRes.data?.length || 0,
        sectorsError: sectorsRes.error,
        monthlyTargets: monthlyTargetsRes.data?.length || 0,
      });

      if (kpisRes.error) throw kpisRes.error;
      if (salespeopleRes.error) throw salespeopleRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (sectorsRes.error) throw sectorsRes.error;

      // Store all monthly targets for later filtering by unit/salesperson
      setAllMonthlyTargets((monthlyTargetsRes.data || []) as MonthlyTarget[]);

      // Build initial map of monthly targets (company-level only, no unit/team/salesperson filter)
      const companyLevelTargets = (monthlyTargetsRes.data || []).filter(
        (mt: any) => mt.unit_id === null && mt.team_id === null && mt.salesperson_id === null
      );
      const monthlyTargetMap: Record<string, Record<string, number>> = {};
      companyLevelTargets.forEach((mt: any) => {
        if (!monthlyTargetMap[mt.kpi_id]) {
          monthlyTargetMap[mt.kpi_id] = {};
        }
        monthlyTargetMap[mt.kpi_id][mt.level_name] = mt.target_value;
      });

      // Merge monthly targets into KPIs - use first level (Meta) as effective_target
      const kpisWithTargets = (kpisRes.data || []).map((kpi: any) => {
        const kpiTargets = monthlyTargetMap[kpi.id] || {};
        const firstLevelValue = kpiTargets["Meta"] ?? Object.values(kpiTargets)[0];
        return {
          ...kpi,
          effective_target: firstLevelValue !== undefined ? firstLevelValue : kpi.target_value,
          monthly_targets: Object.keys(kpiTargets).length > 0 ? kpiTargets : undefined,
        };
      });

      setKpis(kpisWithTargets as KPI[]);
      setSalespeople(salespeopleRes.data || []);
      setEntries(entriesRes.data || []);
      setUnits(unitsRes.data || []);
      setTeams(teamsRes.data || []);
      setSectors(sectorsRes.data || []);
      setSectorTeams(sectorTeamsRes.data || []);
      setTeamUnits(teamUnitsRes.data || []);
      if (companyRes.data) {
        setContractStartDate(companyRes.data.contract_start_date);
      }
      // Store access code for the salesperson if we're filtering by one
      if (salespersonId && salespeopleRes.data?.[0]?.access_code) {
        setSalespersonAccessCode(salespeopleRes.data[0].access_code);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // KPI "unit scope" is represented by having unit_id set, but no team/salesperson/sector binding.
  // We must be strict here; some KPIs may carry unit_id for informational purposes and should NOT be treated as unit-scoped.
  const isUnitScopedKpi = (kpi: KPI | undefined | null) => {
    if (!kpi) return false;
    return !!kpi.unit_id && !kpi.team_id && !kpi.salesperson_id && !kpi.sector_id;
  };

  /**
   * Helper to categorize monetary KPIs into "faturamento" (billing/invoiced) vs "receita" (actual cash received)
   * Based on common naming patterns in Portuguese.
   */
  const categorizeMonetaryKpi = (kpi: KPI): "faturamento" | "receita" | "other" => {
    const nameLower = kpi.name.toLowerCase();
    
    // Patterns for "faturamento" (billing, invoiced value, closed contracts)
    const faturamentoPatterns = [
      'faturamento', 'faturado', 'fatura', 'contrato', 'fechado', 'fechamento',
      'venda', 'vendido', 'vendas', 'pedido', 'orçamento aprovado', 'orcamento aprovado'
    ];
    
    // Patterns for "receita" (actual cash received, money in)
    const receitaPatterns = [
      'receita', 'recebido', 'recebimento', 'entrada', 'caixa', 
      'dinheiro', 'pagamento recebido', 'pago', 'baixado'
    ];
    
    // Check for receita first (more specific pattern like "dinheiro que entrou")
    if (receitaPatterns.some(pattern => nameLower.includes(pattern))) {
      return "receita";
    }
    
    // Then check for faturamento
    if (faturamentoPatterns.some(pattern => nameLower.includes(pattern))) {
      return "faturamento";
    }
    
    return "other";
  };

  /**
   * Group monetary KPIs by category (faturamento vs receita vs other)
   */
  const groupMonetaryKpisByCategory = (kpis: KPI[]) => {
    const monetaryKpis = kpis.filter(k => k.kpi_type === "monetary");
    
    const groups: Record<"faturamento" | "receita" | "other", KPI[]> = {
      faturamento: [],
      receita: [],
      other: []
    };
    
    monetaryKpis.forEach(kpi => {
      const category = categorizeMonetaryKpi(kpi);
      groups[category].push(kpi);
    });
    
    return groups;
  };

  /**
   * Check if there are distinct monetary categories (faturamento AND receita)
   * If so, we should NOT sum them together
   */
  const hasDistinctMonetaryCategories = (kpis: KPI[]) => {
    const groups = groupMonetaryKpisByCategory(kpis);
    const categoriesWithKpis = Object.entries(groups)
      .filter(([, kpiList]) => kpiList.length > 0)
      .map(([category]) => category);
    
    // Return true if we have both faturamento AND receita (they shouldn't be summed)
    return categoriesWithKpis.includes("faturamento") && categoriesWithKpis.includes("receita");
  };

  /**
   * For revenue-focused widgets (Projeção do Mês, evolução diária e Target vs Realizado):
   * - With ANY org filter active (unit/team/sector/salesperson), we keep the "main goal first" behavior.
   * - With NO org filters active, users expect the total to be the SUM of all teams, so we aggregate
   *   all monetary KPIs instead of only the single main goal.
   * - NEW: If there are distinct categories (faturamento vs receita), DON'T sum them - return only main goals
   */
  const getRevenueKpisForContext = (filteredKpis: KPI[]) => {
    const hasAnyOrgFilter =
      selectedUnit !== "all" ||
      selectedTeam !== "all" ||
      selectedSector !== "all" ||
      selectedSalesperson !== "all";

    const monetaryKpis = filteredKpis.filter((k) => k.kpi_type === "monetary");
    
    // FALLBACK: If there are NO monetary KPIs at all, use the main goal KPI (even if numeric)
    // This ensures companies with only numeric KPIs still get projection cards
    if (monetaryKpis.length === 0) {
      const mainGoalKpis = filteredKpis.filter((k) => k.is_main_goal);
      return mainGoalKpis;
    }

    // When filtering by Sector (but not by a specific Team/Salesperson), users expect the
    // sector total to reflect the SUM of all teams inside that sector, not a single "main goal" KPI.
    if (
      selectedSector !== "all" &&
      selectedTeam === "all" &&
      selectedSalesperson === "all"
    ) {
      // But check if we have distinct categories - if so, prefer main goals
      if (hasDistinctMonetaryCategories(filteredKpis)) {
        const mainGoalKpis = filteredKpis.filter((k) => k.is_main_goal && k.kpi_type === "monetary");
        if (mainGoalKpis.length > 0) return mainGoalKpis;
      }
      return monetaryKpis;
    }

    if (!hasAnyOrgFilter) {
      // NEW: Check if there are distinct monetary categories (faturamento vs receita)
      // If so, DON'T sum them together - show main goals separately instead
      if (hasDistinctMonetaryCategories(filteredKpis)) {
        const mainGoalKpis = filteredKpis.filter((k) => k.is_main_goal && k.kpi_type === "monetary");
        if (mainGoalKpis.length > 0) return mainGoalKpis;
        // If no main goals, return all monetary but they'll be shown separately in the UI
      }
      return monetaryKpis;
    }

    const mainGoalKpis = filteredKpis.filter((k) => k.is_main_goal);
    return mainGoalKpis.length > 0 ? mainGoalKpis : monetaryKpis;
  };

  // Helper function to get targets based on current filter (unit, team, sector, or salesperson)
  const getFilteredTargetsForKpi = (kpiId: string): Record<string, number> => {
    // Find the KPI to check its scope and unit_id
    const kpi = kpis.find(k => k.id === kpiId);
    const unitScoped = isUnitScopedKpi(kpi);
    
    // Priority: salesperson > team > unit > company > sum of units/salespeople
    let relevantTargets: MonthlyTarget[] = [];
    
    if (selectedSalesperson !== "all") {
      // Get salesperson-specific targets
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.salesperson_id === selectedSalesperson
      );
    }
    
    if (relevantTargets.length === 0 && selectedTeam !== "all") {
      // Get team-specific targets
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.team_id === selectedTeam && mt.salesperson_id === null
      );
    }
    
    if (relevantTargets.length === 0 && selectedUnit !== "all") {
      // Get unit-specific targets
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id === selectedUnit && mt.team_id === null && mt.salesperson_id === null
      );
    }
    
    // For KPIs with unit scope, get targets for their specific unit
    if (relevantTargets.length === 0 && unitScoped && kpi?.unit_id) {
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id === kpi.unit_id && mt.team_id === null && mt.salesperson_id === null
      );
    }
    
    if (relevantTargets.length === 0) {
      // Try company-level targets first
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id === null && mt.team_id === null && mt.salesperson_id === null
      );
    }
    
    // If still no targets and we're showing "all", sum targets based on active filters
    // But skip this for unit-scoped KPIs - they should use their own target_value
    if (relevantTargets.length === 0 && selectedUnit === "all" && selectedTeam === "all" && selectedSalesperson === "all") {
      // Don't sum targets from other units for unit-scoped KPIs
      if (unitScoped) {
        // Return empty - will fall back to kpi.target_value
        return {};
      }
      
      // Sum all unit-level targets (or team-level if no unit targets)
      let targetsToSum = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id !== null && mt.team_id === null && mt.salesperson_id === null
      );
      
      // If no unit targets, try team targets
      if (targetsToSum.length === 0) {
        targetsToSum = allMonthlyTargets.filter(
          mt => mt.kpi_id === kpiId && mt.team_id !== null && mt.salesperson_id === null
        );
      }
      
      if (targetsToSum.length > 0) {
        // Sum targets by level_name
        const sumByLevel: Record<string, number> = {};
        targetsToSum.forEach(mt => {
          if (!sumByLevel[mt.level_name]) {
            sumByLevel[mt.level_name] = 0;
          }
          sumByLevel[mt.level_name] += mt.target_value;
        });
        return sumByLevel;
      }
    }
    
    // Build map from relevant targets
    const result: Record<string, number> = {};
    relevantTargets.forEach(mt => {
      result[mt.level_name] = mt.target_value;
    });
    
    return result;
  };

  // Get effective target value for a KPI based on filters
  const getEffectiveTargetForKpi = (kpi: KPI): number => {
    const filteredTargets = getFilteredTargetsForKpi(kpi.id);
    if (Object.keys(filteredTargets).length > 0) {
      return filteredTargets["Meta"] ?? Object.values(filteredTargets)[0];
    }
    return kpi.effective_target ?? kpi.target_value;
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (type === "percentage") {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString("pt-BR");
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4" />;
      case "percentage": return <Percent className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const salespeopleById = useMemo(() => {
    return new Map(salespeople.map((sp) => [sp.id, sp] as const));
  }, [salespeople]);

  const kpisById = useMemo(() => {
    return new Map(kpis.map((k) => [k.id, k] as const));
  }, [kpis]);

  // Build a map of sector_id -> team_ids for efficient lookup
  const teamIdsBySectorId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach(st => {
      if (!map[st.sector_id]) {
        map[st.sector_id] = new Set();
      }
      map[st.sector_id].add(st.team_id);
    });
    return map;
  }, [sectorTeams]);

  // Check if a salesperson belongs to a sector (directly or via team)
  const salespersonBelongsToSector = (sp: Salesperson, sectorId: string): boolean => {
    // Direct sector match
    if (sp.sector_id === sectorId) return true;
    // Check if salesperson's team is associated with the sector
    if (sp.team_id) {
      const teamsInSector = teamIdsBySectorId[sectorId];
      if (teamsInSector && teamsInSector.has(sp.team_id)) return true;
    }
    return false;
  };

  // Normalize entry dimensions because legacy kpi_entries may not have unit_id/team_id/sector_id filled.
  const getEntryDimensions = (e: Entry) => {
    const sp = salespeopleById.get(e.salesperson_id);
    const kpi = kpisById.get(e.kpi_id);

    return {
      unit_id: e.unit_id ?? sp?.unit_id ?? null,
      team_id: e.team_id ?? sp?.team_id ?? null,
      // sector is primarily tied to KPI; fallback to entry.sector_id if present
      sector_id: e.sector_id ?? kpi?.sector_id ?? sp?.sector_id ?? null,
      salesperson_id: e.salesperson_id,
    };
  };

  const matchesActiveFilters = (e: Entry) => {
    const d = getEntryDimensions(e);
    const sp = salespeopleById.get(e.salesperson_id);
    
    if (selectedUnit !== "all" && d.unit_id !== selectedUnit) return false;
    if (selectedTeam !== "all" && d.team_id !== selectedTeam) return false;
    
    // Sector filter: check if entry's sector matches OR if the salesperson belongs to the sector via team
    if (selectedSector !== "all") {
      const directMatch = d.sector_id === selectedSector;
      const viaSalesperson = sp ? salespersonBelongsToSector(sp, selectedSector) : false;
      if (!directMatch && !viaSalesperson) return false;
    }
    
    if (selectedSalesperson !== "all" && d.salesperson_id !== selectedSalesperson) return false;
    return true;
  };

  // Filter entries based on selected unit, team, sector, and salesperson
  const getFilteredEntries = () => entries.filter(matchesActiveFilters);

  // Filter KPIs based on selected filters and KPI scope
  // A KPI should only appear if its scope matches the active filter level
  const getFilteredKpis = () => {
    return kpis.filter(kpi => {
      const scope = kpi.scope || "company";
      
      // If filtering by salesperson, show:
      // - KPIs scoped to that specific salesperson
      // - KPIs scoped to company (shared across all)
      if (selectedSalesperson !== "all") {
        if (scope === "salesperson") {
          return kpi.salesperson_id === selectedSalesperson;
        }
        // Also show company-scoped KPIs when viewing a salesperson
        return scope === "company";
      }
      
      // If filtering by team, show:
      // - KPIs scoped to that specific team
      // - KPIs scoped to company (shared across all)
      if (selectedTeam !== "all") {
        if (scope === "team") {
          return kpi.team_id === selectedTeam;
        }
        // Also show company-scoped KPIs when viewing a team
        return scope === "company";
      }
      
      // If filtering by sector, show:
      // - KPIs scoped to that specific sector
      // - KPIs scoped to teams that belong to this sector
      // - KPIs scoped to salespeople that belong to teams in this sector
      // - KPIs scoped to company (shared across all)
      if (selectedSector !== "all") {
        if (scope === "sector") {
          return kpi.sector_id === selectedSector;
        }
        
        // Get all teams that belong to the selected sector
        const teamsInSector = teamIdsBySectorId[selectedSector];
        
        // Show team-scoped KPIs where the team belongs to the selected sector
        if (scope === "team" && kpi.team_id) {
          if (teamsInSector && teamsInSector.has(kpi.team_id)) {
            return true;
          }
        }
        
        // Show salesperson-scoped KPIs where the salesperson belongs to a team in this sector
        if (scope === "salesperson" && kpi.salesperson_id) {
          const sp = salespeople.find(s => s.id === kpi.salesperson_id);
          if (sp) {
            // Check if salesperson belongs to the sector (directly or via team)
            if (salespersonBelongsToSector(sp, selectedSector)) {
              return true;
            }
          }
        }
        
        // Also show company-scoped KPIs when viewing a sector
        return scope === "company";
      }
      
      // If filtering by unit only, show:
      // - KPIs scoped to company (all shared KPIs)
      // - KPIs scoped to that unit specifically (if unit_id matches)
      if (selectedUnit !== "all") {
        if (scope === "company") return true;
        // Show sector/team/salesperson KPIs that belong to this unit
        if (scope === "sector" && kpi.sector_id) {
          const sector = sectors.find(s => s.id === kpi.sector_id);
          return sector?.unit_id === selectedUnit;
        }
        if (scope === "team" && kpi.team_id) {
          const team = teams.find(t => t.id === kpi.team_id);
          return team?.unit_id === selectedUnit;
        }
        if (scope === "salesperson" && kpi.salesperson_id) {
          const sp = salespeople.find(s => s.id === kpi.salesperson_id);
          return sp?.unit_id === selectedUnit;
        }
        return kpi.unit_id === selectedUnit;
      }
      
      // No filters - show all KPIs
      return true;
    });
  };

  // Calculate KPI summaries
  const getKpiSummary = (kpi: KPI) => {
    const filteredEntries = getFilteredEntries();
    
    // For KPIs with unit scope and "all units" filter, filter entries by KPI's unit
    let kpiEntries: Entry[];
    if (isUnitScopedKpi(kpi) && selectedUnit === "all") {
      kpiEntries = entries.filter(e => {
        if (e.kpi_id !== kpi.id) return false;
        // Also filter by date range
        if (e.entry_date < dateRange.start || e.entry_date > dateRange.end) return false;
        const dims = getEntryDimensions(e);
        return dims.unit_id === kpi.unit_id;
      });
    } else {
      kpiEntries = filteredEntries.filter(e => e.kpi_id === kpi.id);
    }
    const total = kpiEntries.reduce((sum, e) => sum + e.value, 0);
    
    // Calculate target based on periodicity and date range
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Use filtered target based on selected unit/salesperson
    const baseTarget = getEffectiveTargetForKpi(kpi);
    let targetForPeriod = baseTarget;
    if (kpi.periodicity === "daily") {
      targetForPeriod = baseTarget * daysDiff;
    } else if (kpi.periodicity === "weekly") {
      targetForPeriod = baseTarget * Math.ceil(daysDiff / 7);
    }
    // For monthly, use single target

    const percentage = targetForPeriod > 0 ? (total / targetForPeriod) * 100 : 0;
    
    return { total, target: targetForPeriod, percentage };
  };

  // Calculate monthly projection
  const getMonthlyProjection = () => {
    const now = new Date();
    
    // Use the selected date range instead of always using current month
    const selectedStartDate = parseDateLocal(dateRange.start);
    const selectedEndDate = parseDateLocal(dateRange.end);
    
    // Calculate month parameters based on selected range
    const selectedMonth = selectedStartDate.getMonth();
    const selectedYear = selectedStartDate.getFullYear();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    // For time progress: if viewing current month, use current day; otherwise use full month
    const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
    const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
    const daysRemaining = isCurrentMonth ? daysInMonth - currentDay : 0;
    const timeProgress = currentDay / daysInMonth;

    // Use the entries already filtered by dateRange from the fetch
    // entries state already contains only entries within dateRange.start to dateRange.end
    const allMonthEntries = entries;
    const monthEntries = allMonthEntries.filter(matchesActiveFilters);

    // Sum entries and targets for main goal KPIs (or fallback to monetary KPIs)
    let totalRealized = 0;
    let totalTarget = 0;

    const filteredKpis = getFilteredKpis();
    
    const kpisForProjection = getRevenueKpisForContext(filteredKpis);
    const displayType = kpisForProjection[0]?.kpi_type ?? "monetary";
    
    // Check if we have distinct monetary categories (faturamento vs receita)
    // If so, we should NOT sum them in the consolidated view
    const hasDistinctCategories = hasDistinctMonetaryCategories(filteredKpis);
    const monetaryGroups = hasDistinctCategories ? groupMonetaryKpisByCategory(filteredKpis) : null;

    // Build individual projections for each KPI
    const individualProjections: Array<{
      kpi: KPI;
      realized: number;
      target: number;
      projectionPercent: number;
      projectedValue: number;
      category?: "faturamento" | "receita" | "other";
    }> = [];

    kpisForProjection.forEach(kpi => {
      // For KPIs with unit scope, filter entries by that specific unit (using normalized dimensions)
      // This ensures that when viewing "all units", each unit-scoped KPI still shows its own data
      let kpiEntries: Entry[];
      if (isUnitScopedKpi(kpi) && selectedUnit === "all") {
        // KPI is unit-scoped and we're viewing all units - filter entries by KPI's unit
        kpiEntries = allMonthEntries.filter(e => {
          if (e.kpi_id !== kpi.id) return false;
          const dims = getEntryDimensions(e);
          return dims.unit_id === kpi.unit_id;
        });
      } else {
        // Use normal filtering (monthEntries already filtered by active filters)
        kpiEntries = monthEntries.filter(e => e.kpi_id === kpi.id);
      }
      const kpiTotal = kpiEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Use filtered target based on selected unit/salesperson
      const baseTarget = getEffectiveTargetForKpi(kpi);
      let monthlyTarget = baseTarget;
      if (kpi.periodicity === "daily") {
        monthlyTarget = baseTarget * daysInMonth;
      } else if (kpi.periodicity === "weekly") {
        monthlyTarget = baseTarget * Math.ceil(daysInMonth / 7);
      }

      // Determine category for this KPI
      const category = kpi.kpi_type === "monetary" ? categorizeMonetaryKpi(kpi) : undefined;

      // Only sum to totals if we DON'T have distinct categories
      // OR if the KPI is a main goal (which means user explicitly wants it in the consolidated view)
      if (!hasDistinctCategories || kpi.is_main_goal) {
        totalRealized += kpiTotal;
        totalTarget += monthlyTarget;
      }

      // Store individual projection for:
      // 1. KPIs explicitly marked as main goal
      // 2. When we have distinct monetary categories (faturamento vs receita) - show each separately
      // Note: Always show individual cards when hasDistinctCategories, even if target is 0 (to show realized)
      const shouldShowIndividual = kpi.is_main_goal || 
        (hasDistinctCategories && kpi.kpi_type === "monetary" && (category === "faturamento" || category === "receita"));
      
      // Show card even without target (monthlyTarget === 0) when we have distinct categories
      // This ensures Faturamento and Receita are always visible
      if (shouldShowIndividual && (monthlyTarget > 0 || hasDistinctCategories)) {
        const kpiProjectionPercent = timeProgress > 0 && monthlyTarget > 0 
          ? ((kpiTotal / monthlyTarget) / timeProgress) * 100 
          : 0;
        const kpiProjectedValue = timeProgress > 0 ? kpiTotal / timeProgress : 0;
        individualProjections.push({
          kpi,
          realized: kpiTotal,
          target: monthlyTarget,
          projectionPercent: kpiProjectionPercent,
          projectedValue: kpiProjectedValue,
          category,
        });
      }
    });

    // If we have distinct categories but no main goals, we need to show a note about not consolidating
    const showDistinctCategoriesWarning = hasDistinctCategories && !kpisForProjection.some(k => k.is_main_goal);

    // Calculate projection: (realized / target) / time_progress * 100
    let projectionPercent = 0;
    if (totalTarget > 0 && timeProgress > 0) {
      projectionPercent = ((totalRealized / totalTarget) / timeProgress) * 100;
    }

    // Projected value at end of month
    const projectedValue = timeProgress > 0 ? totalRealized / timeProgress : 0;

    return {
      realized: totalRealized,
      target: totalTarget,
      projectionPercent,
      projectedValue,
      currentDay,
      daysInMonth,
      daysRemaining,
      timeProgress: timeProgress * 100,
      displayType,
      individualProjections, // Array of individual projections (main goals + distinct categories)
      hasMultipleMainGoals: individualProjections.length > 1,
      hasDistinctCategories,
      showDistinctCategoriesWarning,
    };
  };

  const projection = getMonthlyProjection();

  // Prepare chart data - Daily evolution - PRIORITIZE main goal KPIs, sum if multiple
  const getDailyChartData = () => {
    const filteredKpis = getFilteredKpis();
    
    const targetKpis = getRevenueKpisForContext(filteredKpis);
    
    // If a specific KPI is selected, use that instead
    const kpiIdsToUse = selectedKpi !== "all" 
      ? [selectedKpi] 
      : targetKpis.map(k => k.id);
    
    const filteredEntries = entries.filter(e => {
      if (!kpiIdsToUse.includes(e.kpi_id)) return false;
      const dims = getEntryDimensions(e);
      const sp = salespeopleById.get(e.salesperson_id);
      if (selectedSalesperson !== "all" && dims.salesperson_id !== selectedSalesperson) return false;
      if (selectedUnit !== "all" && dims.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && dims.team_id !== selectedTeam) return false;
      // Sector filter: check direct match OR via salesperson's team
      if (selectedSector !== "all") {
        const directMatch = dims.sector_id === selectedSector;
        const viaSalesperson = sp ? salespersonBelongsToSector(sp, selectedSector) : false;
        if (!directMatch && !viaSalesperson) return false;
      }
      return true;
    });

    const groupedByDate: Record<string, number> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByDate[entry.entry_date]) {
        groupedByDate[entry.entry_date] = 0;
      }
      groupedByDate[entry.entry_date] += entry.value;
    });

    return Object.entries(groupedByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        value,
      }));
  };

  // Get target vs realized chart data - PRIORITIZE main goal KPIs, fallback to monetary
  const getTargetVsRealizedData = () => {
    const filteredKpis = getFilteredKpis();
    
    const targetKpis = getRevenueKpisForContext(filteredKpis);
    const mainGoalKpis = filteredKpis.filter(k => k.is_main_goal);
    
    const targetKpiIds = targetKpis.map(k => k.id);
    
    // Filter entries to only include target KPIs and apply unit/team/salesperson filter
    const filteredEntries = entries.filter(e => {
      if (!targetKpiIds.includes(e.kpi_id)) return false;
      const dims = getEntryDimensions(e);
      const sp = salespeopleById.get(e.salesperson_id);
      if (selectedUnit !== "all" && dims.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && dims.team_id !== selectedTeam) return false;
      // Sector filter: check direct match OR via salesperson's team
      if (selectedSector !== "all") {
        const directMatch = dims.sector_id === selectedSector;
        const viaSalesperson = sp ? salespersonBelongsToSector(sp, selectedSector) : false;
        if (!directMatch && !viaSalesperson) return false;
      }
      if (selectedSalesperson !== "all" && dims.salesperson_id !== selectedSalesperson) return false;
      return true;
    });

    // Group entries by date
    const groupedByDate: Record<string, number> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByDate[entry.entry_date]) {
        groupedByDate[entry.entry_date] = 0;
      }
      groupedByDate[entry.entry_date] += entry.value;
    });

    // Sort dates
    const sortedDates = Object.keys(groupedByDate).sort();
    if (sortedDates.length === 0) return { data: [], targetLevels: [], kpiType: "monetary" };

    // Calculate target levels - aggregate all target KPI targets using filtered targets
    let targetLevelsMap: Record<string, number> = {};
    
    targetKpis.forEach(kpi => {
      // Get targets based on current unit/salesperson filter
      const filteredTargets = getFilteredTargetsForKpi(kpi.id);
      
      if (Object.keys(filteredTargets).length > 0) {
        Object.entries(filteredTargets).forEach(([levelName, value]) => {
          targetLevelsMap[levelName] = (targetLevelsMap[levelName] || 0) + value;
        });
      } else if (kpi.monthly_targets && Object.keys(kpi.monthly_targets).length > 0) {
        Object.entries(kpi.monthly_targets).forEach(([levelName, value]) => {
          targetLevelsMap[levelName] = (targetLevelsMap[levelName] || 0) + value;
        });
      } else {
        const baseTarget = kpi.effective_target ?? kpi.target_value;
        targetLevelsMap["Meta"] = (targetLevelsMap["Meta"] || 0) + baseTarget;
      }
    });

    const targetLevelNames = Object.keys(targetLevelsMap);
    const totalDays = sortedDates.length;

    // Determine KPI type for formatting
    const kpiType = targetKpis[0]?.kpi_type ?? (mainGoalKpis[0]?.kpi_type ?? "monetary");

    // Build cumulative chart data
    let cumulativeValue = 0;
    const chartData = sortedDates.map((date, index) => {
      cumulativeValue += groupedByDate[date];
      const dayProgress = (index + 1) / totalDays;

      const dataPoint: Record<string, any> = {
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        realizado: cumulativeValue,
      };

      // Add each target level as a line (proportional to progress)
      targetLevelNames.forEach(levelName => {
        dataPoint[levelName] = targetLevelsMap[levelName] * dayProgress;
      });

      return dataPoint;
    });

    return { data: chartData, targetLevels: targetLevelNames, kpiType };
  };

  // Prepare ranking data
  const getRankingData = () => {
    // Filter salespeople by all active filters
    const filteredSalespeople = salespeople.filter(sp => {
      if (selectedSalesperson !== "all" && sp.id !== selectedSalesperson) return false;
      if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
      // Sector filter: check if salesperson belongs to sector (directly or via team)
      if (selectedSector !== "all") {
        if (!salespersonBelongsToSector(sp, selectedSector)) return false;
      }
      return true;
    });
      
    const rankingMap: Record<string, { name: string; total: number }> = {};
    
    filteredSalespeople.forEach(sp => {
      rankingMap[sp.id] = { name: sp.name, total: 0 };
    });

    entries.forEach(entry => {
      if (selectedKpi !== "all" && entry.kpi_id !== selectedKpi) return;
      const dims = getEntryDimensions(entry);
      const sp = salespeopleById.get(entry.salesperson_id);
      if (selectedUnit !== "all" && dims.unit_id !== selectedUnit) return;
      if (selectedTeam !== "all" && dims.team_id !== selectedTeam) return;
      // Sector filter: check direct match OR via salesperson's team
      if (selectedSector !== "all") {
        const directMatch = dims.sector_id === selectedSector;
        const viaSalesperson = sp ? salespersonBelongsToSector(sp, selectedSector) : false;
        if (!directMatch && !viaSalesperson) return;
      }
      if (selectedSalesperson !== "all" && dims.salesperson_id !== selectedSalesperson) return;
      if (rankingMap[entry.salesperson_id]) {
        rankingMap[entry.salesperson_id].total += entry.value;
      }
    });

    return Object.values(rankingMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  };

  // Calculate derived metrics (conversion rate, average ticket, etc.)
  const getCalculatedMetrics = () => {
    const filteredEntries = getFilteredEntries();
    
    // Try to find relevant KPIs by common naming patterns
    const findKpiByPattern = (patterns: string[]) => {
      return kpis.find(kpi => 
        patterns.some(pattern => kpi.name.toLowerCase().includes(pattern.toLowerCase()))
      );
    };

    // Common KPI patterns - expanded to match more naming conventions
    const leadsKpi = findKpiByPattern(['lead', 'leads', 'oportunidade', 'oportunidades', 'contato', 'contatos']);
    const serviceKpi = findKpiByPattern(['atendimento', 'atendimentos']);
    const visitsKpi = findKpiByPattern(['visita', 'visitas']);
    const meetingsKpi = findKpiByPattern(['reunião', 'reuniao', 'reuniões', 'reunioes', 'call', 'calls', 'ligação', 'ligações']);
    const proposalsKpi = findKpiByPattern(['proposta', 'propostas', 'orçamento', 'orcamento', 'cotação', 'cotacao']);
    const salesKpi = findKpiByPattern(['venda', 'vendas', 'fechamento', 'fechamentos', 'qtd venda', 'quantidade venda']);
    const revenueKpi = kpis.find(k => k.kpi_type === 'monetary');

    // Calculate totals for each found KPI
    const getKpiTotal = (kpi: KPI | undefined) => {
      if (!kpi) return 0;
      return filteredEntries.filter(e => e.kpi_id === kpi.id).reduce((sum, e) => sum + e.value, 0);
    };

    const totalLeads = getKpiTotal(leadsKpi);
    const totalServices = getKpiTotal(serviceKpi);
    const totalVisits = getKpiTotal(visitsKpi);
    const totalMeetings = getKpiTotal(meetingsKpi);
    const totalProposals = getKpiTotal(proposalsKpi);
    const totalSales = getKpiTotal(salesKpi);
    const totalRevenue = getKpiTotal(revenueKpi);

    // Build conversion stages dynamically based on available data
    // Priority order: Leads → Atendimentos → Visitas/Reuniões → Propostas → Vendas
    const conversionStages: Array<{ name: string; value: number; kpiName: string | undefined }> = [];
    
    if (leadsKpi && totalLeads > 0) {
      conversionStages.push({ name: 'Leads', value: totalLeads, kpiName: leadsKpi.name });
    }
    if (serviceKpi && totalServices > 0) {
      conversionStages.push({ name: 'Atendimentos', value: totalServices, kpiName: serviceKpi.name });
    }
    if (visitsKpi && totalVisits > 0) {
      conversionStages.push({ name: 'Visitas', value: totalVisits, kpiName: visitsKpi.name });
    } else if (meetingsKpi && totalMeetings > 0) {
      conversionStages.push({ name: 'Reuniões', value: totalMeetings, kpiName: meetingsKpi.name });
    }
    if (proposalsKpi && totalProposals > 0) {
      conversionStages.push({ name: 'Propostas', value: totalProposals, kpiName: proposalsKpi.name });
    }
    if (salesKpi && totalSales > 0) {
      conversionStages.push({ name: 'Vendas', value: totalSales, kpiName: salesKpi.name });
    }

    // Calculate pairwise conversion rates
    const conversionRates: Array<{ from: string; to: string; rate: number; fromValue: number; toValue: number }> = [];
    for (let i = 0; i < conversionStages.length - 1; i++) {
      const from = conversionStages[i];
      const to = conversionStages[i + 1];
      if (from.value > 0) {
        conversionRates.push({
          from: from.name,
          to: to.name,
          rate: (to.value / from.value) * 100,
          fromValue: from.value,
          toValue: to.value,
        });
      }
    }

    // Calculate overall conversion (first stage to sales)
    const firstStage = conversionStages[0];
    const overallConversion = firstStage && firstStage.value > 0 && totalSales > 0
      ? (totalSales / firstStage.value) * 100
      : 0;

    // Legacy rates for backward compatibility
    const leadToProposal = totalLeads > 0 ? (totalProposals / totalLeads) * 100 : 0;
    const proposalToSale = totalProposals > 0 ? (totalSales / totalProposals) * 100 : 0;
    const leadToSale = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;

    // Calculate average ticket
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return {
      totalLeads,
      totalServices,
      totalVisits,
      totalMeetings,
      totalProposals,
      totalSales,
      totalRevenue,
      leadToProposal,
      proposalToSale,
      leadToSale,
      overallConversion,
      avgTicket,
      conversionStages,
      conversionRates,
      hasLeadsData: !!leadsKpi && totalLeads > 0,
      hasServicesData: !!serviceKpi && totalServices > 0,
      hasVisitsData: !!visitsKpi && totalVisits > 0,
      hasMeetingsData: !!meetingsKpi && totalMeetings > 0,
      hasProposalsData: !!proposalsKpi && totalProposals > 0,
      hasSalesData: !!salesKpi && totalSales > 0,
      hasRevenueData: !!revenueKpi && totalRevenue > 0,
      hasAnyConversionData: conversionStages.length >= 2,
    };
  };

  // Build dynamic sales funnel based on available KPIs
  const getSalesFunnelData = () => {
    const filteredEntries = getFilteredEntries();
    
    // Pattern matching for common funnel stages - ordered by typical funnel position
    const funnelPatterns = [
      { patterns: ['prospecção', 'prospeccao', 'prospecting', 'cold call', 'abordagem'], label: 'Prospecção', order: 1 },
      { patterns: ['lead', 'leads', 'oportunidade', 'oportunidades', 'contato', 'contatos'], label: 'Leads', order: 2 },
      { patterns: ['ligação', 'ligacao', 'ligações', 'ligacoes', 'call', 'calls', 'telefone'], label: 'Ligações', order: 3 },
      { patterns: ['atendimento', 'atendimentos'], label: 'Atendimentos', order: 4 },
      { patterns: ['reunião', 'reuniao', 'reuniões', 'reunioes', 'meeting', 'meetings', 'visita', 'visitas'], label: 'Reuniões/Visitas', order: 5 },
      { patterns: ['proposta', 'propostas', 'orçamento', 'orcamento', 'cotação', 'cotacao'], label: 'Propostas', order: 6 },
      { patterns: ['negociação', 'negociacao', 'follow', 'followup', 'follow-up'], label: 'Negociação', order: 7 },
      { patterns: ['venda', 'vendas', 'fechamento', 'fechamentos', 'closed', 'won', 'ganho'], label: 'Vendas', order: 8 },
    ];

    // Find which KPIs match each funnel stage
    const matchedStages: Array<{ label: string; order: number; value: number; kpiName: string }> = [];

    funnelPatterns.forEach(stage => {
      const matchingKpi = kpis.find(kpi => 
        stage.patterns.some(pattern => kpi.name.toLowerCase().includes(pattern.toLowerCase()))
      );
      
      if (matchingKpi) {
        const total = filteredEntries
          .filter(e => e.kpi_id === matchingKpi.id)
          .reduce((sum, e) => sum + e.value, 0);
        
        if (total > 0) {
          matchedStages.push({
            label: stage.label,
            order: stage.order,
            value: total,
            kpiName: matchingKpi.name,
          });
        }
      }
    });

    // Sort by order and ensure we have at least 2 stages for a funnel
    const sortedStages = matchedStages.sort((a, b) => a.order - b.order);
    
    if (sortedStages.length < 2) return { data: [], hasData: false };

    // Calculate conversion rates between stages
    const funnelData = sortedStages.map((stage, index) => {
      const prevValue = index > 0 ? sortedStages[index - 1].value : stage.value;
      const conversionRate = prevValue > 0 ? (stage.value / prevValue) * 100 : 0;
      
      return {
        name: stage.label,
        value: stage.value,
        fill: `hsl(${220 - (index * 25)} 70% ${55 + (index * 5)}%)`,
        conversionRate: index > 0 ? conversionRate : 100,
        kpiName: stage.kpiName,
      };
    });

    // Calculate overall conversion (first to last)
    const overallConversion = sortedStages.length >= 2 && sortedStages[0].value > 0
      ? (sortedStages[sortedStages.length - 1].value / sortedStages[0].value) * 100
      : 0;

    return { data: funnelData, hasData: true, overallConversion };
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  if (kpis.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Nenhum KPI configurado ainda.</p>
          <p className="text-sm">Configure KPIs para visualizar o dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  const dailyData = getDailyChartData();
  const rankingData = getRankingData();
  const targetVsRealized = getTargetVsRealizedData();
  const salesFunnel = getSalesFunnelData();
  const selectedKpiData = selectedKpi !== "all" ? kpis.find(k => k.id === selectedKpi) : null;
  const calculatedMetrics = getCalculatedMetrics();

  // Debug logs
  console.log("[KPIDashboard] Target vs Realized:", { 
    dataLength: targetVsRealized.data.length, 
    targetLevels: targetVsRealized.targetLevels,
    entries: entries.length 
  });
  console.log("[KPIDashboard] Sales Funnel:", { 
    hasData: salesFunnel.hasData, 
    dataLength: salesFunnel.data?.length || 0,
    data: salesFunnel.data 
  });

  // Colors for target level lines
  const targetLevelColors = [
    "hsl(142 76% 36%)", // green
    "hsl(38 92% 50%)",  // amber
    "hsl(280 65% 60%)", // purple
    "hsl(199 89% 48%)", // blue
    "hsl(0 84% 60%)",   // red
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4">
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">Data Inicial</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  // Only update if value is a valid date string (not empty)
                  if (e.target.value) {
                    setDateRange({ ...dateRange, start: e.target.value });
                  }
                }}
                className="h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">Data Final</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  // Only update if value is a valid date string (not empty)
                  if (e.target.value) {
                    setDateRange({ ...dateRange, end: e.target.value });
                  }
                }}
                className="h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            <div className="col-span-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyMonthRange(0)}
              >
                Mês atual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyMonthRange(1)}
              >
                Mês anterior
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">KPI</Label>
              <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                <SelectTrigger className="w-full sm:w-[180px] h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">Todos os KPIs</SelectItem>
                  {kpis.map(kpi => (
                    <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {units.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Unidade</Label>
                <Select value={selectedUnit} onValueChange={(value) => {
                  setSelectedUnit(value);
                  // Reset dependent filters when unit changes
                  setSelectedTeam("all");
                  setSelectedSector("all");
                  setSelectedSalesperson("all");
                }}>
                  <SelectTrigger className="w-full sm:w-[180px] h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="all">Todas</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>
            )}
            {sectors.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Setor</Label>
                <Select value={selectedSector} onValueChange={(value) => {
                  setSelectedSector(value);
                  // Reset team and salesperson when sector changes
                  setSelectedTeam("all");
                  setSelectedSalesperson("all");
                }}>
                  <SelectTrigger className="w-full sm:w-[180px] h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="all">Todos</SelectItem>
                    {sectors
                      .filter(s => selectedUnit === "all" || s.unit_id === selectedUnit || s.unit_id === null)
                      .map(sector => (
                        <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {teams.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Equipe</Label>
                <Select value={selectedTeam} onValueChange={(value) => {
                  setSelectedTeam(value);
                  // Reset salesperson when team changes
                  if (value !== "all") {
                    setSelectedSalesperson("all");
                  }
                }}>
                  <SelectTrigger className="w-full sm:w-[180px] h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="all">Todas</SelectItem>
                    {teams
                      .filter(t => {
                        if (selectedUnit !== "all" && t.unit_id !== selectedUnit && t.unit_id !== null) return false;
                        if (selectedSector !== "all") {
                          // Filter teams that belong to the selected sector
                          const teamsInSector = sectorTeams.filter(st => st.sector_id === selectedSector).map(st => st.team_id);
                          if (!teamsInSector.includes(t.id)) return false;
                        }
                        return true;
                      })
                      .map(team => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">Vendedor</Label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger className="w-full sm:w-[180px] h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">Todos</SelectItem>
                  {salespeople
                    .filter(sp => {
                      if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
                      if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
                      return true;
                    })
                    .map(sp => (
                      <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end gap-2 flex-wrap">
              {/* Personalized entry link for salespeople */}
              {salespersonId && salespersonAccessCode && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const link = `${getPublicBaseUrl()}/#/kpi-entry/${companyId}?code=${salespersonAccessCode}`;
                    window.open(link, '_blank');
                  }}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Lançar Vendas
                </Button>
              )}
              {/* Only show sales history if not filtering by salesperson (company-wide data) */}
              {!salespersonId && (
                <SalesHistoryDialog 
                  companyId={companyId} 
                  contractStartDate={contractStartDate}
                  onDataChange={() => setSalesHistoryRefreshKey(prev => prev + 1)}
                  canEdit={canEditSalesHistory}
                />
              )}
              <KPIEntriesHistoryDialog 
                companyId={companyId}
                canDelete={canDeleteEntries}
                canEdit={canEditSalesHistory}
                onEntryDeleted={fetchData}
                salespersonId={salespersonId || undefined}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Projection Card - Shows individual main goals when there are multiple */}
      {(projection.target > 0 || projection.hasDistinctCategories) && (
        <div className="space-y-4">
          {/* Warning when we have distinct categories (faturamento vs receita) that shouldn't be summed */}
          {projection.showDistinctCategoriesWarning && projection.individualProjections.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                ⚠️ Esta empresa possui KPIs de <strong>Faturamento</strong> e <strong>Receita</strong> separados. 
                Eles são exibidos individualmente abaixo pois representam métricas distintas: 
                Faturamento = contratos fechados, Receita = dinheiro que entrou no caixa.
              </p>
            </div>
          )}
          
          {/* Main consolidated projection card - only show if we DON'T have distinct categories warning */}
          {!projection.showDistinctCategoriesWarning && projection.target > 0 && (
            <Card className={`border-2 ${
              projection.projectionPercent >= 100 ? 'border-green-500 bg-green-500/5' :
              projection.projectionPercent >= 70 ? 'border-amber-500 bg-amber-500/5' :
              'border-destructive bg-destructive/5'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {projection.hasMultipleMainGoals ? 'Projeção Consolidada do Mês' : 'Projeção do Mês'}
                  </CardTitle>
                  <Badge variant="outline" className="gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Dia {projection.currentDay} de {projection.daysInMonth} ({projection.daysRemaining} restantes)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Realizado</p>
                    <p className="text-2xl font-bold">{formatValue(projection.realized, projection.displayType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Meta do Mês</p>
                    <p className="text-2xl font-bold">{formatValue(projection.target, projection.displayType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Projetado</p>
                    <p className="text-2xl font-bold">{formatValue(projection.projectedValue, projection.displayType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Projeção</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-2xl font-bold ${
                        projection.projectionPercent >= 100 ? 'text-green-600' :
                        projection.projectionPercent >= 70 ? 'text-amber-600' :
                        'text-destructive'
                      }`}>
                        {projection.projectionPercent.toFixed(0)}%
                      </p>
                      {projection.projectionPercent >= 100 ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso do mês: {projection.timeProgress.toFixed(0)}%</span>
                    <span>Atingimento: {projection.target > 0 ? ((projection.realized / projection.target) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 relative">
                    <div 
                      className="absolute h-full w-0.5 bg-foreground/50 z-10"
                      style={{ left: `${Math.min(projection.timeProgress, 100)}%` }}
                    />
                    <div
                      className={`h-3 rounded-full transition-all ${
                        projection.projectionPercent >= 100 ? 'bg-green-500' :
                        projection.projectionPercent >= 70 ? 'bg-amber-500' :
                        'bg-destructive'
                      }`}
                      style={{ width: `${Math.min((projection.realized / projection.target) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {projection.projectionPercent >= 100 
                      ? "✅ A empresa está no ritmo para bater a meta!"
                      : projection.projectionPercent >= 70
                      ? "⚠️ Atenção: a projeção está abaixo da meta esperada"
                      : "🚨 Alerta: a empresa está bem abaixo do ritmo necessário"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show individual projection cards when:
               1. There are multiple main goals (hasMultipleMainGoals)
               2. OR there are distinct categories (faturamento vs receita) that need separate display */}
          {(projection.hasMultipleMainGoals || (projection.hasDistinctCategories && projection.individualProjections.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              {projection.individualProjections.map((proj) => {
                const getScopeLabel = (kpi: KPI) => {
                  if (kpi.scope === 'sector' && kpi.sector_id) {
                    const sector = sectors.find(s => s.id === kpi.sector_id);
                    return sector ? `Setor: ${sector.name}` : 'Setor';
                  }
                  if (kpi.scope === 'team' && kpi.team_id) {
                    const team = teams.find(t => t.id === kpi.team_id);
                    return team ? `Equipe: ${team.name}` : 'Equipe';
                  }
                  if (kpi.unit_id) {
                    const unit = units.find(u => u.id === kpi.unit_id);
                    return unit ? `Unidade: ${unit.name}` : 'Unidade';
                  }
                  return 'Empresa';
                };

                // Get category label for monetary KPIs
                const getCategoryLabel = (category?: "faturamento" | "receita" | "other") => {
                  switch (category) {
                    case "faturamento":
                      return "💰 Faturamento";
                    case "receita":
                      return "💵 Receita";
                    default:
                      return null;
                  }
                };

                const categoryLabel = getCategoryLabel(proj.category);

                return (
                  <Card 
                    key={proj.kpi.id}
                    className={`border-2 ${
                      proj.projectionPercent >= 100 ? 'border-green-500 bg-green-500/5' :
                      proj.projectionPercent >= 70 ? 'border-amber-500 bg-amber-500/5' :
                      'border-destructive bg-destructive/5'
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            {proj.kpi.name}
                          </CardTitle>
                          <div className="flex gap-1 flex-wrap">
                            {categoryLabel && (
                              <Badge 
                                variant="outline" 
                                className={`w-fit text-xs ${
                                  proj.category === "faturamento" 
                                    ? "border-blue-500 text-blue-700 dark:text-blue-400" 
                                    : "border-green-500 text-green-700 dark:text-green-400"
                                }`}
                              >
                                {categoryLabel}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="w-fit text-xs">
                              {getScopeLabel(proj.kpi)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-2xl font-bold ${
                            proj.projectionPercent >= 100 ? 'text-green-600' :
                            proj.projectionPercent >= 70 ? 'text-amber-600' :
                            'text-destructive'
                          }`}>
                            {proj.projectionPercent.toFixed(0)}%
                          </p>
                          {proj.projectionPercent >= 100 ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-destructive" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Realizado</p>
                          <p className="font-semibold">{formatValue(proj.realized, proj.kpi.kpi_type)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Meta</p>
                          <p className="font-semibold">{formatValue(proj.target, proj.kpi.kpi_type)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Projetado</p>
                          <p className="font-semibold">{formatValue(proj.projectedValue, proj.kpi.kpi_type)}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2 relative">
                          <div 
                            className="absolute h-full w-0.5 bg-foreground/50 z-10"
                            style={{ left: `${Math.min(projection.timeProgress, 100)}%` }}
                          />
                          <div
                            className={`h-2 rounded-full transition-all ${
                              proj.projectionPercent >= 100 ? 'bg-green-500' :
                              proj.projectionPercent >= 70 ? 'bg-amber-500' :
                              'bg-destructive'
                            }`}
                            style={{ width: `${Math.min((proj.realized / proj.target) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Daily Goal Card */}
      <DailyGoalCard
        companyId={companyId}
        kpis={kpis}
        salespeople={salespeople}
        entries={entries.map(e => ({
          id: e.id,
          kpi_id: e.kpi_id,
          salesperson_id: e.salesperson_id,
          entry_date: e.entry_date,
          value: e.value,
        }))}
        allMonthlyTargets={allMonthlyTargets}
        dateRange={dateRange}
        selectedUnit={selectedUnit}
        selectedTeam={selectedTeam}
        selectedSector={selectedSector}
        selectedSalesperson={selectedSalesperson}
        sectorTeams={sectorTeams}
      />

      {/* Salespeople Comparison Table */}
      <SalespeopleComparisonTable
        kpis={kpis}
        salespeople={salespeople}
        entries={entries}
        units={units}
        teams={teams}
        sectors={sectors}
        sectorTeams={sectorTeams}
        selectedUnit={selectedUnit}
        selectedTeam={selectedTeam}
        selectedSector={selectedSector}
        selectedSalesperson={selectedSalesperson}
      />

      {/* Performance Comparison Card - Compare by units, sectors, teams, or salespeople */}
      {(teams.length > 1 || units.length > 1 || sectors.length > 1 || salespeople.length > 1) && (
        <PerformanceComparisonCard
          teams={teams}
          units={units}
          sectors={sectors}
          salespeople={salespeople.map(sp => ({
            id: sp.id,
            name: sp.name,
            is_active: sp.is_active,
            team_id: sp.team_id,
            unit_id: sp.unit_id,
            sector_id: sp.sector_id,
          }))}
          kpis={kpis.map(k => ({
            id: k.id,
            name: k.name,
            kpi_type: k.kpi_type,
            target_value: k.target_value,
            effective_target: k.effective_target,
            team_id: k.team_id,
            unit_id: k.unit_id,
            sector_id: k.sector_id,
            salesperson_id: k.salesperson_id,
            is_main_goal: k.is_main_goal,
            scope: k.scope,
          }))}
          entries={entries.map(e => ({
            id: e.id,
            kpi_id: e.kpi_id,
            salesperson_id: e.salesperson_id,
            entry_date: e.entry_date,
            value: e.value,
          }))}
          sectorTeams={sectorTeams}
          teamUnits={teamUnits}
          selectedUnit={selectedUnit}
          selectedSector={selectedSector}
          selectedTeam={selectedTeam}
          monthStart={format(startOfMonth(new Date()), "yyyy-MM-dd")}
          monthEnd={format(endOfMonth(new Date()), "yyyy-MM-dd")}
        />
      )}

      <MonthlySalesChart 
        companyId={companyId}
        projectId={projectId}
        salespeople={salespeople.map(sp => ({
          id: sp.id,
          team_id: sp.team_id,
          sector_id: sp.sector_id,
          unit_id: sp.unit_id,
        }))}
        sectorTeams={sectorTeams}
        selectedUnit={selectedUnit}
        selectedTeam={selectedTeam}
        selectedSector={selectedSector}
        selectedSalesperson={selectedSalesperson}
      />

      {/* Term Vision Card - QTR/YTD/MAT */}
      <ProjectTermVisionCard
        companyId={companyId}
        projectId={projectId}
        selectedSalesperson={selectedSalesperson}
        selectedUnit={selectedUnit}
        selectedTeam={selectedTeam}
        selectedSector={selectedSector}
      />

      {/* Sales Comparison Chart - Before vs After UNV */}
      <SalesComparisonChart 
        companyId={companyId}
        projectId={projectId}
        contractStartDate={contractStartDate}
        currentMonthRevenue={calculatedMetrics.totalRevenue}
        refreshKey={salesHistoryRefreshKey}
      />

      {/* CAC Calculator Card */}
      {projectId && (
        <CACCalculatorCard projectId={projectId} />
      )}

      {/* Conversion Card - Detailed */}
      {calculatedMetrics.hasAnyConversionData && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxas de Conversão</CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {/* Overall conversion */}
            {calculatedMetrics.overallConversion > 0 && (
              <div className="mb-4">
                <div className={`text-2xl font-bold ${
                  calculatedMetrics.overallConversion >= 20 ? 'text-green-600' :
                  calculatedMetrics.overallConversion >= 10 ? 'text-amber-600' :
                  'text-destructive'
                }`}>
                  {calculatedMetrics.overallConversion.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Conversão Geral ({calculatedMetrics.conversionStages[0]?.name} → Vendas)
                </p>
              </div>
            )}
            
            {/* Stage-by-stage conversions */}
            <div className="space-y-2">
              {calculatedMetrics.conversionRates.map((conv, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-background/60">
                  <div className="text-xs">
                    <span className="font-medium">{conv.from}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="font-medium">{conv.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {conv.toValue.toLocaleString('pt-BR')}/{conv.fromValue.toLocaleString('pt-BR')}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        conv.rate >= 50 ? 'border-green-500 text-green-600' :
                        conv.rate >= 20 ? 'border-amber-500 text-amber-600' :
                        'border-destructive text-destructive'
                      }`}
                    >
                      {conv.rate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Average ticket if available */}
            {calculatedMetrics.hasRevenueData && calculatedMetrics.hasSalesData && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ticket Médio</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculatedMetrics.avgTicket)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Average Ticket Card */}
      {calculatedMetrics.hasRevenueData && calculatedMetrics.hasSalesData && calculatedMetrics.totalSales > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculatedMetrics.avgTicket)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Faturamento ÷ Quantidade de Vendas
            </p>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Faturamento Total</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculatedMetrics.totalRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Qtd. Vendas</span>
                <span className="font-medium">{calculatedMetrics.totalSales.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Goal Achievement Card */}
      {kpis.length > 0 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atingimento de Metas</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {(() => {
              // Calculate overall achievement across all KPIs
              let totalRealized = 0;
              let totalTarget = 0;
              const kpiDetails: Array<{ name: string; percentage: number; achieved: boolean }> = [];
              
              kpis.forEach(kpi => {
                const summary = getKpiSummary(kpi);
                if (summary.target > 0) {
                  totalRealized += summary.total;
                  totalTarget += summary.target;
                  kpiDetails.push({
                    name: kpi.name,
                    percentage: summary.percentage,
                    achieved: summary.percentage >= 100,
                  });
                }
              });
              
              const overallPercentage = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;
              const achievedCount = kpiDetails.filter(k => k.achieved).length;
              
              return (
                <>
                  <div className={`text-3xl font-bold ${
                    overallPercentage >= 100 ? 'text-green-600' :
                    overallPercentage >= 70 ? 'text-amber-600' :
                    'text-destructive'
                  }`}>
                    {overallPercentage.toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {achievedCount} de {kpiDetails.length} metas batidas
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2 mt-3">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        overallPercentage >= 100 ? 'bg-green-500' :
                        overallPercentage >= 70 ? 'bg-amber-500' :
                        'bg-destructive'
                      }`}
                      style={{ width: `${Math.min(overallPercentage, 100)}%` }}
                    />
                  </div>
                  
                  {/* Individual KPI mini breakdown */}
                  <div className="mt-3 space-y-1">
                    {kpiDetails.slice(0, 4).map((kpi, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[60%]">{kpi.name}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1.5 py-0 ${
                            kpi.achieved ? 'border-green-500 text-green-600' :
                            kpi.percentage >= 70 ? 'border-amber-500 text-amber-600' :
                            'border-destructive text-destructive'
                          }`}
                        >
                          {kpi.percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                    {kpiDetails.length > 4 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        +{kpiDetails.length - 4} KPIs
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.slice(0, 4).map(kpi => {
          const summary = getKpiSummary(kpi);
          const isOnTrack = summary.percentage >= 100;
          const hasMultipleTargets = kpi.monthly_targets && Object.keys(kpi.monthly_targets).length > 1;
          
          return (
            <Card key={kpi.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                {getKpiIcon(kpi.kpi_type)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatValue(summary.total, kpi.kpi_type)}</div>
                
                {/* Multiple targets display */}
                {hasMultipleTargets ? (
                  <div className="space-y-1 mt-2">
                    {Object.entries(kpi.monthly_targets!).map(([levelName, targetValue]) => {
                      const periodTarget = kpi.periodicity === "daily" 
                        ? targetValue * (Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                        : kpi.periodicity === "weekly"
                        ? targetValue * Math.ceil((Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1) / 7)
                        : targetValue;
                      const percentage = periodTarget > 0 ? (summary.total / periodTarget) * 100 : 0;
                      const achieved = percentage >= 100;
                      
                      return (
                        <div key={levelName} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {levelName}: {formatValue(periodTarget, kpi.kpi_type)}
                          </span>
                          <Badge 
                            variant={achieved ? "default" : "outline"} 
                            className={`gap-0.5 text-[10px] px-1.5 py-0 ${achieved ? 'bg-green-500' : ''}`}
                          >
                            {achieved && <Check className="h-2.5 w-2.5" />}
                            {percentage.toFixed(0)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      Meta: {formatValue(summary.target, kpi.kpi_type)}
                    </span>
                    <Badge variant={isOnTrack ? "default" : "destructive"} className="gap-1">
                      {isOnTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {summary.percentage.toFixed(0)}%
                    </Badge>
                  </div>
                )}
                
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${isOnTrack ? 'bg-green-500' : 'bg-destructive'}`}
                    style={{ width: `${Math.min(summary.percentage, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sales Funnel Chart - Always show */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Funil de Vendas
            </CardTitle>
            {salesFunnel.hasData && salesFunnel.overallConversion !== undefined && (
              <Badge variant="outline" className="gap-1">
                Conversão Geral: {salesFunnel.overallConversion.toFixed(1)}%
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {salesFunnel.hasData ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Funnel Chart */}
              <ResponsiveContainer width="100%" height={300}>
                <FunnelChart>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString("pt-BR")} (${props.payload.conversionRate.toFixed(1)}%)`,
                      props.payload.kpiName || name
                    ]}
                  />
                  <Funnel
                    dataKey="value"
                    data={salesFunnel.data}
                    isAnimationActive
                  >
                    {salesFunnel.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList 
                      position="right" 
                      dataKey="name" 
                      fill="#666" 
                      stroke="none"
                    />
                    <LabelList 
                      position="center" 
                      dataKey="value" 
                      fill="#fff" 
                      stroke="none"
                      formatter={(value: number) => value.toLocaleString("pt-BR")}
                    />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
              
              {/* Conversion Rates Detail */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Taxas de Conversão</h4>
                {salesFunnel.data.map((stage, index) => (
                  <div key={stage.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.fill }}
                      />
                      <div>
                        <p className="font-medium text-sm">{stage.name}</p>
                        <p className="text-xs text-muted-foreground">{stage.kpiName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{stage.value.toLocaleString("pt-BR")}</p>
                      {index > 0 && (
                        <p className={`text-xs ${
                          stage.conversionRate >= 50 ? 'text-green-600' :
                          stage.conversionRate >= 20 ? 'text-amber-600' :
                          'text-destructive'
                        }`}>
                          {stage.conversionRate.toFixed(1)}% do anterior
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
              <Filter className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">Nenhum dado para o funil no período</p>
              <p className="text-sm">Lance KPIs como Ligações, Atendimentos, Propostas e Vendas para visualizar o funil</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target vs Realized Chart - Prioritizes Main Goal KPIs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Meta x Realizado
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              {targetVsRealized.kpiType === "monetary" ? (
                <>
                  <DollarSign className="h-3 w-3" />
                  Faturamento
                </>
              ) : targetVsRealized.kpiType === "percentage" ? (
                <>
                  <Percent className="h-3 w-3" />
                  Percentual
                </>
              ) : (
                <>
                  <Hash className="h-3 w-3" />
                  Quantidade
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {targetVsRealized.data.length > 0 && targetVsRealized.targetLevels.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={targetVsRealized.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  tickFormatter={(value) => 
                    targetVsRealized.kpiType === "monetary" 
                      ? new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(value)
                      : targetVsRealized.kpiType === "percentage"
                        ? `${value.toFixed(0)}%`
                        : value.toLocaleString("pt-BR")
                  }
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatValue(value, targetVsRealized.kpiType || "monetary"),
                    name === "realizado" ? "Realizado" : name
                  ]}
                />
                <Legend />
                {/* Realized line */}
                <Line 
                  type="monotone" 
                  dataKey="realizado" 
                  name="Realizado"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
                {/* Target level lines */}
                {targetVsRealized.targetLevels.map((levelName, index) => (
                  <Line 
                    key={levelName}
                    type="monotone" 
                    dataKey={levelName} 
                    name={levelName}
                    stroke={targetLevelColors[index % targetLevelColors.length]} 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
              <Target className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">Nenhum dado para o período selecionado</p>
              <p className="text-sm">Lance valores nos KPIs para comparar com as metas</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Diária</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [
                      selectedKpiData ? formatValue(value, selectedKpiData.kpi_type) : value.toLocaleString("pt-BR"),
                      "Valor"
                    ]}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingData.length > 0 && rankingData.some(r => r.total > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip 
                    formatter={(value: number) => [
                      selectedKpiData ? formatValue(value, selectedKpiData.kpi_type) : value.toLocaleString("pt-BR"),
                      "Total"
                    ]}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por KPI</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">% Atingimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map(kpi => {
                const summary = getKpiSummary(kpi);
                const isOnTrack = summary.percentage >= 100;
                
                return (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium">{kpi.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {getKpiIcon(kpi.kpi_type)}
                        {kpi.is_individual ? "Individual" : "Coletivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatValue(summary.total, kpi.kpi_type)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatValue(summary.target, kpi.kpi_type)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {summary.percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOnTrack ? "default" : summary.percentage >= 80 ? "secondary" : "destructive"}>
                        {isOnTrack ? "Meta Batida" : summary.percentage >= 80 ? "Próximo" : "Abaixo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Endomarketing Campaigns Widget */}
      {projectId && (
        <CampaignDashboardWidget companyId={companyId} projectId={projectId} />
      )}

      {/* Gamification Widget */}
      {projectId && (
        <GamificationDashboardWidget companyId={companyId} projectId={projectId} />
      )}
    </div>
  );
};
