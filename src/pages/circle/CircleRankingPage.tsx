import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Medal, 
  Award, 
  Crown, 
  Star, 
  TrendingUp,
  Users,
  MessageSquare,
  Heart,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

interface RankedProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  company_name: string | null;
  role_title: string | null;
  total_points: number;
  current_level: number;
  level_name: string;
}

const levelIcons: Record<number, { icon: React.ElementType; color: string }> = {
  1: { icon: Zap, color: "text-green-500" },
  2: { icon: MessageSquare, color: "text-blue-500" },
  3: { icon: Star, color: "text-yellow-500" },
  4: { icon: Award, color: "text-purple-500" },
  5: { icon: Crown, color: "text-amber-500" },
};

export default function CircleRankingPage() {
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");

  // Fetch current profile
  const { data: currentProfile } = useQuery({
    queryKey: ["circle-profile-current"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("circle_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch ranking
  const { data: ranking, isLoading } = useQuery({
    queryKey: ["circle-ranking", period],
    queryFn: async () => {
      // For now, we'll fetch all-time ranking
      // In the future, we can add period filtering based on points_ledger
      const { data, error } = await supabase
        .from("circle_profiles")
        .select("id, display_name, avatar_url, company_name, role_title, total_points, current_level, level_name")
        .eq("is_active", true)
        .order("total_points", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as RankedProfile[];
    },
  });

  // Fetch levels
  const { data: levels } = useQuery({
    queryKey: ["circle-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_levels")
        .select("*")
        .order("level", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch badges
  const { data: badges } = useQuery({
    queryKey: ["circle-badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_badges")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const getRankIcon = (position: number) => {
    if (position === 0) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (position === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (position === 2) return <Medal className="h-6 w-6 text-amber-600" />;
    return null;
  };

  const currentUserRank = ranking?.findIndex(p => p.id === currentProfile?.id);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">🏆 Ranking</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Os membros mais ativos do UNV Circle
        </p>
      </div>

      {/* Current User Stats */}
      {currentProfile && (
        <Card className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 border-primary/20">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16 ring-2 ring-primary">
                <AvatarImage src={currentProfile.avatar_url || undefined} />
                <AvatarFallback className="text-lg sm:text-xl">
                  {currentProfile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold text-base sm:text-lg">Sua Posição</h3>
                <p className="text-sm text-muted-foreground">
                  {currentUserRank !== undefined && currentUserRank >= 0
                    ? `#${currentUserRank + 1} no ranking`
                    : "Não ranqueado"}
                </p>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-center sm:text-right">
                  <p className="text-xl sm:text-3xl font-bold text-primary">
                    {currentProfile.total_points?.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">pontos</p>
                </div>

                <div className="text-center px-3 sm:px-4 border-l">
                  <Badge variant="secondary" className="text-sm sm:text-lg py-0.5 sm:py-1 px-2 sm:px-3">
                    Nível {currentProfile.current_level}
                  </Badge>
                  <p className="text-xs sm:text-sm mt-1">{currentProfile.level_name}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="text-xs sm:text-sm">Geral</TabsTrigger>
          <TabsTrigger value="month" className="text-xs sm:text-sm">Este Mês</TabsTrigger>
          <TabsTrigger value="week" className="text-xs sm:text-sm">Esta Semana</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-4 sm:mt-6">
          {/* Top 3 - show podium if we have at least 1 user */}
          {ranking && ranking.length >= 1 && (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-4 mb-6 sm:mb-8">
              {/* 2nd Place */}
              {ranking[1] ? (
                <Card className="text-center pt-5 sm:pt-8 relative order-1">
                  <div className="absolute top-1 sm:top-2 left-1/2 -translate-x-1/2">
                    <Medal className="h-5 w-5 sm:h-8 sm:w-8 text-gray-400" />
                  </div>
                  <CardContent className="pt-2 sm:pt-4 px-1.5 sm:px-6 pb-3 sm:pb-6">
                    <Avatar className="h-10 w-10 sm:h-16 sm:w-16 mx-auto ring-2 ring-gray-400">
                      <AvatarImage src={ranking[1].avatar_url || undefined} />
                      <AvatarFallback className="text-xs sm:text-base">
                        {ranking[1].display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold mt-2 sm:mt-3 text-xs sm:text-base truncate">{ranking[1].display_name}</h3>
                    <p className="text-[10px] sm:text-sm text-muted-foreground truncate hidden sm:block">
                      {ranking[1].company_name || ranking[1].level_name}
                    </p>
                    <p className="text-sm sm:text-xl font-bold text-primary mt-1 sm:mt-2">
                      {ranking[1].total_points.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="order-1" />
              )}

              {/* 1st Place */}
              <Card className="text-center pt-5 sm:pt-8 relative -mt-2 sm:-mt-4 shadow-lg ring-2 ring-yellow-400 order-0 sm:order-1">
                <div className="absolute top-0.5 sm:top-2 left-1/2 -translate-x-1/2">
                  <Crown className="h-6 w-6 sm:h-10 sm:w-10 text-yellow-500" />
                </div>
                <CardContent className="pt-3 sm:pt-6 px-1.5 sm:px-6 pb-3 sm:pb-6">
                  <Avatar className="h-12 w-12 sm:h-20 sm:w-20 mx-auto ring-2 sm:ring-4 ring-yellow-400">
                    <AvatarImage src={ranking[0].avatar_url || undefined} />
                    <AvatarFallback className="text-sm sm:text-xl">
                      {ranking[0].display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold text-xs sm:text-lg mt-2 sm:mt-3 truncate">{ranking[0].display_name}</h3>
                  <p className="text-[10px] sm:text-sm text-muted-foreground truncate hidden sm:block">
                    {ranking[0].company_name || ranking[0].level_name}
                  </p>
                  <p className="text-base sm:text-2xl font-bold text-primary mt-1 sm:mt-2">
                    {ranking[0].total_points.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {/* 3rd Place */}
              {ranking[2] ? (
                <Card className="text-center pt-5 sm:pt-8 relative order-2">
                  <div className="absolute top-1 sm:top-2 left-1/2 -translate-x-1/2">
                    <Medal className="h-5 w-5 sm:h-8 sm:w-8 text-amber-600" />
                  </div>
                  <CardContent className="pt-2 sm:pt-4 px-1.5 sm:px-6 pb-3 sm:pb-6">
                    <Avatar className="h-10 w-10 sm:h-16 sm:w-16 mx-auto ring-2 ring-amber-600">
                      <AvatarImage src={ranking[2].avatar_url || undefined} />
                      <AvatarFallback className="text-xs sm:text-base">
                        {ranking[2].display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold mt-2 sm:mt-3 text-xs sm:text-base truncate">{ranking[2].display_name}</h3>
                    <p className="text-[10px] sm:text-sm text-muted-foreground truncate hidden sm:block">
                      {ranking[2].company_name || ranking[2].level_name}
                    </p>
                    <p className="text-sm sm:text-xl font-bold text-primary mt-1 sm:mt-2">
                      {ranking[2].total_points.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="order-2" />
              )}
            </div>
          )}

          {/* Full Ranking List */}
          <Card>
            <CardHeader className="pb-2 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                Ranking Completo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 sm:space-y-2 px-2 sm:px-6">
              {ranking?.slice(3).map((profile, index) => {
                const levelConfig = levelIcons[profile.current_level] || levelIcons[1];
                const LevelIcon = levelConfig.icon;
                const isCurrentUser = profile.id === currentProfile?.id;

                return (
                  <NavLink
                    key={profile.id}
                    to={`/circle/profile/${profile.id}`}
                    className={cn(
                      "flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg hover:bg-muted transition-colors",
                      isCurrentUser && "bg-primary/5 ring-1 ring-primary/20"
                    )}
                  >
                    <span className="w-6 sm:w-8 text-center font-bold text-muted-foreground text-xs sm:text-base">
                      #{index + 4}
                    </span>

                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs sm:text-sm">
                        {profile.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base">
                        {profile.display_name}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">Você</Badge>
                        )}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                        {profile.company_name || profile.role_title}
                      </p>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                      <LevelIcon className={cn("h-4 w-4", levelConfig.color)} />
                      <Badge variant="outline">{profile.level_name}</Badge>
                    </div>

                    <p className="font-bold text-primary text-xs sm:text-base min-w-[50px] sm:min-w-[80px] text-right">
                      {profile.total_points.toLocaleString()}
                    </p>
                  </NavLink>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Levels Info */}
      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
            <Star className="h-4 w-4 sm:h-5 sm:w-5" />
            Níveis e Pontuação
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
            {levels?.map((level) => {
              const config = levelIcons[level.level] || levelIcons[1];
              const Icon = config.icon;

              return (
                <div
                  key={level.id}
                  className={cn(
                    "text-center p-2 sm:p-4 rounded-lg border",
                    currentProfile?.current_level === level.level && "bg-primary/5 border-primary"
                  )}
                >
                  <Icon className={cn("h-5 w-5 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2", config.color)} />
                  <p className="font-semibold text-xs sm:text-base">{level.name}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">
                    {level.min_points.toLocaleString()}+ pts
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
            <Award className="h-4 w-4 sm:h-5 sm:w-5" />
            Badges Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            {badges?.map((badge) => (
              <div
                key={badge.id}
                className="text-center p-2 sm:p-4 rounded-lg border hover:bg-muted transition-colors"
              >
                <div 
                  className={cn(
                    "h-8 w-8 sm:h-12 sm:w-12 rounded-full mx-auto mb-1 sm:mb-2 flex items-center justify-center",
                    `bg-${badge.color}-500/10`
                  )}
                >
                  <Award className={cn("h-4 w-4 sm:h-6 sm:w-6", `text-${badge.color}-500`)} />
                </div>
                <p className="font-medium text-[10px] sm:text-sm">{badge.name}</p>
                <p className="text-[8px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{badge.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
