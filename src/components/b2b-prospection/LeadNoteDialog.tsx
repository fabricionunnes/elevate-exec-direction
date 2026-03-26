import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { B2BLead } from "@/types/b2bProspection";

interface LeadNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: B2BLead | null;
}

export function LeadNoteDialog({ open, onOpenChange, lead }: LeadNoteDialogProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim() || !lead?.id) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("b2b_lead_notes").insert({
        lead_id: lead.id,
        user_id: user.id,
        content: note.trim(),
      });

      toast.success("Nota adicionada!");
      setNote("");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar nota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nota para {lead?.name}</DialogTitle>
          <DialogDescription>Adicione observações sobre este lead</DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Escreva sua observação..."
          className="min-h-[100px]"
        />
        <Button onClick={handleSave} disabled={!note.trim() || saving}>
          {saving ? "Salvando..." : "Salvar Nota"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
