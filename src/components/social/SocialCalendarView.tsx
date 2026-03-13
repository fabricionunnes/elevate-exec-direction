import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image, Video, Film, Clock, Eye } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
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

interface SocialCalendarViewProps {
  cards: ContentCard[];
  stages: Stage[];
  onCardClick: (card: ContentCard) => void;
}

const contentTypeIcon: Record<string, React.ReactNode> = {
  image: <Image className="h-3 w-3" />,
  video: <Video className="h-3 w-3" />,
  reels: <Film className="h-3 w-3" />,
  carousel: <Image className="h-3 w-3" />,
};

export const SocialCalendarView = ({ cards, stages, onCardClick }: SocialCalendarViewProps) => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);

  const stageMap = useMemo(() => {
    const map: Record<string, Stage> = {};
    stages.forEach((s) => (map[s.id] = s));
    return map;
  }, [stages]);

  // Get the relevant date for a card (scheduled_at > suggested_date > created_at)
  const getCardDate = (card: ContentCard): Date | null => {
    if (card.scheduled_at) return new Date(card.scheduled_at);
    if (card.suggested_date) return parseDateLocal(card.suggested_date);
    return null;
  };

  // Cards that have a date
  const datedCards = useMemo(() => {
    return cards
      .filter((c) => c.card_type === "content" && getCardDate(c) !== null)
      .map((c) => ({ card: c, date: getCardDate(c)! }));
  }, [cards]);

  // Days that have posts
  const daysWithPosts = useMemo(() => {
    const days: Date[] = [];
    datedCards.forEach(({ date }) => {
      if (!days.some((d) => isSameDay(d, date))) {
        days.push(date);
      }
    });
    return days;
  }, [datedCards]);

  // Cards for selected day
  const selectedDayCards = useMemo(() => {
    if (!selectedDay) return [];
    return datedCards
      .filter(({ date }) => isSameDay(date, selectedDay))
      .sort((a, b) => {
        const timeA = a.card.suggested_time || "23:59";
        const timeB = b.card.suggested_time || "23:59";
        return timeA.localeCompare(timeB);
      });
  }, [selectedDay, datedCards]);

  // Monthly stats
  const monthStats = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const monthCards = datedCards.filter(
      ({ date }) => date >= start && date <= end
    );
    const published = monthCards.filter(({ card }) => card.published_at).length;
    const scheduled = monthCards.filter(({ card }) => card.scheduled_at && !card.published_at).length;
    const draft = monthCards.length - published - scheduled;
    return { total: monthCards.length, published, scheduled, draft };
  }, [selectedMonth, datedCards]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
      {/* Calendar Side */}
      <div className="flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold text-foreground">{monthStats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold text-green-600">{monthStats.published}</p>
            <p className="text-[10px] text-muted-foreground">Publicados</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold text-blue-600">{monthStats.scheduled}</p>
            <p className="text-[10px] text-muted-foreground">Agendados</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold text-amber-600">{monthStats.draft}</p>
            <p className="text-[10px] text-muted-foreground">Rascunhos</p>
          </div>
        </div>

        {/* Calendar */}
        <Card>
          <CardContent className="p-2">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              locale={ptBR}
              className="pointer-events-auto"
              modifiers={{
                hasPost: daysWithPosts,
              }}
              modifiersClassNames={{
                hasPost: "has-post-dot",
              }}
            />
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Com postagem
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Publicado
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Agendado
          </span>
        </div>
      </div>

      {/* Day Detail Side */}
      <div className="flex-1 min-w-0">
        {selectedDay ? (
          <div className="flex flex-col gap-3 h-full">
            <h3 className="text-lg font-semibold text-foreground">
              {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h3>

            {selectedDayCards.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Nenhuma postagem para este dia</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                  {selectedDayCards.map(({ card }) => {
                    const stage = stageMap[card.stage_id];
                    return (
                      <Card
                        key={card.id}
                        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                        style={{ borderLeftColor: stage?.color || "hsl(var(--primary))" }}
                        onClick={() => onCardClick(card)}
                      >
                        <CardContent className="p-3 space-y-2">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {card.theme || "Sem tema"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {card.objective}
                              </p>
                            </div>
                            {card.creative_url && (
                              <img
                                src={card.creative_url}
                                alt=""
                                className="h-12 w-12 rounded object-cover flex-shrink-0"
                              />
                            )}
                          </div>

                          {/* Meta */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1"
                              style={{ borderColor: stage?.color, color: stage?.color }}
                            >
                              {stage?.name || "—"}
                            </Badge>

                            {card.content_type && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                {contentTypeIcon[card.content_type]}
                                {card.content_type}
                              </Badge>
                            )}

                            {card.suggested_time && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Clock className="h-3 w-3" />
                                {card.suggested_time}
                              </Badge>
                            )}

                            {card.published_at && (
                              <Badge className="text-[10px] bg-green-600 hover:bg-green-700 gap-1">
                                Publicado
                              </Badge>
                            )}

                            {card.scheduled_at && !card.published_at && (
                              <Badge className="text-[10px] bg-blue-600 hover:bg-blue-700 gap-1">
                                Agendado
                              </Badge>
                            )}
                          </div>

                          {/* Copy preview */}
                          {card.copy_text && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {card.copy_text}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Eye className="h-10 w-10 opacity-30" />
            <p>Selecione um dia para ver as postagens</p>
          </div>
        )}
      </div>

      {/* CSS for dot indicator */}
      <style>{`
        .has-post-dot {
          position: relative;
        }
        .has-post-dot::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};
