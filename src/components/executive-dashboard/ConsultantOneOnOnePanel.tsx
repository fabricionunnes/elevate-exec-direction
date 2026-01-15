import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  Building2, 
  Target, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  RefreshCw,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CompanyBriefingCard } from "./CompanyBriefingCard";

interface Consultant {
  id: string;
  name: string;
  avatar_url?: string;
  role: string;
}

interface ConsultantMetrics {
  totalProjects: number;
  avgHealthScore: number;
  engagementScore: number;
  retentionRate: number;
}

interface ProjectBriefing {
  id: string;
  company_name: string;
  health_score: number;
  risk_level: string;
  goal_projection?: number;
  last_meeting_date?: string;
  overdue_tasks: number;
  nps_score?: number;
  next_action?: string;
  ai_insight?: string;
  days_since_meeting?: number;
}

interface AgendaItem {
  type: 'urgent' | 'attention' | 'opportunity' | 'celebrate';
  title: string;
  description: string;
  projectId?: string;
}

export function ConsultantOneOnOnePanel() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [metrics, setMetrics] = useState<ConsultantMetrics | null>(null);
  const [projects, setProjects] = useState<ProjectBriefing[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // Load consultants
  useEffect(() => {
    const fetchConsultants = async () => {
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id, name, avatar_url, role")
        .in("role", ["consultant", "cs", "admin"])
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setConsultants(data);
      }
      setLoading(false);
    };
    fetchConsultants();

    // Listen for consultant selection from leadership panel
    const handleSelectConsultant = (e: CustomEvent<string>) => {
      setSelectedConsultant(e.detail);
    };
    window.addEventListener('selectConsultant', handleSelectConsultant as EventListener);
    return () => window.removeEventListener('selectConsultant', handleSelectConsultant as EventListener);
  }, []);

  // Load consultant data when selected
  useEffect(() => {
    if (!selectedConsultant) return;
    
    const fetchConsultantData = async () => {
      setLoadingProjects(true);
      
      try {
        // Fetch projects for this consultant
        const { data: projectsData } = await supabase
          .from("onboarding_projects")
          .select(`
            id,
            company_id,
            status,
            onboarding_companies(name),
            client_health_scores(total_score, risk_level, goals_score)
          `)
          .or(`consultant_id.eq.${selectedConsultant},cs_id.eq.${selectedConsultant}`)
          .in("status", ["active", "implementation", "ongoing", "expansion"]);

        if (projectsData) {
          // Calculate metrics
          const scores = projectsData
            .filter(p => p.client_health_scores?.total_score)
            .map(p => p.client_health_scores!.total_score);
          
          const avgHealth = scores.length > 0 
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

          setMetrics({
            totalProjects: projectsData.length,
            avgHealthScore: avgHealth,
            engagementScore: 0,
            retentionRate: 0
          });

          // Fetch additional data for each project
          const briefings: ProjectBriefing[] = [];
          const agenda: AgendaItem[] = [];

          const today = format(new Date(), "yyyy-MM-dd");
          
          for (const project of projectsData) {
            // Get overdue tasks count
            const { count: overdueCount } = await supabase
              .from("onboarding_tasks")
              .select("id", { count: "exact", head: true })
              .eq("project_id", project.id)
              .lt("due_date", today)
              .neq("status", "completed");

            // Get last meeting
            const { data: lastMeeting } = await supabase
              .from("onboarding_meeting_notes")
              .select("meeting_date")
              .eq("project_id", project.id)
              .eq("is_finalized", true)
              .order("meeting_date", { ascending: false })
              .limit(1)
              .single();

            // Get latest NPS
            const { data: latestNps } = await supabase
              .from("onboarding_nps_responses")
              .select("score")
              .eq("project_id", project.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            // Get goal projection from monthly goals
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            const { data: goalData } = await supabase
              .from("onboarding_monthly_goals")
              .select("sales_target, sales_result")
              .eq("project_id", project.id)
              .eq("month", currentMonth)
              .eq("year", currentYear)
              .maybeSingle();
            
            const goalProjection = goalData && goalData.sales_target && goalData.sales_target > 0
              ? (goalData.sales_result / goalData.sales_target) * 100
              : undefined;

            const daysSinceMeeting = lastMeeting?.meeting_date
              ? differenceInDays(new Date(), new Date(lastMeeting.meeting_date))
              : undefined;

            const healthScore = project.client_health_scores?.total_score || 50;
            const riskLevel = project.client_health_scores?.risk_level || 'medium';

            briefings.push({
              id: project.id,
              company_name: project.onboarding_companies?.name || "Empresa",
              health_score: healthScore,
              risk_level: riskLevel,
              goal_projection: goalProjection,
              last_meeting_date: lastMeeting?.meeting_date,
              overdue_tasks: overdueCount || 0,
              nps_score: latestNps?.score,
              days_since_meeting: daysSinceMeeting
            });

            // Build agenda items
            if (healthScore < 40) {
              agenda.push({
                type: 'urgent',
                title: project.onboarding_companies?.name || "Empresa",
                description: `Health Score crítico (${healthScore})`,
                projectId: project.id
              });
            } else if (healthScore < 60 || (overdueCount && overdueCount > 3)) {
              agenda.push({
                type: 'attention',
                title: project.onboarding_companies?.name || "Empresa",
                description: overdueCount && overdueCount > 3 
                  ? `${overdueCount} tarefas atrasadas` 
                  : `Health Score requer atenção (${healthScore})`,
                projectId: project.id
              });
            }

            if (latestNps?.score && latestNps.score >= 9) {
              agenda.push({
                type: 'celebrate',
                title: project.onboarding_companies?.name || "Empresa",
                description: `NPS Promotor (${latestNps.score})`,
                projectId: project.id
              });
            }
          }

          // Sort by health score (worst first)
          briefings.sort((a, b) => a.health_score - b.health_score);
          setProjects(briefings);
          setAgendaItems(agenda);
        }

        // Fetch engagement score
        const { data: engagementData } = await supabase
          .from("consultant_engagement_scores")
          .select("total_score, retention_score")
          .eq("staff_id", selectedConsultant)
          .order("calculation_date", { ascending: false })
          .limit(1)
          .single();

        if (engagementData && metrics) {
          setMetrics(prev => prev ? {
            ...prev,
            engagementScore: engagementData.total_score || 0,
            retentionRate: engagementData.retention_score || 0
          } : null);
        }

      } catch (error) {
        console.error("Error fetching consultant data:", error);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchConsultantData();
  }, [selectedConsultant]);

  const selectedConsultantData = consultants.find(c => c.id === selectedConsultant);

  const getAgendaIcon = (type: AgendaItem['type']) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'attention': return <Clock className="h-4 w-4 text-amber-400" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-blue-400" />;
      case 'celebrate': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getAgendaColor = (type: AgendaItem['type']) => {
    switch (type) {
      case 'urgent': return 'border-red-500/30 bg-red-500/10';
      case 'attention': return 'border-amber-500/30 bg-amber-500/10';
      case 'opportunity': return 'border-blue-500/30 bg-blue-500/10';
      case 'celebrate': return 'border-emerald-500/30 bg-emerald-500/10';
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Consultant Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
            Pauta de 1:1 com Consultor
          </h2>
          <p className="text-muted-foreground text-sm">
            Selecione um consultor para ver o briefing completo
          </p>
        </div>
        
        <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
          <SelectTrigger className="w-[280px] bg-background/50 backdrop-blur-sm">
            <SelectValue placeholder="Selecione um consultor" />
          </SelectTrigger>
          <SelectContent>
            {consultants.map((consultant) => (
              <SelectItem key={consultant.id} value={consultant.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={consultant.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {consultant.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{consultant.name}</span>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {consultant.role === 'consultant' ? 'Consultor' : 
                     consultant.role === 'cs' ? 'CS' : 'Admin'}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AnimatePresence mode="wait">
        {!selectedConsultant ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          >
            <User className="h-16 w-16 mb-4 opacity-20" />
            <p>Selecione um consultor para começar</p>
          </motion.div>
        ) : loadingProjects ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <Skeleton className="h-32 w-full" />
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Consultant Header Card */}
            {selectedConsultantData && (
              <Card className="bg-gradient-to-br from-primary/10 to-violet-500/10 border-primary/20 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-violet-500/5" />
                <CardContent className="relative p-6">
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20 border-4 border-primary/30 shadow-xl shadow-primary/20">
                      <AvatarImage src={selectedConsultantData.avatar_url} />
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-violet-500 text-white">
                        {selectedConsultantData.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">{selectedConsultantData.name}</h3>
                      <Badge variant="secondary" className="mt-1">
                        {selectedConsultantData.role === 'consultant' ? 'Consultor' : 
                         selectedConsultantData.role === 'cs' ? 'Customer Success' : 'Administrador'}
                      </Badge>
                    </div>
                    
                    {/* Metrics */}
                    {metrics && (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 rounded-lg bg-background/50 backdrop-blur-sm">
                          <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
                          <p className="text-2xl font-bold">{metrics.totalProjects}</p>
                          <p className="text-xs text-muted-foreground">Projetos</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-background/50 backdrop-blur-sm">
                          <Target className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
                          <p className="text-2xl font-bold">{metrics.avgHealthScore}</p>
                          <p className="text-xs text-muted-foreground">Saúde Média</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-background/50 backdrop-blur-sm">
                          <Sparkles className="h-5 w-5 mx-auto mb-1 text-violet-400" />
                          <p className="text-2xl font-bold">{metrics.engagementScore || '-'}</p>
                          <p className="text-xs text-muted-foreground">Engajamento</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-background/50 backdrop-blur-sm">
                          <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                          <p className="text-2xl font-bold">{metrics.retentionRate ? `${metrics.retentionRate}%` : '-'}</p>
                          <p className="text-xs text-muted-foreground">Retenção</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Agenda */}
            {agendaItems.length > 0 && (
              <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Pauta Sugerida para 1:1
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-3">
                    {agendaItems.slice(0, 6).map((item, i) => (
                      <motion.div
                        key={`${item.projectId}-${item.type}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${getAgendaColor(item.type)}`}
                      >
                        {getAgendaIcon(item.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Briefings */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Empresas da Carteira ({projects.length})
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project, i) => (
                  <CompanyBriefingCard key={project.id} project={project} index={i} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
