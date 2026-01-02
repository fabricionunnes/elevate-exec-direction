import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Trophy,
  Rocket,
  Target,
  Flag,
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

const PHASE_ICONS: Record<string, React.ReactNode> = {
  "Diagnóstico": <Target className="h-5 w-5" />,
  "Diagnóstico Completo": <Target className="h-5 w-5" />,
  "Mapeamento": <Target className="h-5 w-5" />,
  "Estruturação": <Rocket className="h-5 w-5" />,
  "Estruturação de Funil": <Rocket className="h-5 w-5" />,
  "Trilhas de Conhecimento": <Sparkles className="h-5 w-5" />,
  "Scripts e Processos": <Flag className="h-5 w-5" />,
  "Metas e Métricas": <Trophy className="h-5 w-5" />,
  "Metas e KPIs": <Trophy className="h-5 w-5" />,
  "Ativação": <CheckCircle2 className="h-5 w-5" />,
};

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  default: { 
    bg: "bg-primary/10", 
    border: "border-primary/30", 
    text: "text-primary",
    gradient: "from-primary/20 to-primary/5"
  },
};

export const TasksTrailView = ({ phases, onTaskClick, onStatusChange }: TasksTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(phases[0]?.name || null);

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-amber-500 animate-pulse" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/50" />;
    }
  };

  const getPhaseStatus = (phase: TaskPhase) => {
    if (phase.completedCount === phase.tasks.length) return "completed";
    if (phase.completedCount > 0) return "in_progress";
    return "pending";
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress Hero */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/20">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Jornada</h3>
                <p className="text-sm text-muted-foreground">
                  {completedTasks} de {totalTasks} tarefas concluídas
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-4xl font-bold text-primary">{overallProgress}%</span>
              <p className="text-xs text-muted-foreground">completo</p>
            </div>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </div>
      </motion.div>

      {/* Trail */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-muted" />

        <div className="space-y-4">
          {phases.map((phase, phaseIndex) => {
            const phaseStatus = getPhaseStatus(phase);
            const isExpanded = expandedPhase === phase.name;
            const phaseProgress = phase.tasks.length 
              ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
              : 0;

            return (
              <motion.div
                key={phase.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: phaseIndex * 0.1 }}
                className="relative"
              >
                {/* Phase Node */}
                <div className="flex items-start gap-4">
                  {/* Node Circle */}
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      relative z-10 flex items-center justify-center w-12 h-12 rounded-full cursor-pointer
                      transition-all duration-300 shadow-lg
                      ${phaseStatus === "completed" 
                        ? "bg-green-500 text-white shadow-green-500/30" 
                        : phaseStatus === "in_progress"
                        ? "bg-amber-500 text-white shadow-amber-500/30 animate-pulse"
                        : "bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/30"
                      }
                    `}
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                  >
                    {phaseStatus === "completed" ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      PHASE_ICONS[phase.name] || <span className="text-lg font-bold">{phaseIndex + 1}</span>
                    )}
                  </motion.div>

                  {/* Phase Card */}
                  <Card 
                    className={`
                      flex-1 cursor-pointer transition-all duration-300 overflow-hidden
                      ${isExpanded ? "ring-2 ring-primary/50" : "hover:shadow-md"}
                      ${phaseStatus === "completed" ? "bg-green-500/5" : ""}
                    `}
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-semibold text-lg">{phase.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {phase.completedCount}/{phase.tasks.length} tarefas • {phaseProgress}% concluído
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <Progress value={phaseProgress} className="h-2" />
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </div>

                      {/* Tasks */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-4 space-y-2 border-t pt-4"
                          >
                            {phase.tasks.map((task, taskIndex) => (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: taskIndex * 0.05 }}
                                className={`
                                  flex items-center gap-3 p-3 rounded-lg border
                                  transition-all duration-200 cursor-pointer
                                  ${task.status === "completed" 
                                    ? "bg-green-500/5 border-green-500/20" 
                                    : task.status === "in_progress"
                                    ? "bg-amber-500/5 border-amber-500/20"
                                    : "bg-card hover:bg-muted/50"
                                  }
                                `}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskClick(task);
                                }}
                              >
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
                                  className="flex-shrink-0"
                                >
                                  {getStatusIcon(task.status)}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {task.recurrence && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <RefreshCw className="h-3 w-3" />
                                    </Badge>
                                  )}
                                  {task.priority === "high" && (
                                    <Badge variant="destructive" className="text-xs">Alta</Badge>
                                  )}
                                  {task.due_date && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(task.due_date), "dd/MM")}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            );
          })}

          {/* Finish Line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: phases.length * 0.1 }}
            className="flex items-center gap-4"
          >
            <div className={`
              relative z-10 flex items-center justify-center w-12 h-12 rounded-full
              ${overallProgress === 100 
                ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-amber-500/30" 
                : "bg-muted border-2 border-dashed border-muted-foreground/30"
              }
            `}>
              <Trophy className={`h-6 w-6 ${overallProgress === 100 ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 p-4 rounded-lg border border-dashed">
              <p className={`font-medium ${overallProgress === 100 ? "text-amber-500" : "text-muted-foreground"}`}>
                {overallProgress === 100 ? "🎉 Onboarding Concluído!" : "Meta: Concluir Onboarding"}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
