import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths, 
  isToday, 
  startOfWeek, 
  endOfWeek, 
  addDays,
  isPast
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal, toDateString } from "@/lib/dateUtils";

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

interface ClientCalendarViewProps {
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
}

export const ClientCalendarView = ({ tasks, onTaskClick }: ClientCalendarViewProps) => {
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
        // Use parseDateLocal to avoid timezone issues with date-only strings
        const taskDate = parseDateLocal(task.due_date);
        const dateKey = toDateString(taskDate);
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

  const getStatusStyles = (status: string, dueDate: string | null) => {
    if (status === "completed") {
      return "bg-emerald-500 text-white";
    }
    if (status === "in_progress") {
      return "bg-amber-500 text-white";
    }
    if (dueDate && isPast(new Date(dueDate)) && !isToday(new Date(dueDate))) {
      return "bg-red-500/90 text-white";
    }
    return "bg-primary/10 text-primary border border-primary/20";
  };

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

  const tasksWithoutDate = tasks.filter(t => !t.due_date);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold min-w-[140px] text-center capitalize">
              {viewMode === "month" 
                ? format(currentDate, "MMM yyyy", { locale: ptBR })
                : `${format(weekStart, "dd")} - ${format(weekEnd, "dd MMM", { locale: ptBR })}`
              }
            </h2>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
            <CalendarIcon className="h-3 w-3 mr-1" />
            Hoje
          </Button>
        </div>

        <div className="flex items-center justify-between">
          {/* View Toggle */}
          <div className="flex rounded-lg border p-0.5 bg-muted/50">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setViewMode("month")}
            >
              Mês
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setViewMode("week")}
            >
              Semana
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Circle className="h-2 w-2 fill-primary text-primary" />
              {pendingThisMonth}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
              {inProgressThisMonth}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
              {completedThisMonth}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekDays.map((day) => (
            <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={`grid grid-cols-7 ${viewMode === "week" ? "" : ""}`}>
          {days.map((day, index) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const maxTasks = viewMode === "week" ? 6 : 2;

            return (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.005 }}
                className={`
                  min-h-[80px] border-b border-r p-1.5 relative
                  ${viewMode === "week" ? "min-h-[140px]" : ""}
                  ${!isCurrentMonth && viewMode === "month" ? "bg-muted/30" : "bg-card"}
                  ${isCurrentDay ? "ring-2 ring-primary ring-inset" : ""}
                `}
              >
                {/* Day Number */}
                <div className={`
                  text-xs font-medium mb-1
                  ${isCurrentDay 
                    ? "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs" 
                    : !isCurrentMonth ? "text-muted-foreground/50" : ""
                  }
                `}>
                  {format(day, "d")}
                </div>

                {/* Tasks */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, maxTasks).map((task) => {
                    const responsibleName = getResponsibleName(task);
                    return (
                      <motion.div
                        key={task.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onTaskClick(task)}
                        className={`
                          text-[10px] p-1 rounded cursor-pointer
                          transition-all duration-200
                          ${getStatusStyles(task.status, task.due_date)}
                        `}
                      >
                        <div className="flex items-center gap-0.5">
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                          ) : (
                            <Circle className="h-2.5 w-2.5 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1">{task.title}</span>
                        </div>
                        {viewMode === "week" && responsibleName && (
                          <div className="flex items-center gap-1 mt-0.5 opacity-75">
                            <Avatar className="h-3 w-3">
                              <AvatarFallback className="text-[6px]">
                                {getInitials(responsibleName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[8px] truncate">
                              {task.assignee?.role === "client" ? "Você" : responsibleName.split(" ")[0]}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  {dayTasks.length > maxTasks && (
                    <div 
                      onClick={() => {
                        if (dayTasks.length > 0) onTaskClick(dayTasks[maxTasks]);
                      }}
                      className="text-[9px] text-muted-foreground text-center py-0.5 cursor-pointer hover:text-primary"
                    >
                      +{dayTasks.length - maxTasks}
                    </div>
                  )}
                </div>

                {/* Task count badge for busy days */}
                {dayTasks.length > 0 && viewMode === "month" && (
                  <div className="absolute top-1 right-1">
                    <Badge 
                      variant="secondary" 
                      className="h-4 w-4 p-0 flex items-center justify-center text-[9px]"
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
      {tasksWithoutDate.length > 0 && (
        <Card className="p-3">
          <h3 className="font-medium text-sm mb-2 text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            Sem data ({tasksWithoutDate.length})
          </h3>
          <div className="space-y-1.5">
            {tasksWithoutDate.slice(0, 4).map((task) => {
              const responsibleName = getResponsibleName(task);
              return (
                <motion.div
                  key={task.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onTaskClick(task)}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg cursor-pointer border
                    transition-all duration-200
                    ${task.status === "completed" 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-card hover:bg-muted/50"}
                  `}
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  ) : task.status === "in_progress" ? (
                    <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate flex-1 ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </span>
                  {responsibleName && (
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      <AvatarFallback className="text-[8px] bg-primary/10">
                        {getInitials(responsibleName)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              );
            })}
            {tasksWithoutDate.length > 4 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{tasksWithoutDate.length - 4} mais
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
