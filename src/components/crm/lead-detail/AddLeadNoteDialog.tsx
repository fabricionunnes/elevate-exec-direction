import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StickyNote, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface AddLeadNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}

export const AddLeadNoteDialog = ({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: AddLeadNoteDialogProps) => {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Digite o conteúdo da nota");
      return;
    }

    setSaving(true);
    try {
      // Get current staff
      const { data: userData } = await supabase.auth.getUser();
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("user_id", userData.user?.id)
        .single();

      // Create activity as a permanent note in history
      const { error } = await supabase.from("crm_activities").insert({
        lead_id: leadId,
        type: "note",
        title: `Nota de ${staffData?.name || "Usuário"}`,
        description: content.trim(),
        responsible_staff_id: staffData?.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Nota adicionada ao histórico!");
      setContent("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setContent("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            Adicionar Nota
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Conteúdo da nota</Label>
            <Textarea
              placeholder="Digite sua observação sobre este lead..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Esta nota será salva permanentemente no histórico e não poderá ser editada.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Salvar Nota
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
