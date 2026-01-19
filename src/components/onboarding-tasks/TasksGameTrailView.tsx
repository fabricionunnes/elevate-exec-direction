import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  Lock,
  MapPin,
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
  { gradient: "from-blue-500 to-cyan-400", bg: "bg-blue-500", glow: "shadow-blue-500/50", border: "border-blue-400" },
  { gradient: "from-violet-500 to-purple-400", bg: "bg-violet-500", glow: "shadow-violet-500/50", border: "border-violet-400" },
  { gradient: "from-orange-500 to-amber-400", bg: "bg-orange-500", glow: "shadow-orange-500/50", border: "border-orange-400" },
  { gradient: "from-emerald-500 to-green-400", bg: "bg-emerald-500", glow: "shadow-emerald-500/50", border: "border-emerald-400" },
  { gradient: "from-rose-500 to-pink-400", bg: "bg-rose-500", glow: "shadow-rose-500/50", border: "border-rose-400" },
  { gradient: "from-cyan-500 to-teal-400", bg: "bg-cyan-500", glow: "shadow-cyan-500/50", border: "border-cyan-400" },
  { gradient: "from-fuchsia-500 to-purple-400", bg: "bg-fuchsia-500", glow: "shadow-fuchsia-500/50", border: "border-fuchsia-400" },
  { gradient: "from-yellow-500 to-amber-400", bg: "bg-yellow-500", glow: "shadow-yellow-500/50", border: "border-yellow-400" },
  { gradient: "from-indigo-500 to-blue-400", bg: "bg-indigo-500", glow: "shadow-indigo-500/50", border: "border-indigo-400" },
  { gradient: "from-red-500 to-rose-400", bg: "bg-red-500", glow: "shadow-red-500/50", border: "border-red-400" },
];

export const TasksGameTrailView = ({ phases, onTaskClick, onStatusChange }: TasksGameTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(
    phases.find(p => p.completedCount > 0 && p.completedCount < p.tasks.length)?.name || phases[0]?.name || null
  );

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const xp = completedTasks * 100;
  const level = Math.floor(xp / 500) + 1;
  const xpInCurrentLevel = xp % 500;
  const xpForNextLevel = 500 - xpInCurrentLevel;

  const isTaskOverdue = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
  };

  const isTaskDueToday = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isToday(new Date(task.due_date));
  };

  // Find the current active phase index
  const activePhaseIndex = phases.findIndex(p => p.completedCount > 0 && p.completedCount < p.tasks.length);
  const currentPhaseIndex = activePhaseIndex >= 0 ? activePhaseIndex : phases.findIndex(p => p.completedCount === 0);

  return (
    <div className="space-y-8 pb-8">
      {/* Game HUD - Top Stats Bar */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_50%)]" />
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        <div className="relative z-10 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Character/Level Display */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`
                    w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center
                    bg-gradient-to-br ${overallProgress === 100 ? "from-yellow-400 to-amber-500" : "from-blue-500 to-purple-600"}
                    shadow-2xl ${overallProgress === 100 ? "shadow-yellow-500/40" : "shadow-blue-500/40"}
                    border-2 border-white/20
                  `}
                >
                  {overallProgress === 100 ? (
                    <Crown className="h-8 w-8 md:h-10 md:w-10 text-white drop-shadow-lg" />
                  ) : (
                    <span className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">{level}</span>
                  )}
                </motion.div>
                {/* Floating badge */}
                <motion.div 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-600 text-[10px] font-bold text-white whitespace-nowrap"
                >
                  NÍVEL {level}
                </motion.div>
              </div>

              <div className="space-y-1">
                <h2 className="text-white font-bold text-lg md:text-xl">
                  {overallProgress === 100 ? "🏆 Jornada Completa!" : "Sua Jornada"}
                </h2>
                {/* XP Bar */}
                <div className="w-32 md:w-40">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>XP</span>
                    <span>{xpInCurrentLevel}/500</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(xpInCurrentLevel / 500) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-lg font-bold">{completedTasks}</span>
                </div>
                <span className="text-[10px] text-slate-500">Feitas</span>
              </div>
              
              <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-1 text-amber-400">
                  <Flame className="h-4 w-4" />
                  <span className="text-lg font-bold">{totalTasks - completedTasks}</span>
                </div>
                <span className="text-[10px] text-slate-500">Pendentes</span>
              </div>

              <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30">
                <div className="flex items-center gap-1 text-yellow-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-lg font-bold">{xp}</span>
                </div>
                <span className="text-[10px] text-yellow-500/70">XP Total</span>
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Progresso Geral
              </span>
              <span className="text-white font-bold">{overallProgress}%</span>
            </div>
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={`absolute inset-y-0 left-0 rounded-full ${
                  overallProgress === 100 
                    ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500" 
                    : "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Game Trail - Map Style */}
      <div className="relative">
        {/* Vertical Trail Line */}
        <div className="absolute left-8 md:left-12 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700 rounded-full" />
        
        {/* Animated progress line */}
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: `${overallProgress}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute left-8 md:left-12 top-0 w-1 bg-gradient-to-b from-emerald-400 via-cyan-400 to-blue-500 rounded-full z-10"
        />

        {/* Phase Nodes */}
        <div className="relative z-20 space-y-6">
          {phases.map((phase, phaseIndex) => {
            const isExpanded = expandedPhase === phase.name;
            const phaseProgress = phase.tasks.length 
              ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
              : 0;
            const isCompleted = phaseProgress === 100;
            const isActive = phaseProgress > 0 && phaseProgress < 100;
            const isLocked = phaseIndex > 0 && phases[phaseIndex - 1].completedCount < phases[phaseIndex - 1].tasks.length && phaseProgress === 0;
            const theme = PHASE_THEMES[phaseIndex % PHASE_THEMES.length];
            const PhaseIcon = PHASE_ICONS[phaseIndex % PHASE_ICONS.length];

            return (
              <motion.div
                key={phase.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: phaseIndex * 0.1 }}
                className="relative pl-20 md:pl-28"
              >
                {/* Phase Node Circle */}
                <div className="absolute left-4 md:left-8 top-4 z-30">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => !isLocked && setExpandedPhase(isExpanded ? null : phase.name)}
                    className={`
                      relative w-10 h-10 md:w-12 md:h-12 rounded-full cursor-pointer
                      flex items-center justify-center
                      transition-all duration-300
                      ${isCompleted 
                        ? "bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/50" 
                        : isActive
                        ? `bg-gradient-to-br ${theme.gradient} shadow-lg ${theme.glow} animate-pulse`
                        : isLocked
                        ? "bg-slate-700 border-2 border-slate-600"
                        : "bg-slate-700 border-2 border-slate-500 hover:border-slate-400"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    ) : isLocked ? (
                      <Lock className="h-4 w-4 md:h-5 md:w-5 text-slate-500" />
                    ) : (
                      <PhaseIcon className={`h-5 w-5 md:h-6 md:w-6 ${isActive ? "text-white" : "text-slate-400"}`} />
                    )}
                    
                    {/* Pulse ring for active */}
                    {isActive && (
                      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.gradient} animate-ping opacity-30`} />
                    )}
                  </motion.div>

                  {/* Phase number badge */}
                  <div className={`
                    absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${isCompleted 
                      ? "bg-yellow-400 text-yellow-900" 
                      : isActive
                      ? `${theme.bg} text-white`
                      : "bg-slate-600 text-slate-400"
                    }
                  `}>
                    {phaseIndex + 1}
                  </div>
                </div>

                {/* Phase Card */}
                <div 
                  onClick={() => !isLocked && setExpandedPhase(isExpanded ? null : phase.name)}
                  className={`
                    relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300
                    ${isCompleted 
                      ? "bg-gradient-to-r from-emerald-500/10 to-green-500/5 border-2 border-emerald-500/30 hover:border-emerald-500/50" 
                      : isActive
                      ? `bg-gradient-to-r from-slate-800/80 to-slate-800/40 border-2 ${theme.border}/50 hover:${theme.border}`
                      : isLocked
                      ? "bg-slate-800/30 border-2 border-slate-700/50 opacity-60"
                      : "bg-slate-800/50 border-2 border-slate-700/50 hover:border-slate-600"
                    }
                  `}
                >
                  {/* Glow effect for active */}
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-5`} />
                  )}

                  <div className="relative p-4 md:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className={`font-bold text-sm md:text-base ${isCompleted ? "text-emerald-500" : isLocked ? "text-slate-500" : "text-foreground"}`}>
                            {phase.name}
                          </h3>
                          {isActive && (
                            <Badge className={`${theme.bg} text-white text-[10px] px-1.5 py-0 animate-pulse`}>
                              <Flame className="h-2.5 w-2.5 mr-0.5" />
                              ATIVO
                            </Badge>
                          )}
                          {isCompleted && (
                            <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                              <Trophy className="h-2.5 w-2.5 mr-0.5" />
                              COMPLETO
                            </Badge>
                          )}
                          {isLocked && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-500">
                              <Lock className="h-2.5 w-2.5 mr-0.5" />
                              BLOQUEADO
                            </Badge>
                          )}
                        </div>
                        
                        {/* Phase Progress Bar */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-[180px]">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${phaseProgress}%` }}
                              transition={{ duration: 0.6 }}
                              className={`h-full rounded-full ${
                                isCompleted 
                                  ? "bg-gradient-to-r from-emerald-400 to-green-500" 
                                  : `bg-gradient-to-r ${theme.gradient}`
                              }`}
                            />
                          </div>
                          <span className={`text-xs font-medium ${isCompleted ? "text-emerald-500" : "text-slate-400"}`}>
                            {phase.completedCount}/{phase.tasks.length}
                          </span>
                        </div>
                      </div>

                      {/* XP Reward & Expand */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`
                          hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold
                          ${isCompleted 
                            ? "bg-yellow-500/20 text-yellow-500" 
                            : "bg-slate-700/50 text-slate-400"
                          }
                        `}>
                          <Sparkles className="h-3 w-3" />
                          +{phase.tasks.length * 100}
                        </div>
                        <ChevronRight 
                          className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""} ${isLocked ? "text-slate-600" : "text-slate-400"}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Tasks List */}
                  <AnimatePresence>
                    {isExpanded && !isLocked && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-700/50 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-3 md:p-4 space-y-2">
                          {phase.tasks.map((task, taskIndex) => {
                            const overdue = isTaskOverdue(task);
                            const dueToday = isTaskDueToday(task);
                            const taskCompleted = task.status === "completed";
                            const taskActive = task.status === "in_progress";
                            
                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: taskIndex * 0.05 }}
                                role="button"
                                tabIndex={0}
                                onClick={() => onTaskClick(task)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onTaskClick(task);
                                  }
                                }}
                                className={`
                                  group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                                  hover:scale-[1.01] active:scale-[0.99]
                                  ${taskCompleted
                                    ? "bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50"
                                    : taskActive
                                    ? "bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50"
                                    : overdue
                                    ? "bg-red-500/10 border border-red-500/30 hover:border-red-500/50"
                                    : dueToday
                                    ? "bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40"
                                    : "bg-slate-700/30 border border-slate-600/30 hover:border-slate-500/50"
                                  }
                                `}
                              >
                                {/* Task Status Circle */}
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
                                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                      <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                  ) : taskActive ? (
                                    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                      <Clock className="h-4 w-4 text-white animate-pulse" />
                                    </div>
                                  ) : (
                                    <div className={`w-7 h-7 rounded-full border-2 ${overdue ? "border-red-400 bg-red-500/10" : "border-slate-500"} group-hover:border-slate-400 flex items-center justify-center`}>
                                      <Circle className={`h-3 w-3 ${overdue ? "text-red-400" : "text-slate-500"}`} />
                                    </div>
                                  )}
                                </button>

                                {/* Task Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`
                                      text-sm font-medium truncate
                                      ${taskCompleted 
                                        ? "line-through text-slate-500" 
                                        : overdue 
                                        ? "text-red-400" 
                                        : "text-foreground"
                                      }
                                    `}>
                                      {task.title}
                                    </p>
                                    {task.is_internal && (
                                      <EyeOff className="h-3 w-3 text-slate-500 shrink-0" />
                                    )}
                                    {task.recurrence && (
                                      <RefreshCw className="h-3 w-3 text-blue-400 shrink-0" />
                                    )}
                                  </div>
                                  
                                  {/* Task Meta */}
                                  <div className="flex items-center gap-2 mt-1">
                                    {task.due_date && (
                                      <span className={`
                                        flex items-center gap-1 text-[10px]
                                        ${overdue ? "text-red-400" : dueToday ? "text-amber-400" : "text-slate-500"}
                                      `}>
                                        <Calendar className="h-2.5 w-2.5" />
                                        {format(new Date(task.due_date), "dd/MM")}
                                      </span>
                                    )}
                                    {task.responsible_staff?.name && (
                                      <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
                                        {task.responsible_staff.name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* XP Badge */}
                                <div className={`
                                  shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold
                                  ${taskCompleted 
                                    ? "bg-yellow-500/20 text-yellow-500" 
                                    : "bg-slate-700/50 text-slate-500"
                                  }
                                `}>
                                  +100 XP
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
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: phases.length * 0.1 + 0.2 }}
            className="relative pl-20 md:pl-28"
          >
            <div className="absolute left-4 md:left-8 top-2 z-30">
              <div className={`
                w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center
                ${overallProgress === 100 
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/50 animate-bounce" 
                  : "bg-slate-800 border-2 border-slate-700"
                }
              `}>
                <Trophy className={`h-5 w-5 md:h-6 md:w-6 ${overallProgress === 100 ? "text-white" : "text-slate-600"}`} />
              </div>
            </div>
            
            <div className={`
              p-4 rounded-2xl text-center
              ${overallProgress === 100 
                ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-2 border-yellow-500/30" 
                : "bg-slate-800/30 border-2 border-dashed border-slate-700/50"
              }
            `}>
              <p className={`text-sm font-bold ${overallProgress === 100 ? "text-yellow-500" : "text-slate-500"}`}>
                {overallProgress === 100 ? "🎉 Parabéns! Jornada Completa!" : "🏁 Chegue ao Final"}
              </p>
              {overallProgress < 100 && (
                <p className="text-[10px] text-slate-600 mt-1">
                  Complete todas as fases para desbloquear
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
