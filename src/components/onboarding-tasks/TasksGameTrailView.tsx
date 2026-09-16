import { useState } from "react";
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
  Shield,
  Gem,
  Check,
  User,
} from "lucide-react";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed" | "inactive";
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

// Jornada: cada tarefa vale 100 XP, cada nível são 500 XP
const XP_POR_TAREFA = 100;
const XP_POR_NIVEL = 500;

/** Anel de progresso do nível (SVG puro, sem lib) */
function LevelRing({ value, children }: { value: number; children: React.ReactNode }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={value >= 100 ? "#22c55e" : "#CC1B1B"}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.min(value, 100)) / 100 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">{children}</div>
    </div>
  );
}

export const TasksGameTrailView = ({ phases, onTaskClick, onStatusChange }: TasksGameTrailViewProps) => {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(
    phases.find((p) => p.completedCount > 0 && p.completedCount < p.tasks.length)?.name || phases[0]?.name || null
  );

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const xp = completedTasks * XP_POR_TAREFA;
  const level = Math.floor(xp / XP_POR_NIVEL) + 1;
  const xpInLevel = xp % XP_POR_NIVEL;
  const done = overallProgress === 100;
  const activeIndex = phases.findIndex((p) => p.completedCount < p.tasks.length);

  const isTaskOverdue = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
  };
  const isTaskDueToday = (task: OnboardingTask) => {
    if (!task.due_date || task.status === "completed") return false;
    return isToday(new Date(task.due_date));
  };

  return (
    <div className="pb-10">
      {/* Painel da jornada */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-[#0D2B5E] text-white">
        {/* textura discreta: linhas diagonais, sem aleatoriedade */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)" }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#CC1B1B]/25 blur-3xl" />

        <div className="relative p-5 md:p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <LevelRing value={done ? 100 : (xpInLevel / XP_POR_NIVEL) * 100}>
                {done ? (
                  <Crown className="h-8 w-8 text-amber-300" />
                ) : (
                  <>
                    <span className="text-3xl font-bold leading-none">{level}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-white/60">Nível</span>
                  </>
                )}
              </LevelRing>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-white/60">Jornada do cliente</p>
                <h2 className="mt-0.5 text-2xl font-bold leading-tight">
                  {done ? "Jornada concluída" : `${completedTasks} de ${totalTasks} etapas cumpridas`}
                </h2>
                <p className="mt-1.5 text-sm text-white/70">
                  <span className="font-semibold text-white">{xp.toLocaleString("pt-BR")} XP</span>
                  {!done && <> · faltam {XP_POR_NIVEL - xpInLevel} XP para o nível {level + 1}</>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[
                { label: "Concluídas", value: completedTasks, cls: "text-emerald-300" },
                { label: "Pendentes", value: totalTasks - completedTasks, cls: "text-white" },
                { label: "Progresso", value: `${overallProgress}%`, cls: done ? "text-amber-300" : "text-[#ff6b6b]" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center">
                  <p className={cn("text-2xl font-bold tabular-nums leading-none", s.cls)}>{s.value}</p>
                  <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-white/55">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={cn("h-full rounded-full", done ? "bg-emerald-400" : "bg-[#CC1B1B]")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trilha: linha do tempo com marcos */}
      <div className="relative mx-auto max-w-3xl pl-14 md:pl-16">
        {/* trilho */}
        <div className="absolute bottom-6 left-[27px] top-2 w-0.5 bg-border md:left-[31px]" />
        {phases.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{
              height: done
                ? "100%"
                : `${Math.max(0, activeIndex) * (100 / Math.max(phases.length, 1))}%`,
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-[27px] top-2 w-0.5 bg-emerald-500 md:left-[31px]"
          />
        )}

        {phases.map((phase, phaseIndex) => {
          const isExpanded = expandedPhase === phase.name;
          const total = phase.tasks.length;
          const pct = total ? Math.round((phase.completedCount / total) * 100) : 0;
          const isCompleted = total > 0 && pct === 100;
          const isActive = !isCompleted && phaseIndex === activeIndex;
          const PhaseIcon = PHASE_ICONS[phaseIndex % PHASE_ICONS.length];

          return (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: phaseIndex * 0.06 }}
              className="relative mb-4"
            >
              {/* marco na linha */}
              <div className="absolute -left-14 top-4 md:-left-16">
                <div
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-full border-4 md:h-16 md:w-16",
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isActive
                      ? "border-[#CC1B1B] bg-card text-[#CC1B1B]"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-0 -m-1 animate-ping rounded-full border-2 border-[#CC1B1B]/40" />
                  )}
                  {isCompleted ? <Check className="h-7 w-7" strokeWidth={3} /> : <PhaseIcon className="h-6 w-6" />}
                  <span
                    className={cn(
                      "absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[11px] font-bold",
                      isCompleted ? "bg-emerald-600 text-white" : isActive ? "bg-[#0D2B5E] text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {phaseIndex + 1}
                  </span>
                </div>
              </div>

              {/* card da fase */}
              <div
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card transition-shadow",
                  isActive ? "border-[#CC1B1B]/40 shadow-md shadow-[#CC1B1B]/10" : isCompleted ? "border-emerald-500/30" : "border-border",
                )}
              >
                {/* Só o cabeçalho abre/fecha a fase: as tarefas ficam fora do gesto */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedPhase(isExpanded ? null : phase.name);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-muted/40 md:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={cn("text-base font-semibold md:text-lg", isCompleted && "text-emerald-700 dark:text-emerald-400")}>
                        {phase.name}
                      </h3>
                      {isActive && (
                        <span className="rounded-full bg-[#CC1B1B]/10 px-2 py-0.5 text-[11px] font-semibold text-[#CC1B1B]">
                          Em andamento
                        </span>
                      )}
                      {isCompleted && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          Concluída
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8 }}
                          className={cn("h-full rounded-full", isCompleted ? "bg-emerald-500" : "bg-[#CC1B1B]")}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {phase.completedCount}/{total}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "hidden rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums md:inline-flex",
                        isCompleted ? "bg-amber-400/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
                      )}
                    >
                      +{total * XP_POR_TAREFA} XP
                    </span>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border border-t border-border">
                        {phase.tasks.map((task) => {
                          const overdue = isTaskOverdue(task);
                          const dueToday = isTaskDueToday(task);
                          const taskCompleted = task.status === "completed";
                          const taskActive = task.status === "in_progress";

                          return (
                            <div
                              key={task.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => onTaskClick(task)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onTaskClick(task);
                                }
                              }}
                              className={cn(
                                "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:px-5",
                                taskCompleted && "bg-emerald-500/[0.04]"
                              )}
                            >
                              <button
                                type="button"
                                title={taskCompleted ? "Marcar como pendente" : taskActive ? "Marcar como concluída" : "Marcar como em andamento"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
                                  onStatusChange(task.id, next);
                                }}
                                className="shrink-0 transition-transform hover:scale-110"
                              >
                                {taskCompleted ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </span>
                                ) : taskActive ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white">
                                    <Clock className="h-4 w-4" />
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "flex h-7 w-7 items-center justify-center rounded-full border-2",
                                      overdue ? "border-red-500 text-red-500" : "border-border text-muted-foreground group-hover:border-muted-foreground"
                                    )}
                                  >
                                    <Circle className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p
                                    className={cn(
                                      "truncate text-sm font-medium",
                                      taskCompleted ? "text-muted-foreground line-through" : overdue ? "text-red-600 dark:text-red-400" : "text-foreground"
                                    )}
                                  >
                                    {task.title}
                                  </p>
                                  {task.is_internal && <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                  {task.recurrence && <RefreshCw className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  {task.due_date && (
                                    <span className={cn("flex items-center gap-1", overdue ? "font-medium text-red-600 dark:text-red-400" : dueToday && "font-medium text-amber-600")}>
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(task.due_date), "dd/MM")}
                                      {overdue ? " · atrasada" : dueToday ? " · hoje" : ""}
                                    </span>
                                  )}
                                  {task.responsible_staff?.name && (
                                    <span className="flex items-center gap-1 truncate">
                                      <User className="h-3 w-3" />
                                      {task.responsible_staff.name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                                  taskCompleted ? "bg-amber-400/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
                                )}
                              >
                                +{XP_POR_TAREFA} XP
                              </span>
                            </div>
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

        {/* chegada */}
        <div className="relative mt-2 pt-2">
          <div className="absolute -left-14 top-2 md:-left-16">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-4 md:h-16 md:w-16",
                done ? "border-amber-400 bg-amber-400 text-white shadow-lg shadow-amber-400/30" : "border-dashed border-border bg-card text-muted-foreground"
              )}
            >
              <Trophy className="h-7 w-7" />
            </div>
          </div>
          <div className="flex min-h-[3.5rem] items-center md:min-h-[4rem]">
            <p className={cn("text-sm font-semibold", done ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground")}>
              {done ? "Parabéns. Jornada concluída." : `Chegada: ${totalTasks - completedTasks} etapa(s) pela frente`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
