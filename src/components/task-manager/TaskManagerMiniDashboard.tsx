import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp, AlertTriangle, Clock, PlayCircle, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface Props {
  tasks: TaskWithProject[];
  staff: StaffMember[];
}

const STATUS_COLORS: Record<string, string> = {
  overdue: "hsl(0, 84%, 60%)",
  pending: "hsl(38, 92%, 50%)",
  in_progress: "hsl(217, 91%, 60%)",
  completed: "hsl(142, 71%, 45%)",
};

const STATUS_LABELS: Record<string, string> = {
  overdue: "Em Atraso",
  pending: "Pendentes",
  in_progress: "Em Progresso",
  completed: "Concluídas",
};

export function TaskManagerMiniDashboard({ tasks, staff }: Props) {
  const [expanded, setExpanded] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, pending: 0, in_progress: 0, completed: 0 };
    tasks.forEach(t => {
      if (t.status === "inactive") return;
      const isOverdue = t.due_date && new Date(t.due_date) < today && t.status !== "completed";
      if (isOverdue) {
        counts.overdue++;
      } else if (t.status in counts) {
        counts[t.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [tasks, today]);

  const total = statusCounts.overdue + statusCounts.pending + statusCounts.in_progress + statusCounts.completed;

  const companyData = useMemo(() => {
    const map = new Map<string, { pending: number; in_progress: number; overdue: number; completed: number }>();
    tasks.forEach(t => {
      if (t.status === "inactive") return;
      const name = t.company_name || "Sem empresa";
      if (!map.has(name)) map.set(name, { pending: 0, in_progress: 0, overdue: 0, completed: 0 });
      const entry = map.get(name)!;
      const isOverdue = t.due_date && new Date(t.due_date) < today && t.status !== "completed";
      if (isOverdue) entry.overdue++;
      else if (t.status === "pending") entry.pending++;
      else if (t.status === "in_progress") entry.in_progress++;
      else if (t.status === "completed") entry.completed++;
    });
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name: name.length > 25 ? name.substring(0, 22) + "..." : name,
        ...counts,
        total: counts.overdue + counts.pending + counts.in_progress + counts.completed,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [tasks, today]);

  const consultantData = useMemo(() => {
    const staffMap = new Map(staff.map(s => [s.id, s.name]));
    const map = new Map<string, { pending: number; in_progress: number; overdue: number; completed: number }>();
    tasks.forEach(t => {
      if (t.status === "inactive") return;
      const name = t.responsible_staff_id ? (staffMap.get(t.responsible_staff_id) || "Desconhecido") : "Sem responsável";
      if (!map.has(name)) map.set(name, { pending: 0, in_progress: 0, overdue: 0, completed: 0 });
      const entry = map.get(name)!;
      const isOverdue = t.due_date && new Date(t.due_date) < today && t.status !== "completed";
      if (isOverdue) entry.overdue++;
      else if (t.status === "pending") entry.pending++;
      else if (t.status === "in_progress") entry.in_progress++;
      else if (t.status === "completed") entry.completed++;
    });
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name: name.length > 18 ? name.substring(0, 15) + "..." : name,
        ...counts,
        total: counts.overdue + counts.pending + counts.in_progress + counts.completed,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [tasks, staff, today]);

  const trendData = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === "completed" && t.due_date);
    const map = new Map<string, number>();
    
    // Last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, 0);
    }

    completedTasks.forEach(t => {
      const d = new Date(t.due_date!);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    });

    return Array.from(map.entries()).map(([week, count]) => ({ week, concluídas: count }));
  }, [tasks]);

  const pieData = useMemo(() => {
    return Object.entries(statusCounts)
      .filter(([_, v]) => v > 0)
      .map(([key, value]) => ({
        name: STATUS_LABELS[key],
        value,
        color: STATUS_COLORS[key],
      }));
  }, [statusCounts]);

  const statusCards = [
    { key: "overdue", icon: AlertTriangle, color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" },
    { key: "pending", icon: Clock, color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
    { key: "in_progress", icon: PlayCircle, color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
    { key: "completed", icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-popover border rounded-lg p-2 shadow-lg text-xs">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-4">
      <Button
        variant="outline"
        size="sm"
        className="mb-3 gap-2 text-xs"
        onClick={() => setExpanded(!expanded)}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        Dashboard
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </Button>

      {expanded && (
        <div className="space-y-4 mb-4 animate-in slide-in-from-top-2 duration-200">
          {/* Status Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statusCards.map(({ key, icon: Icon, color, bgColor, borderColor }) => {
              const count = statusCounts[key as keyof typeof statusCounts];
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
              return (
                <Card key={key} className={`border ${borderColor}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{STATUS_LABELS[key]}</p>
                        <p className={`text-xl sm:text-2xl font-bold ${color}`}>{count}</p>
                        <p className="text-[10px] text-muted-foreground">{pct}% do total</p>
                      </div>
                      <div className={`${bgColor} rounded-full p-2`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Company Chart */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Tarefas por Empresa (Top 10)</h3>
                {companyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, companyData.length * 32)}>
                    <BarChart data={companyData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="overdue" name="Em Atraso" stackId="a" fill={STATUS_COLORS.overdue} radius={0} />
                      <Bar dataKey="pending" name="Pendentes" stackId="a" fill={STATUS_COLORS.pending} radius={0} />
                      <Bar dataKey="in_progress" name="Em Progresso" stackId="a" fill={STATUS_COLORS.in_progress} radius={0} />
                      <Bar dataKey="completed" name="Concluídas" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>

            {/* Consultant Chart */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Tarefas por Consultor</h3>
                {consultantData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, consultantData.length * 32)}>
                    <BarChart data={consultantData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="overdue" name="Em Atraso" stackId="a" fill={STATUS_COLORS.overdue} radius={0} />
                      <Bar dataKey="pending" name="Pendentes" stackId="a" fill={STATUS_COLORS.pending} radius={0} />
                      <Bar dataKey="in_progress" name="Em Progresso" stackId="a" fill={STATUS_COLORS.in_progress} radius={0} />
                      <Bar dataKey="completed" name="Concluídas" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>

            {/* Trend Line */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Tendência de Conclusão (últimas 8 semanas)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="concluídas"
                      name="Concluídas"
                      stroke={STATUS_COLORS.completed}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart - Distribution */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Distribuição por Status</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
