import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHealthScore, getRiskLevelInfo, getTrendInfo } from "@/hooks/useHealthScore";
import { Heart, TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface HealthScoreWidgetProps {
  projectId: string;
  onViewDetails?: () => void;
}

export const HealthScoreWidget = ({ projectId, onViewDetails }: HealthScoreWidgetProps) => {
  const { score, loading, calculating, calculateScore } = useHealthScore(projectId);

  const riskInfo = score ? getRiskLevelInfo(score.risk_level) : null;
  const trendInfo = score ? getTrendInfo(score.trend_direction) : null;

  const TrendIcon = () => {
    if (!trendInfo) return null;
    switch (trendInfo.icon) {
      case "TrendingUp":
        return <TrendingUp className={cn("h-4 w-4", trendInfo.color)} />;
      case "TrendingDown":
        return <TrendingDown className={cn("h-4 w-4", trendInfo.color)} />;
      default:
        return <Minus className={cn("h-4 w-4", trendInfo.color)} />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "from-green-500/20 to-green-600/10";
    if (score >= 60) return "from-yellow-500/20 to-yellow-600/10";
    if (score >= 40) return "from-orange-500/20 to-orange-600/10";
    return "from-red-500/20 to-red-600/10";
  };

  if (loading) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-5 w-5" />
            Saúde do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full mb-2" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-5 w-5 text-muted-foreground" />
            Saúde do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Score ainda não calculado
          </p>
          <Button onClick={calculateScore} disabled={calculating} size="sm">
            {calculating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Calcular Score
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-2", riskInfo?.border)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className={cn("h-5 w-5", riskInfo?.color)} />
            Saúde do Cliente
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={calculateScore}
              disabled={calculating}
              title="Recalcular"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", calculating && "animate-spin")} />
            </Button>
            {onViewDetails && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onViewDetails}
                title="Ver detalhes"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("rounded-lg p-4 bg-gradient-to-br", getScoreBg(score.total_score))}>
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-4xl font-bold", getScoreColor(score.total_score))}>
                {score.total_score}
              </div>
              <div className="text-xs text-muted-foreground">de 100</div>
            </div>
            <div className="text-right">
              <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", riskInfo?.bg, riskInfo?.color)}>
                {riskInfo?.label}
              </div>
              <div className="flex items-center gap-1 mt-2 justify-end">
                <TrendIcon />
                <span className={cn("text-xs", trendInfo?.color)}>{trendInfo?.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini pillar bars */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="text-center">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all" 
                style={{ width: `${score.satisfaction_score}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">Satisfação</span>
          </div>
          <div className="text-center">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all" 
                style={{ width: `${score.goals_score}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">Metas</span>
          </div>
          <div className="text-center">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all" 
                style={{ width: `${score.engagement_score}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">Engajamento</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
