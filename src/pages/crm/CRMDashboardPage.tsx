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
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-sm">
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

      {/* Daily Goal - Hero Card - Ultra 3D */}
      <div className="relative overflow-hidden rounded-3xl p-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-2xl shadow-purple-500/20">
        <div className="relative rounded-[22px] bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-6 overflow-hidden">
          {/* Glow orbs */}
          <div className="absolute top-0 right-0 h-60 w-60 rounded-full bg-blue-500/30 blur-[80px]" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-purple-500/25 blur-[60px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-pink-500/15 blur-[50px]" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-xl shadow-orange-500/40">
                <Flame className="h-8 w-8 text-white drop-shadow-lg" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Meta Diária</h3>
                <p className="text-sm text-blue-200/80">
                  {dailyGoal?.businessDaysLeft ?? 0} dia{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''} úte{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 'is' : 'il'} restante{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="bg-white/[0.08] backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/10 shadow-inner">
                <p className="text-[10px] text-blue-300/70 mb-1 uppercase tracking-wider font-medium">Meta do Mês</p>
                <p className="text-lg font-bold text-white">{formatCurrency(dailyGoal?.monthlyTarget ?? 0)}</p>
              </div>
              <div className="bg-emerald-500/[0.12] backdrop-blur-md rounded-2xl p-3.5 text-center border border-emerald-400/20 shadow-inner">
                <p className="text-[10px] text-emerald-300/70 mb-1 uppercase tracking-wider font-medium">Realizado</p>
                <p className="text-lg font-bold text-emerald-300">{formatCurrency(dailyGoal?.achieved ?? 0)}</p>
              </div>
              <div className="bg-amber-500/[0.12] backdrop-blur-md rounded-2xl p-3.5 text-center border border-amber-400/20 shadow-inner">
                <p className="text-[10px] text-amber-300/70 mb-1 uppercase tracking-wider font-medium">Falta</p>
                <p className="text-lg font-bold text-amber-300">{formatCurrency(dailyGoal?.remaining ?? 0)}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500/25 to-orange-500/20 backdrop-blur-md rounded-2xl p-3.5 text-center border border-yellow-400/30 shadow-lg shadow-yellow-500/10">
                <p className="text-[10px] text-yellow-200/80 mb-1 uppercase tracking-wider font-bold">Vender/Dia</p>
                <p className="text-xl font-extrabold text-yellow-300 drop-shadow-lg">{formatCurrency(dailyGoal?.dailyTarget ?? 0)}</p>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="relative z-10 mt-6">
            <div className="flex justify-between text-xs text-blue-200/60 mb-2">
              <span>Progresso</span>
              <span className="font-bold text-white text-sm">{progressPercent}%</span>
            </div>
            <div className="h-4 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 via-emerald-400 to-yellow-300 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white/40 to-transparent rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Metrics - Row 1 - 3D Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Users, label: "Leads Novos", value: metrics.newLeads, from: "from-blue-500", to: "to-cyan-400", shadow: "shadow-blue-500/25", glow: "bg-blue-400/20" },
          { icon: Phone, label: "Trabalhados", value: metrics.workedLeads, from: "from-violet-500", to: "to-purple-400", shadow: "shadow-violet-500/25", glow: "bg-violet-400/20" },
          { icon: Calendar, label: "Reuniões Agend.", value: metrics.meetingsScheduled, from: "from-indigo-500", to: "to-blue-400", shadow: "shadow-indigo-500/25", glow: "bg-indigo-400/20" },
          { icon: Calendar, label: "Reuniões Realiz.", value: metrics.meetingsHeld, from: "from-cyan-500", to: "to-teal-400", shadow: "shadow-cyan-500/25", glow: "bg-cyan-400/20" },
          { icon: FileText, label: "Propostas", value: metrics.proposalsSent, from: "from-orange-500", to: "to-amber-400", shadow: "shadow-orange-500/25", glow: "bg-orange-400/20" },
          { icon: Trophy, label: "Ganhos", value: metrics.won, from: "from-emerald-500", to: "to-green-400", shadow: "shadow-emerald-500/25", glow: "bg-emerald-400/20" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border/40 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            {/* Top gradient bar - thicker */}
            <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${item.from} ${item.to}`} />
            {/* Background glow */}
            <div className={`absolute -bottom-6 -right-6 h-20 w-20 rounded-full ${item.glow} blur-xl opacity-60 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10 flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.from} ${item.to} flex items-center justify-center shadow-lg ${item.shadow}`}>
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight">{item.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Metrics Row - Glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp, label: "Taxa de Conversão", value: `${metrics.conversionRate}%`, large: true, from: "from-amber-500", to: "to-orange-600", bg: "from-amber-500/10 to-orange-500/5", border: "border-amber-500/30", shadow: "shadow-amber-500/20" },
          { icon: DollarSign, label: "Valor no Pipeline", value: formatCurrency(metrics.pipelineValue), from: "from-blue-600", to: "to-indigo-600", bg: "from-blue-500/10 to-indigo-500/5", border: "border-blue-500/30", shadow: "shadow-blue-500/20" },
          { icon: Target, label: "Forecast Ponderado", value: formatCurrency(metrics.forecast), from: "from-teal-500", to: "to-cyan-500", bg: "from-teal-500/10 to-cyan-500/5", border: "border-teal-500/30", shadow: "shadow-teal-500/20" },
          { icon: DollarSign, label: "Receita no Período", value: formatCurrency(metrics.totalRevenue), from: "from-emerald-500", to: "to-green-500", bg: "from-emerald-500/15 to-green-500/10", border: "border-emerald-500/40", shadow: "shadow-emerald-500/25", highlight: true },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.bg} border ${item.border} p-5 shadow-lg ${item.shadow} hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
          >
            {/* Decorative orb */}
            <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${item.from} ${item.to} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`} />
            <div className="relative z-10 flex items-start gap-3">
              <div className={`p-2.5 bg-gradient-to-br ${item.from} ${item.to} rounded-xl text-white shadow-xl ${item.shadow}`}>
                <item.icon className="h-5 w-5 drop-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black tracking-tight truncate ${item.large ? 'text-3xl' : 'text-xl'} ${item.highlight ? 'bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent' : ''}`}>
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Funnel Chart */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="p-5 pb-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg text-white">
                <Zap className="h-3.5 w-3.5" />
              </div>
              Funil por Etapa
            </h3>
          </div>
          <div className="px-5 pb-5">
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
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.16)", backdropFilter: "blur(8px)" }}
                  />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]}>
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Loss Reasons */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-pink-500" />
          <div className="p-5 pb-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg text-white">
                <ArrowDownRight className="h-3.5 w-3.5" />
              </div>
              Motivos de Perda
            </h3>
          </div>
          <div className="px-5 pb-5">
            <div className="space-y-4">
              {lossReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lead perdido ainda 🎉
                </p>
              ) : (
                lossReasons.map((reason, idx) => {
                  const maxCount = lossReasons[0]?.count || 1;
                  const pct = Math.round((reason.count / maxCount) * 100);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{reason.name}</span>
                        <span className="text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">{reason.count}</span>
                      </div>
                      <div className="h-3 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-rose-500 to-pink-400 rounded-full transition-all relative"
                          style={{ width: `${pct}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent rounded-full" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Lists - Glassmorphism cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Overdue Leads */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg hover:shadow-xl transition-shadow">
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500" />
          <div className="p-5 pb-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl text-white shadow-lg shadow-red-500/30">
                <AlertTriangle className="h-4 w-4" />
              </div>
              Leads Atrasados
              {overdueLeads.length > 0 && (
                <span className="ml-auto text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-red-500/30">{overdueLeads.length}</span>
              )}
            </h3>
          </div>
          <div className="px-5 pb-5">
            <div className="space-y-1">
              {overdueLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead atrasado 🎉</p>
              ) : (
                overdueLeads.map(lead => (
                  <Link key={lead.id} to={`/crm/leads/${lead.id}`} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-red-500/5 transition-all group">
                    <div>
                      <p className="font-semibold text-sm truncate group-hover:text-red-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-red-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* No Activity */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg hover:shadow-xl transition-shadow">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-400" />
          <div className="p-5 pb-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl text-white shadow-lg shadow-amber-500/30">
                <Clock className="h-4 w-4" />
              </div>
              Sem Próxima Atividade
              {noActivityLeads.length > 0 && (
                <span className="ml-auto text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30">{noActivityLeads.length}</span>
              )}
            </h3>
          </div>
          <div className="px-5 pb-5">
            <div className="space-y-1">
              {noActivityLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Todos os leads têm atividades 🎉</p>
              ) : (
                noActivityLeads.map(lead => (
                  <Link key={lead.id} to={`/crm/leads/${lead.id}`} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-500/5 transition-all group">
                    <div>
                      <p className="font-semibold text-sm truncate group-hover:text-amber-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-amber-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top Opportunities */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg hover:shadow-xl transition-shadow">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400" />
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="p-5 pb-2 relative z-10">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                <Trophy className="h-4 w-4" />
              </div>
              Top Oportunidades
            </h3>
          </div>
          <div className="px-5 pb-5 relative z-10">
            <div className="space-y-1">
              {topOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma oportunidade ainda</p>
              ) : (
                topOpportunities.map(lead => (
                  <Link key={lead.id} to={`/crm/leads/${lead.id}`} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-500/5 transition-all group">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-semibold text-sm truncate group-hover:text-emerald-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold bg-gradient-to-r from-emerald-500 to-green-500 text-white px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/20">
                      {formatCurrency(lead.opportunity_value || 0)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
