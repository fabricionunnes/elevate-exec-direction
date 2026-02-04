import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardChecklistBadgeProps {
  cardId: string;
  stageId: string;
}

export const CardChecklistBadge = ({ cardId, stageId }: CardChecklistBadgeProps) => {
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`card_progress_${cardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_card_checklist_progress",
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          loadProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, stageId]);

  const loadProgress = async () => {
    try {
      // Get total items for this stage
      const { count: totalCount } = await supabase
        .from("social_stage_checklists")
        .select("*", { count: "exact", head: true })
        .eq("stage_id", stageId)
        .eq("is_active", true);

      // Get completed items for this card
      const { data: progressData } = await supabase
        .from("social_card_checklist_progress")
        .select("checklist_item_id")
        .eq("card_id", cardId)
        .not("completed_at", "is", null);

      // Count how many completed items belong to the current stage's checklist
      if (progressData && progressData.length > 0) {
        const { count: completedCount } = await supabase
          .from("social_stage_checklists")
          .select("*", { count: "exact", head: true })
          .eq("stage_id", stageId)
          .eq("is_active", true)
          .in("id", progressData.map((p) => p.checklist_item_id));

        setCompleted(completedCount || 0);
      } else {
        setCompleted(0);
      }

      setTotal(totalCount || 0);
    } catch (error) {
      console.error("Error loading checklist progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || total === 0) {
    return null;
  }

  const isComplete = completed === total;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
        isComplete
          ? "bg-green-500/20 text-green-600 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      <span>
        {completed}/{total}
      </span>
    </div>
  );
};
