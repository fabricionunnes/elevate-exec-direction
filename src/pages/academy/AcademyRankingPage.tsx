import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  Medal,
  Trophy,
  TrendingUp,
  Flame,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

interface RankingEntry {
  position: number;
  user_id: string;
  user_name: string;
  total_points: number;
  current_level: number;
  level_name: string;
  lessons_completed: number;
  current_streak: number;
  is_current_user: boolean;
}

export const AcademyRankingPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    loadRanking();
  }, [userContext, period]);

  const loadRanking = async () => {
    try {
      // Build query based on user context
      let query = supabase
        .from("academy_user_levels")
        .select(`
          onboarding_user_id,
          total_points,
          current_level,
          level_name,
          lessons_completed,
          current_streak,
          onboarding_users!inner(id, name, project_id, onboarding_projects!inner(onboarding_company_id))
        `)
        .order("total_points", { ascending: false })
        .limit(100);

      // If client user, filter by company
      if (!userContext.isAdmin && userContext.companyId) {
        query = query.eq("onboarding_users.onboarding_projects.onboarding_company_id", userContext.companyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rankingData: RankingEntry[] = (data || []).map((entry, index) => {
        const user = entry.onboarding_users as any;
        return {
          position: index + 1,
          user_id: entry.onboarding_user_id,
          user_name: user?.name || "Usuário",
          total_points: entry.total_points,
          current_level: entry.current_level,
          level_name: entry.level_name,
          lessons_completed: entry.lessons_completed,
          current_streak: entry.current_streak,
          is_current_user: entry.onboarding_user_id === userContext.onboardingUserId,
        };
      });

      setRanking(rankingData);
    } catch (error) {
      console.error("Error loading ranking:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Crown className="h-6 w-6 text-amber-500" />;
    if (position === 2) return <Medal className="h-6 w-6 text-slate-400" />;
    if (position === 3) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-lg font-bold text-muted-foreground">{position}</span>;
  };

  const getPositionClass = (position: number) => {
    if (position === 1) return "bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200";
    if (position === 2) return "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200";
    if (position === 3) return "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200";
    return "";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const currentUserRanking = ranking.find((r) => r.is_current_user);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ranking</h1>
          <p className="text-muted-foreground mt-1">
            {userContext.isAdmin
              ? "Ranking global de todos os usuários"
              : "Ranking dos usuários da sua empresa"}
          </p>
        </div>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Geral</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current User Position */}
      {currentUserRanking && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sua posição</p>
                  <p className="text-2xl font-bold">
                    #{currentUserRanking.position}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Seus pontos</p>
                <p className="text-2xl font-bold text-primary">
                  {currentUserRanking.total_points}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 Podium */}
      {ranking.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {/* 2nd Place */}
          <Card className={`text-center ${getPositionClass(2)}`}>
            <CardContent className="pt-8 pb-6">
              <div className="flex justify-center mb-3">
                {getPositionIcon(2)}
              </div>
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarFallback className="bg-slate-200 text-slate-700 text-lg">
                  {getInitials(ranking[1].user_name)}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold truncate">{ranking[1].user_name}</p>
              <p className="text-lg font-bold text-slate-600">
                {ranking[1].total_points} pts
              </p>
              <Badge variant="secondary" className="mt-2">
                {ranking[1].level_name}
              </Badge>
            </CardContent>
          </Card>

          {/* 1st Place */}
          <Card className={`text-center -mt-4 ${getPositionClass(1)}`}>
            <CardContent className="pt-8 pb-6">
              <div className="flex justify-center mb-3">
                {getPositionIcon(1)}
              </div>
              <Avatar className="h-20 w-20 mx-auto mb-3 ring-4 ring-amber-300">
                <AvatarFallback className="bg-amber-100 text-amber-700 text-xl">
                  {getInitials(ranking[0].user_name)}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold truncate">{ranking[0].user_name}</p>
              <p className="text-xl font-bold text-amber-600">
                {ranking[0].total_points} pts
              </p>
              <Badge className="mt-2 bg-amber-100 text-amber-800">
                {ranking[0].level_name}
              </Badge>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          <Card className={`text-center ${getPositionClass(3)}`}>
            <CardContent className="pt-8 pb-6">
              <div className="flex justify-center mb-3">
                {getPositionIcon(3)}
              </div>
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarFallback className="bg-orange-100 text-orange-700 text-lg">
                  {getInitials(ranking[2].user_name)}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold truncate">{ranking[2].user_name}</p>
              <p className="text-lg font-bold text-orange-600">
                {ranking[2].total_points} pts
              </p>
              <Badge variant="secondary" className="mt-2">
                {ranking[2].level_name}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Ranking List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Classificação Completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ranking.map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                  entry.is_current_user
                    ? "bg-primary/5 border-primary/20"
                    : "hover:bg-muted/50"
                } ${getPositionClass(entry.position)}`}
              >
                <div className="w-10 flex justify-center">
                  {getPositionIcon(entry.position)}
                </div>

                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(entry.user_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <p className="font-medium">
                    {entry.user_name}
                    {entry.is_current_user && (
                      <span className="text-primary ml-2">(você)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{entry.level_name}</span>
                    <span>•</span>
                    <span>{entry.lessons_completed} aulas</span>
                    {entry.current_streak > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Flame className="h-3 w-3" />
                          {entry.current_streak}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-primary">{entry.total_points}</p>
                  <p className="text-xs text-muted-foreground">pontos</p>
                </div>
              </div>
            ))}
          </div>

          {ranking.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhum usuário no ranking</h3>
              <p className="text-muted-foreground">
                Complete aulas para aparecer no ranking!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademyRankingPage;
