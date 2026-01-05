import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronDown,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  EyeOff,
  AlertCircle,
  User,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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

interface TasksListViewProps {
  phases: TaskPhase[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
  onDeleteTask?: (taskId: string) => void;
  canDelete?: boolean;
}

// Color schemes for different phases
const PHASE_COLORS = [
  { bg: "from-blue-500/10 to-blue-500/5", border: "border-l-blue-500", badge: "bg-blue-500" },
  { bg: "from-violet-500/10 to-violet-500/5", border: "border-l-violet-500", badge: "bg-violet-500" },
  { bg: "from-emerald-500/10 to-emerald-500/5", border: "border-l-emerald-500", badge: "bg-emerald-500" },
  { bg: "from-amber-500/10 to-amber-500/5", border: "border-l-amber-500", badge: "bg-amber-500" },
  { bg: "from-rose-500/10 to-rose-500/5", border: "border-l-rose-500", badge: "bg-rose-500" },
  { bg: "from-cyan-500/10 to-cyan-500/5", border: "border-l-cyan-500", badge: "bg-cyan-500" },
  { bg: "from-orange-500/10 to-orange-500/5", border: "border-l-orange-500", badge: "bg-orange-500" },
  { bg: "from-teal-500/10 to-teal-500/5", border: "border-l-teal-500", badge: "bg-teal-500" },
];

const getTaskDueStatus = (dueDate: string | null, status: string) => {
  if (status === "completed" || !dueDate) return null;
  const date = new Date(dueDate);
  if (isPast(date) && !isToday(date)) return "overdue";
  if (isToday(date)) return "today";
  return null;
};

export const TasksListView = ({ 
  phases, 
  onTaskClick, 
  onStatusChange, 
  onDeleteTask,
  canDelete = false 
}: TasksListViewProps) => {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(phases.map(p => p.name))
  );

  const togglePhase = (phaseName: string) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseName)) {
        newSet.delete(phaseName);
      } else {
        newSet.add(phaseName);
      }
      return newSet;
    });
  };

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">Progresso Geral</h3>
            <p className="text-sm text-muted-foreground">
              {completedTasks} de {totalTasks} tarefas concluídas
            </p>
          </div>
          <div className="text-3xl font-bold text-primary">{overallProgress}%</div>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </motion.div>

      {/* Phases List */}
      <div className="space-y-4">
        {phases.map((phase, phaseIndex) => {
          const isExpanded = expandedPhases.has(phase.name);
          const phaseProgress = phase.tasks.length 
            ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
            : 0;
          const isCompleted = phaseProgress === 100;
          const phaseColor = PHASE_COLORS[phaseIndex % PHASE_COLORS.length];

          return (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: phaseIndex * 0.05 }}
              className={`rounded-xl border overflow-hidden bg-card border-l-4 ${phaseColor.border}`}
            >
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.name)}
                className={`
                  w-full p-4 flex items-center justify-between text-left
                  transition-colors duration-200 bg-gradient-to-r ${phaseColor.bg}
                  ${isCompleted ? 'opacity-80' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Phase Number */}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
                    ${isCompleted 
                      ? 'bg-green-500' 
                      : phaseColor.badge
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      phaseIndex + 1
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-lg">{phase.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {phase.completedCount}/{phase.tasks.length} tarefas • {phaseProgress}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-24 hidden sm:block">
                    <Progress value={phaseProgress} className="h-2" />
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                </div>
              </button>

              {/* Tasks */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t bg-background/50"
                  >
                    <div className="p-2 space-y-2">
                      {phase.tasks.map((task, taskIndex) => {
                        const dueStatus = getTaskDueStatus(task.due_date, task.status);
                        const responsibleName = task.responsible_staff?.name || task.assignee?.name;

                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: taskIndex * 0.02 }}
                            onClick={() => onTaskClick(task)}
                            className={`
                              flex items-center gap-3 p-3 rounded-lg cursor-pointer
                              transition-all duration-200 group border
                              ${task.status === "completed" 
                                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50' 
                                : task.status === "in_progress"
                                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                                  : dueStatus === "overdue"
                                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                                    : dueStatus === "today"
                                      ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50'
                                      : 'bg-card border-border hover:border-primary/30 hover:bg-muted/30'
                              }
                            `}
                          >
                            {/* Status Button */}
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextStatus =
                                  task.status === "pending"
                                    ? "in_progress"
                                    : task.status === "in_progress"
                                      ? "completed"
                                      : "pending";
                                onStatusChange(task.id, nextStatus);
                              }}
                              className="flex-shrink-0"
                            >
                              {task.status === "completed" ? (
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                              ) : task.status === "in_progress" ? (
                                <Clock className="h-6 w-6 text-amber-600 animate-pulse" />
                              ) : dueStatus === "overdue" ? (
                                <AlertCircle className="h-6 w-6 text-red-500" />
                              ) : (
                                <Circle className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                              )}
                            </motion.button>

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium ${task.status === "completed" ? 'line-through text-muted-foreground' : ''}`}>
                                  {task.title}
                                </p>
                                {task.is_internal && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0">
                                    <EyeOff className="h-2.5 w-2.5" />
                                  </Badge>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-sm text-muted-foreground truncate mt-0.5">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Task Meta - Right side */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Priority */}
                              {task.priority === "high" && (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5">
                                  Alta
                                </Badge>
                              )}
                              {task.priority === "medium" && (
                                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] px-1.5 hidden sm:inline-flex">
                                  Média
                                </Badge>
                              )}

                              {/* Recurrence */}
                              {task.recurrence && (
                                <Badge variant="outline" className="text-[10px] gap-0.5 hidden sm:flex border-primary/30">
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  {task.recurrence}
                                </Badge>
                              )}

                              {/* Due Date */}
                              {task.due_date && (
                                <div className={`
                                  flex items-center gap-1 text-xs px-2 py-1 rounded-md
                                  ${dueStatus === "overdue" && task.status !== "completed"
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium'
                                    : dueStatus === "today" && task.status !== "completed"
                                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium'
                                      : 'bg-muted text-muted-foreground'
                                  }
                                `}>
                                  <Calendar className="h-3 w-3" />
                                  <span className="hidden sm:inline">
                                    {format(new Date(task.due_date), "dd/MM/yyyy")}
                                  </span>
                                  <span className="sm:hidden">
                                    {format(new Date(task.due_date), "dd/MM")}
                                  </span>
                                </div>
                              )}

                              {/* Responsible */}
                              {responsibleName && (
                                <div className="hidden lg:flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
                                  <User className="h-3 w-3" />
                                  <span className="max-w-[100px] truncate">{responsibleName}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            {canDelete && onDeleteTask && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteTask(task.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
