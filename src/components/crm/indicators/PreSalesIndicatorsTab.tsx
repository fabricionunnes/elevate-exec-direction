import { useEffect, useState } from "react";
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
          credited_staff:onboarding_staff!crm_meeting_events_credited_staff_id_fkey(id, name)
        `)
        .gte("event_date", periodStart.toISOString())
        .lte("event_date", periodEnd.toISOString());

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
      
      // Calculate meeting events metrics (from card buttons)
      const meetingEventsScheduled = (meetingEvents || []).filter(e => e.event_type === "scheduled").length;
      const meetingEventsRealized = (meetingEvents || []).filter(e => e.event_type === "realized").length;
      const meetingEventsNoShow = (meetingEvents || []).filter(e => e.event_type === "no_show").length;
      
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
        
        // Meeting events credited to this SDR
        const sdrMeetingEvents = (meetingEvents || []).filter(e => e.credited_staff_id === sdr.id);
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
        
        // Use meeting events if available, otherwise use scheduled calls
        const callsScheduled = sdrEventsScheduled > 0 ? sdrEventsScheduled : callsScheduledFromCalls;
        const noShow = sdrEventsNoShow > 0 ? sdrEventsNoShow : noShowFromCalls;
        const meetings = sdrEventsRealized > 0 ? sdrEventsRealized : meetingsFromCalls;
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
          const dayMeetings = (calls || []).filter(c => {
            const callDate = new Date(c.scheduled_at);
            const dayOfPeriod = differenceInDays(callDate, periodStart) + 1;
            return dayOfPeriod === day && c.scheduled_by === sdr.id && c.status === "completed";
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
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const getNoShowColor = (pct: number) =>
    pct <= 10 ? "text-emerald-500 border-emerald-500/40" : pct <= 20 ? "text-amber-500 border-amber-500/40" : "text-rose-500 border-rose-500/40";

  // Filter by SDR if selected
  const filteredSdrs = selectedSDR !== "all" ? sdrs.filter(s => s.id === selectedSDR) : sdrs;
  const filteredSales = selectedSDR !== "all" ? salesBySDR.filter(s => {
    const sdr = sdrs.find(sd => sd.id === selectedSDR);
    return sdr && s.sdr === sdr.name;
  }) : selectedPipeline !== "all" ? salesBySDR.filter(s => {
    const pipeline = pipelines.find(p => p.id === selectedPipeline);
    return pipeline && s.pipeline === pipeline.name;
  }) : salesBySDR;

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg text-xs">
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
            <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
              <SelectValue placeholder="SDR / SS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {sdrs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
            <SelectValue placeholder="Funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Funis</SelectItem>
            {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="h-9 text-xs rounded-lg">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
          {dateRange?.from && dateRange?.to && (
            <Badge variant="secondary" className="text-xs">
              {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Destaques (Reuniões / Show Up / No Show) ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Reuniões", value: String(metrics.reunioes), icon: Phone, accent: "text-sky-500", border: "border-sky-500/20" },
          { label: "Show Up", value: `${metrics.showUpPercent.toFixed(0)}%`, icon: CheckCircle, accent: "text-emerald-500", border: "border-emerald-500/20" },
          { label: "No Show", value: `${metrics.noShowPercent.toFixed(0)}%`, icon: XCircle, accent: "text-rose-500", border: "border-rose-500/20" },
        ].map((item, idx) => (
          <Card key={idx} className={cn("border", item.border)}>
            <CardContent className="p-4 text-center">
              <div className="mx-auto w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                <item.icon className={cn("h-5 w-5", item.accent)} />
              </div>
              <p className={cn("text-3xl font-bold", item.accent)}>{item.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── KPIs de Atividade ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" /> Atividades
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Agendamentos", value: metrics.agendamentos, accent: "text-sky-500" },
            { label: "Reuniões", value: metrics.reunioes, accent: "text-emerald-500" },
            { label: "Qualificações", value: metrics.qualificacoes, accent: "text-violet-500" },
            { label: "Cancelamentos", value: metrics.cancelamentos, accent: "text-amber-500" },
            { label: "Reagendamentos", value: metrics.reagendamentos, accent: "text-sky-500" },
            { label: "No Show", value: metrics.noShow, accent: "text-rose-500" },
            { label: "% da Meta", value: `${metrics.metaPercent.toFixed(1)}%`, accent: metrics.metaPercent >= 100 ? "text-emerald-500" : "text-amber-500" },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                <p className={cn("text-xl font-bold", item.accent)}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Metas & Projeção ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" /> Metas & Projeção
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Meta Agend.", value: String(metrics.metaAgendamentos) },
            { label: "Meta Reuniões", value: String(metrics.metaReunioes) },
            { label: "% Meta Agend.", value: `${metrics.metaAgendamentosPercent.toFixed(0)}%`, accent: metrics.metaAgendamentosPercent >= 100 ? "text-emerald-500" : "text-amber-500" },
            { label: "% Meta Reuniões", value: `${metrics.metaReunioesPercent.toFixed(0)}%`, accent: metrics.metaReunioesPercent >= 100 ? "text-emerald-500" : "text-amber-500" },
            { label: "Projeção", value: formatNumber(metrics.projecao, 0) },
            { label: "% Projetado", value: `${metrics.projecaoPercent.toFixed(0)}%`, accent: metrics.projecaoPercent >= 100 ? "text-emerald-500" : "text-sky-500" },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                <p className={cn("text-lg font-bold", (item as any).accent || "text-foreground")}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Funil de Abordagem ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-3.5 w-3.5" /> Funil de Abordagem
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Abordagens", value: formatNumber(approachMetrics.abordagens) },
            { label: "Conexões", value: formatNumber(approachMetrics.conexoes) },
            { label: "% Conv. Abord.", value: `${approachMetrics.conversaoAbord.toFixed(1)}%`, accent: "text-sky-500" },
            { label: "% Conv. Agend.", value: `${approachMetrics.conversaoAgend.toFixed(1)}%`, accent: "text-sky-500" },
            { label: "% Conv. Vendas", value: `${approachMetrics.conversaoVendas.toFixed(1)}%`, accent: "text-emerald-500" },
            { label: "Diária Reuniões", value: approachMetrics.diariaReunioes.toFixed(1) },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                <p className={cn("text-lg font-bold", (item as any).accent || "text-foreground")}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Tabela SDRs ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            Desempenho dos SDRs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
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
                  <TableRow key={sdr.id} className="text-sm">
                    <TableCell className="font-medium">{sdr.name}</TableCell>
                    <TableCell className="text-center">{formatNumber(sdr.approaches)}</TableCell>
                    <TableCell className="text-center">{sdr.connections}</TableCell>
                    <TableCell className="text-center">{sdr.scheduled}</TableCell>
                    <TableCell className="text-center">{sdr.callsScheduled}</TableCell>
                    <TableCell className="text-center">{sdr.cancelled}</TableCell>
                    <TableCell className="text-center">{sdr.rescheduled}</TableCell>
                    <TableCell className="text-center font-semibold text-rose-500">{sdr.noShow}</TableCell>
                    <TableCell className="text-center">{sdr.qualified}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-500">{sdr.meetings}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("text-[11px] font-bold", getNoShowColor(sdr.noShowPercent))}>
                        {sdr.noShowPercent.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSdrs.length > 1 && (
                  <TableRow className="font-bold text-sm bg-muted/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{formatNumber(filteredSdrs.reduce((s, c) => s + c.approaches, 0))}</TableCell>
                    <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.connections, 0)}</TableCell>
                    <TableCell className="text-center">{filteredSdrs.reduce((s, c) => s + c.scheduled, 0)}</TableCell>
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
        </CardContent>
      </Card>

      {/* ── Gráficos ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Reuniões por Dia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Reuniões por Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyMeetingsData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  <Legend />
                  {sdrs.map((sdr, i) => (
                    <Bar key={sdr.id} dataKey={sdr.name} fill={["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"][i % 6]} stackId="a" radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* No Show */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Evolução No Show
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={noShowData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 50]} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="noShow" name="No Show %" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="avg" name="Média" stroke="#6B7280" strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agendadas vs Realizadas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-sky-500" />
            Agendadas vs Realizadas
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={callsVsCompletedData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="agendamentos" name="Agendamentos" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="reunioes" name="Reuniões" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="cancelamentos" name="Cancelamentos" stroke="#F59E0B" strokeWidth={1} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="reagendamentos" name="Reagendamentos" stroke="#8B5CF6" strokeWidth={1} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Vendas (Resumo) ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" /> Vendas Geradas
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Faturamento", value: formatCurrency(salesSummary.faturamento), accent: "text-sky-500" },
            { label: "Receita", value: formatCurrency(salesSummary.receita), accent: "text-emerald-500" },
            { label: "Quantidade", value: String(salesSummary.quantidade), accent: "text-violet-500" },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 text-center">
                <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                <p className={cn("text-xl font-bold", item.accent)}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Tabela de Vendas ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            Vendas por SDR
            <Badge variant="secondary" className="ml-auto text-xs">{filteredSales.length} vendas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
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
                    <TableRow key={sale.id} className="text-sm">
                      <TableCell>{sale.pipeline}</TableCell>
                      <TableCell>{sale.client}</TableCell>
                      <TableCell>{sale.service}</TableCell>
                      <TableCell>{sale.sdr}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.billing)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-500">{formatCurrency(sale.revenue)}</TableCell>
                      <TableCell>{sale.closer}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ImportPreSalesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
};