import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Award,
  BookOpen,
  Flame,
  Target,
  Star,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

interface UserLevel {
  total_points: number;
  current_level: number;
  level_name: string;
  lessons_completed: number;
  quizzes_passed: number;
  tracks_completed: number;
  current_streak: number;
  best_streak: number;
}

interface LevelDefinition {
  level: number;
  name: string;
  min_points: number;
  color: string | null;
}

interface UserBadge {
  id: string;
  badge_id: string;
  badge_name: string;
  badge_description: string;
  badge_icon: string;
  badge_color: string;
  earned_at: string;
}

interface PointsEntry {
  id: string;
  points: number;
  action_type: string;
  description: string | null;
  created_at: string;
}

interface TrackProgress {
  id: string;
  name: string;
  category: string;
  total_lessons: number;
  completed_lessons: number;
  is_completed: boolean;
}

export const AcademyProgressPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [levels, setLevels] = useState<LevelDefinition[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsEntry[]>([]);
  const [trackProgress, setTrackProgress] = useState<TrackProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userContext.onboardingUserId) loadData();
  }, [userContext]);

  const loadData = async () => {
    try {
      // Load user level
      const { data: levelData } = await supabase
        .from("academy_user_levels")
        .select("*")
        .eq("onboarding_user_id", userContext.onboardingUserId!)
        .maybeSingle();

      if (levelData) {
        setUserLevel({
          total_points: levelData.total_points,
          current_level: levelData.current_level,
          level_name: levelData.level_name,
          lessons_completed: levelData.lessons_completed,
          quizzes_passed: levelData.quizzes_passed,
          tracks_completed: levelData.tracks_completed,
          current_streak: levelData.current_streak,
          best_streak: levelData.best_streak,
        });
      }

      // Load level definitions
      const { data: levelsData } = await supabase
        .from("academy_level_definitions")
        .select("*")
        .order("level", { ascending: true });

      setLevels(levelsData || []);

      // Load user badges
      const { data: badgesData } = await supabase
        .from("academy_user_badges")
        .select(`
          id, earned_at, badge_id,
          academy_badges!inner(name, description, icon, color)
        `)
        .eq("onboarding_user_id", userContext.onboardingUserId!)
        .order("earned_at", { ascending: false });

      setBadges(
        (badgesData || []).map((b) => {
          const badge = b.academy_badges as any;
          return {
            id: b.id,
            badge_id: b.badge_id,
            badge_name: badge.name,
            badge_description: badge.description,
            badge_icon: badge.icon,
            badge_color: badge.color,
            earned_at: b.earned_at,
          };
        })
      );

      // Load points history
      const { data: pointsData } = await supabase
        .from("academy_points_ledger")
        .select("*")
        .eq("onboarding_user_id", userContext.onboardingUserId!)
        .order("created_at", { ascending: false })
        .limit(50);

      setPointsHistory(pointsData || []);

      // Load track progress
      const { data: tracksData } = await supabase
        .from("academy_tracks")
        .select(`
          id, name, category,
          academy_lessons(id)
        `)
        .eq("is_active", true);

      if (tracksData) {
        const progressPromises = tracksData.map(async (track) => {
          const lessonIds = (track.academy_lessons as any[]).map((l) => l.id);
          let completedCount = 0;

          if (lessonIds.length > 0) {
            const { count } = await supabase
              .from("academy_progress")
              .select("id", { count: "exact" })
              .eq("onboarding_user_id", userContext.onboardingUserId!)
              .eq("status", "completed")
              .in("lesson_id", lessonIds);

            completedCount = count || 0;
          }

          return {
            id: track.id,
            name: track.name,
            category: track.category,
            total_lessons: lessonIds.length,
            completed_lessons: completedCount,
            is_completed: completedCount === lessonIds.length && lessonIds.length > 0,
          };
        });

        const progress = await Promise.all(progressPromises);
        setTrackProgress(progress.filter((p) => p.completed_lessons > 0 || p.total_lessons > 0));
      }
    } catch (error) {
      console.error("Error loading progress data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNextLevel = () => {
    if (!userLevel || levels.length === 0) return null;
    const nextLevel = levels.find((l) => l.level === userLevel.current_level + 1);
    return nextLevel || null;
  };

  const getProgressToNextLevel = () => {
    if (!userLevel) return 0;
    const currentLevelDef = levels.find((l) => l.level === userLevel.current_level);
    const nextLevel = getNextLevel();
    
    if (!currentLevelDef || !nextLevel) return 100;
    
    const pointsInLevel = userLevel.total_points - currentLevelDef.min_points;
    const pointsNeeded = nextLevel.min_points - currentLevelDef.min_points;
    
    return Math.min(100, (pointsInLevel / pointsNeeded) * 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      lesson_complete: "Aula concluída",
      quiz_pass: "Prova aprovada",
      badge_earned: "Conquista",
      streak: "Sequência",
      track_complete: "Trilha concluída",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const nextLevel = getNextLevel();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Progresso</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe sua evolução na UNV Academy
        </p>
      </div>

      {/* Level Card */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary rounded-full">
                <Trophy className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seu nível</p>
                <p className="text-2xl font-bold">
                  Nível {userLevel?.current_level || 1}: {userLevel?.level_name || "Iniciante"}
                </p>
                <p className="text-primary font-semibold">
                  {userLevel?.total_points || 0} pontos
                </p>
              </div>
            </div>

            {nextLevel && (
              <div className="flex-1 max-w-md">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Próximo nível</span>
                  <span className="font-medium">
                    Nível {nextLevel.level}: {nextLevel.name}
                  </span>
                </div>
                <Progress value={getProgressToNextLevel()} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">
                  Faltam {nextLevel.min_points - (userLevel?.total_points || 0)} pontos
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userLevel?.lessons_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Aulas concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userLevel?.quizzes_passed || 0}</p>
                <p className="text-xs text-muted-foreground">Provas aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Flame className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userLevel?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Dias seguidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{badges.length}</p>
                <p className="text-xs text-muted-foreground">Conquistas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="badges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="badges">Conquistas</TabsTrigger>
          <TabsTrigger value="tracks">Trilhas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-4">
          {badges.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {badges.map((badge) => (
                <Card key={badge.id} className="text-center">
                  <CardContent className="pt-6">
                    <div
                      className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${badge.badge_color}20` }}
                    >
                      <Award
                        className="h-8 w-8"
                        style={{ color: badge.badge_color }}
                      />
                    </div>
                    <p className="font-semibold">{badge.badge_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {badge.badge_description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(badge.earned_at)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma conquista ainda</h3>
              <p className="text-muted-foreground">
                Complete aulas e provas para ganhar conquistas!
              </p>
              <Button className="mt-4" asChild>
                <Link to="/academy/tracks">Ver trilhas</Link>
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tracks" className="space-y-4">
          {trackProgress.length > 0 ? (
            <div className="grid gap-4">
              {trackProgress.map((track) => (
                <Card key={track.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{track.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {track.completed_lessons} de {track.total_lessons} aulas
                          </p>
                        </div>
                      </div>
                      {track.is_completed ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Concluída
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/academy/track/${track.id}`}>Continuar</Link>
                        </Button>
                      )}
                    </div>
                    <Progress
                      value={(track.completed_lessons / track.total_lessons) * 100}
                      className="h-2"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma trilha iniciada</h3>
              <p className="text-muted-foreground">
                Comece uma trilha para acompanhar seu progresso!
              </p>
              <Button className="mt-4" asChild>
                <Link to="/academy/tracks">Ver trilhas</Link>
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {pointsHistory.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {pointsHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {getActionTypeLabel(entry.action_type)}
                          </p>
                          {entry.description && (
                            <p className="text-sm text-muted-foreground">
                              {entry.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          +{entry.points}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhum ponto registrado</h3>
              <p className="text-muted-foreground">
                Complete aulas para ganhar pontos!
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AcademyProgressPage;
