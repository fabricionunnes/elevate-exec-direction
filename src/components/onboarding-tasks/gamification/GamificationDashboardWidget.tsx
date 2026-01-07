import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Trophy, 
  Star, 
  Flame, 
  Target, 
  Clock, 
  Users,
  TrendingUp,
  Award,
  Medal,
  Crown,
  ChevronUp,
  ChevronDown,
  Minus
} from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GamificationDashboardWidgetProps {
  companyId: string;
  projectId: string;
}

interface Config {
  id: string;
  is_active: boolean;
  season_type: string;
  team_mode_enabled: boolean;
}

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface Participant {
  id: string;
  salesperson_id: string;
  current_level: number;
  total_points: number;
  salesperson?: { id: string; name: string };
}

interface Level {
  id: string;
  level_number: number;
  name: string;
  min_points: number;
  icon: string;
}

interface Mission {
  id: string;
  name: string;
  description: string | null;
  condition_type: string;
  condition_value: number;
  reward_points: number;
  is_active: boolean;
}

interface MissionProgress {
  id: string;
  mission_id: string;
  participant_id: string;
  current_value: number;
  is_completed: boolean;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge?: { id: string; name: string; icon: string; description: string };
}

interface ScoreLog {
  id: string;
  participant_id: string;
  points: number;
  entry_date: string;
  created_at: string;
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  reward_type: string;
  value: number | null;
  condition_type: string;
  condition_value: number | null;
  show_on_dashboard: boolean;
}

export const GamificationDashboardWidget = ({ companyId, projectId }: GamificationDashboardWidgetProps) => {
  const [config, setConfig] = useState<Config | null>(null);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionProgress, setMissionProgress] = useState<MissionProgress[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [scoreLogs, setScoreLogs] = useState<ScoreLog[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [companyId, projectId]);

  const fetchData = async () => {
    try {
      // Fetch config
      const { data: configData } = await supabase
        .from("gamification_configs")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (!configData || !configData.is_active) {
        setLoading(false);
        return;
      }

      setConfig(configData);

      // Fetch all data in parallel
      const [
        seasonsRes,
        participantsRes,
        levelsRes,
        missionsRes,
        progressRes,
        badgesRes,
        logsRes,
        rewardsRes,
      ] = await Promise.all([
        supabase.from("gamification_seasons").select("*").eq("config_id", configData.id).eq("is_current", true).maybeSingle(),
        supabase.from("gamification_participants").select("*, salesperson:company_salespeople(id, name)").eq("config_id", configData.id),
        supabase.from("gamification_levels").select("*").eq("config_id", configData.id).order("level_number"),
        supabase.from("gamification_missions").select("*").eq("config_id", configData.id).eq("is_active", true),
        supabase.from("gamification_mission_progress").select("*"),
        supabase.from("gamification_user_badges").select("*, badge:gamification_badges(id, name, icon, description)"),
        supabase.from("gamification_score_logs").select("*").order("entry_date", { ascending: true }).limit(100),
        supabase.from("gamification_rewards").select("*").eq("config_id", configData.id).eq("is_active", true).eq("show_on_dashboard", true),
      ]);

      // If no current season marked, try to find one based on dates
      let season = seasonsRes.data;
      if (!season) {
        const today = new Date().toISOString().split('T')[0];
        const { data: activeSeason } = await supabase
          .from("gamification_seasons")
          .select("*")
          .eq("config_id", configData.id)
          .lte("start_date", today)
          .gte("end_date", today)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        season = activeSeason;
      }

      setCurrentSeason(season);
      setParticipants(participantsRes.data || []);
      setLevels(levelsRes.data || []);
      setMissions(missionsRes.data || []);
      setMissionProgress(progressRes.data || []);
      setUserBadges(badgesRes.data || []);
      setScoreLogs(logsRes.data || []);
      setRewards(rewardsRes.data || []);
    } catch (error) {
      console.error("Error fetching gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!config || !config.is_active) {
    return null;
  }

  // Calculate rankings
  const rankings = [...participants]
    .sort((a, b) => b.total_points - a.total_points)
    .map((p, index) => ({ ...p, position: index + 1 }));

  const topParticipant = rankings[0];

  // Calculate time remaining in season
  const getTimeRemaining = () => {
    if (!currentSeason) return "—";
    const endDate = new Date(currentSeason.end_date);
    const today = new Date();
    const daysRemaining = differenceInDays(endDate, today);
    if (daysRemaining < 0) return "Encerrada";
    if (daysRemaining === 0) return "Último dia!";
    return `${daysRemaining} dias restantes`;
  };

  // Get level for participant
  const getLevel = (points: number) => {
    const sortedLevels = [...levels].sort((a, b) => b.min_points - a.min_points);
    return sortedLevels.find(l => points >= l.min_points) || levels[0];
  };

  // Prepare chart data
  const getEvolutionData = () => {
    const groupedByDate: Record<string, number> = {};
    
    scoreLogs.forEach(log => {
      const date = log.entry_date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = 0;
      }
      groupedByDate[date] += log.points;
    });

    return Object.entries(groupedByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14) // Last 14 days
      .map(([date, points]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        pontos: points,
      }));
  };

  const evolutionData = getEvolutionData();

  const getLevelIcon = (icon: string) => {
    switch (icon) {
      case "star": return <Star className="h-4 w-4 text-yellow-500" />;
      case "trophy": return <Trophy className="h-4 w-4 text-amber-500" />;
      case "flame": return <Flame className="h-4 w-4 text-orange-500" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Medal className="h-5 w-5 text-amber-600" />;
      default: return null;
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            🎮 Gamificação do Time
          </CardTitle>
          {currentSeason && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {getTimeRemaining()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Temporada
              </div>
              <p className="text-lg font-bold">{currentSeason?.name || "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Participantes
              </div>
              <p className="text-lg font-bold">{participants.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="h-4 w-4" />
                Líder
              </div>
              <p className="text-lg font-bold truncate">
                {topParticipant?.salesperson?.name || "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" />
                Pontos do Líder
              </div>
              <p className="text-lg font-bold">
                {topParticipant?.total_points.toLocaleString("pt-BR") || "0"} pts
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Ranking */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Medal className="h-4 w-4" />
                Ranking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rankings.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Sem participantes</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Pontos</TableHead>
                      <TableHead className="w-16">Nível</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.slice(0, 10).map((p) => {
                      const level = getLevel(p.total_points);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1">
                              {getPositionIcon(p.position)}
                              {!getPositionIcon(p.position) && p.position}
                            </div>
                          </TableCell>
                          <TableCell>{p.salesperson?.name || "—"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {p.total_points.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {level && getLevelIcon(level.icon)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Evolution Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Evolução de Pontos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evolutionData.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Sem dados ainda</p>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pontos"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Missions */}
        {missions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Missões Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {missions.slice(0, 6).map((mission) => (
                  <Card key={mission.id} className="bg-muted/50">
                    <CardContent className="pt-4">
                      <h4 className="font-medium">{mission.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {mission.description || "Sem descrição"}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <Badge variant="outline">
                          {mission.condition_type === "reach_value" && `Meta: ${mission.condition_value}`}
                          {mission.condition_type === "streak" && `${mission.condition_value} dias`}
                          {mission.condition_type === "top_rank" && `Top ${mission.condition_value}`}
                        </Badge>
                        <span className="text-primary font-medium">+{mission.reward_points} pts</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rewards */}
        {rewards.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" />
                Recompensas em Disputa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {rewards.map((reward) => (
                  <Badge key={reward.id} variant="secondary" className="py-2 px-3 text-sm">
                    {reward.condition_type === "rank_position" && `${reward.condition_value}º lugar: `}
                    {reward.name}
                    {reward.value && ` (R$ ${reward.value.toLocaleString("pt-BR")})`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

// Helper component for calendar icon
const Calendar = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);
