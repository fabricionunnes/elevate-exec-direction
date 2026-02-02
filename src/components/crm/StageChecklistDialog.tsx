import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  Loader2, 
  GripVertical,
  ListChecks
} from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface StageChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stageName: string;
}

export function StageChecklistDialog({ 
  open, 
  onOpenChange, 
  stageId, 
  stageName 
}: StageChecklistDialogProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New item form
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    if (open && stageId) {
      loadItems();
    }
  }, [open, stageId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_stage_checklists")
        .select("*")
        .eq("stage_id", stageId)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading checklist items:", error);
      toast.error("Erro ao carregar checklist");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const maxOrder = items.length > 0 
        ? Math.max(...items.map(i => i.sort_order)) + 1 
        : 0;

      const { error } = await supabase
        .from("crm_stage_checklists")
        .insert({
          stage_id: stageId,
          title: newItemTitle,
          description: newItemDescription || null,
          sort_order: maxOrder,
          is_active: true,
        });

      if (error) throw error;
      
      toast.success("Item adicionado ao checklist");
      resetForm();
      loadItems();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("crm_stage_checklists")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      
      toast.success("Item removido");
      setItems(items.filter(i => i.id !== itemId));
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover item");
    }
  };

  const resetForm = () => {
    setNewItemTitle("");
    setNewItemDescription("");
    setShowNewForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Checklist da Etapa: {stageName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure instruções e lembretes que aparecem no painel lateral quando o lead está nesta etapa.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Existing Items */}
              <div className="space-y-2">
                {items.length === 0 && !showNewForm ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    Nenhum item de checklist configurado
                  </p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border flex items-start gap-3"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{item.title}</span>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Item Form */}
              {showNewForm ? (
                <div className="p-4 rounded-lg border-2 border-dashed border-primary/50 bg-muted/30 space-y-4">
                  <div>
                    <Label>Título do Item *</Label>
                    <Input
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder="Ex: Confirmar dados de contato"
                    />
                  </div>

                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      placeholder="Detalhes adicionais sobre esta instrução..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddItem}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Adicionar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetForm}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowNewForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item ao Checklist
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
