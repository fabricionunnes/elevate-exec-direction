import { useEffect, useState } from "react";
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
import { CalendarIcon } from "lucide-react";
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
import { Trophy, Target, Phone, TrendingUp, DollarSign, Percent, Users } from "lucide-react";
import { cn } from "@/lib/utils";

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
  sdr: string;
  company: string;
  product: string;
  revenue: number;
}

interface ForecastRecord {
  id: string;
  day: number;
  closer: string;
  client: string;
  status: string;
  product: string;
  value: number;
}

type DateFilterType = "today" | "week" | "month" | "quarter" | "custom";

export const SalesIndicatorsTab = () => {
  const [loading, setLoading] = useState(true);
  const [closers, setClosers] = useState<CloserMetrics[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [forecasts, setForecasts] = useState<ForecastRecord[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilterType>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  
  // Main metrics
  const [metrics, setMetrics] = useState({
    metaReceita: 0,
    receita: 0,
    faltaReceita: 0,
    vendas: 0,
    ticketMedio: 0,
    qtr: 0,
    conversao: 0,
    superMeta: 0,
    hiperMeta: 0,
    faltaSuper: 0,
    faltaHiper: 0,
    forecast: 0,
    projecaoReceita: 0,
    projecaoPercent: 0,
  });

  // Calls metrics
  const [callsMetrics, setCallsMetrics] = useState({
    agendadas: 0,
    realizadas: 0,
    noShowPercent: 0,
  });

  // Daily revenue accumulation
  const [dailyRevenueData, setDailyRevenueData] = useState<{ day: number; [key: string]: number }[]>([]);
  
  // Revenue evolution
  const [revenueEvolution, setRevenueEvolution] = useState<{ day: number; meta: number; receita: number; super: number; hiper: number }[]>([]);

  // Vision data (QTR, YTD, MAT)
  const [visionData, setVisionData] = useState({
    qtr: { value: 0, change: 0 },
    ytd: { value: 0, change: 0 },
    mat: { value: 0, change: 0 },
    receita: { value: 0, change: 0 },
  });

  // Product distribution
  const [productDistribution, setProductDistribution] = useState<{ name: string; value: number; color: string }[]>([]);

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
      const now = new Date();
      const { start: filterStart, end: filterEnd } = getDateRange();
      const daysInMonth = getDaysInMonth(filterStart);
      const currentDay = getDate(now);
      const filterMonth = filterStart.getMonth() + 1;
      const filterYear = filterStart.getFullYear();

      // Load closers (staff with closer role who have CRM access)
      // First get staff IDs with CRM access
      const { data: crmAccessData } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");
      
      const crmStaffIds = crmAccessData?.map(a => a.staff_id) || [];

      // Load closers - only commercial roles (closer, head_comercial) with CRM access
      const { data: closerStaff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .in("role", ["closer", "head_comercial"])
        .eq("is_active", true);

      // Filter to only include staff with CRM access
      const filteredCloserStaff = (closerStaff || []).filter(staff => 
        crmStaffIds.includes(staff.id)
      );

      // Load scheduled calls using date range
      const { data: calls } = await supabase
        .from("crm_scheduled_calls")
        .select(`
          *,
          scheduled_by_staff:onboarding_staff!crm_scheduled_calls_scheduled_by_fkey(id, name),
          assigned_to_staff:onboarding_staff!crm_scheduled_calls_assigned_to_fkey(id, name)
        `)
        .gte("scheduled_at", filterStart.toISOString())
        .lte("scheduled_at", filterEnd.toISOString());

      // Load sales using date range
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

      // Load forecasts
      const { data: forecastData } = await supabase
        .from("crm_forecasts")
        .select(`
          *,
          closer:onboarding_staff!crm_forecasts_closer_staff_id_fkey(id, name),
          lead:crm_leads(id, name, company)
        `)
        .eq("status", "open");

      // Load goal type for "Vendas" (currency type)
      const { data: goalTypeData } = await supabase
        .from("crm_goal_types")
        .select("id")
        .eq("name", "Vendas")
        .eq("is_active", true)
        .single();

      // Load goals from crm_goal_values (correct table)
      let metaReceita = 0;
      let superMeta = 0;
      let hiperMeta = 0;

      // Map of staff_id -> goal values
      const staffGoalsMap = new Map<string, { meta: number; super: number; hiper: number }>();

      if (goalTypeData?.id) {
        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("*")
          .eq("goal_type_id", goalTypeData.id)
          .eq("month", filterMonth)
          .eq("year", filterYear);

        // Sum all staff goals for total and build map
        if (goalValues && goalValues.length > 0) {
          goalValues.forEach(g => {
            staffGoalsMap.set(g.staff_id, {
              meta: g.meta_value || 0,
              super: g.super_meta_value || 0,
              hiper: g.hiper_meta_value || 0,
            });
          });
          metaReceita = goalValues.reduce((sum, g) => sum + (g.meta_value || 0), 0);
          superMeta = goalValues.reduce((sum, g) => sum + (g.super_meta_value || 0), 0);
          hiperMeta = goalValues.reduce((sum, g) => sum + (g.hiper_meta_value || 0), 0);
        }
      }

      // Calculate metrics
      const totalRevenue = (salesData || []).reduce((sum, s) => sum + (s.revenue_value || 0), 0);
      const totalSales = salesData?.length || 0;
      const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      const totalScheduled = calls?.length || 0;
      const totalCompleted = (calls || []).filter(c => c.status === "completed").length;
      const totalNoShow = (calls || []).filter(c => c.status === "no_show").length;
      const noShowPercent = totalScheduled > 0 ? (totalNoShow / totalScheduled) * 100 : 0;
      const conversion = totalCompleted > 0 ? (totalSales / totalCompleted) * 100 : 0;

      // Calculate projection
      const dailyAvg = currentDay > 0 ? totalRevenue / currentDay : 0;
      const projectedRevenue = dailyAvg * daysInMonth;
      const projectedPercent = metaReceita > 0 ? (projectedRevenue / metaReceita) * 100 : 0;

      // Total forecast
      const forecastTotal = (forecastData || []).reduce((sum, f) => sum + (f.forecast_value || 0), 0);

      setMetrics({
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
        projecaoReceita: projectedRevenue,
        projecaoPercent: projectedPercent,
      });

      setCallsMetrics({
        agendadas: totalScheduled,
        realizadas: totalCompleted,
        noShowPercent,
      });

      // Calculate closer metrics (use filtered staff)
      const closerMetrics: CloserMetrics[] = filteredCloserStaff.map(closer => {
        const closerCalls = (calls || []).filter(c => c.assigned_to === closer.id);
        const closerSales = (salesData || []).filter(s => s.closer_staff_id === closer.id);
        const closerRevenue = closerSales.reduce((sum, s) => sum + (s.revenue_value || 0), 0);
        const closerCompleted = closerCalls.filter(c => c.status === "completed").length;
        // Use the preloaded goals map
        const closerGoal = staffGoalsMap.get(closer.id);
        const closerMeta = closerGoal?.meta || (metaReceita / (filteredCloserStaff.length || 1));

        return {
          id: closer.id,
          name: closer.name,
          callsScheduled: closerCalls.length,
          callsCompleted: closerCompleted,
          salesQty: closerSales.length,
          revenue: closerRevenue,
          metaPercent: closerMeta > 0 ? (closerRevenue / closerMeta) * 100 : 0,
          conversion: closerCompleted > 0 ? (closerSales.length / closerCompleted) * 100 : 0,
          ticketMedio: closerSales.length > 0 ? closerRevenue / closerSales.length : 0,
        };
      });
      setClosers(closerMetrics);

      // Format sales records
      const salesRecords: SaleRecord[] = (salesData || []).map(s => ({
        id: s.id,
        saleDate: format(new Date(s.sale_date), "dd"),
        pipeline: s.pipeline?.name || "-",
        closer: s.closer?.name || "-",
        sdr: s.sdr?.name || "-",
        company: s.lead?.company || s.lead?.name || "-",
        product: s.product?.name || s.product_name || "-",
        revenue: s.revenue_value || 0,
      }));
      setSales(salesRecords);

      // Format forecasts
      const forecastRecords: ForecastRecord[] = (forecastData || []).map(f => ({
        id: f.id,
        day: f.expected_close_date ? getDate(new Date(f.expected_close_date)) : 0,
        closer: f.closer?.name || "-",
        client: f.lead?.name || "-",
        status: f.status || "open",
        product: f.product_name || "-",
        value: f.forecast_value || 0,
      }));
      setForecasts(forecastRecords);

      // Calculate daily revenue accumulation by closer
      const dailyData: { day: number; [key: string]: number }[] = [];
      const closerNames = closerMetrics.map(c => c.name);
      
      for (let day = 1; day <= currentDay; day++) {
        const dayData: { day: number; [key: string]: number } = { day };
        closerNames.forEach(name => {
          const closerDayRevenue = (salesData || [])
            .filter(s => {
              const saleDay = getDate(new Date(s.sale_date));
              return saleDay <= day && s.closer?.name === name;
            })
            .reduce((sum, s) => sum + (s.revenue_value || 0), 0);
          dayData[name] = closerDayRevenue;
        });
        dailyData.push(dayData);
      }
      setDailyRevenueData(dailyData);

      // Calculate revenue evolution with goals
      const evolutionData: { day: number; meta: number; receita: number; super: number; hiper: number }[] = [];
      let accumulatedRevenue = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dayRevenue = (salesData || [])
          .filter(s => getDate(new Date(s.sale_date)) === day)
          .reduce((sum, s) => sum + (s.revenue_value || 0), 0);
        accumulatedRevenue += dayRevenue;
        
        evolutionData.push({
          day,
          meta: (metaReceita / daysInMonth) * day,
          receita: day <= currentDay ? accumulatedRevenue : 0,
          super: (superMeta / daysInMonth) * day,
          hiper: (hiperMeta / daysInMonth) * day,
        });
      }
      setRevenueEvolution(evolutionData);

      // Calculate product distribution
      const productGroups: Record<string, number> = {};
      (salesData || []).forEach(s => {
        const productName = s.product?.name || s.product_name || "Outros";
        productGroups[productName] = (productGroups[productName] || 0) + (s.revenue_value || 0);
      });
      const colors = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
      setProductDistribution(
        Object.entries(productGroups).map(([name, value], i) => ({
          name,
          value,
          color: colors[i % colors.length],
        }))
      );

    } catch (error) {
      console.error("Error loading sales indicators:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)} mil`;
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
    <div className="p-4 space-y-6 bg-muted/30">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg font-bold px-4 py-2">
            Bônus: 0
          </Badge>
        </div>
        
        {/* Date filter */}
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
          <SelectTrigger className="w-[140px]">
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
                    "w-[130px] justify-start text-left font-normal",
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
                    "w-[130px] justify-start text-left font-normal",
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
        
        <Select value={selectedCloser} onValueChange={setSelectedCloser}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Closer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Closers</SelectItem>
            {closers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-auto">
          {dateFilter === "custom" && customDateFrom && customDateTo
            ? `${format(customDateFrom, "dd/MM")} - ${format(customDateTo, "dd/MM/yyyy")}`
            : format(getDateRange().start, "MMMM yyyy", { locale: ptBR })}
        </Badge>
      </div>

      {/* Top ranking - closers */}
      <div className="flex gap-2 flex-wrap">
        {closers.slice(0, 3).map((closer, index) => (
          <Card key={closer.id} className={`flex-1 min-w-[200px] ${index === 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-muted-foreground">{index + 1}.</span>
                <div className="flex-1">
                  <p className="font-medium text-sm truncate">{closer.name}</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(closer.revenue)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Ticket: {formatCurrency(closer.ticketMedio)}</p>
                  <p>Conv: {closer.conversion.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">% Meta</p>
            <p className="text-2xl font-bold text-primary">{metaPercent.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Conversão</p>
            <p className="text-2xl font-bold">{metrics.conversao.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Meta Receita</p>
            <p className="text-xl font-bold">{formatCurrency(metrics.metaReceita)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(metrics.receita)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Faltam</p>
            <p className="text-xl font-bold text-orange-500">{formatCurrency(metrics.faltaReceita)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Qtd Vendas</p>
            <p className="text-2xl font-bold">{metrics.vendas}</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Ticket Médio</p>
            <p className="text-xl font-bold">{formatCurrency(metrics.ticketMedio)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Forecast</p>
            <p className="text-xl font-bold text-blue-500">{formatCurrency(metrics.forecast)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics - Super/Hiper */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Super Meta</p>
            <p className="text-lg font-bold">{formatCurrency(metrics.superMeta)}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Hiper Meta</p>
            <p className="text-lg font-bold">{formatCurrency(metrics.hiperMeta)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Falta (Super)</p>
            <p className="text-lg font-bold">{formatCurrency(metrics.faltaSuper)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Falta (Hiper)</p>
            <p className="text-lg font-bold">{formatCurrency(metrics.faltaHiper)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Projeção</p>
            <p className="text-lg font-bold">{formatCurrency(metrics.projecaoReceita)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">% Projetado</p>
            <p className="text-lg font-bold">{metrics.projecaoPercent.toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Reuniões */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reuniões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-500">{callsMetrics.agendadas}</p>
                <p className="text-[10px] text-muted-foreground">Agendadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{callsMetrics.realizadas}</p>
                <p className="text-[10px] text-muted-foreground">Realizadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{callsMetrics.noShowPercent.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">No Show</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receita por produto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita por Produto</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Projeções Super/Hiper */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projeções Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Meta</span>
                <span>{metaPercent.toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(100, metaPercent)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Super Meta</span>
                <span>{((metrics.receita / metrics.superMeta) * 100).toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(100, (metrics.receita / metrics.superMeta) * 100)} className="h-2 [&>div]:bg-yellow-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Hiper Meta</span>
                <span>{((metrics.receita / metrics.hiperMeta) * 100).toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(100, (metrics.receita / metrics.hiperMeta) * 100)} className="h-2 [&>div]:bg-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolução de Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueEvolution}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="meta" name="Meta" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Acumulado diário por closer */}
      {dailyRevenueData.length > 0 && closers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acumulado Diário de Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  {closers.map((closer, i) => (
                    <Line
                      key={closer.id}
                      type="monotone"
                      dataKey={closer.name}
                      stroke={["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"][i % 5]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desempenho dos Closers Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Desempenho dos Closers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableCell className="text-right font-medium">{formatCurrency(closer.revenue)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={closer.metaPercent >= 100 ? "default" : closer.metaPercent >= 70 ? "secondary" : "destructive"}>
                      {closer.metaPercent.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{closer.conversion.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(closer.ticketMedio)}</TableCell>
                </TableRow>
              ))}
              {closers.length > 0 && (
                <TableRow className="bg-muted/50 font-bold text-sm">
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
        </CardContent>
      </Card>

      {/* Forecast */}
      {forecasts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Forecast no Mês</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(f.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vendas no Mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Vendas no Mês</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(sale.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
