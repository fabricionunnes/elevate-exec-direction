import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  parent_subtask_id: string | null;
  children?: Subtask[];
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
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [addingToParent, setAddingToParent] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");

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

      // Organize into hierarchy
      const organized = organizeSubtasks(data || []);
      setSubtasks(organized);
    } catch (error) {
      console.error("Error loading subtasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const organizeSubtasks = (flatSubtasks: Subtask[]): Subtask[] => {
    const subtaskMap = new Map<string, Subtask>();
    const rootSubtasks: Subtask[] = [];

    // First pass: create map
    flatSubtasks.forEach(subtask => {
      subtaskMap.set(subtask.id, { ...subtask, children: [] });
    });

    // Second pass: build hierarchy
    flatSubtasks.forEach(subtask => {
      const current = subtaskMap.get(subtask.id)!;
      if (subtask.parent_subtask_id && subtaskMap.has(subtask.parent_subtask_id)) {
        const parent = subtaskMap.get(subtask.parent_subtask_id)!;
        parent.children = parent.children || [];
        parent.children.push(current);
      } else {
        rootSubtasks.push(current);
      }
    });

    return rootSubtasks;
  };

  const handleAddSubtask = async (parentId: string | null = null) => {
    const title = parentId ? newChildTitle : newTitle;
    if (!title.trim()) return;

    setAdding(true);
    try {
      // Get all subtasks for this card to determine max order
      const { data: allSubtasks } = await supabase
        .from("social_card_subtasks")
        .select("sort_order")
        .eq("card_id", cardId);

      const maxOrder = allSubtasks && allSubtasks.length > 0
        ? Math.max(...allSubtasks.map(s => s.sort_order))
        : 0;

      const { error } = await supabase
        .from("social_card_subtasks")
        .insert({
          card_id: cardId,
          title: title.trim(),
          sort_order: maxOrder + 1,
          parent_subtask_id: parentId,
        });

      if (error) throw error;

      if (parentId) {
        setNewChildTitle("");
        setAddingToParent(null);
        // Auto-expand parent when adding child
        setExpandedSubtasks(prev => new Set([...prev, parentId]));
      } else {
        setNewTitle("");
      }
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

  const toggleExpand = (id: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const countAllSubtasks = (items: Subtask[]): { completed: number; total: number } => {
    let completed = 0;
    let total = 0;

    const count = (list: Subtask[]) => {
      for (const item of list) {
        total++;
        if (item.is_completed) completed++;
        if (item.children && item.children.length > 0) {
          count(item.children);
        }
      }
    };

    count(items);
    return { completed, total };
  };

  const { completed: completedCount, total: totalCount } = countAllSubtasks(subtasks);

  const renderSubtask = (subtask: Subtask, depth: number = 0) => {
    const hasChildren = subtask.children && subtask.children.length > 0;
    const isExpanded = expandedSubtasks.has(subtask.id);
    const isAddingChild = addingToParent === subtask.id;

    return (
      <div key={subtask.id}>
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-md group hover:bg-muted/50 transition-colors",
            subtask.is_completed && "opacity-60"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {/* Expand/collapse button or spacer */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpand(subtask.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <div className="w-5" />
          )}

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
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setAddingToParent(subtask.id);
                  setExpandedSubtasks(prev => new Set([...prev, subtask.id]));
                }}
                title="Adicionar subtarefa"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleDelete(subtask.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {/* Render children */}
        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            {subtask.children?.map(child => renderSubtask(child, depth + 1))}
            
            {/* Add child subtask input */}
            {isAddingChild && !disabled && (
              <div
                className="flex items-center gap-2 py-2"
                style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}
              >
                <Input
                  placeholder="Nova subtarefa..."
                  value={newChildTitle}
                  onChange={(e) => setNewChildTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !adding) {
                      handleAddSubtask(subtask.id);
                    }
                    if (e.key === "Escape") {
                      setAddingToParent(null);
                      setNewChildTitle("");
                    }
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddSubtask(subtask.id)}
                  disabled={adding || !newChildTitle.trim()}
                  className="h-7 px-2"
                >
                  {adding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingToParent(null);
                    setNewChildTitle("");
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

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
      <div className="space-y-0.5">
        {subtasks.map((subtask) => renderSubtask(subtask))}
      </div>

      {/* Add new root subtask */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nova subtarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) {
                handleAddSubtask(null);
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddSubtask(null)}
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
