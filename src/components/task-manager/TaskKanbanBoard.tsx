import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";
import type { Database } from "@/integrations/supabase/types";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

type TaskStatus = Database["public"]["Enums"]["onboarding_task_status"];

const COLUMNS: { id: TaskStatus | "overdue"; label: string; color: string }[] = [
  { id: "overdue", label: "Em Atraso", color: "border-t-red-500" },
  { id: "pending", label: "Pendente", color: "border-t-yellow-500" },
  { id: "in_progress", label: "Em Progresso", color: "border-t-blue-500" },
  { id: "completed", label: "Concluída", color: "border-t-green-500" },
];

interface Props {
  tasks: TaskWithProject[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: TaskWithProject) => void;
  selectedTaskIds?: Set<string>;
  onToggleSelection?: (taskId: string) => void;
}

export const TaskKanbanBoard = ({ tasks, onStatusChange, onTaskClick, selectedTaskIds, onToggleSelection }: Props) => {
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByColumn = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map: Record<string, TaskWithProject[]> = {
      overdue: [],
      pending: [],
      in_progress: [],
      completed: [],
    };

    tasks.forEach(t => {
      if (t.status === "inactive") return;

      const isOverdue = t.due_date && new Date(t.due_date) < today && t.status !== "completed";
      if (isOverdue) {
        map.overdue.push(t);
      } else if (map[t.status]) {
        map[t.status].push(t);
      }
    });

    return map;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumn = over.id as string;

    const newStatus: TaskStatus = targetColumn === "overdue" ? "pending" : targetColumn as TaskStatus;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && ["pending", "in_progress", "completed"].includes(newStatus)) {
      onStatusChange(taskId, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[calc(100vh-180px)]">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            tasks={tasksByColumn[col.id] || []}
            count={tasksByColumn[col.id]?.length || 0}
            onTaskClick={onTaskClick}
            selectedTaskIds={selectedTaskIds}
            onToggleSelection={onToggleSelection}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
};
