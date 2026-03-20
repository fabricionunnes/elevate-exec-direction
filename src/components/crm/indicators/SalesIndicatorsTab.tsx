import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Upload } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, getDaysInMonth, getDate, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Target, Phone, TrendingUp, DollarSign, Percent, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRemainingBusinessDaysInMonth } from "@/lib/businessDays";
import { ImportSalesDialog } from "@/components/crm/ImportSalesDialog";
import { TermVisionChart } from "@/components/crm/reports/TermVisionChart";

interface CloserMetrics {
  id: string;
  name: string;
  callsScheduled: number;
  callsCompleted: number;
  salesQty: number;
  revenue: number;
  metaPercent: number;
  conversion: number;
  ticketMedio: number;
}

interface SaleRecord {
  id: string;
  saleDate: string;
  pipeline: string;
  closer: string;
  closerId: string;
  sdr: string;
  company: string;
  product: string;
  revenue: number;
}

interface ForecastRecord {
  id: string;
  day: number;
  closer: string;
  closerId: string;
  client: string;
  status: string;
  product: string;
  value: number;
}

type DateFilterType = "today" | "week" | "month" | "quarter" | "custom";

interface SalesIndicatorsTabProps {
  staffId?: string | null;
  staffRole?: string | null;
}

export const SalesIndicatorsTab = ({ staffId, staffRole }: SalesIndicatorsTabProps = {}) => {
  const isCloserUser = staffRole === "closer";
  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";
  const [loading, setLoading] = useState(true);
  const [selectedCloser, setSelectedCloser] = useState<string>(isCloserUser && staffId ? staffId : "all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilterType>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  
  // Raw data state (fetched from DB, unfiltered)
  const [rawSalesData, setRawSalesData] = useState<any[]>([]);
  const [rawMeetingEvents, setRawMeetingEvents] = useState<any[]>([]);
  const [rawCalls, setRawCalls] = useState<any[]>([]);
  const [rawForecastData, setRawForecastData] = useState<any[]>([]);
  const [rawNegotiationData, setRawNegotiationData] = useState<any[]>([]);
  const [rawCloserStaff, setRawCloserStaff] = useState<{ id: string; name: string }[]>([]);
  const [staffGoalsMap, setStaffGoalsMap] = useState<Map<string, { meta: number; super: number; hiper: number }>>(new Map());
  const [totalGoals, setTotalGoals] = useState({ meta: 0, super: 0, hiper: 0 });
  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(new Date()));
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(new Date()));

  // Get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: now, end: now };
      case "week":
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "custom":
        return { 
          start: customDateFrom || startOfMonth(now), 
          end: customDateTo || endOfMonth(now) 
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  useEffect(() => {
    loadData();
    loadProducts();
  }, [dateFilter, customDateFrom, customDateTo]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from("crm_products")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");
    
    setProducts(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start: filterStart, end: filterEnd } = getDateRange();
      setFilterStartDate(filterStart);
      setFilterEndDate(filterEnd);
      const filterMonth = filterStart.getMonth() + 1;
      const filterYear = filterStart.getFullYear();

      // Load closers (staff with closer role who have CRM access)
      const { data: crmAccessData } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");
      
      const crmStaffIds = new Set((crmAccessData || []).map(a => a.staff_id));

      const { data: allActiveStaff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true);

      const allowedCloserRoles = new Set(["closer", "head_comercial"]);
      const filteredCloserStaff = (allActiveStaff || []).filter(staff => {
        const role = String((staff as any).role ?? "").toLowerCase();
        return crmStaffIds.has(staff.id) && allowedCloserRoles.has(role);
      });
      setRawCloserStaff(filteredCloserStaff.map(s => ({ id: s.id, name: s.name })));

      // Load scheduled calls
      const { data: calls } = await supabase
        .from("crm_scheduled_calls")
        .select(`
          *,
          scheduled_by_staff:onboarding_staff!crm_scheduled_calls_scheduled_by_fkey(id, name),
          assigned_to_staff:onboarding_staff!crm_scheduled_calls_assigned_to_fkey(id, name)
        `)
        .gte("scheduled_at", filterStart.toISOString())
        .lte("scheduled_at", filterEnd.toISOString());
      setRawCalls(calls || []);

      // Load meeting events
      const { data: meetingEvents } = await supabase
        .from("crm_meeting_events")
        .select(`
          *,
          credited_staff:onboarding_staff!crm_meeting_events_credited_staff_id_fkey(id, name)
        `)
        .gte("event_date", filterStart.toISOString())
        .lte("event_date", filterEnd.toISOString());
      setRawMeetingEvents(meetingEvents || []);

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
        .gte("sale_date", format(filterStart, "yyyy-MM-dd"))
        .lte("sale_date", format(filterEnd, "yyyy-MM-dd"));
      setRawSalesData(salesData || []);

      // Load forecasts from leads in "Forecast" stages across all pipelines
      const { data: forecastStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%forecast%");

      if (forecastStages && forecastStages.length > 0) {
        const forecastStageIds = forecastStages.map(s => s.id);
        const { data: forecastLeads } = await supabase
          .from("crm_leads")
          .select("id, name, company, opportunity_value, owner_staff_id, stage_id")
          .in("stage_id", forecastStageIds);
        setRawForecastData(forecastLeads || []);
      } else {
        setRawForecastData([]);
      }

      // Load "Em Negociação" from leads in "Realizada" stages across all pipelines
      const { data: realizadaStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%realizada%");

      if (realizadaStages && realizadaStages.length > 0) {
        const realizadaStageIds = realizadaStages.map(s => s.id);
        const { data: negotiationLeads } = await supabase
          .from("crm_leads")
          .select("id, name, company, opportunity_value, owner_staff_id, stage_id")
          .in("stage_id", realizadaStageIds);
        setRawNegotiationData(negotiationLeads || []);
      } else {
        setRawNegotiationData([]);
      }

      // Load goals
      const { data: goalTypeData } = await supabase
        .from("crm_goal_types")
        .select("id")
        .eq("name", "Vendas")
        .eq("is_active", true)
        .single();

      const goalsMap = new Map<string, { meta: number; super: number; hiper: number }>();
      let totalMeta = 0, totalSuper = 0, totalHiper = 0;

      if (goalTypeData?.id) {
        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("*")
          .eq("goal_type_id", goalTypeData.id)
          .eq("month", filterMonth)
          .eq("year", filterYear);

        if (goalValues && goalValues.length > 0) {
          goalValues.forEach(g => {
            goalsMap.set(g.staff_id, {
              meta: g.meta_value || 0,
              super: g.super_meta_value || 0,
              hiper: g.hiper_meta_value || 0,
            });
          });
          totalMeta = goalValues.reduce((sum, g) => sum + (g.meta_value || 0), 0);
          totalSuper = goalValues.reduce((sum, g) => sum + (g.super_meta_value || 0), 0);
          totalHiper = goalValues.reduce((sum, g) => sum + (g.hiper_meta_value || 0), 0);
        }
      }
      setStaffGoalsMap(goalsMap);
      setTotalGoals({ meta: totalMeta, super: totalSuper, hiper: totalHiper });

    } catch (error) {
      console.error("Error loading sales indicators:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived / filtered metrics ──
  const computed = useMemo(() => {
    const now = new Date();
    const daysInMonth = getDaysInMonth(filterStartDate);
    const currentDay = getDate(now);
    const isCloserFilter = selectedCloser !== "all";

    // Filter raw data by selected closer
    const salesData = isCloserFilter
      ? rawSalesData.filter(s => s.closer_staff_id === selectedCloser)
      : rawSalesData;

    const meetingEvents = isCloserFilter
      ? rawMeetingEvents.filter(e => e.credited_staff_id === selectedCloser)
      : rawMeetingEvents;

    const calls = isCloserFilter
      ? rawCalls.filter(c => c.assigned_to === selectedCloser)
      : rawCalls;

    const forecastData = isCloserFilter
      ? rawForecastData.filter(f => f.owner_staff_id === selectedCloser)
      : rawForecastData;

    const negotiationData = isCloserFilter
      ? rawNegotiationData.filter(f => f.owner_staff_id === selectedCloser)
      : rawNegotiationData;

    // Goals: use closer-specific or total
    let metaReceita: number, superMeta: number, hiperMeta: number;
    if (isCloserFilter) {
      const closerGoal = staffGoalsMap.get(selectedCloser);
      metaReceita = closerGoal?.meta || 0;
      superMeta = closerGoal?.super || 0;
      hiperMeta = closerGoal?.hiper || 0;
    } else {
      metaReceita = totalGoals.meta;
      superMeta = totalGoals.super;
      hiperMeta = totalGoals.hiper;
    }

    // Sales metrics
    const totalRevenue = salesData.reduce((sum, s) => sum + (s.revenue_value || 0), 0);
    const totalSales = salesData.length;
    const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Calls metrics
    const totalScheduledCalls = calls.length;
    const totalCompletedCalls = calls.filter(c => c.status === "completed").length;
    const totalNoShowCalls = calls.filter(c => c.status === "no_show").length;

    const meetingEventsScheduled = meetingEvents.filter(e => e.event_type === "scheduled").length;
    const meetingEventsRealized = meetingEvents.filter(e => e.event_type === "realized").length;
    const meetingEventsNoShow = meetingEvents.filter(e => e.event_type === "no_show").length;

    const totalScheduled = meetingEventsScheduled > 0 ? meetingEventsScheduled : totalScheduledCalls;
    const totalCompleted = meetingEventsRealized > 0 ? meetingEventsRealized : totalCompletedCalls;
    const totalNoShow = meetingEventsNoShow > 0 ? meetingEventsNoShow : totalNoShowCalls;

    const noShowPercent = totalScheduled > 0 ? (totalNoShow / totalScheduled) * 100 : 0;
    const conversion = totalCompleted > 0 ? (totalSales / totalCompleted) * 100 : 0;

    // Projection
    const dailyAvg = currentDay > 0 ? totalRevenue / currentDay : 0;
    const projectedRevenue = dailyAvg * daysInMonth;
    const projectedPercent = metaReceita > 0 ? (projectedRevenue / metaReceita) * 100 : 0;

    // Forecast
    const forecastTotal = forecastData.reduce((sum, f) => sum + (f.opportunity_value || 0), 0);

    // Em Negociação
    const negotiationTotal = negotiationData.reduce((sum, f) => sum + (f.opportunity_value || 0), 0);

    const metrics = {
      metaReceita,
      receita: totalRevenue,
      faltaReceita: Math.max(0, metaReceita - totalRevenue),
      vendas: totalSales,
      ticketMedio,
      qtr: 0,
      conversao: conversion,
      superMeta,
      hiperMeta,
      faltaSuper: Math.max(0, superMeta - totalRevenue),
      faltaHiper: Math.max(0, hiperMeta - totalRevenue),
      forecast: forecastTotal,
      emNegociacao: negotiationTotal,
      projecaoReceita: projectedRevenue,
      projecaoPercent: projectedPercent,
    };

    const callsMetrics = {
      agendadas: totalScheduled,
      realizadas: totalCompleted,
      noShowPercent,
    };

    // Daily goal
    const businessDaysLeft = getRemainingBusinessDaysInMonth(now);
    const remaining = Math.max(0, metaReceita - totalRevenue);
    const dailyTarget = businessDaysLeft > 0 ? remaining / businessDaysLeft : 0;

    const dailyGoal = {
      monthlyTarget: metaReceita,
      achieved: totalRevenue,
      remaining,
      businessDaysLeft,
      dailyTarget,
    };

    // Closer metrics table (always show all closers in the table)
    const closerMetrics: CloserMetrics[] = rawCloserStaff.map(closer => {
      const closerCalls = rawCalls.filter(c => c.assigned_to === closer.id);
      const closerSales = rawSalesData.filter(s => s.closer_staff_id === closer.id);
      const closerRevenue = closerSales.reduce((sum, s) => sum + (s.revenue_value || 0), 0);

      const closerMeetingEvts = rawMeetingEvents.filter(e => e.credited_staff_id === closer.id);
      const closerEventsScheduled = closerMeetingEvts.filter(e => e.event_type === "scheduled").length;
      const closerEventsRealized = closerMeetingEvts.filter(e => e.event_type === "realized").length;

      const closerCompletedFromCalls = closerCalls.filter(c => c.status === "completed").length;
      const closerScheduledFromCalls = closerCalls.length;

      const closerScheduled = closerEventsScheduled > 0 ? closerEventsScheduled : closerScheduledFromCalls;
      const closerCompleted = closerEventsRealized > 0 ? closerEventsRealized : closerCompletedFromCalls;

      const closerGoal = staffGoalsMap.get(closer.id);
      const closerMeta = closerGoal?.meta || (totalGoals.meta / (rawCloserStaff.length || 1));

      return {
        id: closer.id,
        name: closer.name,
        callsScheduled: closerScheduled,
        callsCompleted: closerCompleted,
        salesQty: closerSales.length,
        revenue: closerRevenue,
        metaPercent: closerMeta > 0 ? (closerRevenue / closerMeta) * 100 : 0,
        conversion: closerCompleted > 0 ? (closerSales.length / closerCompleted) * 100 : 0,
        ticketMedio: closerSales.length > 0 ? closerRevenue / closerSales.length : 0,
      };
    });

    // Sales records (filtered)
    const salesRecords: SaleRecord[] = salesData.map(s => ({
      id: s.id,
      saleDate: format(new Date(s.sale_date), "dd"),
      pipeline: s.pipeline?.name || "-",
      closer: s.closer?.name || "-",
      closerId: s.closer_staff_id || "",
      sdr: s.sdr?.name || "-",
      company: s.lead?.company || s.lead?.name || "-",
      product: s.product?.name || s.product_name || "-",
      revenue: s.revenue_value || 0,
    }));

    // Forecast records (filtered)
    const forecastRecords: ForecastRecord[] = forecastData.map(f => {
      const closerInfo = rawCloserStaff.find(s => s.id === f.owner_staff_id);
      return {
        id: f.id,
        day: 0,
        closer: closerInfo?.name || "-",
        closerId: f.owner_staff_id || "",
        client: f.name || f.company || "-",
        status: "open",
        product: "-",
        value: f.opportunity_value || 0,
      };
    });

    // Daily revenue accumulation (always per closer for chart)
    const dailyRevenueData: { day: number; [key: string]: number }[] = [];
    const closerNames = closerMetrics.map(c => c.name);
    for (let day = 1; day <= currentDay; day++) {
      const dayData: { day: number; [key: string]: number } = { day };
      closerNames.forEach(name => {
        const closerDayRevenue = rawSalesData
          .filter(s => {
            const saleDay = getDate(new Date(s.sale_date));
            return saleDay <= day && s.closer?.name === name;
          })
          .reduce((sum, s) => sum + (s.revenue_value || 0), 0);
        dayData[name] = closerDayRevenue;
      });
      dailyRevenueData.push(dayData);
    }

    // Revenue evolution (filtered)
    const revenueByDay: Record<number, number> = {};
    salesData.forEach(s => {
      const saleDay = parseInt(s.sale_date.split('-')[2], 10);
      revenueByDay[saleDay] = (revenueByDay[saleDay] || 0) + (s.revenue_value || 0);
    });

    const revenueEvolution: { day: number; meta: number; receita: number | null; super: number; hiper: number }[] = [];
    let accumulatedRevenue = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (day <= currentDay) {
        accumulatedRevenue += (revenueByDay[day] || 0);
      }
      revenueEvolution.push({
        day,
        meta: (metaReceita / daysInMonth) * day,
        receita: day <= currentDay ? accumulatedRevenue : null,
        super: (superMeta / daysInMonth) * day,
        hiper: (hiperMeta / daysInMonth) * day,
      });
    }

    // Product distribution (filtered)
    const productGroups: Record<string, number> = {};
    salesData.forEach(s => {
      const productName = s.product?.name || s.product_name || "Outros";
      productGroups[productName] = (productGroups[productName] || 0) + (s.revenue_value || 0);
    });
    const colors = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    const productDistribution = Object.entries(productGroups).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));

    return {
      metrics,
      callsMetrics,
      dailyGoal,
      closerMetrics,
      salesRecords,
      forecastRecords,
      dailyRevenueData,
      revenueEvolution,
      productDistribution,
    };
  }, [selectedCloser, rawSalesData, rawMeetingEvents, rawCalls, rawForecastData, rawNegotiationData, rawCloserStaff, staffGoalsMap, totalGoals, filterStartDate]);

  const { metrics, callsMetrics, dailyGoal, closerMetrics: closers, salesRecords: sales, forecastRecords: forecasts, dailyRevenueData, revenueEvolution, productDistribution } = computed;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      const val = value / 1000000;
      return `R$ ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mi`;
    }
    if (value >= 1000) {
      const val = value / 1000;
      return `R$ ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mil`;
    }
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const metaPercent = metrics.metaReceita > 0 ? (metrics.receita / metrics.metaReceita) * 100 : 0;

  return (
    <>
    <div className="p-4 space-y-6">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center gap-4">
        
        {/* Date filter */}
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
          <SelectTrigger className="w-[140px] rounded-full">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {/* Custom date range */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[130px] justify-start text-left font-normal rounded-full",
                    !customDateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={customDateFrom}
                  onSelect={setCustomDateFrom}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[130px] justify-start text-left font-normal rounded-full",
                    !customDateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={customDateTo}
                  onSelect={setCustomDateTo}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
        
        {!isCloserUser && (
          <Select value={selectedCloser} onValueChange={setSelectedCloser}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Closers</SelectItem>
              {closers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[180px] rounded-full">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-auto rounded-full">
          {dateFilter === "custom" && customDateFrom && customDateTo
            ? `${format(customDateFrom, "dd/MM")} - ${format(customDateTo, "dd/MM/yyyy")}`
            : format(getDateRange().start, "MMMM yyyy", { locale: ptBR })}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="rounded-full">
          <Upload className="h-4 w-4 mr-2" />
          Importar Vendas
        </Button>
      </div>

      {/* Top ranking - closers - Vibrant podium */}
      <div className="flex gap-3 flex-wrap">
        {closers.slice(0, 3).map((closer, index) => {
          const podiumGradients = [
            { bg: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.08))', border: 'rgba(245,158,11,0.4)', icon: '🥇', shadow: '0 8px 24px rgba(245,158,11,0.2)' },
            { bg: 'linear-gradient(135deg, rgba(148,163,184,0.15), rgba(100,116,139,0.08))', border: 'rgba(148,163,184,0.4)', icon: '🥈', shadow: '0 8px 24px rgba(148,163,184,0.2)' },
            { bg: 'linear-gradient(135deg, rgba(180,83,9,0.15), rgba(217,119,6,0.08))', border: 'rgba(180,83,9,0.4)', icon: '🥉', shadow: '0 8px 24px rgba(180,83,9,0.2)' },
          ];
          const p = podiumGradients[index];
          return (
            <div key={closer.id} className="flex-1 min-w-[200px] relative overflow-hidden rounded-2xl p-4 transition-all hover:-translate-y-1" style={{ background: p.bg, border: `1px solid ${p.border}`, boxShadow: p.shadow }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-sm truncate">{closer.name}</p>
                  <p className="text-lg font-black" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{formatCurrency(closer.revenue)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Ticket: {formatCurrency(closer.ticketMedio)}</p>
                  <p>Conv: {closer.conversion.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main metrics row - Vivid 3D cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "% Meta", value: `${metaPercent.toFixed(1)}%`, gradient: "linear-gradient(135deg, #ec4899, #8b5cf6)", bg: "rgba(236,72,153,0.06)" },
          { label: "Conversão", value: `${metrics.conversao.toFixed(1)}%`, gradient: "linear-gradient(135deg, #3b82f6, #06b6d4)", bg: "rgba(59,130,246,0.06)" },
          { label: "Meta Receita", value: formatCurrency(metrics.metaReceita), gradient: "linear-gradient(135deg, #ef4444, #f43f5e)", bg: "rgba(239,68,68,0.06)" },
          { label: "Receita", value: formatCurrency(metrics.receita), gradient: "linear-gradient(135deg, #10b981, #06b6d4)", bg: "rgba(16,185,129,0.08)" },
          { label: "Faltam", value: formatCurrency(metrics.faltaReceita), gradient: "linear-gradient(135deg, #f59e0b, #ef4444)", bg: "rgba(245,158,11,0.06)" },
          { label: "Qtd Vendas", value: metrics.vendas, gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)", bg: "rgba(139,92,246,0.06)" },
          { label: "Ticket Médio", value: formatCurrency(metrics.ticketMedio), gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)", bg: "rgba(6,182,212,0.06)" },
          { label: "Forecast", value: formatCurrency(metrics.forecast), gradient: "linear-gradient(135deg, #d946ef, #ec4899)", bg: "rgba(217,70,239,0.06)" },
          { label: "Em Negociação", value: formatCurrency(metrics.emNegociacao), gradient: "linear-gradient(135deg, #f59e0b, #f97316)", bg: "rgba(245,158,11,0.06)" },
        ].map((item, idx) => (
          <div key={idx} className="relative overflow-hidden rounded-2xl p-3 transition-all hover:-translate-y-1" style={{ background: item.bg, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="absolute top-0 left-0 h-1.5 w-full rounded-t-2xl" style={{ background: item.gradient }} />
            <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
            <p className="text-xl font-black mt-1" style={{ background: item.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary metrics - Super/Hiper */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Super Meta", value: formatCurrency(metrics.superMeta), gradient: "linear-gradient(135deg, #f59e0b, #f97316)", bg: "rgba(245,158,11,0.08)" },
          { label: "Hiper Meta", value: formatCurrency(metrics.hiperMeta), gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)", bg: "rgba(139,92,246,0.08)" },
          { label: "Falta (Super)", value: formatCurrency(metrics.faltaSuper), gradient: "linear-gradient(135deg, #f59e0b, #ef4444)" },
          { label: "Falta (Hiper)", value: formatCurrency(metrics.faltaHiper), gradient: "linear-gradient(135deg, #8b5cf6, #ec4899)" },
          { label: "Projeção", value: formatCurrency(metrics.projecaoReceita), gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
          { label: "% Projetado", value: `${metrics.projecaoPercent.toFixed(0)}%`, gradient: "linear-gradient(135deg, #10b981, #06b6d4)" },
        ].map((item, idx) => (
          <div key={idx} className="relative overflow-hidden rounded-2xl p-3 bg-card border border-border/30 transition-all hover:-translate-y-1" style={{ background: (item as any).bg || undefined }}>
            <div className="absolute top-0 left-0 h-1 w-full" style={{ background: item.gradient }} />
            <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
            <p className="text-lg font-bold mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Daily Goal Card - Vibrant Hero */}
      <div className="relative overflow-hidden rounded-2xl p-[2px] shadow-xl" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899, #10b981)' }}>
        <div className="relative rounded-[14px] overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1a1a2e 100%)' }}>
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-blue-500/20 blur-[60px]" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-emerald-500/15 blur-[50px]" />
          <div className="relative z-10 p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 8px 24px rgba(59,130,246,0.4)' }}>
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Meta Diária</h3>
                  <p className="text-xs text-blue-300/60">
                    {dailyGoal.businessDaysLeft} dia{dailyGoal.businessDaysLeft !== 1 ? 's' : ''} úte{dailyGoal.businessDaysLeft !== 1 ? 'is' : 'il'} restante{dailyGoal.businessDaysLeft !== 1 ? 's' : ''} no mês
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <div className="text-center rounded-xl p-2 border border-white/10 backdrop-blur-md" style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <p className="text-[10px] text-blue-300/60 mb-0.5">Meta do Mês</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(dailyGoal.monthlyTarget)}</p>
                </div>
                <div className="text-center rounded-xl p-2 border border-emerald-400/20 backdrop-blur-md" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <p className="text-[10px] text-emerald-300/60 mb-0.5">Realizado</p>
                  <p className="text-sm font-bold text-emerald-300">{formatCurrency(dailyGoal.achieved)}</p>
                </div>
                <div className="text-center rounded-xl p-2 border border-rose-400/20 backdrop-blur-md" style={{ background: 'rgba(244,63,94,0.1)' }}>
                  <p className="text-[10px] text-rose-300/60 mb-0.5">Falta</p>
                  <p className="text-sm font-bold text-rose-300">{formatCurrency(dailyGoal.remaining)}</p>
                </div>
                <div className="text-center rounded-xl p-2 border border-amber-400/30 backdrop-blur-md" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <p className="text-[10px] text-amber-300/70 mb-0.5 font-bold">Vender/Dia</p>
                  <p className="text-lg font-extrabold text-amber-300">{formatCurrency(dailyGoal.dailyTarget)}</p>
                </div>
              </div>
            </div>
            
            {/* Progress bar - rainbow */}
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-blue-200/50 mb-1">
                <span>Progresso</span>
                <span className="font-bold text-white">{dailyGoal.monthlyTarget > 0 ? Math.round((dailyGoal.achieved / dailyGoal.monthlyTarget) * 100) : 0}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full rounded-full transition-all duration-1000 relative"
                  style={{ width: `${Math.min(100, dailyGoal.monthlyTarget > 0 ? (dailyGoal.achieved / dailyGoal.monthlyTarget) * 100 : 0)}%`, background: 'linear-gradient(90deg, #3b82f6, #10b981, #f59e0b, #ec4899)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Term Vision Chart - QTR/YTD/MAT */}
      <TermVisionChart />

      {/* Agendamentos e Calls Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Agendamentos", value: callsMetrics.agendadas, gradient: "linear-gradient(135deg, #3b82f6, #8b5cf6)", bg: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.06))", border: "rgba(59,130,246,0.3)" },
          { label: "Reuniões Realizadas", value: callsMetrics.realizadas, gradient: "linear-gradient(135deg, #10b981, #06b6d4)", bg: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))", border: "rgba(16,185,129,0.3)" },
          { label: "% No Show", value: `${callsMetrics.noShowPercent.toFixed(0)}%`, gradient: "linear-gradient(135deg, #ef4444, #ec4899)", bg: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(236,72,153,0.06))", border: "rgba(239,68,68,0.3)" },
        ].map((item, idx) => (
          <div key={idx} className="relative overflow-hidden rounded-2xl p-5 text-center transition-all hover:-translate-y-1" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
            <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: item.gradient }} />
            <p className="text-[10px] text-muted-foreground uppercase mb-1">{item.label}</p>
            <p className="text-3xl font-black" style={{ background: item.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Receita por produto */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6, #ec4899)' }} />
          <div className="p-4 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
                <DollarSign className="h-3.5 w-3.5" />
              </div>
              Receita por Produto
            </h3>
          </div>
          <div className="px-4 pb-4">
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {productDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.16)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Projeções Super/Hiper */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f59e0b, #8b5cf6)' }} />
          <div className="p-4 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                <Target className="h-3.5 w-3.5" />
              </div>
              Projeções Meta
            </h3>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Meta</span>
                <span className="font-bold">{metaPercent.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-muted/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full relative" style={{ width: `${Math.min(100, metaPercent)}%`, background: 'linear-gradient(90deg, #ef4444, #f43f5e)' }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Super Meta</span>
                <span className="font-bold">{metrics.superMeta > 0 ? ((metrics.receita / metrics.superMeta) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="h-3 bg-muted/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full relative" style={{ width: `${Math.min(100, metrics.superMeta > 0 ? (metrics.receita / metrics.superMeta) * 100 : 0)}%`, background: 'linear-gradient(90deg, #f59e0b, #f97316)' }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Hiper Meta</span>
                <span className="font-bold">{metrics.hiperMeta > 0 ? ((metrics.receita / metrics.hiperMeta) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="h-3 bg-muted/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full relative" style={{ width: `${Math.min(100, metrics.hiperMeta > 0 ? (metrics.receita / metrics.hiperMeta) * 100 : 0)}%`, background: 'linear-gradient(90deg, #8b5cf6, #d946ef)' }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evolution chart - Cumulative Revenue */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #10b981, #f59e0b, #3b82f6)' }} />
        <div className="p-4 pb-2">
          <h3 className="text-base font-bold text-center" style={{ background: 'linear-gradient(90deg, #ef4444, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EVOLUÇÃO DE RECEITA</h3>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-center gap-6 mb-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-1 rounded-full" style={{ background: '#EF4444' }} />
              <span>Meta Receita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-1 rounded-full" style={{ background: '#16A34A' }} />
              <span>Receita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ borderTop: "2px dashed #F59E0B" }} />
              <span>Super Meta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ borderTop: "2px dashed #3B82F6" }} />
              <span>Hiper Meta</span>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueEvolution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(v) => String(v).padStart(2, '0')}
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(v) => {
                    if (v >= 1000) return `${(v / 1000).toFixed(0)} mil`;
                    return v.toString();
                  }} 
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  formatter={(value: number | null, name: string) => {
                    if (value === null) return ["-", name];
                    return [formatCurrency(value), name];
                  }}
                  labelFormatter={(day) => `Dia ${day}`}
                  contentStyle={{ fontSize: 12, borderRadius: "12px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.16)" }}
                />
                <Line type="linear" dataKey="meta" name="Meta Receita" stroke="#EF4444" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#EF4444" }} />
                <Line type="linear" dataKey="receita" name="Receita" stroke="#16A34A" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#16A34A" }} connectNulls={false} />
                <Line type="linear" dataKey="super" name="Super Meta Receita" stroke="#F59E0B" strokeWidth={2} strokeDasharray="8 4" dot={false} activeDot={{ r: 4, fill: "#F59E0B" }} />
                <Line type="linear" dataKey="hiper" name="Hiper Meta Receita" stroke="#3B82F6" strokeWidth={2} strokeDasharray="8 4" dot={false} activeDot={{ r: 4, fill: "#3B82F6" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Acumulado diário por closer */}
      {dailyRevenueData.length > 0 && closers.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #10b981, #f59e0b, #ef4444, #8b5cf6)' }} />
          <div className="p-4 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #10b981)' }}>
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              Acumulado Diário de Receita
            </h3>
          </div>
          <div className="px-4 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.16)" }} />
                  <Legend />
                  {closers.map((closer, i) => (
                    <Line
                      key={closer.id}
                      type="monotone"
                      dataKey={closer.name}
                      stroke={["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"][i % 6]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Desempenho dos Closers Table */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #3b82f6)' }} />
        <div className="p-4 pb-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
              <Trophy className="h-3.5 w-3.5" />
            </div>
            Desempenho dos Closers
          </h3>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Closer</TableHead>
                <TableHead className="text-center">Calls Agend.</TableHead>
                <TableHead className="text-center">Calls Realiz.</TableHead>
                <TableHead className="text-center">Qtd Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-center">% Meta</TableHead>
                <TableHead className="text-center">Conversão</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closers.map(closer => (
                <TableRow key={closer.id} className="text-sm">
                  <TableCell className="font-medium">{closer.name}</TableCell>
                  <TableCell className="text-center">{closer.callsScheduled}</TableCell>
                  <TableCell className="text-center">{closer.callsCompleted}</TableCell>
                  <TableCell className="text-center">{closer.salesQty}</TableCell>
                  <TableCell className="text-right font-bold" style={{ color: '#10b981' }}>{formatCurrency(closer.revenue)}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{
                      background: closer.metaPercent >= 100 ? 'linear-gradient(135deg, #10b981, #06b6d4)' : closer.metaPercent >= 70 ? 'linear-gradient(135deg, #f59e0b, #f97316)' : 'linear-gradient(135deg, #ef4444, #ec4899)'
                    }}>
                      {closer.metaPercent.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{closer.conversion.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(closer.ticketMedio)}</TableCell>
                </TableRow>
              ))}
              {closers.length > 0 && (
                <TableRow className="font-bold text-sm" style={{ background: 'rgba(139,92,246,0.05)' }}>
                  <TableCell>Total geral</TableCell>
                  <TableCell className="text-center">{closers.reduce((s, c) => s + c.callsScheduled, 0)}</TableCell>
                  <TableCell className="text-center">{closers.reduce((s, c) => s + c.callsCompleted, 0)}</TableCell>
                  <TableCell className="text-center">{closers.reduce((s, c) => s + c.salesQty, 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(closers.reduce((s, c) => s + c.revenue, 0))}</TableCell>
                  <TableCell className="text-center">{metaPercent.toFixed(1)}%</TableCell>
                  <TableCell className="text-center">{metrics.conversao.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(metrics.ticketMedio)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Forecast */}
      {forecasts.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)' }} />
          <div className="p-4 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                <Target className="h-3.5 w-3.5" />
              </div>
              Forecast no Mês
            </h3>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Dia</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Forecast</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map(f => (
                  <TableRow key={f.id} className="text-sm">
                    <TableCell>{f.day}</TableCell>
                    <TableCell>{f.closer}</TableCell>
                    <TableCell>{f.client}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{f.status}</Badge>
                    </TableCell>
                    <TableCell>{f.product}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: '#10b981' }}>{formatCurrency(f.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Vendas no Mês */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-lg">
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #10b981, #f59e0b, #ec4899, #8b5cf6)' }} />
        <div className="p-4 pb-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #10b981, #f59e0b)' }}>
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            Vendas no Mês
          </h3>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Dia</TableHead>
                <TableHead>Funil</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>SDR / SS</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma venda registrada este mês
                  </TableCell>
                </TableRow>
              ) : (
                sales.map(sale => (
                  <TableRow key={sale.id} className="text-sm">
                    <TableCell>{sale.saleDate}</TableCell>
                    <TableCell>{sale.pipeline}</TableCell>
                    <TableCell>{sale.closer}</TableCell>
                    <TableCell>{sale.sdr}</TableCell>
                    <TableCell>{sale.company}</TableCell>
                    <TableCell>{sale.product}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: '#10b981' }}>{formatCurrency(sale.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

      {/* Import Sales Dialog */}
      <ImportSalesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => {
          setLoading(true);
          window.location.reload();
        }}
      />
    </>
  );
};
