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
  FileWarning
} from "lucide-react";
import { format, isBefore, startOfDay, isWithinInterval } from "date-fns";
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
  Legend
} from "recharts";

interface Task {
  id: string;
  status: string;
  due_date: string | null;
  project_id: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksResult, npsResult] = await Promise.all([
        supabase.from("onboarding_tasks").select("id, status, due_date, project_id"),
        supabase.from("onboarding_nps_responses").select("project_id, score")
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (npsResult.error) throw npsResult.error;
      
      setAllTasks(tasksResult.data || []);
      setNpsResponses(npsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate task metrics
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
    const totalInProgress = allTasks.filter(t => t.status === "in_progress").length;
    
    return {
      todayTasks: todayTasksCount,
      todayCompleted,
      overdueTasks: overdueTasksCount,
      totalPending,
      totalInProgress,
      totalCompleted,
      totalTasks: allTasks.length,
    };
  }, [allTasks]);

  // Project-based metrics
  const projectMetrics = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === "active").length;
    const cancellationSignaled = projects.filter(p => p.status === "cancellation_signaled").length;
    const noticePeriod = projects.filter(p => p.status === "notice_period").length;
    const closedProjects = projects.filter(p => p.status === "closed" || p.status === "completed").length;
    
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
    };
  }, [projects, dateRange]);

  // Company metrics
  const companyMetrics = useMemo(() => {
    const today = startOfDay(new Date());
    const activeCompanies = companies.filter(c => c.status === "active").length;
    
    const contractsEndingInPeriod = companies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return isWithinInterval(endDate, { start: dateRange.start, end: dateRange.end });
    }).length;

    // Contracts that have already expired (end date is before today)
    const expiredContracts = companies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return isBefore(endDate, today);
    }).length;

    return {
      activeCompanies,
      contractsEndingInPeriod,
      expiredContracts,
    };
  }, [companies, dateRange]);

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
    { name: "Ativos", value: projectMetrics.activeProjects, color: "#22c55e" },
    { name: "Sinalizaram", value: projectMetrics.cancellationSignaled, color: "#f59e0b" },
    { name: "Aviso", value: projectMetrics.noticePeriod, color: "#f97316" },
    { name: "Encerrados", value: projectMetrics.closedProjects, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const churnData = [
    { name: "Encerrados", value: churnMetrics.closedInPeriod },
    { name: "Sinalizaram", value: churnMetrics.signaledInPeriod },
  ];

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
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("tasks", "today") && "ring-2 ring-blue-500"
            )}
            onClick={() => handleCardClick("tasks", "today")}
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
              "relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
              isCardActive("tasks", "overdue") && "ring-2 ring-red-500"
            )}
            onClick={() => handleCardClick("tasks", "overdue")}
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
              isCardActive("projects", "active") && "ring-2 ring-emerald-500"
            )}
            onClick={() => handleCardClick("projects", "active")}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardContent className="pt-4 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Serviços</p>
                  <p className="text-2xl font-bold mt-1">{projectMetrics.activeProjects}</p>
                  <p className="text-xs text-muted-foreground">ativos</p>
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
                  <p className="text-2xl font-bold mt-1 text-amber-500">{projectMetrics.cancellationSignaled}</p>
                  <p className="text-xs text-muted-foreground">serviços</p>
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
                  <p className="text-2xl font-bold mt-1 text-orange-500">{projectMetrics.noticePeriod}</p>
                  <p className="text-xs text-muted-foreground">serviços</p>
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
                      >
                        {projectStatusData.map((entry, index) => (
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
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-2 bg-red-500/10 rounded-lg">
                  <p className="text-xl font-bold text-red-500">{churnMetrics.closedInPeriod}</p>
                  <p className="text-xs text-muted-foreground">Encerrados</p>
                </div>
                <div className="text-center p-2 bg-amber-500/10 rounded-lg">
                  <p className="text-xl font-bold text-amber-500">{projectMetrics.churnSignaled}</p>
                  <p className="text-xs text-muted-foreground">Em Risco</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
};

export default DashboardMetrics;
