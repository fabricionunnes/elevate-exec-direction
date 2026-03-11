import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Heart, MessageCircle, Share2, Bookmark, ExternalLink, ArrowUpDown, Grid3X3, Loader2 } from "lucide-react";
import type { InstagramAccount, InstagramPost, InstagramPostMetrics } from "../types";

interface InstagramPostsProps {
  accountId: string;
  account: InstagramAccount;
}

export const InstagramPosts = ({ accountId, account }: InstagramPostsProps) => {
  const [posts, setPosts] = useState<(InstagramPost & { metrics: InstagramPostMetrics | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [selectedPost, setSelectedPost] = useState<(InstagramPost & { metrics: InstagramPostMetrics | null }) | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      let query = supabase
        .from("instagram_posts")
        .select("*, metrics:instagram_post_metrics(*)")
        .eq("account_id", accountId)
        .order("posted_at", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("post_type", typeFilter);
      }

      const { data } = await query;
      
      let result = (data || []).map((p: any) => ({
        ...p,
        metrics: Array.isArray(p.metrics) ? p.metrics[0] || null : p.metrics,
      }));

      if (sortBy === "engagement") {
        result.sort((a: any, b: any) => (b.metrics?.likes || 0) + (b.metrics?.comments || 0) - (a.metrics?.likes || 0) - (a.metrics?.comments || 0));
      } else if (sortBy === "reach") {
        result.sort((a: any, b: any) => (b.metrics?.reach || 0) - (a.metrics?.reach || 0));
      }

      setPosts(result);
      setLoading(false);
    };
    fetchPosts();
  }, [accountId, typeFilter, sortBy]);

  const getPostTypeLabel = (type: string) => {
    const map: Record<string, string> = { feed: "Feed", reels: "Reels", carousel: "Carrossel", stories: "Stories" };
    return map[type] || type;
  };

  const getPostClassification = (metrics: InstagramPostMetrics | null) => {
    if (!metrics) return { label: "—", color: "bg-muted text-muted-foreground" };
    const engagement = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
    if (engagement > 500) return { label: "Excelente", color: "bg-green-100 text-green-800" };
    if (engagement > 200) return { label: "Bom", color: "bg-blue-100 text-blue-800" };
    if (engagement > 50) return { label: "Mediano", color: "bg-yellow-100 text-yellow-800" };
    return { label: "Fraco", color: "bg-red-100 text-red-800" };
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="feed">Feed</SelectItem>
            <SelectItem value="reels">Reels</SelectItem>
            <SelectItem value="carousel">Carrossel</SelectItem>
            <SelectItem value="stories">Stories</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Data (recente)</SelectItem>
            <SelectItem value="engagement">Engajamento</SelectItem>
            <SelectItem value="reach">Alcance</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{posts.length} publicações</span>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma publicação encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {posts.map((post) => {
            const classification = getPostClassification(post.metrics);
            return (
              <Card key={post.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPost(post)}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {post.media_url && (
                      <img src={post.thumbnail_url || post.media_url} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{getPostTypeLabel(post.post_type)}</Badge>
                        <Badge className={`text-[10px] ${classification.color}`}>{classification.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.caption || "Sem legenda"}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {post.posted_at ? new Date(post.posted_at).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                  </div>
                  {post.metrics && (
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.metrics.reach}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{post.metrics.likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.metrics.comments}</span>
                      <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{post.metrics.shares}</span>
                      <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{post.metrics.saves}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhes da Publicação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedPost.media_url && (
                  <img src={selectedPost.media_url} alt="" className="w-full rounded-lg max-h-80 object-cover" />
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{getPostTypeLabel(selectedPost.post_type)}</Badge>
                  <Badge className={getPostClassification(selectedPost.metrics).color}>
                    {getPostClassification(selectedPost.metrics).label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedPost.posted_at ? new Date(selectedPost.posted_at).toLocaleString("pt-BR") : "—"}
                  </span>
                  {selectedPost.permalink && (
                    <a href={selectedPost.permalink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Ver no Instagram
                    </a>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{selectedPost.caption || "Sem legenda"}</p>
                
                {selectedPost.metrics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Alcance", value: selectedPost.metrics.reach, icon: Eye },
                      { label: "Impressões", value: selectedPost.metrics.impressions, icon: Eye },
                      { label: "Curtidas", value: selectedPost.metrics.likes, icon: Heart },
                      { label: "Comentários", value: selectedPost.metrics.comments, icon: MessageCircle },
                      { label: "Compartilhamentos", value: selectedPost.metrics.shares, icon: Share2 },
                      { label: "Salvamentos", value: selectedPost.metrics.saves, icon: Bookmark },
                      { label: "Visitas ao Perfil", value: selectedPost.metrics.profile_visits, icon: Eye },
                      { label: "Cliques em Link", value: selectedPost.metrics.link_clicks, icon: ExternalLink },
                    ].map((m) => (
                      <Card key={m.label}>
                        <CardContent className="p-3 text-center">
                          <m.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold">{m.value.toLocaleString("pt-BR")}</p>
                          <p className="text-[10px] text-muted-foreground">{m.label}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
