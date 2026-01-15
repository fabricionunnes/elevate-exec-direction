import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Medal, Award, Users } from "lucide-react";

interface ConsultantPerformance {
  id: string;
  name: string;
  avatar?: string;
  avgHealthScore: number;
  retentionRate: number;
  taskCompletionRate: number;
  projectCount: number;
}

interface ConsultantPerformanceRankingProps {
  consultants: ConsultantPerformance[];
  maxItems?: number;
}

export function ConsultantPerformanceRanking({ consultants, maxItems = 5 }: ConsultantPerformanceRankingProps) {
  const sortedConsultants = [...consultants]
    .sort((a, b) => {
      // Weighted score: 40% retention, 30% health, 30% task completion
      const scoreA = (a.retentionRate * 0.4) + (a.avgHealthScore * 0.3) + (a.taskCompletionRate * 0.3);
      const scoreB = (b.retentionRate * 0.4) + (b.avgHealthScore * 0.3) + (b.taskCompletionRate * 0.3);
      return scoreB - scoreA;
    })
    .slice(0, maxItems);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top Consultores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedConsultants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum consultor com dados suficientes</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {sortedConsultants.map((consultant, index) => (
                <div
                  key={consultant.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(index + 1)}
                  </div>
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={consultant.avatar} alt={consultant.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(consultant.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{consultant.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{consultant.projectCount} projetos</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getScoreColor(consultant.avgHealthScore)}>
                        HS: {consultant.avgHealthScore.toFixed(0)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(consultant.retentionRate * 100).toFixed(0)}% retenção
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
