import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface TaskSubtasksProps {
  taskId: string;
  projectId: string;
  canEdit: boolean;
}

export const TaskSubtasks = ({ taskId, projectId, canEdit }: TaskSubtasksProps) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubtasks();
    getCurrentUser();
  }, [taskId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .single();
      
      if (onboardingUser) {
        setCurrentUserId(onboardingUser.id);
      }
    }
  };

  const fetchSubtasks = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("sort_order");

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error: any) {
      console.error("Error fetching subtasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const addSubtask = async () => {
    if (!newTitle.trim()) return;

    try {
      const maxOrder = Math.max(...subtasks.map((s) => s.sort_order), 0);
      const { error } = await supabase.from("onboarding_subtasks").insert({
        task_id: taskId,
        title: newTitle.trim(),
        sort_order: maxOrder + 1,
      });

      if (error) throw error;
      setNewTitle("");
      fetchSubtasks();
    } catch (error: any) {
      console.error("Error adding subtask:", error);
      toast.error("Erro ao adicionar subtarefa");
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      const { error } = await supabase
        .from("onboarding_subtasks")
        .update({
          is_completed: !subtask.is_completed,
          completed_at: !subtask.is_completed ? new Date().toISOString() : null,
          completed_by: !subtask.is_completed ? currentUserId : null,
        })
        .eq("id", subtask.id);

      if (error) throw error;
      fetchSubtasks();
    } catch (error: any) {
      console.error("Error toggling subtask:", error);
      toast.error("Erro ao atualizar subtarefa");
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from("onboarding_subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) throw error;
      fetchSubtasks();
    } catch (error: any) {
      console.error("Error deleting subtask:", error);
      toast.error("Erro ao remover subtarefa");
    }
  };

  const completedCount = subtasks.filter((s) => s.is_completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">
          Subtarefas ({completedCount}/{subtasks.length})
        </h4>
      </div>

      {subtasks.length > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${subtasks.length ? (completedCount / subtasks.length) * 100 : 0}%` }}
          />
        </div>
      )}

      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50"
          >
            <Checkbox
              checked={subtask.is_completed}
              onCheckedChange={() => toggleSubtask(subtask)}
            />
            <span
              className={`flex-1 text-sm ${
                subtask.is_completed ? "line-through text-muted-foreground" : ""
              }`}
            >
              {subtask.title}
            </span>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => deleteSubtask(subtask.id)}
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="Nova subtarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubtask()}
          />
          <Button onClick={addSubtask} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
