import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Eye,
  TrendingUp,
  Trophy,
  Medal,
  Crown,
  Loader2,
  Image,
  Video,
  Film,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContentCard {
  id: string;
  stage_id: string;
  content_type: string;
  theme: string;
  objective: string;
  copy_text: string | null;
  creative_url: string | null;
  creative_type: string | null;
  published_at: string | null;
  instagram_post_url: string | null;
  card_type: "content" | "task" | "info";
}

interface PostMetric {
  id: string;
  card_id: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  synced_at: string | null;
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface SocialPerformanceViewProps {
  cards: ContentCard[];
  stages: Stage[];
  boardId: string;
  projectId: string;
}

const contentTypeIcon: Record<string, React.ReactNode> = {
  image: <Image className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
  reels: <Film className="h-3.5 w-3.5" />,
  carousel: <Image className="h-3.5 w-3.5" />,
};

const rankIcons = [
  <Crown className="h-5 w-5 text-yellow-500" />,
  <Medal className="h-5 w-5 text-gray-400" />,
  <Medal className="h-5 w-5 text-amber-700" />,
];

type SortBy = "engagement" | "likes" | "comments" | "saves" | "shares" | "views" | "reach";

const ITEMS_PER_PAGE = 10;

export const SocialPerformanceView = ({ cards, stages, boardId, projectId }: SocialPerformanceViewProps) => {
  const [metrics, setMetrics] = useState<PostMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("engagement");
  const [currentPage, setCurrentPage] = useState(1);

  const publishedCards = useMemo(
    () => cards.filter((c) => c.card_type === "content" && c.published_at),
    [cards]
  );

  const stageMap = useMemo(() => {
    const map: Record<string, Stage> = {};
    stages.forEach((s) => (map[s.id] = s));
    return map;
  }, [stages]);

  useEffect(() => {
    loadMetrics();
  }, [boardId]);

  // Reset page when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("social_post_metrics")
        .select("*")
        .eq("board_id", boardId);

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncFromInstagram = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-sync-metrics", {
        body: { projectId, boardId },
      });

      if (error) {
        console.error("Sync error details:", error);
        throw error;
      }

      if (data?.success) {
        toast.success(`Métricas sincronizadas! ${data.synced}/${data.total} posts atualizados`);
        await loadMetrics();
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error syncing metrics:", error);
      toast.error("Erro ao sincronizar métricas do Instagram. Verifique se o Instagram está conectado nas Integrações.");
    } finally {
      setSyncing(false);
    }
  };

  const getMetricForCard = (cardId: string): PostMetric | undefined =>
    metrics.find((m) => m.card_id === cardId);

  // Ranked cards - show ALL published cards, sorted by metric
  const rankedCards = useMemo(() => {
    return publishedCards
      .map((card) => ({
        card,
        metrics: getMetricForCard(card.id),
      }))
      .sort((a, b) => {
        const ma = a.metrics;
        const mb = b.metrics;
        if (!ma && !mb) return 0;
        if (!ma) return 1;
        if (!mb) return -1;
        switch (sortBy) {
          case "engagement": return (mb.engagement_rate || 0) - (ma.engagement_rate || 0);
          case "likes": return mb.likes - ma.likes;
          case "comments": return mb.comments - ma.comments;
          case "saves": return mb.saves - ma.saves;
          case "shares": return mb.shares - ma.shares;
          case "views": return mb.views - ma.views;
          case "reach": return mb.reach - ma.reach;
          default: return 0;
        }
      });
  }, [publishedCards, metrics, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rankedCards.length / ITEMS_PER_PAGE));
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return rankedCards.slice(start, start + ITEMS_PER_PAGE);
  }, [rankedCards, currentPage]);

  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        likes: acc.likes + m.likes,
        comments: acc.comments + m.comments,
        saves: acc.saves + m.saves,
        shares: acc.shares + m.shares,
        views: acc.views + m.views,
        reach: acc.reach + m.reach,
      }),
      { likes: 0, comments: 0, saves: 0, shares: 0, views: 0, reach: 0 }
    );
  }, [metrics]);

  const avgEngagement = useMemo(() => {
    const withRate = metrics.filter((m) => m.engagement_rate > 0);
    if (withRate.length === 0) return 0;
    return (withRate.reduce((sum, m) => sum + m.engagement_rate, 0) / withRate.length).toFixed(2);
  }, [metrics]);

  const lastSyncDate = useMemo(() => {
    const synced = metrics.filter((m) => m.synced_at).sort((a, b) =>
      new Date(b.synced_at!).getTime() - new Date(a.synced_at!).getTime()
    );
    return synced[0]?.synced_at || null;
  }, [metrics]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      {/* Sync Bar */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="text-sm text-muted-foreground">
          {lastSyncDate ? (
            <span>
              Última sincronização: {format(new Date(lastSyncDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          ) : (
            <span>Métricas ainda não sincronizadas</span>
          )}
        </div>
        <Button onClick={syncFromInstagram} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? "Sincronizando..." : "Sincronizar Instagram"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { icon: <Heart className="h-4 w-4 text-red-500" />, label: "Curtidas", value: totals.likes },
          { icon: <MessageCircle className="h-4 w-4 text-blue-500" />, label: "Comentários", value: totals.comments },
          { icon: <Bookmark className="h-4 w-4 text-amber-500" />, label: "Salvamentos", value: totals.saves },
          { icon: <Share2 className="h-4 w-4 text-green-500" />, label: "Compartilhamentos", value: totals.shares },
          { icon: <Eye className="h-4 w-4 text-purple-500" />, label: "Visualizações", value: totals.views },
          { icon: <TrendingUp className="h-4 w-4 text-primary" />, label: "Alcance", value: totals.reach },
          { icon: <Trophy className="h-4 w-4 text-yellow-500" />, label: "Engajamento Médio", value: `${avgEngagement}%` },
        ].map((stat, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-3 flex flex-col items-center gap-1">
              {stat.icon}
              <span className="text-lg font-bold text-foreground">{stat.value}</span>
              <span className="text-[10px] text-muted-foreground text-center">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sort + Ranking */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Ranking de Posts</span>
          <Badge variant="secondary" className="text-[10px]">{publishedCards.length} posts</Badge>
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="engagement">Engajamento %</SelectItem>
            <SelectItem value="likes">Curtidas</SelectItem>
            <SelectItem value="comments">Comentários</SelectItem>
            <SelectItem value="saves">Salvamentos</SelectItem>
            <SelectItem value="shares">Compartilhamentos</SelectItem>
            <SelectItem value="views">Visualizações</SelectItem>
            <SelectItem value="reach">Alcance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards List */}
      <div className="flex-1">
        {paginatedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Trophy className="h-10 w-10 opacity-30" />
            <p>Nenhum post publicado ainda</p>
            <p className="text-xs">Publique conteúdos e sincronize para ver o ranking</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedCards.map(({ card, metrics: m }, index) => {
              const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
              const stage = stageMap[card.stage_id];
              const hasMetrics = m && (m.likes + m.comments + m.saves + m.shares + m.views) > 0;
              return (
                <Card
                  key={card.id}
                  className={`border-l-4 ${hasMetrics && globalIndex < 3 ? "shadow-md" : ""}`}
                  style={{
                    borderLeftColor: hasMetrics
                      ? (globalIndex === 0 ? "#EAB308" : globalIndex === 1 ? "#9CA3AF" : globalIndex === 2 ? "#B45309" : (stage?.color || "hsl(var(--primary))"))
                      : (stage?.color || "hsl(var(--muted))")
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Rank */}
                      <div className="flex flex-col items-center justify-center min-w-[40px]">
                        {hasMetrics && globalIndex < 3 ? rankIcons[globalIndex] : (
                          <span className="text-lg font-bold text-muted-foreground">#{globalIndex + 1}</span>
                        )}
                      </div>

                      {/* Thumbnail */}
                      {card.creative_url && (
                        <img
                          src={card.creative_url}
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-foreground truncate">{card.theme}</p>
                          {card.content_type && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              {contentTypeIcon[card.content_type]}
                              {card.content_type}
                            </Badge>
                          )}
                        </div>
                        {card.published_at && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Publicado em {format(new Date(card.published_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}

                        {/* Metrics Row */}
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="flex items-center gap-1 text-red-500">
                            <Heart className="h-3.5 w-3.5" /> {m?.likes || 0}
                          </span>
                          <span className="flex items-center gap-1 text-blue-500">
                            <MessageCircle className="h-3.5 w-3.5" /> {m?.comments || 0}
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <Bookmark className="h-3.5 w-3.5" /> {m?.saves || 0}
                          </span>
                          <span className="flex items-center gap-1 text-green-500">
                            <Share2 className="h-3.5 w-3.5" /> {m?.shares || 0}
                          </span>
                          <span className="flex items-center gap-1 text-purple-500">
                            <Eye className="h-3.5 w-3.5" /> {m?.views || 0}
                          </span>
                          {m?.engagement_rate ? (
                            <span className="flex items-center gap-1 font-semibold text-primary">
                              <TrendingUp className="h-3.5 w-3.5" /> {m.engagement_rate}%
                            </span>
                          ) : null}
                        </div>

                        {!hasMetrics && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">
                            Sincronize para buscar métricas
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
