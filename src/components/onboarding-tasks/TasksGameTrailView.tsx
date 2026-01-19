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
  Play,
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

const PHASE_COLORS = [
  { bg: "from-blue-500 to-blue-600", light: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400", shadow: "shadow-blue-500/30" },
  { bg: "from-purple-500 to-purple-600", light: "bg-purple-500/20", border: "border-purple-500/50", text: "text-purple-400", shadow: "shadow-purple-500/30" },
  { bg: "from-orange-500 to-orange-600", light: "bg-orange-500/20", border: "border-orange-500/50", text: "text-orange-400", shadow: "shadow-orange-500/30" },
  { bg: "from-emerald-500 to-emerald-600", light: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-400", shadow: "shadow-emerald-500/30" },
  { bg: "from-pink-500 to-pink-600", light: "bg-pink-500/20", border: "border-pink-500/50", text: "text-pink-400", shadow: "shadow-pink-500/30" },
  { bg: "from-cyan-500 to-cyan-600", light: "bg-cyan-500/20", border: "border-cyan-500/50", text: "text-cyan-400", shadow: "shadow-cyan-500/30" },
  { bg: "from-amber-500 to-amber-600", light: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-400", shadow: "shadow-amber-500/30" },
  { bg: "from-indigo-500 to-indigo-600", light: "bg-indigo-500/20", border: "border-indigo-500/50", text: "text-indigo-400", shadow: "shadow-indigo-500/30" },
  { bg: "from-rose-500 to-rose-600", light: "bg-rose-500/20", border: "border-rose-500/50", text: "text-rose-400", shadow: "shadow-rose-500/30" },
  { bg: "from-teal-500 to-teal-600", light: "bg-teal-500/20", border: "border-teal-500/50", text: "text-teal-400", shadow: "shadow-teal-500/30" },
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

  const isTaskOverdue = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
  };

  const isTaskDueToday = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isToday(new Date(task.due_date));
  };

  return (
    <div className="pb-8">
      {/* Hero Stats */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-6">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-4 left-4 w-20 h-20 rounded-full bg-yellow-400 blur-3xl" />
          <div className="absolute bottom-4 right-4 w-32 h-32 rounded-full bg-purple-500 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-40 h-40 rounded-full bg-blue-500 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>
        
        {/* Stars decoration */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: Math.random() * 0.5 + 0.2,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Level Badge */}
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="relative"
              >
                <div className={`
                  w-24 h-24 rounded-2xl flex flex-col items-center justify-center
                  ${overallProgress === 100 
                    ? "bg-gradient-to-br from-yellow-400 to-amber-500" 
                    : "bg-gradient-to-br from-indigo-500 to-purple-600"
                  }
                  shadow-2xl border-4 border-white/20
                `}>
                  {overallProgress === 100 ? (
                    <Crown className="h-10 w-10 text-white mb-1" />
                  ) : (
                    <span className="text-4xl font-black text-white">{level}</span>
                  )}
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
                    {overallProgress === 100 ? "Champion" : "Level"}
                  </span>
                </div>
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-2xl ${overallProgress === 100 ? "bg-yellow-400" : "bg-purple-500"} blur-xl opacity-40 -z-10`} />
              </motion.div>

              <div className="text-left">
                <h2 className="text-2xl font-black text-white mb-1">
                  {overallProgress === 100 ? "🏆 Missão Completa!" : "Sua Jornada"}
                </h2>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold">{xp} XP</span>
                </div>
                {/* XP Bar */}
                <div className="w-40">
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(xpInCurrentLevel / 500) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full relative"
                    >
                      <div className="absolute inset-0 bg-white/30 animate-pulse" />
                    </motion.div>
                  </div>
                  <p className="text-[10px] text-white/50 mt-1">{500 - xpInCurrentLevel} XP para o próximo nível</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10"
              >
                <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-white">{completedTasks}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">Concluídas</p>
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10"
              >
                <Flame className="h-6 w-6 text-orange-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-white">{totalTasks - completedTasks}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">Pendentes</p>
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center px-5 py-3 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 backdrop-blur-sm border border-yellow-500/30"
              >
                <Trophy className="h-6 w-6 text-yellow-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-yellow-400">{overallProgress}%</p>
                <p className="text-[10px] text-yellow-400/60 uppercase tracking-wider">Progresso</p>
              </motion.div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="h-4 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className={`h-full rounded-full relative ${
                  overallProgress === 100 
                    ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500" 
                    : "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                }`}
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2s_infinite]" style={{ backgroundSize: "200% 100%" }} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Trail - Winding Path Style */}
      <div className="relative">
        {phases.map((phase, phaseIndex) => {
          const isExpanded = expandedPhase === phase.name;
          const phaseProgress = phase.tasks.length 
            ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
            : 0;
          const isCompleted = phaseProgress === 100;
          const isActive = phaseProgress > 0 && phaseProgress < 100;
          const isPending = phaseProgress === 0;
          const color = PHASE_COLORS[phaseIndex % PHASE_COLORS.length];
          const PhaseIcon = PHASE_ICONS[phaseIndex % PHASE_ICONS.length];
          const isEven = phaseIndex % 2 === 0;

          return (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, x: isEven ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: phaseIndex * 0.1, type: "spring" }}
              className="relative"
            >
              {/* Connecting Path */}
              {phaseIndex < phases.length - 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full h-12 w-1 z-0">
                  <div className={`w-full h-full rounded-full ${isCompleted ? "bg-gradient-to-b from-emerald-400 to-emerald-500" : "bg-slate-700"}`} />
                  {isCompleted && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "100%" }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="absolute inset-x-0 top-0 bg-gradient-to-b from-emerald-400 to-emerald-500 rounded-full"
                    />
                  )}
                </div>
              )}

              {/* Phase Card */}
              <div className={`
                relative mb-12 mx-auto max-w-2xl
                ${isEven ? "md:mr-auto md:ml-0" : "md:ml-auto md:mr-0"}
              `}>
                {/* Main Phase Node */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                  className={`
                    relative cursor-pointer rounded-3xl overflow-hidden
                    transition-all duration-300
                    ${isCompleted 
                      ? "bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20" 
                      : isActive
                      ? `bg-gradient-to-br from-slate-800 to-slate-900 border-2 ${color.border} shadow-lg ${color.shadow}`
                      : "bg-slate-800/50 border-2 border-slate-700/50 hover:border-slate-600"
                    }
                  `}
                >
                  {/* Glow for active */}
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${color.bg} opacity-10`} />
                  )}

                  <div className="relative p-5">
                    <div className="flex items-center gap-4">
                      {/* Phase Icon */}
                      <div className="relative">
                        <motion.div
                          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className={`
                            w-16 h-16 rounded-2xl flex items-center justify-center
                            ${isCompleted 
                              ? "bg-gradient-to-br from-emerald-400 to-green-500" 
                              : isActive
                              ? `bg-gradient-to-br ${color.bg}`
                              : "bg-slate-700"
                            }
                            shadow-xl
                          `}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-8 w-8 text-white" />
                          ) : (
                            <PhaseIcon className={`h-8 w-8 ${isActive ? "text-white" : "text-slate-400"}`} />
                          )}
                        </motion.div>
                        
                        {/* Phase Number */}
                        <div className={`
                          absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center
                          text-xs font-black border-2 border-slate-900
                          ${isCompleted 
                            ? "bg-yellow-400 text-yellow-900" 
                            : isActive
                            ? `bg-gradient-to-br ${color.bg} text-white`
                            : "bg-slate-600 text-slate-300"
                          }
                        `}>
                          {phaseIndex + 1}
                        </div>

                        {/* Active Pulse */}
                        {isActive && (
                          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color.bg} animate-ping opacity-30`} />
                        )}
                      </div>

                      {/* Phase Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className={`font-bold text-lg ${isCompleted ? "text-emerald-400" : "text-white"}`}>
                            {phase.name}
                          </h3>
                          {isActive && (
                            <Badge className={`bg-gradient-to-r ${color.bg} text-white text-[10px] px-2 py-0.5 border-0`}>
                              <Play className="h-2.5 w-2.5 mr-1 fill-current" />
                              Em Andamento
                            </Badge>
                          )}
                          {isCompleted && (
                            <Badge className="bg-gradient-to-r from-emerald-400 to-green-500 text-white text-[10px] px-2 py-0.5 border-0">
                              <Star className="h-2.5 w-2.5 mr-1 fill-current" />
                              Completo!
                            </Badge>
                          )}
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2.5 bg-slate-700 rounded-full overflow-hidden max-w-[200px]">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${phaseProgress}%` }}
                              transition={{ duration: 0.8 }}
                              className={`h-full rounded-full ${
                                isCompleted 
                                  ? "bg-gradient-to-r from-emerald-400 to-green-500" 
                                  : `bg-gradient-to-r ${color.bg}`
                              }`}
                            />
                          </div>
                          <span className={`text-sm font-bold ${isCompleted ? "text-emerald-400" : color.text}`}>
                            {phase.completedCount}/{phase.tasks.length}
                          </span>
                        </div>
                      </div>

                      {/* XP & Expand */}
                      <div className="flex items-center gap-3">
                        <div className={`
                          hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold
                          ${isCompleted 
                            ? "bg-yellow-400/20 text-yellow-400" 
                            : "bg-slate-700/50 text-slate-400"
                          }
                        `}>
                          <Sparkles className="h-4 w-4" />
                          +{phase.tasks.length * 100}
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-6 w-6 text-slate-400" />
                        </motion.div>
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
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="border-t border-slate-700/50 p-4 space-y-2">
                          {phase.tasks.map((task, taskIndex) => {
                            const overdue = isTaskOverdue(task);
                            const dueToday = isTaskDueToday(task);
                            const taskCompleted = task.status === "completed";
                            const taskActive = task.status === "in_progress";
                            
                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: taskIndex * 0.05 }}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskClick(task);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onTaskClick(task);
                                  }
                                }}
                                className={`
                                  group flex items-center gap-3 p-3 rounded-xl cursor-pointer
                                  transition-all duration-200 hover:scale-[1.01]
                                  ${taskCompleted
                                    ? "bg-emerald-500/10 border border-emerald-500/30"
                                    : taskActive
                                    ? "bg-amber-500/10 border border-amber-500/30"
                                    : overdue
                                    ? "bg-red-500/10 border border-red-500/30"
                                    : "bg-slate-800/50 border border-slate-700/50 hover:border-slate-600"
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
                                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                      <Clock className="h-5 w-5 text-white" />
                                    </div>
                                  ) : (
                                    <div className={`w-8 h-8 rounded-full border-2 ${overdue ? "border-red-400 bg-red-500/20" : "border-slate-600 bg-slate-700/50"} group-hover:border-slate-500 flex items-center justify-center`}>
                                      <Circle className={`h-4 w-4 ${overdue ? "text-red-400" : "text-slate-500"}`} />
                                    </div>
                                  )}
                                </button>

                                {/* Task Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`
                                      font-medium truncate
                                      ${taskCompleted 
                                        ? "line-through text-slate-500" 
                                        : overdue 
                                        ? "text-red-400" 
                                        : "text-white"
                                      }
                                    `}>
                                      {task.title}
                                    </p>
                                    {task.is_internal && (
                                      <EyeOff className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                    )}
                                    {task.recurrence && (
                                      <RefreshCw className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-3 mt-1">
                                    {task.due_date && (
                                      <span className={`
                                        flex items-center gap-1 text-xs
                                        ${overdue ? "text-red-400" : dueToday ? "text-amber-400" : "text-slate-500"}
                                      `}>
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(task.due_date), "dd/MM")}
                                      </span>
                                    )}
                                    {task.responsible_staff?.name && (
                                      <span className="text-xs text-slate-500 truncate">
                                        {task.responsible_staff.name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* XP */}
                                <div className={`
                                  shrink-0 px-2 py-1 rounded-lg text-xs font-bold
                                  ${taskCompleted 
                                    ? "bg-yellow-400/20 text-yellow-400" 
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
                </motion.div>
              </div>
            </motion.div>
          );
        })}

        {/* Final Trophy */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: phases.length * 0.1, type: "spring" }}
          className="flex justify-center"
        >
          <div className={`
            relative w-24 h-24 rounded-full flex items-center justify-center
            ${overallProgress === 100 
              ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-2xl shadow-yellow-500/50" 
              : "bg-slate-800 border-4 border-dashed border-slate-700"
            }
          `}>
            <Trophy className={`h-10 w-10 ${overallProgress === 100 ? "text-white" : "text-slate-600"}`} />
            
            {overallProgress === 100 && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-yellow-400 opacity-30"
                />
                <div className="absolute -inset-2 rounded-full bg-yellow-400 blur-xl opacity-30 -z-10" />
              </>
            )}
          </div>
        </motion.div>
        
        {overallProgress === 100 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center text-xl font-bold text-yellow-400 mt-4"
          >
            🎉 Parabéns! Jornada Completa!
          </motion.p>
        )}
      </div>
    </div>
  );
};
