import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock, Clock, CheckCircle2, Circle } from "lucide-react";
import { format, isToday, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface Task {
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

interface ProjectUrgentTasksProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const ProjectUrgentTasks = ({ tasks, onTaskClick }: ProjectUrgentTasksProps) => {
  const today = startOfDay(new Date());

  const { overdueTasks, todayTasks } = useMemo(() => {
    const overdue: Task[] = [];
    const todayList: Task[] = [];

    tasks.forEach(task => {
      // Skip completed tasks (check both status and completed_at)
      if (task.status === "completed" || task.completed_at || !task.due_date) return;
      
      const dueDate = startOfDay(parseISO(task.due_date));
      
      if (isBefore(dueDate, today)) {
        overdue.push(task);
      } else if (isToday(dueDate)) {
        todayList.push(task);
      }
    });

    // Sort by due_date ascending
    overdue.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    todayList.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

    return { overdueTasks: overdue, todayTasks: todayList };
  }, [tasks, today]);

  if (overdueTasks.length === 0 && todayTasks.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResponsibleName = (task: Task) => {
    if (task.responsible_staff?.name) return task.responsible_staff.name;
    if (task.assignee?.name) return task.assignee.name;
    return null;
  };

  const renderTaskItem = (task: Task, isOverdue: boolean) => (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        isOverdue 
          ? "bg-destructive/10 hover:bg-destructive/20 border border-destructive/30" 
          : "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
      }`}
      onClick={() => onTaskClick(task)}
    >
      {getStatusIcon(task.status)}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{task.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span className={isOverdue ? "text-destructive font-medium" : "text-amber-600"}>
              {format(parseISO(task.due_date), "dd/MM", { locale: ptBR })}
            </span>
          )}
          {getResponsibleName(task) && (
            <>
              <span>•</span>
              <span>{getResponsibleName(task)}</span>
            </>
          )}
        </div>
      </div>
      {task.priority === "high" && (
        <Badge variant="destructive" className="text-xs shrink-0">Alta</Badge>
      )}
    </motion.div>
  );

  return (
    <Card className="mb-6 border-2 border-dashed border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-destructive/5">
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="font-semibold text-destructive">
                  Tarefas em Atraso ({overdueTasks.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {overdueTasks.map(task => renderTaskItem(task, true))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          {todayTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-amber-600">
                  Tarefas de Hoje ({todayTasks.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {todayTasks.map(task => renderTaskItem(task, false))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
