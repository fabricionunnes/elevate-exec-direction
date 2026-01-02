import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, startOfWeek, endOfWeek, addDays } from "date-fns";
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

interface TasksScheduleViewProps {
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
}

export const TasksScheduleView = ({ tasks, onTaskClick, onStatusChange }: TasksScheduleViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

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
        const dateKey = format(new Date(task.due_date), "yyyy-MM-dd");
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

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500 text-white";
      case "in_progress":
        return "bg-amber-500 text-white";
      default:
        return "bg-primary/10 text-primary border border-primary/20";
    }
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Stats for the header
  const tasksThisMonth = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
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

            return (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className={`
                  min-h-[100px] border-b border-r p-2 relative
                  ${viewMode === "week" ? "min-h-[200px]" : ""}
                  ${!isCurrentMonth && viewMode === "month" ? "bg-muted/30" : "bg-card"}
                  ${isCurrentDay ? "ring-2 ring-primary ring-inset" : ""}
                `}
              >
                {/* Day Number */}
                <div className={`
                  text-sm font-medium mb-2
                  ${isCurrentDay 
                    ? "w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center" 
                    : !isCurrentMonth ? "text-muted-foreground/50" : ""
                  }
                `}>
                  {format(day, "d")}
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {dayTasks.slice(0, viewMode === "week" ? 10 : 3).map((task) => (
                    <motion.div
                      key={task.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => onTaskClick(task)}
                      className={`
                        text-xs p-1.5 rounded cursor-pointer truncate
                        transition-all duration-200
                        ${getStatusStyles(task.status)}
                      `}
                    >
                      <div className="flex items-center gap-1">
                        {task.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        ) : task.status === "in_progress" ? (
                          <Clock className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{task.title}</span>
                        {task.recurrence && (
                          <RefreshCw className="h-2.5 w-2.5 flex-shrink-0 ml-auto" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {dayTasks.length > (viewMode === "week" ? 10 : 3) && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{dayTasks.length - (viewMode === "week" ? 10 : 3)} mais
                    </div>
                  )}
                </div>

                {/* Task count badge for busy days */}
                {dayTasks.length > 0 && viewMode === "month" && (
                  <div className="absolute top-2 right-2">
                    <Badge 
                      variant="secondary" 
                      className="h-5 w-5 p-0 flex items-center justify-center text-xs"
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

      {/* Tasks without dates */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3 text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Tarefas sem data definida ({tasks.filter(t => !t.due_date).length})
          </h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {tasks.filter(t => !t.due_date).slice(0, 6).map((task) => (
              <motion.div
                key={task.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => onTaskClick(task)}
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
                <span className={`text-sm truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </span>
                {task.priority === "high" && (
                  <Badge variant="destructive" className="text-xs ml-auto">!</Badge>
                )}
              </motion.div>
            ))}
          </div>
          {tasks.filter(t => !t.due_date).length > 6 && (
            <p className="text-sm text-muted-foreground mt-3 text-center">
              E mais {tasks.filter(t => !t.due_date).length - 6} tarefas...
            </p>
          )}
        </Card>
      )}
    </div>
  );
};