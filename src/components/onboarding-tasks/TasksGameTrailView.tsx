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
  Sparkles,
  Trophy,
  Rocket,
  Target,
  Flag,
  Star,
  Zap,
  Crown,
  Medal,
  Gift,
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

interface TasksGameTrailViewProps {
  phases: TaskPhase[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
}

const PHASE_ICONS = [
  <Rocket className="h-6 w-6" />,
  <Target className="h-6 w-6" />,
  <Zap className="h-6 w-6" />,
  <Flag className="h-6 w-6" />,
  <Star className="h-6 w-6" />,
  <Medal className="h-6 w-6" />,
  <Crown className="h-6 w-6" />,
  <Gift className="h-6 w-6" />,
];

const PHASE_COLORS = [
  { bg: "from-blue-500 to-blue-600", glow: "shadow-blue-500/50", border: "border-blue-500" },
  { bg: "from-purple-500 to-purple-600", glow: "shadow-purple-500/50", border: "border-purple-500" },
  { bg: "from-amber-500 to-orange-500", glow: "shadow-amber-500/50", border: "border-amber-500" },
  { bg: "from-green-500 to-emerald-500", glow: "shadow-green-500/50", border: "border-green-500" },
  { bg: "from-pink-500 to-rose-500", glow: "shadow-pink-500/50", border: "border-pink-500" },
  { bg: "from-cyan-500 to-teal-500", glow: "shadow-cyan-500/50", border: "border-cyan-500" },
  { bg: "from-indigo-500 to-violet-500", glow: "shadow-indigo-500/50", border: "border-indigo-500" },
  { bg: "from-yellow-500 to-amber-500", glow: "shadow-yellow-500/50", border: "border-yellow-500" },
];

export const TasksGameTrailView = ({ phases, onTaskClick, onStatusChange }: TasksGameTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getTaskStatus = (task: OnboardingTask) => {
    if (task.status === "completed") return "completed";
    if (task.status === "in_progress") return "active";
    return "locked";
  };

  return (
    <div className="space-y-8">
      {/* Hero Progress Banner */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-8 text-primary-foreground"
      >
        {/* Animated background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-full"
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"
          />
          <motion.div 
            animate={{ scale: [1.2, 1, 1.2] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute bottom-5 right-20 w-32 h-32 bg-white/5 rounded-full blur-2xl"
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm"
              >
                <Trophy className="h-10 w-10" />
              </motion.div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Sua Jornada</h2>
                <p className="text-white/80 font-medium">
                  {completedTasks} de {totalTasks} conquistas desbloqueadas
                </p>
              </div>
            </div>
            <div className="text-right">
              <motion.div
                key={overallProgress}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-6xl font-black"
              >
                {overallProgress}%
              </motion.div>
              <p className="text-white/70 font-medium">completo</p>
            </div>
          </div>
          
          {/* XP Bar */}
          <div className="relative">
            <div className="h-6 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 rounded-full relative"
              >
                <motion.div
                  animate={{ x: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
              </motion.div>
            </div>
            {/* Level markers */}
            <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none">
              {[25, 50, 75].map((marker) => (
                <div
                  key={marker}
                  className={`w-1 h-4 rounded-full ${overallProgress >= marker ? 'bg-yellow-300' : 'bg-white/30'}`}
                  style={{ marginLeft: `${marker - 1}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Game Trail - Snake Path */}
      <div className="relative py-8">
        {phases.map((phase, phaseIndex) => {
          const isExpanded = expandedPhase === phaseIndex;
          const phaseProgress = phase.tasks.length 
            ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
            : 0;
          const isCompleted = phaseProgress === 100;
          const isActive = phaseProgress > 0 && phaseProgress < 100;
          const colorSet = PHASE_COLORS[phaseIndex % PHASE_COLORS.length];
          const icon = PHASE_ICONS[phaseIndex % PHASE_ICONS.length];
          const isLeft = phaseIndex % 2 === 0;

          return (
            <div key={phase.name} className="relative">
              {/* Connecting Path */}
              {phaseIndex > 0 && (
                <svg 
                  className="absolute w-full h-16 -top-16 left-0"
                  viewBox="0 0 100 20"
                  preserveAspectRatio="none"
                >
                  <path
                    d={isLeft 
                      ? "M 80 0 Q 50 10 20 20" 
                      : "M 20 0 Q 50 10 80 20"
                    }
                    fill="none"
                    stroke={isCompleted || isActive ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                    strokeWidth="2"
                    strokeDasharray={isCompleted ? "none" : "5,5"}
                    className="transition-all duration-500"
                  />
                </svg>
              )}

              {/* Phase Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: phaseIndex * 0.1 }}
                className={`relative flex ${isLeft ? 'justify-start' : 'justify-end'} mb-8`}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={`
                    w-full md:w-4/5 lg:w-3/4 rounded-2xl overflow-hidden
                    bg-card border-2 transition-all duration-300 cursor-pointer
                    ${isExpanded ? `${colorSet.border} shadow-lg ${colorSet.glow}` : 'border-border hover:border-muted-foreground/50'}
                  `}
                  onClick={() => setExpandedPhase(isExpanded ? null : phaseIndex)}
                >
                  {/* Phase Header */}
                  <div className={`
                    p-5 flex items-center justify-between
                    ${isCompleted ? `bg-gradient-to-r ${colorSet.bg}` : 'bg-card'}
                  `}>
                    <div className="flex items-center gap-4">
                      {/* Phase Icon/Number */}
                      <motion.div
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className={`
                          w-14 h-14 rounded-xl flex items-center justify-center
                          ${isCompleted 
                            ? 'bg-white/20 text-white' 
                            : isActive 
                              ? `bg-gradient-to-br ${colorSet.bg} text-white shadow-lg ${colorSet.glow}`
                              : 'bg-muted text-muted-foreground'
                          }
                        `}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-7 w-7" />
                        ) : (
                          <span className="font-bold text-xl">{phaseIndex + 1}</span>
                        )}
                      </motion.div>

                      <div>
                        <h3 className={`text-xl font-bold ${isCompleted ? 'text-white' : ''}`}>
                          {phase.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-sm ${isCompleted ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {phase.completedCount}/{phase.tasks.length} tarefas
                          </span>
                          {isActive && (
                            <Badge className="bg-amber-500 text-white text-xs animate-pulse">
                              Em progresso
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Mini Progress Ring */}
                      <div className="relative w-12 h-12">
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke={isCompleted ? "rgba(255,255,255,0.3)" : "hsl(var(--muted))"}
                            strokeWidth="4"
                          />
                          <motion.circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke={isCompleted ? "white" : "hsl(var(--primary))"}
                            strokeWidth="4"
                            strokeLinecap="round"
                            initial={{ strokeDasharray: "0 126" }}
                            animate={{ strokeDasharray: `${phaseProgress * 1.26} 126` }}
                            transition={{ duration: 1 }}
                          />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${isCompleted ? 'text-white' : ''}`}>
                          {phaseProgress}%
                        </span>
                      </div>

                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className={`h-6 w-6 ${isCompleted ? 'text-white' : 'text-muted-foreground'}`} />
                      </motion.div>
                    </div>
                  </div>

                  {/* Tasks Grid */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t bg-muted/30"
                      >
                        <div className="p-5 grid gap-3">
                          {phase.tasks.map((task, taskIndex) => {
                            const taskStatus = getTaskStatus(task);
                            
                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: taskIndex * 0.03 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskClick(task);
                                }}
                                className={`
                                  flex items-center gap-4 p-4 rounded-xl cursor-pointer
                                  transition-all duration-200 group
                                  ${taskStatus === "completed" 
                                    ? 'bg-green-500/10 border border-green-500/30' 
                                    : taskStatus === "active"
                                      ? 'bg-amber-500/10 border border-amber-500/30'
                                      : 'bg-card border border-border hover:border-primary/50 hover:shadow-md'
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
                                  className={`
                                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                                    transition-all duration-200
                                    ${taskStatus === "completed" 
                                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                                      : taskStatus === "active"
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse'
                                        : 'bg-muted text-muted-foreground group-hover:bg-primary/20'
                                    }
                                  `}
                                >
                                  {taskStatus === "completed" ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : taskStatus === "active" ? (
                                    <Clock className="h-5 w-5" />
                                  ) : (
                                    <Circle className="h-5 w-5" />
                                  )}
                                </motion.button>

                                {/* Task Content */}
                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium truncate ${taskStatus === "completed" ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.title}
                                  </p>
                                </div>

                                {/* Task Meta */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {task.recurrence && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <RefreshCw className="h-3 w-3" />
                                    </Badge>
                                  )}
                                  {task.priority === "high" && (
                                    <Badge className="bg-red-500 text-white text-xs">!</Badge>
                                  )}
                                  {task.due_date && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(task.due_date), "dd/MM")}
                                    </span>
                                  )}
                                </div>

                                {/* XP Badge */}
                                {taskStatus === "completed" && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-600"
                                  >
                                    <Star className="h-3 w-3 fill-current" />
                                    <span className="text-xs font-bold">+10</span>
                                  </motion.div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </div>
          );
        })}

        {/* Final Trophy */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: phases.length * 0.1 }}
          className="flex justify-center"
        >
          <motion.div
            animate={overallProgress === 100 ? { 
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={`
              w-24 h-24 rounded-full flex items-center justify-center
              ${overallProgress === 100 
                ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 shadow-2xl shadow-amber-500/50' 
                : 'bg-muted border-4 border-dashed border-muted-foreground/30'
              }
            `}
          >
            <Trophy className={`h-12 w-12 ${overallProgress === 100 ? 'text-white' : 'text-muted-foreground'}`} />
          </motion.div>
        </motion.div>
        
        {overallProgress === 100 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-4 text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent"
          >
            🎉 Parabéns! Jornada Completa!
          </motion.p>
        )}
      </div>
    </div>
  );
};