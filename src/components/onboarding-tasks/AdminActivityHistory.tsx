import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  MessageSquare,
  Edit,
  User,
  Calendar,
  Target,
  Star,
  Headphones,
  Plus,
  Clock,
  Building2,
  Filter,
  RefreshCw,
  X,
  FileText,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { format, isToday, isYesterday, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface ActivityItem {
  id: string;
  type: "task_history" | "meeting" | "support" | "nps" | "goal";
  action: string;
  description: string;
  date: string;
  staffId: string | null;
  staffName: string | null;
  companyId: string | null;
  companyName: string | null;
  projectId: string | null;
  projectName: string | null;
  details?: Record<string, any>;
}

interface Company {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  name: string;
}

interface AdminActivityHistoryProps {
  className?: string;
}

interface GroupedActivities {
  [date: string]: ActivityItem[];
}

export const AdminActivityHistory = ({ className }: AdminActivityHistoryProps) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  
  // Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [staffNameSearch, setStaffNameSearch] = useState<string>("");

  useEffect(() => {
    fetchFiltersData();
    fetchActivities();
  }, []);

  const fetchFiltersData = async () => {
    try {
      const [companiesRes, staffRes] = await Promise.all([
        supabase.from("onboarding_companies").select("id, name").order("name"),
        supabase.from("onboarding_staff").select("id, name").eq("is_active", true).order("name"),
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (staffRes.data) setStaffMembers(staffRes.data);
    } catch (error) {
      console.error("Error fetching filters data:", error);
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const allActivities: ActivityItem[] = [];

      // 1. Task History
      const { data: taskHistory } = await supabase
        .from("onboarding_task_history")
        .select(`
          *,
          staff:onboarding_staff(id, name),
          task:onboarding_tasks(
            id, title, 
            project:onboarding_projects(
              id, product_name,
              company:onboarding_companies(id, name)
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (taskHistory) {
        for (const item of taskHistory) {
          const task = item.task as any;
          const project = task?.project as any;
          const company = project?.company as any;
          
          allActivities.push({
            id: `task_history_${item.id}`,
            type: "task_history",
            action: item.action,
            description: getTaskHistoryDescription(item),
            date: item.created_at,
            staffId: item.staff_id,
            staffName: (item.staff as any)?.name || null,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              taskTitle: task?.title,
              fieldChanged: item.field_changed,
              oldValue: item.old_value,
              newValue: item.new_value,
            },
          });
        }
      }

      // 2. Meeting Notes
      const { data: meetings } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          *,
          staff:onboarding_staff!staff_id(id, name),
          scheduled_by_staff:onboarding_staff!scheduled_by(id, name),
          project:onboarding_projects(
            id, product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (meetings) {
        for (const item of meetings) {
          const project = item.project as any;
          const company = project?.company as any;
          const scheduledByStaff = item.scheduled_by_staff as any;
          
          const description = scheduledByStaff?.name 
            ? `Reunião agendada por ${scheduledByStaff.name}: ${item.meeting_title}`
            : `Registrou reunião: ${item.meeting_title}`;
          
          allActivities.push({
            id: `meeting_${item.id}`,
            type: "meeting",
            action: item.is_finalized ? "meeting_finalized" : "meeting_registered",
            description,
            date: item.created_at,
            staffId: item.scheduled_by || item.staff_id,
            staffName: scheduledByStaff?.name || (item.staff as any)?.name || null,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              meetingTitle: item.meeting_title,
              subject: item.subject,
              meetingDate: item.meeting_date,
              recordingLink: item.recording_link,
              calendarOwnerName: item.calendar_owner_name,
              isFinalized: item.is_finalized,
            },
          });
        }
      }

      // 3. Support Sessions
      const { data: supportSessions } = await supabase
        .from("support_room_sessions")
        .select(`
          *,
          staff:onboarding_staff!support_room_sessions_attended_by_fkey(id, name),
          project:onboarding_projects(
            id, product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (supportSessions) {
        for (const item of supportSessions) {
          const project = item.project as any;
          const company = project?.company as any;
          
          allActivities.push({
            id: `support_${item.id}`,
            type: "support",
            action: `support_${item.status}`,
            description: getSupportDescription(item),
            date: item.created_at,
            staffId: item.attended_by,
            staffName: (item.staff as any)?.name || null,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              clientName: item.client_name,
              status: item.status,
              startedAt: item.started_at,
              endedAt: item.ended_at,
              notes: item.notes,
            },
          });
        }
      }

      // 4. NPS Responses
      const { data: npsResponses } = await supabase
        .from("onboarding_nps_responses")
        .select(`
          *,
          project:onboarding_projects(
            id, product_name, consultant_id, cs_id,
            company:onboarding_companies(id, name),
            consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(id, name),
            cs:onboarding_staff!onboarding_projects_cs_id_fkey(id, name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (npsResponses) {
        for (const item of npsResponses) {
          const project = item.project as any;
          const company = project?.company as any;
          const consultant = project?.consultant as any;
          const cs = project?.cs as any;
          
          const staffName = consultant?.name || cs?.name || null;
          const staffId = project?.consultant_id || project?.cs_id || null;
          
          allActivities.push({
            id: `nps_${item.id}`,
            type: "nps",
            action: "nps_received",
            description: `NPS ${item.score} recebido${item.respondent_name ? ` de ${item.respondent_name}` : ""}`,
            date: item.created_at,
            staffId,
            staffName,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              score: item.score,
              feedback: item.feedback,
              respondentName: item.respondent_name,
              respondentEmail: item.respondent_email,
              whatCanImprove: item.what_can_improve,
              wouldRecommendWhy: item.would_recommend_why,
            },
          });
        }
      }

      // 5. Monthly Goals Changes
      const { data: goals } = await supabase
        .from("onboarding_monthly_goals")
        .select(`
          *,
          targetSetBy:onboarding_staff!onboarding_monthly_goals_target_set_by_fkey(id, name),
          resultSetBy:onboarding_staff!onboarding_monthly_goals_result_set_by_fkey(id, name),
          project:onboarding_projects(
            id, product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (goals) {
        for (const item of goals) {
          const project = item.project as any;
          const company = project?.company as any;
          
          if (item.target_set_at && item.sales_target) {
            allActivities.push({
              id: `goal_target_${item.id}`,
              type: "goal",
              action: "goal_target_set",
              description: `Definiu meta de ${formatCurrency(item.sales_target)} para ${getMonthName(item.month)}/${item.year}`,
              date: item.target_set_at,
              staffId: item.target_set_by,
              staffName: (item.targetSetBy as any)?.name || null,
              companyId: company?.id || null,
              companyName: company?.name || null,
              projectId: project?.id || null,
              projectName: project?.product_name || null,
              details: {
                month: item.month,
                year: item.year,
                salesTarget: item.sales_target,
              },
            });
          }
          
          if (item.result_set_at && item.sales_result !== null) {
            allActivities.push({
              id: `goal_result_${item.id}`,
              type: "goal",
              action: "goal_result_set",
              description: `Registrou resultado de ${formatCurrency(item.sales_result)} para ${getMonthName(item.month)}/${item.year}`,
              date: item.result_set_at,
              staffId: item.result_set_by,
              staffName: (item.resultSetBy as any)?.name || null,
              companyId: company?.id || null,
              companyName: company?.name || null,
              projectId: project?.id || null,
              projectName: project?.product_name || null,
              details: {
                month: item.month,
                year: item.year,
                salesResult: item.sales_result,
                salesTarget: item.sales_target,
              },
            });
          }
        }
      }

      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setActivities(allActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskHistoryDescription = (item: any): string => {
    switch (item.action) {
      case "status_change":
        return `Alterou status de "${item.old_value}" para "${item.new_value}"`;
      case "comment":
        return "Adicionou um comentário";
      case "edit":
        return `Editou ${item.field_changed || "tarefa"}`;
      case "assign":
        return `Atribuiu tarefa para ${item.new_value}`;
      case "create":
        return "Criou tarefa";
      default:
        return item.action;
    }
  };

  const getSupportDescription = (item: any): string => {
    switch (item.status) {
      case "waiting":
        return `Cliente ${item.client_name} entrou na sala de suporte`;
      case "active":
        return `Iniciou atendimento para ${item.client_name}`;
      case "completed":
        return `Finalizou suporte para ${item.client_name}`;
      case "cancelled":
        return `Suporte cancelado - ${item.client_name}`;
      default:
        return `Suporte para ${item.client_name}`;
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (dateFrom || dateTo) {
        const activityDateOnly = activity.date?.substring(0, 10);
        if (!activityDateOnly) return false;

        if (dateFrom && activityDateOnly < dateFrom) return false;
        if (dateTo && activityDateOnly > dateTo) return false;
      }

      if (selectedCompany !== "all" && activity.companyId !== selectedCompany) {
        return false;
      }

      if (selectedStaff !== "all" && activity.staffId !== selectedStaff) {
        return false;
      }

      if (staffNameSearch.trim()) {
        const searchLower = staffNameSearch.toLowerCase().trim();
        if (!activity.staffName?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      if (selectedType !== "all" && activity.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [activities, dateFrom, dateTo, selectedCompany, selectedStaff, selectedType, staffNameSearch]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: GroupedActivities = {};
    
    filteredActivities.forEach((activity) => {
      const dateKey = activity.date.substring(0, 10);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });
    
    return groups;
  }, [filteredActivities]);

  // Stats summary
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayActivities = filteredActivities.filter(a => a.date.substring(0, 10) === todayStr);
    
    const byType = {
      task_history: filteredActivities.filter(a => a.type === "task_history").length,
      meeting: filteredActivities.filter(a => a.type === "meeting").length,
      support: filteredActivities.filter(a => a.type === "support").length,
      nps: filteredActivities.filter(a => a.type === "nps").length,
      goal: filteredActivities.filter(a => a.type === "goal").length,
    };
    
    return {
      total: filteredActivities.length,
      today: todayActivities.length,
      byType,
    };
  }, [filteredActivities]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedCompany("all");
    setSelectedStaff("all");
    setSelectedType("all");
    setStaffNameSearch("");
  };

  const hasActiveFilters = dateFrom || dateTo || selectedCompany !== "all" || selectedStaff !== "all" || selectedType !== "all" || staffNameSearch.trim();

  // Navigate to activity's project/tab
  const handleActivityClick = (activity: ActivityItem) => {
    if (!activity.projectId) return;
    
    // Determine which tab or section to open based on activity type
    let tabParam = "";
    switch (activity.type) {
      case "task_history":
        // Navigate to project, tasks tab is default
        tabParam = "?tab=jornada";
        break;
      case "meeting":
        tabParam = "?tab=reunioes";
        break;
      case "support":
        tabParam = "?tab=suporte";
        break;
      case "nps":
        tabParam = "?tab=nps";
        break;
      case "goal":
        tabParam = "?tab=kpis";
        break;
      default:
        tabParam = "";
    }
    
    navigate(`/onboarding-tasks/${activity.projectId}${tabParam}`);
  };

  const getActivityIcon = (type: string, action: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case "task_history":
        if (action === "status_change") return <CheckCircle className={`${iconClass} text-emerald-500`} />;
        if (action === "comment") return <MessageSquare className={`${iconClass} text-blue-500`} />;
        if (action === "create") return <Plus className={`${iconClass} text-violet-500`} />;
        return <Edit className={`${iconClass} text-amber-500`} />;
      case "meeting":
        return <Calendar className={`${iconClass} text-indigo-500`} />;
      case "support":
        return <Headphones className={`${iconClass} text-rose-500`} />;
      case "nps":
        return <Star className={`${iconClass} text-yellow-500`} />;
      case "goal":
        return <Target className={`${iconClass} text-teal-500`} />;
      default:
        return <FileText className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const getActivityBgColor = (type: string, action: string) => {
    switch (type) {
      case "task_history":
        if (action === "status_change") return "bg-emerald-500/10 border-emerald-500/20";
        if (action === "comment") return "bg-blue-500/10 border-blue-500/20";
        if (action === "create") return "bg-violet-500/10 border-violet-500/20";
        return "bg-amber-500/10 border-amber-500/20";
      case "meeting":
        return "bg-indigo-500/10 border-indigo-500/20";
      case "support":
        return "bg-rose-500/10 border-rose-500/20";
      case "nps":
        return "bg-yellow-500/10 border-yellow-500/20";
      case "goal":
        return "bg-teal-500/10 border-teal-500/20";
      default:
        return "bg-muted/50 border-border";
    }
  };

  const getTypeBadge = (type: string) => {
    const baseClass = "text-xs font-medium px-2.5 py-1 rounded-full";
    switch (type) {
      case "task_history":
        return <span className={`${baseClass} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}>Tarefa</span>;
      case "meeting":
        return <span className={`${baseClass} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300`}>Reunião</span>;
      case "support":
        return <span className={`${baseClass} bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300`}>Suporte</span>;
      case "nps":
        return <span className={`${baseClass} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300`}>NPS</span>;
      case "goal":
        return <span className={`${baseClass} bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300`}>Meta</span>;
      default:
        return <span className={`${baseClass} bg-muted text-muted-foreground`}>Outro</span>;
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const getNPSColor = (score: number) => {
    if (score >= 9) return "text-emerald-500";
    if (score >= 7) return "text-amber-500";
    return "text-red-500";
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[600px] bg-muted/30 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700 shadow-sm">
                  <Activity className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-emerald-800 shadow-sm">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.today}</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-indigo-800 shadow-sm">
                  <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{stats.byType.meeting}</p>
                  <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80">Reuniões</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-rose-800 shadow-sm">
                  <Headphones className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{stats.byType.support}</p>
                  <p className="text-xs text-rose-600/80 dark:text-rose-400/80">Suportes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-yellow-800 shadow-sm">
                  <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.byType.nps}</p>
                  <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">NPS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 shadow-xl bg-gradient-to-b from-background to-muted/20">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-lg">Histórico de Atividades</span>
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  Acompanhe todas as ações da equipe em tempo real
                </p>
              </div>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchActivities} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Período:</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-9 w-36 text-sm bg-background"
                      />
                      <span className="text-muted-foreground">—</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-9 w-36 text-sm bg-background"
                      />
                    </div>

                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="h-9 w-[200px] text-sm bg-background">
                        <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas empresas</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Buscar usuário..."
                        value={staffNameSearch}
                        onChange={(e) => setStaffNameSearch(e.target.value)}
                        className="h-9 w-44 text-sm bg-background"
                      />
                    </div>

                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                      <SelectTrigger className="h-9 w-[180px] text-sm bg-background">
                        <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos usuários</SelectItem>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="h-9 w-[150px] text-sm bg-background">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos tipos</SelectItem>
                        <SelectItem value="task_history">Tarefas</SelectItem>
                        <SelectItem value="meeting">Reuniões</SelectItem>
                        <SelectItem value="support">Suporte</SelectItem>
                        <SelectItem value="nps">NPS</SelectItem>
                        <SelectItem value="goal">Metas</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-2 text-destructive hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Activity List - Grouped by Date */}
          <ScrollArea className="h-[600px] pr-4">
            {filteredActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg">Nenhuma atividade encontrada</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajuste os filtros para ver mais resultados
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedActivities).map(([dateKey, dayActivities], groupIndex) => (
                  <motion.div
                    key={dateKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIndex * 0.05 }}
                  >
                    {/* Date Header */}
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm font-medium text-muted-foreground capitalize px-3 py-1 bg-muted/50 rounded-full">
                          {getDateLabel(dateKey)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {dayActivities.length}
                        </Badge>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    </div>

                    {/* Activities for this date */}
                    <div className="space-y-2">
                      {dayActivities.map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => handleActivityClick(activity)}
                          className={`relative flex gap-4 p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${activity.projectId ? 'cursor-pointer hover:scale-[1.01]' : ''} ${getActivityBgColor(activity.type, activity.action)}`}
                        >
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            <div className="p-2 rounded-lg bg-background shadow-sm">
                              {getActivityIcon(activity.type, activity.action)}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  {getTypeBadge(activity.type)}
                                  {activity.staffName && (
                                    <span className="text-sm font-semibold">{activity.staffName}</span>
                                  )}
                                  {activity.companyName && (
                                    <Badge variant="outline" className="text-xs font-normal gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {activity.companyName}
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-foreground/90">{activity.description}</p>
                                
                                {activity.details?.taskTitle && (
                                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" />
                                    {activity.details.taskTitle}
                                  </p>
                                )}

                                {activity.type === "nps" && activity.details?.score !== undefined && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-2xl font-bold ${getNPSColor(activity.details.score)}`}>
                                      {activity.details.score}
                                    </span>
                                    {activity.details.feedback && (
                                      <p className="text-xs text-muted-foreground italic line-clamp-2">
                                        "{activity.details.feedback}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(activity.date), "HH:mm", { locale: ptBR })}
                                </span>
                                {activity.projectId && (
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getMonthName = (month: number): string => {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return months[month - 1] || "";
};
