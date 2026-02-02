import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CalendarDays
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { getRemainingBusinessDaysInMonth } from "@/lib/businessDays";
import { ptBR } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
        // Load pipelines
        const { data: pipelinesData } = await supabase
          .from("crm_pipelines")
          .select("*")
          .eq("is_active", true);
        setPipelines(pipelinesData || []);

        // Load staff for filter (only for admins)
        if (isAdmin) {
          const { data: staffData } = await supabase
            .from("onboarding_staff")
            .select("id, name, role")
            .eq("is_active", true)
            .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]);
          setStaff(staffData || []);
        }

        // Load stages for funnel chart
        const { data: stagesData } = await supabase
          .from("crm_stages")
          .select("*, pipeline:crm_pipelines(name)")
          .order("sort_order");

        // Load leads with filters
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

        // Helper to parse numeric values (Supabase may return as string)
        const parseNumeric = (val: any): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val) || 0;
          return 0;
        };

        // Load activities for the period
        const { data: activitiesData } = await supabase
          .from("crm_activities")
          .select("*, lead:crm_leads!inner(id, pipeline_id, owner_staff_id)")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());

        // Filter activities by pipeline and owner if needed
        let filteredActivities = activitiesData || [];
        if (selectedPipeline !== "all") {
          filteredActivities = filteredActivities.filter(a => a.lead?.pipeline_id === selectedPipeline);
        }
        if (selectedOwner !== "all" && isAdmin) {
          filteredActivities = filteredActivities.filter(a => a.lead?.owner_staff_id === selectedOwner);
        }

        // Count activity types
        const meetingsScheduled = filteredActivities.filter(a => 
          a.type === "meeting" && a.scheduled_at
        ).length;
        
        const meetingsHeld = filteredActivities.filter(a => 
          a.type === "meeting" && a.status === "completed"
        ).length;
        
        const proposalsSent = filteredActivities.filter(a => 
          a.type === "proposal" || a.title?.toLowerCase().includes("proposta")
        ).length;

        // Calculate metrics - leads created in period
        const leadsInPeriod = (leadsData || []).filter(lead => {
          const createdAt = new Date(lead.created_at);
          return createdAt >= start && createdAt <= end;
        });

        // Leads WON in the period (by closed_at date, not created_at)
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

        // Stage data for funnel
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

        // Calculate forecast
        const forecast = activeLeads.reduce((sum, lead) => {
          return sum + parseNumeric(lead.opportunity_value) * ((lead.probability || 0) / 100);
        }, 0);

        // Pipeline value
        const pipelineValue = activeLeads.reduce((sum, lead) => sum + parseNumeric(lead.opportunity_value), 0);

        // Total value from WON leads in period
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

        // Overdue leads (no activity in 7+ days)
        const sevenDaysAgo = subDays(new Date(), 7);
        setOverdueLeads(
          activeLeads
            .filter(l => !l.last_activity_at || new Date(l.last_activity_at) < sevenDaysAgo)
            .slice(0, 5)
        );

        // Leads without next activity
        setNoActivityLeads(
          activeLeads
            .filter(l => !l.next_activity_at)
            .slice(0, 5)
        );

        // Top opportunities
        setTopOpportunities(
          activeLeads
            .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0))
            .slice(0, 5)
        );

        // Loss reasons - load from lost leads
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

        // Calculate daily goal based on monthly sales target
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Get monthly sales goal type
        const { data: salesGoalType } = await supabase
          .from("crm_goal_types")
          .select("id")
          .eq("name", "Vendas")
          .eq("is_active", true)
          .single();

        if (salesGoalType) {
          // Get all staff goals for this month (sum all targets)
          const { data: goalValues } = await supabase
            .from("crm_goal_values")
            .select("meta_value, staff_id")
            .eq("goal_type_id", salesGoalType.id)
            .eq("month", currentMonth)
            .eq("year", currentYear);

          // Filter by selected owner if applicable
          let monthlyTarget = 0;
          if (selectedOwner !== "all" && isAdmin) {
            const staffGoal = (goalValues || []).find(g => g.staff_id === selectedOwner);
            monthlyTarget = parseNumeric(staffGoal?.meta_value || 0);
          } else {
            // Sum all staff goals
            monthlyTarget = (goalValues || []).reduce((sum, g) => sum + parseNumeric(g.meta_value), 0);
          }

          // Get total sales achieved this month
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Comercial</h1>
          <p className="text-muted-foreground">
            Visão geral do seu funil de vendas
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[160px]">
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
              <SelectTrigger className="w-[160px]">
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

      {/* Main Metrics - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.newLeads}</p>
                <p className="text-xs text-muted-foreground">Leads Novos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Phone className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.workedLeads}</p>
                <p className="text-xs text-muted-foreground">Trabalhados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.meetingsScheduled}</p>
                <p className="text-xs text-muted-foreground">Reuniões Agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.meetingsHeld}</p>
                <p className="text-xs text-muted-foreground">Reuniões Realizadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.proposalsSent}</p>
                <p className="text-xs text-muted-foreground">Propostas Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.won}</p>
                <p className="text-xs text-muted-foreground">Ganhos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Metrics - Row 2: Financial */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(metrics.pipelineValue)}</p>
                <p className="text-xs text-muted-foreground">Valor no Pipeline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Target className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(metrics.forecast)}</p>
                <p className="text-xs text-muted-foreground">Forecast Ponderado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-500/10 to-green-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(metrics.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Receita no Período</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Goal Card */}
      {dailyGoal && dailyGoal.monthlyTarget > 0 && (
        <Card className="bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <CalendarDays className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">Meta Diária</h3>
                  <p className="text-sm text-muted-foreground">
                    {dailyGoal.businessDaysLeft} dia{dailyGoal.businessDaysLeft !== 1 ? 's' : ''} útil{dailyGoal.businessDaysLeft !== 1 ? 'eis' : ''} restante{dailyGoal.businessDaysLeft !== 1 ? 's' : ''} no mês
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Meta do Mês</p>
                  <p className="text-lg font-bold">{formatCurrency(dailyGoal.monthlyTarget)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(dailyGoal.achieved)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Falta</p>
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(dailyGoal.remaining)}</p>
                </div>
                <div className="text-center bg-blue-500/10 rounded-lg p-2">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Vender/Dia</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(dailyGoal.dailyTarget)}</p>
                </div>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>{dailyGoal.monthlyTarget > 0 ? Math.round((dailyGoal.achieved / dailyGoal.monthlyTarget) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, dailyGoal.monthlyTarget > 0 ? (dailyGoal.achieved / dailyGoal.monthlyTarget) * 100 : 0)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Funil por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === "count" ? `${value} leads` : formatCurrency(value),
                      name === "count" ? "Quantidade" : "Valor"
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Motivos de Perda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lossReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lead perdido ainda
                </p>
              ) : (
                lossReasons.map((reason, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{reason.name}</span>
                    <Badge variant="secondary">{reason.count}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Lists */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Overdue Leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Leads Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhum lead atrasado 🎉
                </p>
              ) : (
                overdueLeads.map(lead => (
                  <Link
                    key={lead.id}
                    to={`/crm/leads/${lead.id}`}
                    className="block p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.company}</p>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* No Activity Leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Sem Próxima Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {noActivityLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Todos os leads têm atividades 🎉
                </p>
              ) : (
                noActivityLeads.map(lead => (
                  <Link
                    key={lead.id}
                    to={`/crm/leads/${lead.id}`}
                    className="block p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.company}</p>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Opportunities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma oportunidade ainda
                </p>
              ) : (
                topOpportunities.map(lead => (
                  <Link
                    key={lead.id}
                    to={`/crm/leads/${lead.id}`}
                    className="block p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.company}</p>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        {formatCurrency(lead.opportunity_value || 0)}
                      </Badge>
                    </div>
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
