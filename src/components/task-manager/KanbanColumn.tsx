import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./TaskCard";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";

interface Props {
  id: string;
  label: string;
  color: string;
  tasks: TaskWithProject[];
  count: number;
  onTaskClick: (task: TaskWithProject) => void;
  selectedTaskIds?: Set<string>;
  onToggleSelection?: (taskId: string) => void;
}

export const KanbanColumn = ({ id, label, color, tasks, count, onTaskClick, selectedTaskIds, onToggleSelection }: Props) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border-t-4 ${color} bg-muted/30 transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">{label}</h3>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      <ScrollArea className="flex-1 p-2" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} onClick={() => onTaskClick(task)} className="cursor-pointer">
              <TaskCard
                task={task}
                isSelected={selectedTaskIds?.has(task.id)}
                onToggleSelection={onToggleSelection}
              />
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma tarefa
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
