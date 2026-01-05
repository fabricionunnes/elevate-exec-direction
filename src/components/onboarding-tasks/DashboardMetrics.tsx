import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  XCircle, 
  CalendarX,
  TrendingUp,
  ListTodo,
  Users
} from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";

interface DashboardMetricsProps {
  companies: {
    id: string;
    status: string;
    contract_end_date: string | null;
  }[];
}

interface TaskMetrics {
  todayTasks: number;
  todayCompleted: number;
  overdueTasks: number;
  totalPending: number;
  totalCompleted: number;
  totalTasks: number;
}

const DashboardMetrics = ({ companies }: DashboardMetricsProps) => {
  const [taskMetrics, setTaskMetrics] = useState<TaskMetrics>({
    todayTasks: 0,
    todayCompleted: 0,
    overdueTasks: 0,
    totalPending: 0,
    totalCompleted: 0,
    totalTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaskMetrics();
  }, []);

  const fetchTaskMetrics = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Fetch all tasks with their due dates and status
      const { data: allTasks, error } = await supabase
        .from("onboarding_tasks")
        .select("id, status, due_date");

      if (error) throw error;

      const tasks = allTasks || [];
      const todayStart = startOfDay(new Date());
      
      // Calculate metrics
      const todayTasks = tasks.filter(t => t.due_date === today).length;
      const todayCompleted = tasks.filter(t => t.due_date === today && t.status === "completed").length;
      
      const overdueTasks = tasks.filter(t => {
        if (!t.due_date || t.status === "completed") return false;
        const dueDate = new Date(t.due_date);
        return isBefore(dueDate, todayStart);
      }).length;
      
      const totalCompleted = tasks.filter(t => t.status === "completed").length;
      const totalPending = tasks.filter(t => t.status === "pending").length;
      
      setTaskMetrics({
        todayTasks,
        todayCompleted,
        overdueTasks,
        totalPending,
        totalCompleted,
        totalTasks: tasks.length,
      });
    } catch (error) {
      console.error("Error fetching task metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Company metrics
  const activeCompanies = companies.filter(c => c.status === "active").length;
  const churnSignaled = companies.filter(c => c.status === "churned" || c.status === "paused").length;
  
  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  
  const contractsEndingThisMonth = companies.filter(c => {
    if (!c.contract_end_date) return false;
    const endDate = new Date(c.contract_end_date);
    return endDate.getMonth() === thisMonth && endDate.getFullYear() === thisYear;
  }).length;

  const completionRate = taskMetrics.totalTasks > 0 
    ? Math.round((taskMetrics.totalCompleted / taskMetrics.totalTasks) * 100) 
    : 0;
  
  const overdueRate = taskMetrics.totalTasks > 0 
    ? Math.round((taskMetrics.overdueTasks / taskMetrics.totalTasks) * 100) 
    : 0;

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
      {/* Primary metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Tasks for today */}
        <Card className="border-l-4 border-l-blue-500">
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
        <Card className="border-l-4 border-l-red-500">
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
              <span className="text-xs text-muted-foreground font-medium">Taxa de Conclusão</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{completionRate}%</div>
            <Progress value={completionRate} className="h-1.5 mt-1" />
          </CardContent>
        </Card>

        {/* Active companies */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Empresas Ativas</span>
            </div>
            <div className="text-2xl font-bold">{activeCompanies}</div>
            <div className="text-xs text-muted-foreground">
              de {companies.length} total
            </div>
          </CardContent>
        </Card>

        {/* Churn signaled */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground font-medium">Sinalizaram Cancel.</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">{churnSignaled}</div>
            <div className="text-xs text-muted-foreground">
              churned ou pausado
            </div>
          </CardContent>
        </Card>

        {/* Contracts ending */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarX className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground font-medium">Contratos Vencendo</span>
            </div>
            <div className="text-2xl font-bold text-purple-500">{contractsEndingThisMonth}</div>
            <div className="text-xs text-muted-foreground">
              este mês
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Task summary card */}
        <Card className="md:col-span-2">
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
                <div className="text-xl font-bold">{taskMetrics.totalTasks}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
            <Progress 
              value={completionRate} 
              className="h-2 mt-4" 
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{completionRate}% concluído</span>
              <span>{taskMetrics.overdueTasks} em atraso</span>
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Status das Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Ativas
                </span>
                <Badge variant="secondary" className="text-green-500">
                  {activeCompanies}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  Pausadas/Churned
                </span>
                <Badge variant="secondary" className="text-amber-500">
                  {churnSignaled}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  Contratos Vencendo
                </span>
                <Badge variant="secondary" className="text-purple-500">
                  {contractsEndingThisMonth}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Total
                </span>
                <Badge variant="outline">
                  {companies.length}
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
