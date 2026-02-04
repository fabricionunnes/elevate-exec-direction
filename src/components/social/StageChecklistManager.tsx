import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : -1;

      const { error } = await supabase
        .from("social_stage_checklists")
        .insert({
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
          <Settings className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checklist da Etapa: {stageName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new item form */}
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label>Título do item</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Revisar texto"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detalhes sobre o que precisa ser feito..."
                rows={2}
              />
            </div>
            <Button onClick={handleAdd} disabled={saving || !newTitle.trim()} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar Item
            </Button>
          </div>

          {/* Existing items list */}
          <div className="space-y-2">
            <Label>Itens do Checklist ({items.length})</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum item configurado. Adicione itens acima.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 p-3 bg-background border rounded-lg"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 cursor-move" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Quando todos os itens forem marcados como concluídos, o card avançará automaticamente para a próxima etapa.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
