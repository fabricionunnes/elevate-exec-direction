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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🏆 Ranking</h1>
        <p className="text-muted-foreground">
          Os membros mais ativos do UNV Circle
        </p>
      </div>

      {/* Current User Stats */}
      {currentProfile && (
        <Card className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary">
                <AvatarImage src={currentProfile.avatar_url || undefined} />
                <AvatarFallback className="text-xl">
                  {currentProfile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h3 className="font-semibold text-lg">Sua Posição</h3>
                <p className="text-muted-foreground">
                  {currentUserRank !== undefined && currentUserRank >= 0
                    ? `#${currentUserRank + 1} no ranking`
                    : "Não ranqueado"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-3xl font-bold text-primary">
                  {currentProfile.total_points?.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">pontos</p>
              </div>

              <div className="text-center px-4 border-l">
                <Badge variant="secondary" className="text-lg py-1 px-3">
                  Nível {currentProfile.current_level}
                </Badge>
                <p className="text-sm mt-1">{currentProfile.level_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Geral</TabsTrigger>
          <TabsTrigger value="month">Este Mês</TabsTrigger>
          <TabsTrigger value="week">Esta Semana</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-6">
          {/* Top 3 */}
          {ranking && ranking.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <Card className="text-center pt-8 relative">
                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                  <Medal className="h-8 w-8 text-gray-400" />
                </div>
                <CardContent className="pt-4">
                  <Avatar className="h-16 w-16 mx-auto ring-2 ring-gray-400">
                    <AvatarImage src={ranking[1].avatar_url || undefined} />
                    <AvatarFallback>
                      {ranking[1].display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold mt-3 truncate">{ranking[1].display_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {ranking[1].company_name || ranking[1].level_name}
                  </p>
                  <p className="text-xl font-bold text-primary mt-2">
                    {ranking[1].total_points.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {/* 1st Place */}
              <Card className="text-center pt-8 relative -mt-4 shadow-lg ring-2 ring-yellow-400">
                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                  <Crown className="h-10 w-10 text-yellow-500" />
                </div>
                <CardContent className="pt-6">
                  <Avatar className="h-20 w-20 mx-auto ring-4 ring-yellow-400">
                    <AvatarImage src={ranking[0].avatar_url || undefined} />
                    <AvatarFallback className="text-xl">
                      {ranking[0].display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold text-lg mt-3 truncate">{ranking[0].display_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {ranking[0].company_name || ranking[0].level_name}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-2">
                    {ranking[0].total_points.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {/* 3rd Place */}
              <Card className="text-center pt-8 relative">
                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                  <Medal className="h-8 w-8 text-amber-600" />
                </div>
                <CardContent className="pt-4">
                  <Avatar className="h-16 w-16 mx-auto ring-2 ring-amber-600">
                    <AvatarImage src={ranking[2].avatar_url || undefined} />
                    <AvatarFallback>
                      {ranking[2].display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold mt-3 truncate">{ranking[2].display_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {ranking[2].company_name || ranking[2].level_name}
                  </p>
                  <p className="text-xl font-bold text-primary mt-2">
                    {ranking[2].total_points.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Ranking List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ranking Completo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ranking?.slice(3).map((profile, index) => {
                const levelConfig = levelIcons[profile.current_level] || levelIcons[1];
                const LevelIcon = levelConfig.icon;
                const isCurrentUser = profile.id === currentProfile?.id;

                return (
                  <NavLink
                    key={profile.id}
                    to={`/circle/profile/${profile.id}`}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors",
                      isCurrentUser && "bg-primary/5 ring-1 ring-primary/20"
                    )}
                  >
                    <span className="w-8 text-center font-bold text-muted-foreground">
                      #{index + 4}
                    </span>

                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {profile.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {profile.display_name}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="ml-2 text-xs">Você</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.company_name || profile.role_title}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <LevelIcon className={cn("h-4 w-4", levelConfig.color)} />
                      <Badge variant="outline">{profile.level_name}</Badge>
                    </div>

                    <p className="font-bold text-primary min-w-[80px] text-right">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Níveis e Pontuação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {levels?.map((level) => {
              const config = levelIcons[level.level] || levelIcons[1];
              const Icon = config.icon;

              return (
                <div
                  key={level.id}
                  className={cn(
                    "text-center p-4 rounded-lg border",
                    currentProfile?.current_level === level.level && "bg-primary/5 border-primary"
                  )}
                >
                  <Icon className={cn("h-8 w-8 mx-auto mb-2", config.color)} />
                  <p className="font-semibold">{level.name}</p>
                  <p className="text-sm text-muted-foreground">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Badges Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {badges?.map((badge) => (
              <div
                key={badge.id}
                className="text-center p-4 rounded-lg border hover:bg-muted transition-colors"
              >
                <div 
                  className={cn(
                    "h-12 w-12 rounded-full mx-auto mb-2 flex items-center justify-center",
                    `bg-${badge.color}-500/10`
                  )}
                >
                  <Award className={cn("h-6 w-6", `text-${badge.color}-500`)} />
                </div>
                <p className="font-medium text-sm">{badge.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
