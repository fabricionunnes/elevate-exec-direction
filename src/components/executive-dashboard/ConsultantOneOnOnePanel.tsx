import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  TrendingDown,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  Zap,
  Users,
  Award,
  ShieldCheck,
  Flame,
  Lightbulb,
  Copy,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { CompanyBriefingCard } from "./CompanyBriefingCard";
import { toast } from "sonner";

interface Consultant {
  id: string;
  name: string;
  avatar_url?: string;
  role: string;
}

interface ConsultantMetrics {
  totalProjects: number;
  criticalProjects: number;
  atRiskProjects: number;
  healthyProjects: number;
  avgHealthScore: number;
  engagementScore: number;
  retentionRate: number;
  overdueTasksTotal: number;
  meetingsThisWeek: number;
  avgGoalProjection: number;
}

interface KPIData {
  name: string;
  target: number;
  result: number;
  percentage: number;
  kpiType: string;
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
  segment?: string;
  last_nps_feedback?: string;
  company_id?: string;
  kpis?: KPIData[];
}

interface AgendaSection {
  type: 'urgent' | 'attention' | 'celebrate' | 'discuss';
  title: string;
  items: {
    company: string;
    projectId: string;
    reason: string;
    healthScore: number;
  }[];
}

export function ConsultantOneOnOnePanel() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [metrics, setMetrics] = useState<ConsultantMetrics | null>(null);
  const [projects, setProjects] = useState<ProjectBriefing[]>([]);
  const [agendaSections, setAgendaSections] = useState<AgendaSection[]>([]);
  const [copied, setCopied] = useState(false);

  // Load consultants - only show role='consultant'
  useEffect(() => {
    const fetchConsultants = async () => {
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id, name, avatar_url, role")
        .eq("role", "consultant")
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
            onboarding_companies(name, segment),
            client_health_scores(total_score, risk_level, goals_score)
          `)
          .or(`consultant_id.eq.${selectedConsultant},cs_id.eq.${selectedConsultant}`)
          .in("status", ["active", "implementation", "ongoing", "expansion"]);

        if (projectsData) {
          // Calculate metrics
          let criticalCount = 0;
          let atRiskCount = 0;
          let healthyCount = 0;
          let totalOverdue = 0;
          let totalGoalProjection = 0;
          let goalsCount = 0;

          const scores = projectsData
            .filter(p => p.client_health_scores?.total_score)
            .map(p => {
              const score = p.client_health_scores!.total_score;
              if (score < 40) criticalCount++;
              else if (score < 70) atRiskCount++;
              else healthyCount++;
              return score;
            });
          
          const avgHealth = scores.length > 0 
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

          // Fetch additional data for each project
          const briefings: ProjectBriefing[] = [];
          const urgent: AgendaSection['items'] = [];
          const attention: AgendaSection['items'] = [];
          const celebrate: AgendaSection['items'] = [];
          const discuss: AgendaSection['items'] = [];

          const today = format(new Date(), "yyyy-MM-dd");
          const weekAgo = format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd");
          
          for (const project of projectsData) {
            // Get overdue tasks count
            const { count: overdueCount } = await supabase
              .from("onboarding_tasks")
              .select("id", { count: "exact", head: true })
              .eq("project_id", project.id)
              .lt("due_date", today)
              .neq("status", "completed");

            totalOverdue += overdueCount || 0;

            // Get last meeting
            const { data: lastMeeting } = await supabase
              .from("onboarding_meeting_notes")
              .select("meeting_date")
              .eq("project_id", project.id)
              .eq("is_finalized", true)
              .order("meeting_date", { ascending: false })
              .limit(1)
              .single();

            // Get latest NPS with feedback
            const { data: latestNps } = await supabase
              .from("onboarding_nps_responses")
              .select("score, feedback")
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

            // Fetch KPIs for this company
            const companyId = project.company_id;
            const kpisData: KPIData[] = [];
            
            if (companyId) {
              // Get company KPIs
              const { data: kpis } = await supabase
                .from("company_kpis")
                .select("id, name, target_value, kpi_type")
                .eq("company_id", companyId)
                .eq("is_active", true)
                .order("sort_order")
                .limit(5);

              if (kpis && kpis.length > 0) {
                // Get current month entries for each KPI
                const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
                const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

                for (const kpi of kpis) {
                  const { data: entries } = await supabase
                    .from("kpi_entries")
                    .select("value")
                    .eq("kpi_id", kpi.id)
                    .gte("entry_date", startOfMonth)
                    .lte("entry_date", endOfMonth);

                  const totalValue = entries?.reduce((sum, e) => sum + (Number(e.value) || 0), 0) || 0;
                  const target = Number(kpi.target_value) || 0;
                  const percentage = target > 0 ? (totalValue / target) * 100 : 0;

                  kpisData.push({
                    name: kpi.name,
                    target,
                    result: totalValue,
                    percentage,
                    kpiType: kpi.kpi_type
                  });
                }
              }
            }

            const daysSinceMeeting = lastMeeting?.meeting_date
              ? differenceInDays(new Date(), new Date(lastMeeting.meeting_date))
              : undefined;

            const healthScore = project.client_health_scores?.total_score || 50;
            const riskLevel = project.client_health_scores?.risk_level || 'medium';
            const companyName = project.onboarding_companies?.name || "Empresa";

            briefings.push({
              id: project.id,
              company_name: companyName,
              health_score: healthScore,
              risk_level: riskLevel,
              goal_projection: goalProjection,
              last_meeting_date: lastMeeting?.meeting_date,
              overdue_tasks: overdueCount || 0,
              nps_score: latestNps?.score,
              days_since_meeting: daysSinceMeeting,
              segment: project.onboarding_companies?.segment,
              last_nps_feedback: latestNps?.feedback,
              company_id: companyId,
              kpis: kpisData
            });

            // Categorize for agenda
            if (healthScore < 40) {
              urgent.push({
                company: companyName,
                projectId: project.id,
                reason: `Health Score crítico (${healthScore})`,
                healthScore
              });
            } else if (healthScore < 60 || (overdueCount && overdueCount > 3) || (daysSinceMeeting && daysSinceMeeting > 14)) {
              const reasons = [];
              if (healthScore < 60) reasons.push(`Health Score ${healthScore}`);
              if (overdueCount && overdueCount > 3) reasons.push(`${overdueCount} tarefas atrasadas`);
              if (daysSinceMeeting && daysSinceMeeting > 14) reasons.push(`${daysSinceMeeting}d sem reunião`);
              
              attention.push({
                company: companyName,
                projectId: project.id,
                reason: reasons.join(' • '),
                healthScore
              });
            } else if (healthScore >= 80 && latestNps?.score && latestNps.score >= 9) {
              celebrate.push({
                company: companyName,
                projectId: project.id,
                reason: `Health ${healthScore} • NPS ${latestNps.score}`,
                healthScore
              });
            } else {
              discuss.push({
                company: companyName,
                projectId: project.id,
                reason: goalProjection ? `Meta ${goalProjection.toFixed(0)}%` : 'Alinhamento geral',
                healthScore
              });
            }
          }

          // Count meetings this week
          const { count: meetingsCount } = await supabase
            .from("onboarding_meeting_notes")
            .select("id", { count: "exact", head: true })
            .eq("staff_id", selectedConsultant)
            .gte("meeting_date", weekAgo)
            .lte("meeting_date", today)
            .eq("is_finalized", true);

          setMetrics({
            totalProjects: projectsData.length,
            criticalProjects: criticalCount,
            atRiskProjects: atRiskCount,
            healthyProjects: healthyCount,
            avgHealthScore: avgHealth,
            engagementScore: 0,
            retentionRate: 0,
            overdueTasksTotal: totalOverdue,
            meetingsThisWeek: meetingsCount || 0,
            avgGoalProjection: goalsCount > 0 ? Math.round(totalGoalProjection / goalsCount) : 0
          });

          // Build agenda sections
          const sections: AgendaSection[] = [];
          if (urgent.length > 0) sections.push({ type: 'urgent', title: '🚨 Urgente - Intervenção Necessária', items: urgent });
          if (attention.length > 0) sections.push({ type: 'attention', title: '⚠️ Atenção - Monitoramento Próximo', items: attention });
          if (celebrate.length > 0) sections.push({ type: 'celebrate', title: '🎉 Celebrar - Cases de Sucesso', items: celebrate });
          if (discuss.length > 0) sections.push({ type: 'discuss', title: '💬 Alinhamento Geral', items: discuss.slice(0, 3) });
          
          setAgendaSections(sections);

          // Sort by health score (worst first)
          briefings.sort((a, b) => a.health_score - b.health_score);
          setProjects(briefings);
        }

        // Fetch engagement score
        const { data: engagementData } = await supabase
          .from("consultant_engagement_scores")
          .select("total_score, retention_score")
          .eq("staff_id", selectedConsultant)
          .order("calculation_date", { ascending: false })
          .limit(1)
          .single();

        if (engagementData) {
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

  const copyAgendaToClipboard = () => {
    if (!selectedConsultantData || !metrics) return;

    let text = `📋 PAUTA 1:1 - ${selectedConsultantData.name}\n`;
    text += `📅 ${format(new Date(), "dd/MM/yyyy")}\n\n`;
    
    text += `📊 MÉTRICAS DA CARTEIRA\n`;
    text += `• Projetos: ${metrics.totalProjects} (${metrics.criticalProjects} críticos, ${metrics.atRiskProjects} atenção, ${metrics.healthyProjects} saudáveis)\n`;
    text += `• Saúde Média: ${metrics.avgHealthScore}\n`;
    text += `• Tarefas Atrasadas: ${metrics.overdueTasksTotal}\n`;
    text += `• Reuniões na Semana: ${metrics.meetingsThisWeek}\n\n`;

    agendaSections.forEach(section => {
      text += `${section.title}\n`;
      section.items.forEach(item => {
        text += `  → ${item.company}: ${item.reason}\n`;
      });
      text += '\n';
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Pauta copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getSectionStyle = (type: AgendaSection['type']) => {
    switch (type) {
      case 'urgent': return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: <Flame className="h-5 w-5 text-red-600 dark:text-red-400" /> };
      case 'attention': return { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', icon: <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" /> };
      case 'celebrate': return { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: <Award className="h-5 w-5 text-green-600 dark:text-green-400" /> };
      case 'discuss': return { bg: 'bg-slate-50 dark:bg-slate-900/50', border: 'border-slate-200 dark:border-slate-700', icon: <MessageSquare className="h-5 w-5 text-slate-600 dark:text-slate-400" /> };
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Consultant Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-foreground"
          >
            Pauta de 1:1 com Consultor
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Briefing completo para direcionamento estratégico
          </motion.p>
        </div>
        
        <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
          <SelectTrigger className="w-[280px] h-11 bg-card border border-border">
            <SelectValue placeholder="Selecione um consultor" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {consultants.map((consultant) => (
              <SelectItem key={consultant.id} value={consultant.id} className="py-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarImage src={consultant.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {consultant.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{consultant.name}</span>
                  <Badge variant="outline" className="text-xs ml-1">
                    Consultor
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
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="p-6 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 mb-6">
              <User className="h-16 w-16 text-primary/50" />
            </div>
            <p className="text-xl font-medium text-muted-foreground">Selecione um consultor</p>
            <p className="text-sm text-muted-foreground mt-2">para visualizar o briefing completo da carteira</p>
          </motion.div>
        ) : loadingProjects ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-60 w-full rounded-2xl" />
            <div className="grid md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
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
            {selectedConsultantData && metrics && (
              <Card className="border bg-card">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Avatar & Name */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 border-2 border-primary">
                        <AvatarImage src={selectedConsultantData.avatar_url} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                          {selectedConsultantData.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">{selectedConsultantData.name}</h3>
                        <Badge variant="outline" className="mt-2">
                          Consultor
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Metrics Grid */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <Building2 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold text-foreground">{metrics.totalProjects}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Projetos</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <Target className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className={`text-2xl font-bold ${
                          metrics.avgHealthScore >= 70 ? 'text-green-600 dark:text-green-500' :
                          metrics.avgHealthScore >= 50 ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-600 dark:text-red-500'
                        }`}>{metrics.avgHealthScore}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saúde Média</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className={`text-2xl font-bold ${metrics.criticalProjects > 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                          {metrics.criticalProjects}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Críticos</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className={`text-2xl font-bold ${metrics.overdueTasksTotal > 10 ? 'text-red-600 dark:text-red-500' : metrics.overdueTasksTotal > 5 ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-600 dark:text-green-500'}`}>
                          {metrics.overdueTasksTotal}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Atrasadas</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <Calendar className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold text-foreground">{metrics.meetingsThisWeek}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reuniões/Sem</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <TrendingUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className={`text-2xl font-bold ${
                          metrics.avgGoalProjection >= 100 ? 'text-green-600 dark:text-green-500' :
                          metrics.avgGoalProjection >= 80 ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-600 dark:text-red-500'
                        }`}>{metrics.avgGoalProjection}%</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta Média</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Agenda */}
            {agendaSections.length > 0 && (
              <Card className="border bg-card">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <span className="text-foreground">Pauta Sugerida para 1:1</span>
                        <p className="text-sm font-normal text-muted-foreground mt-0.5">
                          Pontos organizados por prioridade
                        </p>
                      </div>
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={copyAgendaToClipboard}
                      className="gap-2"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copiado!' : 'Copiar Pauta'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agendaSections.map((section, sectionIndex) => {
                    const style = getSectionStyle(section.type);
                    return (
                      <motion.div
                        key={section.type}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: sectionIndex * 0.1 }}
                        className={`p-4 rounded-lg border ${style.bg} ${style.border}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-background">
                            {style.icon}
                          </div>
                          <h4 className="font-semibold text-foreground">{section.title}</h4>
                          <Badge variant="outline" className="ml-auto">
                            {section.items.length} {section.items.length === 1 ? 'item' : 'itens'}
                          </Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                          {section.items.map((item, i) => (
                            <motion.div
                              key={item.projectId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: sectionIndex * 0.1 + i * 0.05 }}
                              className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted transition-colors cursor-pointer group border"
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                                item.healthScore < 40 ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                                item.healthScore < 70 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                                'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                              }`}>
                                {item.healthScore}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                                  {item.company}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Company Briefing Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Briefing por Empresa</h3>
                    <p className="text-sm text-muted-foreground">Ordenado por prioridade (menor saúde primeiro)</p>
                  </div>
                </div>
                <Badge variant="outline">{projects.length} empresas</Badge>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {projects.map((project, index) => (
                  <CompanyBriefingCard 
                    key={project.id} 
                    project={project} 
                    index={index}
                    expanded={true}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
