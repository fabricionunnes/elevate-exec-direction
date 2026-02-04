import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface ProgressItem {
  id: string;
  checklist_item_id: string;
  completed_at: string | null;
}

interface CardChecklistProgressProps {
  cardId: string;
  stageId: string;
  stages: { id: string; sort_order: number }[];
  onAutoAdvance?: (nextStageId: string) => void;
}

export const CardChecklistProgress = ({
  cardId,
  stageId,
  stages,
  onAutoAdvance,
}: CardChecklistProgressProps) => {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadCurrentStaff();
  }, [cardId, stageId]);

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
      // Load checklist items for current stage
      const { data: items, error: itemsError } = await supabase
        .from("social_stage_checklists")
        .select("id, title, description, sort_order")
        .eq("stage_id", stageId)
        .eq("is_active", true)
        .order("sort_order");

      if (itemsError) throw itemsError;
      setChecklistItems(items || []);

      // Load progress for this card
      const { data: progressData, error: progressError } = await supabase
        .from("social_card_checklist_progress")
        .select("id, checklist_item_id, completed_at")
        .eq("card_id", cardId);

      if (progressError) throw progressError;
      setProgress(progressData || []);
    } catch (error) {
      console.error("Error loading checklist data:", error);
    } finally {
      setLoading(false);
    }
  };

  const isItemCompleted = (itemId: string) => {
    return progress.some((p) => p.checklist_item_id === itemId && p.completed_at);
  };

  const handleToggle = async (itemId: string) => {
    setUpdating(itemId);
    try {
      const existingProgress = progress.find((p) => p.checklist_item_id === itemId);
      const isCompleted = isItemCompleted(itemId);

      if (isCompleted) {
        // Uncheck - delete progress record
        if (existingProgress) {
          await supabase
            .from("social_card_checklist_progress")
            .delete()
            .eq("id", existingProgress.id);
        }
      } else {
        // Check - create or update progress record
        if (existingProgress) {
          await supabase
            .from("social_card_checklist_progress")
            .update({
              completed_at: new Date().toISOString(),
              completed_by: currentStaffId,
            })
            .eq("id", existingProgress.id);
        } else {
          await supabase.from("social_card_checklist_progress").insert({
            card_id: cardId,
            checklist_item_id: itemId,
            completed_at: new Date().toISOString(),
            completed_by: currentStaffId,
          });
        }
      }

      await loadData();

      // Check if all items are now completed - auto advance
      const updatedCompletedCount = isCompleted
        ? progress.filter((p) => p.completed_at && p.checklist_item_id !== itemId).length
        : progress.filter((p) => p.completed_at).length + 1;

      if (
        !isCompleted &&
        updatedCompletedCount === checklistItems.length &&
        checklistItems.length > 0
      ) {
        // Find next stage
        const currentStage = stages.find((s) => s.id === stageId);
        const nextStage = stages.find(
          (s) => currentStage && s.sort_order > currentStage.sort_order
        );

        if (nextStage && onAutoAdvance) {
          toast.success("Checklist completo! Avançando para próxima etapa...");
          onAutoAdvance(nextStage.id);
        }
      }
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error("Erro ao atualizar progresso");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (checklistItems.length === 0) {
    return null;
  }

  const completedCount = checklistItems.filter((item) => isItemCompleted(item.id)).length;
  const progressPercent = (completedCount / checklistItems.length) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Progress value={progressPercent} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount}/{checklistItems.length}
        </span>
      </div>

      <div className="space-y-2">
        {checklistItems.map((item) => {
          const completed = isItemCompleted(item.id);
          const isUpdating = updating === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded-md transition-colors",
                completed ? "bg-green-500/10" : "bg-muted/50"
              )}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin mt-0.5" />
              ) : (
                <Checkbox
                  id={`checklist-${item.id}`}
                  checked={completed}
                  onCheckedChange={() => handleToggle(item.id)}
                  className="mt-0.5"
                />
              )}
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={`checklist-${item.id}`}
                  className={cn(
                    "text-sm cursor-pointer",
                    completed && "line-through text-muted-foreground"
                  )}
                >
                  {item.title}
                </Label>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
              {completed && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
