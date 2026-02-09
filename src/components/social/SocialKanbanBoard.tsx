import { DragEvent, useState, useRef, useCallback, useMemo } from "react";
import { parseDateLocal } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Image, Video, Film, Calendar, Clock, Pencil, Check, X, Plus, CheckCircle, Trash2, ListChecks, Info, Paperclip, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { StageChecklistManager } from "./StageChecklistManager";
import { CardChecklistBadge } from "./CardChecklistBadge";
import { CardTagsDisplay } from "./CardTagSelector";
import { AttachmentCountBadge } from "./CardAttachments";

type SortOption = "manual" | "date_asc" | "date_desc" | "type" | "created_asc" | "created_desc";

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
  card_type?: "content" | "task" | "info";
  card_color?: string | null;
  copy_text?: string | null;
  created_at?: string;
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
  estatico: <Image className="h-3.5 w-3.5" />,
  carrossel: <Image className="h-3.5 w-3.5" />,
  reels: <Film className="h-3.5 w-3.5" />,
  stories: <Video className="h-3.5 w-3.5" />,
  outro: <Image className="h-3.5 w-3.5" />,
};

const contentTypeLabels: Record<string, string> = {
  feed: "Feed",
  estatico: "Estático",
  carrossel: "Carrossel",
  reels: "Reels",
  stories: "Stories",
  outro: "Outro",
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
  // State to track sort option per stage
  const [stageSortOptions, setStageSortOptions] = useState<Record<string, SortOption>>({});

  // Function to get sort option for a specific stage
  const getStageSortOption = (stageId: string): SortOption => {
    return stageSortOptions[stageId] || "manual";
  };

  // Function to set sort option for a specific stage
  const setStageSortOption = (stageId: string, option: SortOption) => {
    setStageSortOptions(prev => ({ ...prev, [stageId]: option }));
  };

  // Function to sort cards based on selected option for a specific stage
  const sortCards = useCallback((cardsToSort: ContentCard[], stageId: string): ContentCard[] => {
    const sorted = [...cardsToSort];
    const sortOption = stageSortOptions[stageId] || "manual";
    
    switch (sortOption) {
      case "date_asc":
        return sorted.sort((a, b) => {
          if (!a.suggested_date && !b.suggested_date) return 0;
          if (!a.suggested_date) return 1;
          if (!b.suggested_date) return -1;
          return parseDateLocal(a.suggested_date).getTime() - parseDateLocal(b.suggested_date).getTime();
        });
      case "date_desc":
        return sorted.sort((a, b) => {
          if (!a.suggested_date && !b.suggested_date) return 0;
          if (!a.suggested_date) return 1;
          if (!b.suggested_date) return -1;
          return parseDateLocal(b.suggested_date).getTime() - parseDateLocal(a.suggested_date).getTime();
        });
      case "type":
        return sorted.sort((a, b) => {
          const typeA = a.card_type || "content";
          const typeB = b.card_type || "content";
          if (typeA === typeB) {
            return (a.content_type || "").localeCompare(b.content_type || "");
          }
          const typeOrder = { task: 0, content: 1, info: 2 };
          return (typeOrder[typeA] || 1) - (typeOrder[typeB] || 1);
        });
      case "created_asc":
        return sorted.sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      case "created_desc":
        return sorted.sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case "manual":
      default:
        return sorted.sort((a, b) => a.sort_order - b.sort_order);
    }
  }, [stageSortOptions]);

  const getSortLabel = (stageId: string) => {
    const sortOption = stageSortOptions[stageId] || "manual";
    switch (sortOption) {
      case "date_asc": return "Data ↑";
      case "date_desc": return "Data ↓";
      case "type": return "Tipo";
      case "created_asc": return "Criação ↑";
      case "created_desc": return "Criação ↓";
      default: return "Manual";
    }
  };

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
          const stageCards = sortCards(cards.filter((c) => c.stage_id === stage.id), stage.id);
          const isOver = dragOverStageId === stage.id;
          const currentSortOption = getStageSortOption(stage.id);

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
                
                {/* Sort Button per Stage */}
                <div className="mt-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs w-full justify-start px-2 text-muted-foreground hover:text-foreground">
                        <ArrowUpDown className="h-3 w-3" />
                        {getSortLabel(stage.id)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem 
                        onClick={() => setStageSortOption(stage.id, "manual")} 
                        className={currentSortOption === "manual" ? "bg-accent" : ""}
                      >
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Manual
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setStageSortOption(stage.id, "date_asc")} 
                        className={currentSortOption === "date_asc" ? "bg-accent" : ""}
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Data (Mais antiga)
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setStageSortOption(stage.id, "date_desc")} 
                        className={currentSortOption === "date_desc" ? "bg-accent" : ""}
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Data (Mais recente)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setStageSortOption(stage.id, "type")} 
                        className={currentSortOption === "type" ? "bg-accent" : ""}
                      >
                        <ListChecks className="h-4 w-4 mr-2" />
                        Tipo de Card
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setStageSortOption(stage.id, "created_asc")} 
                        className={currentSortOption === "created_asc" ? "bg-accent" : ""}
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Criação (Mais antigo)
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setStageSortOption(stage.id, "created_desc")} 
                        className={currentSortOption === "created_desc" ? "bg-accent" : ""}
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Criação (Mais recente)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Cards Container */}
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="p-2 space-y-2">
                  {stageCards.map((card) => {
                    const cardType = card.card_type || "content";
                    const isContentCard = cardType === "content";
                    const isTaskCard = cardType === "task";
                    const isInfoCard = cardType === "info";

                    return (
                      <Card
                        key={card.id}
                        draggable={!card.is_locked}
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onCardClick(card)}
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-shadow overflow-hidden",
                          draggedCardId === card.id && "opacity-50",
                          card.is_locked && "opacity-75"
                        )}
                        style={{
                          borderLeftWidth: card.card_color ? "4px" : undefined,
                          borderLeftColor: card.card_color || undefined,
                        }}
                      >
                        <div className="p-3">
                          {/* Type Badge for Task/Info cards */}
                          {!isContentCard && (
                            <div className="flex items-center gap-1 mb-2">
                              {isTaskCard && (
                                <Badge variant="outline" className="text-xs gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                  <ListChecks className="h-3 w-3" />
                                  Tarefa
                                </Badge>
                              )}
                              {isInfoCard && (
                                <Badge variant="outline" className="text-xs gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                  <Info className="h-3 w-3" />
                                  Informação
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Creative Preview Thumbnail - ONLY for content cards WITH media */}
                          {isContentCard && card.creative_url && (
                            <div className="mb-2 rounded-md overflow-hidden bg-muted/50 relative">
                              {card.creative_type === "video" ? (
                                <div className="relative w-full bg-black/5">
                                  <video
                                    src={card.creative_url}
                                    className="w-full h-auto max-h-80 object-contain mx-auto"
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
                                  className="w-full h-auto max-h-80 object-contain mx-auto bg-black/5"
                                  loading="eager"
                                  onError={(e) => {
                                    console.error("Image load error for card:", card.id);
                                  }}
                                />
                              )}
                            </div>
                          )}

                          {/* Content Type & Objective - only for content cards */}
                          {isContentCard && (
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <Badge variant="outline" className="text-xs gap-1">
                                {contentTypeIcons[card.content_type]}
                                {contentTypeLabels[card.content_type] || card.content_type}
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
                          )}

                          {/* Theme */}
                          <p className="text-sm font-medium line-clamp-2 mb-2">
                            {card.theme}
                          </p>

                          {/* Description preview for info cards */}
                          {isInfoCard && card.copy_text && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {card.copy_text}
                            </p>
                          )}

                          {/* Status Tags */}
                          <CardTagsDisplay cardId={card.id} />

                          {/* Briefing Aligned Indicator */}
                          {card.briefing_aligned && (
                            <div className="flex items-center gap-1 text-xs text-primary mt-2">
                              <CheckCircle className="h-3 w-3" />
                              <span>Alinhado ao briefing</span>
                            </div>
                          )}

                          {/* Schedule, Checklist Progress & Attachments */}
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {card.suggested_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseDateLocal(card.suggested_date), "dd/MM/yyyy", {
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
                              {/* Attachments count for task/info cards */}
                              {(isTaskCard || isInfoCard) && (
                                <AttachmentCountBadge cardId={card.id} />
                              )}
                            </div>
                            <CardChecklistBadge cardId={card.id} stageId={card.stage_id} />
                          </div>
                        </div>
                      </Card>
                    );
                  })}

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
