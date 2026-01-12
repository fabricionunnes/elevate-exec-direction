import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
  Building2,
  Package,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, startOfWeek, endOfWeek, addDays, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RecurrenceSelector } from "./RecurrenceSelector";

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
  project_id?: string;
  assignee?: { id: string; name: string; role: string };
  responsible_staff?: { id: string; name: string } | null;
}

interface Project {
  id: string;
  product_name: string;
  onboarding_company_id?: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface TasksScheduleViewProps {
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
  projects?: Project[];
  companies?: Company[];
  currentStaffId?: string | null;
  currentUserRole?: string | null;
  showAllCompanies?: boolean;
  onTaskAdded?: () => void;
  /** When inside a single project page, pass the projectId to skip the project selector */
  singleProjectId?: string;
  /** Staff list for assigning responsible */
  staffList?: Staff[];
}

const TASK_PHASES = [
  "Pré-Onboarding",
  "Onboarding & Setup",
  "Diagnóstico Comercial",
  "Desenho do Processo",
  "Implementação CRM",
  "Playbook & Padronização",
  "Treinamento & Adoção",
  "Estabilização & Governança",
];

export const TasksScheduleView = ({ 
  tasks, 
  onTaskClick, 
  onStatusChange,
  projects = [],
  companies = [],
  currentStaffId,
  currentUserRole,
  showAllCompanies = false,
  onTaskAdded,
  singleProjectId,
  staffList = []
}: TasksScheduleViewProps) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState(singleProjectId || "");
  const [newTaskResponsibleId, setNewTaskResponsibleId] = useState("");
  const [newTaskPhase, setNewTaskPhase] = useState("");
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  const days = viewMode === "month" 
    ? eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    : eachDayOfInterval({ start: weekStart, end: weekEnd });

  const tasksByDate = useMemo(() => {
    const map: Record<string, OnboardingTask[]> = {};
    tasks.forEach(task => {
      if (task.due_date) {
        const dateKey = format(parseISO(task.due_date), "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      }
    });
    return map;
  }, [tasks]);

  const navigatePrevious = () => {
    setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : addDays(currentDate, -7));
  };

  const navigateNext = () => {
    setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addDays(currentDate, 7));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusForDay = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayTasks = tasksByDate[dateKey] || [];
    
    if (dayTasks.length === 0) return null;
    
    const hasOverdue = dayTasks.some(t => t.status !== "completed" && isPast(date) && !isToday(date));
    const hasToday = isToday(date) && dayTasks.some(t => t.status !== "completed");
    const hasInProgress = dayTasks.some(t => t.status === "in_progress");
    const allCompleted = dayTasks.every(t => t.status === "completed");
    
    if (hasOverdue) return "overdue";
    if (hasToday) return "today";
    if (hasInProgress) return "in_progress";
    if (allCompleted) return "completed";
    return "pending";
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setShowDayDialog(true);
  };

  const handleAddTaskClick = (day: Date) => {
    setSelectedDate(day);
    setNewTaskTitle("");
    setNewTaskProjectId(singleProjectId || "");
    setNewTaskResponsibleId("");
    setNewTaskPhase("");
    setNewTaskRecurrence(null);
    setShowAddTaskDialog(true);
  };

  const handleTaskNavigate = (task: OnboardingTask) => {
    setShowDayDialog(false);
    // If in single project mode, just open the task details
    if (singleProjectId) {
      onTaskClick(task);
      return;
    }
    // Otherwise, navigate to the project page
    const projectId = task.project_id;
    if (projectId) {
      navigate(`/onboarding-tasks/${projectId}?task=${task.id}`);
    } else {
      onTaskClick(task);
    }
  };

  const handleAddTask = async () => {
    const targetProjectId = singleProjectId || newTaskProjectId;
    if (!newTaskTitle.trim() || !targetProjectId || !selectedDate) return;

    setAddingTask(true);
    try {
      const insertData: any = {
        title: newTaskTitle.trim(),
        project_id: targetProjectId,
        due_date: format(selectedDate, "yyyy-MM-dd"),
        status: "pending",
        sort_order: 0,
      };

      // Add responsible staff if selected
      if (newTaskResponsibleId) {
        insertData.responsible_staff_id = newTaskResponsibleId;
      }

      // Add phase as tag if selected
      if (newTaskPhase) {
        insertData.tags = [newTaskPhase];
      }

      // Add recurrence if selected
      if (newTaskRecurrence) {
        insertData.recurrence = newTaskRecurrence;
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .insert(insertData);

      if (error) throw error;

      toast.success(newTaskRecurrence 
        ? "Tarefa recorrente adicionada com sucesso!" 
        : "Tarefa adicionada com sucesso!");
      setShowAddTaskDialog(false);
      setNewTaskTitle("");
      setNewTaskProjectId(singleProjectId || "");
      setNewTaskResponsibleId("");
      setNewTaskPhase("");
      setNewTaskRecurrence(null);
      onTaskAdded?.();
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Erro ao adicionar tarefa");
    } finally {
      setAddingTask(false);
    }
  };

  const getTaskInfo = (task: OnboardingTask) => {
    const projectId = task.project_id;
    const project = projectId ? projectMap.get(projectId) : null;
    const company = project?.onboarding_company_id ? companyMap.get(project.onboarding_company_id) : null;
    return { project, company };
  };

  const selectedDayTasks = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return tasksByDate[dateKey] || [];
  }, [selectedDate, tasksByDate]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Stats for the header
  const tasksThisMonth = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = parseISO(t.due_date);
    return isSameMonth(dueDate, currentDate);
  });
  const completedThisMonth = tasksThisMonth.filter(t => t.status === "completed").length;
  const pendingThisMonth = tasksThisMonth.filter(t => t.status === "pending").length;
  const inProgressThisMonth = tasksThisMonth.filter(t => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold min-w-[200px] text-center capitalize">
              {viewMode === "month" 
                ? format(currentDate, "MMMM yyyy", { locale: ptBR })
                : `${format(weekStart, "dd")} - ${format(weekEnd, "dd MMM", { locale: ptBR })}`
              }
            </h2>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex rounded-lg border p-1 bg-muted/50">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              Mês
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
            >
              Semana
            </Button>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1">
              <Circle className="h-2 w-2 fill-primary text-primary" />
              {pendingThisMonth} pendentes
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
              {inProgressThisMonth} em andamento
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
              {completedThisMonth} concluídas
            </Badge>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={`grid grid-cols-7 ${viewMode === "week" ? "" : "min-h-[600px]"}`}>
          {days.map((day, index) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const dayStatus = getStatusForDay(day);

            return (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className={`
                  min-h-[100px] border-b border-r p-2 relative group cursor-pointer
                  ${viewMode === "week" ? "min-h-[200px]" : ""}
                  ${!isCurrentMonth && viewMode === "month" ? "bg-muted/30" : "bg-card"}
                  ${isCurrentDay ? "ring-2 ring-primary ring-inset" : ""}
                  ${dayStatus === "overdue" ? "bg-red-50 dark:bg-red-950/20" : ""}
                  ${dayStatus === "today" ? "bg-orange-50 dark:bg-orange-950/20" : ""}
                  ${dayStatus === "completed" ? "bg-green-50 dark:bg-green-950/20" : ""}
                  hover:bg-muted/50 transition-colors
                `}
                onClick={() => handleDayClick(day)}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-2">
                  <div className={`
                    text-sm font-medium
                    ${isCurrentDay 
                      ? "w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center" 
                      : !isCurrentMonth ? "text-muted-foreground/50" : ""
                    }
                    ${dayStatus === "overdue" ? "text-red-600 dark:text-red-400" : ""}
                  `}>
                    {format(day, "d")}
                  </div>
                  
                  {/* Add task button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTaskClick(day);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {dayTasks.slice(0, viewMode === "week" ? 10 : 3).map((task) => {
                    const { project, company } = getTaskInfo(task);
                    const isOverdue = task.status !== "completed" && isPast(day) && !isToday(day);
                    
                    return (
                      <motion.div
                        key={task.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTaskNavigate(task);
                        }}
                        className={`
                          text-xs p-1.5 rounded cursor-pointer truncate
                          transition-all duration-200
                          ${task.status === "completed" 
                            ? "bg-green-500 text-white" 
                            : task.status === "in_progress"
                              ? "bg-amber-500 text-white"
                              : isOverdue
                                ? "bg-red-500 text-white"
                                : "bg-primary/10 text-primary border border-primary/20"
                          }
                        `}
                      >
                        <div className="flex items-center gap-1">
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-3 w-3 flex-shrink-0" />
                          ) : isOverdue ? (
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <Circle className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="truncate">{task.title}</span>
                          {task.recurrence && (
                            <RefreshCw className="h-2.5 w-2.5 flex-shrink-0 ml-auto" />
                          )}
                        </div>
                        {showAllCompanies && company && (
                          <div className="text-[10px] opacity-75 mt-0.5 truncate">
                            {company.name}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  {dayTasks.length > (viewMode === "week" ? 10 : 3) && (
                    <div className="text-xs text-muted-foreground text-center py-1 bg-muted/50 rounded">
                      +{dayTasks.length - (viewMode === "week" ? 10 : 3)} mais
                    </div>
                  )}
                </div>

                {/* Task count badge for busy days */}
                {dayTasks.length > 0 && viewMode === "month" && (
                  <div className="absolute top-2 right-8">
                    <Badge 
                      variant="secondary" 
                      className={`
                        h-5 w-5 p-0 flex items-center justify-center text-xs
                        ${dayStatus === "overdue" ? "bg-red-500 text-white" : ""}
                        ${dayStatus === "today" ? "bg-orange-500 text-white" : ""}
                        ${dayStatus === "completed" ? "bg-green-500 text-white" : ""}
                        ${dayStatus === "in_progress" ? "bg-amber-500 text-white" : ""}
                      `}
                    >
                      {dayTasks.length}
                    </Badge>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-muted-foreground">Atrasado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span className="text-muted-foreground">Hoje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-muted-foreground">Em andamento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-muted-foreground">Concluído</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
          <span className="text-muted-foreground">Pendente</span>
        </div>
      </div>

      {/* Tasks without dates */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3 text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Tarefas sem data definida ({tasks.filter(t => !t.due_date).length})
          </h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {tasks.filter(t => !t.due_date).slice(0, 6).map((task) => {
              const { project, company } = getTaskInfo(task);
              
              return (
                <motion.div
                  key={task.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => handleTaskNavigate(task)}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer border
                    transition-all duration-200 hover:shadow-sm
                    ${task.status === "completed" ? "bg-green-500/5 border-green-500/20" : "bg-card"}
                  `}
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
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : task.status === "in_progress" ? (
                      <Clock className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm truncate block ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </span>
                    {showAllCompanies && company && (
                      <span className="text-xs text-muted-foreground truncate block">{company.name}</span>
                    )}
                  </div>
                  {task.priority === "high" && (
                    <Badge variant="destructive" className="text-xs ml-auto">!</Badge>
                  )}
                </motion.div>
              );
            })}
          </div>
          {tasks.filter(t => !t.due_date).length > 6 && (
            <p className="text-sm text-muted-foreground mt-3 text-center">
              E mais {tasks.filter(t => !t.due_date).length - 6} tarefas...
            </p>
          )}
        </Card>
      )}

      {/* Day Tasks Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDayDialog(false);
                  if (selectedDate) handleAddTaskClick(selectedDate);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-2">
              {selectedDayTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma tarefa para este dia</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setShowDayDialog(false);
                      if (selectedDate) handleAddTaskClick(selectedDate);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar tarefa
                  </Button>
                </div>
              ) : (
                selectedDayTasks.map(task => {
                  const { project, company } = getTaskInfo(task);
                  const isOverdue = task.status !== "completed" && selectedDate && isPast(selectedDate) && !isToday(selectedDate);

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleTaskNavigate(task)}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-all
                        hover:shadow-md hover:border-primary/50
                        ${task.status === "completed" 
                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50" 
                          : task.status === "in_progress"
                            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                            : isOverdue
                              ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                              : "bg-card"
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className="mt-0.5">
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-5 w-5 text-amber-600" />
                          ) : isOverdue ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>

                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {company && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{company.name}</span>
                              </div>
                            )}
                            {project && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{project.product_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Navigate icon */}
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {selectedDayTasks.length > 0 && (
            <div className="text-center text-xs text-muted-foreground pt-2 border-t">
              Clique em uma tarefa para abrir no projeto
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nova Tarefa
              {selectedDate && (
                <Badge variant="outline" className="ml-2">
                  {format(selectedDate, "dd/MM/yyyy")}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título da Tarefa *</Label>
              <Input
                id="task-title"
                placeholder="Ex: Reunião de alinhamento..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>

            {/* Only show project selector if not in single project mode */}
            {!singleProjectId && (
              <div className="space-y-2">
                <Label htmlFor="task-project">Projeto *</Label>
                <Select value={newTaskProjectId} onValueChange={setNewTaskProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => {
                      const company = project.onboarding_company_id 
                        ? companyMap.get(project.onboarding_company_id) 
                        : null;
                      return (
                        <SelectItem key={project.id} value={project.id}>
                          <span className="flex items-center gap-2">
                            {company && <span className="text-muted-foreground">{company.name} -</span>}
                            <span>{project.product_name}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Phase selector */}
            <div className="space-y-2">
              <Label htmlFor="task-phase">Fase</Label>
              <Select value={newTaskPhase} onValueChange={setNewTaskPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fase (opcional)..." />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PHASES.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsible staff selector */}
            {staffList.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="task-responsible">Responsável</Label>
                <Select value={newTaskResponsibleId} onValueChange={setNewTaskResponsibleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        <span className="flex items-center gap-2">
                          <span>{staff.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({staff.role === "consultant" ? "Consultor" : staff.role === "cs" ? "CS" : staff.role})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Recurrence selector */}
            <RecurrenceSelector
              value={newTaskRecurrence}
              onChange={setNewTaskRecurrence}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddTask} 
              disabled={!newTaskTitle.trim() || (!singleProjectId && !newTaskProjectId) || addingTask}
            >
              {addingTask ? "Adicionando..." : "Adicionar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
