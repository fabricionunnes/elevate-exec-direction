import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  GripVertical,
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

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed";
  assignee_id: string | null;
  observations: string | null;
  sort_order: number;
  assignee?: { id: string; name: string; role: string };
}

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "cs" | "consultant" | "client";
  password_changed: boolean;
}

interface Project {
  id: string;
  product_name: string;
  status: string;
  company?: { name: string };
}

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

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("onboarding_projects")
        .select(`*, company:portal_companies(name)`)
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select(`*, assignee:onboarding_users(id, name, role)`)
        .eq("project_id", projectId)
        .order("sort_order");

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

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
      const updates: any = { status: newStatus };
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;
      fetchProjectData();
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
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

  const getRoleBadge = (role: string) => {
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
              {project.company?.name && (
                <p className="text-muted-foreground">{project.company.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowUsersDialog(true)}>
              <Users className="h-4 w-4 mr-2" />
              Usuários ({users.length})
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progresso do Onboarding</span>
              <span className="font-medium">
                {completedTasks}/{totalTasks} tarefas concluídas
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
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chamados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            {/* Add task */}
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

            {/* Tasks list */}
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className={`transition-all hover:shadow-md cursor-pointer ${
                    task.status === "completed" ? "opacity-60" : ""
                  }`}
                  onClick={() => setSelectedTask(task)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
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

                      <div className="flex items-center gap-3">
                        {task.assignee && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">
                              {task.assignee.name}
                            </span>
                            {getRoleBadge(task.assignee.role)}
                          </div>
                        )}

                        {task.due_date && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "dd/MM")}
                          </div>
                        )}

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
                      </div>
                    </div>
                  </CardContent>
                </Card>
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

          <TabsContent value="tickets">
            <TicketsPanel projectId={projectId!} users={users} />
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
      />
    </div>
  );
};

export default OnboardingProjectPage;
