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
import { ProjectVariablesPanel } from "@/components/onboarding-tasks/ProjectVariablesPanel";
import { ProjectAIChat } from "@/components/onboarding-tasks/ProjectAIChat";
import { CompanyBriefingPanel } from "@/components/onboarding-tasks/CompanyBriefingPanel";
import { GenerateTasksDialog } from "@/components/onboarding-tasks/GenerateTasksDialog";
import { GeneratePDFTasksDialog } from "@/components/onboarding-tasks/GeneratePDFTasksDialog";
import { Settings, Sparkles, Building2, Wand2, UserCircle, Route, LayoutList, CalendarDays, LogOut, FileUp } from "lucide-react";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { ChurnReasonDialog } from "@/components/onboarding-tasks/ChurnReasonDialog";
import { NoticePeriodDialog } from "@/components/onboarding-tasks/NoticePeriodDialog";

import { RealtimeNotifications } from "@/components/onboarding-tasks/RealtimeNotifications";
import { TasksGameTrailView } from "@/components/onboarding-tasks/TasksGameTrailView";
import { TasksListView } from "@/components/onboarding-tasks/TasksListView";
import { TasksScheduleView } from "@/components/onboarding-tasks/TasksScheduleView";
import { NPSHistoryPanel } from "@/components/onboarding-tasks/NPSHistoryPanel";
import { ProjectUrgentTasks } from "@/components/onboarding-tasks/ProjectUrgentTasks";
import { GoalProjectionAlertDialog } from "@/components/onboarding-tasks/GoalProjectionAlertDialog";
import { ProjectSupportBanner } from "@/components/onboarding-tasks/ProjectSupportBanner";
import { SupportHistoryPanel } from "@/components/onboarding-tasks/SupportHistoryPanel";
import { MeetingHistoryPanel } from "@/components/onboarding-tasks/MeetingHistoryPanel";
import { AssessmentsPanel } from "@/components/assessments/AssessmentsPanel";
import { KPIMetasPanel } from "@/components/onboarding-tasks/kpis/KPIMetasPanel";
import { TrendingUp, Headphones, Video, Brain, BarChart3, FolderOpen, ExternalLink } from "lucide-react";
import { Label } from "@/components/ui/label";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed";
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

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cs" | "consultant" | "client";
  password_changed: boolean;
}

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  current_nps: number | null;
  onboarding_company_id: string | null;
  onboarding_company?: { name: string } | null;
  consultant_id: string | null;
  cs_id: string | null;
  crm_link: string | null;
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
  const [activeTab, setActiveTab] = useState("kpis");
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "cs" | "consultant" | "client" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [isStaffAdmin, setIsStaffAdmin] = useState(false);
  const [showGenerateTasksDialog, setShowGenerateTasksDialog] = useState(false);
  const [showPDFTasksDialog, setShowPDFTasksDialog] = useState(false);
  const [tasksViewMode, setTasksViewMode] = useState<"trail" | "list" | "schedule">("trail");
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [showChurnDialog, setShowChurnDialog] = useState(false);
  const [showCancellationSignalDialog, setShowCancellationSignalDialog] = useState(false);
  const [showNoticePeriodDialog, setShowNoticePeriodDialog] = useState(false);
  const [noticePeriodLoading, setNoticePeriodLoading] = useState(false);
  const [churnLoading, setChurnLoading] = useState(false);
  const [cancellationSignalLoading, setCancellationSignalLoading] = useState(false);
  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [showDocsDialog, setShowDocsDialog] = useState(false);
  const [crmLinkInput, setCrmLinkInput] = useState("");
  const [docsLinkInput, setDocsLinkInput] = useState("");

  // Check for attention/risk alerts when opening project
  const checkProjectAlerts = async () => {
    if (!projectId) return;

    try {
      // Fetch project NPS
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("current_nps, product_name, onboarding_company:onboarding_companies(name)")
        .eq("id", projectId)
        .single();

      if (!projectData) return;

      const currentNps = projectData.current_nps;
      const companyName = projectData.onboarding_company?.name || projectData.product_name;

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
      checkProjectAlerts();
    }
  }, [projectId]);

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
      if (user) {
        // Check if user is staff admin
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .single();
        
        if (staffMember) {
          setCurrentUserId(staffMember.id);
          if (staffMember.role === "admin") {
            setIsStaffAdmin(true);
            setCurrentUserRole("admin");
          } else {
            setCurrentUserRole(staffMember.role as "cs" | "consultant");
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
            setCurrentUserRole(onboardingUser.role as "admin" | "cs" | "consultant" | "client");
          }
        }
      }

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("onboarding_projects")
        .select(`*, onboarding_company_id, current_nps, crm_link, documents_link, onboarding_company:onboarding_companies(name)`)
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch tasks with responsible staff
      const { data: tasksData, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select(`
          *,
          assignee:onboarding_users(id, name, role),
          responsible_staff:onboarding_staff(id, name)
        `)
        .eq("project_id", projectId)
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

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const maxOrder = Math.max(...tasks.map((t) => t.sort_order), 0);
      const { error } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        title: newTaskTitle.trim(),
        sort_order: maxOrder + 1,
      });

      if (error) throw error;
      setNewTaskTitle("");
      fetchProjectData();
      toast.success("Tarefa adicionada");
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Erro ao adicionar tarefa");
    }
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

      const { error } = await supabase.from("onboarding_tasks").update(updates).eq("id", taskId);
      if (error) throw error;

      // Log history
      if (task && task.status !== newStatus) {
        await logTaskHistory({
          taskId,
          action: "status_change",
          fieldChanged: "status",
          oldValue: getStatusLabel(task.status),
          newValue: getStatusLabel(newStatus),
        });
      }

      fetchProjectData();

      if (task?.recurrence && newStatus === "completed") {
        toast.success("Tarefa concluída! Nova tarefa recorrente criada automaticamente.");
      }
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isStaffAdmin && currentUserRole !== "admin") {
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

  // Group tasks by phase (stored in tags[0], order in tags[1] or by first task sort_order)
  // Filter tasks based on search query
  const filteredTasks = taskSearchQuery.trim()
    ? tasks.filter(task => 
        task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(taskSearchQuery.toLowerCase())
      )
    : tasks;

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

  // Sort phases by the earliest due_date of their tasks, then sort tasks within each phase by due_date
  const sortedPhases = Object.values(groupedTasks)
    .map(phase => {
      // Calculate the earliest due_date for this phase
      const earliestDueDate = phase.tasks.reduce((earliest, task) => {
        if (!task.due_date) return earliest;
        const taskDate = new Date(task.due_date).getTime();
        return earliest === Infinity ? taskDate : Math.min(earliest, taskDate);
      }, Infinity);
      
      return {
        ...phase,
        earliestDueDate,
        tasks: phase.tasks.slice().sort((ta, tb) => {
          // Sort by due_date first, then by sort_order
          const dueDateA = ta.due_date ? new Date(ta.due_date).getTime() : Infinity;
          const dueDateB = tb.due_date ? new Date(tb.due_date).getTime() : Infinity;
          if (dueDateA !== dueDateB) return dueDateA - dueDateB;
          return ta.sort_order - tb.sort_order;
        }),
      };
    })
    .sort((a, b) => a.earliestDueDate - b.earliestDueDate);

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
          onNavigateToGoals={() => setActiveTab("kpis")}
        />
      )}
      
      <div className="container mx-auto px-4 py-8">
        {/* Support Banner - Shows when client is waiting */}
        {projectId && <ProjectSupportBanner projectId={projectId} />}
        
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader title={project.product_name} />
              {project.onboarding_company?.name && (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-muted-foreground hidden sm:block">{project.onboarding_company.name}</p>
                  {project.onboarding_company_id && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => navigate(`/onboarding-tasks/companies/${project.onboarding_company_id}`)}
                    >
                      <Building2 className="h-3 w-3 mr-1" />
                      Ver Empresa
                    </Button>
                  )}
                  {/* CRM Button */}
                  {project.crm_link ? (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => window.open(project.crm_link!, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        CRM
                      </Button>
                      {currentUserRole && currentUserRole !== "client" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setCrmLinkInput(project.crm_link || "");
                            setShowCrmDialog(true);
                          }}
                          title="Editar link do CRM"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : currentUserRole && currentUserRole !== "client" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setCrmLinkInput("");
                        setShowCrmDialog(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      CRM
                    </Button>
                  )}
                  {/* Documentos Button */}
                  {project.documents_link ? (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => window.open(project.documents_link!, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Documentos
                      </Button>
                      {currentUserRole && currentUserRole !== "client" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setDocsLinkInput(project.documents_link || "");
                            setShowDocsDialog(true);
                          }}
                          title="Editar link dos documentos"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : currentUserRole && currentUserRole !== "client" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setDocsLinkInput("");
                        setShowDocsDialog(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Documentos
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentUserRole && currentUserRole !== "client" && (
                <>
                  <Button variant="outline" onClick={() => setShowPDFTasksDialog(true)}>
                    <FileUp className="h-4 w-4 mr-2" />
                    Plano via PDF
                  </Button>
                  <Button variant="outline" onClick={() => setShowGenerateTasksDialog(true)}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Gerar Tarefas
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setShowUsersDialog(true)}>
                <Users className="h-4 w-4 mr-2" />
                Usuários ({users.length})
              </Button>
              {isStaffAdmin && (
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={handleDeleteProject}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
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

          {/* Project Settings Row - Only for admin/cs */}
          {(isAdmin || currentUserRole === "cs") && (
            <div className="flex flex-wrap gap-4 pl-14">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Select 
                  value={project.status} 
                  onValueChange={handleProjectStatusChange}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="cancellation_signaled">Sinalizou Cancelamento</SelectItem>
                    <SelectItem value="notice_period">Cumprindo Aviso</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Consultor:</span>
                <Select 
                  value={project.consultant_id || "none"} 
                  onValueChange={(value) => handleProjectUpdate("consultant_id", value === "none" ? null : value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {staffList.filter(s => s.role === "consultant").map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">CS:</span>
                <Select 
                  value={project.cs_id || "none"} 
                  onValueChange={(value) => handleProjectUpdate("cs_id", value === "none" ? null : value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {staffList.filter(s => s.role === "cs").map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progresso da Jornada</span>
              <span className="font-medium">
                {completedTasks}/{totalTasks} tarefas concluídas ({totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${totalTasks ? (completedTasks / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Urgent Tasks Highlight */}
        <ProjectUrgentTasks tasks={tasks} onTaskClick={setSelectedTask} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-6">
            {/* Todas as abas em um único container com flex-wrap */}
            <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="kpis" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">KPIs</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Jornada</span>
              </TabsTrigger>
              <TabsTrigger value="briefing" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Briefing</span>
              </TabsTrigger>
              <TabsTrigger value="variables" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Variáveis</span>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Chamados</span>
              </TabsTrigger>
              <TabsTrigger value="ai-coach" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">IA Coach</span>
              </TabsTrigger>
              <TabsTrigger value="nps" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">NPS</span>
              </TabsTrigger>
              <TabsTrigger value="support-history" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <Headphones className="h-4 w-4" />
                <span className="hidden sm:inline">Suportes</span>
              </TabsTrigger>
              <TabsTrigger value="meetings" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Reuniões</span>
              </TabsTrigger>
              <TabsTrigger value="assessments" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Avaliações</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks">
            {/* Search, View Toggle and Add Task */}
            <div className="flex flex-col gap-4 mb-6">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefa pelo nome..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant={tasksViewMode === "trail" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("trail")}
                  >
                    <Route className="h-4 w-4 mr-2" />
                    Trilha
                  </Button>
                  <Button
                    variant={tasksViewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("list")}
                  >
                    <LayoutList className="h-4 w-4 mr-2" />
                    Lista
                  </Button>
                  <Button
                    variant={tasksViewMode === "schedule" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksViewMode("schedule")}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Cronograma
                  </Button>
                </div>
                {canAddTasks && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar nova tarefa..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      className="w-64"
                    />
                    <Button onClick={handleAddTask}>
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
            ) : (
              <TasksListView
                phases={sortedPhases}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
                onDeleteTask={handleDeleteTask}
                canDelete={isAdmin}
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
          </TabsContent>

          <TabsContent value="variables">
            <ProjectVariablesPanel
              projectId={projectId!}
              productId={project.product_id}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="tickets">
            <TicketsPanel projectId={projectId!} users={users} />
          </TabsContent>

          <TabsContent value="ai-coach">
            <ProjectAIChat
              projectId={projectId!}
              companyId={project.onboarding_company_id || ""}
              projectName={project.product_name}
              companyName={project.onboarding_company?.name}
            />
          </TabsContent>


          <TabsContent value="nps">
            <NPSHistoryPanel
              projectId={projectId!}
              currentNps={project.current_nps}
              userRole={isAdmin ? 'admin' : currentUserRole as 'cs' | 'consultant' | undefined}
            />
          </TabsContent>

          <TabsContent value="support-history">
            <SupportHistoryPanel projectId={projectId!} />
          </TabsContent>

          <TabsContent value="meetings">
            <MeetingHistoryPanel projectId={projectId!} />
          </TabsContent>

          <TabsContent value="assessments">
            <AssessmentsPanel projectId={projectId!} />
          </TabsContent>

          <TabsContent value="kpis">
            <KPIMetasPanel 
              companyId={project.onboarding_company_id || ""} 
              isAdmin={isAdmin}
              projectId={projectId}
            />
          </TabsContent>

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
            <DialogTitle>Link do CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL do CRM do cliente</Label>
              <Input
                value={crmLinkInput}
                onChange={(e) => setCrmLinkInput(e.target.value)}
                placeholder="https://crm.exemplo.com/cliente/..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCrmDialog(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from("onboarding_projects")
                      .update({ crm_link: crmLinkInput || null })
                      .eq("id", projectId);
                    if (error) throw error;
                    setProject(prev => prev ? { ...prev, crm_link: crmLinkInput || null } : null);
                    setShowCrmDialog(false);
                    toast.success("Link do CRM atualizado");
                  } catch (error) {
                    console.error("Error updating CRM link:", error);
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
    </div>
  );
};

export default OnboardingProjectPage;
