import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Users, Eye, Heart, MessageCircle, Share2, Bookmark, TrendingUp, BarChart3, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { InstagramAccount, InstagramAccountMetrics } from "../types";

interface InstagramOverviewProps {
  accountId: string;
  account: InstagramAccount;
}

export const InstagramOverview = ({ accountId, account }: InstagramOverviewProps) => {
  const [metrics, setMetrics] = useState<InstagramAccountMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchMetrics = async () => {
    const { data } = await supabase
      .from("instagram_account_metrics")
      .select("*")
      .eq("account_id", accountId)
      .order("recorded_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMetrics(data as InstagramAccountMetrics | null);
    setLoading(false);
  };

  useEffect(() => { fetchMetrics(); }, [accountId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-project-oauth", {
        body: { action: "sync", accountId },
      });
      if (error) throw error;
      toast.success("Sincronização concluída!");
      await fetchMetrics();
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error("Erro ao sincronizar: " + (err.message || "Tente novamente"));
    } finally {
      setSyncing(false);
    }
  };

  const cards = [
    { label: "Seguidores", value: account.followers_count, icon: Users, color: "text-blue-500" },
    { label: "Crescimento", value: metrics ? `+${metrics.followers_count - account.followers_count}` : "—", icon: TrendingUp, color: "text-green-500" },
    { label: "Alcance Total", value: metrics?.total_reach?.toLocaleString("pt-BR") || "—", icon: Eye, color: "text-purple-500" },
    { label: "Impressões", value: metrics?.total_impressions?.toLocaleString("pt-BR") || "—", icon: BarChart3, color: "text-orange-500" },
    { label: "Engajamento", value: metrics?.total_engagement?.toLocaleString("pt-BR") || "—", icon: Heart, color: "text-red-500" },
    { label: "Média Curtidas", value: metrics?.avg_likes?.toFixed(0) || "—", icon: Heart, color: "text-pink-500" },
    { label: "Média Comentários", value: metrics?.avg_comments?.toFixed(0) || "—", icon: MessageCircle, color: "text-cyan-500" },
    { label: "Média Compartilhamentos", value: metrics?.avg_shares?.toFixed(0) || "—", icon: Share2, color: "text-indigo-500" },
    { label: "Média Salvamentos", value: metrics?.avg_saves?.toFixed(0) || "—", icon: Bookmark, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Visão Geral</h3>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-xl font-bold">{typeof card.value === "number" ? card.value.toLocaleString("pt-BR") : card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!metrics && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Métricas serão exibidas após a primeira sincronização.</p>
            <Button variant="default" onClick={handleSync} disabled={syncing} className="mt-4 gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar Agora
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
