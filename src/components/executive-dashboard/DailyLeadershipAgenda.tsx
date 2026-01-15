import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  Activity,
  Building2,
  MessageSquare,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Shield,
  ChevronRight,
  BarChart3,
  Sparkles
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
  atRiskProjects: number;
  healthyProjects: number;
  overdueTasks: number;
  todayMeetings: number;
  avgHealthScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface CriticalProject {
  id: string;
  company_name: string;
  health_score: number;
  consultant_name: string;
  consultant_id: string;
  issue: string;
  priority: 'critical' | 'high' | 'medium';
  action_needed: string;
}

interface PositiveHighlight {
  id: string;
  company_name: string;
  type: 'improvement' | 'renewal' | 'nps' | 'goal';
  description: string;
  value?: number;
}

interface DailyKPI {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  color: string;
  icon: React.ReactNode;
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
  const [totalProjects, setTotalProjects] = useState(0);

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
          onboarding_staff!onboarding_projects_consultant_id_fkey(id, name, avatar_url)
        `)
        .in("status", ["active", "implementation", "ongoing", "expansion"]);

      if (projects) {
        setTotalProjects(projects.length);
        
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

        // Get critical projects with detailed info
        const critical = projects
          .filter(p => (p.client_health_scores?.total_score || 50) < 50)
          .sort((a, b) => (a.client_health_scores?.total_score || 0) - (b.client_health_scores?.total_score || 0))
          .slice(0, 8)
          .map(p => {
            const score = p.client_health_scores?.total_score || 0;
            let priority: 'critical' | 'high' | 'medium' = 'medium';
            let action_needed = 'Monitorar de perto';
            
            if (score < 30) {
              priority = 'critical';
              action_needed = 'Intervenção imediata necessária';
            } else if (score < 40) {
              priority = 'high';
              action_needed = 'Agendar reunião de alinhamento';
            } else {
              action_needed = 'Revisar plano de ação';
            }
            
            return {
              id: p.id,
              company_name: p.onboarding_companies?.name || "Empresa",
              health_score: score,
              consultant_name: p.onboarding_staff?.name || "N/A",
              consultant_id: p.onboarding_staff?.id || "",
              issue: score < 30 ? "Health Score crítico" : score < 40 ? "Risco elevado" : "Atenção necessária",
              priority,
              action_needed
            };
          });
        setCriticalProjects(critical);

        // Group by consultant with more details
        const consultantMap = new Map<string, ConsultantSummary>();
        for (const p of projects) {
          const consultantId = p.consultant_id || p.cs_id;
          if (!consultantId) continue;
          
          if (!consultantMap.has(consultantId)) {
            consultantMap.set(consultantId, {
              id: consultantId,
              name: p.onboarding_staff?.name || "Consultor",
              avatar: p.onboarding_staff?.avatar_url || undefined,
              criticalProjects: 0,
              atRiskProjects: 0,
              healthyProjects: 0,
              overdueTasks: 0,
              todayMeetings: 0,
              avgHealthScore: 0,
              trend: 'stable'
            });
          }
          
          const summary = consultantMap.get(consultantId)!;
          const score = p.client_health_scores?.total_score || 50;
          
          if (score < 40) summary.criticalProjects++;
          else if (score < 70) summary.atRiskProjects++;
          else summary.healthyProjects++;
          
          // Running average
          const totalProjects = summary.criticalProjects + summary.atRiskProjects + summary.healthyProjects;
          summary.avgHealthScore = Math.round(
            ((summary.avgHealthScore * (totalProjects - 1)) + score) / totalProjects
          );
        }
        
        // Sort by critical projects (worst first)
        const sortedConsultants = Array.from(consultantMap.values())
          .sort((a, b) => b.criticalProjects - a.criticalProjects || a.avgHealthScore - b.avgHealthScore);
        setConsultantSummaries(sortedConsultants);
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
        .limit(5);

      const highlights: PositiveHighlight[] = [];
      if (renewals) {
        renewals.forEach((r: any) => {
          highlights.push({
            id: r.id,
            company_name: r.onboarding_projects?.onboarding_companies?.name || "Empresa",
            type: 'renewal',
            description: "Renovação confirmada"
          });
        });
      }

      // Fetch recent promoter NPS
      const { data: npsPromoters } = await supabase
        .from("onboarding_nps_responses")
        .select(`
          id,
          score,
          onboarding_projects!inner(onboarding_companies(name))
        `)
        .gte("score", 9)
        .gte("created_at", format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd'T'HH:mm:ss"))
        .limit(3);

      if (npsPromoters) {
        npsPromoters.forEach((n: any) => {
          highlights.push({
            id: n.id,
            company_name: n.onboarding_projects?.onboarding_companies?.name || "Empresa",
            type: 'nps',
            description: `NPS Promotor`,
            value: n.score
          });
        });
      }

      setPositiveHighlights(highlights.slice(0, 5));

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

  const handleSelectConsultant = (consultantId: string) => {
    // Dispatch event to select consultant in the 1:1 panel
    window.dispatchEvent(new CustomEvent('selectConsultant', { detail: consultantId }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const kpis: DailyKPI[] = [
    {
      label: "Saúde do Portfólio",
      value: portfolioHealth,
      color: portfolioHealth >= 70 ? 'emerald' : portfolioHealth >= 50 ? 'amber' : 'red',
      icon: <Activity className="h-5 w-5" />
    },
    {
      label: "Projetos em Risco",
      value: riskDistribution.critical + riskDistribution.high,
      color: 'red',
      icon: <AlertTriangle className="h-5 w-5" />
    },
    {
      label: "Tarefas Vencidas",
      value: overdueTasks,
      color: overdueTasks > 10 ? 'red' : overdueTasks > 5 ? 'amber' : 'emerald',
      icon: <Clock className="h-5 w-5" />
    },
    {
      label: "Reuniões Hoje",
      value: todayMeetings,
      color: 'blue',
      icon: <Calendar className="h-5 w-5" />
    }
  ];

  const getColorClasses = (color: string) => ({
    bg: `from-${color}-500/20 to-${color}-500/5`,
    border: `border-${color}-500/30`,
    text: `text-${color}-400`,
    shadow: `shadow-${color}-500/20`
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-foreground"
          >
            Pauta de Reunião de Liderança
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.print()}
            className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={`relative overflow-hidden border-2 bg-gradient-to-br ${
              kpi.color === 'emerald' ? 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30' :
              kpi.color === 'amber' ? 'from-amber-500/20 to-amber-500/5 border-amber-500/30' :
              kpi.color === 'red' ? 'from-red-500/20 to-red-500/5 border-red-500/30' :
              'from-blue-500/20 to-blue-500/5 border-blue-500/30'
            } backdrop-blur-xl hover:scale-[1.02] transition-transform duration-300`}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-30 ${
                kpi.color === 'emerald' ? 'bg-emerald-500' :
                kpi.color === 'amber' ? 'bg-amber-500' :
                kpi.color === 'red' ? 'bg-red-500' :
                'bg-blue-500'
              }`} />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider text-foreground/80 font-semibold">
                    {kpi.label}
                  </span>
                  <div className={`p-2 rounded-lg ${
                    kpi.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                    kpi.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                    kpi.color === 'red' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {kpi.icon}
                  </div>
                </div>
                <p className={`text-4xl font-bold ${
                  kpi.color === 'emerald' ? 'text-emerald-500' :
                  kpi.color === 'amber' ? 'text-amber-500' :
                  kpi.color === 'red' ? 'text-red-500' :
                  'text-blue-500'
                }`}>
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Portfolio Distribution Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-700/50 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="font-semibold">Distribuição do Portfólio</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {totalProjects} projetos ativos
              </Badge>
            </div>
            
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-700/50">
              {riskDistribution.critical > 0 && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(riskDistribution.critical / totalProjects) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="bg-gradient-to-r from-red-500 to-red-400 h-full"
                />
              )}
              {riskDistribution.high > 0 && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(riskDistribution.high / totalProjects) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="bg-gradient-to-r from-orange-500 to-orange-400 h-full"
                />
              )}
              {riskDistribution.medium > 0 && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(riskDistribution.medium / totalProjects) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  className="bg-gradient-to-r from-amber-500 to-amber-400 h-full"
                />
              )}
              {riskDistribution.low > 0 && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(riskDistribution.low / totalProjects) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full"
                />
              )}
            </div>
            
            <div className="flex items-center justify-between mt-3 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-foreground/70">Crítico ({riskDistribution.critical})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-foreground/70">Alto ({riskDistribution.high})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-foreground/70">Médio ({riskDistribution.medium})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-foreground/70">Saudável ({riskDistribution.low})</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Critical Alerts */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-red-950/40 to-rose-950/30 border-2 border-red-500/30 backdrop-blur-xl h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Flame className="h-5 w-5 text-red-400" />
                </div>
                <span>Alertas Críticos</span>
                {criticalProjects.length > 0 && (
                  <Badge variant="destructive" className="ml-auto animate-pulse">
                    {criticalProjects.length} projetos
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-4">
                {criticalProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <div className="p-4 rounded-full bg-emerald-500/10 mb-4">
                      <Shield className="h-10 w-10 text-emerald-400" />
                    </div>
                    <p className="text-lg font-medium text-emerald-400">Excelente!</p>
                    <p className="text-sm text-center mt-1">Nenhum projeto em estado crítico</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criticalProjects.map((project, i) => (
                      <motion.div
                        key={project.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.05 }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
                          project.priority === 'critical' 
                            ? 'bg-red-500/15 border-red-500/40 hover:border-red-500/60' 
                            : project.priority === 'high'
                            ? 'bg-orange-500/15 border-orange-500/40 hover:border-orange-500/60'
                            : 'bg-amber-500/15 border-amber-500/40 hover:border-amber-500/60'
                        }`}
                        onClick={() => navigate(`/onboarding-tasks/${project.id}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              project.priority === 'critical' ? 'bg-red-500/30' :
                              project.priority === 'high' ? 'bg-orange-500/30' : 'bg-amber-500/30'
                            }`}>
                              <Building2 className={`h-4 w-4 ${
                                project.priority === 'critical' ? 'text-red-400' :
                                project.priority === 'high' ? 'text-orange-400' : 'text-amber-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-semibold">{project.company_name}</p>
                              <p className="text-xs text-muted-foreground">{project.consultant_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              className={`text-xs ${
                                project.priority === 'critical' ? 'bg-red-500/30 text-red-300 border-red-500/50' :
                                project.priority === 'high' ? 'bg-orange-500/30 text-orange-300 border-orange-500/50' :
                                'bg-amber-500/30 text-amber-300 border-amber-500/50'
                              }`}
                            >
                              Score: {project.health_score}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Zap className={`h-3.5 w-3.5 ${
                            project.priority === 'critical' ? 'text-red-400' :
                            project.priority === 'high' ? 'text-orange-400' : 'text-amber-400'
                          }`} />
                          <p className="text-xs text-muted-foreground">{project.action_needed}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Positive Highlights */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-emerald-950/40 to-green-950/30 border-2 border-emerald-500/30 backdrop-blur-xl h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Star className="h-5 w-5 text-emerald-400" />
                </div>
                <span>Destaques Positivos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-4">
                {positiveHighlights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <Sparkles className="h-10 w-10 mb-4 opacity-30" />
                    <p className="text-sm">Nenhum destaque recente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {positiveHighlights.map((highlight, i) => (
                      <motion.div
                        key={`${highlight.type}-${highlight.id}`}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/30 to-green-500/20">
                            {highlight.type === 'renewal' ? <Target className="h-5 w-5 text-emerald-400" /> :
                             highlight.type === 'nps' ? <MessageSquare className="h-5 w-5 text-emerald-400" /> :
                             highlight.type === 'goal' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> :
                             <ArrowUpRight className="h-5 w-5 text-emerald-400" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-emerald-100">{highlight.company_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-emerald-400">{highlight.description}</p>
                              {highlight.value && (
                                <Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/50 text-xs">
                                  {highlight.value}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Consultant Summary Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-2 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <span>Visão por Consultor</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                Clique para ver 1:1
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-4 px-4 font-semibold text-foreground/70">Consultor</th>
                    <th className="text-center py-4 px-3 font-semibold text-foreground/70">
                      <span className="flex items-center justify-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        Críticos
                      </span>
                    </th>
                    <th className="text-center py-4 px-3 font-semibold text-foreground/70">
                      <span className="flex items-center justify-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        Em Risco
                      </span>
                    </th>
                    <th className="text-center py-4 px-3 font-semibold text-foreground/70">
                      <span className="flex items-center justify-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        Saudáveis
                      </span>
                    </th>
                    <th className="text-center py-4 px-3 font-semibold text-foreground/70">Saúde Média</th>
                    <th className="text-right py-4 px-4 font-semibold text-foreground/70">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {consultantSummaries.map((consultant, i) => (
                    <motion.tr
                      key={consultant.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.05 }}
                      className="border-b border-slate-700/30 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectConsultant(consultant.id)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-primary/30">
                            <AvatarImage src={consultant.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-white font-bold">
                              {consultant.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{consultant.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-4 px-3">
                        {consultant.criticalProjects > 0 ? (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/40 font-bold">
                            {consultant.criticalProjects}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-4 px-3">
                        {consultant.atRiskProjects > 0 ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                            {consultant.atRiskProjects}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-4 px-3">
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                          {consultant.healthyProjects}
                        </Badge>
                      </td>
                      <td className="text-center py-4 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`w-16 h-2 rounded-full overflow-hidden bg-slate-700`}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${consultant.avgHealthScore}%` }}
                              transition={{ duration: 0.5, delay: 0.9 + i * 0.05 }}
                              className={`h-full ${
                                consultant.avgHealthScore >= 70 ? 'bg-emerald-500' :
                                consultant.avgHealthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <span className={`font-bold text-sm ${
                            consultant.avgHealthScore >= 70 ? 'text-emerald-400' :
                            consultant.avgHealthScore >= 50 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {consultant.avgHealthScore}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-4 px-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="hover:bg-primary/20 hover:text-primary"
                        >
                          Ver 1:1
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
