import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2 } from "lucide-react";
import type { InstagramAccount, InstagramAccountMetrics } from "../types";

interface InstagramScoreProps {
  accountId: string;
  account: InstagramAccount;
}

export const InstagramScore = ({ accountId, account }: InstagramScoreProps) => {
  const [metrics, setMetrics] = useState<InstagramAccountMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, [accountId]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const score = metrics?.profile_score || 0;
  const getScoreInfo = (s: number) => {
    if (s >= 90) return { label: "Excelente", color: "text-green-500", bg: "bg-green-500" };
    if (s >= 70) return { label: "Bom", color: "text-blue-500", bg: "bg-blue-500" };
    if (s >= 50) return { label: "Atenção", color: "text-amber-500", bg: "bg-amber-500" };
    return { label: "Crítico", color: "text-red-500", bg: "bg-red-500" };
  };

  const info = getScoreInfo(score);

  const criteria = [
    { label: "Consistência de Postagem", value: Math.min(account.media_count / 3, 100), max: 100 },
    { label: "Engajamento Médio", value: metrics ? Number(metrics.avg_likes) + Number(metrics.avg_comments) : 0, max: 1000 },
    { label: "Crescimento de Seguidores", value: account.followers_count > 1000 ? 80 : Math.min(account.followers_count / 12.5, 80), max: 100 },
    { label: "Alcance Médio", value: metrics?.total_reach ? Math.min(metrics.total_reach / 100, 100) : 0, max: 100 },
    { label: "Qualidade de Conteúdo", value: metrics?.avg_saves ? Math.min(Number(metrics.avg_saves) * 5, 100) : 0, max: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Score Circle */}
      <Card>
        <CardContent className="py-8 text-center">
          <div className="relative mx-auto w-40 h-40">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeDasharray={`${score * 3.14} 314`}
                strokeLinecap="round"
                className={info.color}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Star className={`h-6 w-6 ${info.color} mb-1`} />
              <span className="text-3xl font-bold">{score}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <p className={`text-lg font-semibold mt-4 ${info.color}`}>{info.label}</p>
          <p className="text-sm text-muted-foreground">Score do Instagram</p>
        </CardContent>
      </Card>

      {/* Criteria Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {criteria.map((c) => {
          const pct = Math.min((c.value / c.max) * 100, 100);
          return (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-sm font-bold">{Math.round(pct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${info.bg}`} style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
