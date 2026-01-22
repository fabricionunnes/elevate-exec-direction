import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  User,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { parseDateLocal, formatDateLocal, formatDateTimeLocal } from "@/lib/dateUtils";

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

interface ClientTimelineViewProps {
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
}

export const ClientTimelineView = ({ tasks, onTaskClick }: ClientTimelineViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      // Use parseDateLocal to avoid timezone issues
      return isSameDay(parseDateLocal(task.due_date), day);
    });
  };

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

  // Group tasks by status for timeline view
  const upcomingTasks = tasks
    .filter(t => t.status !== "completed" && t.due_date)
    .sort((a, b) => parseDateLocal(a.due_date!).getTime() - parseDateLocal(b.due_date!).getTime());

  const completedTasks = tasks
    .filter(t => t.status === "completed")
    .sort((a, b) => {
      const dateA = a.completed_at ? new Date(a.completed_at) : new Date(0);
      const dateB = b.completed_at ? new Date(b.completed_at) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

  const inProgressTasks = tasks.filter(t => t.status === "in_progress");

  return (
    <div className="space-y-6">
      {/* In progress section */}
      {inProgressTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Em Andamento
          </h3>
          <div className="space-y-2">
            {inProgressTasks.map((task, index) => {
              const responsibleName = getResponsibleName(task);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onTaskClick(task)}
                  className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {task.due_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "dd 'de' MMMM", { locale: ptBR })}
                          </div>
                        )}
                        {responsibleName && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-amber-500/20">
                                {getInitials(responsibleName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {task.assignee?.role === "client" ? "Você" : responsibleName.split(" ")[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming section */}
      {upcomingTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Próximas Etapas
          </h3>
          <div className="space-y-2">
            {upcomingTasks.slice(0, 5).map((task, index) => {
              const responsibleName = getResponsibleName(task);
              const taskDueDate = task.due_date ? parseDateLocal(task.due_date) : null;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              taskDueDate?.setHours(0, 0, 0, 0);
              const isOverdue = taskDueDate && taskDueDate < today;
              const isDueToday = taskDueDate && taskDueDate.getTime() === today.getTime();
              
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onTaskClick(task)}
                  className={`
                    p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${isOverdue
                      ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
                      : isDueToday
                        ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                        : "bg-card border-border hover:border-primary/50"
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${isOverdue
                        ? "bg-red-500"
                        : isDueToday
                          ? "bg-blue-500"
                          : "bg-muted"
                      }
                    `}>
                      <Circle className={`h-4 w-4 ${isOverdue || isDueToday ? "text-white" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{task.title}</h4>
                        {isOverdue && <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>}
                        {isDueToday && <Badge className="text-[10px] bg-blue-500">Hoje</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {task.due_date && (
                          <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" />
                            {formatDateLocal(task.due_date, "dd/MM")}
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
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Concluídas ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.slice(0, 5).map((task, index) => {
              const responsibleName = getResponsibleName(task);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onTaskClick(task)}
                  className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-through text-muted-foreground">{task.title}</h4>
                      <div className="flex items-center gap-3 mt-2">
                        {task.completed_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Concluída em {formatDateTimeLocal(task.completed_at, "dd/MM")}
                          </div>
                        )}
                        {responsibleName && (
                          <span className="text-xs text-muted-foreground">
                            por {task.assignee?.role === "client" ? "Você" : responsibleName.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      {task.observations && (
                        <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                          {task.observations}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
