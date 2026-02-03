import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StickyNote, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LeadCardNotesProps {
  leadId: string;
  notes: string | null;
  onNotesChange?: () => void;
}

export const LeadCardNotes = ({ leadId, notes, onNotesChange }: LeadCardNotesProps) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get current staff for activity registration
      const { data: userData } = await supabase.auth.getUser();
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", userData.user?.id)
        .single();

      // Update the lead notes
      const { error } = await supabase
        .from("crm_leads")
        .update({ notes: value || null })
        .eq("id", leadId);

      if (error) throw error;

      // Register note change in activity history (only if there's content)
      if (value && value.trim()) {
        await supabase.from("crm_activities").insert({
          lead_id: leadId,
          type: "note",
          title: "Observação adicionada",
          description: value.trim(),
          responsible_staff_id: staffData?.id,
          status: "completed",
          completed_at: new Date().toISOString(),
        });
      }

      toast.success("Observações salvas");
      setOpen(false);
      onNotesChange?.();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Erro ao salvar observações");
    } finally {
      setSaving(false);
    }
  };

  const hasNotes = !!notes && notes.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            setValue(notes || "");
          }}
          className={cn(
            "p-1 rounded hover:bg-primary/10 transition-colors group",
            hasNotes && "text-amber-600"
          )}
          title={hasNotes ? "Ver observações" : "Adicionar observação"}
        >
          <StickyNote className={cn(
            "h-3.5 w-3.5",
            hasNotes ? "text-amber-600" : "text-muted-foreground group-hover:text-primary"
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-3 bg-popover border shadow-lg z-50" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Observações</span>
          </div>
          <Textarea
            placeholder="Digite suas observações sobre este lead..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[100px] text-sm resize-none"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex justify-end">
            <Button 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
