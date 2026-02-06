import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SocialKanbanBoard } from "@/components/social/SocialKanbanBoard";
import { SocialCardDialog } from "@/components/social/SocialCardDialog";
import { SocialCardDetailSheet } from "@/components/social/SocialCardDetailSheet";

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
  created_by: string | null;
  assigned_to: string | null;
  briefing_aligned: boolean;
  card_type: "content" | "task" | "info";
  card_color: string | null;
}

interface ContextType {
  project: { id: string; product_name: string | null; company_name: string | null };
  boardId: string;
}

export const SocialPipelinePage = () => {
  const { project, boardId } = useOutletContext<ContextType>();
  const [stages, setStages] = useState<Stage[]>([]);
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (boardId) {
      loadData();
      loadCurrentStaff();
      setupRealtimeSubscription();
    }
  }, [boardId]);

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

  const loadData = async () => {
    setLoading(true);
    try {
      // Load stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("social_content_stages")
        .select("*")
        .eq("board_id", boardId)
        .eq("is_active", true)
        .order("sort_order");

      if (stagesError) throw stagesError;
      setStages(stagesData || []);

      // Load cards
      const { data: cardsData, error: cardsError } = await supabase
        .from("social_content_cards")
        .select("*")
        .eq("board_id", boardId)
        .order("sort_order");

      if (cardsError) throw cardsError;
      setCards(cardsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar pipeline");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`social_cards_${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_content_cards", filter: `board_id=eq.${boardId}` },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleCardMove = async (cardId: string, newStageId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const oldStageId = card.stage_id;
    const newStage = stages.find((s) => s.id === newStageId);

    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, stage_id: newStageId } : c))
    );

    try {
      // When moving to "scheduled" stage, also set is_locked = true to enable auto-publish
      const updateData: Record<string, unknown> = { stage_id: newStageId };
      if (newStage?.stage_type === "scheduled") {
        updateData.is_locked = true;
      }

      const { error } = await supabase
        .from("social_content_cards")
        .update(updateData)
        .eq("id", cardId);

      if (error) throw error;

      // Log history
      await supabase.from("social_content_history").insert({
        card_id: cardId,
        action: "moved",
        from_stage_id: oldStageId,
        to_stage_id: newStageId,
        performed_by: currentStaffId,
      });

      // Check if moved to "client_approval" stage - trigger WhatsApp notification
      if (newStage?.stage_type === "client_approval") {
        await triggerApprovalNotification(cardId);
      }

      // Check if moved to "scheduled" stage - trigger Instagram publish
      if (newStage?.stage_type === "scheduled") {
        await triggerInstagramPublish(cardId, card);
      }
    } catch (error) {
      console.error("Error moving card:", error);
      toast.error("Erro ao mover card");
      // Revert
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, stage_id: oldStageId } : c))
      );
    }
  };

  const triggerInstagramPublish = async (cardId: string, card: ContentCard) => {
    // Check if card has media
    if (!card.creative_url) {
      toast.info("Card sem mídia - publicação manual necessária");
      return;
    }

    // Check if has scheduled date in the future
    if (card.scheduled_at) {
      const scheduledDate = new Date(card.scheduled_at);
      if (scheduledDate > new Date()) {
        toast.info(`Agendado para ${scheduledDate.toLocaleString("pt-BR")}`);
        return;
      }
    }

    // Publish immediately
    toast.loading("Publicando no Instagram...", { id: "instagram-publish" });
    
    try {
      const { data, error } = await supabase.functions.invoke("social-instagram-publish", {
        body: { cardId, projectId: project.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Publicado no Instagram com sucesso!", { id: "instagram-publish" });
      } else if (data?.error) {
        toast.error(data.error, { id: "instagram-publish" });
      }
    } catch (error) {
      console.error("Error publishing to Instagram:", error);
      toast.error("Erro ao publicar no Instagram", { id: "instagram-publish" });
    }
  };

  const triggerApprovalNotification = async (cardId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("social-send-approval", {
        body: { cardId, projectId: project.id },
      });

      if (error) {
        const status = (error as any)?.status;
        if (status === 401) {
          toast.error("Sessão expirada. Faça login novamente para enviar aprovação.");
          return;
        }
        throw error;
      }

      if (data?.success) {
        toast.success("Link de aprovação enviado para o cliente!");
      } else if (data?.message) {
        toast.info(data.message);
      }
    } catch (error) {
      console.error("Error sending approval:", error);
      toast.error("Erro ao enviar link de aprovação");
    }
  };

  const handleCardClick = (card: ContentCard) => {
    setSelectedCard(card);
    setDetailOpen(true);
  };

  const handleCardCreated = () => {
    setCreateDialogOpen(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Conteúdo
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={loadData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <SocialKanbanBoard
          stages={stages}
          cards={cards}
          boardId={boardId}
          onCardMove={handleCardMove}
          onCardClick={handleCardClick}
          onStageUpdate={loadData}
        />
      </div>

      {/* Create Card Dialog */}
      <SocialCardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        boardId={boardId}
        stages={stages}
        onSuccess={handleCardCreated}
      />

      {/* Card Detail Sheet */}
      <SocialCardDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        card={selectedCard}
        stages={stages}
        projectId={project.id}
        onUpdate={loadData}
      />
    </div>
  );
};
