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
  MessageSquare, Hash, Sparkles, Send, History, Check, Edit2, AlertCircle, ListChecks, Trash2, Paperclip, Square, LayoutGrid, CircleDashed, Instagram, ExternalLink, Wand2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal, toDateString } from "@/lib/dateUtils";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CardChecklistProgress } from "./CardChecklistProgress";
import { CardTagSelector } from "./CardTagSelector";
import { CardAttachments } from "./CardAttachments";
import { CardColorPicker } from "./CardColorPicker";
import { CardSubtasks } from "./CardSubtasks";

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
  card_type?: "content" | "task" | "info";
  card_color?: string | null;
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
  const [publishing, setPublishing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [theme, setTheme] = useState("");
  const [contentType, setContentType] = useState("estatico");
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
  const [cardColor, setCardColor] = useState<string | null>(null);
  
  // AI image generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAiImage, setGeneratingAiImage] = useState(false);
  const [aiIncludeLogo, setAiIncludeLogo] = useState(true);
  const [generatingPromptSuggestion, setGeneratingPromptSuggestion] = useState(false);
  const [aiGenerateMode, setAiGenerateMode] = useState<"single" | "carousel">("single");
  const [aiCarouselCount, setAiCarouselCount] = useState(3);
  const [aiCarouselConnected, setAiCarouselConnected] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);

  const generatePromptSuggestion = async (copy: string, theme: string, contentType: string) => {
    setGeneratingPromptSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-ai-suggestions", {
        body: {
          type: "image_prompt",
          copyText: copy,
          theme,
          contentType,
        },
      });
      if (!error && data?.suggestion) {
        setAiPrompt(data.suggestion);
      } else {
        setAiPrompt(copy);
      }
    } catch {
      setAiPrompt(copy);
    } finally {
      setGeneratingPromptSuggestion(false);
    }
  };

  useEffect(() => {
    if (card && open) {
      loadCardData();
      loadHistory();
      loadFeedback();
      checkInstagramConnection();
    }
  }, [card, open]);

  const checkInstagramConnection = async () => {
    try {
      const { data } = await supabase
        .from("social_instagram_accounts")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_connected", true)
        .maybeSingle();

      setInstagramConnected(!!data);
    } catch (error) {
      console.error("Error checking Instagram connection:", error);
      setInstagramConnected(false);
    }
  };

  const loadCardData = () => {
    if (!card) return;
    setTheme(card.theme || "");
    setContentType(card.content_type || "estatico");
    setObjective(card.objective);
    setCopyText(card.copy_text || "");
    setAiPrompt("");
    if (card.copy_text?.trim()) {
      generatePromptSuggestion(card.copy_text, card.theme || "", card.content_type || "");
    }
    setFinalCaption(card.final_caption || "");
    setHashtags(card.hashtags || "");
    setCta(card.cta || "");
    setSuggestedDate(card.suggested_date || "");
    setSuggestedTime(card.suggested_time ? card.suggested_time.slice(0, 5) : "");
    setCreativeUrl(card.creative_url || "");
    setCreativeType(card.creative_type);
    setCardColor(card.card_color || null);
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

  // Combine suggested_date + suggested_time into scheduled_at (UTC ISO)
  const calculateScheduledAt = (date: string, time: string): string | null => {
    if (!date) return null;

    const normalizedTime = (time || "09:00").slice(0, 5); // handles values like "20:00:00"
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = normalizedTime.split(":").map(Number);

    if ([year, month, day, hours, minutes].some((v) => Number.isNaN(v))) {
      return null;
    }

    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return localDate.toISOString();
  };

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);
    try {
      // Calculate scheduled_at from suggested_date + suggested_time
      const scheduledAt = calculateScheduledAt(suggestedDate, suggestedTime);

      const updatePayload: Record<string, unknown> = {
        theme,
        content_type: contentType,
        objective: objective || null,
        copy_text: copyText || null,
        final_caption: finalCaption || null,
        hashtags: hashtags || null,
        cta: cta || null,
        suggested_date: suggestedDate || null,
        suggested_time: suggestedTime || null,
        scheduled_at: scheduledAt,
        creative_url: creativeUrl || null,
        creative_type: creativeType,
        card_color: cardColor,
      };

      const { error } = await supabase
        .from("social_content_cards")
        .update(updatePayload)
        .eq("id", card.id);

      if (error) throw error;
      toast.success("Conteúdo atualizado!");
      onUpdate();
    } catch (error: any) {
      console.error("Error saving card:", error);
      toast.error("Erro ao salvar: " + (error?.message || "erro desconhecido"));
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

  const handleGenerateAiImage = async () => {
    if (!card || !aiPrompt.trim()) return;
    setGeneratingAiImage(true);
    const isCarousel = aiGenerateMode === "carousel";
    if (isCarousel) {
      toast.loading(`Gerando ${aiCarouselCount} slides do carrossel... isso pode levar até 1 minuto`, { id: "ai-carousel" });
    }
    try {
      const isCarousel = aiGenerateMode === "carousel";
      const { data, error } = await supabase.functions.invoke("social-ai-generate-image", {
        body: {
          projectId,
          prompt: aiPrompt.trim(),
          format: isCarousel ? "carousel" : "feed_post",
          includeLogoPref: aiIncludeLogo,
          ...(isCarousel && {
            carouselCount: aiCarouselCount,
            carouselConnected: aiCarouselConnected,
          }),
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error, { id: isCarousel ? "ai-carousel" : undefined }); return; }

      if (isCarousel && data?.images?.length) {
        // For carousel, save first image as creative and store all
        const firstImage = data.images[0];
        const { error: updateError } = await supabase
          .from("social_content_cards")
          .update({ 
            creative_url: firstImage, 
            creative_type: "image",
            content_type: "carrossel",
          })
          .eq("id", card.id);
        if (updateError) throw updateError;

        setCreativeUrl(firstImage);
        setCreativeType("image");
        setContentType("carrossel");
        setCarouselImages(data.images);
        setAiPrompt("");
        toast.success(`Carrossel com ${data.images.length} imagens gerado!`, { id: "ai-carousel" });
      } else {
        const imageUrl = data?.image_url || data?.images?.[0];
        if (!imageUrl) { toast.error("Nenhuma imagem gerada"); return; }

        const { error: updateError } = await supabase
          .from("social_content_cards")
          .update({ creative_url: imageUrl, creative_type: "image" })
          .eq("id", card.id);
        if (updateError) throw updateError;

        setCreativeUrl(imageUrl);
        setCreativeType("image");
        setCarouselImages([]);
        setAiPrompt("");
        toast.success("Imagem gerada e aplicada ao card!");
      }
    } catch (err) {
      console.error("AI image error:", err);
      toast.error("Erro ao gerar imagem via IA", { id: isCarousel ? "ai-carousel" : undefined });
    } finally {
      setGeneratingAiImage(false);
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
      // Trigger approval notification first
      const { data, error: funcError } = await supabase.functions.invoke("social-send-approval", {
        body: { cardId: card.id, projectId },
      });

      if (funcError) {
        // Better UX for auth/session issues
        const status = (funcError as any)?.status;
        if (status === 401) {
          toast.error("Sua sessão expirou. Faça login novamente.");
          return;
        }
        throw funcError;
      }

      if (data?.success) {
        // Move to approval stage only if it was actually sent
        const { error } = await supabase
          .from("social_content_cards")
          .update({ stage_id: approvalStage.id })
          .eq("id", card.id);

        if (error) throw error;

        toast.success("Enviado para aprovação do cliente!");
      } else {
        toast.info(data?.message || "Não foi possível enviar o link de aprovação");
        return;
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

  const handlePublishToInstagram = async () => {
    if (!card) return;

    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-instagram-publish", {
        body: { cardId: card.id, projectId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Publicado no Instagram com sucesso!");
        onOpenChange(false);
        onUpdate();
      } else {
        throw new Error(data?.error || "Erro ao publicar");
      }
    } catch (error) {
      console.error("Error publishing to Instagram:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao publicar no Instagram");
    } finally {
      setPublishing(false);
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

        <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1">
              <ListChecks className="h-3 w-3" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="attachments" className="gap-1">
              <Paperclip className="h-3 w-3" />
              Anexos
            </TabsTrigger>
            <TabsTrigger value="feedback">Feedbacks</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Checklist Tab */}
            <TabsContent value="checklist" className="mt-0 pr-4 space-y-6">
              {/* Subtasks section for task cards */}
              {card.card_type === "task" && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Subtarefas
                  </Label>
                  <CardSubtasks cardId={card.id} disabled={card.is_locked} />
                </div>
              )}
              
              {/* Stage checklist */}
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
                    className={`relative rounded-lg overflow-hidden bg-muted ${isDraggingFile ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                  >
                    {creativeType === "video" ? (
                      <video
                        src={creativeUrl}
                        controls
                        className="w-full h-auto"
                      />
                    ) : (
                      <img
                        src={creativeUrl}
                        alt="Preview"
                        className="w-full h-auto"
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

               {/* AI Image Generation */}
              <div className="space-y-3">
                <Label className="flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" />
                  Gerar Imagem com IA
                </Label>

                {/* Mode toggle: single vs carousel */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAiGenerateMode("single")}
                    className={cn(
                      "flex-1 text-xs py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5",
                      aiGenerateMode === "single" 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={card.is_locked || generatingAiImage}
                  >
                    <Image className="h-3.5 w-3.5" />
                    Imagem única
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiGenerateMode("carousel")}
                    className={cn(
                      "flex-1 text-xs py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5",
                      aiGenerateMode === "carousel" 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={card.is_locked || generatingAiImage}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Carrossel
                  </button>
                </div>

                {/* Carousel options */}
                {aiGenerateMode === "carousel" && (
                  <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap">Slides:</Label>
                      <Select
                        value={String(aiCarouselCount)}
                        onValueChange={(v) => setAiCarouselCount(Number(v))}
                        disabled={card.is_locked || generatingAiImage}
                      >
                        <SelectTrigger className="h-8 text-xs w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6, 7, 8, 10].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiCarouselConnected}
                        onChange={(e) => setAiCarouselConnected(e.target.checked)}
                        disabled={card.is_locked || generatingAiImage}
                        className="rounded border-input"
                      />
                      Imagens conectadas (panorâmico)
                    </label>
                    <p className="text-[10px] text-muted-foreground">
                      {aiCarouselConnected 
                        ? "As imagens formarão uma sequência visual contínua." 
                        : "Cada slide terá uma variação independente do tema."}
                    </p>
                  </div>
                )}

                <Textarea
                  placeholder={generatingPromptSuggestion ? "Gerando sugestão de prompt..." : "Descreva a imagem que deseja gerar..."}
                  value={generatingPromptSuggestion ? "" : aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={card.is_locked || generatingAiImage || generatingPromptSuggestion}
                  className="min-h-[60px] text-sm"
                  rows={3}
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiIncludeLogo}
                      onChange={(e) => setAiIncludeLogo(e.target.checked)}
                      disabled={card.is_locked || generatingAiImage}
                      className="rounded border-input"
                    />
                    Incluir logomarca
                  </label>
                </div>
                <Button
                  size="sm"
                  onClick={handleGenerateAiImage}
                  disabled={card.is_locked || generatingAiImage || !aiPrompt.trim()}
                  className="gap-1.5 w-full"
                >
                  {generatingAiImage ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando{aiGenerateMode === "carousel" ? ` ${aiCarouselCount} slides` : ""}...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> {aiGenerateMode === "carousel" ? `Gerar Carrossel (${aiCarouselCount} slides)` : "Gerar Imagem"}</>
                  )}
                </Button>

                {/* Carousel preview */}
                {carouselImages.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Carrossel gerado ({carouselImages.length} slides)
                    </Label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {carouselImages.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                          onClick={() => {
                            setCreativeUrl(url);
                            toast.info(`Slide ${idx + 1} selecionado como capa`);
                          }}
                        >
                          <img
                            src={url}
                            alt={`Slide ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0.5 right-0.5 bg-background/80 text-foreground text-[10px] px-1 rounded">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
                      <SelectItem value="estatico">
                        <span className="flex items-center gap-2">
                          <Square className="h-4 w-4" /> Estático
                        </span>
                      </SelectItem>
                      <SelectItem value="carrossel">
                        <span className="flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" /> Carrossel
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
                      <SelectItem value="outro">
                        <span className="flex items-center gap-2">
                          <CircleDashed className="h-4 w-4" /> Outro
                        </span>
                      </SelectItem>
                      <SelectItem value="feed">
                        <span className="flex items-center gap-2">
                          <Image className="h-4 w-4" /> Feed (legado)
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
                      <SelectItem value="educational">Educativo</SelectItem>
                      <SelectItem value="social_proof">Prova Social</SelectItem>
                      <SelectItem value="relationship">Relacionamento</SelectItem>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={card.is_locked}
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
                    <PopoverContent className="w-auto p-0 pointer-events-auto z-[9999]" align="start" side="top" sideOffset={4}>
                      <CalendarComponent
                        mode="single"
                        selected={suggestedDate ? parseDateLocal(suggestedDate) : undefined}
                        onSelect={(date) => setSuggestedDate(date ? toDateString(date) : "")}
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
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

              {/* Card Color */}
              <div className="space-y-2">
                <Label>Cor do Card</Label>
                <CardColorPicker 
                  value={cardColor} 
                  onChange={setCardColor} 
                  disabled={card.is_locked}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Etiquetas de Status</Label>
                <CardTagSelector cardId={card.id} disabled={card.is_locked} />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-2">
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

                {/* Instagram Publish Button - Show when approved and has media */}
                {currentStage?.stage_type === "approved" && 
                  creativeUrl && 
                  instagramConnected && 
                  !card.instagram_post_url && (
                    <Button
                      onClick={handlePublishToInstagram}
                      disabled={publishing}
                      className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    >
                      {publishing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Instagram className="h-4 w-4" />
                      )}
                      {publishing ? "Publicando..." : "Publicar no Instagram"}
                    </Button>
                  )}

                {/* Already published - show link */}
                {card.instagram_post_url && (
                  <a
                    href={card.instagram_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  >
                    <Instagram className="h-4 w-4 text-pink-500" />
                    <span>Ver publicação no Instagram</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </TabsContent>

            {/* Attachments Tab */}
            <TabsContent value="attachments" className="mt-0 pr-4">
              <CardAttachments cardId={card.id} disabled={card.is_locked} />
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
