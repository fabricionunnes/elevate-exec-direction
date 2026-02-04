import { DragEvent, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Image, Video, Film, Calendar, Clock, Pencil, Check, X, Plus, CheckCircle, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { StageChecklistManager } from "./StageChecklistManager";
import { CardChecklistBadge } from "./CardChecklistBadge";

// Hook for drag-to-scroll functionality
const useDragToScroll = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only activate on middle mouse button or when clicking on empty space
    if (e.button === 1 || (e.target as HTMLElement).closest('[data-kanban-scrollable]')) {
      isMouseDown.current = true;
      startX.current = e.pageX - (containerRef.current?.offsetLeft || 0);
      scrollLeft.current = containerRef.current?.scrollLeft || 0;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
        containerRef.current.style.userSelect = 'none';
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      containerRef.current.style.removeProperty('user-select');
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isMouseDown.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isMouseDown.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      containerRef.current.style.removeProperty('user-select');
    }
  }, []);

  return {
    containerRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
};

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
  creative_url: string | null;
  creative_type: string | null;
  suggested_date: string | null;
  suggested_time: string | null;
  is_locked: boolean;
  sort_order: number;
  briefing_aligned?: boolean;
}

interface SocialKanbanBoardProps {
  stages: Stage[];
  cards: ContentCard[];
  boardId: string;
  onCardMove: (cardId: string, newStageId: string) => void;
  onCardClick: (card: ContentCard) => void;
  onStageUpdate?: () => void;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  feed: <Image className="h-3.5 w-3.5" />,
  reels: <Film className="h-3.5 w-3.5" />,
  stories: <Video className="h-3.5 w-3.5" />,
};

const contentTypeLabels: Record<string, string> = {
  feed: "Feed",
  reels: "Reels",
  stories: "Stories",
};

const objectiveColors: Record<string, string> = {
  engagement: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  authority: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  conversion: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export const SocialKanbanBoard = ({
  stages,
  cards,
  boardId,
  onCardMove,
  onCardClick,
  onStageUpdate,
}: SocialKanbanBoardProps) => {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const { containerRef, handlers: scrollHandlers } = useDragToScroll();
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [savingStage, setSavingStage] = useState(false);

  const handleStartEditStage = (stage: Stage) => {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  };

  const handleCancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const handleSaveStage = async (stageId: string) => {
    if (!editingStageName.trim()) return;

    try {
      const { error } = await supabase
        .from("social_content_stages")
        .update({ name: editingStageName.trim() })
        .eq("id", stageId);

      if (error) throw error;

      toast.success("Etapa atualizada!");
      setEditingStageId(null);
      setEditingStageName("");
      onStageUpdate?.();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar etapa");
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;

    setSavingStage(true);
    try {
      const maxSortOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) : -1;

      const { error } = await supabase
        .from("social_content_stages")
        .insert({
          board_id: boardId,
          name: newStageName.trim(),
          stage_type: "custom" as const,
          color: newStageColor,
          sort_order: maxSortOrder + 1,
          is_active: true,
        });

      if (error) throw error;

      toast.success("Nova etapa criada!");
      setIsAddingStage(false);
      setNewStageName("");
      setNewStageColor("#6366f1");
      onStageUpdate?.();
    } catch (error) {
      console.error("Error adding stage:", error);
      toast.error("Erro ao criar etapa");
    } finally {
      setSavingStage(false);
    }
  };

  const handleDeleteStage = async (stageId: string, stageCardsCount: number) => {
    if (stageCardsCount > 0) {
      toast.error("Mova ou exclua os cards antes de remover esta etapa");
      return;
    }

    try {
      const { error } = await supabase
        .from("social_content_stages")
        .delete()
        .eq("id", stageId);

      if (error) throw error;

      toast.success("Etapa excluída!");
      onStageUpdate?.();
    } catch (error) {
      console.error("Error deleting stage:", error);
      toast.error("Erro ao excluir etapa");
    }
  };

  const handleDragStart = (e: DragEvent, cardId: string) => {
    e.dataTransfer.setData("cardId", cardId);
    setDraggedCardId(cardId);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId) {
      onCardMove(cardId, stageId);
    }
    setDragOverStageId(null);
  };

  return (
    <div
      ref={containerRef}
      data-kanban-scrollable
      className="h-full w-full overflow-x-auto cursor-grab"
      style={{ scrollBehavior: 'auto' }}
      {...scrollHandlers}
    >
      <div className="flex gap-4 p-4 min-w-max">
        {stages.map((stage) => {
          const stageCards = cards.filter((c) => c.stage_id === stage.id);
          const isOver = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              className={cn(
                "w-72 flex-shrink-0 rounded-xl bg-muted/50 transition-colors",
                isOver && "bg-primary/10 ring-2 ring-primary/20"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
              <div className="p-3 border-b border-border/50 group">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  {editingStageId === stage.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveStage(stage.id);
                          if (e.key === "Escape") handleCancelEditStage();
                        }}
                      />
                      <button
                        onClick={() => handleSaveStage(stage.id)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <Check className="h-4 w-4 text-green-500" />
                      </button>
                      <button
                        onClick={handleCancelEditStage}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium text-sm truncate flex-1">
                        {stage.name}
                      </h3>
                      <button
                        onClick={() => handleStartEditStage(stage)}
                        className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir etapa "{stage.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {stageCards.length > 0 
                                ? `Esta etapa possui ${stageCards.length} card(s). Mova ou exclua os cards antes de remover a etapa.`
                                : "Esta ação não pode ser desfeita. A etapa será removida permanentemente."
                              }
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStage(stage.id, stageCards.length)}
                              disabled={stageCards.length > 0}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                  <StageChecklistManager stageId={stage.id} stageName={stage.name} />
                  <Badge variant="secondary" className="text-xs">
                    {stageCards.length}
                  </Badge>
                </div>
              </div>

              {/* Cards Container */}
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="p-2 space-y-2">
                  {stageCards.map((card) => (
                    <Card
                      key={card.id}
                      draggable={!card.is_locked}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onCardClick(card)}
                      className={cn(
                        "p-3 cursor-pointer hover:shadow-md transition-shadow",
                        draggedCardId === card.id && "opacity-50",
                        card.is_locked && "opacity-75"
                      )}
                    >
                      {/* Creative Preview Thumbnail */}
                      <div className="mb-2 rounded-md overflow-hidden bg-muted relative aspect-[4/5]">
                        {card.creative_url ? (
                          card.creative_type === "video" ? (
                            <div className="relative w-full h-full bg-black/5">
                              <video
                                src={card.creative_url}
                                className="w-full h-full object-contain"
                                muted
                                playsInline
                                preload="metadata"
                                onLoadedMetadata={(e) => {
                                  const video = e.currentTarget;
                                  video.currentTime = 0.1;
                                }}
                              />
                              {/* Video indicator overlay */}
                              <div className="absolute bottom-2 right-2">
                                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <Film className="h-4 w-4 text-gray-800" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={card.creative_url}
                              alt={card.theme}
                              className="w-full h-full object-contain bg-black/5"
                              loading="eager"
                              onError={(e) => {
                                console.error("Image load error for card:", card.id);
                              }}
                            />
                          )
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
                            {card.content_type === "reels" || card.content_type === "stories" ? (
                              <Film className="h-10 w-10 opacity-50" />
                            ) : (
                              <Image className="h-10 w-10 opacity-50" />
                            )}
                            <span className="text-xs opacity-50">Sem mídia</span>
                          </div>
                        )}
                      </div>

                      {/* Content Type & Objective */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-xs gap-1">
                          {contentTypeIcons[card.content_type]}
                          {contentTypeLabels[card.content_type]}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-xs",
                            objectiveColors[card.objective] || ""
                          )}
                        >
                          {card.objective === "engagement"
                            ? "Engajamento"
                            : card.objective === "authority"
                            ? "Autoridade"
                            : "Conversão"}
                        </Badge>
                      </div>

                      {/* Theme */}
                      <p className="text-sm font-medium line-clamp-2 mb-2">
                        {card.theme}
                      </p>

                      {/* Briefing Aligned Indicator */}
                      {card.briefing_aligned && (
                        <div className="flex items-center gap-1 text-xs text-primary mb-2">
                          <CheckCircle className="h-3 w-3" />
                          <span>Alinhado ao briefing</span>
                        </div>
                      )}

                      {/* Schedule & Checklist Progress */}
                      <div className="flex items-center justify-between gap-2">
                        {(card.suggested_date || card.suggested_time) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {card.suggested_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(card.suggested_date), "dd/MM", {
                                  locale: ptBR,
                                })}
                              </span>
                            )}
                            {card.suggested_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {card.suggested_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        )}
                        <CardChecklistBadge cardId={card.id} stageId={card.stage_id} />
                      </div>
                    </Card>
                  ))}

                  {stageCards.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum conteúdo
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}

        {/* Add New Stage */}
        <div className="w-72 flex-shrink-0">
          {isAddingStage ? (
            <div className="rounded-xl bg-muted/50 p-3 space-y-3">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Nome da etapa"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddStage();
                  if (e.key === "Escape") {
                    setIsAddingStage(false);
                    setNewStageName("");
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Cor:</label>
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8"
                  onClick={handleAddStage}
                  disabled={savingStage || !newStageName.trim()}
                >
                  {savingStage ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Criar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setIsAddingStage(false);
                    setNewStageName("");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingStage(true)}
              className="w-full h-12 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Nova Etapa</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
