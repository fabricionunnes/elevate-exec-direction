import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  Legend,
  Cell,
} from "recharts";
import { format, startOfMonth, endOfMonth, getDaysInMonth, getDate, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Users, Calendar as CalendarIcon, AlertTriangle, CheckCircle, XCircle, TrendingUp, Upload, ChevronDown } from "lucide-react";
import { ImportPreSalesDialog } from "@/components/crm/ImportPreSalesDialog";
import { MeetingDetailCards, MeetingEventDetail } from "@/components/crm/MeetingDetailCards";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface SDRMetrics {
  id: string;
  name: string;
  approaches: number;
  connections: number;
  scheduled: number;
  callsScheduled: number;
  cancelled: number;
  rescheduled: number;
  noShow: number;
  qualified: number;
  meetings: number;
  noShowPercent: number;
}

interface SaleBySDR {
  id: string;
  pipeline: string;
  client: string;
  service: string;
  sdr: string;
  billing: number;
  revenue: number;
  closer: string;
}

interface PreSalesIndicatorsTabProps {
  staffId?: string | null;
  staffRole?: string | null;
}

export const PreSalesIndicatorsTab = ({ staffId, staffRole }: PreSalesIndicatorsTabProps = {}) => {
  const isSDRUser = staffRole === "sdr" || staffRole === "social_setter" || staffRole === "bdr";
  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";
  const [loading, setLoading] = useState(true);
  const [sdrs, setSDRs] = useState<SDRMetrics[]>([]);
  const [salesBySDR, setSalesBySDR] = useState<SaleBySDR[]>([]);
  const [selectedSDR, setSelectedSDR] = useState<string>(isSDRUser && staffId ? staffId : "all");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [dateOpen, setDateOpen] = useState(false);

  // Main metrics
  const [metrics, setMetrics] = useState({
    reunioes: 0,
    showUpPercent: 0,
    noShowPercent: 0,
    agendamentos: 0,
    qualificacoes: 0,
    cancelamentos: 0,
    reagendamentos: 0,
    noShow: 0,
    metaPercent: 0,
    metaAgendamentos: 122,
    metaReunioes: 99,
    metaAgendamentosPercent: 0,
    metaReunioesPercent: 0,
    projecao: 0,
    projecaoPercent: 0,
  });

  // Approach metrics
  const [approachMetrics, setApproachMetrics] = useState({
    abordagens: 0,
    conexoes: 0,
    conversaoAbord: 0,
    conversaoAgend: 0,
    conversaoVendas: 0,
    diariaReunioes: 0,
  });

  // Daily meetings by SDR
  const [dailyMeetingsData, setDailyMeetingsData] = useState<{ day: number; [key: string]: number }[]>([]);

  // No show evolution
  const [noShowData, setNoShowData] = useState<{ day: number; noShow: number; avg: number }[]>([]);

  // Calls scheduled vs completed
  const [callsVsCompletedData, setCallsVsCompletedData] = useState<{ day: number; agendamentos: number; reunioes: number; cancelamentos: number; reagendamentos: number }[]>([]);

  // Sales summary
  const [salesSummary, setSalesSummary] = useState({
    faturamento: 0,
    receita: 0,
    quantidade: 0,
  });

  // Meeting event details for cards
  const [meetingEventDetails, setMeetingEventDetails] = useState<MeetingEventDetail[]>([]);

  useEffect(() => {
    loadPipelines();
  }, []);

  // Load data when date range is complete (both from and to selected)
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadData();
    }
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const loadPipelines = async () => {
    const { data } = await supabase
      .from("crm_pipelines")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    setPipelines(data || []);
  };

  const loadData = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    setLoading(true);
    try {
      const periodStart = dateRange.from;
      const periodEnd = dateRange.to;
      const totalDaysInPeriod = differenceInDays(periodEnd, periodStart) + 1;
      const now = new Date();
      const daysElapsed = Math.min(differenceInDays(now, periodStart) + 1, totalDaysInPeriod);

      // Load SDR staff (only actual SDR roles with CRM access)
      // First get staff with CRM permission
      const { data: crmPermissions } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");
      
      const crmStaffIds = new Set((crmPermissions || []).map(p => p.staff_id));
      
      // Load SDR staff:
      // - must be active
      // - must have CRM access
      // - must be a real pre-sales role (SDR / Social Setter / BDR)
      // Defensive filtering in JS guarantees admin/master never appear even if they have CRM permission.
      const { data: allActiveStaff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true);

      const allowedPreSalesRoles = new Set(["sdr", "social_setter", "bdr"]);
      const sdrStaff = (allActiveStaff || []).filter((s) => {
        const role = String((s as any).role ?? "").toLowerCase();
        return crmStaffIds.has(s.id) && allowedPreSalesRoles.has(role);
      });

      // Load daily activities
      const { data: dailyActivities } = await supabase
        .from("crm_daily_activities")
        .select("*")
        .gte("activity_date", format(periodStart, "yyyy-MM-dd"))
        .lte("activity_date", format(periodEnd, "yyyy-MM-dd"));

      // Load scheduled calls
      const { data: calls } = await supabase
        .from("crm_scheduled_calls")
        .select(`
          *,
          scheduled_by_staff:onboarding_staff!crm_scheduled_calls_scheduled_by_fkey(id, name),
          assigned_to_staff:onboarding_staff!crm_scheduled_calls_assigned_to_fkey(id, name)
        `)
        .gte("scheduled_at", periodStart.toISOString())
        .lte("scheduled_at", periodEnd.toISOString());

      // Load meeting events from card buttons
      const { data: meetingEvents } = await supabase
        .from("crm_meeting_events")
        .select(`
          *,
          credited_staff:onboarding_staff!crm_meeting_events_credited_staff_id_fkey(id, name),
          lead:crm_leads!crm_meeting_events_lead_id_fkey(id, name, company)
        `)
        .gte("event_date", periodStart.toISOString())
        .lte("event_date", periodEnd.toISOString());

      // Load real meeting activities to compute completed meetings per SDR
      const { data: meetingActivities } = await supabase
        .from("crm_activities")
        .select("id, lead_id, status, scheduled_at")
        .eq("type", "meeting")
        .gte("scheduled_at", periodStart.toISOString())
        .lte("scheduled_at", periodEnd.toISOString());

      const relatedLeadIds = Array.from(
        new Set(
          [...(meetingEvents || []), ...(meetingActivities || [])]
            .map((item) => item.lead_id)
            .filter(Boolean)
        )
      );

      const { data: relatedLeads } = relatedLeadIds.length
        ? await supabase
            .from("crm_leads")
            .select("id, sdr_staff_id, scheduled_by_staff_id")
            .in("id", relatedLeadIds)
        : { data: [] as any[] };

      const leadAttributionMap = new Map(
        (relatedLeads || []).map((lead) => [
          lead.id,
          lead.sdr_staff_id || lead.scheduled_by_staff_id || null,
        ])
      );

      const attributedMeetingEvents = (meetingEvents || []).map((event) => ({
        ...event,
        attributed_sdr_id: leadAttributionMap.get(event.lead_id) || event.credited_staff_id || null,
      }));

      const attributedMeetingActivities = (meetingActivities || []).map((activity) => ({
        ...activity,
        attributed_sdr_id: leadAttributionMap.get(activity.lead_id) || null,
      }));

      // Load sales
      const { data: salesData } = await supabase
        .from("crm_sales")
        .select(`
          *,
          closer:onboarding_staff!crm_sales_closer_staff_id_fkey(id, name),
          sdr:onboarding_staff!crm_sales_sdr_staff_id_fkey(id, name),
          pipeline:crm_pipelines(id, name),
          product:crm_products(id, name),
          lead:crm_leads(id, name, company)
        `)
        .gte("sale_date", format(periodStart, "yyyy-MM-dd"))
        .lte("sale_date", format(periodEnd, "yyyy-MM-dd"));

      // Load targets
      const { data: targets } = await supabase
        .from("crm_sales_targets")
        .select("*")
        .eq("month", now.getMonth() + 1)
        .eq("year", now.getFullYear())
        .in("target_type", ["calls", "meetings"]);

      // Calculate approach totals
      const totalApproaches = (dailyActivities || []).reduce((sum, a) => sum + (a.approaches || 0), 0);
      const totalConnections = (dailyActivities || []).reduce((sum, a) => sum + (a.connections || 0), 0);
      const totalScheduledFromActivities = (dailyActivities || []).reduce((sum, a) => sum + (a.scheduled || 0), 0);
      const totalQualifications = (dailyActivities || []).reduce((sum, a) => sum + (a.qualifications || 0), 0);

      // Calculate calls metrics (from scheduled_calls table)
      const totalScheduledCalls = calls?.length || 0;
      const totalCompletedCalls = (calls || []).filter(c => c.status === "completed").length;
      const totalNoShowCalls = (calls || []).filter(c => c.status === "no_show").length;
      const totalCancelled = (calls || []).filter(c => c.status === "cancelled").length;
      const totalRescheduled = (calls || []).filter(c => c.status === "rescheduled").length;
      
      // Calculate meeting events metrics (from card buttons) - out_of_icp does NOT count as realized
      const meetingEventsScheduled = (meetingEvents || []).filter(e => e.event_type === "scheduled").length;
      const meetingEventsRealized = (meetingEvents || []).filter(e => e.event_type === "realized").length;
      const meetingEventsNoShow = (meetingEvents || []).filter(e => e.event_type === "no_show").length;
      
      // Build meeting event details for detail cards (deduplicate by lead_id + event_type)
      const seenEventKeys = new Set<string>();
      const eventDetails: MeetingEventDetail[] = (meetingEvents || [])
        .filter(e => ["scheduled", "realized", "no_show", "out_of_icp"].includes(e.event_type))
        .filter(e => {
          const key = `${e.lead_id}-${e.event_type}`;
          if (seenEventKeys.has(key)) return false;
          seenEventKeys.add(key);
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
      
      // Combined totals (prefer meeting events when available, fallback to scheduled calls)
      const totalScheduled = meetingEventsScheduled > 0 ? meetingEventsScheduled : totalScheduledCalls;
      const totalCompleted = meetingEventsRealized > 0 ? meetingEventsRealized : totalCompletedCalls;
      const totalNoShow = meetingEventsNoShow > 0 ? meetingEventsNoShow : totalNoShowCalls;
      
      const showUpPercent = totalScheduled > 0 ? ((totalCompleted / totalScheduled) * 100) : 0;
      const noShowPercent = totalScheduled > 0 ? ((totalNoShow / totalScheduled) * 100) : 0;

      // Get targets
      const callsTarget = targets?.find(t => t.target_type === "calls");
      const meetingsTarget = targets?.find(t => t.target_type === "meetings");
      const metaAgendamentos = callsTarget?.target_value || 122;
      const metaReunioes = meetingsTarget?.target_value || 99;

      // Calculate projections
      const dailyAvgMeetings = daysElapsed > 0 ? totalCompleted / daysElapsed : 0;
      const projectedMeetings = dailyAvgMeetings * totalDaysInPeriod;

      // Conversion rates
      const conversaoAbord = totalApproaches > 0 ? (totalConnections / totalApproaches) * 100 : 0;
      const conversaoAgend = totalConnections > 0 ? (totalScheduled / totalConnections) * 100 : 0;
      const totalSales = salesData?.length || 0;
      const conversaoVendas = totalCompleted > 0 ? (totalSales / totalCompleted) * 100 : 0;

      setMetrics({
        reunioes: totalCompleted,
        showUpPercent,
        noShowPercent,
        agendamentos: totalScheduled,
        qualificacoes: totalQualifications,
        cancelamentos: totalCancelled,
        reagendamentos: totalRescheduled,
        noShow: totalNoShow,
        metaPercent: metaAgendamentos > 0 ? (totalScheduled / metaAgendamentos) * 100 : 0,
        metaAgendamentos,
        metaReunioes,
        metaAgendamentosPercent: metaAgendamentos > 0 ? (totalScheduled / metaAgendamentos) * 100 : 0,
        metaReunioesPercent: metaReunioes > 0 ? (totalCompleted / metaReunioes) * 100 : 0,
        projecao: projectedMeetings,
        projecaoPercent: metaReunioes > 0 ? (projectedMeetings / metaReunioes) * 100 : 0,
      });

      setApproachMetrics({
        abordagens: totalApproaches,
        conexoes: totalConnections,
        conversaoAbord,
        conversaoAgend,
        conversaoVendas,
        diariaReunioes: dailyAvgMeetings,
      });

      // Calculate SDR metrics
      const sdrMetricsList: SDRMetrics[] = (sdrStaff || []).map(sdr => {
        const sdrActivities = (dailyActivities || []).filter(a => a.staff_id === sdr.id);
        const sdrCalls = (calls || []).filter(c => c.scheduled_by === sdr.id);
        
        // Meeting events/activities attributed to this SDR through the lead ownership
        const sdrMeetingEvents = attributedMeetingEvents.filter(e => e.attributed_sdr_id === sdr.id);
        const sdrMeetingActivities = attributedMeetingActivities.filter(a => a.attributed_sdr_id === sdr.id);
        const sdrEventsScheduled = sdrMeetingEvents.filter(e => e.event_type === "scheduled").length;
        const sdrEventsRealized = sdrMeetingEvents.filter(e => e.event_type === "realized").length;
        const sdrEventsNoShow = sdrMeetingEvents.filter(e => e.event_type === "no_show").length;
        
        const approaches = sdrActivities.reduce((sum, a) => sum + (a.approaches || 0), 0);
        const connections = sdrActivities.reduce((sum, a) => sum + (a.connections || 0), 0);
        const scheduled = sdrActivities.reduce((sum, a) => sum + (a.scheduled || 0), 0);
        const qualified = sdrActivities.reduce((sum, a) => sum + (a.qualifications || 0), 0);
        
        // Combine scheduled_calls with meeting_events (prefer events when available)
        const callsScheduledFromCalls = sdrCalls.length;
        const cancelledFromCalls = sdrCalls.filter(c => c.status === "cancelled").length;
        const rescheduledFromCalls = sdrCalls.filter(c => c.status === "rescheduled").length;
        const noShowFromCalls = sdrCalls.filter(c => c.status === "no_show").length;
        const meetingsFromCalls = sdrCalls.filter(c => c.status === "completed").length;
        const meetingsFromActivities = sdrMeetingActivities.filter(a => a.status === "completed").length;
        const noShowFromActivities = sdrMeetingActivities.filter(a => a.status === "no_show").length;
        
        // Use attributed CRM meeting data first, then fallback to legacy scheduled calls
        const callsScheduled = sdrEventsScheduled > 0 ? sdrEventsScheduled : callsScheduledFromCalls;
        const noShow = sdrEventsNoShow > 0 ? sdrEventsNoShow : (noShowFromActivities > 0 ? noShowFromActivities : noShowFromCalls);
        const meetings = sdrEventsRealized > 0 ? sdrEventsRealized : (meetingsFromActivities > 0 ? meetingsFromActivities : meetingsFromCalls);
        const cancelled = cancelledFromCalls;
        const rescheduled = rescheduledFromCalls;
        
        const noShowPct = callsScheduled > 0 ? (noShow / callsScheduled) * 100 : 0;

        return {
          id: sdr.id,
          name: sdr.name,
          approaches,
          connections,
          scheduled,
          callsScheduled,
          cancelled,
          rescheduled,
          noShow,
          qualified,
          meetings,
          noShowPercent: noShowPct,
        };
      });
      setSDRs(sdrMetricsList);

      // Calculate daily meetings by SDR
      const dailyMeetings: { day: number; [key: string]: number }[] = [];
      for (let day = 1; day <= totalDaysInPeriod; day++) {
        const dayData: { day: number; [key: string]: number } = { day };
        sdrMetricsList.forEach(sdr => {
          const dayMeetings = attributedMeetingActivities.filter(activity => {
            const callDate = new Date(activity.scheduled_at);
            const dayOfPeriod = differenceInDays(callDate, periodStart) + 1;
            return dayOfPeriod === day && activity.attributed_sdr_id === sdr.id && activity.status === "completed";
          }).length;
          dayData[sdr.name] = dayMeetings;
        });
        dailyMeetings.push(dayData);
      }
      setDailyMeetingsData(dailyMeetings);

      // Calculate no show evolution
      const noShowEvolution: { day: number; noShow: number; avg: number }[] = [];
      let cumulativeNoShow = 0;
      let cumulativeTotal = 0;
      for (let day = 1; day <= totalDaysInPeriod; day++) {
        const dayCalls = (calls || []).filter(c => {
          const callDate = new Date(c.scheduled_at);
          const dayOfPeriod = differenceInDays(callDate, periodStart) + 1;
          return dayOfPeriod === day;
        });
        const dayNoShow = dayCalls.filter(c => c.status === "no_show").length;
        cumulativeNoShow += dayNoShow;
        cumulativeTotal += dayCalls.length;
        const avgNoShow = cumulativeTotal > 0 ? (cumulativeNoShow / cumulativeTotal) * 100 : 0;
        noShowEvolution.push({
          day,
          noShow: dayCalls.length > 0 ? (dayNoShow / dayCalls.length) * 100 : 0,
          avg: avgNoShow,
        });
      }
      setNoShowData(noShowEvolution);

      // Calculate calls vs completed by day
      const callsComparison: { day: number; agendamentos: number; reunioes: number; cancelamentos: number; reagendamentos: number }[] = [];
      for (let day = 1; day <= totalDaysInPeriod; day++) {
        const dayCalls = (calls || []).filter(c => {
          const callDate = new Date(c.scheduled_at);
          const dayOfPeriod = differenceInDays(callDate, periodStart) + 1;
          return dayOfPeriod === day;
        });
        callsComparison.push({
          day,
          agendamentos: dayCalls.length,
          reunioes: dayCalls.filter(c => c.status === "completed").length,
          cancelamentos: dayCalls.filter(c => c.status === "cancelled").length,
          reagendamentos: dayCalls.filter(c => c.status === "rescheduled").length,
        });
      }
      setCallsVsCompletedData(callsComparison);

      // Sales summary
      const totalFaturamento = (salesData || []).reduce((sum, s) => sum + (s.billing_value || 0), 0);
      const totalReceita = (salesData || []).reduce((sum, s) => sum + (s.revenue_value || 0), 0);
      setSalesSummary({
        faturamento: totalFaturamento,
        receita: totalReceita,
        quantidade: totalSales,
      });

      // Sales by SDR
      const salesBySdr: SaleBySDR[] = (salesData || []).map(s => ({
        id: s.id,
        pipeline: s.pipeline?.name || "-",
        client: s.lead?.company || s.lead?.name || "-",
        service: s.product?.name || s.product_name || "-",
        sdr: s.sdr?.name || "-",
        billing: s.billing_value || 0,
        revenue: s.revenue_value || 0,
        closer: s.closer?.name || "-",
      }));
      setSalesBySDR(salesBySdr);

    } catch (error) {
      console.error("Error loading presales indicators:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)} mil`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(value);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const getNoShowColor = (pct: number) =>
    pct <= 10 ? "text-emerald-400" : pct <= 20 ? "text-amber-400" : "text-rose-400";

  const getNoShowBg = (pct: number) =>
    pct <= 10 ? "bg-emerald-500/20" : pct <= 20 ? "bg-amber-500/20" : "bg-rose-500/20";

  // Filter by SDR if selected
  const filteredSdrs = selectedSDR !== "all" ? sdrs.filter(s => s.id === selectedSDR) : sdrs;
  const filteredSales = selectedSDR !== "all" ? salesBySDR.filter(s => {
    const sdr = sdrs.find(sd => sd.id === selectedSDR);
    return sdr && s.sdr === sdr.name;
  }) : selectedPipeline !== "all" ? salesBySDR.filter(s => {
    const pipeline = pipelines.find(p => p.id === selectedPipeline);
    return pipeline && s.pipeline === pipeline.name;
  }) : salesBySDR;

  const visibleMetrics = (() => {
    const agendamentos = filteredSdrs.reduce((sum, sdr) => sum + sdr.callsScheduled, 0);
    const reunioes = filteredSdrs.reduce((sum, sdr) => sum + sdr.meetings, 0);
    const noShow = filteredSdrs.reduce((sum, sdr) => sum + sdr.noShow, 0);
    const qualificacoes = filteredSdrs.reduce((sum, sdr) => sum + sdr.qualified, 0);
    const cancelamentos = filteredSdrs.reduce((sum, sdr) => sum + sdr.cancelled, 0);
    const reagendamentos = filteredSdrs.reduce((sum, sdr) => sum + sdr.rescheduled, 0);
    const showUpPercent = agendamentos > 0 ? (reunioes / agendamentos) * 100 : 0;
    const noShowPercent = agendamentos > 0 ? (noShow / agendamentos) * 100 : 0;

    return {
      ...metrics,
      agendamentos,
      reunioes,
      noShow,
      qualificacoes,
      cancelamentos,
      reagendamentos,
      showUpPercent,
      noShowPercent,
      metaPercent: metrics.metaAgendamentos > 0 ? (agendamentos / metrics.metaAgendamentos) * 100 : 0,
      metaAgendamentosPercent: metrics.metaAgendamentos > 0 ? (agendamentos / metrics.metaAgendamentos) * 100 : 0,
      metaReunioesPercent: metrics.metaReunioes > 0 ? (reunioes / metrics.metaReunioes) * 100 : 0,
    };
  })();

  // 3D Card wrapper
  const GlowCard = ({ children, className = "", glowColor = "shadow-primary/10" }: { children: React.ReactNode; className?: string; glowColor?: string }) => (
    <div className={cn(
      "relative rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden",
      "transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1",
      "shadow-lg hover:shadow-xl",
      glowColor,
      className
    )}
    style={{ background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card)/0.8) 100%)" }}
    >
      {children}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-xs border-white/10 bg-card/80 backdrop-blur-sm">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>{format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}</>
                ) : format(dateRange.from, "dd/MM/yy", { locale: ptBR })
              ) : "Período"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={ptBR} numberOfMonths={2} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        
        {!isSDRUser && (
          <Select value={selectedSDR} onValueChange={setSelectedSDR}>
            <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-white/10 bg-card/80 backdrop-blur-sm">
              <SelectValue placeholder="SDR / SS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {sdrs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-white/10 bg-card/80 backdrop-blur-sm">
            <SelectValue placeholder="Funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Funis</SelectItem>
            {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="h-9 text-xs rounded-xl border-white/10 bg-card/80">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
          {dateRange?.from && dateRange?.to && (
            <Badge className="text-xs bg-gradient-to-r from-primary/20 to-primary/10 text-primary border-primary/20">
              {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Destaques (Reuniões / Show Up / No Show) ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Reuniões", value: String(visibleMetrics.reunioes), icon: Phone, gradient: "from-sky-500 to-blue-500", glow: "shadow-sky-500/25", textColor: "text-sky-400" },
          { label: "Show Up", value: `${visibleMetrics.showUpPercent.toFixed(0)}%`, icon: CheckCircle, gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/25", textColor: "text-emerald-400" },
          { label: "No Show", value: `${visibleMetrics.noShowPercent.toFixed(0)}%`, icon: XCircle, gradient: "from-rose-500 to-pink-500", glow: "shadow-rose-500/25", textColor: "text-rose-400" },
        ].map((item, idx) => (
          <GlowCard key={idx} glowColor={item.glow}>
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.06]`} />
            <div className="relative p-5 text-center">
              <div className={`mx-auto w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-3 shadow-lg`}>
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <p className={cn("text-3xl font-black", item.textColor)}>{item.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{item.label}</p>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* ── KPIs de Atividade ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-sky-400 to-blue-400 shadow-lg shadow-sky-500/30" />
          Atividades
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Agendamentos", value: visibleMetrics.agendamentos, gradient: "from-sky-500 to-blue-500", glow: "shadow-sky-500/20", textColor: "text-sky-400" },
            { label: "Reuniões", value: visibleMetrics.reunioes, gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/20", textColor: "text-emerald-400" },
            { label: "Qualificações", value: visibleMetrics.qualificacoes, gradient: "from-violet-500 to-purple-500", glow: "shadow-violet-500/20", textColor: "text-violet-400" },
            { label: "Cancelamentos", value: visibleMetrics.cancelamentos, gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20", textColor: "text-amber-400" },
            { label: "Reagendamentos", value: visibleMetrics.reagendamentos, gradient: "from-cyan-500 to-teal-500", glow: "shadow-cyan-500/20", textColor: "text-cyan-400" },
            { label: "No Show", value: visibleMetrics.noShow, gradient: "from-rose-500 to-pink-500", glow: "shadow-rose-500/20", textColor: "text-rose-400" },
            { label: "% da Meta", value: `${visibleMetrics.metaPercent.toFixed(1)}%`, gradient: visibleMetrics.metaPercent >= 100 ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500", glow: visibleMetrics.metaPercent >= 100 ? "shadow-emerald-500/20" : "shadow-amber-500/20", textColor: visibleMetrics.metaPercent >= 100 ? "text-emerald-400" : "text-amber-400" },
          ].map((item, idx) => (
            <GlowCard key={idx} glowColor={item.glow}>
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.06]`} />
              <div className="relative p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">{item.label}</p>
                <p className={cn("text-xl font-black", item.textColor)}>{item.value}</p>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>

      {/* ── Metas & Projeção ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 shadow-lg shadow-indigo-500/30" />
          Metas & Projeção
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Meta Agend.", value: String(metrics.metaAgendamentos), gradient: "from-blue-500 to-indigo-500", glow: "shadow-blue-500/20", textColor: "text-blue-400" },
            { label: "Meta Reuniões", value: String(metrics.metaReunioes), gradient: "from-indigo-500 to-violet-500", glow: "shadow-indigo-500/20", textColor: "text-indigo-400" },
            { label: "% Meta Agend.", value: `${metrics.metaAgendamentosPercent.toFixed(0)}%`, gradient: metrics.metaAgendamentosPercent >= 100 ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500", glow: "shadow-emerald-500/20", textColor: metrics.metaAgendamentosPercent >= 100 ? "text-emerald-400" : "text-amber-400" },
            { label: "% Meta Reuniões", value: `${metrics.metaReunioesPercent.toFixed(0)}%`, gradient: metrics.metaReunioesPercent >= 100 ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500", glow: "shadow-emerald-500/20", textColor: metrics.metaReunioesPercent >= 100 ? "text-emerald-400" : "text-amber-400" },
            { label: "Projeção", value: formatNumber(metrics.projecao, 0), gradient: "from-cyan-500 to-sky-500", glow: "shadow-cyan-500/20", textColor: "text-cyan-400" },
            { label: "% Projetado", value: `${metrics.projecaoPercent.toFixed(0)}%`, gradient: metrics.projecaoPercent >= 100 ? "from-emerald-500 to-teal-500" : "from-sky-500 to-blue-500", glow: "shadow-sky-500/20", textColor: metrics.projecaoPercent >= 100 ? "text-emerald-400" : "text-sky-400" },
          ].map((item, idx) => (
            <GlowCard key={idx} glowColor={item.glow}>
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.06]`} />
              <div className="relative p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">{item.label}</p>
                <p className={cn("text-lg font-black", item.textColor)}>{item.value}</p>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>

      {/* ── Funil de Abordagem ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-violet-400 to-purple-400 shadow-lg shadow-violet-500/30" />
          Funil de Abordagem
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Abordagens", value: formatNumber(approachMetrics.abordagens), gradient: "from-violet-500 to-purple-500", glow: "shadow-violet-500/20", textColor: "text-violet-400" },
            { label: "Conexões", value: formatNumber(approachMetrics.conexoes), gradient: "from-blue-500 to-indigo-500", glow: "shadow-blue-500/20", textColor: "text-blue-400" },
            { label: "% Conv. Abord.", value: `${approachMetrics.conversaoAbord.toFixed(1)}%`, gradient: "from-cyan-500 to-sky-500", glow: "shadow-cyan-500/20", textColor: "text-cyan-400" },
            { label: "% Conv. Agend.", value: `${approachMetrics.conversaoAgend.toFixed(1)}%`, gradient: "from-sky-500 to-blue-500", glow: "shadow-sky-500/20", textColor: "text-sky-400" },
            { label: "% Conv. Vendas", value: `${approachMetrics.conversaoVendas.toFixed(1)}%`, gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/20", textColor: "text-emerald-400" },
            { label: "Diária Reuniões", value: approachMetrics.diariaReunioes.toFixed(1), gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20", textColor: "text-amber-400" },
          ].map((item, idx) => (
            <GlowCard key={idx} glowColor={item.glow}>
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.06]`} />
              <div className="relative p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">{item.label}</p>
                <p className={cn("text-lg font-black", item.textColor)}>{item.value}</p>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>

      {/* ── Tabela SDRs ── */}
      <GlowCard glowColor="shadow-violet-500/10">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <Users className="h-3.5 w-3.5 text-white" />
            </div>
            Desempenho dos SDRs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs border-white/5">
                <TableHead>SDR</TableHead>
                <TableHead className="text-center">Abord.</TableHead>
                <TableHead className="text-center">Conexões</TableHead>
                <TableHead className="text-center">Agend.</TableHead>
                <TableHead className="text-center">Calls</TableHead>
                <TableHead className="text-center">Cancel.</TableHead>
                <TableHead className="text-center">Reag.</TableHead>
                <TableHead className="text-center">No Show</TableHead>
                <TableHead className="text-center">Qualif.</TableHead>
                <TableHead className="text-center">Reuniões</TableHead>
                <TableHead className="text-center">% NS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSdrs.map(sdr => (
                <TableRow key={sdr.id} className="text-sm border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="font-semibold">{sdr.name}</TableCell>
                  <TableCell className="text-center">{formatNumber(sdr.approaches)}</TableCell>
                  <TableCell className="text-center">{sdr.connections}</TableCell>
                  <TableCell className="text-center">{sdr.callsScheduled}</TableCell>
                  <TableCell className="text-center">{sdr.callsScheduled}</TableCell>
                  <TableCell className="text-center">{sdr.cancelled}</TableCell>
                  <TableCell className="text-center">{sdr.rescheduled}</TableCell>
                  <TableCell className="text-center font-bold text-rose-400">{sdr.noShow}</TableCell>
                  <TableCell className="text-center">{sdr.qualified}</TableCell>
                  <TableCell className="text-center font-bold text-emerald-400">{sdr.meetings}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[11px] font-bold border-0", getNoShowBg(sdr.noShowPercent), getNoShowColor(sdr.noShowPercent))}>
                      {sdr.noShowPercent.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSdrs.length > 1 && (
                <TableRow className="font-bold text-sm bg-white/[0.02] border-white/5">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{formatNumber(filteredSdrs.reduce((s, c) => s + c.approaches, 0))}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.connections, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.callsScheduled, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.callsScheduled, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.cancelled, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.rescheduled, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.noShow, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.qualified, 0)}</TableCell>
                  <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.meetings, 0)}</TableCell>
                  <TableCell className="text-center">{metrics.noShowPercent.toFixed(1)}%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </GlowCard>

      {/* ── Gráficos ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Reuniões por Dia */}
        <GlowCard glowColor="shadow-emerald-500/10">
          <div className="p-5">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              Reuniões por Dia
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyMeetingsData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }} />
                  <Legend />
                  {sdrs.map((sdr, i) => (
                    <Bar key={sdr.id} dataKey={sdr.name} fill={["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"][i % 6]} stackId="a" radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlowCard>

        {/* No Show */}
        <GlowCard glowColor="shadow-rose-500/10">
          <div className="p-5">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/25">
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
              </div>
              Evolução No Show
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={noShowData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 50]} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} contentStyle={{ borderRadius: "12px", fontSize: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="noShow" name="No Show %" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 2, fill: "#EF4444" }} />
                  <Line type="monotone" dataKey="avg" name="Média" stroke="#6B7280" strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* Agendadas vs Realizadas */}
      <GlowCard glowColor="shadow-sky-500/10">
        <div className="p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 shadow-lg shadow-sky-500/25">
              <Phone className="h-3.5 w-3.5 text-white" />
            </div>
            Agendadas vs Realizadas
          </h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={callsVsCompletedData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", fontSize: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }} />
                <Legend />
                <Line type="monotone" dataKey="agendamentos" name="Agendamentos" stroke="#3B82F6" strokeWidth={2.5} />
                <Line type="monotone" dataKey="reunioes" name="Reuniões" stroke="#10B981" strokeWidth={2.5} />
                <Line type="monotone" dataKey="cancelamentos" name="Cancelamentos" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="reagendamentos" name="Reagendamentos" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlowCard>

      {/* ── Vendas (Resumo) ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 shadow-lg shadow-emerald-500/30" />
          Vendas Geradas
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Faturamento", value: formatCurrency(salesSummary.faturamento), gradient: "from-sky-500 to-blue-500", glow: "shadow-sky-500/25", textColor: "text-sky-400" },
            { label: "Receita", value: formatCurrency(salesSummary.receita), gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/25", textColor: "text-emerald-400" },
            { label: "Quantidade", value: String(salesSummary.quantidade), gradient: "from-violet-500 to-purple-500", glow: "shadow-violet-500/25", textColor: "text-violet-400" },
          ].map((item, idx) => (
            <GlowCard key={idx} glowColor={item.glow}>
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.06]`} />
              <div className="relative p-5 text-center">
                <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">{item.label}</p>
                <p className={cn("text-xl font-black", item.textColor)}>{item.value}</p>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>

      {/* ── Tabela de Vendas ── */}
      <GlowCard glowColor="shadow-amber-500/10">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                <Users className="h-3.5 w-3.5 text-white" />
              </div>
              Vendas por SDR
            </h3>
            <Badge className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-0 text-xs font-bold">{filteredSales.length} vendas</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs border-white/5">
                <TableHead>Funil</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead>Closer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda registrada</TableCell>
                </TableRow>
              ) : (
                filteredSales.map(sale => (
                  <TableRow key={sale.id} className="text-sm border-white/5 hover:bg-white/[0.02]">
                    <TableCell>{sale.pipeline}</TableCell>
                    <TableCell>{sale.client}</TableCell>
                    <TableCell>{sale.service}</TableCell>
                    <TableCell>{sale.sdr}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sale.billing)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">{formatCurrency(sale.revenue)}</TableCell>
                    <TableCell>{sale.closer}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlowCard>

      <ImportPreSalesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
};