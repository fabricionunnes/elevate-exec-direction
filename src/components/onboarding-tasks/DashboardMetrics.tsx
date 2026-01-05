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
  Zap
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
  const [loading, setLoading] = useState(true);

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

    return {
      activeProjects,
      cancellationSignaled,
      noticePeriod,
      closedProjects,
      churnSignaled: cancellationSignaled + noticePeriod,
    };
  }, [projects]);

  // Company metrics
  const companyMetrics = useMemo(() => {
    const activeCompanies = companies.filter(c => c.status === "active").length;
    
    const contractsEndingInPeriod = companies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return isWithinInterval(endDate, { start: dateRange.start, end: dateRange.end });
    }).length;

    return {
      activeCompanies,
      contractsEndingInPeriod,
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
    </div>
  );
};

export default DashboardMetrics;
