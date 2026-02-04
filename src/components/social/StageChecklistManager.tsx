import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListChecks, Plus, Trash2, GripVertical, Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface StageChecklistManagerProps {
  stageId: string;
  stageName: string;
}

export const StageChecklistManager = ({ stageId, stageName }: StageChecklistManagerProps) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, stageId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("social_stage_checklists")
        .select("*")
        .eq("stage_id", stageId)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading checklist items:", error);
      toast.error("Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;

    setSaving(true);
    try {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : -1;

      const { error } = await supabase.from("social_stage_checklists").insert({
        stage_id: stageId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        sort_order: maxOrder + 1,
      });

      if (error) throw error;

      toast.success("Item adicionado!");
      setNewTitle("");
      setNewDescription("");
      loadItems();
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Erro ao adicionar item");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editTitle.trim()) return;

    try {
      const { error } = await supabase
        .from("social_stage_checklists")
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
        })
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Item atualizado!");
      setEditingId(null);
      loadItems();
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Erro ao atualizar item");
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("social_stage_checklists")
        .update({ is_active: false })
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Item removido!");
      loadItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Erro ao remover item");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs gap-1",
            items.length > 0
              ? "text-primary"
              : "opacity-0 group-hover:opacity-100"
          )}
        >
          <ListChecks className="h-3 w-3" />
          {items.length > 0 && <span>{items.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Checklist: {stageName}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Itens que precisam ser concluídos nesta etapa
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Existing items list */}
              {items.length > 0 && (
                <div className="p-2 space-y-1">
                  {items.map((item) => (
                    <div key={item.id}>
                      {editingId === item.id ? (
                        <div className="p-2 bg-muted rounded-lg space-y-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Título"
                            className="h-8 text-sm"
                          />
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Descrição (opcional)"
                            rows={2}
                            className="text-sm resize-none"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 flex-1"
                              onClick={() => handleSaveEdit(item.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 group/item">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 cursor-move opacity-0 group-hover/item:opacity-100" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover/item:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleStartEdit(item)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {items.length === 0 && !loading && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum item configurado
                </div>
              )}
            </>
          )}
        </div>

        {/* Add new item form */}
        <div className="border-t p-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Novo item..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  handleAdd();
                }
              }}
            />
            <Button
              size="sm"
              className="h-8"
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </div>
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        <div className="border-t p-2 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Cards avançam automaticamente ao completar todos os itens
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
