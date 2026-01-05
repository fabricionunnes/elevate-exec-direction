import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  Target,
  Zap,
  RotateCcw,
  Star,
  UserCheck,
  UserX,
  Percent,
  FileWarning,
  DollarSign
} from "lucide-react";
import { format, isBefore, startOfDay, isWithinInterval, eachDayOfInterval, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  CartesianGrid,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { TasksListDialog } from "./TasksListDialog";

interface Task {
  id: string;
  status: string;
  due_date: string | null;
  project_id: string;
  completed_at: string | null;
}

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  consultant_id: string | null;
  reactivated_at?: string | null;
  current_nps?: number | null;
  onboarding_company_id?: string | null;
}

interface Company {
  id: string;
  name: string;
  status: string;
  contract_end_date: string | null;
  contract_start_date: string | null;
  contract_value: number | null;
  status_changed_at?: string | null;
  created_at: string;
}

interface DashboardMetricsProps {
  companies: Company[];
  projects: Project[];
  onFilterChange: (filter: { type: string; value: string } | null) => void;
  activeMetricFilter: { type: string; value: string } | null;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  overdueTasks: Task[];
  todayTasks: Task[];
}

const DashboardMetrics = ({ 
  companies, 
  projects,
  onFilterChange, 
  activeMetricFilter,
  dateRange,
  overdueTasks,
  todayTasks
}: DashboardMetricsProps) => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [npsResponses, setNpsResponses] = useState<{ project_id: string; score: number }[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<{ project_id: string; month: number; year: number; sales_target: number | null; sales_result: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const [tasksDialogType, setTasksDialogType] = useState<"overdue" | "today" | "status">("overdue");
  const [tasksDialogIds, setTasksDialogIds] = useState<string[]>([]);
  const [tasksDialogStatus, setTasksDialogStatus] = useState<"completed" | "pending" | "in_progress" | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const pageSize = 1000;
      let from = 0;
      let allTasksData: Task[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("onboarding_tasks")
          .select("id, status, due_date, project_id, completed_at")
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const batch = data || [];
        allTasksData = allTasksData.concat(batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      const [npsResult, goalsResult] = await Promise.all([
        supabase.from("onboarding_nps_responses").select("project_id, score"),
        supabase.from("onboarding_monthly_goals").select("project_id, month, year, sales_target, sales_result"),
      ]);

      if (npsResult.error) throw npsResult.error;
      if (goalsResult.error) throw goalsResult.error;

      setAllTasks(allTasksData);
      setNpsResponses(npsResult.data || []);
      setMonthlyGoals(goalsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const filteredProjectIds = new Set(projects.map(p => p.id));
    return allTasks.filter(t => filteredProjectIds.has(t.project_id));
  }, [allTasks, projects]);

  const taskMetrics = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayTasksCount = todayTasks.length;
    const overdueTasksCount = overdueTasks.length;
    const todayCompletedTasks = filteredTasks.filter(t => {
      if (t.status !== "completed" || !t.completed_at) return false;
      return format(parseISO(t.completed_at), "yyyy-MM-dd") === today;
    });
    const completedTasks = filteredTasks.filter(t => t.status === "completed");
    const pendingTasks = filteredTasks.filter(t => t.status === "pending");
    const inProgressTasks = filteredTasks.filter(t => t.status === "in_progress");
    
    return { 
      todayTasks: todayTasksCount, 
      todayCompleted: todayCompletedTasks.length, 
      todayCompletedIds: todayCompletedTasks.map(t => t.id),
      overdueTasks: overdueTasksCount, 
      totalPending: pendingTasks.length, 
      pendingIds: pendingTasks.map(t => t.id),
      totalInProgress: inProgressTasks.length, 
      inProgressIds: inProgressTasks.map(t => t.id),
      totalCompleted: completedTasks.length, 
      completedIds: completedTasks.map(t => t.id),
      totalTasks: filteredTasks.length 
    };
  }, [filteredTasks, overdueTasks, todayTasks]);

  const completedByDayData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const completedCount = filteredTasks.filter(t => {
        if (!t.completed_at) return false;
        return format(parseISO(t.completed_at), "yyyy-MM-dd") === dayStr;
      }).length;
      return { date: format(day, "dd/MM", { locale: ptBR }), fullDate: format(day, "dd 'de' MMM", { locale: ptBR }), concluídas: completedCount };
    });
  }, [filteredTasks, dateRange]);

  const projectMetrics = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === "active").length;
    const cancellationSignaled = projects.filter(p => p.status === "cancellation_signaled").length;
    const noticePeriod = projects.filter(p => p.status === "notice_period").length;
    const closedProjects = projects.filter(p => p.status === "closed" || p.status === "completed").length;
    const reactivatedInPeriod = projects.filter(p => {
      if (!p.reactivated_at) return false;
      return isWithinInterval(new Date(p.reactivated_at), { start: dateRange.start, end: dateRange.end });
    }).length;
    return { activeProjects, cancellationSignaled, noticePeriod, closedProjects, churnSignaled: cancellationSignaled + noticePeriod, reactivatedInPeriod };
  }, [projects, dateRange]);

  const filteredCompanyIds = useMemo(() => new Set(projects.filter(p => p.onboarding_company_id).map(p => p.onboarding_company_id)), [projects]);
  const filteredCompanies = useMemo(() => companies.filter(c => filteredCompanyIds.has(c.id)), [companies, filteredCompanyIds]);

  const companyMetrics = useMemo(() => {
    const today = startOfDay(new Date());
    const companiesWithActiveProjects = new Set(projects.filter(p => p.status === "active").map(p => p.onboarding_company_id).filter(Boolean));
    const activeCompanies = filteredCompanies.filter(c => c.status === "active" && companiesWithActiveProjects.has(c.id)).length;
    const contractsEndingInPeriod = filteredCompanies.filter(c => c.contract_end_date && isWithinInterval(new Date(c.contract_end_date), { start: dateRange.start, end: dateRange.end })).length;
    const expiredContracts = filteredCompanies.filter(c => c.contract_end_date && isBefore(new Date(c.contract_end_date), today)).length;
    return { activeCompanies, contractsEndingInPeriod, expiredContracts };
  }, [filteredCompanies, dateRange, projects]);

  const churnMetrics = useMemo(() => {
    const closedInPeriod = projects.filter(p => (p.status === "closed" || p.status === "completed") && isWithinInterval(new Date(p.updated_at), { start: dateRange.start, end: dateRange.end })).length;
    const signaledInPeriod = projects.filter(p => (p.status === "cancellation_signaled" || p.status === "notice_period") && isWithinInterval(new Date(p.updated_at), { start: dateRange.start, end: dateRange.end })).length;
    const totalActiveStart = projectMetrics.activeProjects + closedInPeriod + signaledInPeriod;
    const churnRate = totalActiveStart > 0 ? Math.round((closedInPeriod / totalActiveStart) * 100) : 0;
    return { closedInPeriod, signaledInPeriod, churnRate };
  }, [projects, dateRange, projectMetrics]);

  const monthlyChurnData = useMemo(() => {
    const currentYear = dateRange.start.getFullYear();
    const months = eachMonthOfInterval({ start: startOfYear(new Date(currentYear, 0, 1)), end: endOfYear(new Date(currentYear, 0, 1)) });
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const closedInMonth = projects.filter(p => (p.status === "closed" || p.status === "completed") && isWithinInterval(new Date(p.updated_at), { start: monthStart, end: monthEnd })).length;
      const activeAtMonthStart = projects.filter(p => {
        if (new Date(p.created_at) > monthEnd) return false;
        if (p.status === "closed" || p.status === "completed") return new Date(p.updated_at) >= monthStart;
        return true;
      }).length;
      const churnRate = activeAtMonthStart > 0 ? Math.round((closedInMonth / activeAtMonthStart) * 100 * 10) / 10 : 0;
      return { month: format(monthDate, "MMM", { locale: ptBR }), churn: churnRate };
    });
  }, [projects, dateRange]);

  const ltvMetrics = useMemo(() => {
    const today = new Date();
    const companiesWithLifetime = filteredCompanies.map(company => {
      const startDate = company.contract_start_date ? new Date(company.contract_start_date) : new Date(company.created_at);
      let endDate: Date;
      if (company.status === "closed" || company.status === "inactive") {
        endDate = company.contract_end_date ? new Date(company.contract_end_date) : company.status_changed_at ? new Date(company.status_changed_at) : today;
      } else {
        endDate = today;
      }
      const lifetimeMonths = Math.max(0, differenceInMonths(endDate, startDate));
      const ltv = (company.contract_value || 0) * lifetimeMonths;
      return { lifetimeMonths, ltv };
    });
    const totalCompanies = companiesWithLifetime.length;
    if (totalCompanies === 0) return { averageLifetimeMonths: 0, averageLTV: 0 };
    const averageLifetimeMonths = Math.round((companiesWithLifetime.reduce((sum, c) => sum + c.lifetimeMonths, 0) / totalCompanies) * 10) / 10;
    const companiesWithValue = companiesWithLifetime.filter(c => c.ltv > 0);
    const averageLTV = companiesWithValue.length > 0 ? Math.round(companiesWithValue.reduce((sum, c) => sum + c.ltv, 0) / companiesWithValue.length) : 0;
    return { averageLifetimeMonths, averageLTV };
  }, [filteredCompanies]);

  const npsMetrics = useMemo(() => {
    const filteredProjectIds = new Set(projects.map(p => p.id));
    const totalFilteredProjects = filteredProjectIds.size;
    const filteredResponses = npsResponses.filter(r => filteredProjectIds.has(r.project_id));
    const totalResponses = filteredResponses.length;
    const projectsWithResponse = new Set(filteredResponses.map(r => r.project_id));
    const respondedCount = projectsWithResponse.size;
    const notRespondedCount = totalFilteredProjects - respondedCount;
    const responseRate = totalFilteredProjects > 0 ? Math.round((respondedCount / totalFilteredProjects) * 100) : 0;
    if (totalResponses === 0) return { averageNps: null, promoters: 0, detractors: 0, neutrals: 0, totalResponses: 0, respondedCount: 0, notRespondedCount: totalFilteredProjects, responseRate: 0, totalProjects: totalFilteredProjects };
    const averageNps = Math.round((filteredResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses) * 10) / 10;
    const promoters = filteredResponses.filter(r => r.score >= 9).length;
    const detractors = filteredResponses.filter(r => r.score <= 6).length;
    const neutrals = filteredResponses.filter(r => r.score >= 7 && r.score <= 8).length;
    return { averageNps, promoters, detractors, neutrals, totalResponses, respondedCount, notRespondedCount, responseRate, totalProjects: totalFilteredProjects };
  }, [projects, npsResponses]);

  const goalsMetrics = useMemo(() => {
    const periodMonth = dateRange.start.getMonth() + 1;
    const periodYear = dateRange.start.getFullYear();
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === periodMonth && today.getFullYear() === periodYear;
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const timeElapsedPercent = currentDay / daysInMonth;
    const filteredProjectIds = new Set(projects.map(p => p.id));
    const filteredGoals = monthlyGoals.filter(g => filteredProjectIds.has(g.project_id) && g.month === periodMonth && g.year === periodYear);
    const projectsWithGoals = filteredGoals.filter(g => g.sales_target && g.sales_target > 0);
    const projectsWithGoalsIds = new Set(projectsWithGoals.map(g => g.project_id));
    const noGoalCount = projects.filter(p => !projectsWithGoalsIds.has(p.id)).length;
    const projectsWithProjection = projectsWithGoals.map(g => {
      const result = g.sales_result || 0;
      const target = g.sales_target || 1;
      const projectionPercent = timeElapsedPercent > 0 ? Math.round(((result / target) / timeElapsedPercent) * 100) : 0;
      return { ...g, projectionPercent };
    });
    const meetingGoal = projectsWithProjection.filter(g => g.projectionPercent >= 100).length;
    const above70 = projectsWithProjection.filter(g => g.projectionPercent >= 70 && g.projectionPercent < 100).length;
    const between50And70 = projectsWithProjection.filter(g => g.projectionPercent >= 50 && g.projectionPercent < 70).length;
    const below50 = projectsWithProjection.filter(g => g.projectionPercent < 50).length;
    const totalWithGoals = projectsWithGoals.length;
    const goalRate = totalWithGoals > 0 ? Math.round((meetingGoal / totalWithGoals) * 100) : 0;
    return { totalWithGoals, meetingGoal, above70, between50And70, below50, noGoalCount, goalRate };
  }, [projects, monthlyGoals, dateRange]);

  const handleCardClick = (filterType: string, filterValue: string) => {
    if (activeMetricFilter?.type === filterType && activeMetricFilter?.value === filterValue) {
      onFilterChange(null);
    } else {
      onFilterChange({ type: filterType, value: filterValue });
    }
  };

  const isCardActive = (type: string, value: string) => activeMetricFilter?.type === type && activeMetricFilter?.value === value;

  const taskStatusData = [
    { name: "Concluídas", value: taskMetrics.totalCompleted, color: "#22c55e" },
    { name: "Em Progresso", value: taskMetrics.totalInProgress, color: "#3b82f6" },
    { name: "Pendentes", value: taskMetrics.totalPending, color: "#f59e0b" },
    { name: "Atrasadas", value: taskMetrics.overdueTasks, color: "#ef4444" },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
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
    <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
      {/* Summary Row - Always Visible - Mobile Optimized */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", isCardActive("status", "active") && "ring-2 ring-primary")} onClick={() => handleCardClick("status", "active")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none">{companyMetrics.activeCompanies}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("cursor-pointer transition-all hover:shadow-md", isCardActive("status", "cancellation_signaled") && "ring-2 ring-amber-500")} onClick={() => handleCardClick("status", "cancellation_signaled")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none text-amber-500">{projectMetrics.churnSignaled}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Risco</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => { setTasksDialogType("today"); setTasksDialogStatus(null); setTasksDialogIds(todayTasks.map(t => t.id)); setTasksDialogOpen(true); }}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <ListTodo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none">{taskMetrics.todayTasks}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => { setTasksDialogType("overdue"); setTasksDialogStatus(null); setTasksDialogIds(overdueTasks.map(t => t.id)); setTasksDialogOpen(true); }}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none text-red-500">{taskMetrics.overdueTasks}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Atrasadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden sm:block">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className={cn("h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0", npsMetrics.averageNps === null ? "bg-gray-400/10" : npsMetrics.averageNps >= 9 ? "bg-green-500/10" : npsMetrics.averageNps >= 7 ? "bg-yellow-500/10" : "bg-red-500/10")}>
                <Star className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", npsMetrics.averageNps === null ? "text-gray-400" : npsMetrics.averageNps >= 9 ? "text-green-500" : npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500")} />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className={cn("text-base sm:text-lg font-bold leading-none", npsMetrics.averageNps === null ? "text-muted-foreground" : npsMetrics.averageNps >= 9 ? "text-green-500" : npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500")}>
                  {npsMetrics.averageNps ?? "—"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">NPS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("hidden sm:block cursor-pointer transition-all hover:shadow-md", isCardActive("goals", "meeting") && "ring-2 ring-teal-500")} onClick={() => handleCardClick("goals", "meeting")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className={cn("text-base sm:text-lg font-bold leading-none", goalsMetrics.goalRate >= 70 ? "text-teal-500" : goalsMetrics.goalRate >= 40 ? "text-amber-500" : "text-red-500")}>
                  {goalsMetrics.goalRate}%
                </p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Details - Mobile Optimized */}
      <Tabs defaultValue="empresas" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-8 sm:h-9">
          <TabsTrigger value="empresas" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-1 sm:px-2"><Building2 className="h-3 w-3" /><span className="hidden xs:inline">Empresas</span><span className="xs:hidden">Emp</span></TabsTrigger>
          <TabsTrigger value="tarefas" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-1 sm:px-2"><ListTodo className="h-3 w-3" /><span className="hidden xs:inline">Tarefas</span><span className="xs:hidden">Tar</span></TabsTrigger>
          <TabsTrigger value="metas" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-1 sm:px-2"><Target className="h-3 w-3" />Metas</TabsTrigger>
          <TabsTrigger value="nps" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-1 sm:px-2"><Star className="h-3 w-3" />NPS</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <Card><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold">{filteredCompanies.length}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Total</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("status", "notice_period") && "ring-2 ring-orange-500")} onClick={() => handleCardClick("status", "notice_period")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-orange-500">{projectMetrics.noticePeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Aviso</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("contracts", "ending") && "ring-2 ring-purple-500")} onClick={() => handleCardClick("contracts", "ending")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-purple-500">{companyMetrics.contractsEndingInPeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Vencendo</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden sm:block", isCardActive("contracts", "expired") && "ring-2 ring-rose-500")} onClick={() => handleCardClick("contracts", "expired")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-rose-500">{companyMetrics.expiredContracts}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Vencidos</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("status", "reactivated") && "ring-2 ring-cyan-500")} onClick={() => handleCardClick("status", "reactivated")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-cyan-500">{projectMetrics.reactivatedInPeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Revertidos</p></CardContent></Card>
            <Card className="hidden lg:block"><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-500">{churnMetrics.churnRate}%</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Churn</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            <Card>
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5"><DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-teal-500" />LTV & Permanência</CardTitle></CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <div className="grid grid-cols-2 gap-2 sm:gap-4 text-center">
                  <div><p className="text-xl sm:text-2xl font-bold text-indigo-500">{ltvMetrics.averageLifetimeMonths}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">meses</p></div>
                  <div><p className="text-xl sm:text-2xl font-bold text-teal-500">{ltvMetrics.averageLTV > 0 ? `R$ ${(ltvMetrics.averageLTV / 1000).toFixed(0)}k` : "—"}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">LTV</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="hidden sm:block">
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5"><Percent className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />Churn Mensal</CardTitle></CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <div className="h-[60px] sm:h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChurnData}>
                      <XAxis dataKey="month" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={20} tickFormatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="churn" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("today"); setTasksDialogStatus(null); setTasksDialogIds(taskMetrics.todayCompletedIds); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-green-500">{taskMetrics.todayCompleted}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Concl. Hoje</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("status"); setTasksDialogStatus("completed"); setTasksDialogIds([]); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold">{taskMetrics.totalCompleted}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Total Concl.</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("status"); setTasksDialogStatus("pending"); setTasksDialogIds([]); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-amber-500">{taskMetrics.totalPending}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Pendentes</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("status"); setTasksDialogStatus("in_progress"); setTasksDialogIds([]); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-blue-500">{taskMetrics.totalInProgress}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Em Progresso</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            <Card>
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5"><CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />Concluídas/Dia</CardTitle></CardHeader>
              <CardContent className="px-2 sm:px-4 pb-2 sm:pb-3">
                <div className="h-[70px] sm:h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={completedByDayData}>
                      <defs><linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} width={16} />
                      <Area type="monotone" dataKey="concluídas" stroke="#22c55e" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCompleted)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="hidden md:block">
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium">Distribuição</CardTitle></CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <div className="h-[70px] sm:h-[100px] flex items-center justify-center">
                  {taskStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={2} dataKey="value">
                          {taskStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-muted-foreground">Sem tarefas</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metas" className="mt-2 sm:mt-3">
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <Card className={cn("cursor-pointer", isCardActive("goals", "100plus") && "ring-2 ring-green-500")} onClick={() => handleCardClick("goals", "100plus")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-green-500">{goalsMetrics.meetingGoal}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">≥100%</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("goals", "above70") && "ring-2 ring-blue-500")} onClick={() => handleCardClick("goals", "above70")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-blue-500">{goalsMetrics.above70}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">70-99%</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("goals", "between50and70") && "ring-2 ring-amber-500")} onClick={() => handleCardClick("goals", "between50and70")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-amber-500">{goalsMetrics.between50And70}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">50-69%</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("goals", "below50") && "ring-2 ring-red-500")} onClick={() => handleCardClick("goals", "below50")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-500">{goalsMetrics.below50}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">&lt;50%</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("goals", "noGoal") && "ring-2 ring-gray-500")} onClick={() => handleCardClick("goals", "noGoal")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-gray-500">{goalsMetrics.noGoalCount}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Sem Meta</p></CardContent></Card>
            <Card className="hidden lg:block"><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold">{goalsMetrics.totalWithGoals}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Com Meta</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="nps" className="mt-2 sm:mt-3">
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <Card><CardContent className="p-2 sm:p-3 text-center"><p className={cn("text-lg sm:text-xl font-bold", npsMetrics.averageNps === null ? "text-muted-foreground" : npsMetrics.averageNps >= 9 ? "text-green-500" : npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500")}>{npsMetrics.averageNps ?? "—"}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Média</p></CardContent></Card>
            <Card><CardContent className="p-2 sm:p-3 text-center"><p className={cn("text-lg sm:text-xl font-bold", npsMetrics.responseRate >= 70 ? "text-green-500" : npsMetrics.responseRate >= 40 ? "text-yellow-500" : "text-orange-500")}>{npsMetrics.responseRate}%</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Taxa</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("nps", "responded") && "ring-2 ring-blue-500")} onClick={() => handleCardClick("nps", "responded")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-blue-500">{npsMetrics.respondedCount}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Respond.</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("nps", "not_responded") && "ring-2 ring-gray-500")} onClick={() => handleCardClick("nps", "not_responded")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-gray-500">{npsMetrics.notRespondedCount}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Não Resp.</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("nps", "promoters") && "ring-2 ring-green-500")} onClick={() => handleCardClick("nps", "promoters")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-green-500">{npsMetrics.promoters}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Promotores</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("nps", "detractors") && "ring-2 ring-red-500")} onClick={() => handleCardClick("nps", "detractors")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-500">{npsMetrics.detractors}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Detratores</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <TasksListDialog
        open={tasksDialogOpen}
        onOpenChange={setTasksDialogOpen}
        type={tasksDialogType}
        taskIds={tasksDialogIds}
        status={tasksDialogStatus ?? undefined}
        projectIds={projects.map((p) => p.id)}
      />
    </div>
  );
};

export default DashboardMetrics;
