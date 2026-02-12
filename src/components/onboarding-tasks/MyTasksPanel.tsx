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

  const filters: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: "Todas", icon: <ListChecks className="h-3.5 w-3.5" /> },
    { value: "pending", label: "À executar", icon: <Circle className="h-3.5 w-3.5" /> },
    { value: "in_progress", label: "Em andamento", icon: <Clock className="h-3.5 w-3.5" /> },
    { value: "completed", label: "Concluídas", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { value: "overdue", label: "Em atraso", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ];

  const getStatusColor = (value: StatusFilter, active: boolean) => {
    if (!active) return "bg-muted/60 text-muted-foreground hover:bg-muted";
    switch (value) {
      case "all": return "bg-primary text-primary-foreground shadow-sm";
      case "pending": return "bg-slate-600 text-white shadow-sm";
      case "in_progress": return "bg-amber-500 text-white shadow-sm";
      case "completed": return "bg-emerald-500 text-white shadow-sm";
      case "overdue": return "bg-destructive text-destructive-foreground shadow-sm";
    }
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 space-y-4 border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
              Minhas Tarefas
              {!loading && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({filteredTasks.length})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          {!loading && tasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{counts.completed} de {tasks.length} concluídas</span>
                <span className="font-semibold text-foreground">{progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
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
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {filters.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusFilter(filter.value); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                  "whitespace-nowrap transition-all duration-200 flex-shrink-0",
                  getStatusColor(filter.value, statusFilter === filter.value)
                )}
              >
                {filter.icon}
                {filter.label}
                <span className={cn(
                  "ml-0.5 text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full",
                  statusFilter === filter.value ? "bg-white/25" : "bg-foreground/10"
                )}>
                  {counts[filter.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Date filter chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 flex-wrap">
            {([
              { value: "all" as DatePreset, label: "Todas as datas" },
              { value: "today" as DatePreset, label: "Hoje" },
              { value: "this_week" as DatePreset, label: "Semana atual" },
              { value: "last_week" as DatePreset, label: "Semana anterior" },
              { value: "this_month" as DatePreset, label: "Mês atual" },
            ]).map((preset) => (
              <button
                type="button"
                key={preset.value}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDatePreset(preset.value); setCustomDateFrom(undefined); setCustomDateTo(undefined); }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium",
                  "whitespace-nowrap transition-all duration-200 flex-shrink-0 border",
                  datePreset === preset.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}

            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium",
                    "whitespace-nowrap transition-all duration-200 flex-shrink-0 border",
                    datePreset === "custom"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
                  {datePreset === "custom" && customDateFrom
                    ? `${format(customDateFrom, "dd/MM")}${customDateTo ? ` - ${format(customDateTo, "dd/MM")}` : ""}`
                    : "Período"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">De:</p>
                  <CalendarComponent
                    mode="single"
                    selected={customDateFrom}
                    onSelect={(d) => { setCustomDateFrom(d); setDatePreset("custom"); }}
                    locale={ptBR}
                    className={cn("p-1 pointer-events-auto")}
                  />
                  <p className="text-xs font-medium text-muted-foreground">Até:</p>
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
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => { setShowDatePicker(false); }}
                  >
                    Aplicar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {datePreset !== "all" && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDatePreset("all"); setCustomDateFrom(undefined); setCustomDateTo(undefined); }}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(85vh - 300px)" }}>
          {loading ? (
            <div className="space-y-2.5 px-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 opacity-30" />
              </div>
              <p className="font-semibold text-foreground/70">Nenhuma tarefa encontrada</p>
              <p className="text-sm mt-1.5">
                {statusFilter !== "all"
                  ? "Tente outro filtro"
                  : "Você não possui tarefas atribuídas"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence>
                {filteredTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.015, duration: 0.2 }}
                    onClick={() => handleTaskClick(task)}
                    className={cn(
                      "group px-3.5 py-3 rounded-xl border border-border/40 border-l-[3px] cursor-pointer",
                      "transition-all duration-200 hover:shadow-sm",
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
