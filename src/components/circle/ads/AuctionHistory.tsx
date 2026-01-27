import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gavel, 
  Trophy, 
  TrendingDown, 
  Clock,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  profileId?: string;
}

export function AuctionHistory({ profileId }: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["circle-ads-auction-history", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("circle_ads_auction_history")
        .select(`
          *,
          ad:circle_ads_ads(id, title),
          auction:circle_ads_auctions(id, placement)
        `)
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const stats = {
    total: history?.length || 0,
    won: history?.filter((h: any) => h.result === "won").length || 0,
    lost: history?.filter((h: any) => h.result === "lost").length || 0,
    winRate: history?.length 
      ? ((history.filter((h: any) => h.result === "won").length / history.length) * 100).toFixed(1) 
      : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Gavel className="h-5 w-5 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total de Leilões</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{stats.won}</p>
            <p className="text-xs text-muted-foreground">Vencidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{stats.lost}</p>
            <p className="text-xs text-muted-foreground">Perdidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold text-purple-600">{stats.winRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Vitória</p>
          </CardContent>
        </Card>
      </div>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Leilões
          </CardTitle>
          <CardDescription>
            Últimos leilões em que seus anúncios participaram
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gavel className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum leilão encontrado</p>
              <p className="text-sm">Seus anúncios participarão de leilões quando estiverem ativos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history?.map((item: any) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      item.result === "won" 
                        ? "bg-green-500/20" 
                        : "bg-red-500/20"
                    }`}>
                      {item.result === "won" ? (
                        <Trophy className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {item.ad?.title || "Anúncio"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.auction?.placement || "Feed"} • {item.competitor_count + 1} participantes
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge variant={item.result === "won" ? "default" : "secondary"}>
                      {item.result === "won" ? "Venceu" : "Perdeu"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Score: {Number(item.final_score).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
