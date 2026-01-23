import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  BookOpen,
  Trophy,
  Flame,
  Award,
  Clock,
  CheckCircle,
  Eye,
  TrendingUp,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  total_points: number;
  current_level: number;
  level_name: string;
  lessons_completed: number;
  quizzes_passed: number;
  tracks_completed: number;
  current_streak: number;
  last_activity_at: string | null;
}

interface MemberProgress {
  id: string;
  title: string;
  type: "lesson" | "quiz";
  status: string;
  completed_at: string | null;
  score: number | null;
}

export const AcademyTeamPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberProgress, setMemberProgress] = useState<MemberProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  useEffect(() => {
    if (userContext.companyId || userContext.isAdmin) {
      loadTeamMembers();
    }
  }, [userContext]);

  const loadTeamMembers = async () => {
    try {
      let query = supabase
        .from("onboarding_users")
        .select(`
          id, name, email, role,
          onboarding_projects!inner(onboarding_company_id)
        `);

      if (!userContext.isAdmin && userContext.companyId) {
        query = query.eq("onboarding_projects.onboarding_company_id", userContext.companyId);
      }

      const { data: usersData } = await query;

      if (!usersData) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // Get levels for each user
      const userIds = usersData.map((u) => u.id);
      const { data: levelsData } = await supabase
        .from("academy_user_levels")
        .select("*")
        .in("onboarding_user_id", userIds);

      const levelsMap = new Map(levelsData?.map((l) => [l.onboarding_user_id, l]) || []);

      const members: TeamMember[] = usersData.map((user) => {
        const level = levelsMap.get(user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          total_points: level?.total_points || 0,
          current_level: level?.current_level || 1,
          level_name: level?.level_name || "Iniciante",
          lessons_completed: level?.lessons_completed || 0,
          quizzes_passed: level?.quizzes_passed || 0,
          tracks_completed: level?.tracks_completed || 0,
          current_streak: level?.current_streak || 0,
          last_activity_at: level?.last_activity_at || null,
        };
      });

      // Sort by points
      members.sort((a, b) => b.total_points - a.total_points);
      setTeamMembers(members);
    } catch (error) {
      console.error("Error loading team members:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMemberProgress = async (member: TeamMember) => {
    setSelectedMember(member);
    setLoadingProgress(true);

    try {
      // Load lesson progress
      const { data: lessonsData } = await supabase
        .from("academy_progress")
        .select(`
          lesson_id, status, completed_at,
          academy_lessons!inner(title)
        `)
        .eq("onboarding_user_id", member.id)
        .order("completed_at", { ascending: false })
        .limit(20);

      // Load quiz attempts
      const { data: quizzesData } = await supabase
        .from("academy_quiz_attempts")
        .select(`
          quiz_id, score, passed, completed_at,
          academy_quizzes!inner(title)
        `)
        .eq("onboarding_user_id", member.id)
        .order("completed_at", { ascending: false })
        .limit(20);

      const progress: MemberProgress[] = [
        ...(lessonsData || []).map((l) => ({
          id: l.lesson_id,
          title: (l.academy_lessons as any).title,
          type: "lesson" as const,
          status: l.status,
          completed_at: l.completed_at,
          score: null,
        })),
        ...(quizzesData || []).map((q) => ({
          id: q.quiz_id,
          title: (q.academy_quizzes as any).title,
          type: "quiz" as const,
          status: q.passed ? "passed" : "failed",
          completed_at: q.completed_at,
          score: q.score,
        })),
      ].sort((a, b) => {
        if (!a.completed_at) return 1;
        if (!b.completed_at) return -1;
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      });

      setMemberProgress(progress);
    } catch (error) {
      console.error("Error loading member progress:", error);
    } finally {
      setLoadingProgress(false);
    }
  };

  const getActivityStatus = (lastActivity: string | null) => {
    if (!lastActivity) return "inactive";
    const days = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 3) return "active";
    if (days <= 7) return "warning";
    return "inactive";
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
    }
    if (status === "warning") {
      return <Badge className="bg-amber-100 text-amber-800">Inativo há alguns dias</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email?.toLowerCase().includes(search.toLowerCase());

    const activityStatus = getActivityStatus(member.last_activity_at);
    const matchesStatus =
      statusFilter === "all" || activityStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalMembers = teamMembers.length;
  const activeMembers = teamMembers.filter(
    (m) => getActivityStatus(m.last_activity_at) === "active"
  ).length;
  const avgPoints =
    totalMembers > 0
      ? Math.round(
          teamMembers.reduce((acc, m) => acc + m.total_points, 0) / totalMembers
        )
      : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Time</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o progresso de treinamento da sua equipe
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMembers}</p>
                <p className="text-xs text-muted-foreground">Total</p>
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
                <p className="text-2xl font-bold">{activeMembers}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
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
                <p className="text-2xl font-bold">{avgPoints}</p>
                <p className="text-xs text-muted-foreground">Média de pontos</p>
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
                <p className="text-2xl font-bold">
                  {teamMembers.reduce((acc, m) => acc + m.tracks_completed, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Trilhas concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="warning">Alertas</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Team Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-center">Nível</TableHead>
                <TableHead className="text-center">Pontos</TableHead>
                <TableHead className="text-center">Aulas</TableHead>
                <TableHead className="text-center">Provas</TableHead>
                <TableHead className="text-center">Sequência</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{member.level_name}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {member.total_points}
                  </TableCell>
                  <TableCell className="text-center">
                    {member.lessons_completed}
                  </TableCell>
                  <TableCell className="text-center">
                    {member.quizzes_passed}
                  </TableCell>
                  <TableCell className="text-center">
                    {member.current_streak > 0 && (
                      <span className="flex items-center justify-center gap-1 text-amber-600">
                        <Flame className="h-4 w-4" />
                        {member.current_streak}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(getActivityStatus(member.last_activity_at))}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(member.last_activity_at)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadMemberProgress(member)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhum usuário encontrado</h3>
              <p className="text-muted-foreground">
                Tente ajustar os filtros de busca.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {selectedMember ? getInitials(selectedMember.name) : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <p>{selectedMember?.name}</p>
                <p className="text-sm text-muted-foreground font-normal">
                  {selectedMember?.email}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.total_points}</p>
                  <p className="text-xs text-muted-foreground">Pontos</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.lessons_completed}</p>
                  <p className="text-xs text-muted-foreground">Aulas</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.quizzes_passed}</p>
                  <p className="text-xs text-muted-foreground">Provas</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.tracks_completed}</p>
                  <p className="text-xs text-muted-foreground">Trilhas</p>
                </div>
              </div>

              {/* Activity History */}
              <div>
                <h4 className="font-semibold mb-3">Histórico de Atividades</h4>
                {loadingProgress ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : memberProgress.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {memberProgress.map((item, index) => (
                      <div
                        key={`${item.type}-${item.id}-${index}`}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            item.type === "lesson"
                              ? "bg-blue-100"
                              : item.status === "passed"
                              ? "bg-green-100"
                              : "bg-red-100"
                          }`}>
                            {item.type === "lesson" ? (
                              <BookOpen className={`h-4 w-4 ${
                                item.status === "completed" ? "text-blue-600" : "text-blue-400"
                              }`} />
                            ) : (
                              <CheckCircle className={`h-4 w-4 ${
                                item.status === "passed" ? "text-green-600" : "text-red-600"
                              }`} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.type === "lesson" ? "Aula" : "Prova"}
                              {item.score !== null && ` • ${item.score}%`}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(item.completed_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade registrada
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyTeamPage;
