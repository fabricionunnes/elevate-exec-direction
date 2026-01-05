import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  XCircle, 
  CalendarX,
  TrendingUp,
  ListTodo,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";
import { format, isBefore, startOfDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  status: string;
  due_date: string | null;
  project_id: string;
}

interface Company {
  id: string;
  name: string;
  status: string;
  contract_end_date: string | null;
  status_changed_at?: string | null;
  created_at: string;
}

interface DashboardMetricsProps {
  companies: Company[];
  onFilterChange: (filter: { type: string; value: string } | null) => void;
  activeMetricFilter: { type: string; value: string } | null;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  overdueTasks: Task[];
  todayTasks: Task[];
}

const DashboardMetrics = ({ 
  companies, 
  onFilterChange, 
  activeMetricFilter,
  dateRange,
  onDateRangeChange,
  overdueTasks,
  todayTasks
}: DashboardMetricsProps) => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousPeriodCompanies, setPreviousPeriodCompanies] = useState<Company[]>([]);

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const fetchAllTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select("id, status, due_date, project_id");

      if (error) throw error;
      setAllTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate task metrics based on date range
  const taskMetrics = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayStart = startOfDay(new Date());
    
    const todayTasksCount = allTasks.filter(t => t.due_date === today).length;
    const todayCompleted = allTasks.filter(t => t.due_date === today && t.status === "completed").length;
    
    const overdueTasksCount = allTasks.filter(t => {
      if (!t.due_date || t.status === "completed") return false;
      const dueDate = new Date(t.due_date);
      return isBefore(dueDate, todayStart);
    }).length;
    
    const totalCompleted = allTasks.filter(t => t.status === "completed").length;
    const totalPending = allTasks.filter(t => t.status === "pending").length;
    
    return {
      todayTasks: todayTasksCount,
      todayCompleted,
      overdueTasks: overdueTasksCount,
      totalPending,
      totalCompleted,
      totalTasks: allTasks.length,
    };
  }, [allTasks]);

  // Company metrics based on filtered companies
  const companyMetrics = useMemo(() => {
    const activeCompanies = companies.filter(c => c.status === "active").length;
    const cancellationSignaled = companies.filter(c => c.status === "cancellation_signaled").length;
    const noticePeriod = companies.filter(c => c.status === "notice_period").length;
    const closedCompanies = companies.filter(c => c.status === "closed").length;
    
    // Contracts ending in the selected period
    const contractsEndingInPeriod = companies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return isWithinInterval(endDate, { start: dateRange.start, end: dateRange.end });
    }).length;

    return {
      activeCompanies,
      cancellationSignaled,
      noticePeriod,
      closedCompanies,
      contractsEndingInPeriod,
      churnSignaled: cancellationSignaled + noticePeriod,
    };
  }, [companies, dateRange]);

  // Calculate churn for the period
  const churnMetrics = useMemo(() => {
    // Companies that changed to closed status in this period
    const closedInPeriod = companies.filter(c => {
      if (c.status !== "closed" || !c.status_changed_at) return false;
      const changedAt = new Date(c.status_changed_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;

    // Companies that signaled cancellation in this period
    const signaledInPeriod = companies.filter(c => {
      if ((c.status !== "cancellation_signaled" && c.status !== "notice_period") || !c.status_changed_at) return false;
      const changedAt = new Date(c.status_changed_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;

    // Total active at start of period (approximation)
    const totalActiveStart = companyMetrics.activeCompanies + closedInPeriod + signaledInPeriod;
    
    const churnRate = totalActiveStart > 0 
      ? Math.round((closedInPeriod / totalActiveStart) * 100) 
      : 0;

    return {
      closedInPeriod,
      signaledInPeriod,
      churnRate,
    };
  }, [companies, dateRange, companyMetrics]);

  const completionRate = taskMetrics.totalTasks > 0 
    ? Math.round((taskMetrics.totalCompleted / taskMetrics.totalTasks) * 100) 
    : 0;
  
  const overdueRate = taskMetrics.totalTasks > 0 
    ? Math.round((taskMetrics.overdueTasks / taskMetrics.totalTasks) * 100) 
    : 0;

  const handleCardClick = (filterType: string, filterValue: string) => {
    if (activeMetricFilter?.type === filterType && activeMetricFilter?.value === filterValue) {
      onFilterChange(null);
    } else {
      onFilterChange({ type: filterType, value: filterValue });
    }
  };

  const changeMonth = (direction: "prev" | "next") => {
    const newStart = new Date(dateRange.start);
    if (direction === "prev") {
      newStart.setMonth(newStart.getMonth() - 1);
    } else {
      newStart.setMonth(newStart.getMonth() + 1);
    }
    onDateRangeChange({
      start: startOfMonth(newStart),
      end: endOfMonth(newStart),
    });
  };

  const isCardActive = (type: string, value: string) => {
    return activeMetricFilter?.type === type && activeMetricFilter?.value === value;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4">
              <div className="h-8 bg-muted rounded mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Date Filter */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Período:</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => changeMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {format(dateRange.start, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => changeMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {activeMetricFilter && (
          <Button variant="outline" size="sm" onClick={() => onFilterChange(null)}>
            <XCircle className="h-3 w-3 mr-1" />
            Limpar filtro de card
          </Button>
        )}
      </div>

      {/* Primary metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Tasks for today */}
        <Card 
          className={cn(
            "border-l-4 border-l-blue-500 cursor-pointer transition-all hover:shadow-md",
            isCardActive("tasks", "today") && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950"
          )}
          onClick={() => handleCardClick("tasks", "today")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ListTodo className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium">Tarefas Hoje</span>
            </div>
            <div className="text-2xl font-bold">{taskMetrics.todayTasks}</div>
            <div className="text-xs text-muted-foreground">
              {taskMetrics.todayCompleted} concluídas
            </div>
          </CardContent>
        </Card>

        {/* Overdue tasks */}
        <Card 
          className={cn(
            "border-l-4 border-l-red-500 cursor-pointer transition-all hover:shadow-md",
            isCardActive("tasks", "overdue") && "ring-2 ring-red-500 bg-red-50 dark:bg-red-950"
          )}
          onClick={() => handleCardClick("tasks", "overdue")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground font-medium">Em Atraso</span>
            </div>
            <div className="text-2xl font-bold text-red-500">{taskMetrics.overdueTasks}</div>
            <div className="text-xs text-muted-foreground">
              {overdueRate}% do total
            </div>
          </CardContent>
        </Card>

        {/* Completion rate */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">Conclusão</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{completionRate}%</div>
            <Progress value={completionRate} className="h-1.5 mt-1" />
          </CardContent>
        </Card>

        {/* Active companies */}
        <Card 
          className={cn(
            "border-l-4 border-l-primary cursor-pointer transition-all hover:shadow-md",
            isCardActive("status", "active") && "ring-2 ring-primary bg-primary/5"
          )}
          onClick={() => handleCardClick("status", "active")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Ativas</span>
            </div>
            <div className="text-2xl font-bold">{companyMetrics.activeCompanies}</div>
            <div className="text-xs text-muted-foreground">
              de {companies.length} total
            </div>
          </CardContent>
        </Card>

        {/* Churn signaled */}
        <Card 
          className={cn(
            "border-l-4 border-l-amber-500 cursor-pointer transition-all hover:shadow-md",
            isCardActive("status", "cancellation_signaled") && "ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950"
          )}
          onClick={() => handleCardClick("status", "cancellation_signaled")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground font-medium">Sinalizaram</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">{companyMetrics.cancellationSignaled}</div>
            <div className="text-xs text-muted-foreground">
              cancelamento
            </div>
          </CardContent>
        </Card>

        {/* Notice period */}
        <Card 
          className={cn(
            "border-l-4 border-l-orange-500 cursor-pointer transition-all hover:shadow-md",
            isCardActive("status", "notice_period") && "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950"
          )}
          onClick={() => handleCardClick("status", "notice_period")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarX className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground font-medium">Cumprindo Aviso</span>
            </div>
            <div className="text-2xl font-bold text-orange-500">{companyMetrics.noticePeriod}</div>
            <div className="text-xs text-muted-foreground">
              empresas
            </div>
          </CardContent>
        </Card>

        {/* Contracts ending */}
        <Card 
          className={cn(
            "border-l-4 border-l-purple-500 cursor-pointer transition-all hover:shadow-md",
            isCardActive("contracts", "ending") && "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950"
          )}
          onClick={() => handleCardClick("contracts", "ending")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarX className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground font-medium">Vencendo</span>
            </div>
            <div className="text-2xl font-bold text-purple-500">{companyMetrics.contractsEndingInPeriod}</div>
            <div className="text-xs text-muted-foreground">
              este período
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Churn card */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Churn do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-red-500">{churnMetrics.closedInPeriod}</div>
                <div className="text-xs text-muted-foreground">Encerrados</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-500">{churnMetrics.signaledInPeriod}</div>
                <div className="text-xs text-muted-foreground">Sinalizaram</div>
              </div>
              <div>
                <div className="text-xl font-bold">{churnMetrics.churnRate}%</div>
                <div className="text-xs text-muted-foreground">Taxa Churn</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task summary card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Resumo de Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-green-500">{taskMetrics.totalCompleted}</div>
                <div className="text-xs text-muted-foreground">Concluídas</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-500">{taskMetrics.totalPending}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-500">{taskMetrics.overdueTasks}</div>
                <div className="text-xs text-muted-foreground">Atrasadas</div>
              </div>
            </div>
            <Progress value={completionRate} className="h-2 mt-4" />
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Status das Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-1 rounded"
                onClick={() => handleCardClick("status", "active")}
              >
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Ativas
                </span>
                <Badge variant="secondary" className="text-green-500">
                  {companyMetrics.activeCompanies}
                </Badge>
              </div>
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-1 rounded"
                onClick={() => handleCardClick("status", "cancellation_signaled")}
              >
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  Sinalizaram Cancel.
                </span>
                <Badge variant="secondary" className="text-amber-500">
                  {companyMetrics.cancellationSignaled}
                </Badge>
              </div>
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-1 rounded"
                onClick={() => handleCardClick("status", "notice_period")}
              >
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  Cumprindo Aviso
                </span>
                <Badge variant="secondary" className="text-orange-500">
                  {companyMetrics.noticePeriod}
                </Badge>
              </div>
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-1 rounded"
                onClick={() => handleCardClick("status", "closed")}
              >
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  Encerradas
                </span>
                <Badge variant="secondary" className="text-red-500">
                  {companyMetrics.closedCompanies}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardMetrics;
