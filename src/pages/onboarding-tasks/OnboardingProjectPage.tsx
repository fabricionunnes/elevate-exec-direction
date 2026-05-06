import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Users,
  MessageSquare,
  Calendar,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Pencil,
  Search,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManageUsersDialog } from "@/components/onboarding-tasks/ManageUsersDialog";
import { TaskDetailsDialog } from "@/components/onboarding-tasks/TaskDetailsDialog";
import { TicketsPanel } from "@/components/onboarding-tasks/TicketsPanel";
import { ProjectAIChat } from "@/components/onboarding-tasks/ProjectAIChat";
import { CompanyBriefingPanel } from "@/components/onboarding-tasks/CompanyBriefingPanel";
import { AdsBriefingSection } from "@/components/social/strategy/AdsBriefingSection";
import { StrategicDiagnosticModule } from "@/components/client-diagnostic/StrategicDiagnosticModule";
import { GenerateTasksDialog } from "@/components/onboarding-tasks/GenerateTasksDialog";
import { GeneratePDFTasksDialog } from "@/components/onboarding-tasks/GeneratePDFTasksDialog";
import { Settings, Sparkles, Building2, Wand2, UserCircle, Route, LayoutList, CalendarDays, LogOut, FileUp, BarChart3 as PanelIcon, Columns3 } from "lucide-react";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { ChurnReasonDialog } from "@/components/onboarding-tasks/ChurnReasonDialog";
import { NoticePeriodDialog } from "@/components/onboarding-tasks/NoticePeriodDialog";

import { RealtimeNotifications } from "@/components/onboarding-tasks/RealtimeNotifications";
import { TasksGameTrailView } from "@/components/onboarding-tasks/TasksGameTrailView";
import { TasksListView } from "@/components/onboarding-tasks/TasksListView";
import { TasksScheduleView } from "@/components/onboarding-tasks/TasksScheduleView";
import { TasksPanelView } from "@/components/onboarding-tasks/TasksPanelView";
import { TasksKanbanView } from "@/components/onboarding-tasks/TasksKanbanView";
import { AddTaskDialog } from "@/components/onboarding-tasks/AddTaskDialog";
import { NPSHistoryPanel } from "@/components/onboarding-tasks/NPSHistoryPanel";
import { ProjectUrgentTasks } from "@/components/onboarding-tasks/ProjectUrgentTasks";
import { TasksFilterBar, TaskStatusFilter, TaskSortOrder } from "@/components/onboarding-tasks/TasksFilterBar";
import { parseDateLocal, getTodayLocal } from "@/lib/dateUtils";
import { GoalProjectionAlertDialog } from "@/components/onboarding-tasks/GoalProjectionAlertDialog";
import { ReorganizeTasksDatesDialog } from "@/components/onboarding-tasks/ReorganizeTasksDatesDialog";
import { ProjectSupportBanner } from "@/components/onboarding-tasks/ProjectSupportBanner";
import { SupportHistoryPanel } from "@/components/onboarding-tasks/SupportHistoryPanel";
import { MeetingHistoryPanel } from "@/components/onboarding-tasks/MeetingHistoryPanel";
import { AssessmentsPanel } from "@/components/assessments/AssessmentsPanel";
import { KPIMetasPanel } from "@/components/onboarding-tasks/kpis/KPIMetasPanel";
import { CSATConfigPanel } from "@/components/onboarding-tasks/CSATConfigPanel";
import { HealthScoreWidget } from "@/components/onboarding-tasks/health-score/HealthScoreWidget";
import { HealthScoreDetailPanel } from "@/components/onboarding-tasks/health-score/HealthScoreDetailPanel";
import { TrendingUp, Headphones, Video, Brain, BarChart3, FolderOpen, ExternalLink, Star, Heart, Trophy, Briefcase, Instagram, Target } from "lucide-react";
import { GoogleDriveConnect } from "@/components/onboarding-tasks/GoogleDriveConnect";
import { Label } from "@/components/ui/label";
import { Ticket } from "lucide-react";
import { HRRecruitmentPanel } from "@/components/hr-recruitment/HRRecruitmentPanel";
import { ClientVirtualBoard } from "@/components/onboarding-tasks/ClientVirtualBoard";
import { ClientFinancialModule } from "@/components/client-financial/ClientFinancialModule";
import { ClientAccessHistory } from "@/components/onboarding-tasks/ClientAccessHistory";
import { ProjectHistoryPanel } from "@/components/onboarding-tasks/ProjectHistoryPanel";
import { ProjectMenuPermissionsDialog } from "@/components/onboarding-tasks/ProjectMenuPermissionsDialog";
import { Wallet, Eye, LayoutGrid, Megaphone } from "lucide-react";
import { ClientPaidTrafficPanel } from "@/components/client-portal/ClientPaidTrafficPanel";
import { CommercialActionsPanel } from "@/components/commercial-actions/CommercialActionsPanel";
import { RoutineContractPanel } from "@/components/routine-contract/RoutineContractPanel";
import { ClipboardList, Filter as FunnelIcon } from "lucide-react";
import { SalesFunnelPanel } from "@/components/sales-funnel/SalesFunnelPanel";
import { ClientInstagramModule } from "@/components/client-instagram/ClientInstagramModule";
import { BrainCircuit } from "lucide-react";
import { CommercialDirectorModule } from "@/components/commercial-director/CommercialDirectorModule";
import { TransferTasksDialog } from "@/components/onboarding-tasks/TransferTasksDialog";
import { ProjectWhatsAppTab } from "@/components/whatsapp-hub/ProjectWhatsAppTab";
import { DollarSign } from "lucide-react";
import { SFCommissionsPanel } from "@/components/sf-commissions/SFCommissionsPanel";

// Support Tab with sub-tabs
const SupportTabContent = ({ projectId, users }: { projectId: string; users: OnboardingUser[] }) => {
  const [supportSubTab, setSupportSubTab] = useState<"history" | "tickets">("history");
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-3">
        <Button
          variant={supportSubTab === "history" ? "default" : "outline"}
          size="sm"
          onClick={() => setSupportSubTab("history")}
          className="gap-2"
        >
          <Headphones className="h-4 w-4" />
          Suportes
        </Button>
        <Button
          variant={supportSubTab === "tickets" ? "default" : "outline"}
          size="sm"
          onClick={() => setSupportSubTab("tickets")}
          className="gap-2"
        >
          <Ticket className="h-4 w-4" />
          Chamados
        </Button>
      </div>
      
      {supportSubTab === "history" ? (
        <SupportHistoryPanel projectId={projectId} />
      ) : (
        <TicketsPanel projectId={projectId} users={users} />
      )}
    </div>
  );
};

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed" | "inactive";
  assignee_id: string | null;
  observations: string | null;
  sort_order: number;
  priority: string | null;
  tags: string[] | null;
  recurrence: string | null;
  template_id: string | null;
  is_internal?: boolean;
  assignee?: { id: string; name: string; role: string };
  responsible_staff?: { id: string; name: string } | null;
}

import type { OnboardingUser } from "@/types/onboarding";

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  current_nps: number | null;
  onboarding_company_id: string | null;
  onboarding_company?: { name: string; segment?: string | null } | null;
  consultant_id: string | null;
  cs_id: string | null;
  crm_link: string | null;
  crm_login: string | null;
  crm_password: string | null;
  documents_link: string | null;
}

interface TaskPhase {
  name: string;
  order: number;
  tasks: OnboardingTask[];
  completedCount: number;
}

const PHASE_COLORS: Record<string, string> = {
  "Pré-Onboarding": "bg-blue-500",
  "Onboarding & Setup": "bg-sky-500",
  "Diagnóstico Comercial": "bg-yellow-500",
  "Desenho do Processo": "bg-orange-500",
  "Implementação CRM": "bg-green-500",
  "Playbook & Padronização": "bg-purple-500",
  "Treinamento & Adoção": "bg-pink-500",
  "Estabilização & Governança": "bg-stone-500",
};

const PHASE_EMOJIS: Record<string, string> = {
  "Pré-Onboarding": "🔵",
  "Onboarding & Setup": "🟦",
  "Diagnóstico Comercial": "🟨",
  "Desenho do Processo": "🟧",
  "Implementação CRM": "🟩",
  "Playbook & Padronização": "🟪",
  "Treinamento & Adoção": "🟫",
  "Estabilização & Governança": "🤎",
};

const OnboardingProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("kpis");
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "cs" | "consultant" | "client" | "rh" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [isStaffAdmin, setIsStaffAdmin] = useState(false);
  const [showGenerateTasksDialog, setShowGenerateTasksDialog] = useState(false);
  const [showPDFTasksDialog, setShowPDFTasksDialog] = useState(false);
  const [tasksViewMode, setTasksViewMode] = useState<"trail" | "list" | "schedule" | "panel" | "kanban">("trail");
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>("all");
  const [taskSortOrder, setTaskSortOrder] = useState<TaskSortOrder>("due_date_asc");
  const [taskResponsibleFilter, setTaskResponsibleFilter] = useState("all");
  const [showReorganizeDatesDialog, setShowReorganizeDatesDialog] = useState(false);
  const [showChurnDialog, setShowChurnDialog] = useState(false);
  const [showCancellationSignalDialog, setShowCancellationSignalDialog] = useState(false);
  const [showNoticePeriodDialog, setShowNoticePeriodDialog] = useState(false);
  const [noticePeriodLoading, setNoticePeriodLoading] = useState(false);
  const [churnLoading, setChurnLoading] = useState(false);
  const [cancellationSignalLoading, setCancellationSignalLoading] = useState(false);
  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [crmDialogMode, setCrmDialogMode] = useState<"view" | "edit">("view");
  const [showDocsDialog, setShowDocsDialog] = useState(false);
  const [crmLinkInput, setCrmLinkInput] = useState("");
  const [crmLoginInput, setCrmLoginInput] = useState("");
  const [crmPasswordInput, setCrmPasswordInput] = useState("");
  const [docsLinkInput, setDocsLinkInput] = useState("");
  const [kpiDefaultTab, setKpiDefaultTab] = useState<string | undefined>(undefined);
  const [showProjectMenuPermissions, setShowProjectMenuPermissions] = useState(false);
  const [transferTaskIds, setTransferTaskIds] = useState<string[]>([]);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  // Check for attention/risk alerts when opening project
  const checkProjectAlerts = async () => {
    if (!projectId) return;

    try {
      // Fetch project NPS
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("current_nps, product_name, onboarding_company_id, onboarding_company:onboarding_companies(name)")
        .eq("id", projectId)
        .single();

      if (!projectData) return;

      const currentNps = projectData.current_nps;
      const companyName = projectData.onboarding_company?.name || projectData.product_name;

      // Check for overdue invoices
      if (projectData.onboarding_company_id) {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const { data: overdueInvoices } = await supabase
          .from("company_invoices")
          .select("due_date, description")
          .eq("company_id", projectData.onboarding_company_id)
          .eq("status", "pending")
          .lt("due_date", todayStr)
          .order("due_date", { ascending: true })
          .limit(5);

        if (overdueInvoices && overdueInvoices.length > 0) {
          const today = new Date(todayStr + "T12:00:00");
          const oldestDue = new Date(overdueInvoices[0].due_date + "T12:00:00");
          const maxDaysLate = Math.floor((today.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24));
          const totalOverdue = overdueInvoices.length;

          toast.error(`💰 INADIMPLÊNCIA: ${companyName}`, {
            description: `${totalOverdue} ${totalOverdue === 1 ? 'parcela em atraso' : 'parcelas em atraso'} — até ${maxDaysLate} ${maxDaysLate === 1 ? 'dia' : 'dias'} de atraso`,
            duration: 15000,
          });
        }
      }

      // Calculate goal projection for current month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const { data: goalData } = await supabase
        .from("onboarding_monthly_goals")
        .select("sales_target, sales_result")
        .eq("project_id", projectId)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .single();

      let projectionPercent: number | null = null;

      if (goalData?.sales_target && goalData.sales_target > 0) {
        const result = goalData.sales_result || 0;
        const target = goalData.sales_target;
        
        // Calculate time progression
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const currentDay = now.getDate();
        const timeProgress = currentDay / daysInMonth;
        
        // Calculate weighted projection
        if (timeProgress > 0) {
          projectionPercent = ((result / target) / timeProgress) * 100;
        }
      }

      // Check for RISK condition (more severe) - NPS < 7 AND projection < 50%
      const isRisk = (currentNps !== null && currentNps < 7) && 
                     (projectionPercent !== null && projectionPercent < 50);

      // Check for ATTENTION condition - NPS < 8 OR projection < 80%
      const isAttention = !isRisk && (
        (currentNps !== null && currentNps < 8) ||
        (projectionPercent !== null && projectionPercent < 80)
      );

      if (isRisk) {
        const reasons = [];
        if (currentNps !== null && currentNps < 7) reasons.push(`NPS ${currentNps}`);
        if (projectionPercent !== null && projectionPercent < 50) reasons.push(`Projeção ${Math.round(projectionPercent)}%`);
        
        toast.error(`🚨 EMPRESA EM RISCO: ${companyName}`, {
          description: `Indicadores críticos: ${reasons.join(" | ")}`,
          duration: 15000,
        });
      } else if (isAttention) {
        const reasons = [];
        if (currentNps !== null && currentNps < 8) reasons.push(`NPS ${currentNps}`);
        if (projectionPercent !== null && projectionPercent < 80) reasons.push(`Projeção ${Math.round(projectionPercent)}%`);
        
        toast.warning(`⚠️ PONTO DE ATENÇÃO: ${companyName}`, {
          description: `Indicadores: ${reasons.join(" | ")}`,
          duration: 10000,
        });
      }
    } catch (error) {
      console.error("Error checking project alerts:", error);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      fetchStaffList();
    }
  }, [projectId]);

  // Always check overdue alerts on mount (every time user enters the project)
  useEffect(() => {
    if (projectId) {
      checkProjectAlerts();
    }
  }, []);

  // Real-time subscription for task updates
  useEffect(() => {
    if (!projectId) return;

    const tasksChannel = supabase
      .channel(`staff-tasks-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_tasks',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('Task change received (staff):', payload);
          fetchProjectData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [projectId]);

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .eq("is_active", true)
      .order("name");
    setStaffList(data || []);
  };

  // Open task from notification link
  useEffect(() => {
    const state = location.state as { openTaskId?: string } | null;
    if (state?.openTaskId && tasks.length > 0) {
      const taskToOpen = tasks.find(t => t.id === state.openTaskId);
      if (taskToOpen) {
        setSelectedTask(taskToOpen);
        // Clear the state so it doesn't reopen on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [tasks, location.state]);

  const fetchProjectData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      let staffId: string | null = null;
      let staffRole: string | null = null;
      
      if (user) {
        // Check if user is staff admin
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .single();
        
        if (staffMember) {
          staffId = staffMember.id;
          staffRole = staffMember.role;
          setCurrentUserId(staffMember.id);
          if (staffMember.role === "admin" || staffMember.role === "master") {
            setIsStaffAdmin(true);
            setCurrentUserRole("admin");
          } else {
            setCurrentUserRole(staffMember.role as "cs" | "consultant" | "rh");
          }
        } else {
          const { data: onboardingUser } = await supabase
            .from("onboarding_users")
            .select("id, role")
            .eq("user_id", user.id)
            .eq("project_id", projectId)
            .single();
          
          if (onboardingUser) {
            setCurrentUserId(onboardingUser.id);
            setCurrentUserRole(onboardingUser.role as "admin" | "cs" | "consultant" | "client" | "rh");
          }
        }
      }

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("onboarding_projects")
        .select(`*, onboarding_company_id, current_nps, crm_link, crm_login, crm_password, documents_link, consultant_id, cs_id, onboarding_company:onboarding_companies(name, segment, consultant_id, cs_id)`)
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      
      // For consultants, verify they have access to this project
      if (staffRole === "consultant" && staffId) {
        const projectConsultantId = projectData.consultant_id;
        const projectCsId = projectData.cs_id;
        const companyConsultantId = projectData.onboarding_company?.consultant_id;
        const companyCsId = projectData.onboarding_company?.cs_id;
        
        const hasAccess = 
          projectConsultantId === staffId ||
          projectCsId === staffId ||
          companyConsultantId === staffId ||
          companyCsId === staffId;
        
        if (!hasAccess) {
          toast.error("Você não tem acesso a este projeto");
          navigate("/onboarding-tasks");
          return;
        }
      }
      
      setProject(projectData);

      // Fetch tasks with responsible staff
      const { data: tasksData, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select(`
          *,
          assignee:onboarding_users(id, name, role, avatar_url),
          responsible_staff:onboarding_staff(id, name, avatar_url)
        `)
        .eq("project_id", projectId)
        .neq("status", "inactive")
        .order("sort_order");

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

      // Set all phases as expanded by default
      const phases = new Set(tasksData?.map(t => t.tags?.[0] || "Sem fase").filter(Boolean) as string[]);
      setExpandedPhases(phases);

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("onboarding_users")
        .select("*")
        .eq("project_id", projectId);

      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error: any) {
      console.error("Error fetching project:", error);
      toast.error("Erro ao carregar projeto");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddTaskDialog = () => {
    setShowAddTaskDialog(true);
  };

  const handleTaskAddedFromDialog = () => {
    setNewTaskTitle("");
    fetchProjectData();
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em andamento";
      case "completed":
        return "Concluída";
      default:
        return status;
    }
  };

  const logTaskHistory = async (params: {
    taskId: string;
    action: string;
    fieldChanged?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  }) => {
    if (!currentUserId) return;

    const isStaffActor = isStaffAdmin || currentUserRole === "admin" || currentUserRole === "cs" || currentUserRole === "consultant";

    const insertData: any = {
      task_id: params.taskId,
      action: params.action,
      field_changed: params.fieldChanged ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
    };

    if (isStaffActor) {
      insertData.staff_id = currentUserId;
    } else {
      insertData.user_id = currentUserId;
    }

    const { error } = await supabase.from("onboarding_task_history").insert(insertData);
    if (error) {
      console.error("Error logging task history:", error);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: "pending" | "in_progress" | "completed") => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      
      // Validate: cannot set in_progress or completed without a responsible (assignee)
      if ((newStatus === "in_progress" || newStatus === "completed") && !task?.assignee_id) {
        toast.error("Atribua um responsável antes de alterar o status da tarefa");
        return;
      }
      
      const updates: any = { status: newStatus };

      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }

      const { error, count } = await supabase.from("onboarding_tasks").update(updates).eq("id", taskId);
      if (error) throw error;

      console.log("[handleStatusChange] Task updated successfully:", taskId, "->", newStatus);

      // Log history (non-blocking)
      if (task && task.status !== newStatus) {
        logTaskHistory({
          taskId,
          action: "status_change",
          fieldChanged: "status",
          oldValue: getStatusLabel(task.status),
          newValue: getStatusLabel(newStatus),
        }).catch(err => console.warn("Failed to log task history:", err));
      }

      // Sync meeting (non-blocking)
      if (newStatus === "completed") {
        (async () => {
          try {
            const { data: taskWithMeetingLink } = await supabase
              .from("onboarding_tasks")
              .select("meeting_link")
              .eq("id", taskId)
              .maybeSingle();

            if (taskWithMeetingLink?.meeting_link) {
              const { data: meetingToFinalize } = await supabase
                .from("onboarding_meeting_notes")
                .select("id, is_finalized")
                .eq("project_id", projectId)
                .eq("meeting_link", taskWithMeetingLink.meeting_link)
                .maybeSingle();

              if (meetingToFinalize && !meetingToFinalize.is_finalized) {
                await supabase
                  .from("onboarding_meeting_notes")
                  .update({
                    is_finalized: true,
                    notes: "Reunião finalizada automaticamente ao concluir tarefa.",
                  })
                  .eq("id", meetingToFinalize.id);
              }
            }
          } catch (err) {
            console.warn("Failed to sync meeting:", err);
          }
        })();
      }

      await fetchProjectData();
      console.log("[handleStatusChange] Data refreshed after status change");

      if (task?.recurrence && newStatus === "completed") {
        toast.success("Tarefa concluída! Nova tarefa recorrente criada automaticamente.");
      }
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    // isStaffAdmin is already set to true for both admin and master roles
    if (!isStaffAdmin) {
      toast.error("Apenas administradores podem excluir tarefas");
      return;
    }
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
      fetchProjectData();
      toast.success("Tarefa removida");
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error("Erro ao remover tarefa");
    }
  };

  const handleDeleteProject = async () => {
    if (!isStaffAdmin) {
      toast.error("Apenas administradores podem excluir projetos");
      return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir o projeto "${project?.product_name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    try {
      // Delete related data first
      await supabase.from("onboarding_tasks").delete().eq("project_id", projectId);
      await supabase.from("onboarding_tickets").delete().eq("project_id", projectId);
      await supabase.from("onboarding_users").delete().eq("project_id", projectId);
      await supabase.from("onboarding_ai_chat").delete().eq("project_id", projectId);
      
      // Delete the project
      const { error } = await supabase
        .from("onboarding_projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;
      
      toast.success("Projeto excluído com sucesso");
      navigate("/onboarding-tasks");
    } catch (error: any) {
      console.error("Error deleting project:", error);
      toast.error("Erro ao excluir projeto");
    }
  };

  const handleProjectStatusChange = (value: string) => {
    if (value === "closed") {
      setShowChurnDialog(true);
    } else if (value === "cancellation_signaled") {
      setShowCancellationSignalDialog(true);
    } else if (value === "notice_period") {
      setShowNoticePeriodDialog(true);
    } else {
      handleProjectUpdate("status", value);
    }
  };

  const handleCancellationSignalConfirm = async (reason: string, notes: string) => {
    if (!projectId) return;
    setCancellationSignalLoading(true);
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({
          status: "cancellation_signaled",
          cancellation_signal_reason: reason,
          cancellation_signal_notes: notes,
          cancellation_signal_date: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (error) throw error;
      setProject(prev => prev ? { 
        ...prev, 
        status: "cancellation_signaled",
      } : null);
      setShowCancellationSignalDialog(false);
      toast.success("Projeto alterado para Sinalizou Cancelamento");
    } catch (error) {
      console.error("Error updating project to cancellation signaled:", error);
      toast.error("Erro ao atualizar projeto");
    } finally {
      setCancellationSignalLoading(false);
    }
  };

  const handleNoticePeriodConfirm = async (endDate: Date) => {
    if (!projectId) return;
    setNoticePeriodLoading(true);
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({
          status: "notice_period",
          notice_end_date: endDate.toISOString().split('T')[0],
        })
        .eq("id", projectId);

      if (error) throw error;
      setProject(prev => prev ? { 
        ...prev, 
        status: "notice_period",
      } : null);
      setShowNoticePeriodDialog(false);
      toast.success("Projeto alterado para Cumprindo Aviso");
    } catch (error) {
      console.error("Error updating project to notice period:", error);
      toast.error("Erro ao atualizar projeto");
    } finally {
      setNoticePeriodLoading(false);
    }
  };

  const handleChurnConfirm = async (reason: string, notes: string) => {
    if (!projectId) return;
    setChurnLoading(true);
    try {
      // Update project status to closed
      const { error } = await supabase
        .from("onboarding_projects")
        .update({
          status: "closed",
          churn_reason: reason,
          churn_notes: notes,
          churn_date: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (error) throw error;

      // Check if company has any other active projects
      if (project?.onboarding_company_id) {
        const { data: otherProjects, error: projectsError } = await supabase
          .from("onboarding_projects")
          .select("id, status")
          .eq("onboarding_company_id", project.onboarding_company_id)
          .neq("id", projectId);

        if (!projectsError && otherProjects) {
          // Check if all other projects are also closed/completed
          const hasActiveProjects = otherProjects.some(p => 
            p.status !== "closed" && p.status !== "completed"
          );

          // If no active projects remain, set company to inactive
          if (!hasActiveProjects) {
            const { error: companyError } = await supabase
              .from("onboarding_companies")
              .update({ status: "inactive" })
              .eq("id", project.onboarding_company_id);

            if (companyError) {
              console.error("Error updating company status:", companyError);
            } else {
              toast.info("Empresa marcada como inativa (sem projetos ativos)");
            }
          }
        }
      }

      setProject(prev => prev ? { 
        ...prev, 
        status: "closed",
      } : null);
      setShowChurnDialog(false);
      toast.success("Projeto encerrado");
      
      // Redirect to Distrato page with pre-filled data
      navigate(`/distrato?company_id=${project?.onboarding_company_id}&project_id=${projectId}`);
    } catch (error) {
      console.error("Error closing project:", error);
      toast.error("Erro ao encerrar projeto");
    } finally {
      setChurnLoading(false);
    }
  };

  const handleProjectUpdate = async (field: string, value: string | null) => {
    if (!projectId) return;
    try {
      const updateData: Record<string, string | null> = { [field]: value };
      
      // Check if reactivating from cancellation status
      if (field === "status" && value === "active") {
        const currentStatus = project?.status;
        if (currentStatus === "cancellation_signaled" || currentStatus === "notice_period") {
          updateData.reactivated_at = new Date().toISOString();
        }
      }
      
      const { error } = await supabase
        .from("onboarding_projects")
        .update(updateData)
        .eq("id", projectId);
      
      if (error) throw error;
      
      // If status changed to completed, check if company should be inactivated
      if (field === "status" && value === "completed" && project?.onboarding_company_id) {
        const { data: otherProjects } = await supabase
          .from("onboarding_projects")
          .select("id, status")
          .eq("onboarding_company_id", project.onboarding_company_id)
          .neq("id", projectId);

        if (otherProjects) {
          const hasActiveProjects = otherProjects.some(p => 
            p.status !== "closed" && p.status !== "completed"
          );

          if (!hasActiveProjects) {
            await supabase
              .from("onboarding_companies")
              .update({ status: "inactive" })
              .eq("id", project.onboarding_company_id);
            toast.info("Empresa marcada como inativa (sem projetos ativos)");
          }
        }
      }
      
      // If status changed to active, ensure company is also active
      if (field === "status" && value === "active" && project?.onboarding_company_id) {
        await supabase
          .from("onboarding_companies")
          .update({ status: "active" })
          .eq("id", project.onboarding_company_id);
      }
      
      setProject(prev => prev ? { ...prev, ...updateData } : null);
      toast.success("Projeto atualizado");
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Erro ao atualizar projeto");
    }
  };

  const togglePhase = (phaseName: string) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseName)) {
        newSet.delete(phaseName);
      } else {
        newSet.add(phaseName);
      }
      return newSet;
    });
  };

  const handlePhaseRename = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    try {
      // Find all tasks in this project with tags[0] === oldName
      // "Sem fase" is a UI label for tasks with no tags/empty tags
      const tasksToUpdate = oldName === "Sem fase"
        ? tasks.filter(t => !t.tags || t.tags.length === 0 || !t.tags[0])
        : tasks.filter(t => t.tags?.[0] === oldName);
      for (const task of tasksToUpdate) {
        const newTags = [trimmed, ...(task.tags?.slice(1) || [])];
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({ tags: newTags })
          .eq("id", task.id);
        if (error) throw error;
      }
      toast.success(`Fase renomeada para "${trimmed}"`);
      fetchProjectData();
    } catch (error) {
      console.error("Error renaming phase:", error);
      toast.error("Erro ao renomear fase");
    }
  };

  const isAdmin = isStaffAdmin || currentUserRole === "admin";
  const canAddTasks = isAdmin || currentUserRole === "cs" || currentUserRole === "consultant";
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-xs">Média</Badge>;
      case "low":
        return <Badge variant="outline" className="text-xs">Baixa</Badge>;
      default:
        return null;
    }
  };

  const getResponsibleBadge = (role: string | null) => {
    switch (role) {
      case "cs":
        return <Badge className="bg-blue-500 text-xs">CS</Badge>;
      case "consultant":
        return <Badge className="bg-purple-500 text-xs">Consultor</Badge>;
      case "client":
        return <Badge variant="outline" className="text-xs">Cliente</Badge>;
      default:
        return null;
    }
  };

  // Helper function to check if a task is overdue
  const isTaskOverdue = (task: OnboardingTask): boolean => {
    if (task.status === "completed" || !task.due_date) return false;
    const today = getTodayLocal();
    const dueDate = parseDateLocal(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Calculate task counts for filter badges
  const taskCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    overdue: tasks.filter(t => isTaskOverdue(t)).length,
  };

  // Group tasks by phase (stored in tags[0], order in tags[1] or by first task sort_order)
  // Filter tasks based on search query AND status filter
  const filteredTasks = tasks.filter(task => {
    // Search filter
    const matchesSearch = !taskSearchQuery.trim() ||
      task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(taskSearchQuery.toLowerCase());
    
    // Status filter
    let matchesStatus = true;
    switch (taskStatusFilter) {
      case "pending":
        matchesStatus = task.status === "pending";
        break;
      case "in_progress":
        matchesStatus = task.status === "in_progress";
        break;
      case "completed":
        matchesStatus = task.status === "completed";
        break;
      case "overdue":
        matchesStatus = isTaskOverdue(task);
        break;
      case "all":
      default:
        matchesStatus = true;
    }
    
    // Responsible filter
    let matchesResponsible = true;
    if (taskResponsibleFilter === "unassigned") {
      matchesResponsible = !task.responsible_staff?.id;
    } else if (taskResponsibleFilter && taskResponsibleFilter !== "all") {
      matchesResponsible = task.responsible_staff?.id === taskResponsibleFilter;
    }

    return matchesSearch && matchesStatus && matchesResponsible;
  });

  const groupedTasks = filteredTasks.reduce<Record<string, TaskPhase>>((acc, task) => {
    const phaseName = task.tags?.[0] || "Sem fase";
    const phaseOrder = task.tags?.[1] ? parseInt(task.tags[1]) : undefined;
    
    if (!acc[phaseName]) {
      acc[phaseName] = {
        name: phaseName,
        order: phaseOrder ?? task.sort_order,
        tasks: [],
        completedCount: 0,
      };
    }
    
    acc[phaseName].tasks.push(task);
    if (task.status === "completed") {
      acc[phaseName].completedCount++;
    }
    
    return acc;
  }, {});

  // Sort phases by order (from tags[1]), then by earliest due_date as fallback
  const sortedPhases = Object.values(groupedTasks)
    .map(phase => {
      // Calculate the earliest due_date for this phase
      const earliestDueDate = phase.tasks.reduce((earliest, task) => {
        if (!task.due_date) return earliest;
        const taskDate = parseDateLocal(task.due_date).getTime();
        return earliest === Infinity ? taskDate : Math.min(earliest, taskDate);
      }, Infinity);
      
      return {
        ...phase,
        earliestDueDate,
        tasks: phase.tasks.slice().sort((ta, tb) => {
          // Sort by due_date based on selected sort order
          const dueDateA = ta.due_date ? parseDateLocal(ta.due_date).getTime() : (taskSortOrder === "due_date_asc" ? Infinity : -Infinity);
          const dueDateB = tb.due_date ? parseDateLocal(tb.due_date).getTime() : (taskSortOrder === "due_date_asc" ? Infinity : -Infinity);
          
          if (dueDateA !== dueDateB) {
            return taskSortOrder === "due_date_asc" 
              ? dueDateA - dueDateB 
              : dueDateB - dueDateA;
          }
          return ta.sort_order - tb.sort_order;
        }),
      };
    })
    .sort((a, b) => {
      // First sort by phase order if both have defined orders
      if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
        return a.order - b.order;
      }
      // If order is undefined or equal, use earliest due date
      return taskSortOrder === "due_date_asc" 
        ? a.earliestDueDate - b.earliestDueDate
        : b.earliestDueDate - a.earliestDueDate;
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Projeto não encontrado</h2>
          <Button onClick={() => navigate("/onboarding-tasks")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Realtime notifications for staff */}
      <RealtimeNotifications />
      
      {/* Goal Projection Alert Dialog */}
      {projectId && project && (
        <GoalProjectionAlertDialog
          projectId={projectId}
          companyName={project.onboarding_company?.name || project.product_name}
          isStaff={true}
          onNavigateToGoals={() => {
            setKpiDefaultTab("config");
            setActiveTab("kpis");
          }}
        />
      )}
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Support Banner - Shows when client is waiting */}
        {projectId && <ProjectSupportBanner projectId={projectId} />}
        
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="flex flex-col min-w-0 flex-1">
                <NexusHeader />
                {project.onboarding_company?.name && (
                  <p className="text-xs sm:text-sm text-muted-foreground ml-11 sm:ml-14 truncate">{project.onboarding_company.name}</p>
                )}
              </div>
            </div>
            
            {/* Mobile Actions Menu */}
            <div className="flex sm:hidden items-center shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-background">
                  {currentUserRole && currentUserRole !== "client" && (
                    <>
                      <DropdownMenuItem onClick={() => setShowPDFTasksDialog(true)}>
                        <FileUp className="h-4 w-4 mr-2" />
                        Plano via PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowGenerateTasksDialog(true)}>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Gerar Tarefas
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setShowUsersDialog(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Usuários ({users.length})
                  </DropdownMenuItem>
                  {isStaffAdmin && (
                    <DropdownMenuItem onClick={() => setShowProjectMenuPermissions(true)}>
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Menus do Projeto
                    </DropdownMenuItem>
                  )}
                  {isStaffAdmin && (
                    <DropdownMenuItem onClick={handleDeleteProject} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Projeto
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={async () => {
                    await supabase.auth.signOut();
                    navigate("/onboarding-tasks/login");
                  }}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {currentUserRole && currentUserRole !== "client" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowPDFTasksDialog(true)}>
                    <FileUp className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Plano via PDF</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowGenerateTasksDialog(true)}>
                    <Wand2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Gerar Tarefas</span>
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowUsersDialog(true)}>
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Usuários ({users.length})</span>
              </Button>
              {isStaffAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowProjectMenuPermissions(true)}>
                  <LayoutGrid className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Menus do Projeto</span>
                </Button>
              )}
              {isStaffAdmin && (
                <Button 
                  variant="destructive" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleDeleteProject}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/onboarding-tasks/login");
                }}
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action buttons row - mobile optimized */}
          {project.onboarding_company?.name && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:pl-14">
              {project.onboarding_company_id && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    onClick={() => navigate(`/onboarding-tasks/companies/${project.onboarding_company_id}`)}
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    <span className="hidden xs:inline">Ver </span>Empresa
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    onClick={() => navigate(`/customer-points/${project.onboarding_company_id}`)}
                  >
                    <Trophy className="h-3 w-3 mr-1" />
                    Pontuação
                  </Button>
                </>
              )}
              {/* UNV Social is now a tab, removed standalone button */}
              {/* CRM Button */}
              {project.crm_link ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setCrmLinkInput(project.crm_link || "");
                    setCrmLoginInput(project.crm_login || "");
                    setCrmPasswordInput(project.crm_password || "");
                    setCrmDialogMode("view");
                    setShowCrmDialog(true);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  CRM
                </Button>
              ) : currentUserRole && currentUserRole !== "client" && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setCrmLinkInput("");
                    setCrmLoginInput("");
                    setCrmPasswordInput("");
                    setCrmDialogMode("edit");
                    setShowCrmDialog(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  CRM
                </Button>
              )}
              {/* Documentos Button */}
              {project.documents_link ? (
                <div className="flex items-center gap-0.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    onClick={() => window.open(project.documents_link!, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    <span className="hidden xs:inline">Documentos</span>
                    <span className="xs:hidden">Docs</span>
                  </Button>
                  {currentUserRole && currentUserRole !== "client" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setDocsLinkInput(project.documents_link || "");
                        setShowDocsDialog(true);
                      }}
                      title="Editar link dos documentos"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Google Drive Connect */}
                  <GoogleDriveConnect
                    projectId={projectId!}
                    documentsLink={project.documents_link}
                    onConnectionChange={() => {
                      // Optionally refresh project data
                    }}
                  />
                </div>
              ) : currentUserRole && currentUserRole !== "client" && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setDocsLinkInput("");
                    setShowDocsDialog(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <span className="hidden xs:inline">Documentos</span>
                  <span className="xs:hidden">Docs</span>
                </Button>
              )}
            </div>
          )}

          {/* Project Settings Row - Only for admin/cs */}
          {(isAdmin || currentUserRole === "cs") && (
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-4 sm:pl-14">
              <div className="flex items-center gap-2 min-w-fit">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap w-20 sm:w-auto">Status:</span>
                <Select 
                  value={project.status} 
                  onValueChange={handleProjectStatusChange}
                >
                  <SelectTrigger className="flex-1 sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="cancellation_signaled">Sinalizou Cancelamento</SelectItem>
                    <SelectItem value="notice_period">Cumprindo Aviso</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 min-w-fit">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap w-20 sm:w-auto">Consultor:</span>
                <Select 
                  value={project.consultant_id || "none"} 
                  onValueChange={(value) => handleProjectUpdate("consultant_id", value === "none" ? null : value)}
                >
                  <SelectTrigger className="flex-1 sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 min-w-fit">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap w-20 sm:w-auto">CS:</span>
                <Select 
                  value={project.cs_id || "none"} 
                  onValueChange={(value) => handleProjectUpdate("cs_id", value === "none" ? null : value)}
                >
                  <SelectTrigger className="flex-1 sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Progress and Health Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Progress */}
          <Card className="lg:col-span-2">
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <span className="text-xs sm:text-sm text-muted-foreground">Progresso da Jornada</span>
                <span className="text-sm sm:text-base font-medium">
                  {completedTasks}/{totalTasks} tarefas ({totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 sm:h-3">
                <div
                  className="bg-primary h-2.5 sm:h-3 rounded-full transition-all"
                  style={{ width: `${totalTasks ? (completedTasks / totalTasks) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Health Score Widget */}
          <HealthScoreWidget projectId={projectId!} compact onViewDetails={() => setActiveTab("health")} />
        </div>

        {/* Urgent Tasks Highlight */}
        <ProjectUrgentTasks tasks={tasks} onTaskClick={setSelectedTask} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4 sm:mb-6 -mx-2 px-2 sm:mx-0 sm:px-0">
            {/* Scrollable tabs container for mobile */}
            <div className="overflow-x-auto pb-1">
              <TabsList className="h-auto w-max sm:w-full inline-flex sm:flex flex-nowrap sm:flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="kpis" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  KPIs
                </TabsTrigger>
                <TabsTrigger value="briefing" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Briefing
                </TabsTrigger>
                <TabsTrigger value="diagnostic" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Diagnóstico
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Jornada
                </TabsTrigger>
                <TabsTrigger value="ai-coach" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  IA
                </TabsTrigger>
                <TabsTrigger value="nps" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  NPS
                </TabsTrigger>
                <TabsTrigger value="csat" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  CSAT
                </TabsTrigger>
                <TabsTrigger value="assessments" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Aval.
                </TabsTrigger>
                <TabsTrigger value="meetings" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Reuniões
                </TabsTrigger>
                <TabsTrigger value="support" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Headphones className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Suporte
                </TabsTrigger>
                <TabsTrigger value="health" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Saúde
                </TabsTrigger>
                <TabsTrigger value="hr" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  RH
                </TabsTrigger>
                <TabsTrigger value="board" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Board
                </TabsTrigger>
                <TabsTrigger value="financial" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Financeiro
                </TabsTrigger>
                <TabsTrigger value="paid_traffic" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Tráfego
                </TabsTrigger>
                <TabsTrigger value="access" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Acessos
                </TabsTrigger>
                <TabsTrigger value="routine_contract" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Contrato de Rotina
                </TabsTrigger>
                {currentUserRole !== "client" && (
                  <TabsTrigger value="commercial_actions" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                    <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Ações Comerciais
                  </TabsTrigger>
                )}
                <TabsTrigger value="sales_funnel" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <FunnelIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Funil de Vendas
                </TabsTrigger>
                <TabsTrigger value="instagram" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Instagram className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-500" />
                  Instagram
                </TabsTrigger>
                <TabsTrigger value="social" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-500" />
                  UNV Social IA
                </TabsTrigger>
                <TabsTrigger value="commercial_director" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <BrainCircuit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Diretor Comercial
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Histórico
                </TabsTrigger>
                {project?.product_name === "UNV Sales Force" && (
                  <TabsTrigger value="sf_commissions" className="gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Comissões
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </div>

          <TabsContent value="tasks">
            {/* Search, Filters, View Toggle and Add Task */}
            <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Search */}
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefa..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="pl-10 h-9 sm:h-10 text-sm"
                />
              </div>

              {/* Status Filters and Sort */}
              <TasksFilterBar
                statusFilter={taskStatusFilter}
                onStatusFilterChange={setTaskStatusFilter}
                sortOrder={taskSortOrder}
                onSortOrderChange={setTaskSortOrder}
                counts={taskCounts}
                staffList={staffList}
                responsibleFilter={taskResponsibleFilter}
                onResponsibleFilterChange={setTaskResponsibleFilter}
              />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* View mode buttons - scrollable on mobile */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
                  <Button
                    variant={tasksViewMode === "trail" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("trail")}
                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <Route className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Trilha</span>
                  </Button>
                  <Button
                    variant={tasksViewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("list")}
                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <LayoutList className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Lista</span>
                  </Button>
                  <Button
                    variant={tasksViewMode === "schedule" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("schedule")}
                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Cronograma</span>
                  </Button>
                  <Button
                    variant={tasksViewMode === "panel" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("panel")}
                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <PanelIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Painel</span>
                  </Button>
                  <Button
                    variant={tasksViewMode === "kanban" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("kanban")}
                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <Columns3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Kanban</span>
                  </Button>
                </div>
                {canAddTasks && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    {/* Reorganize dates button - only for Admin and CS */}
                    {(currentUserRole === "admin" || currentUserRole === "cs") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowReorganizeDatesDialog(true)}
                        className="h-9 gap-1.5 text-xs sm:text-sm"
                        title="Reorganizar datas"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Reorganizar datas</span>
                      </Button>
                    )}
                    <Input
                      placeholder="Nova tarefa..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleOpenAddTaskDialog()}
                      onFocus={handleOpenAddTaskDialog}
                      className="flex-1 sm:w-48 md:w-64 h-9 text-sm cursor-pointer"
                      readOnly
                    />
                    <Button onClick={handleOpenAddTaskDialog} size="sm" className="h-9 w-9 p-0 sm:w-auto sm:px-3">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {taskSearchQuery && filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma tarefa encontrada</p>
                <p className="text-sm">Tente buscar por outro termo</p>
              </div>
            ) : tasksViewMode === "trail" ? (
              <TasksGameTrailView
                phases={sortedPhases}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
              />
            ) : tasksViewMode === "schedule" ? (
              <TasksScheduleView
                tasks={filteredTasks.map(t => ({ ...t, project_id: projectId }))}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
                onTaskAdded={fetchProjectData}
                singleProjectId={projectId}
                staffList={staffList}
              />
            ) : tasksViewMode === "panel" ? (
              <TasksPanelView
                phases={sortedPhases}
                tasks={filteredTasks}
                onTaskClick={setSelectedTask}
              />
            ) : tasksViewMode === "kanban" ? (
              <TasksKanbanView
                tasks={filteredTasks}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
                onBulkTransfer={canAddTasks && project?.onboarding_company_id ? (taskIds) => {
                  setTransferTaskIds(taskIds);
                  setShowTransferDialog(true);
                } : undefined}
              />
            ) : (
              <TasksListView
                phases={sortedPhases}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
                onDeleteTask={handleDeleteTask}
                canDelete={isAdmin}
                isAdmin={isAdmin}
                onPhaseRename={canAddTasks ? handlePhaseRename : undefined}
                staffList={staffList}
                onBulkReassign={canAddTasks ? async (taskIds, staffId) => {
                  const { error } = await supabase
                    .from("onboarding_tasks")
                    .update({ responsible_staff_id: staffId })
                    .in("id", taskIds);
                  if (error) {
                    toast.error("Erro ao atualizar responsável");
                    throw error;
                  }
                  toast.success(`${taskIds.length} tarefa(s) atualizada(s)`);
                  await fetchProjectData();
                } : undefined}
                onBulkComplete={canAddTasks ? async (taskIds) => {
                  const { error } = await supabase
                    .from("onboarding_tasks")
                    .update({ status: "completed", completed_at: new Date().toISOString() })
                    .in("id", taskIds);
                  if (error) {
                    toast.error("Erro ao concluir tarefas");
                    throw error;
                  }
                  toast.success(`${taskIds.length} tarefa(s) concluída(s)`);
                  await fetchProjectData();
                } : undefined}
                onBulkDelete={isAdmin ? async (taskIds) => {
                  const { error } = await supabase
                    .from("onboarding_tasks")
                    .delete()
                    .in("id", taskIds);
                  if (error) {
                    toast.error("Erro ao excluir tarefas");
                    throw error;
                  }
                  toast.success(`${taskIds.length} tarefa(s) excluída(s)`);
                  await fetchProjectData();
                } : undefined}
                onBulkTransfer={canAddTasks && project?.onboarding_company_id ? (taskIds) => {
                  setTransferTaskIds(taskIds);
                  setShowTransferDialog(true);
                } : undefined}
              />
            )}

            {tasks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma tarefa ainda</p>
                <p className="text-sm">Adicione tarefas para começar a jornada</p>
              </div>
            )}
          </TabsContent>


          <TabsContent value="briefing">
            <CompanyBriefingPanel 
              companyId={project.onboarding_company_id || ""} 
              projectId={projectId}
              userRole={currentUserRole}
              isStaffAdmin={isStaffAdmin}
            />
            <div className="mt-6">
              <AdsBriefingSection projectId={projectId!} />
            </div>
          </TabsContent>

          <TabsContent value="diagnostic">
            <StrategicDiagnosticModule projectId={projectId!} />
          </TabsContent>

          <TabsContent value="ai-coach">
            <ProjectAIChat
              projectId={projectId!}
              companyId={project.onboarding_company_id || ""}
              projectName={project.product_name}
              companyName={project.onboarding_company?.name}
              documentsLink={project.documents_link}
            />
          </TabsContent>

          <TabsContent value="nps">
            <NPSHistoryPanel
              projectId={projectId!}
              currentNps={project.current_nps}
              userRole={isAdmin ? 'admin' : currentUserRole as 'cs' | 'consultant' | undefined}
            />
          </TabsContent>

          <TabsContent value="csat">
            <CSATConfigPanel
              projectId={projectId!}
              userRole={isAdmin ? 'admin' : currentUserRole as 'cs' | 'consultant' | undefined}
            />
          </TabsContent>

          <TabsContent value="assessments">
            <AssessmentsPanel projectId={projectId!} />
          </TabsContent>

          <TabsContent value="meetings">
            <MeetingHistoryPanel projectId={projectId!} onTasksRefresh={fetchProjectData} />
          </TabsContent>

          <TabsContent value="support">
            <SupportTabContent projectId={projectId!} users={users} />
          </TabsContent>

          <TabsContent value="health">
            <HealthScoreDetailPanel projectId={projectId!} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="kpis">
            <KPIMetasPanel 
              companyId={project.onboarding_company_id || ""} 
              isAdmin={isAdmin}
              projectId={projectId}
              isStaff={currentUserRole === "admin" || currentUserRole === "cs" || currentUserRole === "consultant"}
              defaultTab={kpiDefaultTab}
            />
          </TabsContent>

          <TabsContent value="hr">
            <HRRecruitmentPanel
              projectId={projectId!}
              companyId={project.onboarding_company_id}
              isStaff={currentUserRole !== "client"}
              canEdit={isAdmin || currentUserRole === "cs" || currentUserRole === "consultant" || currentUserRole === "rh"}
              userRole={currentUserRole}
            />
          </TabsContent>

          <TabsContent value="board">
            <ClientVirtualBoard
              projectId={projectId!}
              companyId={project.onboarding_company_id || undefined}
              companyName={project.onboarding_company?.name}
            />
          </TabsContent>

          <TabsContent value="financial">
            <ClientFinancialModule 
              projectId={projectId!} 
              userRole={currentUserRole || 'staff'}
            />
          </TabsContent>

          <TabsContent value="paid_traffic">
            <ClientPaidTrafficPanel 
              projectId={projectId!} 
              canEdit={true}
            />
          </TabsContent>

          <TabsContent value="access">
            <ClientAccessHistory 
              projectId={projectId!} 
              companyId={project.onboarding_company_id || undefined}
            />
          </TabsContent>

          <TabsContent value="routine_contract">
            <RoutineContractPanel
              projectId={projectId!}
              companyId={project.onboarding_company_id}
              isAdmin={currentUserRole !== "client"}
            />
          </TabsContent>

          {currentUserRole !== "client" && (
            <TabsContent value="commercial_actions">
              <CommercialActionsPanel
                projectId={projectId!}
                companyId={project.onboarding_company_id}
                companySegment={project.onboarding_company?.segment || null}
                consultantStaffId={project.consultant_id}
                staffList={staffList}
              />
            </TabsContent>
          )}

          <TabsContent value="sales_funnel">
            <SalesFunnelPanel
              projectId={projectId!}
              companyId={project.onboarding_company_id}
              companySegment={project.onboarding_company?.segment || null}
              isStaff={currentUserRole !== "client"}
              canEdit={isAdmin || currentUserRole === "cs" || currentUserRole === "consultant"}
            />
          </TabsContent>

          <TabsContent value="instagram">
            <ClientInstagramModule projectId={projectId!} />
          </TabsContent>

          <TabsContent value="social">
            <div className="flex flex-col items-center justify-center py-8">
              <Button
                onClick={() => navigate(`/social/${projectId}`)}
                className="gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                <Heart className="h-4 w-4" />
                Abrir UNV Social IA
              </Button>
              <p className="text-sm text-muted-foreground mt-3">Acesse o módulo completo de gestão de redes sociais com IA</p>
            </div>
          </TabsContent>

          <TabsContent value="commercial_director">
            <CommercialDirectorModule
              projectId={projectId!}
              companyId={project.onboarding_company_id || ""}
              companyName={project.onboarding_company?.name}
            />
          </TabsContent>

          <TabsContent value="whatsapp">
            <ProjectWhatsAppTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="history">
            <ProjectHistoryPanel projectId={projectId!} />
          </TabsContent>

          {project?.product_name === "UNV Sales Force" && (
            <TabsContent value="sf_commissions">
              <SFCommissionsPanel
                projectId={projectId!}
                companyId={project.onboarding_company_id || ""}
                viewerRole={currentUserRole}
              />
            </TabsContent>
          )}

        </Tabs>
      </div>

      <ManageUsersDialog
        open={showUsersDialog}
        onOpenChange={setShowUsersDialog}
        projectId={projectId!}
        users={users}
        onUsersChanged={fetchProjectData}
        isAdmin={isAdmin}
      />

      <TaskDetailsDialog
        task={selectedTask}
        users={users}
        staffList={staffList}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={fetchProjectData}
        isAdmin={isAdmin}
        companyId={project.onboarding_company_id || undefined}
        projectId={projectId}
        onDelete={handleDeleteTask}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
      />

      <GenerateTasksDialog
        open={showGenerateTasksDialog}
        onOpenChange={setShowGenerateTasksDialog}
        projectId={projectId!}
        productId={project.product_id}
        onTasksGenerated={fetchProjectData}
      />

      <GeneratePDFTasksDialog
        open={showPDFTasksDialog}
        onOpenChange={setShowPDFTasksDialog}
        projectId={projectId!}
        companyName={project.onboarding_company?.name}
        onTasksGenerated={fetchProjectData}
      />

      <ChurnReasonDialog
        open={showChurnDialog}
        onOpenChange={setShowChurnDialog}
        onConfirm={handleChurnConfirm}
        isLoading={churnLoading}
        mode="churn"
      />

      <ChurnReasonDialog
        open={showCancellationSignalDialog}
        onOpenChange={setShowCancellationSignalDialog}
        onConfirm={handleCancellationSignalConfirm}
        isLoading={cancellationSignalLoading}
        mode="cancellation_signal"
      />

      <NoticePeriodDialog
        open={showNoticePeriodDialog}
        onOpenChange={setShowNoticePeriodDialog}
        onConfirm={handleNoticePeriodConfirm}
        isLoading={noticePeriodLoading}
      />

      {/* CRM Link Dialog */}
      <Dialog open={showCrmDialog} onOpenChange={setShowCrmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{crmDialogMode === "view" ? "Acesso ao CRM" : "Editar CRM"}</span>
              {crmDialogMode === "view" && currentUserRole && currentUserRole !== "client" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCrmDialogMode("edit")}
                  className="h-8 px-2"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {crmDialogMode === "view" ? (
            <div className="space-y-4">
              {/* Go to CRM Button */}
              {crmLinkInput && (
                <Button
                  className="w-full gap-2"
                  onClick={() => window.open(crmLinkInput, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Acessar CRM
                </Button>
              )}
              
              {/* Login field */}
              <div>
                <Label className="text-muted-foreground text-xs">Login</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 p-2 bg-muted rounded-md text-sm font-mono">
                    {crmLoginInput || <span className="text-muted-foreground italic">Não informado</span>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (crmLoginInput) {
                        navigator.clipboard.writeText(crmLoginInput);
                        toast.success("Login copiado!");
                      }
                    }}
                    disabled={!crmLoginInput}
                    title="Copiar login"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Password field */}
              <div>
                <Label className="text-muted-foreground text-xs">Senha</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 p-2 bg-muted rounded-md text-sm font-mono">
                    {crmPasswordInput || <span className="text-muted-foreground italic">Não informado</span>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (crmPasswordInput) {
                        navigator.clipboard.writeText(crmPasswordInput);
                        toast.success("Senha copiada!");
                      }
                    }}
                    disabled={!crmPasswordInput}
                    title="Copiar senha"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <Button variant="outline" onClick={() => setShowCrmDialog(false)} className="w-full">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>URL do CRM do cliente</Label>
                <Input
                  value={crmLinkInput}
                  onChange={(e) => setCrmLinkInput(e.target.value)}
                  placeholder="https://crm.exemplo.com/cliente/..."
                />
              </div>
              <div>
                <Label>Login</Label>
                <Input
                  value={crmLoginInput}
                  onChange={(e) => setCrmLoginInput(e.target.value)}
                  placeholder="usuario@email.com"
                />
              </div>
              <div>
                <Label>Senha</Label>
                <Input
                  value={crmPasswordInput}
                  onChange={(e) => setCrmPasswordInput(e.target.value)}
                  placeholder="senha123"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (project?.crm_link) {
                      setCrmDialogMode("view");
                    } else {
                      setShowCrmDialog(false);
                    }
                  }} 
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from("onboarding_projects")
                        .update({ 
                          crm_link: crmLinkInput || null,
                          crm_login: crmLoginInput || null,
                          crm_password: crmPasswordInput || null
                        })
                        .eq("id", projectId);
                      if (error) throw error;
                      setProject(prev => prev ? { 
                        ...prev, 
                        crm_link: crmLinkInput || null,
                        crm_login: crmLoginInput || null,
                        crm_password: crmPasswordInput || null
                      } : null);
                      setCrmDialogMode("view");
                      toast.success("Dados do CRM atualizados");
                    } catch (error) {
                      console.error("Error updating CRM data:", error);
                      toast.error("Erro ao atualizar dados do CRM");
                    }
                  }}
                  className="flex-1"
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Documents Link Dialog */}
      <Dialog open={showDocsDialog} onOpenChange={setShowDocsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link dos Documentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL da pasta no Google Drive</Label>
              <Input
                value={docsLinkInput}
                onChange={(e) => setDocsLinkInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDocsDialog(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from("onboarding_projects")
                      .update({ documents_link: docsLinkInput || null })
                      .eq("id", projectId);
                    if (error) throw error;
                    setProject(prev => prev ? { ...prev, documents_link: docsLinkInput || null } : null);
                    setShowDocsDialog(false);
                    toast.success("Link de documentos atualizado");
                  } catch (error) {
                    console.error("Error updating documents link:", error);
                    toast.error("Erro ao atualizar link");
                  }
                }}
                className="flex-1"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Add Task Dialog */}
      <AddTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        projectId={projectId!}
        initialTitle={newTaskTitle}
        staffList={staffList}
        onTaskAdded={handleTaskAddedFromDialog}
        currentSortOrder={Math.max(...tasks.map(t => t.sort_order), 0)}
      />

      {/* Reorganize Tasks Dates Dialog */}
      <ReorganizeTasksDatesDialog
        open={showReorganizeDatesDialog}
        onOpenChange={setShowReorganizeDatesDialog}
        tasks={tasks}
        projectId={projectId!}
        onTasksUpdated={fetchProjectData}
      />

      <ProjectMenuPermissionsDialog
        open={showProjectMenuPermissions}
        onOpenChange={setShowProjectMenuPermissions}
        projectId={projectId!}
      />

      {project?.onboarding_company_id && (
        <TransferTasksDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          taskIds={transferTaskIds}
          currentProjectId={projectId!}
          companyId={project.onboarding_company_id}
          staffList={staffList}
          onComplete={() => fetchProjectData()}
        />
      )}
    </div>
  );
};

export default OnboardingProjectPage;
