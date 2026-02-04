import { DragEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Image, Video, Film, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
}

interface SocialKanbanBoardProps {
  stages: Stage[];
  cards: ContentCard[];
  onCardMove: (cardId: string, newStageId: string) => void;
  onCardClick: (card: ContentCard) => void;
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
  onCardMove,
  onCardClick,
}: SocialKanbanBoardProps) => {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

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
    <ScrollArea className="h-full w-full">
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
              <div className="p-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="font-medium text-sm truncate flex-1">
                    {stage.name}
                  </h3>
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
                      {/* Creative Preview */}
                      {card.creative_url && (
                        <div className="mb-2 rounded-md overflow-hidden bg-muted aspect-video">
                          {card.creative_type === "video" ? (
                            <video
                              src={card.creative_url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={card.creative_url}
                              alt={card.theme}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      )}

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

                      {/* Schedule */}
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
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
