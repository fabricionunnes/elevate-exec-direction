import { useState, useEffect, useRef } from "react";
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
import { Loader2, Image, Film, Video, LayoutGrid, Square, CircleDashed, Paperclip, X, FileText, FileImage, File, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal, toDateString } from "@/lib/dateUtils";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CardTypeSelector, SocialCardType } from "./CardTypeSelector";
import { CardColorPicker } from "./CardColorPicker";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Card type
  const [cardType, setCardType] = useState<SocialCardType>("content");
  
  // Common fields
  const [theme, setTheme] = useState("");
  const [copyText, setCopyText] = useState("");
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState("");
  
  // Content-specific fields
  const [contentType, setContentType] = useState<string>("estatico");
  const [objective, setObjective] = useState<string>("engagement");
  const [customObjective, setCustomObjective] = useState<string>("");
  const [suggestedTime, setSuggestedTime] = useState("");
  
  // Attachments for info cards
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    loadCurrentStaff();
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

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
      toast.error("Informe o título");
      return;
    }

    setSaving(true);
    try {
      // Get the development stage (Em desenvolvimento) for content cards
      const targetStage = cardType === "content" 
        ? stages.find((s) => s.stage_type === "development") || stages[0]
        : stages.find((s) => s.stage_type === "idea") || stages[0];
      if (!targetStage) {
        throw new Error("Nenhuma etapa encontrada");
      }

      const baseData = {
        board_id: boardId,
        stage_id: targetStage.id,
        theme: theme.trim(),
        copy_text: copyText.trim() || null,
        card_color: cardColor,
        created_by: currentStaffId,
        card_type: cardType,
      };

      let insertData: any = baseData;

      if (cardType === "content") {
        const effectiveObjective = getEffectiveObjective();
        insertData = {
          ...baseData,
          content_type: contentType,
          objective: effectiveObjective,
          suggested_date: suggestedDate || null,
          suggested_time: suggestedTime || null,
        };
      } else if (cardType === "task") {
        insertData = {
          ...baseData,
          content_type: "estatico", // default for task cards
          objective: "engagement", // default
          suggested_date: suggestedDate || null,
        };
      } else {
        // info card
        insertData = {
          ...baseData,
          content_type: "estatico", // default for info cards
          objective: "engagement", // default
        };
      }

      const { data: card, error } = await supabase
        .from("social_content_cards")
        .insert([insertData])
        .select("id")
        .single();

      if (error) throw error;

      // Upload pending attachments for info cards
      if (cardType === "info" && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fileName = `${card.id}/attachments/${Date.now()}-${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from("social-content")
            .upload(fileName, file);

          if (uploadError) {
            console.error("Error uploading attachment:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from("social-content")
            .getPublicUrl(fileName);

          await supabase.from("social_card_attachments").insert({
            card_id: card.id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: currentStaffId,
          });
        }
      }

      // Log history
      await supabase.from("social_content_history").insert({
        card_id: card.id,
        action: "created",
        to_stage_id: targetStage.id,
        performed_by: currentStaffId,
      });

      toast.success(
        cardType === "content" 
          ? "Conteúdo criado!" 
          : cardType === "task" 
          ? "Tarefa criada!" 
          : "Informação criada!"
      );
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error("Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCardType("content");
    setContentType("estatico");
    setTheme("");
    setObjective("engagement");
    setCustomObjective("");
    setCopyText("");
    setSuggestedDate("");
    setSuggestedTime("");
    setCardColor(null);
    setPendingFiles([]);
  };

  const getEffectiveObjective = () => {
    if (objective === "other" && customObjective.trim()) {
      return customObjective.trim();
    }
    return objective;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPendingFiles(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return FileImage;
    if (fileType.includes("pdf") || fileType.includes("document")) return FileText;
    return File;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card Type Selector */}
          <div className="space-y-2">
            <Label>Tipo de Card</Label>
            <CardTypeSelector value={cardType} onChange={setCardType} />
          </div>

          {/* Title (Theme) - common to all */}
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              placeholder={
                cardType === "content"
                  ? "Ex: Dicas de produtividade, Bastidores do escritório..."
                  : cardType === "task"
                  ? "Ex: Criação de conteúdo do mês"
                  : "Ex: Informações e Acessos"
              }
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>

          {/* Content Type - only for content cards */}
          {cardType === "content" && (
            <div className="space-y-2">
              <Label>Tipo de Conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estatico">
                    <div className="flex items-center gap-2">
                      <Square className="h-4 w-4" />
                      Estático
                    </div>
                  </SelectItem>
                  <SelectItem value="carrossel">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      Carrossel
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
                  <SelectItem value="outro">
                    <div className="flex items-center gap-2">
                      <CircleDashed className="h-4 w-4" />
                      Outro
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Objective - only for content cards */}
          {cardType === "content" && (
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={objective} onValueChange={(val) => {
                setObjective(val);
                if (val !== "other") setCustomObjective("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engagement">Engajamento</SelectItem>
                  <SelectItem value="authority">Autoridade</SelectItem>
                  <SelectItem value="conversion">Conversão</SelectItem>
                  <SelectItem value="educational">Educativo</SelectItem>
                  <SelectItem value="social_proof">Prova Social</SelectItem>
                  <SelectItem value="relationship">Relacionamento</SelectItem>
                  <SelectItem value="other">Outro...</SelectItem>
                </SelectContent>
              </Select>
              {objective === "other" && (
                <Input
                  placeholder="Digite o objetivo..."
                  value={customObjective}
                  onChange={(e) => setCustomObjective(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          )}

          {/* Description/Copy - common to all */}
          <div className="space-y-2">
            <Label>
              {cardType === "content" ? "Roteiro / Copy" : "Descrição"} (opcional)
            </Label>
            <Textarea
              placeholder={
                cardType === "content"
                  ? "Descrição do conteúdo ou roteiro..."
                  : "Adicione uma descrição..."
              }
              value={copyText}
              onChange={(e) => setCopyText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Date - for content and task */}
          {(cardType === "content" || cardType === "task") && (
            <div className={cardType === "content" ? "grid grid-cols-2 gap-4" : ""}>
              <div className="space-y-2">
                <Label>{cardType === "task" ? "Data de finalização" : "Data sugerida"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !suggestedDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {suggestedDate
                        ? format(parseDateLocal(suggestedDate), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={suggestedDate ? parseDateLocal(suggestedDate) : undefined}
                      onSelect={(date) => setSuggestedDate(date ? toDateString(date) : "")}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {cardType === "content" && (
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={suggestedTime}
                    onChange={(e) => setSuggestedTime(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Attachments - for info cards */}
          {cardType === "info" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Adicionar arquivos
              </Button>
              {pendingFiles.length > 0 && (
                <div className="space-y-1 mt-2">
                  {pendingFiles.map((file, index) => {
                    const FileIcon = getFileIcon(file.type);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                      >
                        <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Card Color */}
          <div className="space-y-2">
            <Label>Cor do card</Label>
            <CardColorPicker value={cardColor} onChange={setCardColor} />
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
              "Criar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
