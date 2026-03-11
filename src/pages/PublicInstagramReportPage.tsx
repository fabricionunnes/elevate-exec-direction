import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Heart, MessageCircle, Share2, Bookmark, Users, Loader2, TrendingUp } from "lucide-react";

const PublicInstagramReportPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!shareToken) { setError("Token inválido"); setLoading(false); return; }

      const { data, error: err } = await supabase
        .from("instagram_reports")
        .select("*")
        .eq("share_token", shareToken)
        .single();

      if (err || !data) {
        setError("Relatório não encontrado ou link inválido.");
      } else {
        setReport(data);
      }
      setLoading(false);
    };
    fetchReport();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || "Relatório não encontrado."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reportData = report.data as any;
  const account = reportData?.account;
  const metrics = reportData?.metrics || [];
  const topPosts = reportData?.topPosts || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {account?.profile_picture_url && (
            <img src={account.profile_picture_url} alt="" className="w-20 h-20 rounded-full mx-auto object-cover" />
          )}
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="text-muted-foreground">
            @{account?.username} · {new Date(report.period_start).toLocaleDateString("pt-BR")} a {new Date(report.period_end).toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* Account Stats */}
        {account && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{(account.followers_count || 0).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">Seguidores</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{(account.following_count || 0).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">Seguindo</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Eye className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{(account.media_count || 0).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">Publicações</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Metrics Summary */}
        {metrics.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Métricas do Período</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const latest = metrics[metrics.length - 1];
                  return [
                    { label: "Alcance Total", value: latest?.total_reach || 0, icon: Eye },
                    { label: "Engajamento Total", value: latest?.total_engagement || 0, icon: Heart },
                    { label: "Média Curtidas", value: Math.round(Number(latest?.avg_likes) || 0), icon: Heart },
                    { label: "Média Comentários", value: Math.round(Number(latest?.avg_comments) || 0), icon: MessageCircle },
                  ].map((m) => (
                    <div key={m.label} className="text-center p-3 rounded-lg bg-muted/50">
                      <m.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{m.value.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Posts */}
        {topPosts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top Publicações</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {topPosts.slice(0, 5).map((post: any, i: number) => {
                const postMetrics = Array.isArray(post.metrics) ? post.metrics[0] : post.metrics;
                return (
                  <div key={post.id || i} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                    {post.media_url && (
                      <img src={post.thumbnail_url || post.media_url} alt="" className="h-16 w-16 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{post.caption || "Sem legenda"}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{post.post_type}</Badge>
                        {postMetrics && (
                          <>
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{postMetrics.likes}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{postMetrics.comments}</span>
                            <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{postMetrics.shares}</span>
                            <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{postMetrics.saves}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Relatório gerado em {new Date(report.created_at).toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
};

export default PublicInstagramReportPage;
