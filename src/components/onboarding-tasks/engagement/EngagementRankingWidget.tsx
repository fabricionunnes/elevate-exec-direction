import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, ChevronRight, Users } from "lucide-react";

interface RankingEntry {
  id: string;
  staff_id: string;
  staff_name: string;
  total_score: number;
  rank_position: number;
}

export const EngagementRankingWidget = () => {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      // Only show consultants and CS in the ranking
      const { data, error } = await supabase
        .from("consultant_engagement_scores")
        .select(`
          id,
          staff_id,
          total_score,
          rank_position,
          onboarding_staff!inner(name, role)
        `)
        .in("onboarding_staff.role", ["cs", "consultant"])
        .order("rank_position", { ascending: true })
        .limit(5);

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        staff_id: item.staff_id,
        staff_name: item.onboarding_staff?.name || 'Consultor',
        total_score: item.total_score,
        rank_position: item.rank_position,
      }));

      setRankings(formattedData);
    } catch (error) {
      console.error("Error fetching rankings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Ranking de Engajamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rankings.length === 0 ? (
          <div className="text-center py-4">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">Nenhum ranking disponível</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((entry) => {
              const initials = entry.staff_name.split(' ').map(n => n[0]).join('').slice(0, 2);
              return (
                <div 
                  key={entry.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className={`font-bold w-6 text-center ${getRankColor(entry.rank_position)}`}>
                    {entry.rank_position}º
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm truncate">{entry.staff_name}</span>
                  <span className={`font-bold ${getScoreColor(entry.total_score)}`}>
                    {entry.total_score.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-3"
          onClick={() => navigate('/onboarding-tasks/engagement')}
        >
          Ver ranking completo
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
};
