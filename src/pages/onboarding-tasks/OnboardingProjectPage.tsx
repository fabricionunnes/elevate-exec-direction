import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Settings, Sparkles, Building2, Wand2, Target, UserCircle, Route, LayoutList, CalendarDays, LogOut } from "lucide-react";
import { MonthlyGoalsCard } from "@/components/onboarding-tasks/MonthlyGoalsCard";
import { RealtimeNotifications } from "@/components/onboarding-tasks/RealtimeNotifications";
import { TasksGameTrailView } from "@/components/onboarding-tasks/TasksGameTrailView";
import { TasksListView } from "@/components/onboarding-tasks/TasksListView";
import { TasksScheduleView } from "@/components/onboarding-tasks/TasksScheduleView";
import { NPSHistoryPanel } from "@/components/onboarding-tasks/NPSHistoryPanel";
import { TrendingUp } from "lucide-react";


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
  const [activeTab, setActiveTab] = useState("tasks");
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "cs" | "consultant" | "client" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [isStaffAdmin, setIsStaffAdmin] = useState(false);
  const [showGenerateTasksDialog, setShowGenerateTasksDialog] = useState(false);
  const [tasksViewMode, setTasksViewMode] = useState<"trail" | "list" | "schedule">("trail");
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      fetchStaffList();
    }
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
        .select(`*, onboarding_company_id, current_nps, onboarding_company:onboarding_companies(name)`)
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

  const handleProjectUpdate = async (field: string, value: string | null) => {
    if (!projectId) return;
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ [field]: value })
        .eq("id", projectId);
      
      if (error) throw error;
      setProject(prev => prev ? { ...prev, [field]: value } : null);
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
  const groupedTasks = tasks.reduce<Record<string, TaskPhase>>((acc, task) => {
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
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{project.product_name}</h1>
                {project.onboarding_company?.name && (
                  <p className="text-muted-foreground">{project.onboarding_company.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentUserRole && currentUserRole !== "client" && (
                <Button variant="outline" onClick={() => setShowGenerateTasksDialog(true)}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar Tarefas
                </Button>
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
                  onValueChange={(value) => handleProjectUpdate("status", value)}
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="tasks" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Jornada
            </TabsTrigger>
            <TabsTrigger value="briefing" className="gap-2">
              <Building2 className="h-4 w-4" />
              Briefing
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-2">
              <Settings className="h-4 w-4" />
              Variáveis
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chamados
            </TabsTrigger>
            <TabsTrigger value="ai-coach" className="gap-2">
              <Sparkles className="h-4 w-4" />
              IA Coach
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-2">
              <Target className="h-4 w-4" />
              Metas
            </TabsTrigger>
            <TabsTrigger value="nps" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              NPS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            {/* View Toggle and Add Task */}
            <div className="flex items-center justify-between mb-6">
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

            {tasksViewMode === "trail" ? (
              <TasksGameTrailView
                phases={sortedPhases}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
              />
            ) : tasksViewMode === "schedule" ? (
              <TasksScheduleView
                tasks={tasks}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
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

          <TabsContent value="goals">
            <MonthlyGoalsCard
              projectId={projectId!}
              canEdit={isAdmin || currentUserRole === "cs" || currentUserRole === "consultant"}
              currentStaffId={isStaffAdmin || currentUserRole === "cs" || currentUserRole === "consultant" ? currentUserId : null}
            />
          </TabsContent>

          <TabsContent value="nps">
            <NPSHistoryPanel
              projectId={projectId!}
              currentNps={project.current_nps}
              userRole={isAdmin ? 'admin' : currentUserRole as 'cs' | 'consultant' | undefined}
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
      />

      <TaskDetailsDialog
        task={selectedTask}
        users={users}
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
    </div>
  );
};

export default OnboardingProjectPage;
