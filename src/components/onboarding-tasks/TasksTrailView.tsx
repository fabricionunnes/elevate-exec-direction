import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
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
} from "lucide-react";
import { format } from "date-fns";
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

const PHASE_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600" },
  { bg: "bg-violet-500", light: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-600" },
  { bg: "bg-emerald-500", light: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600" },
  { bg: "bg-amber-500", light: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600" },
  { bg: "bg-rose-500", light: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-600" },
  { bg: "bg-cyan-500", light: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-600" },
  { bg: "bg-orange-500", light: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600" },
  { bg: "bg-indigo-500", light: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-600" },
];

export const TasksTrailView = ({ phases, onTaskClick, onStatusChange }: TasksTrailViewProps) => {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => {
    // Auto-expand phases that are in progress
    const inProgress = new Set<string>();
    phases.forEach(phase => {
      if (phase.completedCount > 0 && phase.completedCount < phase.tasks.length) {
        inProgress.add(phase.name);
      }
    });
    // If none in progress, expand first incomplete phase
    if (inProgress.size === 0) {
      const firstIncomplete = phases.find(p => p.completedCount < p.tasks.length);
      if (firstIncomplete) inProgress.add(firstIncomplete.name);
    }
    return inProgress;
  });

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const togglePhase = (phaseName: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseName)) {
        next.delete(phaseName);
      } else {
        next.add(phaseName);
      }
      return next;
    });
  };

  const getPhaseStatus = (phase: TaskPhase) => {
    if (phase.completedCount === phase.tasks.length) return "completed";
    if (phase.completedCount > 0) return "in_progress";
    return "pending";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/40" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview - Compact */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border">
        <div className="p-2.5 rounded-full bg-primary/20">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold">Progresso Geral</span>
            <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {completedTasks} de {totalTasks} tarefas concluídas
          </p>
        </div>
      </div>

      {/* Phases Grid */}
      <div className="space-y-3">
        {phases.map((phase, phaseIndex) => {
          const phaseStatus = getPhaseStatus(phase);
          const isExpanded = expandedPhases.has(phase.name);
          const phaseProgress = phase.tasks.length 
            ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
            : 0;
          const colors = PHASE_COLORS[phaseIndex % PHASE_COLORS.length];
          const PhaseIcon = PHASE_ICONS[phase.name] || Flag;

          return (
            <div 
              key={phase.name} 
              className={`
                rounded-xl border overflow-hidden transition-all duration-200
                ${phaseStatus === "completed" ? "bg-green-500/5 border-green-500/20" : "bg-card"}
              `}
            >
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.name)}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
              >
                {/* Phase Number/Icon */}
                <div 
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full shrink-0
                    ${phaseStatus === "completed" 
                      ? "bg-green-500 text-white" 
                      : phaseStatus === "in_progress"
                      ? `${colors.bg} text-white`
                      : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {phaseStatus === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <PhaseIcon className="h-5 w-5" />
                  )}
                </div>

                {/* Phase Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold truncate">{phase.name}</h4>
                    <Badge 
                      variant="secondary" 
                      className={`
                        text-xs shrink-0
                        ${phaseStatus === "completed" 
                          ? "bg-green-500/10 text-green-600" 
                          : phaseStatus === "in_progress"
                          ? `${colors.light} ${colors.text}`
                          : ""
                        }
                      `}
                    >
                      {phase.completedCount}/{phase.tasks.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress 
                      value={phaseProgress} 
                      className="h-1.5 flex-1 max-w-32"
                    />
                    <span className="text-xs text-muted-foreground">{phaseProgress}%</span>
                  </div>
                </div>

                {/* Expand Button */}
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Tasks List */}
              {isExpanded && (
                <div className="border-t bg-muted/20">
                  <div className="divide-y divide-border/50">
                    {phase.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`
                          flex items-center gap-3 px-4 py-3 cursor-pointer
                          transition-colors hover:bg-muted/50
                          ${task.status === "completed" ? "opacity-60" : ""}
                        `}
                        onClick={() => onTaskClick(task)}
                      >
                        {/* Status Toggle */}
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
                          className="shrink-0 hover:scale-110 transition-transform"
                        >
                          {getStatusIcon(task.status)}
                        </button>

                        {/* Task Title */}
                        <span 
                          className={`
                            flex-1 text-sm truncate
                            ${task.status === "completed" ? "line-through text-muted-foreground" : ""}
                          `}
                        >
                          {task.title}
                        </span>

                        {/* Task Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {task.is_internal && (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {task.recurrence && (
                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {task.priority === "high" && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              !
                            </Badge>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.due_date), "dd/MM")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Finish Line */}
        <div 
          className={`
            flex items-center gap-3 p-4 rounded-xl border-2 border-dashed
            ${overallProgress === 100 
              ? "border-amber-400 bg-gradient-to-r from-amber-500/10 to-yellow-500/10" 
              : "border-muted-foreground/20"
            }
          `}
        >
          <div className={`
            flex items-center justify-center w-10 h-10 rounded-full
            ${overallProgress === 100 
              ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/30" 
              : "bg-muted text-muted-foreground"
            }
          `}>
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className={`font-semibold ${overallProgress === 100 ? "text-amber-600" : "text-muted-foreground"}`}>
              {overallProgress === 100 ? "🎉 Onboarding Concluído!" : "Concluir Onboarding"}
            </p>
            {overallProgress < 100 && (
              <p className="text-xs text-muted-foreground">
                Faltam {totalTasks - completedTasks} tarefas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
