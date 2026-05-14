import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Trophy,
  Target,
  Flame,
  ChevronRight,
  Play,
  Award,
  Clock,
  Star,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

interface Track {
  id: string;
  name: string;
  description: string;
  category: string;
  cover_image_url: string | null;
  level: number;
  lessons_count: number;
  completed_lessons: number;
}

interface UserStats {
  total_points: number;
  current_level: number;
  level_name: string;
  lessons_completed: number;
  quizzes_passed: number;
  tracks_completed: number;
  current_streak: number;
  badges_count: number;
}

interface RecentLesson {
  id: string;
  title: string;
  track_name: string;
  progress_status: string;
  last_activity: string;
}

export const AcademyHomePage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentLessons, setRecentLessons] = useState<RecentLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userContext]);

  const loadData = async () => {
    try {
      const isVendedor = userContext.userRole === "vendedor";
      // Load tracks with lesson counts
      let tracksQuery = supabase
        .from("academy_tracks")
        .select(`
          id, name, description, category, cover_image_url, level,
          academy_lessons(id)
        `)
        .eq("is_active", true)
        .order("level", { ascending: true })
        .order("sort_order", { ascending: true })
        .limit(6);

      // Vendedor não vê trilhas da categoria Gestão
      if (isVendedor) {
        tracksQuery = tracksQuery.neq("category", "gestao");
      }

      const { data: tracksData } = await tracksQuery;

      if (tracksData) {
        // Get progress for each track if user is logged in
        const tracksWithProgress = await Promise.all(
          tracksData.map(async (track) => {
            let completedLessons = 0;
            
            if (userContext.onboardingUserId) {
              const { count } = await supabase
                .from("academy_progress")
                .select("id", { count: "exact" })
                .eq("onboarding_user_id", userContext.onboardingUserId)
                .eq("status", "completed")
                .in("lesson_id", (track.academy_lessons as any[]).map(l => l.id));
              
              completedLessons = count || 0;
            }

            return {
              id: track.id,
              name: track.name,
              description: track.description || "",
              category: track.category,
              cover_image_url: track.cover_image_url,
              level: track.level,
              lessons_count: (track.academy_lessons as any[]).length,
              completed_lessons: completedLessons,
            };
          })
        );
        setTracks(tracksWithProgress);
      }

      // Load user stats
      if (userContext.onboardingUserId) {
        const { data: levelData } = await supabase
          .from("academy_user_levels")
          .select("*")
          .eq("onboarding_user_id", userContext.onboardingUserId)
          .maybeSingle();

        const { count: badgesCount } = await supabase
          .from("academy_user_badges")
          .select("id", { count: "exact" })
          .eq("onboarding_user_id", userContext.onboardingUserId);

        if (levelData) {
          setUserStats({
            total_points: levelData.total_points,
            current_level: levelData.current_level,
            level_name: levelData.level_name,
            lessons_completed: levelData.lessons_completed,
            quizzes_passed: levelData.quizzes_passed,
            tracks_completed: levelData.tracks_completed,
            current_streak: levelData.current_streak,
            badges_count: badgesCount || 0,
          });
        }

        // Load recent lessons
        const { data: progressData } = await supabase
          .from("academy_progress")
          .select(`
            lesson_id, status, updated_at,
            academy_lessons!inner(id, title, track_id,
              academy_tracks!inner(name)
            )
          `)
          .eq("onboarding_user_id", userContext.onboardingUserId)
          .order("updated_at", { ascending: false })
          .limit(5);

        if (progressData) {
          setRecentLessons(
            progressData.map((p) => {
              const lesson = p.academy_lessons as any;
              return {
                id: lesson.id,
                title: lesson.title,
                track_name: lesson.academy_tracks?.name || "",
                progress_status: p.status,
                last_activity: p.updated_at,
              };
            })
          );
        }
      }
    } catch (error) {
      console.error("Error loading academy data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      gestao: "bg-purple-100 text-purple-800",
      vendas: "bg-blue-100 text-blue-800",
      rh: "bg-pink-100 text-pink-800",
      financeiro: "bg-green-100 text-green-800",
      marketing: "bg-orange-100 text-orange-800",
      geral: "bg-gray-100 text-gray-800",
    };
    return colors[category] || colors.geral;
  };

  const getLevelIcon = (level: number) => {
    if (level <= 1) return <Star className="h-4 w-4 text-slate-400" />;
    if (level <= 2) return <Star className="h-4 w-4 text-green-500" />;
    if (level <= 3) return <Star className="h-4 w-4 text-blue-500" />;
    if (level <= 4) return <Star className="h-4 w-4 text-purple-500" />;
    return <Star className="h-4 w-4 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Olá, {userContext.userName.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Continue sua jornada de aprendizado na UNV Academy
          </p>
        </div>
        <Button asChild>
          <Link to="/academy/tracks">
            Ver todas as trilhas
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userStats?.total_points || 0}</p>
                <p className="text-xs text-muted-foreground">Pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userStats?.lessons_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Aulas</p>
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
                <p className="text-2xl font-bold">{userStats?.current_streak || 0}</p>
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
                <p className="text-2xl font-bold">{userStats?.badges_count || 0}</p>
                <p className="text-xs text-muted-foreground">Conquistas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level Card */}
      {userStats && (
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-full">
                  {getLevelIcon(userStats.current_level)}
                </div>
                <div>
                  <p className="font-semibold">Nível {userStats.current_level}: {userStats.level_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {userStats.tracks_completed} trilhas completadas
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/academy/progress">Ver detalhes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue Learning */}
      {recentLessons.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Continue de onde parou</h2>
          <div className="grid gap-3">
            {recentLessons.slice(0, 3).map((lesson) => (
              <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <Link
                    to={`/academy/lesson/${lesson.id}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Play className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{lesson.title}</p>
                        <p className="text-sm text-muted-foreground">{lesson.track_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lesson.progress_status === "completed" ? "default" : "secondary"}>
                        {lesson.progress_status === "completed" ? "Concluída" : "Em andamento"}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Featured Tracks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Trilhas em Destaque</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/academy/tracks">
              Ver todas <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((track) => {
            const progress = track.lessons_count > 0
              ? (track.completed_lessons / track.lessons_count) * 100
              : 0;

            return (
              <Card key={track.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div
                  className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
                  style={track.cover_image_url ? {
                    backgroundImage: `url(${track.cover_image_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  } : {}}
                >
                  {!track.cover_image_url && (
                    <BookOpen className="h-12 w-12 text-primary/40" />
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getCategoryColor(track.category)}>
                      {track.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {getLevelIcon(track.level)}
                      Nível {track.level}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">{track.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {track.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{track.lessons_count} aulas</span>
                    <span>{Math.round(progress)}% concluído</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <Button className="w-full mt-4" size="sm" asChild>
                    <Link to={`/academy/track/${track.id}`}>
                      {progress > 0 ? "Continuar" : "Começar"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {tracks.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma trilha disponível</h3>
            <p className="text-muted-foreground">
              {userContext.isAdmin
                ? "Crie sua primeira trilha no painel administrativo."
                : "Em breve novas trilhas serão liberadas para você."}
            </p>
            {userContext.isAdmin && (
              <Button className="mt-4" asChild>
                <Link to="/academy/admin/content">Criar trilha</Link>
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default AcademyHomePage;
