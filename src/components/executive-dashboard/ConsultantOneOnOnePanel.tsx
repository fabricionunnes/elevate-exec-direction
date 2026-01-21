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
  Check,
  NotebookPen,
  Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CompanyBriefingCard } from "./CompanyBriefingCard";
import { toast } from "sonner";
import { LeadershipMeetingNotesDialog } from "./LeadershipMeetingNotesDialog";
import { NewCompanyCard } from "./NewCompanyCard";
import { AddTaskDialog } from "@/components/onboarding-tasks/AddTaskDialog";

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

interface NewCompany {
  id: string;
  company_name: string;
  days_since_start: number;
  health_score: number;
  completed_tasks: number;
  total_tasks: number;
  last_meeting_date?: string;
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
  const navigate = useNavigate();
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [metrics, setMetrics] = useState<ConsultantMetrics | null>(null);
  const [projects, setProjects] = useState<ProjectBriefing[]>([]);
  const [agendaSections, setAgendaSections] = useState<AgendaSection[]>([]);
  const [newCompanies, setNewCompanies] = useState<NewCompany[]>([]);
  const [newCompaniesFilter, setNewCompaniesFilter] = useState<30 | 60 | 90>(30);
  const [copied, setCopied] = useState(false);
  
  // State for internal task creation dialog
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string }>>([]);

  // Handler to open task dialog
  const handleOpenTaskDialog = (projectId: string, companyName: string) => {
    setSelectedProjectId(projectId);
    setSelectedCompanyName(companyName);
    setShowAddTaskDialog(true);
  };

  // Fetch staff list when dialog opens
  useEffect(() => {
    if (showAddTaskDialog && staffList.length === 0) {
      const fetchStaff = async () => {
        const { data } = await supabase
          .from("onboarding_staff")
          .select("id, name, role")
          .eq("is_active", true)
          .order("name");
        if (data) setStaffList(data);
      };
      fetchStaff();
    }
  }, [showAddTaskDialog, staffList.length]);

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
        const today = format(new Date(), "yyyy-MM-dd");
        const weekAgo = format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd");
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        const startOfMonthStr = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0];
        const monthYear = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

        // Fetch projects for this consultant
        const { data: projectsData } = await supabase
          .from("onboarding_projects")
          .select(`
            id,
            onboarding_company_id,
            status,
            onboarding_companies(name, segment),
            client_health_scores(total_score, risk_level, goals_score)
          `)
          .or(`consultant_id.eq.${selectedConsultant},cs_id.eq.${selectedConsultant}`)
          .in("status", ["active", "implementation", "ongoing", "expansion"]);

        if (!projectsData || projectsData.length === 0) {
          setMetrics({
            totalProjects: 0,
            criticalProjects: 0,
            atRiskProjects: 0,
            healthyProjects: 0,
            avgHealthScore: 0,
            engagementScore: 0,
            retentionRate: 0,
            overdueTasksTotal: 0,
            meetingsThisWeek: 0,
            avgGoalProjection: 0
          });
          setProjects([]);
          setAgendaSections([]);
          setNewCompanies([]);
          setLoadingProjects(false);
          return;
        }

        const projectIds = projectsData.map(p => p.id);
        const companyIds = [...new Set(projectsData.map(p => p.onboarding_company_id).filter(Boolean))] as string[];

        // Fetch all related data in parallel (batch queries instead of N+1)
        const [
          overdueTasksResult,
          lastMeetingsResult,
          latestNpsResult,
          kpisResult,
          meetingsCountResult,
          engagementResult
        ] = await Promise.all([
          // Overdue tasks for all projects at once
          supabase
            .from("onboarding_tasks")
            .select("project_id")
            .in("project_id", projectIds)
            .lt("due_date", today)
            .neq("status", "completed"),
          
          // Last meetings for all projects at once
          supabase
            .from("onboarding_meeting_notes")
            .select("project_id, meeting_date")
            .in("project_id", projectIds)
            .eq("is_finalized", true)
            .order("meeting_date", { ascending: false }),
          
          // Latest NPS for all projects at once
          supabase
            .from("onboarding_nps_responses")
            .select("project_id, score, feedback, created_at")
            .in("project_id", projectIds)
            .order("created_at", { ascending: false }),
          
          // All KPIs for all companies at once
          companyIds.length > 0 ? supabase
            .from("company_kpis")
            .select("id, company_id, name, target_value, kpi_type, periodicity")
            .in("company_id", companyIds)
            .eq("is_active", true)
            .order("sort_order")
            .limit(500) : Promise.resolve({ data: [] }),
          
          // Meetings count this week
          supabase
            .from("onboarding_meeting_notes")
            .select("id", { count: "exact", head: true })
            .eq("staff_id", selectedConsultant)
            .gte("meeting_date", weekAgo)
            .lte("meeting_date", today)
            .eq("is_finalized", true),
          
          // Engagement score
          supabase
            .from("consultant_engagement_scores")
            .select("total_score, retention_score")
            .eq("staff_id", selectedConsultant)
            .order("calculation_date", { ascending: false })
            .limit(1)
            .single()
        ]);

        // Build lookup maps from batch results
        const overdueCountByProject = new Map<string, number>();
        (overdueTasksResult.data || []).forEach(t => {
          overdueCountByProject.set(t.project_id, (overdueCountByProject.get(t.project_id) || 0) + 1);
        });

        const lastMeetingByProject = new Map<string, string>();
        (lastMeetingsResult.data || []).forEach(m => {
          if (!lastMeetingByProject.has(m.project_id)) {
            lastMeetingByProject.set(m.project_id, m.meeting_date);
          }
        });

        const latestNpsByProject = new Map<string, { score: number; feedback: string | null }>();
        (latestNpsResult.data || []).forEach(n => {
          if (!latestNpsByProject.has(n.project_id)) {
            latestNpsByProject.set(n.project_id, { score: n.score, feedback: n.feedback });
          }
        });

        const kpisByCompany = new Map<string, typeof kpisResult.data>();
        (kpisResult.data || []).forEach(k => {
          if (!kpisByCompany.has(k.company_id)) {
            kpisByCompany.set(k.company_id, []);
          }
          kpisByCompany.get(k.company_id)!.push(k);
        });

        // Fetch KPI entries and targets in batch if there are KPIs
        const allKpiIds = (kpisResult.data || []).map(k => k.id);
        let kpiEntriesMap = new Map<string, number>();
        let kpiMonthlyTargetsMap = new Map<string, { target_value: number; level_name: string }[]>();

        if (allKpiIds.length > 0) {
          const [entriesResult, targetsResult] = await Promise.all([
            supabase
              .from("kpi_entries")
              .select("kpi_id, value")
              .in("kpi_id", allKpiIds)
              .gte("entry_date", startOfMonthStr)
              .lte("entry_date", today),
            supabase
              .from("kpi_monthly_targets")
              .select("kpi_id, target_value, level_name, level_order")
              .in("kpi_id", allKpiIds)
              .eq("month_year", monthYear)
              .is("unit_id", null)
              .is("team_id", null)
              .is("salesperson_id", null)
              .order("level_order", { ascending: true })
          ]);

          // Aggregate entries by KPI
          (entriesResult.data || []).forEach(e => {
            kpiEntriesMap.set(e.kpi_id, (kpiEntriesMap.get(e.kpi_id) || 0) + (Number(e.value) || 0));
          });

          // Group targets by KPI
          (targetsResult.data || []).forEach(t => {
            if (!kpiMonthlyTargetsMap.has(t.kpi_id)) {
              kpiMonthlyTargetsMap.set(t.kpi_id, []);
            }
            kpiMonthlyTargetsMap.get(t.kpi_id)!.push({
              target_value: Number(t.target_value),
              level_name: t.level_name
            });
          });
        }

        // Calculate days in period for target adjustment
        const startDateObj = new Date(startOfMonthStr);
        const endDateObj = new Date(today);
        const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Process projects with pre-fetched data
        let criticalCount = 0;
        let atRiskCount = 0;
        let healthyCount = 0;
        let totalOverdue = 0;

        const briefings: ProjectBriefing[] = [];
        const urgent: AgendaSection['items'] = [];
        const attention: AgendaSection['items'] = [];
        const celebrate: AgendaSection['items'] = [];
        const discuss: AgendaSection['items'] = [];

        for (const project of projectsData) {
          const healthScore = project.client_health_scores?.total_score || 50;
          
          if (healthScore < 40) criticalCount++;
          else if (healthScore < 70) atRiskCount++;
          else healthyCount++;

          const overdueCount = overdueCountByProject.get(project.id) || 0;
          totalOverdue += overdueCount;

          const lastMeetingDate = lastMeetingByProject.get(project.id);
          const daysSinceMeeting = lastMeetingDate
            ? differenceInDays(new Date(), new Date(lastMeetingDate))
            : undefined;

          const npsData = latestNpsByProject.get(project.id);
          const companyId = project.onboarding_company_id;
          const companyName = project.onboarding_companies?.name || "Empresa";
          const riskLevel = project.client_health_scores?.risk_level || "medium";

          // Calculate KPI goal projection using pre-fetched data
          const kpisData: KPIData[] = [];
          let overallRealized = 0;
          let overallTarget = 0;

          if (companyId) {
            const companyKpis = kpisByCompany.get(companyId) || [];
            
            for (const kpi of companyKpis) {
              const monthlyTargets = kpiMonthlyTargetsMap.get(kpi.id) || [];
              const preferredMonthlyTarget = monthlyTargets.find(t => t.level_name === "Meta") ?? monthlyTargets[0];

              const baseTarget = preferredMonthlyTarget?.target_value
                ? Number(preferredMonthlyTarget.target_value)
                : Number(kpi.target_value) || 0;

              let targetForPeriod = baseTarget;
              if (kpi.periodicity === "daily") {
                targetForPeriod = baseTarget * daysDiff;
              } else if (kpi.periodicity === "weekly") {
                targetForPeriod = baseTarget * Math.ceil(daysDiff / 7);
              }

              const totalValue = kpiEntriesMap.get(kpi.id) || 0;
              const percentage = targetForPeriod > 0 ? (totalValue / targetForPeriod) * 100 : 0;

              kpisData.push({
                name: kpi.name,
                target: targetForPeriod,
                result: totalValue,
                percentage,
                kpiType: kpi.kpi_type,
              });

              if (targetForPeriod > 0) {
                overallRealized += totalValue;
                overallTarget += targetForPeriod;
              }
            }
          }

          const finalGoalProjection = overallTarget > 0 ? (overallRealized / overallTarget) * 100 : 0;

          briefings.push({
            id: project.id,
            company_name: companyName,
            health_score: healthScore,
            risk_level: riskLevel,
            goal_projection: finalGoalProjection,
            last_meeting_date: lastMeetingDate,
            overdue_tasks: overdueCount,
            nps_score: npsData?.score,
            days_since_meeting: daysSinceMeeting,
            segment: project.onboarding_companies?.segment,
            last_nps_feedback: npsData?.feedback,
            company_id: companyId,
            kpis: kpisData
          });

          // Categorize for agenda
          if (healthScore < 40) {
            urgent.push({
              company: companyName,
              projectId: project.id,
              reason: `Health Score crítico (${healthScore})`,
              healthScore,
            });
          } else if (
            healthScore < 60 ||
            overdueCount > 3 ||
            (daysSinceMeeting && daysSinceMeeting > 14)
          ) {
            const reasons = [];
            if (healthScore < 60) reasons.push(`Health Score ${healthScore}`);
            if (overdueCount > 3) reasons.push(`${overdueCount} tarefas atrasadas`);
            if (daysSinceMeeting && daysSinceMeeting > 14) reasons.push(`${daysSinceMeeting}d sem reunião`);

            attention.push({
              company: companyName,
              projectId: project.id,
              reason: reasons.join(" • "),
              healthScore,
            });
          } else if (healthScore >= 80 && npsData?.score && npsData.score >= 9) {
            celebrate.push({
              company: companyName,
              projectId: project.id,
              reason: `Health ${healthScore} • NPS ${npsData.score}`,
              healthScore,
            });
          } else {
            discuss.push({
              company: companyName,
              projectId: project.id,
              reason: finalGoalProjection > 0 ? `Meta ${finalGoalProjection.toFixed(0)}%` : "Alinhamento geral",
              healthScore,
            });
          }
        }

        const scores = projectsData
          .filter(p => p.client_health_scores?.total_score)
          .map(p => p.client_health_scores!.total_score);
        const avgHealth = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        setMetrics({
          totalProjects: projectsData.length,
          criticalProjects: criticalCount,
          atRiskProjects: atRiskCount,
          healthyProjects: healthyCount,
          avgHealthScore: avgHealth,
          engagementScore: engagementResult.data?.total_score || 0,
          retentionRate: engagementResult.data?.retention_score || 0,
          overdueTasksTotal: totalOverdue,
          meetingsThisWeek: meetingsCountResult.count || 0,
          avgGoalProjection: 0
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

        // Fetch new companies (started within last 90 days) for this consultant
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: newProjectsData } = await supabase
          .from("onboarding_projects")
          .select(`
            id,
            created_at,
            onboarding_companies(name, contract_start_date),
            client_health_scores(total_score)
          `)
          .or(`consultant_id.eq.${selectedConsultant},cs_id.eq.${selectedConsultant}`)
          .in("status", ["active", "implementation", "ongoing"])
          .gte("created_at", ninetyDaysAgo.toISOString());

        if (newProjectsData && newProjectsData.length > 0) {
          const newProjectIds = newProjectsData.map(p => p.id);

          const [taskCountsResult, meetingsDataResult] = await Promise.all([
            supabase
              .from("onboarding_tasks")
              .select("project_id, status")
              .in("project_id", newProjectIds),
            supabase
              .from("onboarding_meeting_notes")
              .select("project_id, meeting_date")
              .in("project_id", newProjectIds)
              .order("meeting_date", { ascending: false })
          ]);

          const taskCountMap = new Map<string, { completed: number; total: number }>();
          (taskCountsResult.data || []).forEach(t => {
            if (!taskCountMap.has(t.project_id)) {
              taskCountMap.set(t.project_id, { completed: 0, total: 0 });
            }
            const counts = taskCountMap.get(t.project_id)!;
            counts.total++;
            if (t.status === 'completed') counts.completed++;
          });

          const meetingMap = new Map<string, string>();
          (meetingsDataResult.data || []).forEach(m => {
            if (!meetingMap.has(m.project_id)) {
              meetingMap.set(m.project_id, m.meeting_date);
            }
          });

          const newCompaniesData: NewCompany[] = newProjectsData.map(p => {
            const startDate = p.onboarding_companies?.contract_start_date
              ? new Date(p.onboarding_companies.contract_start_date)
              : new Date(p.created_at);
            const daysSince = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const tasks = taskCountMap.get(p.id) || { completed: 0, total: 0 };

            return {
              id: p.id,
              company_name: p.onboarding_companies?.name || "Empresa",
              days_since_start: daysSince,
              health_score: p.client_health_scores?.total_score || 50,
              completed_tasks: tasks.completed,
              total_tasks: tasks.total,
              last_meeting_date: meetingMap.get(p.id)
            };
          }).sort((a, b) => a.days_since_start - b.days_since_start);

          setNewCompanies(newCompaniesData);
        } else {
          setNewCompanies([]);
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
                    <div className="flex items-center gap-2">
                      <LeadershipMeetingNotesDialog 
                        meetingType="one_on_one"
                        consultantId={selectedConsultant}
                        consultantName={selectedConsultantData?.name}
                        trigger={
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-primary hover:bg-primary/90 gap-2"
                          >
                            <NotebookPen className="h-4 w-4" />
                            Anotações
                          </Button>
                        }
                      />
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
                              className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted transition-colors group border"
                            >
                              <div 
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer ${
                                  item.healthScore < 40 ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                                  item.healthScore < 70 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                                  'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                }`}
                                onClick={() => navigate(`/onboarding-tasks/${item.projectId}`)}
                              >
                                {item.healthScore}
                              </div>
                              <div 
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => navigate(`/onboarding-tasks/${item.projectId}`)}
                              >
                                <p className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                                  {item.company}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTaskDialog(item.projectId, item.company);
                                }}
                                title="Criar tarefa interna"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <ChevronRight 
                                className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors cursor-pointer" 
                                onClick={() => navigate(`/onboarding-tasks/${item.projectId}`)}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* New Companies Section */}
            {newCompanies.length > 0 && (
              <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                {/* Premium Header */}
                <CardHeader className="pb-4 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-bold">Empresas Novas</span>
                        <span className="text-blue-100 text-xs font-normal">Acompanhamento de onboarding</span>
                      </div>
                      <Badge className="ml-2 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                        {newCompanies.filter(c => c.days_since_start <= newCompaniesFilter).length} em onboarding
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl p-1">
                      {[30, 60, 90].map((days) => (
                        <Button
                          key={days}
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewCompaniesFilter(days as 30 | 60 | 90)}
                          className={newCompaniesFilter === days 
                            ? "bg-white text-blue-600 hover:bg-white hover:text-blue-700 shadow-sm font-semibold" 
                            : "text-white/90 hover:bg-white/20 hover:text-white"
                          }
                        >
                          {days}d
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {newCompanies.filter(c => c.days_since_start <= newCompaniesFilter).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Nenhuma empresa nova nos últimos {newCompaniesFilter} dias</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {newCompanies.filter(c => c.days_since_start <= newCompaniesFilter).map((company, i) => (
                        <NewCompanyCard
                          key={company.id}
                          company={company}
                          index={i}
                          onClick={() => navigate(`/onboarding-tasks/${company.id}`)}
                          onCreateInternalTask={handleOpenTaskDialog}
                        />
                      ))}
                    </div>
                  )}
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
                    onCreateInternalTask={handleOpenTaskDialog}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Internal Task Dialog */}
      <AddTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        projectId={selectedProjectId}
        staffList={staffList}
        onTaskAdded={() => {
          setShowAddTaskDialog(false);
          toast.success(`Tarefa interna criada para ${selectedCompanyName}!`);
        }}
        forceInternal={true}
      />
    </div>
  );
}
