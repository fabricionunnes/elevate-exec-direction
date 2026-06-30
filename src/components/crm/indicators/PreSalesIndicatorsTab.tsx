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
import { Phone, Users, Calendar as CalendarIcon, AlertTriangle, CheckCircle, XCircle, TrendingUp, Upload, ChevronDown, Loader2 } from "lucide-react";
import { ImportPreSalesDialog } from "@/components/crm/ImportPreSalesDialog";
import { MeetingDetailCards, MeetingEventDetail } from "@/components/crm/MeetingDetailCards";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trackMeetingEvent, getCurrentStaffId } from "@/components/crm/LeadMeetingActions";
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
  semDesfecho: number;
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
  const [semDesfechoOpen, setSemDesfechoOpen] = useState(false);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
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
    semDesfecho: 0,
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

      // Attribution: use credited_staff_id directly (events are now created with proper SDR/closer credit)
      // Fallback to lead-based attribution for legacy events
      const attributedMeetingEvents = (meetingEvents || []).map((event) => ({
        ...event,
        attributed_sdr_id: leadAttributionMap.get(event.lead_id) || event.credited_staff_id || null,
      }));

      const attributedMeetingActivities = (meetingActivities || []).map((activity) => ({
        ...activity,
        attributed_sdr_id: leadAttributionMap.get(activity.lead_id) || null,
      }));

      // Deduplicate by lead + event_type + credited_staff_id to keep separate SDR/closer events
      const uniqueAttributedMeetingEvents = (() => {
        const seen = new Set<string>();
        return attributedMeetingEvents.filter((event) => {
          const key = `${event.lead_id}-${event.event_type}-${event.credited_staff_id || "unassigned"}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })();

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
      const totalQualifications = (dailyActivities || []).reduce((sum, a) => sum + (a.qualifications || 0), 0);

      // Call-management metrics remain on scheduled_calls; meeting KPIs are canonical from meeting events
      const totalCancelled = (calls || []).filter(c => c.status === "cancelled").length;
      const totalRescheduled = (calls || []).filter(c => c.status === "rescheduled").length;

      // For TOTAL counts, deduplicate by lead_id + event_type (unique meetings regardless of who gets credit)
      const uniqueByLead = (() => {
        const seen = new Set<string>();
        return uniqueAttributedMeetingEvents.filter((event) => {
          const key = `${event.lead_id}-${event.event_type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })();
      const meetingEventsScheduled = uniqueByLead.filter(e => e.event_type === "scheduled").length;
      const meetingEventsRealized = uniqueByLead.filter(e => e.event_type === "realized").length;
      const meetingEventsNoShow = uniqueByLead.filter(e => e.event_type === "no_show").length;

      // Reuniões agendadas SEM DESFECHO: lead foi agendado mas nunca virou realizada/no-show/fora do ICP
      const leadEventTypes = new Map<string, Set<string>>();
      uniqueAttributedMeetingEvents.forEach((e: any) => {
        if (!e.lead_id) return;
        if (!leadEventTypes.has(e.lead_id)) leadEventTypes.set(e.lead_id, new Set());
        leadEventTypes.get(e.lead_id)!.add(e.event_type);
      });
      let meetingEventsSemDesfecho = 0;
      leadEventTypes.forEach((types) => {
        if (types.has("scheduled") && !types.has("realized") && !types.has("no_show") && !types.has("out_of_icp")) {
          meetingEventsSemDesfecho++;
        }
      });

      const eventDetails: MeetingEventDetail[] = uniqueAttributedMeetingEvents
        .filter(e => ["scheduled", "realized", "no_show", "out_of_icp"].includes(e.event_type))
        .map(e => ({
          id: e.id,
          lead_id: e.lead_id,
          lead_name: e.lead?.name || "Lead",
          lead_company: e.lead?.company || undefined,
          event_type: e.event_type,
          event_date: e.event_date,
          credited_staff_name: e.credited_staff?.name || undefined,
          attributed_sdr_id: e.attributed_sdr_id || undefined,
        }));
      setMeetingEventDetails(eventDetails);

      const totalScheduled = meetingEventsScheduled;
      const totalCompleted = meetingEventsRealized;
      const totalNoShow = meetingEventsNoShow;

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
        semDesfecho: meetingEventsSemDesfecho,
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

      // Calculate SDR metrics from canonical meeting events
      const sdrMetricsList: SDRMetrics[] = (sdrStaff || []).map(sdr => {
        const sdrActivities = (dailyActivities || []).filter(a => a.staff_id === sdr.id);
        const sdrCalls = (calls || []).filter(c => c.scheduled_by === sdr.id);
        const sdrMeetingEvents = uniqueAttributedMeetingEvents.filter(e => e.credited_staff_id === sdr.id);
        const sdrEventsScheduled = sdrMeetingEvents.filter(e => e.event_type === "scheduled").length;
        const sdrEventsRealized = sdrMeetingEvents.filter(e => e.event_type === "realized").length;
        const sdrEventsNoShow = sdrMeetingEvents.filter(e => e.event_type === "no_show").length;

        // Agendadas sem desfecho deste SDR
        const sdrLeadEventTypes = new Map<string, Set<string>>();
        sdrMeetingEvents.forEach((e: any) => {
          if (!e.lead_id) return;
          if (!sdrLeadEventTypes.has(e.lead_id)) sdrLeadEventTypes.set(e.lead_id, new Set());
          sdrLeadEventTypes.get(e.lead_id)!.add(e.event_type);
        });
        let sdrSemDesfecho = 0;
        sdrLeadEventTypes.forEach((types) => {
          if (types.has("scheduled") && !types.has("realized") && !types.has("no_show") && !types.has("out_of_icp")) {
            sdrSemDesfecho++;
          }
        });

        const approaches = sdrActivities.reduce((sum, a) => sum + (a.approaches || 0), 0);
        const connections = sdrActivities.reduce((sum, a) => sum + (a.connections || 0), 0);
        const scheduled = sdrActivities.reduce((sum, a) => sum + (a.scheduled || 0), 0);
        const qualified = sdrActivities.reduce((sum, a) => sum + (a.qualifications || 0), 0);
        const cancelled = sdrCalls.filter(c => c.status === "cancelled").length;
        const rescheduled = sdrCalls.filter(c => c.status === "rescheduled").length;
        const callsScheduled = sdrEventsScheduled;
        const noShow = sdrEventsNoShow;
        const meetings = sdrEventsRealized;
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
          semDesfecho: sdrSemDesfecho,
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
    const semDesfecho = filteredSdrs.reduce((sum, sdr) => sum + (sdr.semDesfecho || 0), 0);
    const showUpPercent = agendamentos > 0 ? (reunioes / agendamentos) * 100 : 0;
    const noShowPercent = agendamentos > 0 ? (noShow / agendamentos) * 100 : 0;

    return {
      ...metrics,
      agendamentos,
      reunioes,
      noShow,
      semDesfecho,
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

  // Leads agendados SEM DESFECHO (agendados que nunca viraram realizada/no-show/fora do ICP)
  const semDesfechoLeads = useMemo(() => {
    const source = selectedSDR !== "all"
      ? meetingEventDetails.filter(e => e.attributed_sdr_id === selectedSDR)
      : meetingEventDetails;
    const byLead = new Map<string, { lead_id: string; lead_name: string; lead_company?: string; types: Set<string>; scheduledDate?: string }>();
    source.forEach((e) => {
      if (!e.lead_id) return;
      let r = byLead.get(e.lead_id);
      if (!r) {
        r = { lead_id: e.lead_id, lead_name: e.lead_name, lead_company: e.lead_company, types: new Set<string>() };
        byLead.set(e.lead_id, r);
      }
      r.types.add(e.event_type);
      if (e.event_type === "scheduled") r.scheduledDate = e.event_date;
    });
    return Array.from(byLead.values())
      .filter(r => r.types.has("scheduled") && !r.types.has("realized") && !r.types.has("no_show") && !r.types.has("out_of_icp"))
      .sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  }, [meetingEventDetails, selectedSDR]);

  const handleMarkOutcome = async (leadId: string, eventType: "realized" | "no_show" | "out_of_icp") => {
    setMarkingKey(`${leadId}:${eventType}`);
    try {
      const staffId = await getCurrentStaffId();
      if (!staffId) {
        toast.error("Não foi possível identificar seu usuário no sistema.");
        return;
      }
      const { data: lead } = await supabase
        .from("crm_leads")
        .select("pipeline_id, stage_id, owner_staff_id")
        .eq("id", leadId)
        .single();
      if (!lead?.pipeline_id || !lead?.stage_id) {
        toast.error("Lead sem pipeline/etapa — não dá pra marcar por aqui.");
        return;
      }
      const ok = await trackMeetingEvent(
        leadId,
        lead.pipeline_id,
        lead.stage_id,
        eventType,
        lead.owner_staff_id || staffId,
        staffId
      );
      if (!ok) {
        toast.error("Não foi possível marcar (talvez já esteja marcado).");
        return;
      }
      toast.success(
        eventType === "realized" ? "Reunião marcada como realizada."
          : eventType === "no_show" ? "Reunião marcada como no-show."
          : "Lead marcado como fora do ICP."
      );
      await loadData();
    } catch (err: any) {
      console.error("Erro ao marcar desfecho:", err);
      toast.error(err?.message || "Erro ao marcar desfecho.");
    } finally {
      setMarkingKey(null);
    }
  };

  // Card limpo (sem glow/escala) — visual profissional
  const GlowCard = ({ children, className = "" }: { children: React.ReactNode; className?: string; glowColor?: string }) => (
    <div className={cn("relative rounded-lg border border-border/60 bg-card overflow-hidden transition-colors hover:border-border", className)}>
      {children}
    </div>
  );

  // Cor por grupo (categoria) — separa/une os cards e dá leitura semântica
  const TONE = { green: "#34d399", blue: "#60a5fa", violet: "#a78bfa", amber: "#fbbf24" };
  const Section = ({ tone, label, children, cols }: { tone: string; label: string; children: React.ReactNode; cols?: string }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: `${tone}2e`, background: `${tone}0d` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: tone }}>{label}</span>
      </div>
      <div className={cn("grid gap-3", cols || "grid-cols-2 sm:grid-cols-3")}>{children}</div>
    </div>
  );
  const Metric = ({ tone, label, value, color, big, onClick }: { tone: string; label: string; value: string | number; color?: string; big?: boolean; onClick?: () => void }) => (
    <div
      className={cn("rounded-lg border bg-card p-4", onClick && "cursor-pointer hover:bg-muted/40 transition-colors")}
      style={{ borderColor: `${tone}26` }}
      onClick={onClick}
    >
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}{onClick ? " ›" : ""}</p>
      <p className={cn("font-semibold mt-1.5 tabular-nums", big ? "text-2xl" : "text-lg")} style={color ? { color } : undefined}>{value}</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-xs border-border ">
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
            <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-border ">
              <SelectValue placeholder="SDR / SS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {sdrs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-border ">
            <SelectValue placeholder="Funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Funis</SelectItem>
            {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="h-9 text-xs rounded-xl border-border bg-card/80">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
          {dateRange?.from && dateRange?.to && (
            <Badge className="text-xs bg-muted text-foreground border-border">
              {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Destaques (azul) ── */}
      <Section tone={TONE.blue} label="Destaques" cols="grid-cols-3">
        <Metric tone={TONE.blue} label="Reuniões" value={visibleMetrics.reunioes} color={TONE.blue} big />
        <Metric tone={TONE.blue} label="Show Up" value={`${visibleMetrics.showUpPercent.toFixed(0)}%`} color="#34d399" big />
        <Metric tone={TONE.blue} label="No Show" value={`${visibleMetrics.noShowPercent.toFixed(0)}%`} color={visibleMetrics.noShowPercent > 30 ? "#f87171" : undefined} big />
      </Section>

      {/* ── Detalhamento de Reuniões ── */}
      <div className="space-y-2.5">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Detalhamento das Reuniões</h3>
        <MeetingDetailCards events={selectedSDR !== "all" ? meetingEventDetails.filter(e => e.attributed_sdr_id === selectedSDR) : meetingEventDetails} />
      </div>

      {/* ── Atividades (âmbar) ── */}
      <Section tone={TONE.amber} label="Atividades" cols="grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <Metric tone={TONE.amber} label="Agendamentos" value={visibleMetrics.agendamentos} color={TONE.amber} />
        <Metric tone={TONE.amber} label="Reuniões" value={visibleMetrics.reunioes} />
        <Metric tone={TONE.amber} label="Qualificações" value={visibleMetrics.qualificacoes} />
        <Metric tone={TONE.amber} label="Cancelamentos" value={visibleMetrics.cancelamentos} />
        <Metric tone={TONE.amber} label="Reagendamentos" value={visibleMetrics.reagendamentos} />
        <Metric tone={TONE.amber} label="No Show" value={visibleMetrics.noShow} color={visibleMetrics.noShow > 0 ? "#f87171" : undefined} />
        <Metric tone={TONE.amber} label="Sem Desfecho" value={visibleMetrics.semDesfecho} color={visibleMetrics.semDesfecho > 0 ? "#fb923c" : undefined} onClick={semDesfechoLeads.length > 0 ? () => setSemDesfechoOpen(true) : undefined} />
        <Metric tone={TONE.amber} label="% da Meta" value={`${visibleMetrics.metaPercent.toFixed(1)}%`} color={visibleMetrics.metaPercent >= 100 ? "#34d399" : "#fbbf24"} />
      </Section>

      {/* ── Metas & Projeção (verde) ── */}
      <Section tone={TONE.green} label="Metas & Projeção" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric tone={TONE.green} label="Meta Agend." value={metrics.metaAgendamentos} />
        <Metric tone={TONE.green} label="Meta Reuniões" value={metrics.metaReunioes} />
        <Metric tone={TONE.green} label="% Meta Agend." value={`${metrics.metaAgendamentosPercent.toFixed(0)}%`} color={metrics.metaAgendamentosPercent >= 100 ? "#34d399" : "#fbbf24"} />
        <Metric tone={TONE.green} label="% Meta Reuniões" value={`${metrics.metaReunioesPercent.toFixed(0)}%`} color={metrics.metaReunioesPercent >= 100 ? "#34d399" : "#fbbf24"} />
        <Metric tone={TONE.green} label="Projeção" value={formatNumber(metrics.projecao, 0)} color={TONE.green} />
        <Metric tone={TONE.green} label="% Projetado" value={`${metrics.projecaoPercent.toFixed(0)}%`} color={metrics.projecaoPercent >= 100 ? "#34d399" : "#fbbf24"} />
      </Section>

      {/* ── Funil de Abordagem (roxo) ── */}
      <Section tone={TONE.violet} label="Funil de Abordagem" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric tone={TONE.violet} label="Abordagens" value={formatNumber(approachMetrics.abordagens)} color={TONE.violet} />
        <Metric tone={TONE.violet} label="Conexões" value={formatNumber(approachMetrics.conexoes)} />
        <Metric tone={TONE.violet} label="% Conv. Abord." value={`${approachMetrics.conversaoAbord.toFixed(1)}%`} />
        <Metric tone={TONE.violet} label="% Conv. Agend." value={`${approachMetrics.conversaoAgend.toFixed(1)}%`} />
        <Metric tone={TONE.violet} label="% Conv. Vendas" value={`${approachMetrics.conversaoVendas.toFixed(1)}%`} color="#34d399" />
        <Metric tone={TONE.violet} label="Diária Reuniões" value={approachMetrics.diariaReunioes.toFixed(1)} />
      </Section>

      {/* ── Tabela SDRs ── */}
      <GlowCard glowColor="shadow-violet-500/10">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            Desempenho dos SDRs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs border-border/50">
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
                <TableRow key={sdr.id} className="text-sm border-border/50 hover:bg-muted/40">
                  <TableCell className="font-semibold">{sdr.name}</TableCell>
                  <TableCell className="text-center">{formatNumber(sdr.approaches)}</TableCell>
                  <TableCell className="text-center">{sdr.connections}</TableCell>
                  <TableCell className="text-center">{sdr.callsScheduled}</TableCell>
                  <TableCell className="text-center">{sdr.callsScheduled}</TableCell>
                  <TableCell className="text-center">{sdr.cancelled}</TableCell>
                  <TableCell className="text-center">{sdr.rescheduled}</TableCell>
                  <TableCell className="text-center font-semibold text-rose-400">{sdr.noShow}</TableCell>
                  <TableCell className="text-center">{sdr.qualified}</TableCell>
                  <TableCell className="text-center font-semibold text-emerald-400">{sdr.meetings}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[11px] font-semibold border-0", getNoShowBg(sdr.noShowPercent), getNoShowColor(sdr.noShowPercent))}>
                      {sdr.noShowPercent.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSdrs.length > 1 && (
                <TableRow className="font-semibold text-sm bg-muted/30 border-border/50">
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
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-muted">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
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
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
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
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
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

      {/* ── Vendas Geradas (verde) ── */}
      <div className="space-y-2.5">
        <Section tone={TONE.green} label="Vendas Geradas" cols="grid-cols-3">
          <Metric tone={TONE.green} label="Faturamento" value={formatCurrency(salesSummary.faturamento)} color={TONE.green} />
          <Metric tone={TONE.green} label="Receita" value={formatCurrency(salesSummary.receita)} color={TONE.green} />
          <Metric tone={TONE.green} label="Quantidade" value={salesSummary.quantidade} />
        </Section>
      </div>

      {/* ── Tabela de Vendas ── */}
      <GlowCard glowColor="shadow-amber-500/10">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Vendas por SDR
            </h3>
            <Badge className="bg-muted text-foreground border-0 text-xs font-semibold">{filteredSales.length} vendas</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs border-border/50">
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
                  <TableRow key={sale.id} className="text-sm border-border/50 hover:bg-muted/40">
                    <TableCell>{sale.pipeline}</TableCell>
                    <TableCell>{sale.client}</TableCell>
                    <TableCell>{sale.service}</TableCell>
                    <TableCell>{sale.sdr}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sale.billing)}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">{formatCurrency(sale.revenue)}</TableCell>
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

      <Dialog open={semDesfechoOpen} onOpenChange={setSemDesfechoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reuniões agendadas sem desfecho</DialogTitle>
            <DialogDescription>
              Foram agendadas mas ninguém marcou o resultado. Marque cada uma pra contar certo no mês.
            </DialogDescription>
          </DialogHeader>
          {semDesfechoLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nada pendente. Tudo marcado.</p>
          ) : (
            <div className="space-y-2">
              {semDesfechoLeads.map((l) => (
                <div key={l.lead_id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.lead_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {l.lead_company ? `${l.lead_company} · ` : ""}
                      {l.scheduledDate ? `agendada ${format(new Date(l.scheduledDate), "dd/MM/yy")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline" size="sm"
                      className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      disabled={!!markingKey}
                      onClick={() => handleMarkOutcome(l.lead_id, "realized")}
                    >
                      {markingKey === `${l.lead_id}:realized` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      Realizada
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={!!markingKey}
                      onClick={() => handleMarkOutcome(l.lead_id, "no_show")}
                    >
                      {markingKey === `${l.lead_id}:no_show` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      No-show
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      disabled={!!markingKey}
                      onClick={() => handleMarkOutcome(l.lead_id, "out_of_icp")}
                      title="Fora do ICP"
                    >
                      {markingKey === `${l.lead_id}:out_of_icp` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};