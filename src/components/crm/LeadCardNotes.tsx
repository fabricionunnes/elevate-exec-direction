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

interface LeadCardNotesProps {
  leadId: string;
  onNotesChange?: () => void;
}

export const LeadCardNotes = ({ leadId, onNotesChange }: LeadCardNotesProps) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error("Digite o conteúdo da nota");
      return;
    }

    setSaving(true);
    try {
      // Get current staff for activity registration
      const { data: userData } = await supabase.auth.getUser();
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("user_id", userData.user?.id)
        .single();

      // Register note in activity history (permanent, not editable)
      const { error } = await supabase.from("crm_activities").insert({
        lead_id: leadId,
        type: "note",
        title: `Nota de ${staffData?.name || "Usuário"}`,
        description: value.trim(),
        responsible_staff_id: staffData?.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Nota adicionada ao histórico!");
      setValue("");
      setOpen(false);
      onNotesChange?.();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            setValue("");
          }}
          className="p-1 rounded hover:bg-primary/10 transition-colors group"
          title="Adicionar nota ao histórico"
        >
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
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
            <span className="text-sm font-medium">Adicionar Nota</span>
          </div>
          <Textarea
            placeholder="Digite sua observação sobre este lead..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[100px] text-sm resize-none"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-xs text-muted-foreground">
            Esta nota será salva permanentemente no histórico.
          </p>
          <div className="flex justify-end">
            <Button 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              disabled={saving || !value.trim()}
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
