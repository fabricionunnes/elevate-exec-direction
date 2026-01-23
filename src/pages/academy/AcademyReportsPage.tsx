import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, BookOpen, Trophy, Award, Clock, Target, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AcademyUserContext } from "./AcademyLayout";

interface TeamMemberStats {
  id: string;
  name: string;
  lessonsCompleted: number;
  totalLessons: number;
  quizzesPassed: number;
  totalPoints: number;
  currentLevel: string;
  lastActivity: string | null;
}

interface TeamStats {
  totalMembers: number;
  activeLearners: number;
  avgProgress: number;
  avgQuizScore: number;
  totalCertificates: number;
}

export const AcademyReportsPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [teamStats, setTeamStats] = useState<TeamStats>({
    totalMembers: 0,
    activeLearners: 0,
    avgProgress: 0,
    avgQuizScore: 0,
    totalCertificates: 0,
  });
  const [memberStats, setMemberStats] = useState<TeamMemberStats[]>([]);

  useEffect(() => {
    if (userContext?.companyId) {
      loadData();
    }
  }, [userContext?.companyId, period]);

  const loadData = async () => {
    if (!userContext?.companyId) return;
    
    setLoading(true);
    try {
      // Get all users from the company with academy access
      const { data: companyProjects } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("company_id", userContext.companyId);

      if (!companyProjects || companyProjects.length === 0) {
        setLoading(false);
        return;
      }

      const projectIds = companyProjects.map(p => p.id);

      // Get users from these projects with academy access
      const { data: users } = await supabase
        .from("onboarding_users")
        .select(`
          id,
          name,
          project_id
        `)
        .in("project_id", projectIds);

      if (!users || users.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = users.map(u => u.id);

      // Get academy user levels for stats
      const { data: userLevels } = await supabase
        .from("academy_user_levels")
        .select("*")
        .in("onboarding_user_id", userIds);

      // Get total lessons count
      const { count: totalLessonsCount } = await supabase
        .from("academy_lessons")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Get quiz attempts
      const { data: quizAttempts } = await supabase
        .from("academy_quiz_attempts")
        .select("onboarding_user_id, score, passed")
        .in("onboarding_user_id", userIds);

      // Get certificates
      const { data: certificates } = await supabase
        .from("academy_certificates")
        .select("onboarding_user_id")
        .in("onboarding_user_id", userIds);

      // Calculate team stats
      const activeLearners = userLevels?.filter(ul => ul.lessons_completed > 0).length || 0;
      const totalPoints = userLevels?.reduce((sum, ul) => sum + (ul.total_points || 0), 0) || 0;
      const avgProgress = userLevels && userLevels.length > 0 && totalLessonsCount
        ? Math.round((userLevels.reduce((sum, ul) => sum + ul.lessons_completed, 0) / userLevels.length / totalLessonsCount) * 100)
        : 0;
      
      const passedQuizzes = quizAttempts?.filter(qa => qa.passed) || [];
      const avgQuizScore = passedQuizzes.length > 0
        ? Math.round(passedQuizzes.reduce((sum, qa) => sum + qa.score, 0) / passedQuizzes.length)
        : 0;

      setTeamStats({
        totalMembers: users.length,
        activeLearners,
        avgProgress,
        avgQuizScore,
        totalCertificates: certificates?.length || 0,
      });

      // Build member stats
      const memberStatsData: TeamMemberStats[] = users.map(user => {
        const userLevel = userLevels?.find(ul => ul.onboarding_user_id === user.id);
        const userQuizzes = quizAttempts?.filter(qa => qa.onboarding_user_id === user.id && qa.passed) || [];

        return {
          id: user.id,
          name: user.name,
          lessonsCompleted: userLevel?.lessons_completed || 0,
          totalLessons: totalLessonsCount || 0,
          quizzesPassed: userQuizzes.length,
          totalPoints: userLevel?.total_points || 0,
          currentLevel: userLevel?.level_name || "Iniciante",
          lastActivity: userLevel?.last_activity_at || null,
        };
      });

      // Sort by points descending
      memberStatsData.sort((a, b) => b.totalPoints - a.totalPoints);
      setMemberStats(memberStatsData);
    } catch (error) {
      console.error("Error loading team reports:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!userContext?.isClientManager && !userContext?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso negado. Esta página é exclusiva para gestores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios do Time</h1>
          <p className="text-muted-foreground">Acompanhe o progresso e desempenho da sua equipe na Academy</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.totalMembers}</p>
                <p className="text-xs text-muted-foreground">Total de Membros</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.activeLearners}</p>
                <p className="text-xs text-muted-foreground">Aprendizes Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BookOpen className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.avgProgress}%</p>
                <p className="text-xs text-muted-foreground">Progresso Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.avgQuizScore}%</p>
                <p className="text-xs text-muted-foreground">Nota Média Provas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Award className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.totalCertificates}</p>
                <p className="text-xs text-muted-foreground">Certificados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho Individual</CardTitle>
        </CardHeader>
        <CardContent>
          {memberStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum membro encontrado com acesso à Academy.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Aulas</TableHead>
                  <TableHead className="text-center">Provas</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                  <TableHead className="text-center">Nível</TableHead>
                  <TableHead className="text-center">Última Atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberStats.map((member, index) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {index < 3 && (
                          <span className={`text-lg ${
                            index === 0 ? "text-amber-500" :
                            index === 1 ? "text-gray-400" :
                            "text-amber-700"
                          }`}>
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                          </span>
                        )}
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">
                        {member.lessonsCompleted}/{member.totalLessons}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{member.quizzesPassed}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {member.totalPoints.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge>{member.currentLevel}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {member.lastActivity 
                        ? new Date(member.lastActivity).toLocaleDateString("pt-BR")
                        : "—"
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademyReportsPage;
