import { useMemo, useState } from "react";
import { isTaskOverdueBrasilia } from "@/utils/brasilia-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart3, ChevronDown, ChevronUp, AlertTriangle, Clock, PlayCircle, CheckCircle2, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
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
  overdue: "hsl(0, 72%, 51%)",
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

  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, pending: 0, in_progress: 0, completed: 0 };
    tasks.forEach(t => {
      if (t.status === "inactive") return;
      const isOverdue = isTaskOverdueBrasilia(t.due_date, t.status);
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
      const isOverdue = isTaskOverdueBrasilia(t.due_date, t.status);
      if (isOverdue) entry.overdue++;
      else if (t.status === "pending") entry.pending++;
      else if (t.status === "in_progress") entry.in_progress++;
      else if (t.status === "completed") entry.completed++;
    });
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name: name.length > 30 ? name.substring(0, 27) + "..." : name,
        fullName: name,
        ...counts,
        total: counts.overdue + counts.pending + counts.in_progress + counts.completed,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tasks]);

  const consultantData = useMemo(() => {
    const staffMap = new Map(staff.map(s => [s.id, s.name]));
    const map = new Map<string, { pending: number; in_progress: number; overdue: number; completed: number }>();
    tasks.forEach(t => {
      if (t.status === "inactive") return;
      const name = t.responsible_staff_id ? (staffMap.get(t.responsible_staff_id) || "Desconhecido") : "Sem responsável";
      if (!map.has(name)) map.set(name, { pending: 0, in_progress: 0, overdue: 0, completed: 0 });
      const entry = map.get(name)!;
      const isOverdue = isTaskOverdueBrasilia(t.due_date, t.status);
      if (isOverdue) entry.overdue++;
      else if (t.status === "pending") entry.pending++;
      else if (t.status === "in_progress") entry.in_progress++;
      else if (t.status === "completed") entry.completed++;
    });
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name: name.length > 20 ? name.substring(0, 17) + "..." : name,
        fullName: name,
        ...counts,
        total: counts.overdue + counts.pending + counts.in_progress + counts.completed,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tasks, staff]);

  const trendData = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === "completed" && t.due_date);
    const map = new Map<string, number>();

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
    { key: "overdue", icon: AlertTriangle, gradient: "from-red-500/15 to-red-500/5", color: "text-red-600 dark:text-red-400", iconBg: "bg-red-500/20", border: "border-red-200 dark:border-red-500/20" },
    { key: "pending", icon: Clock, gradient: "from-amber-500/15 to-amber-500/5", color: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-500/20", border: "border-amber-200 dark:border-amber-500/20" },
    { key: "in_progress", icon: PlayCircle, gradient: "from-blue-500/15 to-blue-500/5", color: "text-blue-600 dark:text-blue-400", iconBg: "bg-blue-500/20", border: "border-blue-200 dark:border-blue-500/20" },
    { key: "completed", icon: CheckCircle2, gradient: "from-emerald-500/15 to-emerald-500/5", color: "text-emerald-600 dark:text-emerald-400", iconBg: "bg-emerald-500/20", border: "border-emerald-200 dark:border-emerald-500/20" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-xl px-3 py-2.5 shadow-xl text-xs backdrop-blur-sm">
        <p className="font-semibold text-foreground mb-1.5 text-[11px]">{label}</p>
        <div className="space-y-1">
          {payload.filter((e: any) => e.value > 0).map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-semibold text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SharedLegend = () => (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3">
      {Object.entries(STATUS_LABELS).map(([key, label]) => (
        <div key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] }} />
          {label}
        </div>
      ))}
    </div>
  );

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-xl text-xs backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.payload.color }} />
          <span className="font-medium text-foreground">{d.name}</span>
          <span className="text-muted-foreground">—</span>
          <span className="font-bold text-foreground">{d.value} ({((d.value / total) * 100).toFixed(0)}%)</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-4">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="mb-3 gap-2 text-xs hover:bg-accent"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2 data-[state=open]:fade-in-0 duration-300">
          <div className="space-y-4 mb-6">
            {/* Status Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statusCards.map(({ key, icon: Icon, gradient, color, iconBg, border }) => {
                const count = statusCounts[key as keyof typeof statusCounts];
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
                return (
                  <Card key={key} className={`border ${border} overflow-hidden relative`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
                    <CardContent className="p-4 relative">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">{STATUS_LABELS[key]}</p>
                          <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${color}`}>{count}</p>
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[key] }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">{pct}%</span>
                          </div>
                        </div>
                        <div className={`${iconBg} rounded-xl p-2.5`}>
                          <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Company Chart - Takes 2 cols */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Tarefas por Empresa
                    <span className="text-[10px] font-normal text-muted-foreground">(Top 8)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {companyData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(220, companyData.length * 36)}>
                        <BarChart data={companyData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }} />
                          <Bar dataKey="overdue" name="Em Atraso" stackId="a" fill={STATUS_COLORS.overdue} />
                          <Bar dataKey="pending" name="Pendentes" stackId="a" fill={STATUS_COLORS.pending} />
                          <Bar dataKey="in_progress" name="Em Progresso" stackId="a" fill={STATUS_COLORS.in_progress} />
                          <Bar dataKey="completed" name="Concluídas" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <SharedLegend />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Sem dados disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string) => (
                            <span className="text-[11px] text-muted-foreground">{value}</span>
                          )}
                        />
                        {/* Center label */}
                        <text x="50%" y="42%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
                          {total}
                        </text>
                        <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                          total
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Consultant Chart */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Tarefas por Consultor
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {consultantData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(220, consultantData.length * 36)}>
                        <BarChart data={consultantData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }} />
                          <Bar dataKey="overdue" name="Em Atraso" stackId="a" fill={STATUS_COLORS.overdue} />
                          <Bar dataKey="pending" name="Pendentes" stackId="a" fill={STATUS_COLORS.pending} />
                          <Bar dataKey="in_progress" name="Em Progresso" stackId="a" fill={STATUS_COLORS.in_progress} />
                          <Bar dataKey="completed" name="Concluídas" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <SharedLegend />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Trend Area Chart */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Tendência de Conclusão
                    <span className="text-[10px] font-normal text-muted-foreground">(últimas 8 semanas)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={trendData} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={STATUS_COLORS.completed} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={STATUS_COLORS.completed} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="concluídas"
                        name="Concluídas"
                        stroke={STATUS_COLORS.completed}
                        strokeWidth={2.5}
                        fill="url(#trendGradient)"
                        dot={{ r: 4, fill: STATUS_COLORS.completed, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: STATUS_COLORS.completed, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
