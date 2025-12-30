import { useEffect, useState, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  BarChart3,
  FileText,
  Calendar,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  CircleDot,
  Activity,
  CalendarDays,
  ChevronDown
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subWeeks, isWithinInterval, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PortalUser {
  id: string;
  company_id: string;
}

interface Plan {
  id: string;
  theme: string | null;
  status: string;
  context_data?: {
    current_revenue?: string;
    monthly_revenue?: string;
    avg_ticket?: string;
    [key: string]: any;
  };
}

interface KeyResult {
  id: string;
  title: string;
  target: number;
  current_value: number;
  baseline: number;
  status: string;
  unit: string;
  created_at: string;
  updated_at: string;
}

interface Objective {
  id: string;
  title: string;
  key_results: KeyResult[];
}

interface NorthStar {
  name: string;
  annual_target: number;
  unit: string;
  definition: string;
}

interface Checkin {
  id: string;
  key_result_id: string;
  current_value: number;
  week_ref: string;
  status: string;
  created_at: string;
}

type PeriodFilter = "current_week" | "last_week" | "current_month" | "last_month" | "current_quarter" | "year" | "all" | "custom";

const periodOptions = [
  { value: "current_week", label: "Esta Semana" },
  { value: "last_week", label: "Semana Passada" },
  { value: "current_month", label: "Mês Atual" },
  { value: "last_month", label: "Mês Anterior" },
  { value: "current_quarter", label: "Trimestre Atual" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Todo o Período" },
  { value: "custom", label: "Personalizado" },
];

const PortalDashboardPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("year");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [user?.company_id]);

  const loadDashboardData = async () => {
    if (!user?.company_id) return;

    try {
      const { data: planData } = await supabase
        .from("portal_plans")
        .select("*")
        .eq("company_id", user.company_id)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .single();

      if (!planData) {
        setLoading(false);
        return;
      }

      setPlan(planData as Plan);

      const { data: nsData } = await supabase
        .from("portal_north_stars")
        .select("*")
        .eq("plan_id", planData.id)
        .single();

      if (nsData) {
        setNorthStar(nsData);
      }

      const { data: objData } = await supabase
        .from("portal_objectives")
        .select("*, portal_key_results(*)")
        .eq("plan_id", planData.id)
        .order("priority");

      if (objData) {
        const mappedObjectives = objData.map(obj => ({
          id: obj.id,
          title: obj.title,
          key_results: (obj.portal_key_results || []).map((kr: any) => ({
            id: kr.id,
            title: kr.title,
            target: kr.target || 0,
            current_value: kr.current_value || 0,
            baseline: kr.baseline || 0,
            status: kr.status,
            unit: kr.unit || "",
            created_at: kr.created_at,
            updated_at: kr.updated_at,
          })),
        }));
        setObjectives(mappedObjectives);

        const allKrIds = mappedObjectives.flatMap(o => o.key_results.map(kr => kr.id));
        if (allKrIds.length > 0) {
          const { data: checkinData } = await supabase
            .from("portal_checkins")
            .select("*")
            .in("key_result_id", allKrIds)
            .order("week_ref", { ascending: true });

          if (checkinData) {
            setCheckins(checkinData);
          }
        }
      }

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodRange = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case "current_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "last_week":
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
      case "current_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "current_quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          return { start: customDateRange.from, end: customDateRange.to };
        }
        return { start: startOfYear(now), end: endOfYear(now) };
      case "all":
      default:
        return { start: new Date(2020, 0, 1), end: endOfYear(now) };
    }
  };

  const filteredCheckins = useMemo(() => {
    const range = getPeriodRange(periodFilter);
    return checkins.filter(c => {
      const date = parseISO(c.week_ref);
      return isWithinInterval(date, { start: range.start, end: range.end });
    });
  }, [checkins, periodFilter, customDateRange]);

  const handlePeriodChange = (value: string) => {
    const newPeriod = value as PeriodFilter;
    setPeriodFilter(newPeriod);
    if (newPeriod === "custom") {
      setIsDatePickerOpen(true);
    }
  };

  const handleDateRangeSelect = (range: { from: Date | undefined; to: Date | undefined }) => {
    setCustomDateRange(range);
    if (range.from && range.to) {
      setIsDatePickerOpen(false);
    }
  };

  const getFilterDisplayLabel = () => {
    if (periodFilter === "custom" && customDateRange.from && customDateRange.to) {
      return `${format(customDateRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yy", { locale: ptBR })}`;
    }
    return periodOptions.find(o => o.value === periodFilter)?.label || "Período";
  };

  const stats = useMemo(() => {
    const allKRs = objectives.flatMap(o => o.key_results);
    const totalKRs = allKRs.length;
    
    const onTrack = allKRs.filter(kr => kr.status === "on_track").length;
    const attention = allKRs.filter(kr => kr.status === "attention").length;
    const offTrack = allKRs.filter(kr => kr.status === "off_track").length;
    const completed = allKRs.filter(kr => kr.status === "completed").length;

    const totalTarget = allKRs.reduce((sum, kr) => sum + kr.target, 0);
    const totalRealized = allKRs.reduce((sum, kr) => sum + kr.current_value, 0);

    const currentRevenue = plan?.context_data?.current_revenue 
      ? parseFloat(plan.context_data.current_revenue.replace(/\D/g, '')) 
      : 0;

    const periodCheckinsCount = filteredCheckins.length;
    const periodKRsUpdated = new Set(filteredCheckins.map(c => c.key_result_id)).size;

    return {
      totalKRs,
      onTrack,
      attention,
      offTrack,
      completed,
      totalTarget,
      totalRealized,
      currentRevenue,
      periodCheckinsCount,
      periodKRsUpdated,
      completionRate: totalKRs > 0 ? Math.round(((completed + onTrack) / totalKRs) * 100) : 0,
      progressRate: totalTarget > 0 ? Math.min(Math.round((totalRealized / totalTarget) * 100), 999) : 0,
    };
  }, [objectives, filteredCheckins, plan]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "on_track": 
        return { label: "On Track", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
      case "attention": 
        return { label: "Atenção", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
      case "off_track": 
        return { label: "Off Track", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
      case "completed": 
        return { label: "Concluído", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
      default: 
        return { label: status, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    }
  };

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toLocaleString("pt-BR");
  };

  const getPeriodLabel = () => {
    const range = getPeriodRange(periodFilter);
    return `${format(range.start, "dd MMM", { locale: ptBR })} - ${format(range.end, "dd MMM yyyy", { locale: ptBR })}`;
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 bg-slate-800/50 rounded-lg" />
          <div className="h-32 bg-slate-800/50 rounded-2xl" />
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl text-center py-16">
          <BarChart3 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Nenhum plano publicado</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Publique seu planejamento estratégico para visualizar o dashboard com métricas e progresso.
          </p>
          <Link to="/portal/app/planejamento">
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium">
              Criar Planejamento
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {plan.theme || "Planejamento 2026"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-auto min-w-[180px] justify-start text-left font-normal bg-slate-900/50 border-slate-800 text-slate-300 h-9 text-sm hover:bg-slate-800 hover:border-slate-700",
                  periodFilter === "custom" && customDateRange.from && "text-amber-400"
                )}
              >
                <CalendarDays className="w-4 h-4 mr-2 text-slate-500" />
                <span className="flex-1">{getFilterDisplayLabel()}</span>
                <ChevronDown className="w-4 h-4 ml-2 text-slate-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 bg-slate-900 border-slate-800" 
              align="end"
              sideOffset={8}
            >
              <div className="flex">
                {/* Quick filters */}
                <div className="border-r border-slate-800 p-2 w-40">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-1.5 mb-1">Período</p>
                  {periodOptions.filter(o => o.value !== "custom").map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setPeriodFilter(opt.value as PeriodFilter);
                        if (opt.value !== "custom") {
                          setIsDatePickerOpen(false);
                        }
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                        periodFilter === opt.value 
                          ? "bg-amber-500/10 text-amber-400" 
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="border-t border-slate-800 my-2" />
                  <button
                    onClick={() => setPeriodFilter("custom")}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                      periodFilter === "custom" 
                        ? "bg-amber-500/10 text-amber-400" 
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                    )}
                  >
                    Personalizado
                  </button>
                </div>
                
                {/* Calendar for custom range */}
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Selecione o período</p>
                  <CalendarComponent
                    mode="range"
                    selected={{ from: customDateRange.from, to: customDateRange.to }}
                    onSelect={(range) => {
                      if (range) {
                        handleDateRangeSelect({ from: range.from, to: range.to });
                        if (range.from) {
                          setPeriodFilter("custom");
                        }
                      }
                    }}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                    locale={ptBR}
                  />
                  {customDateRange.from && customDateRange.to && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-500">
                        {format(customDateRange.from, "dd MMM yyyy", { locale: ptBR })} - {format(customDateRange.to, "dd MMM yyyy", { locale: ptBR })}
                      </p>
                      <Button 
                        size="sm" 
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 h-7 text-xs"
                        onClick={() => setIsDatePickerOpen(false)}
                      >
                        Aplicar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Link to={`/portal/app/planejamento/${plan.id}`}>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" />
              Ver Plano
            </Button>
          </Link>
        </div>
      </div>

      {/* North Star Card */}
      {northStar && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900/90 border border-slate-800/50 p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Flame className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-amber-500/80 text-xs font-medium uppercase tracking-wider mb-1">North Star Metric</p>
                <h2 className="text-xl font-bold text-white">{northStar.name}</h2>
                {northStar.definition && (
                  <p className="text-slate-500 text-sm mt-1 max-w-lg">{northStar.definition}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-5 py-3 border border-slate-700/50">
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-0.5">Meta Anual</p>
                <p className="text-2xl font-bold text-white">
                  {northStar.unit === "R$" ? formatCurrency(northStar.annual_target || 0) : formatNumber(northStar.annual_target || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento */}
        <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 p-5 hover:border-slate-700/50 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Faturamento</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.currentRevenue)}</p>
          <p className="text-xs text-slate-600 mt-1">Base informada</p>
        </div>

        {/* Progresso */}
        <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 p-5 hover:border-slate-700/50 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Progresso</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-white">{stats.progressRate}%</p>
            {stats.progressRate >= 50 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">Meta vs Realizado</p>
        </div>

        {/* Taxa de Sucesso */}
        <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 p-5 hover:border-slate-700/50 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sucesso</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.completionRate}%</p>
          <p className="text-xs text-slate-600 mt-1">KRs no caminho</p>
        </div>

        {/* Check-ins */}
        <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 p-5 hover:border-slate-700/50 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Check-ins</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CircleDot className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.periodCheckinsCount}</p>
          <p className="text-xs text-slate-600 mt-1">{stats.periodKRsUpdated} KRs atualizados</p>
        </div>
      </div>

      {/* Status Pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full px-4 py-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-500">{stats.onTrack}</span>
          <span className="text-xs text-emerald-500/70">On Track</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-full px-4 py-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-500">{stats.attention}</span>
          <span className="text-xs text-amber-500/70">Atenção</span>
        </div>
        <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-full px-4 py-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-red-500">{stats.offTrack}</span>
          <span className="text-xs text-red-500/70">Off Track</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-full px-4 py-2">
          <Award className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-500">{stats.completed}</span>
          <span className="text-xs text-blue-500/70">Concluído</span>
        </div>
      </div>

      {/* Objectives Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Objetivos</h2>
          <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
            {stats.totalKRs} KRs • {objectives.length} Objetivos
          </span>
        </div>

        {objectives.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl text-center py-12">
            <Target className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum objetivo cadastrado</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {objectives.map((obj, index) => {
              const objTarget = obj.key_results.reduce((sum, kr) => sum + kr.target, 0);
              const objRealized = obj.key_results.reduce((sum, kr) => sum + kr.current_value, 0);
              const objProgress = objTarget > 0 ? Math.min(Math.round((objRealized / objTarget) * 100), 100) : 0;

              return (
                <div key={obj.id} className="bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden hover:border-slate-700/50 transition-colors">
                  {/* Objective Header */}
                  <div className="p-5 flex items-center justify-between border-b border-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{obj.title}</h3>
                        <p className="text-xs text-slate-500">{obj.key_results.length} Key Result{obj.key_results.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                          style={{ width: `${objProgress}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-white min-w-[3rem] text-right">{objProgress}%</span>
                    </div>
                  </div>

                  {/* Key Results */}
                  {obj.key_results.length > 0 && (
                    <div className="divide-y divide-slate-800/50">
                      {obj.key_results.map((kr, krIndex) => {
                        const progress = calculateProgress(kr.current_value, kr.target);
                        const isAchieved = kr.current_value >= kr.target && kr.target > 0;
                        const statusInfo = getStatusInfo(kr.status);

                        return (
                          <div key={kr.id} className="p-5 hover:bg-slate-800/20 transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-start gap-3 flex-1">
                                <span className="text-xs text-slate-600 font-mono mt-0.5">KR{krIndex + 1}</span>
                                <span className="text-slate-300 text-sm leading-relaxed">{kr.title}</span>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
                                {statusInfo.label}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex-1 bg-slate-800/50 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 rounded-full ${
                                    isAchieved 
                                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                                      : 'bg-gradient-to-r from-slate-500 to-slate-400'
                                  }`}
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-2 min-w-[120px] justify-end text-sm">
                                <span className={`font-semibold ${isAchieved ? 'text-emerald-400' : 'text-white'}`}>
                                  {formatNumber(kr.current_value)}
                                </span>
                                <span className="text-slate-600">/</span>
                                <span className="text-slate-500">{formatNumber(kr.target)}</span>
                              </div>
                            </div>

                            {isAchieved && (
                              <div className="flex items-center gap-1.5 mt-3">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-xs text-emerald-500 font-medium">Meta atingida</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Period Info Footer */}
      <div className="text-center pt-4">
        <p className="text-xs text-slate-600">
          Período: {getPeriodLabel()}
        </p>
      </div>
    </div>
  );
};

export default PortalDashboardPage;
