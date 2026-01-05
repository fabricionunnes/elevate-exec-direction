import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  Timer,
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
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
  LineChart,
  Line
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
  onDateRangeChange,
  overdueTasks,
  todayTasks
}: DashboardMetricsProps) => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [npsResponses, setNpsResponses] = useState<{ project_id: string; score: number }[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<{ project_id: string; month: number; year: number; sales_target: number | null; sales_result: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tasks dialog state
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const [tasksDialogType, setTasksDialogType] = useState<"overdue" | "today">("overdue");
  const [tasksDialogIds, setTasksDialogIds] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksResult, npsResult, goalsResult] = await Promise.all([
        supabase.from("onboarding_tasks").select("id, status, due_date, project_id, completed_at").limit(10000),
        supabase.from("onboarding_nps_responses").select("project_id, score"),
        supabase.from("onboarding_monthly_goals").select("project_id, month, year, sales_target, sales_result")
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (npsResult.error) throw npsResult.error;
      if (goalsResult.error) throw goalsResult.error;
      
      setAllTasks(tasksResult.data || []);
      setNpsResponses(npsResult.data || []);
      setMonthlyGoals(goalsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks by filtered projects
  const filteredTasks = useMemo(() => {
    const filteredProjectIds = new Set(projects.map(p => p.id));
    return allTasks.filter(t => filteredProjectIds.has(t.project_id));
  }, [allTasks, projects]);

  // Calculate task metrics (respects project filters)
  const taskMetrics = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayStart = startOfDay(new Date());
    
    const todayTasksCount = filteredTasks.filter(t => t.due_date === today).length;
    const todayCompleted = filteredTasks.filter(t => t.due_date === today && t.status === "completed").length;
    
    const overdueTasksCount = filteredTasks.filter(t => {
      if (!t.due_date || t.status === "completed") return false;
      const dueDate = new Date(t.due_date);
      return isBefore(dueDate, todayStart);
    }).length;
    
    const totalCompleted = filteredTasks.filter(t => t.status === "completed").length;
    const totalPending = filteredTasks.filter(t => t.status === "pending").length;
    const totalInProgress = filteredTasks.filter(t => t.status === "in_progress").length;
    
    return {
      todayTasks: todayTasksCount,
      todayCompleted,
      overdueTasks: overdueTasksCount,
      totalPending,
      totalInProgress,
      totalCompleted,
      totalTasks: filteredTasks.length,
    };
  }, [filteredTasks]);

  // Calculate completed tasks by day for the filtered period (respects project filters)
  const completedByDayData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const completedCount = filteredTasks.filter(t => {
        if (!t.completed_at) return false;
        const completedDate = format(parseISO(t.completed_at), "yyyy-MM-dd");
        return completedDate === dayStr;
      }).length;
      
      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        fullDate: format(day, "dd 'de' MMM", { locale: ptBR }),
        concluídas: completedCount,
      };
    });
  }, [filteredTasks, dateRange]);

  // Project-based metrics
  const projectMetrics = useMemo(() => {
    // Current totals (all projects, not filtered by period)
    const activeProjects = projects.filter(p => p.status === "active").length;
    const cancellationSignaled = projects.filter(p => p.status === "cancellation_signaled").length;
    const noticePeriod = projects.filter(p => p.status === "notice_period").length;
    const closedProjects = projects.filter(p => p.status === "closed" || p.status === "completed").length;
    
    // Projects that changed to each status within the date range
    const activeInPeriod = projects.filter(p => {
      if (p.status !== "active") return false;
      const changedAt = new Date(p.updated_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;

    const cancellationSignaledInPeriod = projects.filter(p => {
      if (p.status !== "cancellation_signaled") return false;
      const changedAt = new Date(p.updated_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;

    const noticePeriodInPeriod = projects.filter(p => {
      if (p.status !== "notice_period") return false;
      const changedAt = new Date(p.updated_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;
    
    // Count reactivated projects within the date range
    const reactivatedInPeriod = projects.filter(p => {
      if (!p.reactivated_at) return false;
      const reactivatedDate = new Date(p.reactivated_at);
      return isWithinInterval(reactivatedDate, { start: dateRange.start, end: dateRange.end });
    }).length;

    return {
      activeProjects,
      cancellationSignaled,
      noticePeriod,
      closedProjects,
      churnSignaled: cancellationSignaled + noticePeriod,
      reactivatedInPeriod,
      // Period-specific counts
      activeInPeriod,
      cancellationSignaledInPeriod,
      noticePeriodInPeriod,
    };
  }, [projects, dateRange]);

  // Get filtered company IDs from filtered projects
  const filteredCompanyIds = useMemo(() => {
    return new Set(
      projects
        .filter(p => p.onboarding_company_id)
        .map(p => p.onboarding_company_id)
    );
  }, [projects]);

  // Filtered companies based on filtered projects
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => filteredCompanyIds.has(c.id));
  }, [companies, filteredCompanyIds]);

  // Company metrics (respects project filters)
  const companyMetrics = useMemo(() => {
    const today = startOfDay(new Date());
    const activeCompanies = filteredCompanies.filter(c => c.status === "active").length;
    
    const contractsEndingInPeriod = filteredCompanies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return isWithinInterval(endDate, { start: dateRange.start, end: dateRange.end });
    }).length;

    // Contracts that have already expired (end date is before today)
    const expiredContracts = filteredCompanies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return isBefore(endDate, today);
    }).length;

    return {
      activeCompanies,
      contractsEndingInPeriod,
      expiredContracts,
    };
  }, [filteredCompanies, dateRange]);

  // Churn metrics
  const churnMetrics = useMemo(() => {
    const closedInPeriod = projects.filter(p => {
      if ((p.status !== "closed" && p.status !== "completed")) return false;
      const changedAt = new Date(p.updated_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;

    const signaledInPeriod = projects.filter(p => {
      if (p.status !== "cancellation_signaled" && p.status !== "notice_period") return false;
      const changedAt = new Date(p.updated_at);
      return isWithinInterval(changedAt, { start: dateRange.start, end: dateRange.end });
    }).length;

    const totalActiveStart = projectMetrics.activeProjects + closedInPeriod + signaledInPeriod;
    
    const churnRate = totalActiveStart > 0 
      ? Math.round((closedInPeriod / totalActiveStart) * 100) 
      : 0;

    return {
      closedInPeriod,
      signaledInPeriod,
      churnRate,
    };
  }, [projects, dateRange, projectMetrics]);

  // Monthly churn rate for the year
  const monthlyChurnData = useMemo(() => {
    const currentYear = dateRange.start.getFullYear();
    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(new Date(currentYear, 0, 1));
    
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      // Projects that closed in this month
      const closedInMonth = projects.filter(p => {
        if (p.status !== "closed" && p.status !== "completed") return false;
        const changedAt = new Date(p.updated_at);
        return isWithinInterval(changedAt, { start: monthStart, end: monthEnd });
      }).length;
      
      // Projects that were active at the start of the month
      // = currently active + closed after this month + those who signaled after this month
      const activeAtMonthStart = projects.filter(p => {
        const createdAt = new Date(p.created_at);
        // Project existed before or during this month
        if (createdAt > monthEnd) return false;
        
        // If closed/completed, check if it was still active at month start
        if (p.status === "closed" || p.status === "completed") {
          const changedAt = new Date(p.updated_at);
          return changedAt >= monthStart; // Was still active at beginning of month
        }
        
        // If signaled/notice, it's still active technically
        return true;
      }).length;
      
      const churnRate = activeAtMonthStart > 0 
        ? Math.round((closedInMonth / activeAtMonthStart) * 100 * 10) / 10
        : 0;
      
      return {
        month: format(monthDate, "MMM", { locale: ptBR }),
        fullMonth: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
        churn: churnRate,
        closed: closedInMonth,
        total: activeAtMonthStart,
      };
    });
  }, [projects, dateRange]);

  // LTV metrics - average client lifetime and value (uses filteredCompanies)
  const ltvMetrics = useMemo(() => {
    const today = new Date();
    
    // Calculate lifetime for each company based on contract dates or created_at
    const companiesWithLifetime = filteredCompanies.map(company => {
      let startDate: Date;
      let endDate: Date;
      
      // Use contract_start_date if available, otherwise created_at
      if (company.contract_start_date) {
        startDate = new Date(company.contract_start_date);
      } else {
        startDate = new Date(company.created_at);
      }
      
      // For closed companies, use contract_end_date or status_changed_at
      // For active companies, calculate until today
      if (company.status === "closed" || company.status === "inactive") {
        if (company.contract_end_date) {
          endDate = new Date(company.contract_end_date);
        } else if (company.status_changed_at) {
          endDate = new Date(company.status_changed_at);
        } else {
          endDate = today;
        }
      } else {
        endDate = today;
      }
      
      const lifetimeMonths = Math.max(0, differenceInMonths(endDate, startDate));
      const contractValue = company.contract_value || 0;
      const ltv = contractValue * lifetimeMonths;
      
      return {
        ...company,
        lifetimeMonths,
        ltv,
      };
    });
    
    // Calculate averages
    const totalCompanies = companiesWithLifetime.length;
    
    if (totalCompanies === 0) {
      return {
        averageLifetimeMonths: 0,
        averageLTV: 0,
        totalCompanies: 0,
        companiesWithValue: 0,
      };
    }
    
    const totalLifetime = companiesWithLifetime.reduce((sum, c) => sum + c.lifetimeMonths, 0);
    const averageLifetimeMonths = Math.round((totalLifetime / totalCompanies) * 10) / 10;
    
    // Only consider companies with contract value for LTV average
    const companiesWithValue = companiesWithLifetime.filter(c => c.ltv > 0);
    const totalLTV = companiesWithValue.reduce((sum, c) => sum + c.ltv, 0);
    const averageLTV = companiesWithValue.length > 0 
      ? Math.round(totalLTV / companiesWithValue.length)
      : 0;
    
    return {
      averageLifetimeMonths,
      averageLTV,
      totalCompanies,
      companiesWithValue: companiesWithValue.length,
    };
  }, [filteredCompanies]);

  // NPS metrics - calculated from actual responses, filtered by projects
  const npsMetrics = useMemo(() => {
    // Get project IDs from filtered projects (respects consultant and service filters)
    const filteredProjectIds = new Set(projects.map(p => p.id));
    const totalFilteredProjects = filteredProjectIds.size;
    
    // Filter NPS responses to only include those from filtered projects
    const filteredResponses = npsResponses.filter(r => filteredProjectIds.has(r.project_id));
    const totalResponses = filteredResponses.length;
    
    // Get unique projects that have at least one response
    const projectsWithResponse = new Set(filteredResponses.map(r => r.project_id));
    const respondedCount = projectsWithResponse.size;
    const notRespondedCount = totalFilteredProjects - respondedCount;
    const responseRate = totalFilteredProjects > 0 
      ? Math.round((respondedCount / totalFilteredProjects) * 100) 
      : 0;
    
    if (totalResponses === 0) {
      return { 
        averageNps: null, 
        promoters: 0, 
        detractors: 0, 
        neutrals: 0, 
        totalResponses: 0,
        respondedCount: 0,
        notRespondedCount: totalFilteredProjects,
        responseRate: 0,
        totalProjects: totalFilteredProjects
      };
    }
    
    const sumNps = filteredResponses.reduce((sum, r) => sum + r.score, 0);
    const averageNps = Math.round((sumNps / totalResponses) * 10) / 10;
    
    const promoters = filteredResponses.filter(r => r.score >= 9).length;
    const detractors = filteredResponses.filter(r => r.score <= 6).length;
    const neutrals = filteredResponses.filter(r => r.score >= 7 && r.score <= 8).length;
    
    return { 
      averageNps, 
      promoters, 
      detractors, 
      neutrals, 
      totalResponses,
      respondedCount,
      notRespondedCount,
      responseRate,
      totalProjects: totalFilteredProjects
    };
  }, [projects, npsResponses]);

  // Goals metrics - projects meeting their sales goals with projection ranges
  const goalsMetrics = useMemo(() => {
    // Get month and year from dateRange start (to filter goals by period)
    const periodMonth = dateRange.start.getMonth() + 1; // 1-indexed
    const periodYear = dateRange.start.getFullYear();
    
    // Calculate time elapsed percentage in the month
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === periodMonth && today.getFullYear() === periodYear;
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const timeElapsedPercent = currentDay / daysInMonth;
    
    // Get project IDs from filtered projects (respects consultant and service filters)
    const filteredProjectIds = new Set(projects.map(p => p.id));
    
    // Filter goals to only include those from filtered projects and in the selected period
    const filteredGoals = monthlyGoals.filter(g => 
      filteredProjectIds.has(g.project_id) &&
      g.month === periodMonth &&
      g.year === periodYear
    );
    
    // Get project IDs that have goals registered for this period
    const projectsWithGoalsIds = new Set(
      filteredGoals
        .filter(g => g.sales_target && g.sales_target > 0)
        .map(g => g.project_id)
    );
    
    // Count projects without goals (filtered projects that don't have a goal for this period)
    const projectsWithoutGoalsList = projects.filter(p => !projectsWithGoalsIds.has(p.id));
    const noGoalCount = projectsWithoutGoalsList.length;
    const noGoalProjectIds = projectsWithoutGoalsList.map(p => p.id);
    
    // Count projects with goals set (has target)
    const projectsWithGoals = filteredGoals.filter(g => g.sales_target && g.sales_target > 0);
    
    // Calculate projection percentage for each project based on time elapsed
    // Formula: (current_result / target) / time_elapsed_percent * 100
    const projectsWithProjection = projectsWithGoals.map(g => {
      const result = g.sales_result || 0;
      const target = g.sales_target || 1;
      const achievementPercent = result / target;
      // Project to end of month: if at 50% of month with 50% result, projecting 100%
      const projectionPercent = timeElapsedPercent > 0 
        ? Math.round((achievementPercent / timeElapsedPercent) * 100)
        : 0;
      return { ...g, projectionPercent };
    });
    
    // Count projects that met their goal (result >= target) - 100% or more
    const meetingGoalList = projectsWithProjection.filter(g => g.projectionPercent >= 100);
    
    // Count projects above 70% projection (but not meeting 100%)
    const above70List = projectsWithProjection.filter(g => g.projectionPercent >= 70 && g.projectionPercent < 100);
    
    // Count projects between 50-70%
    const between50And70List = projectsWithProjection.filter(g => g.projectionPercent >= 50 && g.projectionPercent < 70);
    
    // Count projects below 50%
    const below50List = projectsWithProjection.filter(g => g.projectionPercent < 50);
    
    const totalWithGoals = projectsWithGoals.length;
    const meetingGoal = meetingGoalList.length;
    const above70 = above70List.length;
    const between50And70 = between50And70List.length;
    const below50 = below50List.length;
    
    // Goal rate: % of projects WITH GOALS that are projecting to meet goal
    const goalRate = totalWithGoals > 0 
      ? Math.round((meetingGoal / totalWithGoals) * 100) 
      : 0;
    
    // Get project IDs for filtering
    const meetingGoalProjectIds = meetingGoalList.map(g => g.project_id);
    const above70ProjectIds = above70List.map(g => g.project_id);
    const between50And70ProjectIds = between50And70List.map(g => g.project_id);
    const below50ProjectIds = below50List.map(g => g.project_id);
    
    return {
      totalWithGoals,
      meetingGoal,
      above70,
      between50And70,
      below50,
      noGoalCount,
      goalRate,
      periodMonth,
      periodYear,
      meetingGoalProjectIds,
      above70ProjectIds,
      between50And70ProjectIds,
      below50ProjectIds,
      noGoalProjectIds
    };
  }, [projects, monthlyGoals, dateRange]);

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

  const isCardActive = (type: string, value: string) => {
    return activeMetricFilter?.type === type && activeMetricFilter?.value === value;
  };

  // Chart data
  const taskStatusData = [
    { name: "Concluídas", value: taskMetrics.totalCompleted, color: "#22c55e" },
    { name: "Em Progresso", value: taskMetrics.totalInProgress, color: "#3b82f6" },
    { name: "Pendentes", value: taskMetrics.totalPending, color: "#f59e0b" },
    { name: "Atrasadas", value: taskMetrics.overdueTasks, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const projectStatusData = [
    { name: "Ativos", value: projectMetrics.activeProjects, color: "#22c55e", status: "active" },
    { name: "Sinalizaram", value: projectMetrics.cancellationSignaled, color: "#f59e0b", status: "cancellation_signaled" },
    { name: "Aviso", value: projectMetrics.noticePeriod, color: "#f97316", status: "notice_period" },
    { name: "Encerrados", value: projectMetrics.closedProjects, color: "#ef4444", status: "closed" },
  ].filter(d => d.value > 0);

  const churnData = [
    { name: "Encerrados", value: churnMetrics.closedInPeriod, status: "closed" },
    { name: "Sinalizaram", value: churnMetrics.signaledInPeriod, status: "cancellation_signaled" },
  ];

  // Handle pie chart click for status filtering
  const handlePieClick = (data: { status: string }) => {
    if (data?.status) {
      handleCardClick("status", data.status);
    }
  };

  // Handle bar chart click for churn filtering
  const handleBarClick = (data: { status: string }) => {
    if (data?.status) {
      handleCardClick("status", data.status);
    }
  };

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
    <div className="space-y-6 mb-6">
      {/* TAREFAS Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tarefas</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Today's Tasks */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
            )}
            onClick={() => {
              setTasksDialogType("today");
              setTasksDialogIds(todayTasks.map(t => t.id));
              setTasksDialogOpen(true);
            }}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Hoje</p>
                  <p className="text-2xl font-bold mt-1">{taskMetrics.todayTasks}</p>
                  <p className="text-xs text-muted-foreground">{taskMetrics.todayCompleted} feitas</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ListTodo className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Tasks */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
            )}
            onClick={() => {
              setTasksDialogType("overdue");
              setTasksDialogIds(overdueTasks.map(t => t.id));
              setTasksDialogOpen(true);
            }}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Atrasadas</p>
                  <p className="text-2xl font-bold mt-1 text-red-500">{taskMetrics.overdueTasks}</p>
                  <p className="text-xs text-muted-foreground">{overdueRate}% do total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conclusão</p>
                  <p className="text-2xl font-bold mt-1 text-green-500">{completionRate}%</p>
                  <Progress value={completionRate} className="h-1.5 mt-2 w-16" />
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Distribution Chart */}
          <Card className="row-span-1">
            <CardContent className="pt-4">
              <div className="h-[100px] flex items-center justify-center">
                {taskStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem tarefas</p>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-1">{taskMetrics.totalTasks} totais</p>
            </CardContent>
          </Card>
        </div>

        {/* Completed Tasks by Day Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Tarefas Concluídas por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              {completedByDayData.some(d => d.concluídas > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={completedByDayData}>
                    <defs>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.fullDate;
                        }
                        return label;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="concluídas" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCompleted)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa concluída no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EMPRESAS Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Empresas & Serviços</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Active Companies */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("status", "active") && "ring-2 ring-primary"
            )}
            onClick={() => handleCardClick("status", "active")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Empresas</p>
                  <p className="text-2xl font-bold mt-1">{companyMetrics.activeCompanies}</p>
                  <p className="text-xs text-muted-foreground">ativas</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Services */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("status", "active") && "ring-2 ring-emerald-500"
            )}
            onClick={() => handleCardClick("status", "active")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ativaram</p>
                  <p className="text-2xl font-bold mt-1">{projectMetrics.activeInPeriod}</p>
                  <p className="text-xs text-muted-foreground">no período ({projectMetrics.activeProjects} total)</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Churn Signaled */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("status", "cancellation_signaled") && "ring-2 ring-amber-500"
            )}
            onClick={() => handleCardClick("status", "cancellation_signaled")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sinalizaram</p>
                  <p className="text-2xl font-bold mt-1 text-amber-500">{projectMetrics.cancellationSignaledInPeriod}</p>
                  <p className="text-xs text-muted-foreground">no período ({projectMetrics.cancellationSignaled} total)</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notice Period */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("status", "notice_period") && "ring-2 ring-orange-500"
            )}
            onClick={() => handleCardClick("status", "notice_period")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aviso</p>
                  <p className="text-2xl font-bold mt-1 text-orange-500">{projectMetrics.noticePeriodInPeriod}</p>
                  <p className="text-xs text-muted-foreground">no período ({projectMetrics.noticePeriod} total)</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contracts Ending */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("contracts", "ending") && "ring-2 ring-purple-500"
            )}
            onClick={() => handleCardClick("contracts", "ending")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vencendo</p>
                  <p className="text-2xl font-bold mt-1 text-purple-500">{companyMetrics.contractsEndingInPeriod}</p>
                  <p className="text-xs text-muted-foreground">contratos</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <CalendarX className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reactivated Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("status", "reactivated") && "ring-2 ring-cyan-500"
            )}
            onClick={() => handleCardClick("status", "reactivated")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Revertidos</p>
                  <p className="text-2xl font-bold mt-1 text-cyan-500">{projectMetrics.reactivatedInPeriod}</p>
                  <p className="text-xs text-muted-foreground">no período</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-cyan-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expired Contracts Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("contracts", "expired") && "ring-2 ring-rose-500"
            )}
            onClick={() => handleCardClick("contracts", "expired")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vencidos</p>
                  <p className="text-2xl font-bold mt-1 text-rose-500">{companyMetrics.expiredContracts}</p>
                  <p className="text-xs text-muted-foreground">contratos</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <FileWarning className="h-5 w-5 text-rose-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Churn Rate Mini Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Churn</p>
                  <p className="text-2xl font-bold mt-1 text-red-500">{churnMetrics.churnRate}%</p>
                  <p className="text-xs text-muted-foreground">{churnMetrics.closedInPeriod} encerrados</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LTV - Average Lifetime Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tempo Médio</p>
                  <p className="text-2xl font-bold mt-1 text-indigo-500">{ltvMetrics.averageLifetimeMonths}</p>
                  <p className="text-xs text-muted-foreground">meses</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-indigo-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LTV - Average Value Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">LTV Médio</p>
                  <p className="text-2xl font-bold mt-1 text-teal-500">
                    {ltvMetrics.averageLTV > 0 
                      ? `R$ ${(ltvMetrics.averageLTV / 1000).toFixed(0)}k` 
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ltvMetrics.companiesWithValue || 0} com valor
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-teal-500" />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Charts Row for Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project Status Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Status dos Serviços
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[160px] flex items-center justify-center">
                {projectStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(data) => handlePieClick(data)}
                        style={{ cursor: 'pointer' }}
                      >
                        {projectStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} style={{ cursor: 'pointer' }} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => <span className="text-xs">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem serviços</p>
                )}
              </div>
              <div className="text-center mt-2">
                <p className="text-lg font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">serviços totais</p>
              </div>
            </CardContent>
          </Card>

          {/* Churn Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Churn do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={churnData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={80}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#ef4444" 
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                      onClick={(data) => handleBarClick(data)}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div 
                  className={cn(
                    "text-center p-2 bg-red-500/10 rounded-lg cursor-pointer transition-all hover:bg-red-500/20",
                    isCardActive("status", "closed") && "ring-2 ring-red-500"
                  )}
                  onClick={() => handleCardClick("status", "closed")}
                >
                  <p className="text-xl font-bold text-red-500">{churnMetrics.closedInPeriod}</p>
                  <p className="text-xs text-muted-foreground">Encerrados</p>
                </div>
                <div 
                  className={cn(
                    "text-center p-2 bg-amber-500/10 rounded-lg cursor-pointer transition-all hover:bg-amber-500/20",
                    isCardActive("status", "cancellation_signaled") && "ring-2 ring-amber-500"
                  )}
                  onClick={() => handleCardClick("status", "cancellation_signaled")}
                >
                  <p className="text-xl font-bold text-amber-500">{projectMetrics.churnSignaled}</p>
                  <p className="text-xs text-muted-foreground">Em Risco</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Churn Rate Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="h-4 w-4 text-red-500" />
              Churn Mensal ({dateRange.start.getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {monthlyChurnData.some(d => d.churn > 0 || d.total > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChurnData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Churn']}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload;
                          return `${data.fullMonth} - ${data.closed} de ${data.total} serviços`;
                        }
                        return label;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="churn" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#ef4444' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Sem dados de churn no ano</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NPS Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">NPS</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* NPS Average Card */}
          <Card className="relative overflow-hidden">
            <div className={cn(
              "absolute top-0 left-0 w-1 h-full",
              npsMetrics.averageNps === null ? "bg-gray-400" :
              npsMetrics.averageNps >= 9 ? "bg-green-500" :
              npsMetrics.averageNps >= 7 ? "bg-yellow-500" : "bg-red-500"
            )} />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NPS Médio</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    npsMetrics.averageNps === null ? "text-muted-foreground" :
                    npsMetrics.averageNps >= 9 ? "text-green-500" :
                    npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {npsMetrics.averageNps !== null ? npsMetrics.averageNps : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {npsMetrics.totalResponses} respostas
                  </p>
                </div>
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  npsMetrics.averageNps === null ? "bg-gray-400/10" :
                  npsMetrics.averageNps >= 9 ? "bg-green-500/10" :
                  npsMetrics.averageNps >= 7 ? "bg-yellow-500/10" : "bg-red-500/10"
                )}>
                  <Star className={cn(
                    "h-5 w-5",
                    npsMetrics.averageNps === null ? "text-gray-400" :
                    npsMetrics.averageNps >= 9 ? "text-green-500" :
                    npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NPS Response Rate Card */}
          <Card className="relative overflow-hidden">
            <div className={cn(
              "absolute top-0 left-0 w-1 h-full",
              npsMetrics.responseRate >= 70 ? "bg-green-500" :
              npsMetrics.responseRate >= 40 ? "bg-yellow-500" : "bg-orange-500"
            )} />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa Resposta</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    npsMetrics.responseRate >= 70 ? "text-green-500" :
                    npsMetrics.responseRate >= 40 ? "text-yellow-500" : "text-orange-500"
                  )}>
                    {npsMetrics.responseRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de {npsMetrics.totalProjects} serviços
                  </p>
                </div>
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  npsMetrics.responseRate >= 70 ? "bg-green-500/10" :
                  npsMetrics.responseRate >= 40 ? "bg-yellow-500/10" : "bg-orange-500/10"
                )}>
                  <Percent className={cn(
                    "h-5 w-5",
                    npsMetrics.responseRate >= 70 ? "text-green-500" :
                    npsMetrics.responseRate >= 40 ? "text-yellow-500" : "text-orange-500"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NPS Responded Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("nps", "responded") && "ring-2 ring-blue-500"
            )}
            onClick={() => handleCardClick("nps", "responded")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Responderam</p>
                  <p className="text-2xl font-bold mt-1 text-blue-500">
                    {npsMetrics.respondedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    serviços
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NPS Not Responded Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("nps", "not_responded") && "ring-2 ring-gray-500"
            )}
            onClick={() => handleCardClick("nps", "not_responded")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gray-400" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Não Responderam</p>
                  <p className="text-2xl font-bold mt-1 text-gray-500">
                    {npsMetrics.notRespondedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    serviços
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-400/10 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* METAS Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-teal-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Metas</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {/* Batendo Meta Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("goals", "meeting") && "ring-2 ring-teal-500"
            )}
            onClick={() => handleCardClick("goals", "meeting")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Batendo Meta</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    goalsMetrics.goalRate >= 70 ? "text-teal-500" : 
                    goalsMetrics.goalRate >= 40 ? "text-amber-500" : "text-red-500"
                  )}>
                    {goalsMetrics.goalRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {goalsMetrics.meetingGoal}/{goalsMetrics.totalWithGoals} projetos
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-teal-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projetando 100%+ Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("goals", "100plus") && "ring-2 ring-green-500"
            )}
            onClick={() => handleCardClick("goals", "100plus")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">≥100%</p>
                  <p className="text-2xl font-bold mt-1 text-green-500">
                    {goalsMetrics.meetingGoal}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    projetando
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acima de 70% Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("goals", "above70") && "ring-2 ring-blue-500"
            )}
            onClick={() => handleCardClick("goals", "above70")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">70-99%</p>
                  <p className="text-2xl font-bold mt-1 text-blue-500">
                    {goalsMetrics.above70}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    projetando
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entre 50-70% Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("goals", "between50and70") && "ring-2 ring-amber-500"
            )}
            onClick={() => handleCardClick("goals", "between50and70")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">50-69%</p>
                  <p className="text-2xl font-bold mt-1 text-amber-500">
                    {goalsMetrics.between50And70}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    projetando
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Abaixo de 50% Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("goals", "below50") && "ring-2 ring-red-500"
            )}
            onClick={() => handleCardClick("goals", "below50")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">&lt;50%</p>
                  <p className="text-2xl font-bold mt-1 text-red-500">
                    {goalsMetrics.below50}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    projetando
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sem Meta Lançada Card */}
          <Card 
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("goals", "noGoal") && "ring-2 ring-gray-500"
            )}
            onClick={() => handleCardClick("goals", "noGoal")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gray-400" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sem Meta</p>
                  <p className="text-2xl font-bold mt-1 text-gray-500">
                    {goalsMetrics.noGoalCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    projetos
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                  <FileWarning className="h-5 w-5 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tasks List Dialog */}
      <TasksListDialog
        open={tasksDialogOpen}
        onOpenChange={setTasksDialogOpen}
        type={tasksDialogType}
        taskIds={tasksDialogIds}
      />
    </div>
  );
};

export default DashboardMetrics;
