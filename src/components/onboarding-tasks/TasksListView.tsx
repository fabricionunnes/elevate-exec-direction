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
} from "lucide-react";
import { format } from "date-fns";
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

const PHASE_COLORS: Record<string, { bg: string; text: string; progress: string }> = {
  default: { bg: "bg-primary/10", text: "text-primary", progress: "bg-primary" },
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

          return (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: phaseIndex * 0.05 }}
              className="rounded-xl border overflow-hidden bg-card"
            >
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.name)}
                className={`
                  w-full p-4 flex items-center justify-between text-left
                  transition-colors duration-200
                  ${isCompleted ? 'bg-green-500/10' : 'hover:bg-muted/50'}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Phase Number */}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold
                    ${isCompleted 
                      ? 'bg-green-500 text-white' 
                      : phaseProgress > 0 
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
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
                    className="border-t"
                  >
                    <div className="divide-y">
                      {phase.tasks.map((task, taskIndex) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: taskIndex * 0.02 }}
                          onClick={() => onTaskClick(task)}
                          className={`
                            flex items-center gap-4 p-4 cursor-pointer
                            transition-all duration-200 group
                            ${task.status === "completed" 
                              ? 'bg-green-500/5' 
                              : task.status === "in_progress"
                                ? 'bg-amber-500/5'
                                : 'hover:bg-muted/50'
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
                              <CheckCircle2 className="h-6 w-6 text-green-500" />
                            ) : task.status === "in_progress" ? (
                              <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
                            ) : (
                              <Circle className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                          </motion.button>

                          {/* Task Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${task.status === "completed" ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Task Meta */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {task.is_internal && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <EyeOff className="h-3 w-3" />
                                <span className="hidden sm:inline">Interna</span>
                              </Badge>
                            )}
                            {task.recurrence && (
                              <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
                                <RefreshCw className="h-3 w-3" />
                                {task.recurrence}
                              </Badge>
                            )}
                            {task.priority === "high" && (
                              <Badge variant="destructive" className="text-xs">Alta</Badge>
                            )}
                            {task.priority === "medium" && (
                              <Badge variant="secondary" className="text-xs hidden sm:inline-flex">Média</Badge>
                            )}
                            {task.due_date && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                  {format(new Date(task.due_date), "dd/MM/yyyy")}
                                </span>
                                <span className="sm:hidden">
                                  {format(new Date(task.due_date), "dd/MM")}
                                </span>
                              </div>
                            )}
                            {task.responsible_staff && (
                              <Badge variant="outline" className="text-xs hidden lg:inline-flex">
                                {task.responsible_staff.name}
                              </Badge>
                            )}
                          </div>

                          {/* Actions */}
                          {canDelete && onDeleteTask && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                      ))}
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