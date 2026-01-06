import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronRight,
  RefreshCw,
  Trophy,
  Rocket,
  Target,
  Flag,
  EyeOff,
  Zap,
  BookOpen,
  Settings,
  TrendingUp,
  Play,
  AlertCircle,
} from "lucide-react";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface TasksTrailViewProps {
  phases: TaskPhase[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
}

const PHASE_ICONS: Record<string, React.ElementType> = {
  "Diagnóstico": Target,
  "Diagnóstico Completo": Target,
  "Mapeamento": Target,
  "Estruturação": Rocket,
  "Estruturação de Funil": Rocket,
  "Trilhas de Conhecimento": BookOpen,
  "Scripts e Processos": Settings,
  "Metas e Métricas": TrendingUp,
  "Metas e KPIs": TrendingUp,
  "Ativação": Play,
  "Planejamento": Flag,
  "Planejamento Estratégico": Flag,
  "Ongoing": RefreshCw,
  "Implementação": Zap,
};

const PHASE_GRADIENTS = [
  { from: "from-blue-500", to: "to-blue-600", bg: "bg-blue-500", ring: "ring-blue-500/30", text: "text-blue-600" },
  { from: "from-violet-500", to: "to-violet-600", bg: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-600" },
  { from: "from-emerald-500", to: "to-emerald-600", bg: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-600" },
  { from: "from-amber-500", to: "to-amber-600", bg: "bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-600" },
  { from: "from-rose-500", to: "to-rose-600", bg: "bg-rose-500", ring: "ring-rose-500/30", text: "text-rose-600" },
  { from: "from-cyan-500", to: "to-cyan-600", bg: "bg-cyan-500", ring: "ring-cyan-500/30", text: "text-cyan-600" },
  { from: "from-orange-500", to: "to-orange-600", bg: "bg-orange-500", ring: "ring-orange-500/30", text: "text-orange-600" },
  { from: "from-indigo-500", to: "to-indigo-600", bg: "bg-indigo-500", ring: "ring-indigo-500/30", text: "text-indigo-600" },
];

export const TasksTrailView = ({ phases, onTaskClick, onStatusChange }: TasksTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(() => {
    // Auto-expand first in-progress phase
    const inProgress = phases.find(p => p.completedCount > 0 && p.completedCount < p.tasks.length);
    if (inProgress) return inProgress.name;
    const firstIncomplete = phases.find(p => p.completedCount < p.tasks.length);
    return firstIncomplete?.name || null;
  });

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getPhaseStatus = (phase: TaskPhase) => {
    if (phase.completedCount === phase.tasks.length) return "completed";
    if (phase.completedCount > 0) return "in_progress";
    return "pending";
  };

  const isTaskOverdue = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
  };

  const isTaskDueToday = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isToday(new Date(task.due_date));
  };

  return (
    <div className="space-y-8">
      {/* Hero Progress Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-primary/10 rounded-full blur-xl" />
        
        <div className="relative flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-2xl font-bold text-primary-foreground">{overallProgress}%</span>
            </div>
            <svg className="absolute inset-0 w-20 h-20 -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-primary/20"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={226}
                strokeDashoffset={226 - (226 * overallProgress) / 100}
                className="text-primary-foreground"
                strokeLinecap="round"
              />
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">Progresso do Onboarding</h3>
            <p className="text-muted-foreground text-sm mb-3">
              {completedTasks} de {totalTasks} tarefas concluídas
            </p>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">{phases.filter(p => getPhaseStatus(p) === "completed").length} completas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">{phases.filter(p => getPhaseStatus(p) === "in_progress").length} em progresso</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline View */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-muted to-muted hidden md:block" />

        <div className="space-y-4">
          {phases.map((phase, phaseIndex) => {
            const phaseStatus = getPhaseStatus(phase);
            const isExpanded = expandedPhase === phase.name;
            const phaseProgress = phase.tasks.length 
              ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
              : 0;
            const colors = PHASE_GRADIENTS[phaseIndex % PHASE_GRADIENTS.length];
            const PhaseIcon = PHASE_ICONS[phase.name] || Flag;
            const isCompleted = phaseStatus === "completed";
            const isInProgress = phaseStatus === "in_progress";

            return (
              <div key={phase.name} className="relative">
                {/* Phase Card */}
                <div 
                  className={`
                    relative ml-0 md:ml-12 rounded-xl border transition-all duration-300 overflow-hidden
                    ${isCompleted ? "bg-green-500/5 border-green-500/30" : "bg-card hover:shadow-md"}
                    ${isExpanded ? "ring-2 ring-offset-2 " + colors.ring : ""}
                  `}
                >
                  {/* Timeline Dot - Desktop */}
                  <div className={`
                    hidden md:flex absolute -left-12 top-4 w-10 h-10 rounded-full items-center justify-center
                    transition-all duration-300 z-10
                    ${isCompleted 
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/30" 
                      : isInProgress
                      ? `bg-gradient-to-br ${colors.from} ${colors.to} text-white shadow-lg shadow-${colors.bg}/30`
                      : "bg-muted text-muted-foreground border-2 border-border"
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="font-bold text-sm">{phaseIndex + 1}</span>
                    )}
                  </div>

                  {/* Phase Header */}
                  <button
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                  >
                    {/* Mobile Phase Number */}
                    <div className={`
                      md:hidden flex items-center justify-center w-10 h-10 rounded-full shrink-0
                      ${isCompleted 
                        ? "bg-green-500 text-white" 
                        : isInProgress
                        ? `bg-gradient-to-br ${colors.from} ${colors.to} text-white`
                        : "bg-muted text-muted-foreground"
                      }
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span className="font-bold text-sm">{phaseIndex + 1}</span>
                      )}
                    </div>

                    {/* Phase Icon */}
                    <div className={`
                      hidden md:flex items-center justify-center w-10 h-10 rounded-lg shrink-0
                      ${isCompleted 
                        ? "bg-green-500/10 text-green-600" 
                        : isInProgress
                        ? `bg-gradient-to-br ${colors.from}/10 ${colors.to}/10 ${colors.text}`
                        : "bg-muted/50 text-muted-foreground"
                      }
                    `}>
                      <PhaseIcon className="h-5 w-5" />
                    </div>

                    {/* Phase Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold truncate">{phase.name}</h4>
                        {isCompleted && (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                            Completo
                          </Badge>
                        )}
                        {isInProgress && (
                          <Badge className={`${colors.text} bg-current/10 border-current/20 shrink-0`}>
                            Em andamento
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress 
                          value={phaseProgress} 
                          className={`h-1.5 flex-1 max-w-48 ${isCompleted ? "[&>div]:bg-green-500" : ""}`}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {phase.completedCount} de {phase.tasks.length}
                        </span>
                      </div>
                    </div>

                    {/* Expand Indicator */}
                    <ChevronRight className={`
                      h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0
                      ${isExpanded ? "rotate-90" : ""}
                    `} />
                  </button>

                  {/* Tasks Panel */}
                  {isExpanded && (
                    <div className="border-t">
                      <div className="p-2">
                        {phase.tasks.map((task, taskIndex) => {
                          const overdue = isTaskOverdue(task);
                          const dueToday = isTaskDueToday(task);
                          
                          return (
                            <div
                              key={task.id}
                              onClick={() => onTaskClick(task)}
                              className={`
                                group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                                transition-all duration-150
                                ${task.status === "completed" 
                                  ? "bg-muted/30 hover:bg-muted/50" 
                                  : overdue 
                                  ? "hover:bg-destructive/10 border-l-2 border-destructive"
                                  : dueToday
                                  ? "hover:bg-amber-500/10 border-l-2 border-amber-500"
                                  : "hover:bg-muted/50"
                                }
                              `}
                            >
                              {/* Status Button */}
                              <button
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
                                className="shrink-0 transition-transform hover:scale-110"
                              >
                                {task.status === "completed" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : task.status === "in_progress" ? (
                                  <Clock className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground" />
                                )}
                              </button>

                              {/* Task Content */}
                              <div className="flex-1 min-w-0">
                                <p className={`
                                  text-sm truncate
                                  ${task.status === "completed" ? "line-through text-muted-foreground" : ""}
                                  ${overdue ? "text-destructive font-medium" : ""}
                                `}>
                                  {task.title}
                                </p>
                                {task.responsible_staff?.name && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {task.responsible_staff.name}
                                  </p>
                                )}
                              </div>

                              {/* Task Meta */}
                              <div className="flex items-center gap-2 shrink-0">
                                {task.is_internal && (
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {task.recurrence && (
                                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {task.priority === "high" && (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                {task.due_date && (
                                  <span className={`
                                    text-xs flex items-center gap-1 px-2 py-0.5 rounded-full
                                    ${overdue 
                                      ? "bg-destructive/10 text-destructive" 
                                      : dueToday
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "text-muted-foreground"
                                    }
                                  `}>
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.due_date), "dd/MM")}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Finish Line */}
          <div className="relative ml-0 md:ml-12">
            {/* Trophy Dot */}
            <div className={`
              hidden md:flex absolute -left-12 top-3 w-10 h-10 rounded-full items-center justify-center
              ${overallProgress === 100 
                ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/40" 
                : "bg-muted border-2 border-dashed border-muted-foreground/30 text-muted-foreground"
              }
            `}>
              <Trophy className="h-5 w-5" />
            </div>

            <div 
              className={`
                flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-all
                ${overallProgress === 100 
                  ? "border-amber-400 bg-gradient-to-r from-amber-500/10 to-yellow-500/5" 
                  : "border-muted-foreground/20 bg-muted/20"
                }
              `}
            >
              <div className={`
                md:hidden flex items-center justify-center w-10 h-10 rounded-full
                ${overallProgress === 100 
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white" 
                  : "bg-muted text-muted-foreground"
                }
              `}>
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className={`font-semibold ${overallProgress === 100 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {overallProgress === 100 ? "🎉 Onboarding Concluído!" : "Linha de Chegada"}
                </p>
                {overallProgress < 100 && (
                  <p className="text-xs text-muted-foreground">
                    {totalTasks - completedTasks} tarefas restantes para concluir
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
