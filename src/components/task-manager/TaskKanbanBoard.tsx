import { useMemo } from "react";
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
import { useState } from "react";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";
import type { Database } from "@/integrations/supabase/types";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

type TaskStatus = Database["public"]["Enums"]["onboarding_task_status"];

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "pending", label: "Pendente", color: "border-t-yellow-500" },
  { id: "in_progress", label: "Em Progresso", color: "border-t-blue-500" },
  { id: "completed", label: "Concluída", color: "border-t-green-500" },
];

interface Props {
  tasks: TaskWithProject[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

export const TaskKanbanBoard = ({ tasks, onStatusChange }: Props) => {
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskWithProject[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      inactive: [],
    };
    tasks.forEach(t => {
      if (t.status !== "inactive") {
        map[t.status]?.push(t);
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
    const newStatus = over.id as TaskStatus;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && COLUMNS.some(c => c.id === newStatus)) {
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[calc(100vh-180px)]">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            tasks={tasksByStatus[col.id] || []}
            count={tasksByStatus[col.id]?.length || 0}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
};
