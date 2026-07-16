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
import { TrendingUp, TrendingDown, Target, Users, DollarSign, Percent, Hash, CalendarDays, Building2, Check, Filter, UsersRound, Layers, ExternalLink, ChevronDown, Settings2, Eye, EyeOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { parseDateLocal } from "@/lib/dateUtils";
import { isHoliday } from "@/lib/businessDays";
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
import { NorthStarMetricCard } from "./NorthStarMetricCard";
import { SalesHeatmapCharts } from "./SalesHeatmapCharts";
import { RankingPodium } from "./RankingPodium";
import { UnitRankingCard } from "./UnitRankingCard";
import { PeriodComparisonCard } from "./PeriodComparisonCard";
import { SalespersonFlagsPanel } from "./SalespersonFlagsPanel";
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
  scope?: "company" | "unit" | "sector" | "team" | "salesperson" | null;
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
  isClientView?: boolean;
  isSalespersonView?: boolean; // true only for the vendedor portal — hides NSM, ranking, comparativo, AI
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

const KPI_WIDGETS = [
  { id: "nsm",                 label: "North Star Metric",             description: "Meta principal de faturamento mensal" },
  { id: "projection",          label: "Projeção do Mês",               description: "Card de progresso em relação à meta" },
  { id: "period_comparison",   label: "Comparação de Período",         description: "Compara períodos diferentes" },
  { id: "daily_goal",          label: "Meta Diária de Vendas / Ranking", description: "Meta diária de vendas e ranking de vendedores" },
  { id: "salespeople_table",   label: "Comparativo de Vendedores",     description: "Tabela comparativa detalhada entre vendedores" },
  { id: "performance",         label: "Comparação de Performance",     description: "Performance por unidade, setor ou equipe" },
  { id: "monthly_chart",       label: "Gráfico de Vendas Mensais",     description: "Evolução mensal dos KPIs" },
  { id: "term_vision",         label: "Visão de Curto, Médio e Longo Prazo", description: "Visão acumulada QTR / YTD / MAT" },
  { id: "before_after",        label: "Antes vs Depois UNV",           description: "Comparação de resultados antes e depois" },
  { id: "cac",                 label: "Calculadora CAC",               description: "Custo de aquisição de clientes" },
  { id: "conversion",          label: "Taxa de Conversão",             description: "Funil de conversão detalhado" },
  { id: "sales_funnel",        label: "Funil de Vendas",               description: "Conversão entre etapas do processo comercial" },
  { id: "target_vs_realized",  label: "Meta x Realizado",              description: "Gráfico de meta versus realizado no período" },
  { id: "daily_evolution",     label: "Evolução Diária / Ranking",     description: "Evolução diária dos KPIs e ranking de vendedores" },
  { id: "sales_heatmap",       label: "Vendas por Dia (Semana e Mês)", description: "Vendas por dia da semana e por dia do mês" },
  { id: "avg_ticket",          label: "Ticket Médio",                  description: "Ticket médio por venda" },
  { id: "endomarketing",       label: "Endomarketing",                 description: "Campanhas internas" },
  { id: "gamification",        label: "Gamificação",                   description: "Pontuação e conquistas" },
];

type WidgetId = typeof KPI_WIDGETS[number]["id"];

const DEFAULT_WIDGET_CONFIG: Record<WidgetId, boolean> = Object.fromEntries(
  KPI_WIDGETS.map(w => [w.id, true])
) as Record<WidgetId, boolean>;

export const KPIDashboardTab = ({
  companyId,
  projectId,
  canDeleteEntries = false,
  canEditSalesHistory = false,
  salespersonId,
  isClientView = false,
  isSalespersonView = false,
}: KPIDashboardTabProps) => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [allEntriesForRanking, setAllEntriesForRanking] = useState<{ kpi_id: string; salesperson_id: string; value: number }[]>([]);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<Record<WidgetId, boolean>>(DEFAULT_WIDGET_CONFIG);
  const [widgetConfigOpen, setWidgetConfigOpen] = useState(false);
  const [savingWidgetConfig, setSavingWidgetConfig] = useState(false);
  const [contractStartDate, setContractStartDate] = useState<string | null>(null);
  const [salespersonAccessCode, setSalespersonAccessCode] = useState<string | null>(null);
  const [daySettings, setDaySettings] = useState({ includeSaturday: false, includeSunday: false, includeHolidays: false });

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

  // Load widget config from DB
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("onboarding_companies")
      .select("dashboard_widget_config")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.dashboard_widget_config && typeof data.dashboard_widget_config === "object") {
          setWidgetConfig({ ...DEFAULT_WIDGET_CONFIG, ...(data.dashboard_widget_config as Record<WidgetId, boolean>) });
        }
      });
  }, [companyId]);

  // Salva automaticamente a cada toggle (o botão "Salvar" no rodapé passava
  // despercebido — o staff desmarcava, via o próprio dashboard mudar em memória
  // e o cliente continuava vendo tudo). select() detecta RLS silencioso.
  const saveWidgetConfig = async (config: Record<WidgetId, boolean>) => {
    setSavingWidgetConfig(true);
    setWidgetConfig(config);
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .update({ dashboard_widget_config: config } as any)
        .eq("id", companyId)
        .select("id");
      if (error || !data?.length) throw error || new Error("no rows");
    } catch {
      toast.error("Erro ao salvar configuração dos widgets");
    } finally {
      setSavingWidgetConfig(false);
    }
  };

  const showWidget = (id: WidgetId) => widgetConfig[id] !== false;

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

      const [kpisRes, salespeopleRes, entriesRes, unitsRes, teamsRes, sectorsRes, companyRes, monthlyTargetsRes, sectorTeamsRes, teamUnitsRes, daySettingsRes] = await Promise.all([
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
        supabase.from("company_daily_goal_settings").select("include_saturday, include_sunday, include_holidays").eq("company_id", companyId).maybeSingle(),
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
      // Hide inactive salespeople UNLESS they have entries within the selected period
      // (so a vendor that left mid-month still appears for that month, but disappears once they have no sales)
      const entriesData = entriesRes.data || [];
      const salespeopleWithEntries = new Set(entriesData.map((e: any) => e.salesperson_id).filter(Boolean));
      const visibleSalespeople = (salespeopleRes.data || []).filter(
        (sp: any) => sp.is_active || salespeopleWithEntries.has(sp.id)
      );
      setSalespeople(visibleSalespeople);
      setEntries(entriesData);

      // For vendedor view: fetch all company entries to compute real ranking position
      // (uses kpi_entries directly — no need to fetch all salespeople, avoids RLS issues)
      if (isSalespersonView && salespersonId) {
        const allEntriesRes = await supabase
          .from("kpi_entries")
          .select("kpi_id, salesperson_id, value")
          .eq("company_id", companyId)
          .gte("entry_date", dateRange.start)
          .lte("entry_date", dateRange.end);
        setAllEntriesForRanking(allEntriesRes.data || []);
      }
      setUnits(unitsRes.data || []);
      setTeams(teamsRes.data || []);
      setSectors(sectorsRes.data || []);
      setSectorTeams(sectorTeamsRes.data || []);
      setTeamUnits(teamUnitsRes.data || []);
      if (companyRes.data) {
        setContractStartDate(companyRes.data.contract_start_date);
      }
      if (daySettingsRes.data) {
        setDaySettings({
          includeSaturday: daySettingsRes.data.include_saturday,
          includeSunday: daySettingsRes.data.include_sunday,
          includeHolidays: daySettingsRes.data.include_holidays,
        });
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
      'dinheiro', 'pagamento recebido', 'pago', 'baixado',
      // Cash Collected (dinheiro efetivamente recebido) — não é faturamento
      'cash', 'collected', 'colleted', 'cash collected', 'cash colleted'
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

    // If there are multiple main goals, ALWAYS return ALL of them (regardless of type)
    // Each one gets its own projection card
    const allMainGoalKpis = filteredKpis.filter((k) => k.is_main_goal);
    if (allMainGoalKpis.length > 1) {
      return allMainGoalKpis;
    }

    const monetaryKpis = filteredKpis.filter((k) => k.kpi_type === "monetary");
    
    // FALLBACK: If there are NO monetary KPIs at all, use the main goal KPI (even if numeric)
    if (monetaryKpis.length === 0) {
      return allMainGoalKpis;
    }

    // When filtering by Sector (but not by a specific Team/Salesperson)
    if (
      selectedSector !== "all" &&
      selectedTeam === "all" &&
      selectedSalesperson === "all"
    ) {
      if (hasDistinctMonetaryCategories(filteredKpis)) {
        const mainGoalKpis = filteredKpis.filter((k) => k.is_main_goal && k.kpi_type === "monetary");
        if (mainGoalKpis.length > 0) return mainGoalKpis;
      }
      return monetaryKpis;
    }

    if (!hasAnyOrgFilter) {
      if (hasDistinctMonetaryCategories(filteredKpis)) {
        const mainGoalKpis = filteredKpis.filter((k) => k.is_main_goal && k.kpi_type === "monetary");
        if (mainGoalKpis.length > 0) return mainGoalKpis;
      }
      const mainGoalMonetary = filteredKpis.filter((k) => k.is_main_goal && k.kpi_type === "monetary");
      if (mainGoalMonetary.length > 0) return mainGoalMonetary;
      return monetaryKpis;
    }

    return allMainGoalKpis.length > 0 ? allMainGoalKpis : monetaryKpis;
  };

  // Gerentes (setor Liderança) não entram no rateio da meta nem herdam meta do escopo
  const leadershipSectorIds = sectors
    .filter((s) => (s.name || "").toLowerCase().includes("lideran"))
    .map((s) => s.id);
  const isLeaderSp = (sp?: { sector_id?: string | null }) =>
    !!sp?.sector_id && leadershipSectorIds.includes(sp.sector_id);
  const activeSellersCount = Math.max(
    salespeople.filter((sp) => sp.is_active && !isLeaderSp(sp)).length,
    1
  );

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
    
    // Vendedor sem meta própria: gerente não herda; demais herdam do escopo
    // mais próximo (time → unidade) dividido pelos vendedores ativos não-gerentes
    if (relevantTargets.length === 0 && selectedSalesperson !== "all") {
      const selectedSp = salespeople.find(sp => sp.id === selectedSalesperson);
      if (isLeaderSp(selectedSp)) {
        return { Meta: 0 };
      }
      const divideScope = (targets: MonthlyTarget[], count: number): Record<string, number> => {
        const divided: Record<string, number> = {};
        targets.forEach(mt => {
          divided[mt.level_name] = mt.target_value / Math.max(count, 1);
        });
        return divided;
      };
      if (selectedSp?.team_id) {
        const teamTargets = allMonthlyTargets.filter(
          mt => mt.kpi_id === kpiId && mt.team_id === selectedSp.team_id && mt.salesperson_id === null
        );
        if (teamTargets.length > 0) {
          const teamSellers = salespeople.filter(
            sp => sp.is_active && sp.team_id === selectedSp.team_id && !isLeaderSp(sp)
          ).length;
          return divideScope(teamTargets, teamSellers);
        }
      }
      if (selectedSp?.unit_id) {
        const unitTargets = allMonthlyTargets.filter(
          mt => mt.kpi_id === kpiId && mt.unit_id === selectedSp.unit_id && mt.team_id === null && mt.salesperson_id === null
        );
        if (unitTargets.length > 0) {
          const unitSellers = salespeople.filter(
            sp => sp.is_active && sp.unit_id === selectedSp.unit_id && !isLeaderSp(sp)
          ).length;
          return divideScope(unitTargets, unitSellers);
        }
      }
    }

    // Visão da empresa (sem filtro de vendedor/time/unidade): a meta da empresa é o
    // ROLLUP = soma das metas por vendedor. Ex: Luana 30k + Victoria 17,5k + Ana 17,5k = 65k.
    // Tem precedência sobre uma meta-geral antiga de empresa, pra refletir o que está
    // cadastrado por vendedora. (Não vale pra KPI com escopo de unidade.)
    if (
      relevantTargets.length === 0 &&
      selectedSalesperson === "all" &&
      selectedTeam === "all" &&
      selectedUnit === "all" &&
      !unitScoped
    ) {
      const spTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.salesperson_id !== null
      );
      if (spTargets.length > 0) {
        const sumByLevel: Record<string, number> = {};
        spTargets.forEach(mt => {
          sumByLevel[mt.level_name] = (sumByLevel[mt.level_name] || 0) + mt.target_value;
        });
        return sumByLevel;
      }
    }

    if (relevantTargets.length === 0) {
      // Try company-level targets first
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id === null && mt.team_id === null && mt.salesperson_id === null
      );

      // When filtering by salesperson and falling back to company target, divide by active sellers (non-leaders)
      if (relevantTargets.length > 0 && selectedSalesperson !== "all") {
        const dividedResult: Record<string, number> = {};
        relevantTargets.forEach(mt => {
          dividedResult[mt.level_name] = mt.target_value / activeSellersCount;
        });
        return dividedResult;
      }
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
    const baseTarget = kpi.effective_target ?? kpi.target_value;
    // When filtering by salesperson and no specific target found, divide by active sellers
    // (gerentes do setor Liderança não têm meta nem entram no divisor)
    if (selectedSalesperson !== "all") {
      const selectedSp = salespeople.find(sp => sp.id === selectedSalesperson);
      if (isLeaderSp(selectedSp)) return 0;
      return baseTarget / activeSellersCount;
    }
    return baseTarget;
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
      
      // Main goal KPIs are ALWAYS shown regardless of scope/salesperson filter
      // They represent the company's primary metrics and should be visible for every salesperson
      if (kpi.is_main_goal) return true;
      
      // If filtering by salesperson, show:
      // - KPIs scoped to that specific salesperson
      // - KPIs scoped to company (shared across all)
      if (selectedSalesperson !== "all") {
        if (scope === "salesperson") {
          return kpi.salesperson_id === selectedSalesperson;
        }
        // Also show company-scoped KPIs when viewing a salesperson
        if (scope === "company" || !scope) return true;
        const sp = salespeople.find(s => s.id === selectedSalesperson);
        // Show unit-scoped KPIs if the salesperson belongs to that unit
        if (scope === "unit" && sp && kpi.unit_id === sp.unit_id) return true;
        // Show team-scoped KPIs if the salesperson belongs to that team
        if (scope === "team" && sp && kpi.team_id === sp.team_id) return true;
        // Show sector-scoped KPIs if the salesperson belongs to that sector
        if (scope === "sector" && sp && kpi.sector_id) {
          if (salespersonBelongsToSector(sp, kpi.sector_id)) return true;
        }
        return false;
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

  // Helper: check if a date is a working day based on company settings
  const isWorkingDay = (date: Date): boolean => {
    const dow = date.getDay();
    if (dow === 6 && !daySettings.includeSaturday) return false;
    if (dow === 0 && !daySettings.includeSunday) return false;
    if (!daySettings.includeHolidays && isHoliday(date)) return false;
    return true;
  };

  // Count working days in a month based on company settings
  const countWorkingDays = (year: number, month: number, upToDay?: number): number => {
    const lastDay = upToDay ?? new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= lastDay; d++) {
      if (isWorkingDay(new Date(year, month, d))) count++;
    }
    return count;
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
    
    // Calculate working days for the full month and elapsed (excluding today)
    const totalWorkingDays = countWorkingDays(selectedYear, selectedMonth);
    const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
    // For projection: count only PAST working days (exclude today) so projection = realized / elapsed * total
    const elapsedWorkingDays = isCurrentMonth 
      ? countWorkingDays(selectedYear, selectedMonth, now.getDate() - 1)
      : totalWorkingDays;
    const remainingWorkingDays = isCurrentMonth
      ? totalWorkingDays - countWorkingDays(selectedYear, selectedMonth, now.getDate())
      : 0;
    
    const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
    const daysRemaining = remainingWorkingDays;
    const timeProgress = totalWorkingDays > 0 ? elapsedWorkingDays / totalWorkingDays : 0;

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
        // Meta diária x dias UTEIS do mes (respeita marcacao de fim de semana/feriado)
        monthlyTarget = baseTarget * (totalWorkingDays > 0 ? totalWorkingDays : daysInMonth);
      } else if (kpi.periodicity === "weekly") {
        monthlyTarget = baseTarget * Math.ceil(daysInMonth / 7);
      }

      // Determine category for this KPI
      const category = kpi.kpi_type === "monetary" ? categorizeMonetaryKpi(kpi) : undefined;

      // Check how many main goals we have in the projection set
      const mainGoalCount = kpisForProjection.filter(k => k.is_main_goal).length;
      const hasMultipleMainGoalsInSet = mainGoalCount > 1;

      // Only sum to totals if we DON'T have multiple main goals
      // When there are multiple main goals, each gets its own card - no consolidated view
      if (!hasMultipleMainGoalsInSet && (!hasDistinctCategories || kpi.is_main_goal)) {
        totalRealized += kpiTotal;
        totalTarget += monthlyTarget;
      }

      // Store individual projection for:
      // 1. KPIs explicitly marked as main goal (ALWAYS, even if target is 0)
      // 2. When we have distinct monetary categories (faturamento vs receita) - show each separately
      const shouldShowIndividual = kpi.is_main_goal || 
        (hasDistinctCategories && kpi.kpi_type === "monetary" && (category === "faturamento" || category === "receita"));
      
      // Always show main goal KPIs as individual cards, even without target
      if (shouldShowIndividual) {
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

  // Prepare chart data - Daily evolution - per KPI when multiple main goals
  const getDailyChartData = (forKpiId?: string) => {
    const filteredKpis = getFilteredKpis();
    
    const targetKpis = getRevenueKpisForContext(filteredKpis);
    
    // If a specific KPI is selected, use that instead
    const kpiIdsToUse = selectedKpi !== "all" 
      ? [selectedKpi] 
      : forKpiId
      ? [forKpiId]
      : targetKpis.map(k => k.id);
    
    const filteredEntries = entries.filter(e => {
      if (!kpiIdsToUse.includes(e.kpi_id)) return false;
      const dims = getEntryDimensions(e);
      const sp = salespeopleById.get(e.salesperson_id);
      if (selectedSalesperson !== "all" && dims.salesperson_id !== selectedSalesperson) return false;
      if (selectedUnit !== "all" && dims.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && dims.team_id !== selectedTeam) return false;
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

  // Get target vs realized chart data - per KPI when multiple main goals
  const getTargetVsRealizedData = (forKpiId?: string) => {
    const filteredKpis = getFilteredKpis();
    
    const targetKpis = forKpiId 
      ? filteredKpis.filter(k => k.id === forKpiId)
      : getRevenueKpisForContext(filteredKpis);
    const mainGoalKpis = filteredKpis.filter(k => k.is_main_goal);
    
    const targetKpiIds = targetKpis.map(k => k.id);
    
    const filteredEntries = entries.filter(e => {
      if (!targetKpiIds.includes(e.kpi_id)) return false;
      const dims = getEntryDimensions(e);
      const sp = salespeopleById.get(e.salesperson_id);
      if (selectedUnit !== "all" && dims.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && dims.team_id !== selectedTeam) return false;
      if (selectedSector !== "all") {
        const directMatch = dims.sector_id === selectedSector;
        const viaSalesperson = sp ? salespersonBelongsToSector(sp, selectedSector) : false;
        if (!directMatch && !viaSalesperson) return false;
      }
      if (selectedSalesperson !== "all" && dims.salesperson_id !== selectedSalesperson) return false;
      return true;
    });

    const groupedByDate: Record<string, number> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByDate[entry.entry_date]) {
        groupedByDate[entry.entry_date] = 0;
      }
      groupedByDate[entry.entry_date] += entry.value;
    });

    const sortedDates = Object.keys(groupedByDate).sort();

    // Total mensal por nível de meta (Meta, Super Meta, etc.)
    const targetLevelsMap: Record<string, number> = {};
    targetKpis.forEach(kpi => {
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
    const kpiType = targetKpis[0]?.kpi_type ?? (mainGoalKpis[0]?.kpi_type ?? "monetary");

    if (targetLevelNames.length === 0 && sortedDates.length === 0) {
      return { data: [], targetLevels: [], kpiType };
    }

    // Mês INTEIRO no eixo X (dia 1 até o último dia). A META é projeção linear acumulada
    // (target * dia / diasDoMês). O REALIZADO é acumulado só ATÉ HOJE — depois de hoje fica
    // vazio, pra dar pra comparar se o realizado (verde) está acima da meta (azul) no período.
    const now = new Date();
    const selStart = parseDateLocal(dateRange.start);
    const selMonth = selStart.getMonth();
    const selYear = selStart.getFullYear();
    const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
    const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();
    const isPastMonth = selYear < now.getFullYear() || (selYear === now.getFullYear() && selMonth < now.getMonth());
    const todayDay = isCurrentMonth ? now.getDate() : (isPastMonth ? daysInMonth : 0);
    const pad = (n: number) => String(n).padStart(2, "0");

    let cumulative = 0;
    const chartData: Record<string, any>[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selYear}-${pad(selMonth + 1)}-${pad(day)}`;
      cumulative += groupedByDate[dateStr] || 0;
      const dataPoint: Record<string, any> = {
        date: `${pad(day)}/${pad(selMonth + 1)}`,
        realizado: day <= todayDay ? cumulative : null,
      };
      targetLevelNames.forEach(levelName => {
        dataPoint[levelName] = (targetLevelsMap[levelName] * day) / daysInMonth;
      });
      chartData.push(dataPoint);
    }

    return { data: chartData, targetLevels: targetLevelNames, kpiType };
  };

  // Prepare ranking data - per KPI when multiple main goals
  const getRankingData = (forKpiId?: string) => {
    const filteredSalespeople = salespeople.filter(sp => {
      if (selectedSalesperson !== "all" && sp.id !== selectedSalesperson) return false;
      if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
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
      // When forKpiId is provided, filter to that KPI only
      if (forKpiId) {
        if (entry.kpi_id !== forKpiId) return;
      } else if (selectedKpi !== "all" && entry.kpi_id !== selectedKpi) {
        return;
      }
      const dims = getEntryDimensions(entry);
      const sp = salespeopleById.get(entry.salesperson_id);
      if (selectedUnit !== "all" && dims.unit_id !== selectedUnit) return;
      if (selectedTeam !== "all" && dims.team_id !== selectedTeam) return;
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

  // Calculate ranking position for current salesperson by goal achievement percentage
  // Mirrors DailyGoalCard's sorting logic: percentage desc, then realized value desc for ties
  const getMyRankingPosition = (forKpiId?: string): number | null => {
    if (!salespersonId || allEntriesForRanking.length === 0) return null;

    const kpiIdToRank = forKpiId || (selectedKpi !== "all" ? selectedKpi : null);

    // Accumulate realized per salesperson
    const realizedMap: Record<string, number> = {};
    allEntriesForRanking.forEach(entry => {
      if (kpiIdToRank && entry.kpi_id !== kpiIdToRank) return;
      if (!realizedMap[entry.salesperson_id]) realizedMap[entry.salesperson_id] = 0;
      realizedMap[entry.salesperson_id] += entry.value;
    });
    // Ensure current salesperson is always in the map
    if (realizedMap[salespersonId] === undefined) realizedMap[salespersonId] = 0;

    if (!kpiIdToRank) {
      // No specific KPI in context — rank by total value
      const sorted = Object.entries(realizedMap).sort((a, b) => b[1] - a[1]);
      const pos = sorted.findIndex(([id]) => id === salespersonId);
      return pos >= 0 ? pos + 1 : null;
    }

    const spCount = Math.max(Object.keys(realizedMap).length, 1);

    // Calculate goal achievement percentage per salesperson
    const percentageMap: Record<string, number> = {};
    Object.entries(realizedMap).forEach(([spId, realized]) => {
      // 1) Personal target for this salesperson + KPI
      const personalTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiIdToRank && mt.salesperson_id === spId
      );
      let target = 0;
      if (personalTargets.length > 0) {
        const meta = personalTargets.find(t => t.level_name === "Meta");
        target = meta?.target_value ?? personalTargets[0].target_value;
      } else {
        // 2) Company-level target divided equally
        const companyTargets = allMonthlyTargets.filter(
          mt => mt.kpi_id === kpiIdToRank && mt.unit_id === null && mt.team_id === null && mt.salesperson_id === null
        );
        if (companyTargets.length > 0) {
          const meta = companyTargets.find(t => t.level_name === "Meta");
          target = (meta?.target_value ?? companyTargets[0].target_value) / spCount;
        } else {
          // 3) KPI default target
          const kpi = kpis.find(k => k.id === kpiIdToRank);
          target = (kpi?.effective_target ?? kpi?.target_value ?? 0) / spCount;
        }
      }
      percentageMap[spId] = target > 0 ? (realized / target) * 100 : 0;
    });

    // Same sort as DailyGoalCard: % desc; both 0% → realized desc; 0% goes to bottom
    const sorted = Object.entries(percentageMap).sort((a, b) => {
      if (a[1] === 0 && b[1] === 0) return (realizedMap[b[0]] || 0) - (realizedMap[a[0]] || 0);
      if (a[1] === 0) return 1;
      if (b[1] === 0) return -1;
      return b[1] - a[1];
    });

    const pos = sorted.findIndex(([id]) => id === salespersonId);
    return pos >= 0 ? pos + 1 : null;
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
    // Separate "calls agendadas" from "calls com pitch" for proper funnel staging
    const callsAgendadasKpi = kpis.find(kpi => 
      kpi.name.toLowerCase().includes('agendad') && (kpi.name.toLowerCase().includes('call') || kpi.name.toLowerCase().includes('reunião') || kpi.name.toLowerCase().includes('reuniao'))
    );
    const pitchKpi = kpis.find(kpi => 
      kpi.name.toLowerCase().includes('pitch')
    );
    // Fallback meetingsKpi: only used if neither specific calls KPI is found
    const meetingsKpi = !callsAgendadasKpi && !pitchKpi
      ? findKpiByPattern(['reunião', 'reuniao', 'reuniões', 'reunioes', 'call', 'calls', 'ligação', 'ligações'])
      : null;
    const proposalsKpi = findKpiByPattern(['proposta', 'propostas', 'orçamento', 'orcamento', 'cotação', 'cotacao']);
    const salesKpi = findKpiByPattern(['venda', 'vendas', 'fechamento', 'fechamentos', 'qtd venda', 'quantidade venda']);
    const revenueKpi = kpis.find(k => k.kpi_type === 'monetary');
    // Ticket médio deve sair do FATURAMENTO (valor faturado), não de "Cash Collected"/receita.
    // Quando a empresa tem os dois KPIs monetários, prefere o de faturamento; senão cai no 1º monetário.
    const monetaryGroups = groupMonetaryKpisByCategory(kpis);
    const faturamentoKpi = monetaryGroups.faturamento[0] || monetaryGroups.other[0] || revenueKpi;
    // Base da conversão: "Contatos realizados" (topo de funil real) quando existir.
    const contatosRealizadosKpi =
      kpis.find(k => { const n = k.name.toLowerCase(); return n.includes('contato') && n.includes('realizad'); })
      || findKpiByPattern(['contatos', 'contato']);

    // Calculate totals for each found KPI
    const getKpiTotal = (kpi: KPI | undefined | null) => {
      if (!kpi) return 0;
      return filteredEntries.filter(e => e.kpi_id === kpi.id).reduce((sum, e) => sum + e.value, 0);
    };

    const totalLeads = getKpiTotal(leadsKpi);
    const totalServices = getKpiTotal(serviceKpi);
    const totalVisits = getKpiTotal(visitsKpi);
    const totalCallsAgendadas = getKpiTotal(callsAgendadasKpi);
    const totalPitch = getKpiTotal(pitchKpi);
    const totalMeetings = getKpiTotal(meetingsKpi);
    const totalProposals = getKpiTotal(proposalsKpi);
    const totalSales = getKpiTotal(salesKpi);
    const totalRevenue = getKpiTotal(revenueKpi);
    const totalFaturamento = getKpiTotal(faturamentoKpi);
    const totalContatosRealizados = getKpiTotal(contatosRealizadosKpi);

    // Build conversion stages dynamically based on available data
    // Priority order: Leads → Atendimentos → Visitas → Calls Agendadas → Calls com Pitch → Propostas → Vendas
    const conversionStages: Array<{ name: string; value: number; kpiName: string | undefined }> = [];
    
    if (leadsKpi && totalLeads > 0) {
      // Quando o topo do funil é um KPI de "contatos", mostra o nome real
      // (ex.: "Contatos realizados") em vez do rótulo genérico "Leads" — assim
      // a linha de conversão fica coerente com a Conversão Geral.
      const topLabel = /contato/i.test(leadsKpi.name) ? leadsKpi.name.replace(/\s+/g, " ").trim() : "Leads";
      conversionStages.push({ name: topLabel, value: totalLeads, kpiName: leadsKpi.name });
    }
    if (serviceKpi && totalServices > 0) {
      conversionStages.push({ name: 'Atendimentos', value: totalServices, kpiName: serviceKpi.name });
    }
    if (visitsKpi && totalVisits > 0) {
      conversionStages.push({ name: 'Visitas', value: totalVisits, kpiName: visitsKpi.name });
    }
    // Show Calls Agendadas as a stage if it exists
    if (callsAgendadasKpi && totalCallsAgendadas > 0) {
      conversionStages.push({ name: 'Calls Agendadas', value: totalCallsAgendadas, kpiName: callsAgendadasKpi.name });
    }
    // Show Calls com Pitch as the next stage (this is the conversion-relevant one)
    if (pitchKpi && totalPitch > 0) {
      conversionStages.push({ name: 'Calls c/ Pitch', value: totalPitch, kpiName: pitchKpi.name });
    }
    // Fallback: generic meetings if no specific calls KPIs
    if (!callsAgendadasKpi && !pitchKpi && meetingsKpi && totalMeetings > 0) {
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

    // Taxa de conversão = vendas realizadas / contatos realizados quando a empresa tem esse KPI.
    // Senão mantém o comportamento antigo (Calls c/ Pitch → 1ª etapa do funil).
    const conversionBase = contatosRealizadosKpi && totalContatosRealizados > 0
      ? { name: contatosRealizadosKpi.name, value: totalContatosRealizados }
      : pitchKpi && totalPitch > 0
        ? { name: 'Calls c/ Pitch', value: totalPitch }
        : conversionStages[0];
    const overallConversion = conversionBase && conversionBase.value > 0 && totalSales > 0
      ? (totalSales / conversionBase.value) * 100
      : 0;

    // Legacy rates for backward compatibility
    const leadToProposal = totalLeads > 0 ? (totalProposals / totalLeads) * 100 : 0;
    const proposalToSale = totalProposals > 0 ? (totalSales / totalProposals) * 100 : 0;
    const leadToSale = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;

    // Ticket médio = faturamento / vendas (usa faturamento, nunca cash collected)
    const avgTicket = totalSales > 0 ? totalFaturamento / totalSales : 0;

    // Calculate average daily sales
    const periodStart = new Date(dateRange.start);
    const periodEnd = new Date(dateRange.end);
    const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const avgDailySales = periodDays > 0 ? totalSales / periodDays : 0;

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
      conversionBaseName: conversionBase?.name || conversionStages[0]?.name,
      avgTicket,
      avgDailySales,
      periodDays,
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

  // Determine if we should show per-KPI charts
  const mainGoalKpisForCharts = kpis.filter(k => k.is_main_goal);
  const hasMultipleMainGoalsForCharts = mainGoalKpisForCharts.length > 1 && selectedKpi === "all";

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
    <div className="space-y-6 kpi3d">
      <style>{`
        /* Profundidade 3D aplicada a TODOS os cards do dashboard, sem trocar as cores do tema */
        .kpi3d [class*="bg-muted"].rounded-full{ box-shadow: inset 0 1px 2px rgba(0,0,0,.16); }
        .kpi3d [class*="bg-muted"].rounded-full > .rounded-full{
          box-shadow: 0 3px 6px -2px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.32);
          position:relative;
        }
        .kpi3d [class*="bg-muted"].rounded-full > .rounded-full:not([class*="gradient"]){
          background-image: linear-gradient(180deg, rgba(255,255,255,.24), rgba(0,0,0,.14));
        }
        /* cards ganham relevo (sombra em camadas + brilho no topo), tema preservado */
        .kpi3d [class*="bg-card"]{
          box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 14px 30px -18px rgba(0,0,0,.38);
        }
        :root[data-theme="dark"] .kpi3d [class*="bg-card"], .dark .kpi3d [class*="bg-card"]{
          box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 18px 36px -18px rgba(0,0,0,.6);
        }
        /* colunas/barras de gráfico (recharts) com leve profundidade */
        .kpi3d .recharts-bar-rectangle path, .kpi3d .recharts-rectangle path{
          filter: drop-shadow(0 4px 5px rgba(0,0,0,.22));
        }
      `}</style>
      {/* Filters */}
      <Card className="border-border/50 shadow-sm overflow-hidden relative">
        {/* Cabeçalho clicável para colapsar */}
        <button
          type="button"
          onClick={() => setFiltersOpen(prev => !prev)}
          className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5 border-b border-border/40 flex items-center gap-2 hover:from-primary/15 transition-colors"
        >
          <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center">
            <Filter className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-wide uppercase flex-1 text-left">Filtros</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        {/* Widget config button — only for non-client, non-salesperson views */}
        {!isClientView && !isSalespersonView && (
          <Sheet open={widgetConfigOpen} onOpenChange={setWidgetConfigOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="absolute top-1.5 right-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
                onClick={e => { e.stopPropagation(); setWidgetConfigOpen(true); }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Widgets</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[340px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Configurar Widgets do Dashboard
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Selecione quais seções devem aparecer. As alterações valem para você e para o cliente.
                </p>
              </SheetHeader>
              <div className="mt-6 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
                {KPI_WIDGETS.map(widget => (
                  <div key={widget.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${widgetConfig[widget.id as WidgetId] !== false ? "bg-primary/10" : "bg-muted"}`}>
                        {widgetConfig[widget.id as WidgetId] !== false
                          ? <Eye className="h-3.5 w-3.5 text-primary" />
                          : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{widget.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={widgetConfig[widget.id as WidgetId] !== false}
                      disabled={savingWidgetConfig}
                      onCheckedChange={(checked) => {
                        // salva na hora — sem depender do botão no rodapé
                        saveWidgetConfig({ ...widgetConfig, [widget.id]: checked });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center gap-2">
                <p className="flex-1 text-xs text-muted-foreground">
                  {savingWidgetConfig ? "Salvando..." : "As alterações são salvas automaticamente."}
                </p>
                <Button variant="outline" disabled={savingWidgetConfig} onClick={() => {
                  const all = Object.fromEntries(KPI_WIDGETS.map(w => [w.id, true])) as Record<WidgetId, boolean>;
                  saveWidgetConfig(all);
                }}>
                  Mostrar Tudo
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {filtersOpen && <CardContent className="px-4 pt-4 pb-4 space-y-4">
          {/* Período */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" />
              Período
            </Label>
            <div className="flex items-center gap-1.5 rounded-xl border border-input bg-muted/40 px-3 h-11 shadow-sm">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  if (e.target.value) setDateRange({ ...dateRange, start: e.target.value });
                }}
                className="h-8 border-0 bg-transparent text-xs px-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
              />
              <span className="text-muted-foreground/60 text-sm shrink-0 font-light">→</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  if (e.target.value) setDateRange({ ...dateRange, end: e.target.value });
                }}
                className="h-8 border-0 bg-transparent text-xs px-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs rounded-lg border-border/60 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-colors font-medium"
                onClick={() => applyMonthRange(0)}
              >
                Mês atual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs rounded-lg border-border/60 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-colors font-medium"
                onClick={() => applyMonthRange(1)}
              >
                Mês anterior
              </Button>
            </div>
          </div>

          {/* Dropdowns de filtro */}
          <div className="space-y-3">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Visualização</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">KPI</Label>
                <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                  <SelectTrigger className="h-9 text-xs px-2.5 rounded-lg border-border/60 bg-muted/30">
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

              {!isSalespersonView && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Vendedor</Label>
                  <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                    <SelectTrigger className="h-9 text-xs px-2.5 rounded-lg border-border/60 bg-muted/30">
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
              )}

              {units.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Unidade</Label>
                  <Select value={selectedUnit} onValueChange={(value) => {
                    setSelectedUnit(value);
                    setSelectedTeam("all");
                    setSelectedSector("all");
                    setSelectedSalesperson("all");
                  }}>
                    <SelectTrigger className="h-9 text-xs px-2.5 rounded-lg border-border/60 bg-muted/30">
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
                  <Label className="text-[10px] text-muted-foreground">Setor</Label>
                  <Select value={selectedSector} onValueChange={(value) => {
                    setSelectedSector(value);
                    setSelectedTeam("all");
                    setSelectedSalesperson("all");
                  }}>
                    <SelectTrigger className="h-9 text-xs px-2.5 rounded-lg border-border/60 bg-muted/30">
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
                  <Label className="text-[10px] text-muted-foreground">Equipe</Label>
                  <Select value={selectedTeam} onValueChange={(value) => {
                    setSelectedTeam(value);
                    if (value !== "all") setSelectedSalesperson("all");
                  }}>
                    <SelectTrigger className="h-9 text-xs px-2.5 rounded-lg border-border/60 bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="all">Todas</SelectItem>
                      {teams
                        .filter(t => {
                          if (selectedUnit !== "all" && t.unit_id !== selectedUnit && t.unit_id !== null) return false;
                          if (selectedSector !== "all") {
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
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-2 pt-1">
            {salespersonId && salespersonAccessCode && (
              <Button
                variant="default"
                className="w-full h-11 gap-2 text-sm font-semibold rounded-xl shadow-md bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={() => {
                  const link = `${getPublicBaseUrl()}/#/kpi-entry/${companyId}?code=${salespersonAccessCode}`;
                  window.open(link, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Lançar Vendas
              </Button>
            )}
            <div className="flex gap-2 flex-wrap">
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
        </CardContent>}
      </Card>

      {/* Norte Estratégico (NSM) — em destaque, acima da Projeção do Mês */}
      {!isSalespersonView && showWidget("nsm") && <NorthStarMetricCard companyId={companyId} />}

      {/* Monthly Projection Card - Shows individual main goals when there are multiple */}
      {showWidget("projection") && (projection.target > 0 || projection.hasDistinctCategories || projection.hasMultipleMainGoals) && (
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
          
          {/* Main consolidated projection card - only show if we DON'T have distinct categories warning AND NOT multiple main goals */}
          {!projection.showDistinctCategoriesWarning && !projection.hasMultipleMainGoals && projection.target > 0 && (
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
            <div className="grid gap-4 grid-cols-1">
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
                          <CardTitle className={`${projection.hasMultipleMainGoals ? 'text-lg' : 'text-sm'} font-medium flex items-center gap-2`}>
                            <Target className={projection.hasMultipleMainGoals ? 'h-5 w-5' : 'h-4 w-4'} />
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
                          {projection.hasMultipleMainGoals && (
                            <Badge variant="outline" className="gap-1">
                              <CalendarDays className="h-3 w-3" />
                              Dia {projection.currentDay} de {projection.daysInMonth} ({projection.daysRemaining} restantes)
                            </Badge>
                          )}
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
                      {projection.hasMultipleMainGoals ? (
                        <>
                          <div className="grid gap-4 md:grid-cols-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Realizado</p>
                              <p className="text-2xl font-bold">{formatValue(proj.realized, proj.kpi.kpi_type)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Meta do Mês</p>
                              <p className="text-2xl font-bold">{formatValue(proj.target, proj.kpi.kpi_type)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Valor Projetado</p>
                              <p className="text-2xl font-bold">{formatValue(proj.projectedValue, proj.kpi.kpi_type)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Projeção</p>
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
                          </div>
                          <div className="mt-4">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Progresso do mês: {projection.timeProgress.toFixed(0)}%</span>
                              <span>Atingimento: {proj.target > 0 ? ((proj.realized / proj.target) * 100).toFixed(0) : 0}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3 relative">
                              <div 
                                className="absolute h-full w-0.5 bg-foreground/50 z-10"
                                style={{ left: `${Math.min(projection.timeProgress, 100)}%` }}
                              />
                              <div
                                className={`h-3 rounded-full transition-all ${
                                  proj.projectionPercent >= 100 ? 'bg-green-500' :
                                  proj.projectionPercent >= 70 ? 'bg-amber-500' :
                                  'bg-destructive'
                                }`}
                                style={{ width: `${Math.min(proj.target > 0 ? (proj.realized / proj.target) * 100 : 0, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              {proj.projectionPercent >= 100 
                                ? "✅ No ritmo para bater a meta!"
                                : proj.projectionPercent >= 70
                                ? "⚠️ Atenção: a projeção está abaixo da meta esperada"
                                : "🚨 Alerta: a empresa está bem abaixo do ritmo necessário"
                              }
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
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
                                style={{ width: `${Math.min(proj.target > 0 ? (proj.realized / proj.target) * 100 : 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Period Comparison Card */}
      {showWidget("period_comparison") && (
        <PeriodComparisonCard
          companyId={companyId}
          kpis={kpis.map(k => ({ id: k.id, name: k.name, kpi_type: k.kpi_type, is_main_goal: k.is_main_goal }))}
          salespeople={salespeople.map(sp => ({ id: sp.id, name: sp.name, team_id: sp.team_id, unit_id: sp.unit_id, sector_id: sp.sector_id }))}
          dateRange={dateRange}
          selectedKpi={selectedKpi}
          selectedSalesperson={selectedSalesperson}
          selectedUnit={selectedUnit}
          selectedTeam={selectedTeam}
          selectedSector={selectedSector}
          sectorTeams={sectorTeams}
        />
      )}

      {/* Daily Goal Card */}
      {showWidget("daily_goal") && (<DailyGoalCard
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
        leadershipSectorIds={sectors
          .filter((s) => (s.name || "").toLowerCase().includes("lideran"))
          .map((s) => s.id)}
        isClientView={isSalespersonView}
        currentSalespersonRankPosition={isSalespersonView ? getMyRankingPosition : undefined}
        onSettingsChange={setDaySettings}
      />)}

      {/* Unit Ranking — empresas com mais de uma unidade */}
      {!isSalespersonView && units.filter((u) => u.is_active).length > 1 && (
        <UnitRankingCard
          units={units}
          salespeople={salespeople.map((sp) => ({
            id: sp.id,
            unit_id: sp.unit_id,
            team_id: sp.team_id,
          }))}
          teamUnits={teamUnits}
          entries={entries.map((e) => ({
            kpi_id: e.kpi_id,
            salesperson_id: e.salesperson_id,
            unit_id: e.unit_id,
            value: e.value,
          }))}
          kpis={kpis}
          allMonthlyTargets={allMonthlyTargets}
        />
      )}

      {/* Salespeople Comparison Table */}
      {showWidget("salespeople_table") && !isSalespersonView && (hasMultipleMainGoalsForCharts ? (
        mainGoalKpisForCharts.map((kpi) => (
          <SalespeopleComparisonTable
            key={`comparison-${kpi.id}`}
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
            filterKpiId={kpi.id}
            titleSuffix={kpi.name}
          />
        ))
      ) : (
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
      ))}

      {/* Performance Comparison Card - Compare by units, sectors, teams, or salespeople */}
      {showWidget("performance") && (teams.length > 1 || units.length > 1 || sectors.length > 1 || salespeople.length > 1) && (
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

      {/* Monthly Sales Chart */}
      {/* Desligado = some de verdade (antes o "senão" do ternário renderizava
          a versão single mesmo com o widget desmarcado) */}
      {showWidget("monthly_chart") && (hasMultipleMainGoalsForCharts ? (
        mainGoalKpisForCharts.map((kpi) => (
          <MonthlySalesChart
            key={`monthly-${kpi.id}`}
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
            filterKpiIds={[kpi.id]}
            titleSuffix={kpi.name}
            isClientView={isSalespersonView}
          />
        ))
      ) : (
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
          isClientView={isSalespersonView}
        />
      ))}


      {/* Term Vision Card - QTR/YTD/MAT (Visão de Curto, Médio e Longo Prazo) */}
      {showWidget("term_vision") && (hasMultipleMainGoalsForCharts ? (
        mainGoalKpisForCharts.map((kpi) => (
          <ProjectTermVisionCard
            key={`term-${kpi.id}`}
            companyId={companyId}
            projectId={projectId}
            selectedSalesperson={selectedSalesperson}
            selectedUnit={selectedUnit}
            selectedTeam={selectedTeam}
            selectedSector={selectedSector}
            filterKpiIds={[kpi.id]}
            titleSuffix={kpi.name}
          />
        ))
      ) : (
        <ProjectTermVisionCard
          companyId={companyId}
          projectId={projectId}
          selectedSalesperson={selectedSalesperson}
          selectedUnit={selectedUnit}
          selectedTeam={selectedTeam}
          selectedSector={selectedSector}
        />
      ))}

      {/* Sales Comparison Chart - Before vs After UNV */}
      {showWidget("before_after") && <SalesComparisonChart 
        companyId={companyId}
        projectId={projectId}
        contractStartDate={contractStartDate}
        currentMonthRevenue={calculatedMetrics.totalRevenue}
        refreshKey={salesHistoryRefreshKey}
        onlyShowIfPositive={isClientView}
      />}

      {/* CAC Calculator Card */}
      {showWidget("cac") && projectId && (
        <CACCalculatorCard projectId={projectId} autoSalesCount={calculatedMetrics.totalSales} />
      )}

      {/* Conversion Card - Detailed */}
      {showWidget("conversion") && calculatedMetrics.hasAnyConversionData && (
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
                  Conversão Geral ({calculatedMetrics.conversionBaseName} → Vendas)
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
      {showWidget("avg_ticket") && calculatedMetrics.hasRevenueData && calculatedMetrics.hasSalesData && calculatedMetrics.totalSales > 0 && (
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
      {(() => {
        const salesPatterns = ['venda', 'vendas', 'fechamento', 'fechamentos'];
        const salesKpiIds = kpis
          .filter(k => salesPatterns.some(p => k.name.toLowerCase().includes(p)))
          .map(k => k.id);
        const revenueKpiIds = kpis
          .filter(k => k.kpi_type === 'monetary')
          .map(k => k.id);
        const filteredForCard = getFilteredEntries();
        const totalSalesCard = filteredForCard
          .filter(e => salesKpiIds.includes(e.kpi_id))
          .reduce((sum, e) => sum + e.value, 0);
        const totalRevenueCard = filteredForCard
          .filter(e => revenueKpiIds.includes(e.kpi_id))
          .reduce((sum, e) => sum + e.value, 0);
        const periodDaysCard = Math.ceil(
          (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        const avgDailySalesCard = periodDaysCard > 0 ? totalSalesCard / periodDaysCard : 0;
        const avgDailyRevenueCard = periodDaysCard > 0 ? totalRevenueCard / periodDaysCard : 0;
        const hasRevenueKpis = revenueKpiIds.length > 0;

        // KPIs que NÃO são monetários — os monetários já aparecem como "Média Diária de Faturamento"
        const nonRevenueKpis = kpis.filter(k => k.kpi_type !== 'monetary');
        // Monetários para mostrar como cards normais (excluídos os que já estão na média)
        const revenueKpisForCards = kpis.filter(k => k.kpi_type === 'monetary');
        // Total de cards extras: até 2 se temos faturamento, até 3 se não temos
        const extraKpis = hasRevenueKpis
          ? nonRevenueKpis.slice(0, 2)
          : kpis.slice(0, 3);

        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Média de Vendas Diárias */}
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média de Vendas Diárias</CardTitle>
                <CalendarDays className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {avgDailySalesCard.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {totalSalesCard} vendas · {periodDaysCard} dias{salespersonId ? " · suas vendas" : ""}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: "100%" }} />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Média Diária de Faturamento — ao lado do de vendas */}
            {hasRevenueKpis && (
              <Card className="border-emerald-500/50 bg-emerald-500/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Diária de Faturamento</CardTitle>
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(avgDailyRevenueCard)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(totalRevenueCard)} · {periodDaysCard} dias
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: "100%" }} />
                  </div>
                </CardContent>
              </Card>
            )}

        {/* KPIs não-monetários (os monetários já estão no card de média diária de faturamento) */}
        {(hasRevenueKpis ? kpis.filter(k => k.kpi_type !== 'monetary') : kpis).slice(0, hasRevenueKpis ? 2 : 3).map(kpi => {
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
        );
      })()}

      {/* Flags de performance do time: <70% da meta do mês anterior = Red · 70–100% = Yellow · >100% = Green */}
      <SalespersonFlagsPanel
        companyId={companyId}
        salespersonId={salespersonId}
        isSalespersonView={isSalespersonView}
      />

      {/* Sales Funnel Chart */}
      {showWidget("sales_funnel") && (
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-card via-card to-card">
        {/* Decorative background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.04] via-fuchsia-500/[0.02] to-purple-600/[0.05] dark:from-violet-700/20 dark:via-fuchsia-600/10 dark:to-purple-800/15" />
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-radial from-violet-500/[0.08] to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-radial from-fuchsia-500/[0.06] to-transparent rounded-full blur-3xl" />
        <CardHeader className="relative pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
                <Filter className="h-4.5 w-4.5" />
                <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-purple-700 dark:from-violet-300 dark:via-fuchsia-300 dark:to-purple-300 bg-clip-text text-transparent">Funil de Vendas</CardTitle>
                <p className="text-xs text-muted-foreground">Conversão entre etapas do processo comercial</p>
              </div>
            </div>
            {salesFunnel.hasData && salesFunnel.overallConversion !== undefined && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-bold border-0 shadow-md bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-violet-700 dark:text-violet-300">
                  <Percent className="h-3 w-3" />
                  {salesFunnel.overallConversion.toFixed(1)}% conversão total
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative">
          {salesFunnel.hasData ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              {/* Visual funnel shape */}
              <div className="flex flex-col items-center gap-0 py-2">
                {salesFunnel.data.map((stage, index) => {
                  const maxValue = salesFunnel.data[0]?.value || 1;
                  const widthPercent = Math.max((stage.value / maxValue) * 100, 20);
                  const nextWidthPercent = index < salesFunnel.data.length - 1
                    ? Math.max((salesFunnel.data[index + 1].value / maxValue) * 100, 20)
                    : widthPercent * 0.85;
                  const funnelGradients = [
                    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                    'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    'linear-gradient(135deg, #a855f7, #7c3aed)',
                    'linear-gradient(135deg, #d946ef, #a855f7)',
                    'linear-gradient(135deg, #ec4899, #d946ef)',
                    'linear-gradient(135deg, #f43f5e, #ec4899)',
                    'linear-gradient(135deg, #f97316, #f43f5e)',
                    'linear-gradient(135deg, #10b981, #059669)',
                  ];
                  const gradient = funnelGradients[index % funnelGradients.length];
                  const isLast = index === salesFunnel.data.length - 1;
                  // Calculate clip-path to taper from current width to next width
                  const insetLeft = ((widthPercent - nextWidthPercent) / widthPercent) * 50;
                  const insetRight = 100 - insetLeft;

                  return (
                    <div key={stage.name} className="w-full flex flex-col items-center">
                      <div
                        className="relative flex items-center justify-center transition-all duration-500 hover:brightness-110 cursor-default"
                        style={{
                          width: `${widthPercent}%`,
                          minHeight: '52px',
                          background: gradient,
                          clipPath: `polygon(0% 0%, 100% 0%, ${insetRight}% 100%, ${insetLeft}% 100%)`,
                          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                        }}
                      >
                        <div className="flex items-center gap-2 text-white px-4 z-10">
                          <span className="font-bold text-sm drop-shadow-md">{stage.name}</span>
                          <span className="text-white/60 text-xs">•</span>
                          <span className="font-bold text-base drop-shadow-md tabular-nums">{stage.value.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" style={{ clipPath: 'inherit' }} />
                      </div>
                      {!isLast && (
                        <div className="flex items-center justify-center h-1 relative z-10">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm absolute -translate-y-1/2 ${
                            (salesFunnel.data[index + 1]?.conversionRate ?? 0) >= 50 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                            (salesFunnel.data[index + 1]?.conversionRate ?? 0) >= 20 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          }`}>
                            ↓ {salesFunnel.data[index + 1]?.conversionRate.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Side detail panel */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detalhes por Etapa</p>
                {salesFunnel.data.map((stage, index) => {
                  const funnelDots = ['#8b5cf6', '#7c3aed', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#10b981'];
                  return (
                    <div key={stage.name} className="flex items-center gap-3 rounded-lg border bg-card/60 p-2.5 backdrop-blur-sm">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: funnelDots[index % funnelDots.length] }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{stage.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{stage.kpiName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm tabular-nums">{stage.value.toLocaleString("pt-BR")}</p>
                        {index > 0 && (
                          <p className={`text-[10px] font-bold ${
                            stage.conversionRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' :
                            stage.conversionRate >= 20 ? 'text-amber-600 dark:text-amber-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>{stage.conversionRate.toFixed(1)}%</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-lg border-2 border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-center mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Conversão Total</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{salesFunnel.overallConversion?.toFixed(1) || '0'}%</p>
                  <p className="text-[10px] text-muted-foreground">{salesFunnel.data[0]?.name} → {salesFunnel.data[salesFunnel.data.length - 1]?.name}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
              <Filter className="h-14 w-14 mb-4 opacity-15" />
              <p className="font-medium">Nenhum dado para o funil no período</p>
              <p className="text-sm text-center max-w-md">Lance KPIs como Ligações, Atendimentos, Propostas e Vendas para visualizar o funil</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Target vs Realized Chart - per KPI when multiple main goals */}
      {showWidget("target_vs_realized") && (hasMultipleMainGoalsForCharts ? (
        <div className="space-y-4">
          {mainGoalKpisForCharts.map((kpi) => {
            const kpiTvR = getTargetVsRealizedData(kpi.id);
            return (
              <Card key={`tvr-${kpi.id}`} className="relative overflow-hidden border-0 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-900/[0.03] via-transparent to-cyan-900/[0.04] dark:from-teal-800/20 dark:via-transparent dark:to-cyan-900/15" />
                <CardHeader className="relative pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
                        <Target className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Meta x Realizado — {kpi.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">Evolução cumulativa</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  {kpiTvR.data.length > 0 && kpiTvR.targetLevels.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={kpiTvR.data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(value) => kpiTvR.kpiType === "monetary" ? new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(value) : value.toLocaleString("pt-BR")} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value: number, name: string) => [formatValue(value, kpiTvR.kpiType || "monetary"), name === "realizado" ? "Realizado" : name]} />
                        <Legend />
                        <Line type="monotone" dataKey="realizado" name="Realizado" stroke="#22c55e" strokeWidth={3} connectNulls={false} dot={{ fill: "#22c55e", r: 3, stroke: "#fff", strokeWidth: 2 }} />
                        {kpiTvR.targetLevels.map((levelName, index) => (
                          <Line key={levelName} type="monotone" dataKey={levelName} name={levelName} stroke={["#3b82f6", "#60a5fa", "#1d4ed8"][index % 3]} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                      <Target className="h-12 w-12 mb-4 opacity-20" />
                      <p className="font-medium">Nenhum dado para o período selecionado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="relative overflow-hidden border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900/[0.03] via-transparent to-cyan-900/[0.04] dark:from-teal-800/20 dark:via-transparent dark:to-cyan-900/15" />
          <CardHeader className="relative pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Meta x Realizado</CardTitle>
                  <p className="text-xs text-muted-foreground">Evolução cumulativa</p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1 border-0 bg-muted/60 px-3 py-1 text-xs font-medium">
                {targetVsRealized.kpiType === "monetary" ? (
                  <><DollarSign className="h-3 w-3" /> Faturamento</>
                ) : targetVsRealized.kpiType === "percentage" ? (
                  <><Percent className="h-3 w-3" /> Percentual</>
                ) : (
                  <><Hash className="h-3 w-3" /> Quantidade</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {targetVsRealized.data.length > 0 && targetVsRealized.targetLevels.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={targetVsRealized.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis 
                    tickFormatter={(value) => 
                      targetVsRealized.kpiType === "monetary" 
                        ? new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(value)
                        : targetVsRealized.kpiType === "percentage"
                          ? `${value.toFixed(0)}%`
                          : value.toLocaleString("pt-BR")
                    }
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatValue(value, targetVsRealized.kpiType || "monetary"),
                      name === "realizado" ? "Realizado" : name
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="realizado" name="Realizado" stroke="#22c55e" strokeWidth={3} connectNulls={false} dot={{ fill: "#22c55e", r: 3, stroke: "#fff", strokeWidth: 2 }} />
                  {targetVsRealized.targetLevels.map((levelName, index) => (
                    <Line 
                      key={levelName}
                      type="monotone" 
                      dataKey={levelName} 
                      name={levelName}
                      stroke={["#3b82f6", "#60a5fa", "#1d4ed8"][index % 3]} 
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
      ))}

      {/* Charts Row - Daily Evolution + Ranking */}
      {showWidget("daily_evolution") && (hasMultipleMainGoalsForCharts ? (
        <div className="space-y-4">
          {mainGoalKpisForCharts.map((kpi) => {
            const kpiDailyData = getDailyChartData(kpi.id);
            const kpiRankingData = getRankingData(kpi.id);
            return (
              <div key={`charts-${kpi.id}`} className="grid gap-6 lg:grid-cols-2">
                <Card className="relative overflow-hidden border-0 shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-900/[0.03] via-transparent to-blue-900/[0.04] dark:from-sky-800/20 dark:via-transparent dark:to-blue-900/15" />
                  <CardHeader className="relative pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Evolução Diária — {kpi.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">Desempenho dia a dia</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    {kpiDailyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={kpiDailyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value: number) => [formatValue(value, kpi.kpi_type), "Valor"]} />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Nenhum dado para o período selecionado
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-0 shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-900/[0.03] via-transparent to-rose-900/[0.04] dark:from-orange-800/20 dark:via-transparent dark:to-rose-900/15" />
                  <CardHeader className="relative pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Ranking — {kpi.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">Por performance no período</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    {isSalespersonView ? (
                      (() => {
                        const pos = getMyRankingPosition(kpi.id);
                        return pos !== null ? (
                          <div className="flex flex-col items-center justify-center h-[300px] gap-2">
                            <div className="text-7xl font-bold text-primary leading-none">{pos}º</div>
                            <p className="text-muted-foreground text-sm">sua posição no ranking</p>
                          </div>
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            Nenhum dado para o período selecionado
                          </div>
                        );
                      })()
                    ) : kpiRankingData.length > 0 && kpiRankingData.some(r => r.total > 0) ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={kpiRankingData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value: number) => [formatValue(value, kpi.kpi_type), "Total"]} />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
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
            );
          })}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-900/[0.03] via-transparent to-blue-900/[0.04] dark:from-sky-800/20 dark:via-transparent dark:to-blue-900/15" />
          <CardHeader className="relative pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Evolução Diária</CardTitle>
                <p className="text-xs text-muted-foreground">Desempenho dia a dia</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    formatter={(value: number) => [
                      selectedKpiData ? formatValue(value, selectedKpiData.kpi_type) : value.toLocaleString("pt-BR"),
                      "Valor"
                    ]}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-900/[0.03] via-transparent to-rose-900/[0.04] dark:from-orange-800/20 dark:via-transparent dark:to-rose-900/15" />
          <CardHeader className="relative pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Ranking de Vendedores</CardTitle>
                <p className="text-xs text-muted-foreground">Por performance no período</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {isSalespersonView ? (
              (() => {
                const pos = getMyRankingPosition();
                return pos !== null ? (
                  <div className="flex flex-col items-center justify-center h-[300px] gap-2">
                    <div className="text-7xl font-bold text-primary leading-none">{pos}º</div>
                    <p className="text-muted-foreground text-sm">sua posição no ranking</p>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </div>
                );
              })()
            ) : rankingData.length > 0 && rankingData.some(r => r.total > 0) ? (
              <RankingPodium
                data={rankingData}
                formatValue={(v) => selectedKpiData ? formatValue(v, selectedKpiData.kpi_type) : v.toLocaleString("pt-BR")}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      ))}

      {/* Detailed KPI Table */}
      <Card className="relative overflow-hidden border-0 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/[0.03] via-transparent to-gray-900/[0.04] dark:from-slate-800/20 dark:via-transparent dark:to-gray-900/15" />
        <CardHeader className="relative pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg shadow-slate-500/20">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Detalhamento por KPI</CardTitle>
              <p className="text-xs text-muted-foreground">{kpis.length} indicador{kpis.length !== 1 ? "es" : ""}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-2">
          {kpis.map((kpi, idx) => {
            const summary = getKpiSummary(kpi);
            const isOnTrack = summary.percentage >= 100;
            return (
              <div
                key={kpi.id}
                className={`relative overflow-hidden rounded-xl border p-3 transition-all hover:shadow-md ${
                  isOnTrack ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "bg-card/60 backdrop-blur-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getKpiIcon(kpi.kpi_type)}
                    <p className="text-sm font-semibold truncate">{kpi.name}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                      {kpi.is_individual ? "Individual" : "Coletivo"}
                    </Badge>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 border-0 font-bold shrink-0 ${
                      isOnTrack
                        ? "bg-emerald-500/15 text-emerald-600"
                        : summary.percentage >= 80
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-red-500/10 text-red-600"
                    }`}
                  >
                    {isOnTrack ? "✓ Meta Batida" : summary.percentage >= 80 ? "Próximo" : "Abaixo"}
                  </Badge>
                </div>

                <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOnTrack
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                        : summary.percentage >= 80
                        ? "bg-gradient-to-r from-amber-400 to-amber-500"
                        : "bg-gradient-to-r from-red-400 to-red-500"
                    }`}
                    style={{ width: `${Math.min(summary.percentage, 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Realizado: <strong className="text-foreground">{formatValue(summary.total, kpi.kpi_type)}</strong></span>
                  <span>Meta: {formatValue(summary.target, kpi.kpi_type)}</span>
                  <span className="font-bold text-foreground">{summary.percentage.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Sales Heatmap Charts — Vendas por Dia da Semana / do Mês */}
      {showWidget("sales_heatmap") && (hasMultipleMainGoalsForCharts ? (
        mainGoalKpisForCharts.filter(k => k.kpi_type === "monetary").map((kpi) => (
          <SalesHeatmapCharts
            key={`heatmap-${kpi.id}`}
            companyId={companyId}
            kpiIds={[kpi.id]}
            selectedSalesperson={selectedSalesperson}
            selectedUnit={selectedUnit}
            selectedTeam={selectedTeam}
            selectedSector={selectedSector}
            titleSuffix={kpi.name}
          />
        ))
      ) : (
        <SalesHeatmapCharts
          companyId={companyId}
          kpiIds={kpis.filter(k => k.kpi_type === "monetary").map(k => k.id)}
          selectedSalesperson={selectedSalesperson}
          selectedUnit={selectedUnit}
          selectedTeam={selectedTeam}
          selectedSector={selectedSector}
        />
      ))}

      {/* Endomarketing Campaigns Widget */}
      {showWidget("endomarketing") && projectId && (
        <CampaignDashboardWidget companyId={companyId} projectId={projectId} />
      )}

      {/* Gamification Widget */}
      {showWidget("gamification") && projectId && (
        <GamificationDashboardWidget companyId={companyId} projectId={projectId} />
      )}
    </div>
  );
};
