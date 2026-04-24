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
import { MeetingDetailCards, type MeetingEventDetail } from "@/components/crm/MeetingDetailCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMTrafficTab } from "@/components/crm/traffic/CRMTrafficTab";
import { useSearchParams } from "react-router-dom";
import { Megaphone, BarChart3 } from "lucide-react";

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
  const activeTab = searchParams.get("tab") === "traffic" ? "traffic" : "overview";
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

        // Closers/SDRs only see their own leads
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

        // Closers/SDRs only see their own activities
        if (!isAdmin && staffId) {
          activitiesQuery = activitiesQuery.eq("responsible_staff_id", staffId);
        }

        const { data: activitiesData } = await activitiesQuery;

        // Load meeting events from CRM card buttons
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

        // Filter meeting events by owner if needed
        let filteredMeetingEvents = meetingEventsData || [];
        if (selectedOwner !== "all" && isAdmin) {
          filteredMeetingEvents = filteredMeetingEvents.filter(e => e.lead?.owner_staff_id === selectedOwner);
        }
        if (!isAdmin && staffId) {
          filteredMeetingEvents = filteredMeetingEvents.filter(e => e.lead?.owner_staff_id === staffId);
        }

        // Build meeting event details for detail cards (deduplicate by lead_id + event_type)
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

        // Use meeting events for meeting counts (deduplicate by lead_id to avoid double-counting dual-credit events)
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
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-rose-500 via-fuchsia-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border border-border/40 shadow-sm">
          <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="traffic" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Megaphone className="h-3.5 w-3.5" /> Tráfego Pago
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          {/* Daily Goal - Hero Card - Ultra Vibrant */}
      <div className="relative overflow-hidden rounded-3xl p-[3px] shadow-2xl shadow-fuchsia-500/30" style={{ background: 'linear-gradient(135deg, #f43f5e, #d946ef, #8b5cf6, #3b82f6, #06b6d4, #10b981)' }}>
        <div className="relative rounded-[21px] overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #4a1942 60%, #1e293b 100%)' }}>
          {/* Animated glow orbs */}
          <div className="absolute top-[-40px] right-[-20px] h-80 w-80 rounded-full bg-fuchsia-500/30 blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-30px] left-[-30px] h-64 w-64 rounded-full bg-cyan-500/25 blur-[80px]" />
          <div className="absolute top-1/3 left-1/3 h-40 w-40 rounded-full bg-amber-500/20 blur-[60px]" />
          <div className="absolute bottom-1/4 right-1/4 h-32 w-32 rounded-full bg-emerald-500/20 blur-[50px]" />
          
          <div className="relative z-10 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl shadow-2xl shadow-orange-500/50" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)' }}>
                  <Flame className="h-8 w-8 text-white drop-shadow-lg" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Meta Diária</h3>
                  <p className="text-sm text-cyan-200/80">
                    {dailyGoal?.businessDaysLeft ?? 0} dia{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''} úte{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 'is' : 'il'} restante{(dailyGoal?.businessDaysLeft ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <div className="rounded-2xl p-3.5 text-center border border-white/10 shadow-inner backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))' }}>
                  <p className="text-[10px] text-blue-300/70 mb-1 uppercase tracking-wider font-medium">Meta do Mês</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(dailyGoal?.monthlyTarget ?? 0)}</p>
                </div>
                <div className="rounded-2xl p-3.5 text-center border border-emerald-400/20 shadow-inner backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))' }}>
                  <p className="text-[10px] text-emerald-300/70 mb-1 uppercase tracking-wider font-medium">Realizado</p>
                  <p className="text-lg font-bold text-emerald-300">{formatCurrency(dailyGoal?.achieved ?? 0)}</p>
                </div>
                <div className="rounded-2xl p-3.5 text-center border border-rose-400/20 shadow-inner backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(217,70,239,0.1))' }}>
                  <p className="text-[10px] text-rose-300/70 mb-1 uppercase tracking-wider font-medium">Falta</p>
                  <p className="text-lg font-bold text-rose-300">{formatCurrency(dailyGoal?.remaining ?? 0)}</p>
                </div>
                <div className="rounded-2xl p-3.5 text-center border border-amber-400/30 shadow-lg backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(239,68,68,0.15))' }}>
                  <p className="text-[10px] text-amber-200/80 mb-1 uppercase tracking-wider font-bold">Vender/Dia</p>
                  <p className="text-xl font-extrabold text-amber-300 drop-shadow-lg">{formatCurrency(dailyGoal?.dailyTarget ?? 0)}</p>
                </div>
              </div>
            </div>
            
            {/* Progress bar - rainbow */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-blue-200/60 mb-2">
                <span>Progresso</span>
                <span className="font-bold text-white text-sm">{progressPercent}%</span>
              </div>
              <div className="h-5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-full" />
                  <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white/50 to-transparent rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Metrics - Vivid 3D Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Users, label: "Leads Novos", value: metrics.newLeads, gradient: "linear-gradient(135deg, #3b82f6, #06b6d4)", shadow: "0 8px 32px rgba(59,130,246,0.4)", bg: "rgba(59,130,246,0.08)" },
          { icon: Phone, label: "Trabalhados", value: metrics.workedLeads, gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)", shadow: "0 8px 32px rgba(139,92,246,0.4)", bg: "rgba(139,92,246,0.08)" },
          { icon: Calendar, label: "Reuniões Agend.", value: metrics.meetingsScheduled, gradient: "linear-gradient(135deg, #ec4899, #f43f5e)", shadow: "0 8px 32px rgba(236,72,153,0.4)", bg: "rgba(236,72,153,0.08)" },
          { icon: Calendar, label: "Reuniões Realiz.", value: metrics.meetingsHeld, gradient: "linear-gradient(135deg, #06b6d4, #14b8a6)", shadow: "0 8px 32px rgba(6,182,212,0.4)", bg: "rgba(6,182,212,0.08)" },
          { icon: FileText, label: "Propostas", value: metrics.proposalsSent, gradient: "linear-gradient(135deg, #f59e0b, #ef4444)", shadow: "0 8px 32px rgba(245,158,11,0.4)", bg: "rgba(245,158,11,0.08)" },
          { icon: Trophy, label: "Ganhos", value: metrics.won, gradient: "linear-gradient(135deg, #10b981, #059669)", shadow: "0 8px 32px rgba(16,185,129,0.4)", bg: "rgba(16,185,129,0.08)" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5 p-4 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] cursor-default"
            style={{ background: item.bg, boxShadow: `0 4px 16px rgba(0,0,0,0.06)` }}
          >
            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 h-1.5 w-full rounded-t-2xl" style={{ background: item.gradient }} />
            {/* Glow orb */}
            <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: item.gradient }} />
            <div className="relative z-10 flex flex-col gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: item.gradient, boxShadow: item.shadow }}>
                <item.icon className="h-5 w-5 drop-shadow" />
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight">{item.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Meeting Detail Cards */}
      <MeetingDetailCards events={meetingEventDetails} />

      {/* Financial Metrics Row - Glassmorphism with vivid accents */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp, label: "Taxa de Conversão", value: `${metrics.conversionRate}%`, gradient: "linear-gradient(135deg, #f59e0b, #ef4444)", bg: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.06))", border: "rgba(245,158,11,0.3)", shadow: "0 8px 24px rgba(245,158,11,0.2)" },
          { icon: DollarSign, label: "Valor no Pipeline", value: formatCurrency(metrics.pipelineValue), gradient: "linear-gradient(135deg, #3b82f6, #8b5cf6)", bg: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.06))", border: "rgba(59,130,246,0.3)", shadow: "0 8px 24px rgba(59,130,246,0.2)" },
          { icon: Target, label: "Forecast Ponderado", value: formatCurrency(metrics.forecast), gradient: "linear-gradient(135deg, #06b6d4, #8b5cf6)", bg: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(139,92,246,0.06))", border: "rgba(6,182,212,0.3)", shadow: "0 8px 24px rgba(6,182,212,0.2)" },
          { icon: DollarSign, label: "Receita no Período", value: formatCurrency(metrics.totalRevenue), gradient: "linear-gradient(135deg, #10b981, #06b6d4)", bg: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.08))", border: "rgba(16,185,129,0.4)", shadow: "0 8px 24px rgba(16,185,129,0.25)", highlight: true },
        ].map((item, idx) => (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02]"
            style={{ background: item.bg, border: `1px solid ${item.border}`, boxShadow: item.shadow }}
          >
            {/* Decorative orb */}
            <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-15 blur-2xl group-hover:opacity-30 transition-opacity" style={{ background: item.gradient }} />
            <div className="relative z-10 flex items-start gap-3">
              <div className="p-2.5 rounded-xl text-white shadow-xl" style={{ background: item.gradient }}>
                <item.icon className="h-5 w-5 drop-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black tracking-tight truncate text-2xl ${(item as any).highlight ? '' : ''}`} style={(item as any).highlight ? { background: 'linear-gradient(90deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}}>
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Commission Card */}
      {(staffRole === "closer" || staffRole === "sdr" || staffRole === "master") && (
        <CRMCommissionCard staffId={staffId} staffRole={staffRole} isMaster={staffRole === "master"} />
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Funnel Chart */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="absolute top-0 left-0 h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #f43f5e, #f59e0b)' }} />
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="p-5 pb-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
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
          <div className="absolute top-0 left-0 h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f43f5e, #ec4899, #d946ef)' }} />
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="p-5 pb-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #ef4444, #ec4899)' }}>
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
                  const barColors = [
                    'linear-gradient(90deg, #ef4444, #ec4899)',
                    'linear-gradient(90deg, #f43f5e, #d946ef)',
                    'linear-gradient(90deg, #f59e0b, #ef4444)',
                    'linear-gradient(90deg, #8b5cf6, #ec4899)',
                    'linear-gradient(90deg, #06b6d4, #3b82f6)',
                  ];
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{reason.name}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: barColors[idx % barColors.length] }}>{reason.count}</span>
                      </div>
                      <div className="h-3.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all relative"
                          style={{ width: `${pct}%`, background: barColors[idx % barColors.length] }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
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

      {/* Smart Lists - 3D Glassmorphism cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Overdue Leads */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f43f5e, #ec4899)' }} />
          <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="p-5 pb-2 relative z-10">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #ef4444, #ec4899)', boxShadow: '0 8px 24px rgba(239,68,68,0.4)' }}>
                <AlertTriangle className="h-4 w-4" />
              </div>
              Leads Atrasados
              {overdueLeads.length > 0 && (
                <span className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #ef4444, #ec4899)', boxShadow: '0 4px 16px rgba(239,68,68,0.4)' }}>{overdueLeads.length}</span>
              )}
            </h3>
          </div>
          <div className="px-5 pb-5 relative z-10">
            <div className="space-y-1">
              {overdueLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead atrasado 🎉</p>
              ) : (
                overdueLeads.map(lead => (
                  <Link key={lead.id} to={`/crm/leads/${lead.id}`} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-500/5 transition-all group">
                    <div>
                      <p className="font-semibold text-sm truncate group-hover:text-rose-600 transition-colors">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-rose-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* No Activity */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316, #ef4444)' }} />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="p-5 pb-2 relative z-10">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 8px 24px rgba(245,158,11,0.4)' }}>
                <Clock className="h-4 w-4" />
              </div>
              Sem Próxima Atividade
              {noActivityLeads.length > 0 && (
                <span className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>{noActivityLeads.length}</span>
              )}
            </h3>
          </div>
          <div className="px-5 pb-5 relative z-10">
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
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6)' }} />
          <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="p-5 pb-2 relative z-10">
            <h3 className="text-base font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)', boxShadow: '0 8px 24px rgba(16,185,129,0.4)' }}>
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
                    <span className="shrink-0 text-xs font-bold text-white px-2.5 py-1 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
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
