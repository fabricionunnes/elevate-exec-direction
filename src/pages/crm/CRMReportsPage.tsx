import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  TrendingUp, 
  Users, 
  Trophy,
  XCircle,
  Target,
  CalendarIcon
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface ConversionData {
  stage: string;
  count: number;
  percentage: number;
  color: string;
}

interface ProductivityData {
  name: string;
  leads: number;
  won: number;
  value: number;
}

type DateFilterType = "today" | "week" | "month" | "quarter" | "year" | "custom";

export const CRMReportsPage = () => {
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  const [period, setPeriod] = useState<DateFilterType>("month");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [productivityData, setProductivityData] = useState<ProductivityData[]>([]);
  const [lossReasonsData, setLossReasonsData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    avgCycleTime: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "today":
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return { start: todayStart, end: todayEnd };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: subMonths(now, 3), end: now };
      case "year":
        return { start: subMonths(now, 12), end: now };
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          const fromStart = new Date(customDateRange.from);
          fromStart.setHours(0, 0, 0, 0);
          const toEnd = new Date(customDateRange.to);
          toEnd.setHours(23, 59, 59, 999);
          return { start: fromStart, end: toEnd };
        }
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: now };
    }
  };

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        const { start, end } = getDateRange();

        // Load all leads for the period (created in the period)
        const { data: leads } = await supabase
          .from("crm_leads")
          .select(`
            *,
            stage:crm_stages(name, color, is_final, final_type),
            owner:onboarding_staff!crm_leads_owner_staff_id_fkey(id, name),
            loss_reason:crm_loss_reasons(name)
          `)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());

        // Load leads won in the period (for revenue calculation - may include leads created earlier)
        const { data: leadsWonInPeriod } = await supabase
          .from("crm_leads")
          .select(`
            *,
            stage:crm_stages(name, color, is_final, final_type),
            owner:onboarding_staff!crm_leads_owner_staff_id_fkey(id, name),
            closer:onboarding_staff!crm_leads_closer_staff_id_fkey(id, name)
          `)
          .not("closed_at", "is", null)
          .gte("closed_at", start.toISOString())
          .lte("closed_at", end.toISOString());

        // Load stages
        const { data: stages } = await supabase
          .from("crm_stages")
          .select("*")
          .order("sort_order");

        // Calculate conversion data
        const stageGroups: Record<string, { count: number; color: string }> = {};
        (leads || []).forEach(lead => {
          const stageName = lead.stage?.name || "Sem Etapa";
          if (!stageGroups[stageName]) {
            stageGroups[stageName] = { count: 0, color: lead.stage?.color || "#6B7280" };
          }
          stageGroups[stageName].count++;
        });

        const totalLeads = leads?.length || 0;
        const conversionArr = Object.entries(stageGroups).map(([stage, data]) => ({
          stage,
          count: data.count,
          percentage: totalLeads > 0 ? Math.round((data.count / totalLeads) * 100) : 0,
          color: data.color,
        }));
        setConversionData(conversionArr);

        // Calculate metrics - use leads WON in period for revenue metrics
        const wonLeadsInPeriod = (leadsWonInPeriod || []).filter(l => l.stage?.final_type === "won");
        const wonLeadsCreatedInPeriod = (leads || []).filter(l => l.stage?.final_type === "won");
        const lostLeads = (leads || []).filter(l => l.stage?.final_type === "lost");

        // Parse numeric values safely (Supabase may return as string)
        const parseNumeric = (val: any): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val) || 0;
          return 0;
        };

        const totalValueCalc = wonLeadsInPeriod.reduce((sum, l) => sum + parseNumeric(l.opportunity_value), 0);

        setMetrics({
          totalLeads,
          wonLeads: wonLeadsInPeriod.length,
          lostLeads: lostLeads.length,
          conversionRate: totalLeads > 0 ? Math.round((wonLeadsCreatedInPeriod.length / totalLeads) * 100) : 0,
          avgCycleTime: 0,
          totalValue: totalValueCalc,
        });

        // Calculate productivity by user - attribute wins/revenue to the lead's closer
        if (isAdmin) {
          const userGroups: Record<string, { name: string; leads: number; won: number; value: number }> = {};
          
          // Count leads created by owner
          (leads || []).forEach(lead => {
            const ownerName = lead.owner?.name || "Sem Responsável";
            if (!userGroups[ownerName]) {
              userGroups[ownerName] = { name: ownerName, leads: 0, won: 0, value: 0 };
            }
            userGroups[ownerName].leads++;
          });
          
          // Count wins and revenue from leads WON in the period (based on closed_at)
          wonLeadsInPeriod.forEach(lead => {
            const closerName = (lead as any).closer?.name || lead.owner?.name || "Sem Responsável";
            if (!userGroups[closerName]) {
              userGroups[closerName] = { name: closerName, leads: 0, won: 0, value: 0 };
            }
            userGroups[closerName].won++;
            userGroups[closerName].value += parseNumeric(lead.opportunity_value);
          });
          
          setProductivityData(Object.values(userGroups));
        }

        // Loss reasons
        const reasonGroups: Record<string, number> = {};
        lostLeads.forEach(lead => {
          const reason = lead.loss_reason?.name || "Não informado";
          reasonGroups[reason] = (reasonGroups[reason] || 0) + 1;
        });
        setLossReasonsData(
          Object.entries(reasonGroups).map(([name, value]) => ({ name, value }))
        );

        // Weekly evolution
        const weeklyGroups: Record<string, { date: string; new: number; won: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const date = format(subDays(new Date(), i), "dd/MM");
          weeklyGroups[date] = { date, new: 0, won: 0 };
        }
        (leads || []).forEach(lead => {
          const date = format(new Date(lead.created_at), "dd/MM");
          if (weeklyGroups[date]) {
            weeklyGroups[date].new++;
          }
          if (lead.stage?.final_type === "won" && lead.closed_at) {
            const wonDate = format(new Date(lead.closed_at), "dd/MM");
            if (weeklyGroups[wonDate]) {
              weeklyGroups[wonDate].won++;
            }
          }
        });
        setWeeklyData(Object.values(weeklyGroups));

      } catch (error) {
        console.error("Error loading reports:", error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [period, isAdmin, customDateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análise de desempenho do funil de vendas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(val) => setPeriod(val as DateFilterType)}>
            <SelectTrigger className="w-[130px] sm:w-[160px] h-9 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal h-9 text-xs sm:text-sm", !customDateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  {customDateRange.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "dd/MM", { locale: ptBR })} - {format(customDateRange.to, "dd/MM", { locale: ptBR })}
                      </>
                    ) : (
                      format(customDateRange.from, "dd/MM/yy", { locale: ptBR })
                    )
                  ) : (
                    <span>Período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange.from}
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={1}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{metrics.totalLeads}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{metrics.wonLeads}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Ganhos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{metrics.lostLeads}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Perdidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{metrics.conversionRate}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-base sm:text-xl font-bold truncate">{formatCurrency(metrics.totalValue)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Valor Fechado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Funnel Chart */}
        <Card>
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
            <CardTitle className="text-base sm:text-lg">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="h-[200px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="stage" type="category" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} leads`, "Quantidade"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {conversionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="new" 
                    name="Novos Leads"
                    stroke="#3B82F6" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="won" 
                    name="Ganhos"
                    stroke="#10B981" 
                    strokeWidth={2}
                  />
                </LineChart>
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
            <div className="h-[300px]">
              {lossReasonsData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum lead perdido no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossReasonsData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {lossReasonsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Productivity by User */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtividade por Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {productivityData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Sem dados de produtividade
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productivityData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="leads" name="Leads" fill="#3B82F6" />
                      <Bar dataKey="won" name="Ganhos" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
