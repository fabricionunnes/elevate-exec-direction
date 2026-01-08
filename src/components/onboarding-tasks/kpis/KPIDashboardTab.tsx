import { useState, useEffect } from "react";
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
import { format, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Target, Users, DollarSign, Percent, Hash, CalendarDays, Building2, Check, Filter } from "lucide-react";
import { CampaignDashboardWidget } from "../endomarketing/CampaignDashboardWidget";
import { GamificationDashboardWidget } from "../gamification/GamificationDashboardWidget";
import { SalesHistoryDialog } from "./SalesHistoryDialog";
import { SalesComparisonChart } from "./SalesComparisonChart";
import { KPIEntriesHistoryDialog } from "./KPIEntriesHistoryDialog";

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
}

interface Salesperson {
  id: string;
  name: string;
  is_active: boolean;
  unit_id: string | null;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  entry_date: string;
  value: number;
  unit_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface KPIDashboardTabProps {
  companyId: string;
  projectId?: string;
  canDeleteEntries?: boolean; // Admin or CS only
}

// Raw monthly targets storage (all scopes: company, unit, salesperson)
interface MonthlyTarget {
  id: string;
  kpi_id: string;
  level_name: string;
  level_order: number;
  target_value: number;
  unit_id: string | null;
  salesperson_id: string | null;
}

export const KPIDashboardTab = ({ companyId, projectId, canDeleteEntries = false }: KPIDashboardTabProps) => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allMonthlyTargets, setAllMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [selectedKpi, setSelectedKpi] = useState<string>("all");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [salesHistoryRefreshKey, setSalesHistoryRefreshKey] = useState(0);
  const [contractStartDate, setContractStartDate] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [companyId, dateRange]);

  const fetchData = async () => {
    console.log("[KPIDashboardTab] Fetching data for companyId:", companyId);
    
    if (!companyId) {
      console.warn("[KPIDashboardTab] No companyId provided");
      setLoading(false);
      return;
    }

    try {
      // Get the current month for monthly targets
      const currentMonthYear = format(new Date(), "yyyy-MM");

      const [kpisRes, salespeopleRes, entriesRes, unitsRes, companyRes, monthlyTargetsRes] = await Promise.all([
        supabase.from("company_kpis").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
        supabase.from("company_salespeople").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("kpi_entries").select("*").eq("company_id", companyId).gte("entry_date", dateRange.start).lte("entry_date", dateRange.end),
        supabase.from("company_units").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("onboarding_companies").select("contract_start_date").eq("id", companyId).single(),
        supabase.from("kpi_monthly_targets").select("*").eq("company_id", companyId).eq("month_year", currentMonthYear).order("level_order"),
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
        monthlyTargets: monthlyTargetsRes.data?.length || 0,
      });

      if (kpisRes.error) throw kpisRes.error;
      if (salespeopleRes.error) throw salespeopleRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (unitsRes.error) throw unitsRes.error;

      // Store all monthly targets for later filtering by unit/salesperson
      setAllMonthlyTargets((monthlyTargetsRes.data || []) as MonthlyTarget[]);

      // Build initial map of monthly targets (company-level only, no unit/salesperson filter)
      const companyLevelTargets = (monthlyTargetsRes.data || []).filter(
        (mt: any) => mt.unit_id === null && mt.salesperson_id === null
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
      if (companyRes.data) {
        setContractStartDate(companyRes.data.contract_start_date);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get targets based on current filter (unit or salesperson)
  const getFilteredTargetsForKpi = (kpiId: string): Record<string, number> => {
    // Priority: salesperson > unit > company
    let relevantTargets: MonthlyTarget[] = [];
    
    if (selectedSalesperson !== "all") {
      // Get salesperson-specific targets
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.salesperson_id === selectedSalesperson
      );
    }
    
    if (relevantTargets.length === 0 && selectedUnit !== "all") {
      // Get unit-specific targets
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id === selectedUnit && mt.salesperson_id === null
      );
    }
    
    if (relevantTargets.length === 0) {
      // Fallback to company-level targets
      relevantTargets = allMonthlyTargets.filter(
        mt => mt.kpi_id === kpiId && mt.unit_id === null && mt.salesperson_id === null
      );
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

  // Filter entries based on selected unit
  const getFilteredEntries = () => {
    return entries.filter(e => {
      if (selectedUnit !== "all" && e.unit_id !== selectedUnit) return false;
      return true;
    });
  };

  // Calculate KPI summaries
  const getKpiSummary = (kpi: KPI) => {
    const filteredEntries = getFilteredEntries();
    const kpiEntries = filteredEntries.filter(e => e.kpi_id === kpi.id);
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
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;
    const timeProgress = currentDay / daysInMonth;

    // Get entries for current month only, filtered by unit
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const allMonthEntries = entries.filter(e => e.entry_date >= monthStart && e.entry_date <= monthEnd);
    const monthEntries = selectedUnit !== "all" 
      ? allMonthEntries.filter(e => e.unit_id === selectedUnit)
      : allMonthEntries;

    // Sum all entries and targets for monetary KPIs (main revenue KPIs)
    let totalRealized = 0;
    let totalTarget = 0;

    kpis.forEach(kpi => {
      const kpiEntries = monthEntries.filter(e => e.kpi_id === kpi.id);
      const kpiTotal = kpiEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Use filtered target based on selected unit/salesperson
      const baseTarget = getEffectiveTargetForKpi(kpi);
      let monthlyTarget = baseTarget;
      if (kpi.periodicity === "daily") {
        monthlyTarget = baseTarget * daysInMonth;
      } else if (kpi.periodicity === "weekly") {
        monthlyTarget = baseTarget * Math.ceil(daysInMonth / 7);
      }

      // Only sum monetary KPIs for the main projection (faturamento)
      if (kpi.kpi_type === "monetary") {
        totalRealized += kpiTotal;
        totalTarget += monthlyTarget;
      }
    });

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
    };
  };

  const projection = getMonthlyProjection();

  // Prepare chart data - Daily evolution
  const getDailyChartData = () => {
    const filteredEntries = entries.filter(e => {
      if (selectedKpi !== "all" && e.kpi_id !== selectedKpi) return false;
      if (selectedSalesperson !== "all" && e.salesperson_id !== selectedSalesperson) return false;
      if (selectedUnit !== "all" && e.unit_id !== selectedUnit) return false;
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

  // Get target vs realized chart data - ALWAYS use monetary KPIs (faturamento, receita, valor de vendas)
  const getTargetVsRealizedData = () => {
    // Get only monetary KPIs for this chart
    const monetaryKpis = kpis.filter(k => k.kpi_type === "monetary");
    const monetaryKpiIds = monetaryKpis.map(k => k.id);
    
    // Filter entries to only include monetary KPIs and apply unit filter
    const filteredEntries = entries.filter(e => {
      if (!monetaryKpiIds.includes(e.kpi_id)) return false;
      if (selectedUnit !== "all" && e.unit_id !== selectedUnit) return false;
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
    if (sortedDates.length === 0) return { data: [], targetLevels: [] };

    // Calculate target levels - aggregate all monetary KPI targets using filtered targets
    let targetLevelsMap: Record<string, number> = {};
    
    monetaryKpis.forEach(kpi => {
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

    return { data: chartData, targetLevels: targetLevelNames };
  };

  // Prepare ranking data
  const getRankingData = () => {
    const filteredSalespeople = selectedUnit !== "all"
      ? salespeople.filter(sp => sp.unit_id === selectedUnit)
      : salespeople;
      
    const rankingMap: Record<string, { name: string; total: number }> = {};
    
    filteredSalespeople.forEach(sp => {
      rankingMap[sp.id] = { name: sp.name, total: 0 };
    });

    entries.forEach(entry => {
      if (selectedKpi !== "all" && entry.kpi_id !== selectedKpi) return;
      if (selectedUnit !== "all" && entry.unit_id !== selectedUnit) return;
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
    const leadsKpi = findKpiByPattern(['lead', 'leads', 'oportunidade', 'oportunidades', 'atendimento', 'atendimentos', 'contato', 'contatos']);
    const proposalsKpi = findKpiByPattern(['proposta', 'propostas', 'orçamento', 'orcamento']);
    const salesKpi = findKpiByPattern(['venda', 'vendas', 'fechamento', 'fechamentos', 'qtd venda', 'quantidade venda']);
    const revenueKpi = kpis.find(k => k.kpi_type === 'monetary');
    const meetingsKpi = findKpiByPattern(['reunião', 'reuniao', 'reuniões', 'reunioes', 'call', 'calls', 'ligação', 'ligações']);

    // Calculate totals for each found KPI
    const getKpiTotal = (kpi: KPI | undefined) => {
      if (!kpi) return 0;
      return filteredEntries.filter(e => e.kpi_id === kpi.id).reduce((sum, e) => sum + e.value, 0);
    };

    const totalLeads = getKpiTotal(leadsKpi);
    const totalProposals = getKpiTotal(proposalsKpi);
    const totalSales = getKpiTotal(salesKpi);
    const totalRevenue = getKpiTotal(revenueKpi);
    const totalMeetings = getKpiTotal(meetingsKpi);

    // Calculate conversion rates
    const leadToProposal = totalLeads > 0 ? (totalProposals / totalLeads) * 100 : 0;
    const proposalToSale = totalProposals > 0 ? (totalSales / totalProposals) * 100 : 0;
    const leadToSale = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;

    // Calculate average ticket
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return {
      totalLeads,
      totalProposals,
      totalSales,
      totalRevenue,
      totalMeetings,
      leadToProposal,
      proposalToSale,
      leadToSale,
      avgTicket,
      hasLeadsData: !!leadsKpi && totalLeads > 0,
      hasProposalsData: !!proposalsKpi && totalProposals > 0,
      hasSalesData: !!salesKpi && totalSales > 0,
      hasRevenueData: !!revenueKpi && totalRevenue > 0,
      hasMeetingsData: !!meetingsKpi && totalMeetings > 0,
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
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>KPI</Label>
              <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os KPIs</SelectItem>
                  {kpis.map(kpi => (
                    <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {units.length > 0 && (
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Unidades</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {salespeople.map(sp => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <SalesHistoryDialog 
                companyId={companyId} 
                contractStartDate={contractStartDate}
                onDataChange={() => setSalesHistoryRefreshKey(prev => prev + 1)}
              />
            </div>
            <div className="flex items-end">
              <KPIEntriesHistoryDialog 
                companyId={companyId}
                canDelete={canDeleteEntries}
                onEntryDeleted={fetchData}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Projection Card */}
      {projection.target > 0 && (
        <Card className={`border-2 ${
          projection.projectionPercent >= 100 ? 'border-green-500 bg-green-500/5' :
          projection.projectionPercent >= 70 ? 'border-amber-500 bg-amber-500/5' :
          'border-destructive bg-destructive/5'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Projeção do Mês
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
                <p className="text-2xl font-bold">{formatValue(projection.realized, "monetary")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meta do Mês</p>
                <p className="text-2xl font-bold">{formatValue(projection.target, "monetary")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Projetado</p>
                <p className="text-2xl font-bold">{formatValue(projection.projectedValue, "monetary")}</p>
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
                {/* Target progress indicator */}
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

      {/* Sales Comparison Chart - Before vs After UNV */}
      <SalesComparisonChart 
        companyId={companyId} 
        contractStartDate={contractStartDate}
        currentMonthRevenue={calculatedMetrics.totalRevenue}
        refreshKey={salesHistoryRefreshKey}
      />

      {/* Conversion Card - Small */}
      {calculatedMetrics.hasLeadsData && calculatedMetrics.hasSalesData && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão de Vendas</CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              calculatedMetrics.leadToSale >= 20 ? 'text-green-600' :
              calculatedMetrics.leadToSale >= 10 ? 'text-amber-600' :
              'text-destructive'
            }`}>
              {calculatedMetrics.leadToSale.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatedMetrics.totalSales} vendas de {calculatedMetrics.totalLeads} leads
            </p>
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

      {/* Target vs Realized Chart - Always show (Monetary KPIs only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Meta x Realizado (Faturamento)
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              KPIs Monetários
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
                    new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(value)
                  }
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatValue(value, "monetary"),
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
