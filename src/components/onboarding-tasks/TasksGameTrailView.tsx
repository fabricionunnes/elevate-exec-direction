import { useState } from "react";
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
  { bg: "from-cyan-400 to-blue-500", glow: "shadow-cyan-500/50", border: "border-cyan-400", accent: "bg-cyan-500" },
  { bg: "from-violet-500 to-purple-600", glow: "shadow-violet-500/50", border: "border-violet-500", accent: "bg-violet-500" },
  { bg: "from-amber-400 to-orange-500", glow: "shadow-amber-500/50", border: "border-amber-400", accent: "bg-amber-500" },
  { bg: "from-emerald-400 to-green-500", glow: "shadow-emerald-500/50", border: "border-emerald-400", accent: "bg-emerald-500" },
  { bg: "from-rose-400 to-pink-500", glow: "shadow-rose-500/50", border: "border-rose-400", accent: "bg-rose-500" },
  { bg: "from-teal-400 to-cyan-500", glow: "shadow-teal-500/50", border: "border-teal-400", accent: "bg-teal-500" },
  { bg: "from-fuchsia-400 to-purple-500", glow: "shadow-fuchsia-500/50", border: "border-fuchsia-400", accent: "bg-fuchsia-500" },
  { bg: "from-lime-400 to-green-500", glow: "shadow-lime-500/50", border: "border-lime-400", accent: "bg-lime-500" },
  { bg: "from-sky-400 to-indigo-500", glow: "shadow-sky-500/50", border: "border-sky-400", accent: "bg-sky-500" },
  { bg: "from-red-400 to-rose-500", glow: "shadow-red-500/50", border: "border-red-400", accent: "bg-red-500" },
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 p-8 text-white">
        {/* Static background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-full" />
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="absolute bottom-5 right-20 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                <Trophy className="h-10 w-10" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Jornada</h2>
                <p className="text-white/80 font-medium">
                  {completedTasks} de {totalTasks} conquistas desbloqueadas
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-6xl font-black">
                {overallProgress}%
              </div>
              <p className="text-white/70 font-medium">completo</p>
            </div>
          </div>
          
          {/* XP Bar */}
          <div className="relative">
            <div className="h-6 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                style={{ width: `${overallProgress}%` }}
                className="h-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 rounded-full relative transition-all duration-500"
              />
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
      </div>

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
                    className="transition-all duration-300"
                  />
                </svg>
              )}

              {/* Phase Card */}
              <div className={`relative flex ${isLeft ? 'justify-start' : 'justify-end'} mb-8`}>
                <div
                  className={`
                    w-full md:w-4/5 lg:w-3/4 rounded-2xl overflow-hidden
                    bg-card border-2 transition-all duration-200 cursor-pointer
                    ${isExpanded ? `${colorSet.border} shadow-lg` : 'border-border hover:border-muted-foreground/50'}
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
                      <div
                        className={`
                          w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-200
                          ${isCompleted 
                            ? 'bg-white/20 text-white' 
                            : isActive 
                              ? `bg-gradient-to-br ${colorSet.bg} text-white shadow-lg`
                              : 'bg-muted text-muted-foreground'
                          }
                        `}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-7 w-7" />
                        ) : (
                          <span className="font-bold text-xl">{phaseIndex + 1}</span>
                        )}
                      </div>

                      <div>
                        <h3 className={`text-xl font-bold ${isCompleted ? 'text-white' : ''}`}>
                          {phase.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-sm ${isCompleted ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {phase.completedCount}/{phase.tasks.length} tarefas
                          </span>
                          {isActive && (
                            <Badge className="bg-amber-500 text-white text-xs">
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
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke={isCompleted ? "white" : "hsl(var(--primary))"}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${phaseProgress * 1.26} 126`}
                            className="transition-all duration-300"
                          />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${isCompleted ? 'text-white' : ''}`}>
                          {phaseProgress}%
                        </span>
                      </div>

                      <ChevronDown 
                        className={`h-6 w-6 transition-transform duration-200 ${isCompleted ? 'text-white' : 'text-muted-foreground'} ${isExpanded ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t p-5 grid gap-3">
                      {phase.tasks.map((task, taskIndex) => {
                        const taskStatus = getTaskStatus(task);
                        const taskColorIndex = (phaseIndex + taskIndex) % PHASE_COLORS.length;
                        const taskColor = PHASE_COLORS[taskColorIndex];
                        
                        return (
                          <div
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskClick(task);
                            }}
                            className={`
                              flex items-center gap-4 p-4 rounded-xl cursor-pointer
                              transition-colors duration-150 group relative overflow-hidden
                              ${taskStatus === "completed" 
                                ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/5 border-2 border-emerald-400/40' 
                                : taskStatus === "active"
                                  ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-2 border-amber-400/40'
                                  : 'bg-card border-2 border-border hover:border-muted-foreground/50'
                              }
                            `}
                          >
                            {/* Colored left accent bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${taskStatus === "completed" ? 'bg-emerald-500' : taskStatus === "active" ? 'bg-amber-500' : taskColor.accent}`} />
                            
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
                              className={`
                                w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                                transition-transform duration-150 ml-2 hover:scale-110
                                ${taskStatus === "completed" 
                                  ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg' 
                                  : taskStatus === "active"
                                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg'
                                    : `bg-gradient-to-br ${taskColor.bg} text-white/80 group-hover:text-white shadow-md`
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
                            </button>

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
                              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-600">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs font-bold">+10</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Final Trophy */}
        <div className="flex justify-center">
          <div
            className={`
              w-24 h-24 rounded-full flex items-center justify-center
              ${overallProgress === 100 
                ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 shadow-2xl shadow-amber-500/50' 
                : 'bg-muted border-4 border-dashed border-muted-foreground/30'
              }
            `}
          >
            <Trophy className={`h-12 w-12 ${overallProgress === 100 ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
        </div>
        
        {overallProgress === 100 && (
          <p className="text-center mt-4 text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
            🎉 Parabéns! Jornada Completa!
          </p>
        )}
      </div>
    </div>
  );
};