import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed";
  observations: string | null;
  assignee?: { id: string; name: string; role: string };
  responsible_staff?: { id: string; name: string } | null;
}

interface ClientTasksListProps {
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
}

export const ClientTasksList = ({ tasks, onTaskClick }: ClientTasksListProps) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getResponsibleName = (task: OnboardingTask) => {
    if (task.responsible_staff?.name) return task.responsible_staff.name;
    if (task.assignee?.name) return task.assignee.name;
    return null;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = search === "" || 
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase());
      
      const matchesFilter = filterStatus === null || task.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
  }, [tasks, search, filterStatus]);

  const statusCounts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
  }), [tasks]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar etapa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => setFilterStatus(null)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
            whitespace-nowrap transition-all flex-shrink-0
            ${filterStatus === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
            }
          `}
        >
          Todas ({statusCounts.all})
        </button>
        <button
          onClick={() => setFilterStatus("pending")}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
            whitespace-nowrap transition-all flex-shrink-0
            ${filterStatus === "pending"
              ? "bg-muted-foreground text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
            }
          `}
        >
          <Circle className="h-3 w-3" />
          Pendentes ({statusCounts.pending})
        </button>
        <button
          onClick={() => setFilterStatus("in_progress")}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
            whitespace-nowrap transition-all flex-shrink-0
            ${filterStatus === "in_progress"
              ? "bg-amber-500 text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
            }
          `}
        >
          <Clock className="h-3 w-3" />
          Em andamento ({statusCounts.in_progress})
        </button>
        <button
          onClick={() => setFilterStatus("completed")}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
            whitespace-nowrap transition-all flex-shrink-0
            ${filterStatus === "completed"
              ? "bg-emerald-500 text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
            }
          `}
        >
          <CheckCircle2 className="h-3 w-3" />
          Concluídas ({statusCounts.completed})
        </button>
      </div>

      {/* Tasks list */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma etapa encontrada</p>
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const responsibleName = getResponsibleName(task);
            
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onTaskClick(task)}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${task.status === "completed"
                    ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20"
                    : task.status === "in_progress"
                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
                      : "bg-card border-border hover:border-primary/50"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${task.status === "completed"
                        ? "bg-emerald-500"
                        : task.status === "in_progress"
                          ? "bg-amber-500"
                          : "bg-muted"
                      }
                    `}
                  >
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : task.status === "in_progress" ? (
                      <Clock className="h-4 w-4 text-white" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4
                      className={`font-medium text-sm ${
                        task.status === "completed" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {task.title}
                    </h4>

                    {/* Description */}
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                        </div>
                      )}

                      {responsibleName && (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary/10">
                              {getInitials(responsibleName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {task.assignee?.role === "client" ? "Você" : responsibleName.split(" ")[0]}
                          </span>
                        </div>
                      )}

                      {task.status === "in_progress" && (
                        <Badge className="text-[10px] bg-amber-500 h-5">Em andamento</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
