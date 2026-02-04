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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Image, Film, Video } from "lucide-react";
import { toast } from "sonner";

interface Stage {
  id: string;
  stage_type: string;
  name: string;
  color: string;
  sort_order: number;
}

interface SocialCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  stages: Stage[];
  onSuccess: () => void;
}

export const SocialCardDialog = ({
  open,
  onOpenChange,
  boardId,
  stages,
  onSuccess,
}: SocialCardDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  
  // Form fields
  const [contentType, setContentType] = useState<string>("feed");
  const [theme, setTheme] = useState("");
  const [objective, setObjective] = useState<string>("engagement");
  const [copyText, setCopyText] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedTime, setSuggestedTime] = useState("");

  useEffect(() => {
    loadCurrentStaff();
  }, []);

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

  const handleSubmit = async () => {
    if (!theme.trim()) {
      toast.error("Informe o tema do conteúdo");
      return;
    }

    setSaving(true);
    try {
      // Get the first stage (Ideia/Planejamento)
      const firstStage = stages.find((s) => s.stage_type === "idea") || stages[0];
      if (!firstStage) {
        throw new Error("Nenhuma etapa encontrada");
      }

      const { data: card, error } = await supabase
        .from("social_content_cards")
        .insert([{
          board_id: boardId,
          stage_id: firstStage.id,
          content_type: contentType as "feed" | "reels" | "stories",
          theme: theme.trim(),
          objective: objective as "engagement" | "authority" | "conversion",
          copy_text: copyText.trim() || null,
          suggested_date: suggestedDate || null,
          suggested_time: suggestedTime || null,
          created_by: currentStaffId,
        }])
        .select("id")
        .single();

      if (error) throw error;

      // Log history
      await supabase.from("social_content_history").insert({
        card_id: card.id,
        action: "created",
        to_stage_id: firstStage.id,
        performed_by: currentStaffId,
      });

      toast.success("Conteúdo criado com sucesso!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error("Erro ao criar conteúdo");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setContentType("feed");
    setTheme("");
    setObjective("engagement");
    setCopyText("");
    setSuggestedDate("");
    setSuggestedTime("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Conteúdo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content Type */}
          <div className="space-y-2">
            <Label>Tipo de Conteúdo *</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feed">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Feed
                  </div>
                </SelectItem>
                <SelectItem value="reels">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Reels
                  </div>
                </SelectItem>
                <SelectItem value="stories">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Stories
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label>Tema do Post *</Label>
            <Input
              placeholder="Ex: Dicas de produtividade, Bastidores do escritório..."
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement">Engajamento</SelectItem>
                <SelectItem value="authority">Autoridade</SelectItem>
                <SelectItem value="conversion">Conversão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Copy/Script */}
          <div className="space-y-2">
            <Label>Roteiro / Copy (opcional)</Label>
            <Textarea
              placeholder="Descrição do conteúdo ou roteiro..."
              value={copyText}
              onChange={(e) => setCopyText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data sugerida</Label>
              <Input
                type="date"
                value={suggestedDate}
                onChange={(e) => setSuggestedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={suggestedTime}
                onChange={(e) => setSuggestedTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Conteúdo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
