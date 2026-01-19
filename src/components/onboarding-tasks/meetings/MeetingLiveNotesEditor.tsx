import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { AdvancedRichTextarea } from "@/components/ui/advanced-rich-textarea";
import { toast } from "sonner";
import { 
  FileText, 
  Save, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Edit3
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeetingLiveNotesEditorProps {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  initialNotes?: string | null;
  isFinalized?: boolean;
  onNotesUpdated?: (notes: string) => void;
  variant?: "sheet" | "inline" | "collapsible";
}

export const MeetingLiveNotesEditor = ({
  meetingId,
  meetingTitle,
  meetingDate,
  initialNotes,
  isFinalized = false,
  onNotesUpdated,
  variant = "collapsible",
}: MeetingLiveNotesEditorProps) => {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || "");
  }, [initialNotes, meetingId]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasUnsavedChanges(true);
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({ live_notes: notes })
        .eq("id", meetingId);

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      onNotesUpdated?.(notes);
      toast.success("Anotações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Erro ao salvar anotações");
    } finally {
      setSaving(false);
    }
  };

  // Auto-save after 5 seconds of inactivity
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      saveNotes();
    }, 5000);

    return () => clearTimeout(timer);
  }, [notes, hasUnsavedChanges]);

  const renderNotesContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {format(new Date(meetingDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-xs">
              Alterações não salvas
            </Badge>
          )}
          {lastSaved && !hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground">
              Salvo às {format(lastSaved, "HH:mm")}
            </span>
          )}
          <Button
            size="sm"
            onClick={saveNotes}
            disabled={saving || !hasUnsavedChanges}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <AdvancedRichTextarea
        value={notes}
        onChange={handleNotesChange}
        placeholder="Escreva suas anotações aqui... Use a barra de ferramentas para formatar o texto."
        minHeight="300px"
        disabled={isFinalized}
      />

      {isFinalized && (
        <p className="text-xs text-muted-foreground text-center">
          Esta reunião foi finalizada. As anotações são somente leitura.
        </p>
      )}
    </div>
  );

  // Sheet variant - opens in a side panel
  if (variant === "sheet") {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Edit3 className="h-4 w-4" />
            Anotações
            {notes && notes.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {notes.replace(/<[^>]*>/g, '').length > 50 ? '...' : '✓'}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[500px] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Anotações da Reunião
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{meetingTitle}</p>
          </SheetHeader>
          <div className="mt-6">
            {renderNotesContent()}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Collapsible variant - expands in place
  if (variant === "collapsible") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className={notes && notes.length > 0 ? "border-primary/30" : ""}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-primary" />
                  Anotações ao Vivo
                  {notes && notes.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Contém notas
                    </Badge>
                  )}
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {renderNotesContent()}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  // Inline variant - always visible
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-primary" />
          Anotações ao Vivo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderNotesContent()}
      </CardContent>
    </Card>
  );
};
