import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  Clock,
  Target,
  RefreshCw,
  Printer,
  Star,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface ConsultantSummary {
  id: string;
  name: string;
  avatar?: string;
  criticalProjects: number;
  overdueTasks: number;
  nextMeeting?: string;
  avgHealthScore: number;
}

interface CriticalProject {
  id: string;
  company_name: string;
  health_score: number;
  consultant_name: string;
  issue: string;
}

interface PositiveHighlight {
  id: string;
  company_name: string;
  type: 'improvement' | 'renewal' | 'nps';
  description: string;
}

export function DailyLeadershipAgenda() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portfolioHealth, setPortfolioHealth] = useState(0);
  const [riskDistribution, setRiskDistribution] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [todayMeetings, setTodayMeetings] = useState(0);
  const [criticalProjects, setCriticalProjects] = useState<CriticalProject[]>([]);
  const [positiveHighlights, setPositiveHighlights] = useState<PositiveHighlight[]>([]);
  const [consultantSummaries, setConsultantSummaries] = useState<ConsultantSummary[]>([]);

  const fetchData = async () => {
    try {
      // Fetch all active projects with health scores
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          company_id,
          consultant_id,
          cs_id,
          status,
          onboarding_companies(name),
          client_health_scores(total_score, risk_level),
          onboarding_staff!onboarding_projects_consultant_id_fkey(name, avatar_url)
        `)
        .in("status", ["active", "implementation", "ongoing", "expansion"]);

      if (projects) {
        // Calculate portfolio health
        const scores = projects
          .filter(p => p.client_health_scores?.total_score)
          .map(p => p.client_health_scores!.total_score);
        const avgHealth = scores.length > 0 
          ? scores.reduce((a, b) => a + b, 0) / scores.length 
          : 0;
        setPortfolioHealth(Math.round(avgHealth));

        // Calculate risk distribution
        const risks = { critical: 0, high: 0, medium: 0, low: 0 };
        projects.forEach(p => {
          const score = p.client_health_scores?.total_score || 50;
          if (score < 30) risks.critical++;
          else if (score < 50) risks.high++;
          else if (score < 70) risks.medium++;
          else risks.low++;
        });
        setRiskDistribution(risks);

        // Get critical projects
        const critical = projects
          .filter(p => (p.client_health_scores?.total_score || 50) < 40)
          .slice(0, 5)
          .map(p => ({
            id: p.id,
            company_name: p.onboarding_companies?.name || "Empresa",
            health_score: p.client_health_scores?.total_score || 0,
            consultant_name: p.onboarding_staff?.name || "N/A",
            issue: (p.client_health_scores?.total_score || 50) < 30 ? "Health Score crítico" : "Risco elevado"
          }));
        setCriticalProjects(critical);

        // Group by consultant
        const consultantMap = new Map<string, ConsultantSummary>();
        for (const p of projects) {
          const consultantId = p.consultant_id;
          if (!consultantId) continue;
          
          if (!consultantMap.has(consultantId)) {
            consultantMap.set(consultantId, {
              id: consultantId,
              name: p.onboarding_staff?.name || "Consultor",
              avatar: p.onboarding_staff?.avatar_url || undefined,
              criticalProjects: 0,
              overdueTasks: 0,
              avgHealthScore: 0,
            });
          }
          
          const summary = consultantMap.get(consultantId)!;
          const score = p.client_health_scores?.total_score || 50;
          if (score < 40) summary.criticalProjects++;
          summary.avgHealthScore = (summary.avgHealthScore + score) / 2;
        }
        setConsultantSummaries(Array.from(consultantMap.values()));
      }

      // Fetch overdue tasks count
      const today = format(new Date(), "yyyy-MM-dd");
      const { count: overdueCount } = await supabase
        .from("onboarding_tasks")
        .select("id", { count: "exact", head: true })
        .lt("due_date", today)
        .neq("status", "completed");
      setOverdueTasks(overdueCount || 0);

      // Fetch today's meetings
      const { count: meetingsCount } = await supabase
        .from("onboarding_meeting_notes")
        .select("id", { count: "exact", head: true })
        .gte("meeting_date", today)
        .lt("meeting_date", format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
      setTodayMeetings(meetingsCount || 0);

      // Fetch positive highlights (recent renewals)
      const { data: renewals } = await supabase
        .from("onboarding_contract_renewals")
        .select(`
          id,
          onboarding_projects:onboarding_projects!inner(company_id, onboarding_companies(name))
        `)
        .eq("status", "confirmed")
        .gte("renewal_date", format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"))
        .limit(3);

      if (renewals) {
        const highlights: PositiveHighlight[] = renewals.map((r: any) => ({
          id: r.id,
          company_name: r.onboarding_projects?.onboarding_companies?.name || "Empresa",
          type: 'renewal' as const,
          description: "Renovação confirmada"
        }));
        setPositiveHighlights(highlights);
      }

    } catch (error) {
      console.error("Error fetching leadership agenda data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
            Pauta de Reunião de Liderança
          </h2>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Resumo Executivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Portfolio Health */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Saúde Média</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-3xl font-bold text-emerald-400">{portfolioHealth}</p>
            </motion.div>

            {/* Risk Distribution */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Em Risco</span>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-3xl font-bold text-amber-400">{riskDistribution.critical + riskDistribution.high}</p>
              <p className="text-xs text-muted-foreground">{riskDistribution.critical} críticos</p>
            </motion.div>

            {/* Overdue Tasks */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative p-4 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Tarefas Vencidas</span>
                <Clock className="h-4 w-4 text-red-400" />
              </div>
              <p className="text-3xl font-bold text-red-400">{overdueTasks}</p>
            </motion.div>

            {/* Today Meetings */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Reuniões Hoje</span>
                <Calendar className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-blue-400">{todayMeetings}</p>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Critical Alerts */}
        <Card className="bg-gradient-to-br from-red-950/30 to-rose-950/20 border-red-500/20 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Alertas Críticos
              {criticalProjects.length > 0 && (
                <Badge variant="destructive" className="ml-2">{criticalProjects.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {criticalProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-400" />
                  <p className="text-sm">Nenhum alerta crítico!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {criticalProjects.map((project, i) => (
                    <motion.div
                      key={project.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors"
                      onClick={() => navigate(`/onboarding-tasks/project/${project.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{project.company_name}</p>
                          <p className="text-xs text-muted-foreground">{project.consultant_name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="text-xs">
                            Score: {project.health_score}
                          </Badge>
                          <p className="text-xs text-red-400 mt-1">{project.issue}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Positive Highlights */}
        <Card className="bg-gradient-to-br from-emerald-950/30 to-green-950/20 border-emerald-500/20 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-emerald-400" />
              Destaques Positivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {positiveHighlights.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Nenhum destaque recente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positiveHighlights.map((highlight, i) => (
                    <motion.div
                      key={highlight.id}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-emerald-500/20">
                          {highlight.type === 'renewal' ? <Target className="h-4 w-4 text-emerald-400" /> :
                           highlight.type === 'nps' ? <Star className="h-4 w-4 text-emerald-400" /> :
                           <TrendingUp className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{highlight.company_name}</p>
                          <p className="text-xs text-emerald-400">{highlight.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Consultant Summary Table */}
      <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Ações Pendentes por Consultor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultor</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Projetos Críticos</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Saúde Média</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {consultantSummaries.map((consultant, i) => (
                  <motion.tr
                    key={consultant.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-muted/10 hover:bg-muted/5"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                          {consultant.name.charAt(0)}
                        </div>
                        <span className="font-medium">{consultant.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      {consultant.criticalProjects > 0 ? (
                        <Badge variant="destructive">{consultant.criticalProjects}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">0</Badge>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-medium ${consultant.avgHealthScore >= 70 ? 'text-emerald-400' : consultant.avgHealthScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {Math.round(consultant.avgHealthScore)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          const event = new CustomEvent('selectConsultant', { detail: consultant.id });
                          window.dispatchEvent(event);
                        }}
                      >
                        Ver 1:1
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
