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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Search,
  Calendar,
  Building2,
  ExternalLink,
} from "lucide-react";
import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "overdue";

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        search === "" ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.company_name?.toLowerCase().includes(search.toLowerCase());

      const effectiveStatus = getEffectiveStatus(task);
      const matchesFilter = statusFilter === "all" || effectiveStatus === statusFilter;

      return matchesSearch && matchesFilter;
    });
  }, [tasks, search, statusFilter, today]);

  const counts = useMemo(() => {
    const c = { all: tasks.length, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    tasks.forEach((task) => {
      const s = getEffectiveStatus(task);
      c[s]++;
    });
    return c;
  }, [tasks, today]);

  const filters: { value: StatusFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "all", label: "Todas", icon: null, color: "bg-primary" },
    { value: "pending", label: "À executar", icon: <Circle className="h-3 w-3" />, color: "bg-muted-foreground" },
    { value: "in_progress", label: "Em andamento", icon: <Clock className="h-3 w-3" />, color: "bg-amber-500" },
    { value: "completed", label: "Concluídas", icon: <CheckCircle2 className="h-3 w-3" />, color: "bg-emerald-500" },
    { value: "overdue", label: "Em atraso", icon: <AlertTriangle className="h-3 w-3" />, color: "bg-destructive" },
  ];

  const getStatusIcon = (task: MyTask) => {
    const effective = getEffectiveStatus(task);
    switch (effective) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTaskBorderClass = (task: MyTask) => {
    const effective = getEffectiveStatus(task);
    switch (effective) {
      case "completed":
        return "border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5";
      case "in_progress":
        return "border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5";
      case "overdue":
        return "border-destructive/30 bg-destructive/5";
      default:
        return "border-border hover:border-primary/50";
    }
  };

  const handleTaskClick = (task: MyTask) => {
    onOpenChange(false);
    navigate(`/onboarding-tasks/${task.project_id}`, {
      state: { openTaskId: task.id }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            📋 Minhas Tarefas
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefa ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.value}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusFilter(filter.value); }}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                whitespace-nowrap transition-all flex-shrink-0
                ${statusFilter === filter.value
                  ? `${filter.color} text-white`
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                }
              `}
            >
              {filter.icon}
              {filter.label}
              <Badge
                variant="secondary"
                className={`ml-0.5 h-5 min-w-5 px-1.5 text-[10px] ${
                  statusFilter === filter.value ? "bg-white/20 text-white" : ""
                }`}
              >
                {counts[filter.value]}
              </Badge>
            </button>
          ))}
        </div>

        {/* Tasks list */}
        <ScrollArea className="flex-1 -mx-6 px-6 min-h-0 overflow-hidden" style={{ height: "calc(85vh - 240px)" }}>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma tarefa encontrada</p>
              <p className="text-sm mt-1">
                {statusFilter !== "all"
                  ? "Tente outro filtro"
                  : "Você não possui tarefas atribuídas"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              <AnimatePresence>
                {filteredTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleTaskClick(task)}
                    className={`
                      p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${getTaskBorderClass(task)}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getStatusIcon(task)}</div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium text-sm truncate ${
                            getEffectiveStatus(task) === "completed"
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {task.company_name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {task.company_name}
                            </div>
                          )}
                          {task.due_date && (
                            <div
                              className={`flex items-center gap-1 text-xs ${
                                isOverdue(task)
                                  ? "text-destructive font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(task.due_date), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </div>
                          )}
                          {task.priority === "high" && (
                            <Badge variant="destructive" className="text-[10px] h-5">
                              Alta
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
