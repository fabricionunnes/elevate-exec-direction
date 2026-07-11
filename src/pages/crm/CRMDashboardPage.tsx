import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CRMCommissionCard } from "@/components/crm/CRMCommissionCard";
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
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Zap,
  CheckCircle2,
  XCircle,
  Activity,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { getRemainingBusinessDaysInMonth } from "@/lib/businessDays";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
  CartesianGrid,
} from "recharts";
import { Link } from "react-router-dom";
import { MeetingDetailCards, type MeetingEventDetail } from "@/components/crm/MeetingDetailCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMTrafficTab } from "@/components/crm/traffic/CRMTrafficTab";
import { useSearchParams } from "react-router-dom";
import { Megaphone, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Custom 3D bar shape for recharts
const Bar3D = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const depth = 6;
  return (
    <g>
      {/* Front face */}
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />
      {/* Top face */}
      <polygon
        points={`${x},${y} ${x + depth},${y - depth} ${x + width + depth},${y - depth} ${x + width},${y}`}
        fill={fill}
        opacity={0.7}
      />
      {/* Right face */}
      <polygon
        points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`}
        fill={fill}
        opacity={0.5}
      />
    </g>
  );
};

export const CRMDashboardPage = () => {
  const { staffRole, isAdmin, staffId } = useOutletContext<{ staffRole: string; isAdmin: boolean; staffId: string | null }>();
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
  const [meetingEventDetails, setMeetingEventDetails] = useState<MeetingEventDetail[]>([]);
  const [dailyGoal, setDailyGoal] = useState<{
    monthlyTarget: number;
    achieved: number;
    remaining: number;
    businessDaysLeft: number;
    dailyTarget: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "traffic" && isAdmin ? "traffic" : "overview";
  const setActiveTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "overview") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

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

        if (!isAdmin && staffId) {
          leadsQuery = leadsQuery.eq("owner_staff_id", staffId);
        }

        const { data: leadsData } = await leadsQuery;

        const parseNumeric = (val: any): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val) || 0;
          return 0;
        };

        let activitiesQuery = supabase
          .from("crm_activities")
          .select("*, lead:crm_leads!inner(id, pipeline_id, owner_staff_id)")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());

        if (!isAdmin && staffId) {
          activitiesQuery = activitiesQuery.eq("responsible_staff_id", staffId);
        }

        const { data: activitiesData } = await activitiesQuery;

        let meetingEventsQuery = supabase
          .from("crm_meeting_events")
          .select(`
            *,
            credited_staff:onboarding_staff!crm_meeting_events_credited_staff_id_fkey(id, name),
            lead:crm_leads!crm_meeting_events_lead_id_fkey(id, name, company, owner_staff_id, pipeline_id)
          `)
          .gte("event_date", start.toISOString())
          .lte("event_date", end.toISOString());

        if (selectedPipeline !== "all") {
          meetingEventsQuery = meetingEventsQuery.eq("pipeline_id", selectedPipeline);
        }

        const { data: meetingEventsData } = await meetingEventsQuery;

        let filteredMeetingEvents = meetingEventsData || [];
        if (selectedOwner !== "all" && isAdmin) {
          filteredMeetingEvents = filteredMeetingEvents.filter(e => e.lead?.owner_staff_id === selectedOwner);
        }
        if (!isAdmin && staffId) {
          filteredMeetingEvents = filteredMeetingEvents.filter(e => e.lead?.owner_staff_id === staffId);
        }

        const seenKeys = new Set<string>();
        const eventDetails: MeetingEventDetail[] = filteredMeetingEvents
          .filter(e => ["scheduled", "realized", "no_show", "out_of_icp"].includes(e.event_type))
          .filter(e => {
            const key = `${e.lead_id}-${e.event_type}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          })
          .map(e => ({
            id: e.id,
            lead_id: e.lead_id,
            lead_name: e.lead?.name || "Lead",
            lead_company: e.lead?.company || undefined,
            event_type: e.event_type,
            event_date: e.event_date,
            credited_staff_name: e.credited_staff?.name || undefined,
          }));
        setMeetingEventDetails(eventDetails);

        const uniqueScheduledLeads = new Set(filteredMeetingEvents.filter(e => e.event_type === "scheduled").map(e => e.lead_id));
        const uniqueRealizedLeads = new Set(filteredMeetingEvents.filter(e => e.event_type === "realized").map(e => e.lead_id));
        const meScheduled = uniqueScheduledLeads.size;
        const meRealized = uniqueRealizedLeads.size;

        let filteredActivities = activitiesData || [];
        if (selectedPipeline !== "all") {
          filteredActivities = filteredActivities.filter(a => a.lead?.pipeline_id === selectedPipeline);
        }
        if (selectedOwner !== "all" && isAdmin) {
          filteredActivities = filteredActivities.filter(a => a.lead?.owner_staff_id === selectedOwner);
        }

        const meetingsScheduledFromActivities = filteredActivities.filter(a =>
          a.type === "meeting" && a.scheduled_at
        ).length;

        const meetingsHeldFromActivities = filteredActivities.filter(a =>
          a.type === "meeting" && a.status === "completed"
        ).length;

        const meetingsScheduled = meScheduled > 0 ? meScheduled : meetingsScheduledFromActivities;
        const meetingsHeld = meRealized > 0 ? meRealized : meetingsHeldFromActivities;

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

  // Radial chart data for goal visualization
  const radialData = [{ name: "Meta", value: progressPercent, fill: "#3b82f6" }];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-card border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[150px] h-9 text-xs bg-card border-border/60">
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
              <SelectTrigger className="w-[150px] h-9 text-xs bg-card border-border/60">
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

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border border-border/40 h-9">
          <TabsTrigger value="overview" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="traffic" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Megaphone className="h-3.5 w-3.5" /> Tráfego Pago
            </TabsTrigger>
          )}
        </TabsList>

        {/* ════════════════════ OVERVIEW TAB ════════════════════ */}
        <TabsContent value="overview" className="mt-5 space-y-5">

          {/* ── Goal Hero ─────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm">
            <div className="grid lg:grid-cols-[1fr_auto] divide-y lg:divide-y-0 lg:divide-x divide-border/50">

              {/* Left — progress visual */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-6">
                {/* Radial gauge */}
                <div className="relative shrink-0 w-32 h-32">
                  <RadialBarChart
                    width={128}
                    height={128}
                    innerRadius={44}
                    outerRadius={60}
                    data={radialData}
                    startAngle={210}
                    endAngle={-30}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      background={{ fill: "hsl(var(--muted))" }}
                      fill="#3b82f6"
                    />
                  </RadialBarChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black tabular-nums">{progressPercent}%</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest">da meta</span>
                  </div>
                </div>

                {/* Text info */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Flame className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Meta do Mês</h3>
                      <p className="text-xs text-muted-foreground">
                        {dailyGoal?.businessDaysLeft ?? 0} dia{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''} útil{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 'eis' : ''} restante{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Segmented progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{formatCurrency(dailyGoal?.achieved ?? 0)} realizados</span>
                      <span>Meta: {formatCurrency(dailyGoal?.monthlyTarget ?? 0)}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-700 relative"
                        style={{ width: `${progressPercent}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — 4 stat boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 divide-x divide-y sm:divide-y-0 lg:divide-x-0 lg:divide-y xl:divide-y-0 xl:divide-x divide-border/50">
                {[
                  { label: "Meta do Mês", value: formatCurrency(dailyGoal?.monthlyTarget ?? 0), sub: "alvo total", color: "text-foreground" },
                  { label: "Realizado", value: formatCurrency(dailyGoal?.achieved ?? 0), sub: "até hoje", color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Falta", value: formatCurrency(dailyGoal?.remaining ?? 0), sub: "para bater", color: "text-rose-600 dark:text-rose-400" },
                  { label: "Vender/Dia", value: formatCurrency(dailyGoal?.dailyTarget ?? 0), sub: "por dia útil", color: "text-blue-600 dark:text-blue-400" },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                    <p className={cn("text-lg font-black tabular-nums", item.color)}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Activity KPIs ─────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 px-0.5">Atividade do Período</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: Users, label: "Leads Novos", value: metrics.newLeads, accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
                { icon: Phone, label: "Trabalhados", value: metrics.workedLeads, accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400", border: "border-violet-500/20" },
                { icon: Calendar, label: "Reuniões Agend.", value: metrics.meetingsScheduled, accent: "bg-pink-500/10 text-pink-600 dark:text-pink-400", border: "border-pink-500/20" },
                { icon: Calendar, label: "Reuniões Realiz.", value: metrics.meetingsHeld, accent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" },
                { icon: FileText, label: "Propostas", value: metrics.proposalsSent, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
                { icon: Trophy, label: "Ganhos", value: metrics.won, accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-xl border bg-card p-4 flex flex-col gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
                    item.border
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", item.accent)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-black tabular-nums">{item.value}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Meeting Detail Cards ───────────────────────────── */}
          <MeetingDetailCards events={meetingEventDetails} />

          {/* ── Financial KPIs ────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 px-0.5">Financeiro</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  icon: TrendingUp,
                  label: "Taxa de Conversão",
                  value: `${metrics.conversionRate}%`,
                  sub: `${metrics.won} ganhos / ${metrics.lost} perdidos`,
                  iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  trend: metrics.conversionRate >= 30 ? "up" : "down",
                },
                {
                  icon: Activity,
                  label: "Valor no Pipeline",
                  value: formatCurrency(metrics.pipelineValue),
                  sub: "oportunidades ativas",
                  iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  trend: null,
                },
                {
                  icon: Target,
                  label: "Forecast Ponderado",
                  value: formatCurrency(metrics.forecast),
                  sub: "por probabilidade",
                  iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
                  trend: null,
                },
                {
                  icon: DollarSign,
                  label: "Receita no Período",
                  value: formatCurrency(metrics.totalRevenue),
                  sub: "negócios fechados",
                  iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  highlight: true,
                  trend: "up",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-xl border bg-card p-4 flex gap-4 items-start hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
                    item.highlight ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-border/60"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", item.iconClass)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className={cn("text-xl font-black tabular-nums truncate", item.highlight && "text-emerald-600 dark:text-emerald-400")}>
                        {item.value}
                      </p>
                      {item.trend === "up" && <ChevronUp className="h-4 w-4 text-emerald-500 shrink-0" />}
                      {item.trend === "down" && <ChevronDown className="h-4 w-4 text-rose-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Commission Card ───────────────────────────────── */}
          {(staffRole === "closer" || staffRole === "sdr" || staffRole === "master") && (
            <CRMCommissionCard staffId={staffId} staffRole={staffRole} isMaster={staffRole === "master"} />
          )}

          {/* ── Charts ────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 px-0.5">Análise</p>
            <div className="grid md:grid-cols-2 gap-4">

              {/* Funnel Chart — 3D bars */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-violet-500/10">
                      <Zap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    Funil por Etapa
                    <Badge variant="secondary" className="ml-auto text-[10px]">{stageData.length} etapas</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {/* 3D perspective wrapper */}
                  <div
                    style={{
                      perspective: "800px",
                    }}
                  >
                    <div
                      style={{
                        transform: "rotateX(4deg)",
                        transformOrigin: "50% 100%",
                      }}
                    >
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stageData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={90}
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                name === "count" ? `${value} leads` : formatCurrency(value),
                                name === "count" ? "Quantidade" : "Valor",
                              ]}
                              contentStyle={{
                                borderRadius: "10px",
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--card))",
                                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                                fontSize: 12,
                              }}
                              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24} shape={<Bar3D />}>
                              {stageData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Loss Reasons */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-rose-500/10">
                      <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                    </div>
                    Motivos de Perda
                    <Badge variant="secondary" className="ml-auto text-[10px]">{lossReasons.length} motivos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {lossReasons.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-60" />
                      <p className="text-sm text-muted-foreground">Nenhum lead perdido ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      {lossReasons.map((reason, idx) => {
                        const maxCount = lossReasons[0]?.count || 1;
                        const pct = Math.round((reason.count / maxCount) * 100);
                        const colors = ["#ef4444", "#f97316", "#f59e0b", "#8b5cf6", "#06b6d4"];
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium truncate max-w-[70%]">{reason.name}</span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ml-2"
                                style={{ background: colors[idx % colors.length] }}
                              >
                                {reason.count}
                              </span>
                            </div>
                            {/* 3D-style progress bar */}
                            <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${pct}%`,
                                  background: colors[idx % colors.length],
                                  boxShadow: `0 2px 6px ${colors[idx % colors.length]}60`,
                                }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Smart Lists ───────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 px-0.5">Atenção Necessária</p>
            <div className="grid md:grid-cols-3 gap-4">

              {/* Overdue Leads */}
              <Card className="border-rose-500/20 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-rose-500/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                    </div>
                    Leads Atrasados
                    {overdueLeads.length > 0 && (
                      <Badge className="ml-auto text-[10px] bg-rose-500 hover:bg-rose-500">{overdueLeads.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {overdueLeads.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Nenhum lead atrasado
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {overdueLeads.map(lead => (
                        <Link
                          key={lead.id}
                          to={`/crm/leads/${lead.id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-muted/40 -mx-1 px-1 rounded-lg transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-rose-600 transition-colors">{lead.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{lead.company}</p>
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-rose-500 shrink-0 ml-2 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* No Activity */}
              <Card className="border-amber-500/20 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-amber-500/10">
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    Sem Atividade
                    {noActivityLeads.length > 0 && (
                      <Badge className="ml-auto text-[10px] bg-amber-500 hover:bg-amber-500">{noActivityLeads.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {noActivityLeads.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Todos têm atividades
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {noActivityLeads.map(lead => (
                        <Link
                          key={lead.id}
                          to={`/crm/leads/${lead.id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-muted/40 -mx-1 px-1 rounded-lg transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-amber-600 transition-colors">{lead.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{lead.company}</p>
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-amber-500 shrink-0 ml-2 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Opportunities */}
              <Card className="border-emerald-500/20 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                      <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Top Oportunidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {topOpportunities.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
                      Nenhuma oportunidade ativa
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {topOpportunities.map((lead, idx) => (
                        <Link
                          key={lead.id}
                          to={`/crm/leads/${lead.id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-muted/40 -mx-1 px-1 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate group-hover:text-emerald-600 transition-colors">{lead.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{lead.company}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-2 tabular-nums">
                            {formatCurrency(lead.opportunity_value || 0)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

        </TabsContent>

        {/* ═══════════════ TRAFFIC TAB ════════════════ */}
        {isAdmin && (
          <TabsContent value="traffic" className="mt-5">
            <CRMTrafficTab isAdmin={isAdmin} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
