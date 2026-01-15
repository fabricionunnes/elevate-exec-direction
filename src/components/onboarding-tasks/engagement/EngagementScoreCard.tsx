import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  CheckCircle2,
  Video,
  MessageSquare,
  Star
} from "lucide-react";

interface EngagementScore {
  id: string;
  staff_id: string;
  staff_name?: string;
  total_score: number;
  meeting_score: number;
  task_score: number;
  response_score: number;
  retention_score: number;
  nps_score: number;
  rank_position: number;
  calculation_date: string;
  metrics_breakdown?: {
    meetings?: { completed: number; total: number };
    tasks?: { completed: number; total: number; onTime: number };
    responseTime?: { avgHours: number };
    retention?: { active: number; churned: number };
    nps?: { avgScore: number; count: number };
  };
}

interface EngagementScoreCardProps {
  score: EngagementScore;
  expanded?: boolean;
}

export const EngagementScoreCard = ({ score, expanded = false }: EngagementScoreCardProps) => {
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-green-500';
    if (value >= 60) return 'text-yellow-500';
    if (value >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (value: number) => {
    if (value >= 80) return 'bg-green-500/10';
    if (value >= 60) return 'bg-yellow-500/10';
    if (value >= 40) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
    if (rank === 2) return { icon: Trophy, color: 'text-gray-400', bg: 'bg-gray-400/20' };
    if (rank === 3) return { icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-600/20' };
    return null;
  };

  const rankBadge = getRankBadge(score.rank_position);
  const initials = score.staff_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??';

  return (
    <Card className={`transition-all ${expanded ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className="text-center w-12">
            {rankBadge ? (
              <div className={`w-10 h-10 mx-auto rounded-full ${rankBadge.bg} flex items-center justify-center`}>
                <rankBadge.icon className={`h-5 w-5 ${rankBadge.color}`} />
              </div>
            ) : (
              <div className="w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center">
                <span className="text-lg font-bold text-muted-foreground">
                  {score.rank_position}
                </span>
              </div>
            )}
          </div>

          {/* Avatar & Name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium truncate">{score.staff_name || 'Consultor'}</p>
              <p className="text-xs text-muted-foreground">
                Atualizado em {new Date(score.calculation_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Total Score */}
          <div className={`text-center px-4 py-2 rounded-lg ${getScoreBg(score.total_score)}`}>
            <p className={`text-2xl font-bold ${getScoreColor(score.total_score)}`}>
              {score.total_score.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">pontos</p>
          </div>
        </div>

        {/* Metrics Breakdown */}
        {expanded && (
          <div className="mt-4 pt-4 border-t grid grid-cols-5 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Video className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-lg font-bold ${getScoreColor(score.meeting_score)}`}>
                {score.meeting_score.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Reuniões</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-lg font-bold ${getScoreColor(score.task_score)}`}>
                {score.task_score.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Tarefas</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-lg font-bold ${getScoreColor(score.response_score)}`}>
                {score.response_score.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Resposta</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-lg font-bold ${getScoreColor(score.retention_score)}`}>
                {score.retention_score.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Retenção</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-lg font-bold ${getScoreColor(score.nps_score)}`}>
                {score.nps_score.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">NPS</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
