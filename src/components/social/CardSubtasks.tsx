import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, ChevronRight, ChevronDown, GripVertical, ArrowUpDown, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  parent_subtask_id: string | null;
  due_date: string | null;
  created_at: string;
  children?: Subtask[];
}

interface CardSubtasksProps {
  cardId: string;
  disabled?: boolean;
}

type SortOption = "manual" | "name" | "due_date" | "created_at";

export function CardSubtasks({ cardId, disabled }: CardSubtasksProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [addingToParent, setAddingToParent] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("manual");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

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

  const sortSubtasks = useCallback((items: Subtask[]): Subtask[] => {
    const sorted = [...items];
    
    switch (sortOption) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
        break;
      case "due_date":
        sorted.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        break;
      case "created_at":
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      default:
        // manual - keep sort_order
        sorted.sort((a, b) => a.sort_order - b.sort_order);
    }

    // Sort children recursively
    return sorted.map(item => ({
      ...item,
      children: item.children ? sortSubtasks(item.children) : []
    }));
  }, [sortOption]);

  const displayedSubtasks = sortSubtasks(subtasks);

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

  const handleUpdateDueDate = async (subtaskId: string, date: Date | undefined) => {
    try {
      const { error } = await supabase
        .from("social_card_subtasks")
        .update({
          due_date: date ? date.toISOString() : null,
        })
        .eq("id", subtaskId);

      if (error) throw error;
      loadSubtasks();
    } catch (error) {
      console.error("Error updating due date:", error);
      toast.error("Erro ao atualizar data");
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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, subtaskId: string) => {
    if (disabled || sortOption !== "manual") return;
    setDraggedItem(subtaskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", subtaskId);
  };

  const handleDragOver = (e: React.DragEvent, subtaskId: string) => {
    if (disabled || sortOption !== "manual") return;
    e.preventDefault();
    if (subtaskId !== draggedItem) {
      setDragOverItem(subtaskId);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetSubtaskId: string) => {
    e.preventDefault();
    if (disabled || sortOption !== "manual" || !draggedItem || draggedItem === targetSubtaskId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      // Find both subtasks in the flat list
      const flatList = flattenSubtasks(subtasks);
      const draggedIndex = flatList.findIndex(s => s.id === draggedItem);
      const targetIndex = flatList.findIndex(s => s.id === targetSubtaskId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Calculate new sort orders
      const updatedList = [...flatList];
      const [movedItem] = updatedList.splice(draggedIndex, 1);
      updatedList.splice(targetIndex, 0, movedItem);

      // Update sort_order for all items that share the same parent
      const parentId = movedItem.parent_subtask_id;
      const siblingItems = updatedList.filter(s => s.parent_subtask_id === parentId);
      
      for (let i = 0; i < siblingItems.length; i++) {
        await supabase
          .from("social_card_subtasks")
          .update({ sort_order: i + 1 })
          .eq("id", siblingItems[i].id);
      }

      loadSubtasks();
      toast.success("Ordem atualizada");
    } catch (error) {
      console.error("Error reordering:", error);
      toast.error("Erro ao reordenar");
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const flattenSubtasks = (items: Subtask[]): Subtask[] => {
    const result: Subtask[] = [];
    const flatten = (list: Subtask[]) => {
      for (const item of list) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      }
    };
    flatten(items);
    return result;
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

  const getSortLabel = () => {
    switch (sortOption) {
      case "name": return "Nome";
      case "due_date": return "Data de entrega";
      case "created_at": return "Data de criação";
      default: return "Manual";
    }
  };

  const renderSubtask = (subtask: Subtask, depth: number = 0) => {
    const hasChildren = subtask.children && subtask.children.length > 0;
    const isExpanded = expandedSubtasks.has(subtask.id);
    const isAddingChild = addingToParent === subtask.id;
    const isDragging = draggedItem === subtask.id;
    const isDragOver = dragOverItem === subtask.id;

    return (
      <div key={subtask.id}>
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-md group hover:bg-muted/50 transition-colors",
            subtask.is_completed && "opacity-60",
            isDragging && "opacity-50 bg-muted",
            isDragOver && "border-t-2 border-primary"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          draggable={!disabled && sortOption === "manual"}
          onDragStart={(e) => handleDragStart(e, subtask.id)}
          onDragOver={(e) => handleDragOver(e, subtask.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, subtask.id)}
          onDragEnd={handleDragEnd}
        >
          {/* Drag handle */}
          {!disabled && sortOption === "manual" && (
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
          )}

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

          {/* Due date badge */}
          {subtask.due_date && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              new Date(subtask.due_date) < new Date() && !subtask.is_completed
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            )}>
              {format(new Date(subtask.due_date), "dd/MM", { locale: ptBR })}
            </span>
          )}

          {!disabled && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Definir data de entrega"
                  >
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={subtask.due_date ? new Date(subtask.due_date) : undefined}
                    onSelect={(date) => handleUpdateDueDate(subtask.id, date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

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
      {/* Header with sort options */}
      <div className="flex items-center justify-between">
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} concluídas
          </span>
        )}
        
        {totalCount > 0 && !disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <ArrowUpDown className="h-3 w-3" />
                Ordenar: {getSortLabel()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOption("manual")}>
                Manual (arrastar)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("name")}>
                Por nome
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("due_date")}>
                Por data de entrega
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("created_at")}>
                Por data de criação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Progress indicator */}
      {totalCount > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-0.5">
        {displayedSubtasks.map((subtask) => renderSubtask(subtask))}
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
