import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronDown,
  RefreshCw,
  Trophy,
  Rocket,
  Target,
  Flag,
  Star,
  Zap,
  Crown,
  Medal,
  Gift,
  EyeOff,
  Sparkles,
  Flame,
  Shield,
  Gem,
} from "lucide-react";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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

interface TasksGameTrailViewProps {
  phases: TaskPhase[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
}

const PHASE_ICONS = [Rocket, Target, Zap, Flag, Star, Medal, Crown, Gift, Shield, Gem];

const PHASE_THEMES = [
  { gradient: "from-blue-500 to-cyan-400", ring: "ring-blue-400", shadow: "shadow-blue-500/30", bg: "bg-blue-500", text: "text-blue-500" },
  { gradient: "from-violet-500 to-purple-400", ring: "ring-violet-400", shadow: "shadow-violet-500/30", bg: "bg-violet-500", text: "text-violet-500" },
  { gradient: "from-orange-500 to-amber-400", ring: "ring-orange-400", shadow: "shadow-orange-500/30", bg: "bg-orange-500", text: "text-orange-500" },
  { gradient: "from-emerald-500 to-green-400", ring: "ring-emerald-400", shadow: "shadow-emerald-500/30", bg: "bg-emerald-500", text: "text-emerald-500" },
  { gradient: "from-rose-500 to-pink-400", ring: "ring-rose-400", shadow: "shadow-rose-500/30", bg: "bg-rose-500", text: "text-rose-500" },
  { gradient: "from-cyan-500 to-teal-400", ring: "ring-cyan-400", shadow: "shadow-cyan-500/30", bg: "bg-cyan-500", text: "text-cyan-500" },
  { gradient: "from-fuchsia-500 to-purple-400", ring: "ring-fuchsia-400", shadow: "shadow-fuchsia-500/30", bg: "bg-fuchsia-500", text: "text-fuchsia-500" },
  { gradient: "from-yellow-500 to-amber-400", ring: "ring-yellow-400", shadow: "shadow-yellow-500/30", bg: "bg-yellow-500", text: "text-yellow-500" },
  { gradient: "from-indigo-500 to-blue-400", ring: "ring-indigo-400", shadow: "shadow-indigo-500/30", bg: "bg-indigo-500", text: "text-indigo-500" },
  { gradient: "from-red-500 to-rose-400", ring: "ring-red-400", shadow: "shadow-red-500/30", bg: "bg-red-500", text: "text-red-500" },
];

export const TasksGameTrailView = ({ phases, onTaskClick, onStatusChange }: TasksGameTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const xp = completedTasks * 100;
  const level = Math.floor(xp / 500) + 1;
  const xpForNextLevel = (level * 500) - xp;

  const isTaskOverdue = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
  };

  const isTaskDueToday = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isToday(new Date(task.due_date));
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Banner - Game Style */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 border border-slate-700/50">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-2xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>

        <div className="relative z-10">
          {/* Top Row: Level Badge & Stats */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
            {/* Level & XP */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${overallProgress === 100 ? "from-yellow-400 to-amber-500" : "from-blue-500 to-purple-600"} flex items-center justify-center shadow-2xl ${overallProgress === 100 ? "shadow-yellow-500/30" : "shadow-blue-500/30"}`}>
                  {overallProgress === 100 ? (
                    <Crown className="h-10 w-10 text-white" />
                  ) : (
                    <span className="text-3xl font-black text-white">{level}</span>
                  )}
                </div>
                {/* Level badge */}
                <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-xs font-bold text-white">
                  LVL
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Nível do Projeto</p>
                <p className="text-white text-2xl font-black">
                  {overallProgress === 100 ? "CAMPEÃO" : `Nível ${level}`}
                </p>
                <p className="text-slate-500 text-xs">
                  {overallProgress === 100 ? "Missão completa!" : `${xpForNextLevel} XP para próximo nível`}
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-3">
              <div className="px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-center min-w-[80px]">
                <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <p className="text-white text-xl font-bold">{completedTasks}</p>
                <p className="text-slate-500 text-xs">Completas</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-center min-w-[80px]">
                <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                  <Flame className="h-4 w-4" />
                </div>
                <p className="text-white text-xl font-bold">{totalTasks - completedTasks}</p>
                <p className="text-slate-500 text-xs">Restantes</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 text-center min-w-[80px]">
                <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-yellow-400 text-xl font-bold">{xp}</p>
                <p className="text-yellow-500/70 text-xs">XP Total</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Progresso da Jornada</span>
              <span className="text-white font-bold">{overallProgress}%</span>
            </div>
            <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`absolute inset-y-0 left-0 rounded-full ${
                  overallProgress === 100 
                    ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500" 
                    : "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                }`}
              />
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: "200% 100%" }} />
            </div>
            {/* Milestone markers */}
            <div className="absolute left-0 right-0 top-[calc(100%-8px)] flex justify-between px-0.5 pointer-events-none">
              {[25, 50, 75, 100].map((milestone) => (
                <div 
                  key={milestone} 
                  className={`w-3 h-3 rounded-full border-2 ${
                    overallProgress >= milestone 
                      ? "bg-white border-white shadow-lg shadow-white/30" 
                      : "bg-slate-700 border-slate-600"
                  }`}
                  style={{ marginLeft: milestone === 25 ? "23%" : milestone === 50 ? "24%" : milestone === 75 ? "23%" : "auto" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Phases Trail */}
      <div className="relative space-y-4">
        {phases.map((phase, phaseIndex) => {
          const isExpanded = expandedPhase === phase.name;
          const phaseProgress = phase.tasks.length 
            ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
            : 0;
          const isCompleted = phaseProgress === 100;
          const isActive = phaseProgress > 0 && phaseProgress < 100;
          const theme = PHASE_THEMES[phaseIndex % PHASE_THEMES.length];
          const PhaseIcon = PHASE_ICONS[phaseIndex % PHASE_ICONS.length];

          return (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: phaseIndex * 0.05 }}
            >
              <div 
                className={`
                  relative overflow-hidden rounded-2xl border-2 transition-all duration-300
                  ${isCompleted 
                    ? "bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/50" 
                    : isActive
                    ? `bg-card border-2 ${theme.ring.replace("ring", "border")}/50`
                    : "bg-card/50 border-border hover:border-border/80"
                  }
                `}
              >
                {/* Active phase glow */}
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-5`} />
                )}

                {/* Phase Header - clickable to expand/collapse */}
                <div 
                  className="relative p-4 md:p-5 cursor-pointer"
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                >
                  <div className="flex items-center gap-4">
                    {/* Phase Icon Badge */}
                    <div className="relative">
                      <div 
                        className={`
                          w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center transition-all
                          ${isCompleted 
                            ? "bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/30" 
                            : isActive
                            ? `bg-gradient-to-br ${theme.gradient} shadow-lg ${theme.shadow}`
                            : "bg-muted"
                          }
                        `}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-7 w-7 md:h-8 md:w-8 text-white" />
                        ) : (
                          <PhaseIcon className={`h-7 w-7 md:h-8 md:w-8 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                        )}
                      </div>
                      {/* Phase number */}
                      <div className={`
                        absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                        ${isCompleted 
                          ? "bg-yellow-400 text-yellow-900" 
                          : isActive
                          ? `${theme.bg} text-white`
                          : "bg-muted-foreground/20 text-muted-foreground"
                        }
                      `}>
                        {phaseIndex + 1}
                      </div>
                    </div>

                    {/* Phase Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className={`font-bold text-base md:text-lg truncate ${isCompleted ? "text-emerald-600" : ""}`}>
                          {phase.name}
                        </h3>
                        {isActive && (
                          <Badge className={`${theme.bg} text-white text-xs px-2 py-0`}>
                            <Flame className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="bg-emerald-500 text-white text-xs px-2 py-0">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Completo
                          </Badge>
                        )}
                      </div>
                      
                      {/* Mini Progress */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[200px]">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${phaseProgress}%` }}
                            transition={{ duration: 0.5 }}
                            className={`h-full rounded-full ${
                              isCompleted 
                                ? "bg-gradient-to-r from-emerald-400 to-green-500" 
                                : `bg-gradient-to-r ${theme.gradient}`
                            }`}
                          />
                        </div>
                        <span className={`text-sm font-medium ${isCompleted ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {phase.completedCount}/{phase.tasks.length}
                        </span>
                      </div>
                    </div>

                    {/* XP Badge & Chevron */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`
                        hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold
                        ${isCompleted 
                          ? "bg-yellow-500/20 text-yellow-600" 
                          : "bg-muted text-muted-foreground"
                        }
                      `}>
                        <Sparkles className="h-4 w-4" />
                        +{phase.tasks.length * 100} XP
                      </div>
                      <ChevronDown 
                        className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Tasks */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="p-3 md:p-4 grid gap-2">
                        {phase.tasks.map((task, taskIndex) => {
                          const overdue = isTaskOverdue(task);
                          const dueToday = isTaskDueToday(task);
                          const taskCompleted = task.status === "completed";
                          const taskActive = task.status === "in_progress";
                          
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: taskIndex * 0.02 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(task);
                              }}
                              className={`
                                group flex items-center gap-3 p-3 md:p-4 rounded-xl cursor-pointer transition-all
                                ${taskCompleted
                                  ? "bg-emerald-500/5 border border-emerald-500/20"
                                  : taskActive
                                  ? "bg-amber-500/5 border border-amber-500/30"
                                  : overdue
                                  ? "bg-red-500/5 border border-red-500/30 hover:bg-red-500/10"
                                  : dueToday
                                  ? "bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10"
                                  : "bg-muted/30 border border-transparent hover:bg-muted/50 hover:border-border"
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
                                {taskCompleted ? (
                                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <CheckCircle2 className="h-5 w-5 text-white" />
                                  </div>
                                ) : taskActive ? (
                                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
                                    <Clock className="h-5 w-5 text-white" />
                                  </div>
                                ) : (
                                  <div className={`w-8 h-8 rounded-full border-2 ${overdue ? "border-red-400" : "border-muted-foreground/30"} group-hover:border-muted-foreground/50 flex items-center justify-center`}>
                                    <Circle className={`h-4 w-4 ${overdue ? "text-red-400" : "text-muted-foreground/30"}`} />
                                  </div>
                                )}
                              </button>

                              {/* Task Content */}
                              <div className="flex-1 min-w-0">
                                <p className={`
                                  text-sm font-medium truncate
                                  ${taskCompleted 
                                    ? "line-through text-muted-foreground" 
                                    : overdue 
                                    ? "text-red-600" 
                                    : ""
                                  }
                                `}>
                                  {task.title}
                                </p>
                              </div>

                              {/* Task Meta */}
                              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                {task.is_internal && (
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {task.recurrence && (
                                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {task.priority === "high" && !taskCompleted && (
                                  <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">!</Badge>
                                )}
                                {task.due_date && (
                                  <span className={`
                                    text-xs flex items-center gap-1 px-2 py-0.5 rounded-full font-medium
                                    ${taskCompleted
                                      ? "bg-muted text-muted-foreground"
                                      : overdue 
                                      ? "bg-red-500/20 text-red-600" 
                                      : dueToday
                                      ? "bg-amber-500/20 text-amber-600"
                                      : "bg-muted text-muted-foreground"
                                    }
                                  `}>
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.due_date), "dd/MM")}
                                  </span>
                                )}
                                {taskCompleted && (
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20">
                                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                    <span className="text-xs font-bold text-yellow-600">+100</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}

        {/* Final Trophy */}
        <motion.div 
          className="flex justify-center pt-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: phases.length * 0.05 }}
        >
          <div className={`
            relative p-6 rounded-2xl border-2 border-dashed transition-all
            ${overallProgress === 100 
              ? "border-yellow-400 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-orange-500/5" 
              : "border-muted-foreground/20 bg-muted/5"
            }
          `}>
            {overallProgress === 100 && (
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl animate-pulse" />
              </div>
            )}
            <div className="relative flex items-center gap-4">
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center
                ${overallProgress === 100 
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl shadow-amber-500/40" 
                  : "bg-muted"
                }
              `}>
                <Trophy className={`h-8 w-8 ${overallProgress === 100 ? "text-white" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className={`font-bold text-lg ${overallProgress === 100 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {overallProgress === 100 ? "🏆 Missão Cumprida!" : "Linha de Chegada"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {overallProgress === 100 
                    ? `${xp} XP conquistados!`
                    : `${totalTasks - completedTasks} conquistas restantes`
                  }
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
