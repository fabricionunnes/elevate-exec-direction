import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarDays, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";

interface Props {
  task: TaskWithProject;
  isDragging?: boolean;
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  high: { label: "Alta", class: "bg-red-500/10 text-red-600 border-red-500/20" },
  medium: { label: "Média", class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  low: { label: "Baixa", class: "bg-green-500/10 text-green-600 border-green-500/20" },
};

export const TaskCard = React.forwardRef<HTMLDivElement, Props>(({ task, isDragging }, _ref) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const priority = task.priority ? priorityConfig[task.priority] : null;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md ${
        isDragging ? "opacity-80 shadow-lg ring-2 ring-primary/30 rotate-2" : ""
      } ${isOverdue ? "border-red-500/40" : ""}`}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.company_name}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.project_name}</span>
        </div>

        {task.due_date && (
          <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>{format(new Date(task.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {priority && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priority.class}`}>
              {priority.label}
            </Badge>
          )}
          {task.recurrence && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              🔄 {task.recurrence}
            </Badge>
          )}
          {task.tags?.slice(0, 2).map(tag => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
});

TaskCard.displayName = "TaskCard";
