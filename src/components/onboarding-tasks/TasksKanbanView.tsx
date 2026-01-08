import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertTriangle,
  RefreshCw,
  EyeOff,
  User,
  GripVertical,
} from "lucide-react";
import { format, parseISO, isBefore, startOfDay, isToday } from "date-fns";
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

interface TasksKanbanViewProps {
  tasks: OnboardingTask[];
  onTaskClick: (task: OnboardingTask) => void;
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
}

const COLUMNS = [
  { 
    id: "pending" as const, 
    title: "A Fazer", 
    icon: Circle,
    color: "bg-slate-500",
    headerBg: "bg-slate-500/10",
    borderColor: "border-t-slate-500",
  },
  { 
    id: "in_progress" as const, 
    title: "Em Andamento", 
    icon: Clock,
    color: "bg-amber-500",
    headerBg: "bg-amber-500/10",
    borderColor: "border-t-amber-500",
  },
  { 
    id: "completed" as const, 
    title: "Concluído", 
    icon: CheckCircle2,
    color: "bg-emerald-500",
    headerBg: "bg-emerald-500/10",
    borderColor: "border-t-emerald-500",
  },
];

const isTaskOverdue = (task: OnboardingTask): boolean => {
  if (task.status === "completed" || !task.due_date) return false;
  const today = startOfDay(new Date());
  const dueDate = parseISO(task.due_date);
  return isBefore(startOfDay(dueDate), today) && !isToday(dueDate);
};

const isTaskDueToday = (task: OnboardingTask): boolean => {
  if (!task.due_date) return false;
  return isToday(parseISO(task.due_date));
};

export const TasksKanbanView = ({ tasks, onTaskClick, onStatusChange }: TasksKanbanViewProps) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const tasksByStatus = useMemo(() => {
    return {
      pending: tasks.filter(t => t.status === "pending"),
      in_progress: tasks.filter(t => t.status === "in_progress"),
      completed: tasks.filter(t => t.status === "completed"),
    };
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: "pending" | "in_progress" | "completed") => {
    e.preventDefault();
    if (draggedTask) {
      const task = tasks.find(t => t.id === draggedTask);
      if (task && task.status !== newStatus) {
        onStatusChange(draggedTask, newStatus);
      }
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const TaskCard = ({ task }: { task: OnboardingTask }) => {
    const overdue = isTaskOverdue(task);
    const dueToday = isTaskDueToday(task);
    const isCompleted = task.status === "completed";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        draggable
        onDragStart={(e) => handleDragStart(e as any, task.id)}
        onClick={() => onTaskClick(task)}
        className={`
          group p-3 rounded-lg border cursor-pointer transition-all
          hover:shadow-md hover:border-primary/30
          ${isCompleted 
            ? "bg-emerald-500/5 border-emerald-500/20" 
            : overdue
            ? "bg-red-500/5 border-red-500/30"
            : dueToday
            ? "bg-amber-500/5 border-amber-500/20"
            : "bg-card border-border"
          }
          ${draggedTask === task.id ? "opacity-50 scale-95" : ""}
        `}
      >
        {/* Drag Handle */}
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title */}
            <p className={`
              text-sm font-medium line-clamp-2
              ${isCompleted ? "line-through text-muted-foreground" : ""}
              ${overdue ? "text-red-600" : ""}
            `}>
              {task.title}
            </p>

            {/* Meta Info */}
            <div className="flex items-center gap-2 flex-wrap">
              {task.priority === "high" && !isCompleted && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  Alta
                </Badge>
              )}
              
              {task.is_internal && (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
              
              {task.recurrence && (
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              )}
              
              {overdue && !isCompleted && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-red-500/50 text-red-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Atrasada
                </Badge>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {task.due_date && (
                <span className={`
                  flex items-center gap-1
                  ${overdue ? "text-red-600" : dueToday ? "text-amber-600" : ""}
                `}>
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(task.due_date), "dd/MM")}
                </span>
              )}
              
              {(task.responsible_staff || task.assignee) && (
                <span className="flex items-center gap-1 truncate max-w-[100px]">
                  <User className="h-3 w-3" />
                  {task.responsible_staff?.name || task.assignee?.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {COLUMNS.map(column => {
        const columnTasks = tasksByStatus[column.id];
        const Icon = column.icon;
        const isOver = dragOverColumn === column.id;

        return (
          <Card 
            key={column.id}
            className={`
              flex flex-col overflow-hidden border-t-4 transition-all
              ${column.borderColor}
              ${isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}
            `}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <CardHeader className={`py-3 ${column.headerBg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${column.color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {column.title}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {columnTasks.length}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 p-2 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-380px)] pr-2">
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">
                    {columnTasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                    
                    {columnTasks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <div className={`mx-auto w-12 h-12 rounded-full ${column.headerBg} flex items-center justify-center mb-2`}>
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        Nenhuma tarefa
                      </div>
                    )}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
