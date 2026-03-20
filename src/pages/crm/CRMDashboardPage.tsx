import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Phone,
  Calendar,
  FileText,
  Trophy,
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  Target,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Zap
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { getRemainingBusinessDaysInMonth } from "@/lib/businessDays";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from "recharts";
import { Link } from "react-router-dom";

interface DashboardMetrics {
  newLeads: number;
  workedLeads: number;
  meetingsScheduled: number;
  meetingsHeld: number;
  proposalsSent: number;
  won: number;
  lost: number;
  conversionRate: number;
  pipelineValue: number;
  forecast: number;
  totalRevenue: number;
}

interface StageData {
  name: string;
  count: number;
  value: number;
  color: string;
}

export const CRMDashboardPage = () => {
  const { staffRole, isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  const [period, setPeriod] = useState("month");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    newLeads: 0,
    workedLeads: 0,
    meetingsScheduled: 0,
    meetingsHeld: 0,
    proposalsSent: 0,
    won: 0,
    lost: 0,
    conversionRate: 0,
    pipelineValue: 0,
    forecast: 0,
    totalRevenue: 0,
  });
  const [stageData, setStageData] = useState<StageData[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [overdueLeads, setOverdueLeads] = useState<any[]>([]);
  const [noActivityLeads, setNoActivityLeads] = useState<any[]>([]);
  const [topOpportunities, setTopOpportunities] = useState<any[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [dailyGoal, setDailyGoal] = useState<{
    monthlyTarget: number;
    achieved: number;
    remaining: number;
    businessDaysLeft: number;
    dailyTarget: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "week":
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
        return { start: quarterStart, end: quarterEnd };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: pipelinesData } = await supabase
          .from("crm_pipelines")
          .select("*")
          .eq("is_active", true);
        setPipelines(pipelinesData || []);

        if (isAdmin) {
          const { data: staffData } = await supabase
            .from("onboarding_staff")
            .select("id, name, role")
            .eq("is_active", true)
            .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]);
          setStaff(staffData || []);
        }

        const { data: stagesData } = await supabase
          .from("crm_stages")
          .select("*, pipeline:crm_pipelines(name)")
          .order("sort_order");

        const { start, end } = getDateRange();
        let leadsQuery = supabase
          .from("crm_leads")
          .select("*, stage:crm_stages(name, is_final, final_type, color)");

        if (selectedPipeline !== "all") {
          leadsQuery = leadsQuery.eq("pipeline_id", selectedPipeline);
        }

        if (selectedOwner !== "all" && isAdmin) {
          leadsQuery = leadsQuery.eq("owner_staff_id", selectedOwner);
        }

        const { data: leadsData } = await leadsQuery;

        const parseNumeric = (val: any): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val) || 0;
          return 0;
        };

        const { data: activitiesData } = await supabase
          .from("crm_activities")
          .select("*, lead:crm_leads!inner(id, pipeline_id, owner_staff_id)")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());

        let filteredActivities = activitiesData || [];
        if (selectedPipeline !== "all") {
          filteredActivities = filteredActivities.filter(a => a.lead?.pipeline_id === selectedPipeline);
        }
        if (selectedOwner !== "all" && isAdmin) {
          filteredActivities = filteredActivities.filter(a => a.lead?.owner_staff_id === selectedOwner);
        }

        const meetingsScheduled = filteredActivities.filter(a =>
          a.type === "meeting" && a.scheduled_at
        ).length;
        
        const meetingsHeld = filteredActivities.filter(a =>
          a.type === "meeting" && a.status === "completed"
        ).length;
        
        const proposalsSent = filteredActivities.filter(a =>
          a.type === "proposal" || a.title?.toLowerCase().includes("proposta")
        ).length;

        const leadsInPeriod = (leadsData || []).filter(lead => {
          const createdAt = new Date(lead.created_at);
          return createdAt >= start && createdAt <= end;
        });

        const wonLeadsInPeriod = (leadsData || []).filter(l => {
          if (l.stage?.final_type !== "won") return false;
          if (!l.closed_at) return false;
          const closedAt = new Date(l.closed_at);
          return closedAt >= start && closedAt <= end;
        });

        const lostLeadsInPeriod = (leadsData || []).filter(l => {
          if (l.stage?.final_type !== "lost") return false;
          if (!l.closed_at) return false;
          const closedAt = new Date(l.closed_at);
          return closedAt >= start && closedAt <= end;
        });

        const activeLeads = (leadsData || []).filter(l => !l.stage?.is_final);

        const stageGroups: { [key: string]: { count: number; value: number; color: string } } = {};
        (leadsData || []).forEach(lead => {
          const stageName = lead.stage?.name || "Sem Etapa";
          if (!stageGroups[stageName]) {
            stageGroups[stageName] = { count: 0, value: 0, color: lead.stage?.color || "#6B7280" };
          }
          stageGroups[stageName].count++;
          stageGroups[stageName].value += parseNumeric(lead.opportunity_value);
        });

        setStageData(
          Object.entries(stageGroups).map(([name, data]) => ({
            name,
            count: data.count,
            value: data.value,
            color: data.color,
          }))
        );

        const forecast = activeLeads.reduce((sum, lead) => {
          return sum + parseNumeric(lead.opportunity_value) * ((lead.probability || 0) / 100);
        }, 0);

        const pipelineValue = activeLeads.reduce((sum, lead) => sum + parseNumeric(lead.opportunity_value), 0);

        const totalWonValue = wonLeadsInPeriod.reduce((sum, l) => sum + parseNumeric(l.opportunity_value), 0);

        setMetrics({
          newLeads: leadsInPeriod.length,
          workedLeads: leadsInPeriod.filter(l => l.last_activity_at).length,
          meetingsScheduled,
          meetingsHeld,
          proposalsSent,
          won: wonLeadsInPeriod.length,
          lost: lostLeadsInPeriod.length,
          conversionRate: leadsInPeriod.length > 0 
            ? Math.round((wonLeadsInPeriod.length / leadsInPeriod.length) * 100) 
            : 0,
          pipelineValue,
          forecast,
          totalRevenue: totalWonValue,
        });

        const sevenDaysAgo = subDays(new Date(), 7);
        setOverdueLeads(
          activeLeads
            .filter(l => !l.last_activity_at || new Date(l.last_activity_at) < sevenDaysAgo)
            .slice(0, 5)
        );

        setNoActivityLeads(
          activeLeads
            .filter(l => !l.next_activity_at)
            .slice(0, 5)
        );

        setTopOpportunities(
          activeLeads
            .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0))
            .slice(0, 5)
        );

        const { data: lostLeadsWithReason } = await supabase
          .from("crm_leads")
          .select("loss_reason_id, loss_reason:crm_loss_reasons(name)")
          .not("loss_reason_id", "is", null);

        const reasonCounts: { [key: string]: number } = {};
        (lostLeadsWithReason || []).forEach(lead => {
          const reason = lead.loss_reason?.name || "Outro";
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });

        setLossReasons(
          Object.entries(reasonCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        );

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const { data: salesGoalType } = await supabase
          .from("crm_goal_types")
          .select("id")
          .eq("name", "Vendas")
          .eq("is_active", true)
          .single();

        if (salesGoalType) {
          const { data: goalValues } = await supabase
            .from("crm_goal_values")
            .select("meta_value, staff_id")
            .eq("goal_type_id", salesGoalType.id)
            .eq("month", currentMonth)
            .eq("year", currentYear);

          let monthlyTarget = 0;
          if (selectedOwner !== "all" && isAdmin) {
            const staffGoal = (goalValues || []).find(g => g.staff_id === selectedOwner);
            monthlyTarget = parseNumeric(staffGoal?.meta_value || 0);
          } else {
            monthlyTarget = (goalValues || []).reduce((sum, g) => sum + parseNumeric(g.meta_value), 0);
          }

          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          
          const { data: salesData } = await supabase
            .from("crm_sales")
            .select("billing_value, closer_staff_id")
            .gte("sale_date", monthStart.toISOString().split("T")[0])
            .lte("sale_date", monthEnd.toISOString().split("T")[0]);

          let achieved = 0;
          if (selectedOwner !== "all" && isAdmin) {
            achieved = (salesData || [])
              .filter(s => s.closer_staff_id === selectedOwner)
              .reduce((sum, s) => sum + parseNumeric(s.billing_value), 0);
          } else {
            achieved = (salesData || []).reduce((sum, s) => sum + parseNumeric(s.billing_value), 0);
          }

          const remaining = Math.max(0, monthlyTarget - achieved);
          const businessDaysLeft = getRemainingBusinessDaysInMonth(now);
          const dailyTarget = businessDaysLeft > 0 ? remaining / businessDaysLeft : 0;

          setDailyGoal({
            monthlyTarget,
            achieved,
            remaining,
            businessDaysLeft,
            dailyTarget,
          });
        }

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [period, selectedPipeline, selectedOwner, isAdmin]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const progressPercent = (dailyGoal?.monthlyTarget ?? 0) > 0
    ? Math.min(100, Math.round(((dailyGoal?.achieved ?? 0) / (dailyGoal?.monthlyTarget ?? 1)) * 100))
    : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Dashboard Comercial
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do seu funil de vendas • {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-full border-border/50 bg-card shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[150px] h-9 text-xs rounded-full border-border/50 bg-card shadow-sm">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Pipelines</SelectItem>
              {pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={selectedOwner} onValueChange={setSelectedOwner}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-full border-border/50 bg-card shadow-sm">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Daily Goal - Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-6 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Flame className="h-8 w-8 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Meta Diária</h3>
              <p className="text-sm text-blue-100">
                {dailyGoal?.businessDaysLeft ?? 0} dia{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''} úte{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 'is' : 'il'} restante{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-[11px] text-blue-200 mb-1">Meta do Mês</p>
              <p className="text-lg font-bold">{formatCurrency(dailyGoal?.monthlyTarget ?? 0)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-[11px] text-blue-200 mb-1">Realizado</p>
              <p className="text-lg font-bold text-emerald-300">{formatCurrency(dailyGoal?.achieved ?? 0)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-[11px] text-blue-200 mb-1">Falta</p>
              <p className="text-lg font-bold text-amber-300">{formatCurrency(dailyGoal?.remaining ?? 0)}</p>
            </div>
            <div className="bg-yellow-400/20 backdrop-blur-sm rounded-xl p-3 text-center border border-yellow-400/30">
              <p className="text-[11px] text-yellow-200 mb-1 font-medium">Vender/Dia</p>
              <p className="text-xl font-extrabold text-yellow-300">{formatCurrency(dailyGoal?.dailyTarget ?? 0)}</p>
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative z-10 mt-5">
          <div className="flex justify-between text-xs text-blue-200 mb-1.5">
            <span>Progresso</span>
            <span className="font-semibold text-white">{progressPercent}%</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 via-green-400 to-yellow-300 rounded-full transition-all duration-700 ease-out shadow-lg shadow-emerald-500/30"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Metrics - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Users, label: "Leads Novos", value: metrics.newLeads, gradient: "from-blue-500 to-cyan-400", bgLight: "bg-blue-500/10", iconColor: "text-blue-500" },
          { icon: Phone, label: "Trabalhados", value: metrics.workedLeads, gradient: "from-violet-500 to-purple-400", bgLight: "bg-violet-500/10", iconColor: "text-violet-500" },
          { icon: Calendar, label: "Reuniões Agend.", value: metrics.meetingsScheduled, gradient: "from-indigo-500 to-blue-400", bgLight: "bg-indigo-500/10", iconColor: "text-indigo-500" },
          { icon: Calendar, label: "Reuniões Realiz.", value: metrics.meetingsHeld, gradient: "from-cyan-500 to-teal-400", bgLight: "bg-cyan-500/10", iconColor: "text-cyan-500" },
          { icon: FileText, label: "Propostas", value: metrics.proposalsSent, gradient: "from-orange-500 to-amber-400", bgLight: "bg-orange-500/10", iconColor: "text-orange-500" },
          { icon: Trophy, label: "Ganhos", value: metrics.won, gradient: "from-emerald-500 to-green-400", bgLight: "bg-emerald-500/10", iconColor: "text-emerald-500" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${item.gradient}`} />
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgLight}`}>
                <item.icon className={`h-4 w-4 ${item.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold">{item.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white shadow-lg shadow-amber-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{metrics.conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-500/20 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl text-white shadow-lg shadow-slate-500/20">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold">{formatCurrency(metrics.pipelineValue)}</p>
              <p className="text-xs text-muted-foreground">Valor no Pipeline</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl text-white shadow-lg shadow-teal-500/20">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold">{formatCurrency(metrics.forecast)}</p>
              <p className="text-xs text-muted-foreground">Forecast Ponderado</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/30 p-4 shadow-sm">
          <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-emerald-500/10 blur-xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl text-white shadow-lg shadow-emerald-500/30">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Receita no Período</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Funnel Chart */}
        <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-500" />
              Funil por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === "count" ? `${value} leads` : formatCurrency(value),
                      name === "count" ? "Quantidade" : "Valor"
                    ]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Loss Reasons */}
        <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Motivos de Perda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lossReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lead perdido ainda 🎉
                </p>
              ) : (
                lossReasons.map((reason, idx) => {
                  const maxCount = lossReasons[0]?.count || 1;
                  const pct = Math.round((reason.count / maxCount) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{reason.name}</span>
                        <Badge variant="secondary" className="font-semibold">{reason.count}</Badge>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Lists */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Overdue Leads */}
        <Card className="rounded-xl border-red-500/20 shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-400" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Leads Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {overdueLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lead atrasado 🎉
                </p>
              ) : (
                overdueLeads.map(lead => (
                  <Link
                    key={lead.id}
                    to={`/crm/leads/${lead.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-red-500/5 transition-colors group"
                  >
                    <div>
                      <p className="font-medium text-sm truncate group-hover:text-red-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* No Activity */}
        <Card className="rounded-xl border-amber-500/20 shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-yellow-400" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Sem Próxima Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {noActivityLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Todos os leads têm atividades 🎉
                </p>
              ) : (
                noActivityLeads.map(lead => (
                  <Link
                    key={lead.id}
                    to={`/crm/leads/${lead.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-amber-500/5 transition-colors group"
                  >
                    <div>
                      <p className="font-medium text-sm truncate group-hover:text-amber-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Opportunities */}
        <Card className="rounded-xl border-emerald-500/20 shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-green-400" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" />
              Top Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {topOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma oportunidade ainda
                </p>
              ) : (
                topOpportunities.map(lead => (
                  <Link
                    key={lead.id}
                    to={`/crm/leads/${lead.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-emerald-500/5 transition-colors group"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-medium text-sm truncate group-hover:text-emerald-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold text-xs shrink-0">
                      {formatCurrency(lead.opportunity_value || 0)}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
