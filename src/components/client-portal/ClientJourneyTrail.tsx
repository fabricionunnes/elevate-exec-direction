import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronDown,
  User,
  Sparkles,
  Trophy,
  Rocket,
  Target,
  Flag,
  Star,
  Zap,
  Crown,
  Medal,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface TaskPhase {
  name: string;
  order: number;
  tasks: OnboardingTask[];
  completedCount: number;
}

interface ClientJourneyTrailProps {
  phases: TaskPhase[];
  onTaskClick: (task: OnboardingTask) => void;
}

const PHASE_ICONS = [
  <Rocket className="h-5 w-5" />,
  <Target className="h-5 w-5" />,
  <Zap className="h-5 w-5" />,
  <Flag className="h-5 w-5" />,
  <Star className="h-5 w-5" />,
  <Medal className="h-5 w-5" />,
  <Crown className="h-5 w-5" />,
  <Sparkles className="h-5 w-5" />,
];

const PHASE_GRADIENTS = [
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-green-600",
  "from-rose-500 to-pink-600",
  "from-teal-500 to-cyan-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
];

export const ClientJourneyTrail = ({ phases, onTaskClick }: ClientJourneyTrailProps) => {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(
    phases.findIndex(p => p.completedCount > 0 && p.completedCount < p.tasks.length) !== -1
      ? phases.findIndex(p => p.completedCount > 0 && p.completedCount < p.tasks.length)
      : 0
  );

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "cs": return "Customer Success";
      case "consultant": return "Consultor";
      case "client": return "Você";
      case "admin": return "Administrador";
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Progress - Mobile optimized */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-5 text-primary-foreground"
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-full"
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="p-3 rounded-xl bg-white/20 backdrop-blur-sm"
            >
              <MapPin className="h-6 w-6" />
            </motion.div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Sua Jornada</h2>
              <p className="text-sm opacity-80">
                {completedTasks} de {totalTasks} etapas concluídas
              </p>
            </div>
            <motion.div
              key={overallProgress}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-3xl font-black"
            >
              {overallProgress}%
            </motion.div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-black/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-white/90 to-white rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Trail phases */}
      <div className="relative pl-6">
        {/* Vertical connecting line */}
        <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-muted" />

        <div className="space-y-4">
          {phases.map((phase, phaseIndex) => {
            const isExpanded = expandedPhase === phaseIndex;
            const phaseProgress = phase.tasks.length
              ? Math.round((phase.completedCount / phase.tasks.length) * 100)
              : 0;
            const isCompleted = phaseProgress === 100;
            const isActive = phaseProgress > 0 && phaseProgress < 100;
            const gradient = PHASE_GRADIENTS[phaseIndex % PHASE_GRADIENTS.length];
            const icon = PHASE_ICONS[phaseIndex % PHASE_ICONS.length];

            return (
              <motion.div
                key={phase.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: phaseIndex * 0.1 }}
                className="relative"
              >
                {/* Phase node */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className={`
                    absolute -left-6 top-4 w-6 h-6 rounded-full flex items-center justify-center z-10
                    ${isCompleted
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? `bg-gradient-to-br ${gradient} text-white animate-pulse`
                        : "bg-muted border-2 border-dashed border-muted-foreground/30"
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-bold">{phaseIndex + 1}</span>
                  )}
                </motion.div>

                {/* Phase card */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className={`
                    ml-4 rounded-xl overflow-hidden border-2 transition-all duration-300
                    ${isExpanded
                      ? isCompleted
                        ? "border-emerald-400/50 shadow-lg"
                        : isActive
                          ? "border-primary/50 shadow-lg"
                          : "border-border"
                      : "border-border"
                    }
                    ${isCompleted ? "bg-emerald-500/5" : "bg-card"}
                  `}
                  onClick={() => setExpandedPhase(isExpanded ? null : phaseIndex)}
                >
                  {/* Phase header */}
                  <div className="p-4 flex items-center gap-3">
                    <div
                      className={`
                        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                        ${isCompleted
                          ? "bg-emerald-500 text-white"
                          : isActive
                            ? `bg-gradient-to-br ${gradient} text-white`
                            : "bg-muted text-muted-foreground"
                        }
                      `}
                    >
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{phase.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{phase.completedCount}/{phase.tasks.length}</span>
                        {isActive && (
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                            Em andamento
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="text-xs bg-emerald-500">Concluído</Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress ring */}
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="hsl(var(--muted))"
                          strokeWidth="3"
                        />
                        <motion.circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke={isCompleted ? "#10b981" : "hsl(var(--primary))"}
                          strokeWidth="3"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: "0 100" }}
                          animate={{ strokeDasharray: `${phaseProgress} 100` }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                        {phaseProgress}%
                      </span>
                    </div>

                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      className="flex-shrink-0"
                    >
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                  </div>

                  {/* Tasks list */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t"
                      >
                        <div className="p-3 space-y-2">
                          {phase.tasks.map((task, taskIndex) => {
                            const responsibleName = getResponsibleName(task);

                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: taskIndex * 0.05 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskClick(task);
                                }}
                                className={`
                                  p-3 rounded-lg border transition-all duration-200
                                  ${task.status === "completed"
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                                    : task.status === "in_progress"
                                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
                                      : "bg-background border-border hover:border-primary/50"
                                  }
                                `}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Status icon */}
                                  <div className="flex-shrink-0 mt-0.5">
                                    {task.status === "completed" ? (
                                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    ) : task.status === "in_progress" ? (
                                      <Clock className="h-5 w-5 text-amber-500" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    {/* Task title */}
                                    <h4
                                      className={`font-medium text-sm leading-tight ${
                                        task.status === "completed" ? "line-through text-muted-foreground" : ""
                                      }`}
                                    >
                                      {task.title}
                                    </h4>

                                    {/* Task description */}
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}

                                    {/* Task meta */}
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      {task.due_date && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Calendar className="h-3 w-3" />
                                          <span>
                                            {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                                          </span>
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

                                      {task.status === "completed" && task.completed_at && (
                                        <Badge variant="outline" className="text-[10px] h-5">
                                          ✓ {format(new Date(task.completed_at), "dd/MM", { locale: ptBR })}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Observations */}
                                    {task.observations && task.status === "completed" && (
                                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                                        <span className="font-medium">Resultado: </span>
                                        {task.observations}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}

          {/* Finish line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: phases.length * 0.1 }}
            className="relative ml-4"
          >
            <div
              className={`
                absolute -left-10 top-2 w-6 h-6 rounded-full flex items-center justify-center
                ${overallProgress === 100
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-amber-500/30"
                  : "bg-muted border-2 border-dashed border-muted-foreground/30"
                }
              `}
            >
              <Trophy className={`h-4 w-4 ${overallProgress === 100 ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <div className="p-4 rounded-lg border-2 border-dashed">
              <p className={`text-sm font-medium ${overallProgress === 100 ? "text-amber-600" : "text-muted-foreground"}`}>
                {overallProgress === 100 ? "🎉 Jornada Concluída!" : "Meta: Completar a Jornada"}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
