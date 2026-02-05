import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

interface CardSubtasksProps {
  cardId: string;
  disabled?: boolean;
}

export function CardSubtasks({ cardId, disabled }: CardSubtasksProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  useEffect(() => {
    loadSubtasks();
    loadCurrentStaff();
  }, [cardId]);

  const loadCurrentStaff = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setCurrentStaffId(data.id);
    }
  };

  const loadSubtasks = async () => {
    try {
      const { data, error } = await supabase
        .from("social_card_subtasks")
        .select("*")
        .eq("card_id", cardId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error("Error loading subtasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!newTitle.trim()) return;

    setAdding(true);
    try {
      const maxOrder = subtasks.length > 0 
        ? Math.max(...subtasks.map(s => s.sort_order)) 
        : 0;

      const { error } = await supabase
        .from("social_card_subtasks")
        .insert({
          card_id: cardId,
          title: newTitle.trim(),
          sort_order: maxOrder + 1,
        });

      if (error) throw error;
      
      setNewTitle("");
      loadSubtasks();
    } catch (error) {
      console.error("Error adding subtask:", error);
      toast.error("Erro ao adicionar subtarefa");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleComplete = async (subtask: Subtask) => {
    try {
      const { error } = await supabase
        .from("social_card_subtasks")
        .update({
          is_completed: !subtask.is_completed,
          completed_at: !subtask.is_completed ? new Date().toISOString() : null,
          completed_by: !subtask.is_completed ? currentStaffId : null,
        })
        .eq("id", subtask.id);

      if (error) throw error;
      loadSubtasks();
    } catch (error) {
      console.error("Error toggling subtask:", error);
      toast.error("Erro ao atualizar subtarefa");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("social_card_subtasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadSubtasks();
    } catch (error) {
      console.error("Error deleting subtask:", error);
      toast.error("Erro ao remover subtarefa");
    }
  };

  const completedCount = subtasks.filter(s => s.is_completed).length;
  const totalCount = subtasks.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress indicator */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{completedCount}/{totalCount} concluídas</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div 
            key={subtask.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md group hover:bg-muted/50 transition-colors",
              subtask.is_completed && "opacity-60"
            )}
          >
            <Checkbox
              checked={subtask.is_completed}
              onCheckedChange={() => handleToggleComplete(subtask)}
              disabled={disabled}
            />
            <span className={cn(
              "flex-1 text-sm",
              subtask.is_completed && "line-through text-muted-foreground"
            )}>
              {subtask.title}
            </span>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(subtask.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add new subtask */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nova subtarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) {
                handleAddSubtask();
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddSubtask}
            disabled={adding || !newTitle.trim()}
            className="h-8"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {subtasks.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Adicione subtarefas para organizar esta tarefa
        </p>
      )}
    </div>
  );
}
