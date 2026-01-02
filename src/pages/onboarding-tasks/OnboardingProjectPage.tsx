import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ManageUsersDialog } from "@/components/onboarding-tasks/ManageUsersDialog";
import { TaskDetailsDialog } from "@/components/onboarding-tasks/TaskDetailsDialog";
import { TicketsPanel } from "@/components/onboarding-tasks/TicketsPanel";
import { ProjectVariablesPanel } from "@/components/onboarding-tasks/ProjectVariablesPanel";
import { ProjectAIChat } from "@/components/onboarding-tasks/ProjectAIChat";
import { Settings, Sparkles } from "lucide-react";

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
  onboarding_company_id: string | null;
  onboarding_company?: { name: string } | null;
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
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "cs" | "consultant" | "client" | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [isStaffAdmin, setIsStaffAdmin] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

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
        
        if (staffMember && staffMember.role === "admin") {
          setIsStaffAdmin(true);
          setCurrentUserRole("admin");
        } else {
          const { data: onboardingUser } = await supabase
            .from("onboarding_users")
            .select("role")
            .eq("user_id", user.id)
            .eq("project_id", projectId)
            .single();
          
          if (onboardingUser) {
            setCurrentUserRole(onboardingUser.role as "admin" | "cs" | "consultant" | "client");
          }
        }
      }

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("onboarding_projects")
        .select(`*, onboarding_company_id, onboarding_company:onboarding_companies(name)`)
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

  const handleStatusChange = async (taskId: string, newStatus: "pending" | "in_progress" | "completed") => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const updates: any = { status: newStatus };
      
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
        
        // If task is recurring, create next occurrence
        if (task?.recurrence) {
          await createNextRecurringTask(task);
        }
      } else {
        updates.completed_at = null;
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;
      fetchProjectData();
      
      if (task?.recurrence && newStatus === "completed") {
        toast.success("Tarefa concluída! Nova tarefa recorrente criada.");
      }
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const createNextRecurringTask = async (task: OnboardingTask) => {
    const today = new Date();
    let nextDueDate: Date;
    
    switch (task.recurrence) {
      case 'daily':
        nextDueDate = new Date(today.setDate(today.getDate() + 1));
        break;
      case 'weekly':
        nextDueDate = new Date(today.setDate(today.getDate() + 7));
        break;
      case 'monthly':
        nextDueDate = new Date(today.setMonth(today.getMonth() + 1));
        break;
      default:
        return;
    }

    const { error } = await supabase.from("onboarding_tasks").insert({
      project_id: projectId,
      title: task.title,
      description: task.description,
      due_date: nextDueDate.toISOString().split('T')[0],
      priority: task.priority,
      tags: task.tags,
      recurrence: task.recurrence,
      template_id: task.template_id,
      sort_order: task.sort_order,
      status: 'pending'
    });

    if (error) {
      console.error("Error creating recurring task:", error);
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

  // Group tasks by phase (stored in tags[0])
  const groupedTasks = tasks.reduce<Record<string, TaskPhase>>((acc, task) => {
    const phaseName = task.tags?.[0] || "Sem fase";
    const phaseOrder = parseInt(task.tags?.[1] || "99");
    
    if (!acc[phaseName]) {
      acc[phaseName] = {
        name: phaseName,
        order: phaseOrder,
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

  const sortedPhases = Object.values(groupedTasks).sort((a, b) => a.order - b.order);

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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
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
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progresso do Onboarding</span>
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
          <TabsList className="mb-6">
            <TabsTrigger value="tasks" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Tarefas
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
              IA Assistente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            {/* Add task */}
            {isAdmin && (
              <div className="flex gap-2 mb-6">
                <Input
                  placeholder="Adicionar nova tarefa..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
                <Button onClick={handleAddTask}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Phases */}
            <div className="space-y-4">
              {sortedPhases.map((phase) => (
                <Collapsible
                  key={phase.name}
                  open={expandedPhases.has(phase.name)}
                  onOpenChange={() => togglePhase(phase.name)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedPhases.has(phase.name) ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <span className="text-lg">{PHASE_EMOJIS[phase.name] || "📋"}</span>
                            <CardTitle className="text-lg">{phase.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {phase.completedCount}/{phase.tasks.length} concluídas
                            </span>
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${PHASE_COLORS[phase.name] || "bg-primary"}`}
                                style={{ width: `${phase.tasks.length ? (phase.completedCount / phase.tasks.length) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4">
                        <div className="space-y-2">
                          {phase.tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm cursor-pointer transition-all ${
                                task.status === "completed" ? "opacity-60" : ""
                              }`}
                              onClick={() => setSelectedTask(task)}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextStatus =
                                    task.status === "pending"
                                      ? "in_progress"
                                      : task.status === "in_progress"
                                      ? "completed"
                                      : "pending";
                                  handleStatusChange(task.id, nextStatus);
                                }}
                              >
                                {getStatusIcon(task.status)}
                              </button>

                              <div className="flex-1 min-w-0">
                                <p
                                  className={`font-medium ${
                                    task.status === "completed" ? "line-through text-muted-foreground" : ""
                                  }`}
                                >
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {task.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {task.recurrence && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <RefreshCw className="h-3 w-3" />
                                    {task.recurrence === 'daily' ? 'Diário' : 
                                     task.recurrence === 'weekly' ? 'Semanal' : 
                                     task.recurrence === 'monthly' ? 'Mensal' : task.recurrence}
                                  </Badge>
                                )}
                                
                                {getPriorityBadge(task.priority)}
                                
                                {task.responsible_staff && (
                                  <span className="text-xs text-muted-foreground">
                                    {task.responsible_staff.name}
                                  </span>
                                )}

                                {task.due_date && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.due_date), "dd/MM")}
                                  </div>
                                )}

                                {isAdmin && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(task.id);
                                        }}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma tarefa ainda</p>
                  <p className="text-sm">Adicione tarefas para começar o onboarding</p>
                </div>
              )}
            </div>
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
      />
    </div>
  );
};

export default OnboardingProjectPage;
