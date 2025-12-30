import { useEffect, useState, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  BarChart3,
  FileText,
  Calendar,
  DollarSign,
  Zap,
  Award,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

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

type PeriodFilter = "current_month" | "last_month" | "current_quarter" | "year" | "all";

const periodOptions = [
  { value: "current_month", label: "Mês Atual" },
  { value: "last_month", label: "Mês Anterior" },
  { value: "current_quarter", label: "Trimestre Atual" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Todo o Período" },
];

const PortalDashboardPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("current_month");

  useEffect(() => {
    loadDashboardData();
  }, [user?.company_id]);

  const loadDashboardData = async () => {
    if (!user?.company_id) return;

    try {
      // Load published plan
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

      // Load north star
      const { data: nsData } = await supabase
        .from("portal_north_stars")
        .select("*")
        .eq("plan_id", planData.id)
        .single();

      if (nsData) {
        setNorthStar(nsData);
      }

      // Load objectives with key results
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

        // Load all checkins for these KRs
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

  // Get period date range
  const getPeriodRange = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case "current_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "current_quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "all":
      default:
        return { start: new Date(2020, 0, 1), end: endOfYear(now) };
    }
  };

  // Filter checkins by period
  const filteredCheckins = useMemo(() => {
    const range = getPeriodRange(periodFilter);
    return checkins.filter(c => {
      const date = parseISO(c.week_ref);
      return isWithinInterval(date, { start: range.start, end: range.end });
    });
  }, [checkins, periodFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const allKRs = objectives.flatMap(o => o.key_results);
    const totalKRs = allKRs.length;
    
    // Count by status
    const onTrack = allKRs.filter(kr => kr.status === "on_track").length;
    const attention = allKRs.filter(kr => kr.status === "attention").length;
    const offTrack = allKRs.filter(kr => kr.status === "off_track").length;
    const completed = allKRs.filter(kr => kr.status === "completed").length;

    // Calculate total realized vs target
    const totalTarget = allKRs.reduce((sum, kr) => sum + kr.target, 0);
    const totalRealized = allKRs.reduce((sum, kr) => sum + kr.current_value, 0);
    const totalBaseline = allKRs.reduce((sum, kr) => sum + (kr.baseline || 0), 0);

    // Calculate revenue if available from context_data
    const currentRevenue = plan?.context_data?.current_revenue 
      ? parseFloat(plan.context_data.current_revenue.replace(/\D/g, '')) 
      : 0;

    // Period specific stats
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
      totalBaseline,
      currentRevenue,
      periodCheckinsCount,
      periodKRsUpdated,
      completionRate: totalKRs > 0 ? Math.round(((completed + onTrack) / totalKRs) * 100) : 0,
      progressRate: totalTarget > 0 ? Math.round((totalRealized / totalTarget) * 100) : 0,
    };
  }, [objectives, filteredCheckins, plan]);

  // Chart data for KR status
  const statusChartData = useMemo(() => [
    { name: "On Track", value: stats.onTrack, fill: "hsl(142, 76%, 36%)" },
    { name: "Atenção", value: stats.attention, fill: "hsl(45, 93%, 47%)" },
    { name: "Off Track", value: stats.offTrack, fill: "hsl(0, 84%, 60%)" },
    { name: "Concluído", value: stats.completed, fill: "hsl(217, 91%, 60%)" },
  ].filter(item => item.value > 0), [stats]);

  // Chart data for objectives progress
  const objectivesChartData = useMemo(() => 
    objectives.map(obj => {
      const totalTarget = obj.key_results.reduce((sum, kr) => sum + kr.target, 0);
      const totalRealized = obj.key_results.reduce((sum, kr) => sum + kr.current_value, 0);
      return {
        name: obj.title.length > 20 ? obj.title.substring(0, 20) + "..." : obj.title,
        fullName: obj.title,
        meta: totalTarget,
        realizado: totalRealized,
        progress: totalTarget > 0 ? Math.round((totalRealized / totalTarget) * 100) : 0,
      };
    }), [objectives]);

  const chartConfig: ChartConfig = {
    meta: {
      label: "Meta",
      color: "hsl(var(--muted))",
    },
    realizado: {
      label: "Realizado",
      color: "hsl(var(--primary))",
    },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "text-green-400 bg-green-500/10";
      case "attention": return "text-yellow-400 bg-yellow-500/10";
      case "off_track": return "text-red-400 bg-red-500/10";
      case "completed": return "text-blue-400 bg-blue-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "on_track": return "On Track";
      case "attention": return "Atenção";
      case "off_track": return "Off Track";
      case "completed": return "Concluído";
      default: return status;
    }
  };

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getPeriodLabel = () => {
    const range = getPeriodRange(periodFilter);
    return `${format(range.start, "dd/MM", { locale: ptBR })} - ${format(range.end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg" />
            ))}
          </div>
          <div className="h-80 bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Card className="bg-slate-900/50 border-slate-800 text-center py-12">
          <CardContent>
            <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Nenhum plano publicado</h2>
            <p className="text-slate-400 mb-6">
              Publique seu planejamento 2026 para acompanhar o dashboard.
            </p>
            <Link to="/portal/app/planejamento">
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                Ir para Planejamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-slate-400 text-sm">
            {plan.theme || "Planejamento 2026"} • {getPeriodLabel()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-slate-700">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to={`/portal/app/planejamento/${plan.id}`}>
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" />
              Ver Plano
            </Button>
          </Link>
        </div>
      </div>

      {/* North Star Highlight */}
      {northStar && (
        <Card className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30 overflow-hidden relative">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/10 to-transparent" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Target className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 text-sm font-medium">North Star Metric</p>
                  <h2 className="text-xl lg:text-2xl font-bold text-white">{northStar.name}</h2>
                  {northStar.definition && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-1">{northStar.definition}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-slate-400 text-xs mb-1">Meta Anual</p>
                  <p className="text-2xl lg:text-3xl font-bold text-white">
                    {northStar.unit === "R$" ? formatCurrency(northStar.annual_target || 0) : northStar.annual_target?.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-emerald-400 text-xs font-medium mb-1">Faturamento Base</p>
                <p className="text-2xl lg:text-3xl font-bold text-white">
                  {formatCurrency(stats.currentRevenue)}
                </p>
                <p className="text-slate-400 text-xs mt-1">Receita atual informada</p>
              </div>
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Rate */}
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-400 text-xs font-medium mb-1">Progresso Geral</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl lg:text-3xl font-bold text-white">{stats.progressRate}%</p>
                  {stats.progressRate >= 50 ? (
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-1">Meta vs Realizado</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-400 text-xs font-medium mb-1">Taxa de Sucesso</p>
                <p className="text-2xl lg:text-3xl font-bold text-white">{stats.completionRate}%</p>
                <p className="text-slate-400 text-xs mt-1">KRs on track + concluídos</p>
              </div>
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check-ins in Period */}
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-400 text-xs font-medium mb-1">Check-ins no Período</p>
                <p className="text-2xl lg:text-3xl font-bold text-white">{stats.periodCheckinsCount}</p>
                <p className="text-slate-400 text-xs mt-1">{stats.periodKRsUpdated} KRs atualizados</p>
              </div>
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats.onTrack}</p>
              <p className="text-xs text-green-400">On Track</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats.attention}</p>
              <p className="text-xs text-yellow-400">Atenção</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats.offTrack}</p>
              <p className="text-xs text-red-400">Off Track</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats.completed}</p>
              <p className="text-xs text-blue-400">Concluído</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Meta vs Realizado by Objective */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              Meta x Realizado por Objetivo
            </CardTitle>
            <CardDescription className="text-slate-400">
              Comparativo de performance por objetivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {objectivesChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={objectivesChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100} 
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="meta" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} name="Meta" />
                    <Bar dataKey="realizado" fill="hsl(45, 93%, 47%)" radius={[0, 4, 4, 0]} name="Realizado" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-500">
                Nenhum objetivo cadastrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Distribuição de Status
            </CardTitle>
            <CardDescription className="text-slate-400">
              Saúde geral dos Key Results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: '#64748b' }}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-500">
                Nenhum KR cadastrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Objectives */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Objetivos e Key Results
            </span>
            <span className="text-sm font-normal text-slate-400">
              {stats.totalKRs} KRs • {objectives.length} Objetivos
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {objectives.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhum objetivo cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-6">
              {objectives.map((obj, index) => {
                const objTarget = obj.key_results.reduce((sum, kr) => sum + kr.target, 0);
                const objRealized = obj.key_results.reduce((sum, kr) => sum + kr.current_value, 0);
                const objProgress = objTarget > 0 ? Math.round((objRealized / objTarget) * 100) : 0;

                return (
                  <div key={obj.id} className="border border-slate-800 rounded-lg overflow-hidden">
                    {/* Objective Header */}
                    <div className="bg-slate-800/50 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                          O{index + 1}
                        </span>
                        <div>
                          <h3 className="text-white font-medium">{obj.title}</h3>
                          <p className="text-slate-400 text-xs">
                            {obj.key_results.length} Key Results
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-white font-bold">{objProgress}%</p>
                          <p className="text-slate-400 text-xs">Progresso</p>
                        </div>
                        <div className="w-24">
                          <Progress value={objProgress} className="h-2 bg-slate-700" />
                        </div>
                      </div>
                    </div>

                    {/* Key Results */}
                    {obj.key_results.length > 0 && (
                      <div className="divide-y divide-slate-800">
                        {obj.key_results.map((kr, krIndex) => {
                          const progress = calculateProgress(kr.current_value, kr.target);
                          const isAchieved = kr.current_value >= kr.target;

                          return (
                            <div key={kr.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-start gap-2 flex-1">
                                  <span className="text-slate-500 text-xs font-medium mt-0.5">KR{krIndex + 1}</span>
                                  <span className="text-slate-200 text-sm">{kr.title}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getStatusColor(kr.status)}`}>
                                  {getStatusLabel(kr.status)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <Progress 
                                  value={progress} 
                                  className={`flex-1 h-2 ${isAchieved ? 'bg-green-900/30' : 'bg-slate-700'}`} 
                                />
                                <div className="flex items-center gap-2 min-w-[140px] justify-end">
                                  <span className={`font-medium ${isAchieved ? 'text-green-400' : 'text-white'}`}>
                                    {kr.current_value.toLocaleString("pt-BR")}
                                  </span>
                                  <span className="text-slate-500">/</span>
                                  <span className="text-slate-400">{kr.target.toLocaleString("pt-BR")}</span>
                                  {kr.unit && <span className="text-slate-500 text-xs">{kr.unit}</span>}
                                </div>
                              </div>

                              {isAchieved && (
                                <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Meta atingida!
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
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalDashboardPage;
