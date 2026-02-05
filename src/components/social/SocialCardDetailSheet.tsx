import { useState, useEffect, useRef, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, Upload, Image, Film, Video, Calendar, Clock, 
  MessageSquare, Hash, Sparkles, Send, History, Check, Edit2, AlertCircle, ListChecks, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardChecklistProgress } from "./CardChecklistProgress";

interface Stage {
  id: string;
  stage_type: string;
  name: string;
  color: string;
  sort_order: number;
}

interface ContentCard {
  id: string;
  stage_id: string;
  content_type: string;
  theme: string;
  objective: string;
  copy_text: string | null;
  creative_url: string | null;
  creative_type: string | null;
  final_caption: string | null;
  hashtags: string | null;
  cta: string | null;
  suggested_date: string | null;
  suggested_time: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  instagram_post_url: string | null;
  is_locked: boolean;
  sort_order: number;
  created_at: string;
}

interface HistoryItem {
  id: string;
  action: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  details: any;
  performed_at: string;
  performed_by: string | null;
  performer_name?: string;
}

interface FeedbackItem {
  id: string;
  feedback_type: string;
  adjustment_notes: string | null;
  created_at: string;
}

interface SocialCardDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ContentCard | null;
  stages: Stage[];
  projectId: string;
  onUpdate: () => void;
}

export const SocialCardDetailSheet = ({
  open,
  onOpenChange,
  card,
  stages,
  projectId,
  onUpdate,
}: SocialCardDetailSheetProps) => {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [theme, setTheme] = useState("");
  const [contentType, setContentType] = useState("feed");
  const [objective, setObjective] = useState("engagement");
  const [copyText, setCopyText] = useState("");
  const [finalCaption, setFinalCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedTime, setSuggestedTime] = useState("");
  const [creativeUrl, setCreativeUrl] = useState("");
  const [creativeType, setCreativeType] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    if (card && open) {
      loadCardData();
      loadHistory();
      loadFeedback();
    }
  }, [card, open]);

  const loadCardData = () => {
    if (!card) return;
    setTheme(card.theme || "");
    setContentType(card.content_type);
    setObjective(card.objective);
    setCopyText(card.copy_text || "");
    setFinalCaption(card.final_caption || "");
    setHashtags(card.hashtags || "");
    setCta(card.cta || "");
    setSuggestedDate(card.suggested_date || "");
    setSuggestedTime(card.suggested_time || "");
    setCreativeUrl(card.creative_url || "");
    setCreativeType(card.creative_type);
  };

  const loadHistory = async () => {
    if (!card) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("social_content_history")
        .select(`
          *,
          performer:onboarding_staff!social_content_history_performed_by_fkey(name)
        `)
        .eq("card_id", card.id)
        .order("performed_at", { ascending: false });

      setHistory(
        (data || []).map((h) => ({
          ...h,
          performer_name: (h.performer as any)?.name || null,
        }))
      );
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFeedback = async () => {
    if (!card) return;
    try {
      const { data } = await supabase
        .from("social_client_feedback")
        .select("*")
        .eq("card_id", card.id)
        .order("created_at", { ascending: false });

      setFeedback(data || []);
    } catch (error) {
      console.error("Error loading feedback:", error);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleFileDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (!card || card.is_locked || uploading) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // Check if it's an image or video
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Apenas imagens e vídeos são permitidos");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${card.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("social-content")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("social-content")
        .getPublicUrl(fileName);

      const isVideo = file.type.startsWith("video/");
      
      setCreativeUrl(publicUrl);
      setCreativeType(isVideo ? "video" : "image");

      const { error: updateError } = await supabase
        .from("social_content_cards")
        .update({
          creative_url: publicUrl,
          creative_type: isVideo ? "video" : "image",
        })
        .eq("id", card.id);

      if (updateError) throw updateError;

      toast.success("Arquivo enviado!");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("social_content_cards")
        .update({
          theme,
          content_type: contentType as "feed" | "reels" | "stories",
          objective: objective as "engagement" | "authority" | "conversion",
          copy_text: copyText || null,
          final_caption: finalCaption || null,
          hashtags: hashtags || null,
          cta: cta || null,
          suggested_date: suggestedDate || null,
          suggested_time: suggestedTime || null,
          creative_url: creativeUrl || null,
          creative_type: creativeType,
        })
        .eq("id", card.id);

      if (error) throw error;
      toast.success("Conteúdo atualizado!");
      onUpdate();
    } catch (error) {
      console.error("Error saving card:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !card) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${card.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("social-content")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("social-content")
        .getPublicUrl(fileName);

      const isVideo = file.type.startsWith("video/");
      
      // Update local state FIRST so UI updates immediately
      setCreativeUrl(publicUrl);
      setCreativeType(isVideo ? "video" : "image");

      // Auto-save to database
      const { error: updateError } = await supabase
        .from("social_content_cards")
        .update({
          creative_url: publicUrl,
          creative_type: isVideo ? "video" : "image",
        })
        .eq("id", card.id);

      if (updateError) throw updateError;

      toast.success("Arquivo enviado!");
      // Don't call onUpdate() here - it would reload and close/refresh the sheet
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveCreative = async () => {
    if (!card) return;

    setUploading(true);
    try {
      // Update database to remove creative
      const { error } = await supabase
        .from("social_content_cards")
        .update({
          creative_url: null,
          creative_type: null,
        })
        .eq("id", card.id);

      if (error) throw error;

      // Update local state
      setCreativeUrl("");
      setCreativeType(null);

      toast.success("Mídia removida!");
    } catch (error) {
      console.error("Error removing creative:", error);
      toast.error("Erro ao remover mídia");
    } finally {
      setUploading(false);
    }
  };

  const handleSendForApproval = async () => {
    if (!card) return;
    
    // Find client_approval stage
    const approvalStage = stages.find((s) => s.stage_type === "client_approval");
    if (!approvalStage) {
      toast.error("Etapa de aprovação não encontrada");
      return;
    }

    setSaving(true);
    try {
      // Move to approval stage
      const { error } = await supabase
        .from("social_content_cards")
        .update({ stage_id: approvalStage.id })
        .eq("id", card.id);

      if (error) throw error;

      // Trigger approval notification
      const { data, error: funcError } = await supabase.functions.invoke("social-send-approval", {
        body: { cardId: card.id, projectId },
      });

      if (funcError) throw funcError;

      if (data?.success) {
        toast.success("Enviado para aprovação do cliente!");
      } else {
        toast.info(data?.message || "Movido para aprovação");
      }

      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error sending for approval:", error);
      toast.error("Erro ao enviar para aprovação");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    
    setDeleting(true);
    try {
      // Delete related records first (cascade might not handle all)
      await supabase
        .from("social_content_history")
        .delete()
        .eq("card_id", card.id);

      await supabase
        .from("social_client_feedback")
        .delete()
        .eq("card_id", card.id);

      await supabase
        .from("social_approval_links")
        .delete()
        .eq("card_id", card.id);

      await supabase
        .from("social_card_checklist_progress")
        .delete()
        .eq("card_id", card.id);

      // Delete the card itself
      const { error } = await supabase
        .from("social_content_cards")
        .delete()
        .eq("id", card.id);

      if (error) throw error;

      toast.success("Conteúdo excluído com sucesso!");
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Erro ao excluir conteúdo");
    } finally {
      setDeleting(false);
    }
  };

  if (!card) return null;

  const currentStage = stages.find((s) => s.id === card.stage_id);

  const actionLabels: Record<string, string> = {
    created: "Criado",
    moved: "Movido",
    sent_for_approval: "Enviado para aprovação",
    approved: "Aprovado pelo cliente",
    adjustment_requested: "Ajuste solicitado",
    scheduled: "Agendado",
    published: "Publicado",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Stage Selector */}
              <Select
                value={card.stage_id}
                onValueChange={async (newStageId) => {
                  try {
                    const { error } = await supabase
                      .from("social_content_cards")
                      .update({ stage_id: newStageId })
                      .eq("id", card.id);

                    if (error) throw error;

                    const newStage = stages.find((s) => s.id === newStageId);
                    toast.success(`Movido para "${newStage?.name}"`);
                    onUpdate();
                  } catch (error) {
                    console.error("Error moving card:", error);
                    toast.error("Erro ao mover conteúdo");
                  }
                }}
              >
                <SelectTrigger 
                  className="h-7 text-xs font-medium border-0 px-2"
                  style={{ 
                    backgroundColor: currentStage?.color || "#666", 
                    color: "#fff" 
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O conteúdo "{theme}" e todo seu histórico serão permanentemente excluídos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <SheetTitle className="text-left">{theme || "Novo Conteúdo"}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="checklist" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="checklist" className="gap-1">
              <ListChecks className="h-3 w-3" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="feedback">Feedbacks</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Checklist Tab */}
            <TabsContent value="checklist" className="mt-0 pr-4">
              <CardChecklistProgress
                cardId={card.id}
                stageId={card.stage_id}
                stages={stages}
                onAutoAdvance={async (nextStageId) => {
                  // Move card to next stage
                  try {
                    const { error } = await supabase
                      .from("social_content_cards")
                      .update({ stage_id: nextStageId })
                      .eq("id", card.id);

                    if (error) throw error;
                    
                    onOpenChange(false);
                    onUpdate();
                  } catch (error) {
                    console.error("Error auto-advancing card:", error);
                    toast.error("Erro ao avançar card");
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="content" className="mt-0 space-y-4 pr-4">
              {/* Creative Upload */}
              <div className="space-y-2">
                <Label>Criativo</Label>
                {creativeUrl ? (
                  <div 
                    className={`relative rounded-lg overflow-hidden bg-muted aspect-video ${isDraggingFile ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                  >
                    {creativeType === "video" ? (
                      <video
                        src={creativeUrl}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={creativeUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={card.is_locked || uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trocar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleRemoveCreative}
                        disabled={card.is_locked || uploading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors ${isDraggingFile ? 'border-primary bg-primary/10' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {uploading ? "Enviando..." : isDraggingFile ? "Solte para enviar" : "Clique ou arraste para enviar imagem ou vídeo"}
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={card.is_locked || uploading}
                />
              </div>

              {/* Type & Objective */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={contentType}
                    onValueChange={setContentType}
                    disabled={card.is_locked}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">
                        <span className="flex items-center gap-2">
                          <Image className="h-4 w-4" /> Feed
                        </span>
                      </SelectItem>
                      <SelectItem value="reels">
                        <span className="flex items-center gap-2">
                          <Film className="h-4 w-4" /> Reels
                        </span>
                      </SelectItem>
                      <SelectItem value="stories">
                        <span className="flex items-center gap-2">
                          <Video className="h-4 w-4" /> Stories
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select
                    value={objective}
                    onValueChange={setObjective}
                    disabled={card.is_locked}
                  >
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
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <Label>Tema</Label>
                <Input
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  disabled={card.is_locked}
                />
              </div>

              {/* Copy/Script */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Roteiro / Copy
                </Label>
                <Textarea
                  value={copyText}
                  onChange={(e) => setCopyText(e.target.value)}
                  rows={3}
                  disabled={card.is_locked}
                />
              </div>

              {/* Final Caption */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Legenda Final
                </Label>
                <Textarea
                  value={finalCaption}
                  onChange={(e) => setFinalCaption(e.target.value)}
                  rows={4}
                  placeholder="Legenda que será publicada..."
                  disabled={card.is_locked}
                />
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Hashtags
                </Label>
                <Textarea
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  rows={2}
                  placeholder="#hashtag1 #hashtag2 #hashtag3"
                  disabled={card.is_locked}
                />
              </div>

              {/* CTA */}
              <div className="space-y-2">
                <Label>CTA (Call to Action)</Label>
                <Input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Ex: Comente 'EU QUERO' para saber mais"
                  disabled={card.is_locked}
                />
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data
                  </Label>
                  <Input
                    type="date"
                    value={suggestedDate}
                    onChange={(e) => setSuggestedDate(e.target.value)}
                    disabled={card.is_locked}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horário
                  </Label>
                  <Input
                    type="time"
                    value={suggestedTime}
                    onChange={(e) => setSuggestedTime(e.target.value)}
                    disabled={card.is_locked}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || card.is_locked}
                  className="flex-1"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
                {currentStage?.stage_type !== "client_approval" &&
                  currentStage?.stage_type !== "approved" &&
                  currentStage?.stage_type !== "scheduled" &&
                  currentStage?.stage_type !== "published" && (
                    <Button
                      variant="secondary"
                      onClick={handleSendForApproval}
                      disabled={saving}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Enviar para Aprovação
                    </Button>
                  )}
              </div>
            </TabsContent>

            <TabsContent value="feedback" className="mt-0 pr-4">
              {feedback.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum feedback do cliente ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border ${
                        item.feedback_type === "approved"
                          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {item.feedback_type === "approved" ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Edit2 className="h-4 w-4 text-amber-600" />
                        )}
                        <span className="font-medium">
                          {item.feedback_type === "approved" ? "Aprovado" : "Ajuste solicitado"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {item.adjustment_notes && (
                        <p className="text-sm">{item.adjustment_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 pr-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum histórico registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => {
                    const fromStage = stages.find((s) => s.id === item.from_stage_id);
                    const toStage = stages.find((s) => s.id === item.to_stage_id);

                    return (
                      <div key={item.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                        <div className="flex-1">
                          <p className="font-medium">
                            {actionLabels[item.action] || item.action}
                          </p>
                          {item.action === "moved" && fromStage && toStage && (
                            <p className="text-muted-foreground">
                              {fromStage.name} → {toStage.name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(item.performed_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                            {item.performer_name && ` por ${item.performer_name}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
