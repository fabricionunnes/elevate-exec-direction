import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Filter,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";
import { format, parseISO, isBefore, startOfDay, isToday, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed";
  assignee_id: string | null;
  observations: string | null;
  sort_order: number;
  priority: string | null;
  tags: string[] | null;
  recurrence: string | null;
  template_id: string | null;
  is_internal?: boolean;
  assignee?: { id: string; name: string; role: string };
  responsible_staff?: { id: string; name: string } | null;
}

interface TaskPhase {
  name: string;
  order: number;
  tasks: OnboardingTask[];
  completedCount: number;
}

interface TasksPanelViewProps {
  phases: TaskPhase[];
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
}

const CHART_COLORS = {
  completed: "hsl(var(--chart-1))",
  pending: "hsl(var(--chart-2))",
  overdue: "hsl(var(--destructive))",
  inProgress: "hsl(var(--chart-4))",
};

const PIE_COLORS = ["#a78bfa", "#86efac"];

export const TasksPanelView = ({ phases, tasks, onTaskClick }: TasksPanelViewProps) => {
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    
    const completed = tasks.filter(t => t.status === "completed").length;
    const pending = tasks.filter(t => t.status !== "completed").length;
    const overdue = tasks.filter(t => {
      if (t.status === "completed" || !t.due_date) return false;
      const dueDate = parseISO(t.due_date);
      return isBefore(startOfDay(dueDate), today) && !isToday(dueDate);
    }).length;
    const total = tasks.length;
    
    return { completed, pending, overdue, total };
  }, [tasks]);

  const tasksByPhase = useMemo(() => {
    return phases.map(phase => ({
      name: phase.name.length > 12 ? phase.name.substring(0, 10) + "..." : phase.name,
      fullName: phase.name,
      pending: phase.tasks.filter(t => t.status !== "completed").length,
      completed: phase.completedCount,
    }));
  }, [phases]);

  const statusDistribution = useMemo(() => {
    return [
      { name: "Concluídas", value: stats.completed },
      { name: "Por concluir", value: stats.pending },
    ];
  }, [stats]);

  const tasksByResponsible = useMemo(() => {
    const responsibleMap = new Map<string, { name: string; count: number }>();
    
    tasks.filter(t => t.status !== "completed").forEach(task => {
      const responsible = task.responsible_staff?.name || task.assignee?.name || "Sem responsável";
      const current = responsibleMap.get(responsible) || { name: responsible, count: 0 };
      current.count++;
      responsibleMap.set(responsible, current);
    });
    
    return Array.from(responsibleMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tasks]);

  const completionTimeline = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 9);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(day => {
      const dayStr = format(day, "dd/MM");
      const completedByDay = tasks.filter(t => {
        if (!t.completed_at) return false;
        return format(parseISO(t.completed_at), "yyyy-MM-dd") <= format(day, "yyyy-MM-dd");
      }).length;
      
      return {
        date: dayStr,
        total: tasks.length,
        completed: completedByDay,
      };
    });
  }, [tasks]);

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    filter 
  }: { 
    title: string; 
    value: number; 
    icon: React.ElementType;
    filter?: string;
  }) => (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <p className="text-4xl font-bold">{value}</p>
          {filter && (
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-muted-foreground">
              <Filter className="h-3 w-3" />
              {filter}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total de tarefas concluídas" 
          value={stats.completed} 
          icon={CheckCircle2}
          filter="1 filtro"
        />
        <StatCard 
          title="Total de tarefas por concluir" 
          value={stats.pending} 
          icon={Clock}
          filter="1 filtro"
        />
        <StatCard 
          title="Total de tarefas atrasadas" 
          value={stats.overdue} 
          icon={AlertTriangle}
          filter="1 filtro"
        />
        <StatCard 
          title="Total de tarefas" 
          value={stats.total} 
          icon={ListTodo}
          filter="Sem filtros"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Phase Bar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Total de tarefas por concluir (por seção)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByPhase} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar 
                    dataKey="pending" 
                    fill="#a78bfa" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fontSize: 10, fill: 'hsl(var(--foreground))' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                2 filtros
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7">
                Ver tudo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Total de tarefas (por status de conclusão)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ value }) => value}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    verticalAlign="middle" 
                    align="right"
                    layout="vertical"
                    iconType="circle"
                    formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-3xl font-bold">{stats.total}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                1 filtro
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7">
                Ver tudo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Responsible */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Total de tarefas futuras (por responsável)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByResponsible} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#a78bfa" 
                    radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 10, fill: 'hsl(var(--foreground))' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                2 filtros
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7">
                Ver tudo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Completion Timeline */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Conclusão de tarefas ao longo do tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={completionTimeline} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">
                        {value === "total" ? "Total" : "Concluídas"}
                      </span>
                    )}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stackId="1"
                    stroke="#6366f1" 
                    fill="#6366f1"
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completed" 
                    stackId="2"
                    stroke="#a78bfa" 
                    fill="#a78bfa"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Sem filtros
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7">
                Ver tudo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
