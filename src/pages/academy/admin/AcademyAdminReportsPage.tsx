import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Users,
  BookOpen,
  Trophy,
  TrendingUp,
  Building,
  CheckCircle,
  Percent,
} from "lucide-react";
import type { AcademyUserContext } from "../AcademyLayout";

interface CompanyStats {
  company_id: string;
  company_name: string;
  users_count: number;
  active_users: number;
  lessons_completed: number;
  quizzes_passed: number;
  total_points: number;
  avg_points: number;
}

interface TrackStats {
  track_id: string;
  track_name: string;
  category: string;
  total_enrollments: number;
  completions: number;
  completion_rate: number;
  avg_quiz_score: number;
}

interface GlobalStats {
  total_users: number;
  active_users: number;
  total_lessons_completed: number;
  total_quizzes_passed: number;
  total_certificates: number;
  avg_quiz_score: number;
}

export const AcademyAdminReportsPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [trackStats, setTrackStats] = useState<TrackStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      // Load global stats
      const { count: totalUsers } = await supabase
        .from("academy_user_levels")
        .select("id", { count: "exact" });

      const { count: activeUsers } = await supabase
        .from("academy_user_levels")
        .select("id", { count: "exact" })
        .gte("last_activity_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { count: lessonsCompleted } = await supabase
        .from("academy_progress")
        .select("id", { count: "exact" })
        .eq("status", "completed");

      const { count: quizzesPassed } = await supabase
        .from("academy_quiz_attempts")
        .select("id", { count: "exact" })
        .eq("passed", true);

      const { count: certificates } = await supabase
        .from("academy_certificates")
        .select("id", { count: "exact" });

      const { data: avgScoreData } = await supabase
        .from("academy_quiz_attempts")
        .select("score")
        .eq("passed", true);

      const avgScore = avgScoreData && avgScoreData.length > 0
        ? Math.round(avgScoreData.reduce((acc, a) => acc + a.score, 0) / avgScoreData.length)
        : 0;

      setGlobalStats({
        total_users: totalUsers || 0,
        active_users: activeUsers || 0,
        total_lessons_completed: lessonsCompleted || 0,
        total_quizzes_passed: quizzesPassed || 0,
        total_certificates: certificates || 0,
        avg_quiz_score: avgScore,
      });

      // Load company stats
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select(`
          id, name,
          onboarding_projects(
            onboarding_users(
              id,
              academy_user_levels(total_points, lessons_completed, quizzes_passed, last_activity_at)
            )
          )
        `);

      if (companiesData) {
        const stats: CompanyStats[] = companiesData.map((company) => {
          const projects = company.onboarding_projects as any[];
          let usersCount = 0;
          let activeUsersCount = 0;
          let totalLessons = 0;
          let totalQuizzes = 0;
          let totalPoints = 0;

          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

          projects?.forEach((project) => {
            const users = project.onboarding_users || [];
            users.forEach((user: any) => {
              usersCount++;
              const level = user.academy_user_levels?.[0];
              if (level) {
                totalLessons += level.lessons_completed || 0;
                totalQuizzes += level.quizzes_passed || 0;
                totalPoints += level.total_points || 0;
                if (level.last_activity_at && new Date(level.last_activity_at).getTime() > sevenDaysAgo) {
                  activeUsersCount++;
                }
              }
            });
          });

          return {
            company_id: company.id,
            company_name: company.name,
            users_count: usersCount,
            active_users: activeUsersCount,
            lessons_completed: totalLessons,
            quizzes_passed: totalQuizzes,
            total_points: totalPoints,
            avg_points: usersCount > 0 ? Math.round(totalPoints / usersCount) : 0,
          };
        }).filter(c => c.users_count > 0).sort((a, b) => b.total_points - a.total_points);

        setCompanyStats(stats);
      }

      // Load track stats
      const { data: tracksData } = await supabase
        .from("academy_tracks")
        .select(`
          id, name, category,
          academy_lessons(id),
          academy_certificates(id)
        `)
        .eq("is_active", true);

      if (tracksData) {
        const trackStatsPromises = tracksData.map(async (track) => {
          const lessonIds = (track.academy_lessons as any[]).map(l => l.id);

          // Get unique users who started this track
          const { data: enrollments } = await supabase
            .from("academy_progress")
            .select("onboarding_user_id")
            .in("lesson_id", lessonIds.length > 0 ? lessonIds : ['00000000-0000-0000-0000-000000000000']);

          const uniqueEnrollments = new Set(enrollments?.map(e => e.onboarding_user_id) || []);

          // Get quiz stats
          const { data: quizzes } = await supabase
            .from("academy_quizzes")
            .select("id")
            .eq("track_id", track.id)
            .eq("quiz_type", "track_final");

          let avgQuizScore = 0;
          if (quizzes && quizzes.length > 0) {
            const { data: attempts } = await supabase
              .from("academy_quiz_attempts")
              .select("score")
              .in("quiz_id", quizzes.map(q => q.id))
              .eq("passed", true);

            if (attempts && attempts.length > 0) {
              avgQuizScore = Math.round(attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length);
            }
          }

          const completions = (track.academy_certificates as any[]).length;
          const enrollmentsCount = uniqueEnrollments.size;

          return {
            track_id: track.id,
            track_name: track.name,
            category: track.category,
            total_enrollments: enrollmentsCount,
            completions,
            completion_rate: enrollmentsCount > 0 ? Math.round((completions / enrollmentsCount) * 100) : 0,
            avg_quiz_score: avgQuizScore,
          };
        });

        const stats = await Promise.all(trackStatsPromises);
        setTrackStats(stats.sort((a, b) => b.total_enrollments - a.total_enrollments));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!userContext.isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Acesso negado</h3>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios Globais</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do desempenho na UNV Academy
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Global Stats */}
      {globalStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.total_users}</p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.active_users}</p>
                  <p className="text-xs text-muted-foreground">Ativos (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.total_lessons_completed}</p>
                  <p className="text-xs text-muted-foreground">Aulas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.total_quizzes_passed}</p>
                  <p className="text-xs text-muted-foreground">Provas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.total_certificates}</p>
                  <p className="text-xs text-muted-foreground">Certificados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Percent className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.avg_quiz_score}%</p>
                  <p className="text-xs text-muted-foreground">Média provas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Desempenho por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Usuários</TableHead>
                <TableHead className="text-center">Ativos</TableHead>
                <TableHead className="text-center">Aulas</TableHead>
                <TableHead className="text-center">Provas</TableHead>
                <TableHead className="text-center">Pontos</TableHead>
                <TableHead className="text-center">Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyStats.slice(0, 15).map((company) => (
                <TableRow key={company.company_id}>
                  <TableCell className="font-medium">{company.company_name}</TableCell>
                  <TableCell className="text-center">{company.users_count}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={company.active_users > 0 ? "default" : "secondary"}>
                      {company.active_users}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{company.lessons_completed}</TableCell>
                  <TableCell className="text-center">{company.quizzes_passed}</TableCell>
                  <TableCell className="text-center font-semibold">{company.total_points}</TableCell>
                  <TableCell className="text-center">{company.avg_points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {companyStats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado de empresa disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Desempenho por Trilha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trilha</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Matrículas</TableHead>
                <TableHead className="text-center">Conclusões</TableHead>
                <TableHead className="text-center">Taxa</TableHead>
                <TableHead className="text-center">Nota média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trackStats.map((track) => (
                <TableRow key={track.track_id}>
                  <TableCell className="font-medium">{track.track_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{track.category}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{track.total_enrollments}</TableCell>
                  <TableCell className="text-center">{track.completions}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={track.completion_rate >= 50 ? "default" : "secondary"}>
                      {track.completion_rate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {track.avg_quiz_score > 0 ? `${track.avg_quiz_score}%` : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {trackStats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado de trilha disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademyAdminReportsPage;
