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
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { format, isBefore, startOfDay, isToday } from "date-fns";

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

const PHASE_COLORS = [
  { bg: "bg-blue-500", gradient: "from-blue-500 to-blue-600" },
  { bg: "bg-violet-500", gradient: "from-violet-500 to-violet-600" },
  { bg: "bg-amber-500", gradient: "from-amber-500 to-amber-600" },
  { bg: "bg-orange-500", gradient: "from-orange-500 to-orange-600" },
  { bg: "bg-emerald-500", gradient: "from-emerald-500 to-emerald-600" },
  { bg: "bg-purple-500", gradient: "from-purple-500 to-purple-600" },
  { bg: "bg-cyan-500", gradient: "from-cyan-500 to-cyan-600" },
  { bg: "bg-rose-500", gradient: "from-rose-500 to-rose-600" },
];

// Circular progress component
const CircularProgress = ({ value, size = 48 }: { value: number; size?: number }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={value === 100 ? "text-green-500" : "text-destructive"}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{value}%</span>
      </div>
    </div>
  );
};

// Road connector SVG
const RoadConnector = ({ direction }: { direction: "left" | "right" }) => (
  <div className={`h-16 flex items-center justify-center overflow-hidden ${direction === "left" ? "ml-auto mr-8 md:mr-16" : "mr-auto ml-8 md:ml-16"}`}>
    <svg 
      width="200" 
      height="60" 
      viewBox="0 0 200 60" 
      className={`${direction === "right" ? "scale-x-[-1]" : ""}`}
    >
      <path
        d="M 0 0 Q 100 30, 200 60"
        fill="none"
        stroke="hsl(var(--destructive))"
        strokeWidth="8"
        strokeDasharray="16 12"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

export const TasksTrailView = ({ phases, onTaskClick, onStatusChange }: TasksTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

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
    <div className="space-y-0">
      {/* Hero Progress Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0A2240] to-[#1a3a5c] p-6 mb-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 w-20 h-20 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-4 right-4 w-32 h-32 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          
          <div className="flex-1">
            <p className="text-white/80 text-sm mb-1">
              {completedTasks} de {totalTasks} conquistas desbloqueadas
            </p>
            <p className="text-white text-right text-sm mb-2">
              {overallProgress}% completo
            </p>
            <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
              <div 
                className="absolute inset-y-0 bg-destructive/80 rounded-r-full transition-all duration-500"
                style={{ left: `${overallProgress}%`, right: 0 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trail Cards */}
      <div className="relative">
        {phases.map((phase, phaseIndex) => {
          const phaseStatus = getPhaseStatus(phase);
          const isExpanded = expandedPhase === phase.name;
          const phaseProgress = phase.tasks.length 
            ? Math.round((phase.completedCount / phase.tasks.length) * 100) 
            : 0;
          const colors = PHASE_COLORS[phaseIndex % PHASE_COLORS.length];
          const isCompleted = phaseStatus === "completed";
          const isInProgress = phaseStatus === "in_progress";
          const isLeft = phaseIndex % 2 === 0;
          const isLast = phaseIndex === phases.length - 1;

          return (
            <div key={phase.name}>
              {/* Phase Card */}
              <div className={`flex ${isLeft ? "justify-start" : "justify-end"}`}>
                <div 
                  className={`
                    relative w-full max-w-2xl rounded-xl border overflow-hidden transition-all duration-300
                    ${isCompleted 
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-500" 
                      : "bg-card hover:shadow-lg border-border"
                    }
                  `}
                >
                  {/* Card Header */}
                  <button
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                    className="w-full p-4 flex items-center gap-4"
                  >
                    {/* Number Badge */}
                    <div 
                      className={`
                        flex items-center justify-center w-12 h-12 rounded-full shrink-0 font-bold text-lg text-white
                        ${isCompleted 
                          ? "bg-white/20" 
                          : `bg-gradient-to-br ${colors.gradient}`
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        phaseIndex + 1
                      )}
                    </div>

                    {/* Phase Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className={`font-bold text-lg truncate ${isCompleted ? "text-white" : ""}`}>
                        {phase.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-sm ${isCompleted ? "text-white/80" : "text-muted-foreground"}`}>
                          {phase.completedCount}/{phase.tasks.length} tarefas
                        </span>
                        {isInProgress && (
                          <Badge className="bg-emerald-500/90 hover:bg-emerald-500/90 text-white text-xs px-2 py-0">
                            Em progresso
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress Circle & Chevron */}
                    <div className="flex items-center gap-3 shrink-0">
                      {!isCompleted && <CircularProgress value={phaseProgress} />}
                      {isCompleted && (
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-sm font-bold">100%</span>
                        </div>
                      )}
                      <ChevronDown 
                        className={`
                          h-5 w-5 transition-transform duration-200
                          ${isCompleted ? "text-white/80" : "text-muted-foreground"}
                          ${isExpanded ? "rotate-180" : ""}
                        `} 
                      />
                    </div>
                  </button>

                  {/* Expanded Tasks */}
                  {isExpanded && (
                    <div className={`border-t ${isCompleted ? "border-white/20" : "border-border"}`}>
                      <div className="p-3 space-y-1">
                        {phase.tasks.map((task) => {
                          const overdue = isTaskOverdue(task);
                          const dueToday = isTaskDueToday(task);
                          
                          return (
                            <div
                              key={task.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(task);
                              }}
                              className={`
                                group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all
                                ${isCompleted 
                                  ? "hover:bg-white/10" 
                                  : task.status === "completed"
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
                                  <CheckCircle2 className={`h-5 w-5 ${isCompleted ? "text-white" : "text-green-500"}`} />
                                ) : task.status === "in_progress" ? (
                                  <Clock className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <Circle className={`h-5 w-5 ${isCompleted ? "text-white/40" : "text-muted-foreground/40"} group-hover:text-muted-foreground`} />
                                )}
                              </button>

                              {/* Task Content */}
                              <div className="flex-1 min-w-0">
                                <p className={`
                                  text-sm truncate
                                  ${task.status === "completed" 
                                    ? isCompleted 
                                      ? "line-through text-white/60" 
                                      : "line-through text-muted-foreground"
                                    : isCompleted
                                    ? "text-white"
                                    : overdue 
                                    ? "text-destructive font-medium" 
                                    : ""
                                  }
                                `}>
                                  {task.title}
                                </p>
                              </div>

                              {/* Task Meta */}
                              <div className="flex items-center gap-2 shrink-0">
                                {task.is_internal && (
                                  <EyeOff className={`h-3.5 w-3.5 ${isCompleted ? "text-white/50" : "text-muted-foreground"}`} />
                                )}
                                {task.recurrence && (
                                  <RefreshCw className={`h-3.5 w-3.5 ${isCompleted ? "text-white/50" : "text-muted-foreground"}`} />
                                )}
                                {task.priority === "high" && !isCompleted && (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                {task.due_date && (
                                  <span className={`
                                    text-xs flex items-center gap-1 px-2 py-0.5 rounded-full
                                    ${isCompleted
                                      ? "bg-white/10 text-white/70"
                                      : overdue 
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

              {/* Road Connector */}
              {!isLast && (
                <RoadConnector direction={isLeft ? "right" : "left"} />
              )}
            </div>
          );
        })}

        {/* Finish Line */}
        <div className="mt-6">
          <RoadConnector direction={phases.length % 2 === 0 ? "left" : "right"} />
          <div className={`flex ${phases.length % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div 
              className={`
                w-full max-w-2xl flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-all
                ${overallProgress === 100 
                  ? "border-amber-400 bg-gradient-to-r from-amber-500/20 to-yellow-500/10" 
                  : "border-muted-foreground/30 bg-muted/10"
                }
              `}
            >
              <div className={`
                flex items-center justify-center w-12 h-12 rounded-full
                ${overallProgress === 100 
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/40" 
                  : "bg-muted text-muted-foreground"
                }
              `}>
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className={`font-bold ${overallProgress === 100 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {overallProgress === 100 ? "🎉 Onboarding Concluído!" : "Linha de Chegada"}
                </p>
                {overallProgress < 100 && (
                  <p className="text-sm text-muted-foreground">
                    {totalTasks - completedTasks} tarefas restantes
                  </p>
                )}
              </div>
              {overallProgress === 100 && (
                <div className="ml-auto">
                  <CircularProgress value={100} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
