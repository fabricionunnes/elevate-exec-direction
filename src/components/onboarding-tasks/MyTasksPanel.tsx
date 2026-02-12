import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Search,
  Calendar,
  Building2,
  ExternalLink,
  CalendarDays,
  X,
  ListChecks,
} from "lucide-react";
import { format, isBefore, startOfDay, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { parseDateLocal } from "@/lib/dateUtils";

type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "overdue";
type DatePreset = "all" | "today" | "this_week" | "last_week" | "this_month" | "custom";

interface MyTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
  priority: string | null;
  project_id: string;
  company_name: string | null;
  project_name: string | null;
}

interface MyTasksPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
}

export const MyTasksPanel = ({ open, onOpenChange, staffId }: MyTasksPanelProps) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const today = startOfDay(new Date());

  useEffect(() => {
    if (open && staffId) {
      fetchMyTasks();
    }
  }, [open, staffId]);

  const fetchMyTasks = async () => {
    if (!staffId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select(`
          id, title, description, due_date, status, completed_at, priority, project_id,
          project:onboarding_projects!onboarding_tasks_project_id_fkey(
            product_name,
            onboarding_company:onboarding_companies!onboarding_projects_onboarding_company_id_fkey(name)
          )
        `)
        .eq("responsible_staff_id", staffId)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const mapped: MyTask[] = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        due_date: t.due_date,
        status: t.status,
        completed_at: t.completed_at,
        priority: t.priority,
        project_id: t.project_id,
        company_name: t.project?.onboarding_company?.name || null,
        project_name: t.project?.product_name || null,
      }));

      setTasks(mapped);
    } catch (err) {
      console.error("Error fetching my tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (task: MyTask) => {
    if (task.status === "completed" || task.completed_at) return false;
    if (!task.due_date) return false;
    return isBefore(startOfDay(parseISO(task.due_date)), today);
  };

  const getEffectiveStatus = (task: MyTask): StatusFilter => {
    if (task.status === "completed" || task.completed_at) return "completed";
    if (isOverdue(task)) return "overdue";
    if (task.status === "in_progress") return "in_progress";
    return "pending";
  };

  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { start: startOfDay(now), end: startOfDay(now) };
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "last_week": {
        const lw = subWeeks(now, 1);
        return { start: startOfWeek(lw, { weekStartsOn: 1 }), end: endOfWeek(lw, { weekStartsOn: 1 }) };
      }
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "custom":
        if (customDateFrom && customDateTo) {
          return { start: startOfDay(customDateFrom), end: startOfDay(customDateTo) };
        }
        if (customDateFrom) return { start: startOfDay(customDateFrom), end: startOfDay(customDateFrom) };
        return null;
      default:
        return null;
    }
  };

  const matchesDateFilter = (task: MyTask): boolean => {
    const range = getDateRange();
    if (!range) return true;
    if (!task.due_date) return false;
    const taskDate = startOfDay(parseDateLocal(task.due_date));
    return isWithinInterval(taskDate, { start: range.start, end: range.end });
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        search === "" ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.company_name?.toLowerCase().includes(search.toLowerCase());

      const effectiveStatus = getEffectiveStatus(task);
      const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;
      const matchesDate = matchesDateFilter(task);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [tasks, search, statusFilter, datePreset, customDateFrom, customDateTo, today]);

  const counts = useMemo(() => {
    const c = { all: tasks.length, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    tasks.forEach((task) => {
      const s = getEffectiveStatus(task);
      c[s]++;
    });
    return c;
  }, [tasks, today]);

  const filters: { value: StatusFilter; label: string; icon: React.ReactNode; activeClass: string; inactiveHover: string }[] = [
    { value: "all", label: "Todas", icon: <ListChecks className="h-3.5 w-3.5" />, activeClass: "bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/20", inactiveHover: "hover:bg-primary/10 hover:text-primary hover:border-primary/30" },
    { value: "pending", label: "À executar", icon: <Circle className="h-3.5 w-3.5" />, activeClass: "bg-blue-500 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20", inactiveHover: "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200" },
    { value: "in_progress", label: "Em andamento", icon: <Clock className="h-3.5 w-3.5" />, activeClass: "bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-500/20", inactiveHover: "hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200" },
    { value: "completed", label: "Concluídas", icon: <CheckCircle2 className="h-3.5 w-3.5" />, activeClass: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/20", inactiveHover: "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" },
    { value: "overdue", label: "Em atraso", icon: <AlertTriangle className="h-3.5 w-3.5" />, activeClass: "bg-destructive text-destructive-foreground shadow-md shadow-destructive/25 ring-2 ring-destructive/20", inactiveHover: "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" },
  ];

  const getStatusColor = (filter: typeof filters[0], active: boolean) => {
    if (active) return filter.activeClass;
    return `bg-background text-muted-foreground border border-border/60 ${filter.inactiveHover}`;
  };

  const getStatusIcon = (task: MyTask) => {
    const effective = getEffectiveStatus(task);
    switch (effective) {
      case "completed":
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />;
      case "in_progress":
        return <Clock className="h-4.5 w-4.5 text-amber-500" />;
      case "overdue":
        return <AlertTriangle className="h-4.5 w-4.5 text-destructive" />;
      default:
        return <Circle className="h-4.5 w-4.5 text-muted-foreground/60" />;
    }
  };

  const getTaskCardClass = (task: MyTask) => {
    const effective = getEffectiveStatus(task);
    switch (effective) {
      case "completed":
        return "border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-500/5 hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10";
      case "in_progress":
        return "border-l-amber-400 bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10";
      case "overdue":
        return "border-l-destructive bg-destructive/5 hover:bg-destructive/8";
      default:
        return "border-l-muted-foreground/30 bg-card hover:bg-accent/50";
    }
  };

  const handleTaskClick = (task: MyTask) => {
    onOpenChange(false);
    navigate(`/onboarding-tasks/${task.project_id}`, {
      state: { openTaskId: task.id }
    });
  };

  const progressPercent = tasks.length > 0 ? Math.round((counts.completed / tasks.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 space-y-4 border-b border-border/30 bg-gradient-to-br from-primary/5 via-background to-amber-500/5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
                <ListChecks className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                Minhas Tarefas
                {!loading && (
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                    {filteredTasks.length} {filteredTasks.length === 1 ? "tarefa" : "tarefas"} encontrada{filteredTasks.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          {!loading && tasks.length > 0 && (
            <div className="space-y-2 bg-card/80 rounded-xl p-3 border border-border/30">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {counts.completed} de {tasks.length} concluídas
                </span>
                <span className="font-bold text-emerald-600 text-sm">{progressPercent}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/80 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/30"
                />
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-background/80 border-border/60 focus-visible:ring-primary/30"
            />
          </div>

          {/* Status filter chips */}
          {/* Status filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            {filters.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusFilter(filter.value); }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold",
                  "whitespace-nowrap transition-all duration-250 flex-shrink-0",
                  getStatusColor(filter, statusFilter === filter.value)
                )}
              >
                {filter.icon}
                {filter.label}
                <span className={cn(
                  "ml-0.5 text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-lg",
                  statusFilter === filter.value ? "bg-white/25" : "bg-foreground/8"
                )}>
                  {counts[filter.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Date filter chips */}
          {/* Date filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 flex-wrap">
            {([
              { value: "all" as DatePreset, label: "Todas as datas", icon: <CalendarDays className="h-3 w-3" /> },
              { value: "today" as DatePreset, label: "Hoje", icon: <Calendar className="h-3 w-3" /> },
              { value: "this_week" as DatePreset, label: "Semana atual", icon: <Calendar className="h-3 w-3" /> },
              { value: "last_week" as DatePreset, label: "Semana anterior", icon: <Calendar className="h-3 w-3" /> },
              { value: "this_month" as DatePreset, label: "Mês atual", icon: <Calendar className="h-3 w-3" /> },
            ]).map((preset) => (
              <button
                type="button"
                key={preset.value}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDatePreset(preset.value); setCustomDateFrom(undefined); setCustomDateTo(undefined); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold",
                  "whitespace-nowrap transition-all duration-250 flex-shrink-0",
                  datePreset === preset.value
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25 ring-2 ring-violet-500/20"
                    : "bg-background text-muted-foreground border border-border/60 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200"
                )}
              >
                {preset.icon}
                {preset.label}
              </button>
            ))}

            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold",
                    "whitespace-nowrap transition-all duration-250 flex-shrink-0",
                    datePreset === "custom"
                      ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25 ring-2 ring-violet-500/20"
                      : "bg-background text-muted-foreground border border-border/60 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200"
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
                  {datePreset === "custom" && customDateFrom
                    ? `${format(customDateFrom, "dd/MM")}${customDateTo ? ` → ${format(customDateTo, "dd/MM")}` : ""}`
                    : "Período"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 rounded-xl" align="start">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-foreground">📅 De:</p>
                  <CalendarComponent
                    mode="single"
                    selected={customDateFrom}
                    onSelect={(d) => { setCustomDateFrom(d); setDatePreset("custom"); }}
                    locale={ptBR}
                    className={cn("p-1 pointer-events-auto")}
                  />
                  <p className="text-xs font-semibold text-foreground">📅 Até:</p>
                  <CalendarComponent
                    mode="single"
                    selected={customDateTo}
                    onSelect={(d) => { setCustomDateTo(d); setDatePreset("custom"); }}
                    disabled={(date) => customDateFrom ? date < customDateFrom : false}
                    locale={ptBR}
                    className={cn("p-1 pointer-events-auto")}
                  />
                  <Button
                    size="sm"
                    className="w-full text-xs rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
                    onClick={() => { setShowDatePicker(false); }}
                  >
                    Aplicar período
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {datePreset !== "all" && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDatePreset("all"); setCustomDateFrom(undefined); setCustomDateTo(undefined); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20 transition-all flex-shrink-0"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(85vh - 300px)" }}>
          {loading ? (
            <div className="space-y-2.5 px-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 flex items-center justify-center mx-auto mb-4 border border-border/30">
                <CheckCircle2 className="h-9 w-9 text-muted-foreground/30" />
              </div>
              <p className="font-bold text-foreground/70 text-base">Nenhuma tarefa encontrada</p>
              <p className="text-sm mt-1.5 text-muted-foreground/80">
                {statusFilter !== "all"
                  ? "Tente outro filtro para ver mais resultados"
                  : "Você não possui tarefas atribuídas no momento"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.25 }}
                    onClick={() => handleTaskClick(task)}
                    className={cn(
                      "group px-4 py-3.5 rounded-xl border border-border/30 border-l-[4px] cursor-pointer",
                      "transition-all duration-250 hover:shadow-md hover:-translate-y-0.5",
                      getTaskCardClass(task)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{getStatusIcon(task)}</div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-medium text-sm leading-snug",
                            getEffectiveStatus(task) === "completed"
                              ? "line-through text-muted-foreground/70"
                              : "text-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          {task.company_name && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Building2 className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[200px]">{task.company_name}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div
                              className={cn(
                                "flex items-center gap-1 text-[11px]",
                                isOverdue(task)
                                  ? "text-destructive font-semibold"
                                  : "text-muted-foreground"
                              )}
                            >
                              <Calendar className="h-3 w-3 shrink-0" />
                              {format(parseISO(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          )}
                          {task.priority === "high" && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-wider">
                              Alta
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
