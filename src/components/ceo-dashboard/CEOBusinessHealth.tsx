import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Users, AlertTriangle, CheckCircle, Star, Target, CreditCard } from "lucide-react";

interface HealthMetrics {
  overallScore: number;
  healthyClients: number;
  attentionClients: number;
  riskClients: number;
  avgCSAT: number;
  avgNPS: number;
  goalDeliveryRate: number;
  defaultRate: number;
}

export function CEOBusinessHealth() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHealthMetrics = async () => {
      try {
        // First, try to get the latest daily average (calculated at 5AM excluding simulators)
        const { data: dailyAvg } = await supabase
          .from("daily_average_health_scores")
          .select("*")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .single();

        if (dailyAvg) {
          // Use pre-calculated data from daily snapshot
          setMetrics({
            overallScore: Math.round(dailyAvg.average_score),
            healthyClients: dailyAvg.healthy_count,
            attentionClients: dailyAvg.attention_count,
            riskClients: dailyAvg.risk_count,
            avgCSAT: 0,
            avgNPS: 0,
            goalDeliveryRate: 78,
            defaultRate: 4.2,
          });
        } else {
          // Fallback to live calculation if no snapshot exists
          const { data: healthScores } = await supabase
            .from("client_health_scores")
            .select("*");

          const healthy = healthScores?.filter(h => h.risk_level === "low" || h.risk_level === "healthy").length || 0;
          const attention = healthScores?.filter(h => h.risk_level === "medium" || h.risk_level === "attention").length || 0;
          const risk = healthScores?.filter(h => h.risk_level === "high" || h.risk_level === "critical").length || 0;
          const total = healthScores?.length || 1;
          const avgScore = healthScores?.reduce((sum, h) => sum + (h.total_score || 0), 0) / total || 0;

          setMetrics({
            overallScore: Math.round(avgScore),
            healthyClients: healthy,
            attentionClients: attention,
            riskClients: risk,
            avgCSAT: 0,
            avgNPS: 0,
            goalDeliveryRate: 78,
            defaultRate: 4.2,
          });
        }

        // Fetch CSAT separately
        const { data: csatData } = await supabase
          .from("csat_responses")
          .select("score")
          .order("created_at", { ascending: false })
          .limit(50);

        if (csatData && csatData.length > 0) {
          const avgNPS = (csatData.reduce((sum, n) => sum + n.score, 0) / csatData.length) * 10;
          const avgCSAT = (csatData.reduce((sum, c) => sum + c.score, 0) / csatData.length) * 20;
          
          setMetrics(prev => prev ? {
            ...prev,
            avgCSAT: Math.round(avgCSAT),
            avgNPS: Math.round(avgNPS),
          } : prev);
        }
      } catch (error) {
        console.error("Error fetching health metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthMetrics();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Overall Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Saúde Geral do Negócio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={553}
                  strokeDashoffset={553 - (553 * metrics.overallScore) / 100}
                  className={getScoreColor(metrics.overallScore)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold ${getScoreColor(metrics.overallScore)}`}>
                  {metrics.overallScore}
                </span>
                <span className="text-sm text-muted-foreground">de 100</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Distribuição de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Saudáveis</span>
              </div>
              <span className="font-bold text-green-500">{metrics.healthyClients}</span>
            </div>
            <Progress value={(metrics.healthyClients / (metrics.healthyClients + metrics.attentionClients + metrics.riskClients)) * 100} className="h-2 bg-muted [&>div]:bg-green-500" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>Em Atenção</span>
              </div>
              <span className="font-bold text-yellow-500">{metrics.attentionClients}</span>
            </div>
            <Progress value={(metrics.attentionClients / (metrics.healthyClients + metrics.attentionClients + metrics.riskClients)) * 100} className="h-2 bg-muted [&>div]:bg-yellow-500" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>Em Risco</span>
              </div>
              <span className="font-bold text-red-500">{metrics.riskClients}</span>
            </div>
            <Progress value={(metrics.riskClients / (metrics.healthyClients + metrics.attentionClients + metrics.riskClients)) * 100} className="h-2 bg-muted [&>div]:bg-red-500" />
          </div>
        </CardContent>
      </Card>

      {/* Satisfaction Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Satisfação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">{metrics.avgCSAT}%</p>
              <p className="text-sm text-muted-foreground">CSAT Médio</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className={`text-3xl font-bold ${metrics.avgNPS >= 50 ? "text-green-500" : metrics.avgNPS >= 0 ? "text-yellow-500" : "text-red-500"}`}>
                {metrics.avgNPS}
              </p>
              <p className="text-sm text-muted-foreground">NPS Médio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-blue-500">{metrics.goalDeliveryRate}%</p>
              <p className="text-sm text-muted-foreground">Entrega de Metas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <p className={`text-3xl font-bold ${metrics.defaultRate > 5 ? "text-red-500" : "text-green-500"}`}>
                  {metrics.defaultRate}%
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Inadimplência</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
