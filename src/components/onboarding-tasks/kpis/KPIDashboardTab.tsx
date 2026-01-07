import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { format, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Target, Users, DollarSign, Percent, Hash, CalendarDays } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: "daily" | "weekly" | "monthly";
  target_value: number;
  is_individual: boolean;
  is_active: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  is_active: boolean;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  entry_date: string;
  value: number;
}

interface KPIDashboardTabProps {
  companyId: string;
}

export const KPIDashboardTab = ({ companyId }: KPIDashboardTabProps) => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [selectedKpi, setSelectedKpi] = useState<string>("all");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, [companyId, dateRange]);

  const fetchData = async () => {
    try {
      const [kpisRes, salespeopleRes, entriesRes] = await Promise.all([
        supabase.from("company_kpis").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
        supabase.from("company_salespeople").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("kpi_entries").select("*").eq("company_id", companyId).gte("entry_date", dateRange.start).lte("entry_date", dateRange.end),
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (salespeopleRes.error) throw salespeopleRes.error;
      if (entriesRes.error) throw entriesRes.error;

      setKpis((kpisRes.data || []) as KPI[]);
      setSalespeople(salespeopleRes.data || []);
      setEntries(entriesRes.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (type === "percentage") {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString("pt-BR");
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4" />;
      case "percentage": return <Percent className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  // Calculate KPI summaries
  const getKpiSummary = (kpi: KPI) => {
    const kpiEntries = entries.filter(e => e.kpi_id === kpi.id);
    const total = kpiEntries.reduce((sum, e) => sum + e.value, 0);
    
    // Calculate target based on periodicity and date range
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let targetForPeriod = kpi.target_value;
    if (kpi.periodicity === "daily") {
      targetForPeriod = kpi.target_value * daysDiff;
    } else if (kpi.periodicity === "weekly") {
      targetForPeriod = kpi.target_value * Math.ceil(daysDiff / 7);
    }
    // For monthly, use single target

    const percentage = targetForPeriod > 0 ? (total / targetForPeriod) * 100 : 0;
    
    return { total, target: targetForPeriod, percentage };
  };

  // Calculate monthly projection
  const getMonthlyProjection = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;
    const timeProgress = currentDay / daysInMonth;

    // Get entries for current month only
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const monthEntries = entries.filter(e => e.entry_date >= monthStart && e.entry_date <= monthEnd);

    // Sum all entries and targets for monetary KPIs (main revenue KPIs)
    let totalRealized = 0;
    let totalTarget = 0;

    kpis.forEach(kpi => {
      const kpiEntries = monthEntries.filter(e => e.kpi_id === kpi.id);
      const kpiTotal = kpiEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Use monthly target directly
      let monthlyTarget = kpi.target_value;
      if (kpi.periodicity === "daily") {
        monthlyTarget = kpi.target_value * daysInMonth;
      } else if (kpi.periodicity === "weekly") {
        monthlyTarget = kpi.target_value * Math.ceil(daysInMonth / 7);
      }

      // Only sum monetary KPIs for the main projection (faturamento)
      if (kpi.kpi_type === "monetary") {
        totalRealized += kpiTotal;
        totalTarget += monthlyTarget;
      }
    });

    // Calculate projection: (realized / target) / time_progress * 100
    let projectionPercent = 0;
    if (totalTarget > 0 && timeProgress > 0) {
      projectionPercent = ((totalRealized / totalTarget) / timeProgress) * 100;
    }

    // Projected value at end of month
    const projectedValue = timeProgress > 0 ? totalRealized / timeProgress : 0;

    return {
      realized: totalRealized,
      target: totalTarget,
      projectionPercent,
      projectedValue,
      currentDay,
      daysInMonth,
      daysRemaining,
      timeProgress: timeProgress * 100,
    };
  };

  const projection = getMonthlyProjection();

  // Prepare chart data - Daily evolution
  const getDailyChartData = () => {
    const filteredEntries = entries.filter(e => {
      if (selectedKpi !== "all" && e.kpi_id !== selectedKpi) return false;
      if (selectedSalesperson !== "all" && e.salesperson_id !== selectedSalesperson) return false;
      return true;
    });

    const groupedByDate: Record<string, number> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByDate[entry.entry_date]) {
        groupedByDate[entry.entry_date] = 0;
      }
      groupedByDate[entry.entry_date] += entry.value;
    });

    return Object.entries(groupedByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        value,
      }));
  };

  // Prepare ranking data
  const getRankingData = () => {
    const rankingMap: Record<string, { name: string; total: number }> = {};
    
    salespeople.forEach(sp => {
      rankingMap[sp.id] = { name: sp.name, total: 0 };
    });

    entries.forEach(entry => {
      if (selectedKpi !== "all" && entry.kpi_id !== selectedKpi) return;
      if (rankingMap[entry.salesperson_id]) {
        rankingMap[entry.salesperson_id].total += entry.value;
      }
    });

    return Object.values(rankingMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  if (kpis.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Nenhum KPI configurado ainda.</p>
          <p className="text-sm">Configure KPIs para visualizar o dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  const dailyData = getDailyChartData();
  const rankingData = getRankingData();
  const selectedKpiData = selectedKpi !== "all" ? kpis.find(k => k.id === selectedKpi) : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>KPI</Label>
              <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os KPIs</SelectItem>
                  {kpis.map(kpi => (
                    <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {salespeople.map(sp => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Projection Card */}
      {projection.target > 0 && (
        <Card className={`border-2 ${
          projection.projectionPercent >= 100 ? 'border-green-500 bg-green-500/5' :
          projection.projectionPercent >= 70 ? 'border-amber-500 bg-amber-500/5' :
          'border-destructive bg-destructive/5'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Projeção do Mês
              </CardTitle>
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="h-3 w-3" />
                Dia {projection.currentDay} de {projection.daysInMonth} ({projection.daysRemaining} restantes)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Realizado</p>
                <p className="text-2xl font-bold">{formatValue(projection.realized, "monetary")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meta do Mês</p>
                <p className="text-2xl font-bold">{formatValue(projection.target, "monetary")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Projetado</p>
                <p className="text-2xl font-bold">{formatValue(projection.projectedValue, "monetary")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projeção</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${
                    projection.projectionPercent >= 100 ? 'text-green-600' :
                    projection.projectionPercent >= 70 ? 'text-amber-600' :
                    'text-destructive'
                  }`}>
                    {projection.projectionPercent.toFixed(0)}%
                  </p>
                  {projection.projectionPercent >= 100 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso do mês: {projection.timeProgress.toFixed(0)}%</span>
                <span>Atingimento: {projection.target > 0 ? ((projection.realized / projection.target) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 relative">
                {/* Target progress indicator */}
                <div 
                  className="absolute h-full w-0.5 bg-foreground/50 z-10"
                  style={{ left: `${Math.min(projection.timeProgress, 100)}%` }}
                />
                <div
                  className={`h-3 rounded-full transition-all ${
                    projection.projectionPercent >= 100 ? 'bg-green-500' :
                    projection.projectionPercent >= 70 ? 'bg-amber-500' :
                    'bg-destructive'
                  }`}
                  style={{ width: `${Math.min((projection.realized / projection.target) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {projection.projectionPercent >= 100 
                  ? "✅ A empresa está no ritmo para bater a meta!"
                  : projection.projectionPercent >= 70
                  ? "⚠️ Atenção: a projeção está abaixo da meta esperada"
                  : "🚨 Alerta: a empresa está bem abaixo do ritmo necessário"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.slice(0, 4).map(kpi => {
          const summary = getKpiSummary(kpi);
          const isOnTrack = summary.percentage >= 100;
          
          return (
            <Card key={kpi.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                {getKpiIcon(kpi.kpi_type)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatValue(summary.total, kpi.kpi_type)}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    Meta: {formatValue(summary.target, kpi.kpi_type)}
                  </span>
                  <Badge variant={isOnTrack ? "default" : "destructive"} className="gap-1">
                    {isOnTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {summary.percentage.toFixed(0)}%
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${isOnTrack ? 'bg-green-500' : 'bg-destructive'}`}
                    style={{ width: `${Math.min(summary.percentage, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Diária</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [
                      selectedKpiData ? formatValue(value, selectedKpiData.kpi_type) : value.toLocaleString("pt-BR"),
                      "Valor"
                    ]}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingData.length > 0 && rankingData.some(r => r.total > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip 
                    formatter={(value: number) => [
                      selectedKpiData ? formatValue(value, selectedKpiData.kpi_type) : value.toLocaleString("pt-BR"),
                      "Total"
                    ]}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por KPI</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">% Atingimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map(kpi => {
                const summary = getKpiSummary(kpi);
                const isOnTrack = summary.percentage >= 100;
                
                return (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium">{kpi.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {getKpiIcon(kpi.kpi_type)}
                        {kpi.is_individual ? "Individual" : "Coletivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatValue(summary.total, kpi.kpi_type)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatValue(summary.target, kpi.kpi_type)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {summary.percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOnTrack ? "default" : summary.percentage >= 80 ? "secondary" : "destructive"}>
                        {isOnTrack ? "Meta Batida" : summary.percentage >= 80 ? "Próximo" : "Abaixo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
