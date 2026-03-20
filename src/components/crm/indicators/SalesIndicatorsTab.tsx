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
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const metaPercent = metrics.metaReceita > 0 ? (metrics.receita / metrics.metaReceita) * 100 : 0;
  const superPercent = metrics.superMeta > 0 ? (metrics.receita / metrics.superMeta) * 100 : 0;
  const hiperPercent = metrics.hiperMeta > 0 ? (metrics.receita / metrics.hiperMeta) * 100 : 0;

  const getProgressColor = (pct: number) =>
    pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500";

  return (
    <>
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
          <SelectTrigger className="w-[130px] h-9 rounded-lg text-xs">
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

        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-[120px] justify-start text-left text-xs rounded-lg", !customDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {customDateFrom ? format(customDateFrom, "dd/MM/yy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus locale={ptBR} /></PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-[120px] justify-start text-left text-xs rounded-lg", !customDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {customDateTo ? format(customDateTo, "dd/MM/yy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus locale={ptBR} /></PopoverContent>
            </Popover>
          </div>
        )}
        
        {!isCloserUser && (
          <Select value={selectedCloser} onValueChange={setSelectedCloser}>
            <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Closers</SelectItem>
              {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {dateFilter === "custom" && customDateFrom && customDateTo
              ? `${format(customDateFrom, "dd/MM")} - ${format(customDateTo, "dd/MM/yyyy")}`
              : format(getDateRange().start, "MMMM yyyy", { locale: ptBR })}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="h-9 text-xs rounded-lg">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
        </div>
      </div>

      {/* ── Ranking dos Closers (Top 3) ── */}
      {closers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {closers.slice(0, 3).map((closer, index) => {
            const medals = ["🥇", "🥈", "🥉"];
            const accents = [
              "border-amber-500/30 bg-amber-500/5",
              "border-slate-400/30 bg-slate-400/5",
              "border-orange-600/30 bg-orange-600/5",
            ];
            return (
              <div key={closer.id} className={cn("rounded-xl border p-4 transition-all duration-200 hover:shadow-md", accents[index])}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{medals[index]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{closer.name}</p>
                    <p className="text-lg font-bold text-emerald-500">{formatCurrency(closer.revenue)}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">TM: {formatCurrency(closer.ticketMedio)}</p>
                    <p className="text-[11px] text-muted-foreground">Conv: {closer.conversion.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPIs Principais ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5" /> Resultados
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Receita", value: formatCurrency(metrics.receita), accent: "text-emerald-500", border: "border-emerald-500/20" },
            { label: "Meta", value: formatCurrency(metrics.metaReceita), accent: "text-foreground", border: "border-border" },
            { label: "Faltam", value: formatCurrency(metrics.faltaReceita), accent: "text-rose-500", border: "border-rose-500/20" },
            { label: "Forecast", value: formatCurrency(metrics.forecast), accent: "text-sky-500", border: "border-sky-500/20" },
            { label: "Em Negociação", value: formatCurrency(metrics.emNegociacao), accent: "text-amber-500", border: "border-amber-500/20" },
          ].map((item, idx) => (
            <Card key={idx} className={cn("border", item.border)}>
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                <p className={cn("text-xl font-bold", item.accent)}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Indicadores de Performance ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Percent className="h-3.5 w-3.5" /> Performance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "% Meta", value: `${metaPercent.toFixed(1)}%`, accent: metaPercent >= 100 ? "text-emerald-500" : metaPercent >= 70 ? "text-amber-500" : "text-rose-500" },
            { label: "Conversão", value: `${metrics.conversao.toFixed(1)}%`, accent: "text-sky-500" },
            { label: "Qtd Vendas", value: String(metrics.vendas), accent: "text-foreground" },
            { label: "Ticket Médio", value: formatCurrency(metrics.ticketMedio), accent: "text-foreground" },
            { label: "Projeção", value: formatCurrency(metrics.projecaoReceita), accent: "text-sky-500" },
            { label: "% Projetado", value: `${metrics.projecaoPercent.toFixed(0)}%`, accent: "text-sky-500" },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                <p className={cn("text-lg font-bold", item.accent)}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Metas (Meta / Super / Hiper) ── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Target className="h-3.5 w-3.5" /> Atingimento de Metas
          </h3>
          {[
            { label: "Meta", pct: metaPercent, value: metrics.metaReceita, remaining: metrics.faltaReceita, color: "bg-emerald-500" },
            { label: "Super Meta", pct: superPercent, value: metrics.superMeta, remaining: metrics.faltaSuper, color: "bg-amber-500" },
            { label: "Hiper Meta", pct: hiperPercent, value: metrics.hiperMeta, remaining: metrics.faltaHiper, color: "bg-sky-500" },
          ].map((goal, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">{goal.label} <span className="text-muted-foreground text-xs">({formatCurrency(goal.value)})</span></span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Falta: {formatCurrency(goal.remaining)}</span>
                  <span className="font-bold">{goal.pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", goal.color)} style={{ width: `${Math.min(100, goal.pct)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Meta Diária ── */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary text-primary-foreground">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Meta Diária</h3>
                <p className="text-xs text-muted-foreground">{dailyGoal.businessDaysLeft} dia{dailyGoal.businessDaysLeft !== 1 ? "s" : ""} úte{dailyGoal.businessDaysLeft !== 1 ? "is" : "il"} restante{dailyGoal.businessDaysLeft !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
              {[
                { label: "Meta do Mês", value: formatCurrency(dailyGoal.monthlyTarget), cls: "" },
                { label: "Realizado", value: formatCurrency(dailyGoal.achieved), cls: "text-emerald-500" },
                { label: "Falta", value: formatCurrency(dailyGoal.remaining), cls: "text-rose-500" },
                { label: "Vender/Dia", value: formatCurrency(dailyGoal.dailyTarget), cls: "text-amber-500 text-lg" },
              ].map((item, idx) => (
                <div key={idx} className="text-center rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                  <p className={cn("font-bold text-sm", item.cls)}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Progresso mensal</span>
              <span className="font-bold text-foreground">{dailyGoal.monthlyTarget > 0 ? Math.round((dailyGoal.achieved / dailyGoal.monthlyTarget) * 100) : 0}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-1000", getProgressColor(dailyGoal.monthlyTarget > 0 ? (dailyGoal.achieved / dailyGoal.monthlyTarget) * 100 : 0))} style={{ width: `${Math.min(100, dailyGoal.monthlyTarget > 0 ? (dailyGoal.achieved / dailyGoal.monthlyTarget) * 100 : 0)}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Calls ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" /> Reuniões
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Agendadas", value: callsMetrics.agendadas, accent: "text-sky-500" },
            { label: "Realizadas", value: callsMetrics.realizadas, accent: "text-emerald-500" },
            { label: "No Show", value: `${callsMetrics.noShowPercent.toFixed(0)}%`, accent: "text-rose-500" },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 text-center">
                <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                <p className={cn("text-2xl font-bold", item.accent)}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Term Vision Chart ── */}
      <TermVisionChart />

      {/* ── Gráficos ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Receita por Produto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Receita por Produto
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {productDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                      {productDistribution.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                    <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projeções Meta */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              Projeções vs Meta
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-4">
            {[
              { label: "Meta", pct: metaPercent, color: "bg-emerald-500" },
              { label: "Super Meta", pct: superPercent, color: "bg-amber-500" },
              { label: "Hiper Meta", pct: hiperPercent, color: "bg-sky-500" },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs mb-1"><span>{item.label}</span><span className="font-bold">{item.pct.toFixed(0)}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${Math.min(100, item.pct)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Evolução de Receita ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Evolução de Receita
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-center gap-5 mb-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-rose-500 inline-block" />Meta</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-emerald-600 inline-block" />Receita</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-amber-500 inline-block border-dashed" style={{ borderTop: "1.5px dashed" }} />Super</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-sky-500 inline-block" style={{ borderTop: "1.5px dashed" }} />Hiper</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueEvolution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).padStart(2, "0")} interval={0} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} domain={[0, "auto"]} />
                <Tooltip formatter={(value: number | null, name: string) => value === null ? ["-", name] : [formatCurrency(value), name]} labelFormatter={(day) => `Dia ${day}`} contentStyle={{ fontSize: 12, borderRadius: "8px" }} />
                <Line type="linear" dataKey="meta" name="Meta" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} />
                <Line type="linear" dataKey="receita" name="Receita" stroke="#16A34A" strokeWidth={2.5} dot={false} connectNulls={false} />
                <Line type="linear" dataKey="super" name="Super Meta" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                <Line type="linear" dataKey="hiper" name="Hiper Meta" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Acumulado por Closer ── */}
      {dailyRevenueData.length > 0 && closers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-500" />
              Acumulado Diário por Closer
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  <Legend />
                  {closers.map((closer, i) => (
                    <Line key={closer.id} type="monotone" dataKey={closer.name} stroke={["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"][i % 6]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabela: Desempenho dos Closers ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Desempenho dos Closers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-center">Agend.</TableHead>
                  <TableHead className="text-center">Realiz.</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-center">% Meta</TableHead>
                  <TableHead className="text-center">Conv.</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closers.map(closer => (
                  <TableRow key={closer.id} className="text-sm">
                    <TableCell className="font-medium">{closer.name}</TableCell>
                    <TableCell className="text-center">{closer.callsScheduled}</TableCell>
                    <TableCell className="text-center">{closer.callsCompleted}</TableCell>
                    <TableCell className="text-center">{closer.salesQty}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-500">{formatCurrency(closer.revenue)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("text-[11px] font-bold", closer.metaPercent >= 100 ? "border-emerald-500/40 text-emerald-500" : closer.metaPercent >= 70 ? "border-amber-500/40 text-amber-500" : "border-rose-500/40 text-rose-500")}>
                        {closer.metaPercent.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{closer.conversion.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(closer.ticketMedio)}</TableCell>
                  </TableRow>
                ))}
                {closers.length > 0 && (
                  <TableRow className="font-bold text-sm bg-muted/30">
                    <TableCell>Total</TableCell>
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
        </CardContent>
      </Card>

      {/* ── Forecast ── */}
      {forecasts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-sky-500" />
              Forecast
              <Badge variant="secondary" className="ml-auto text-xs">{formatCurrency(metrics.forecast)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Closer</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecasts.map(f => (
                    <TableRow key={f.id} className="text-sm">
                      <TableCell>{f.closer}</TableCell>
                      <TableCell>{f.client}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{f.status}</Badge></TableCell>
                      <TableCell>{f.product}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-500">{formatCurrency(f.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Vendas do Período ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Vendas no Período
            <Badge variant="secondary" className="ml-auto text-xs">{sales.length} vendas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Dia</TableHead>
                  <TableHead>Funil</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda registrada</TableCell>
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
                      <TableCell className="text-right font-semibold text-emerald-500">{formatCurrency(sale.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>

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