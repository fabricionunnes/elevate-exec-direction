import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  MessageSquare,
  LogOut,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TicketsPanel } from "@/components/onboarding-tasks/TicketsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  assignee?: { name: string; role: string };
  observations: string | null;
}

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cs" | "consultant" | "client";
}

const ClientOnboardingPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [currentUser, setCurrentUser] = useState<OnboardingUser | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [projectId]);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      // Find onboarding user for this project
      const { data: onboardingUser, error: userError } = await supabase
        .from("onboarding_users")
        .select("*, project:onboarding_projects(*)")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .single();

      if (userError || !onboardingUser) {
        toast.error("Você não tem acesso a este projeto de onboarding");
        navigate("/onboarding-tasks/login");
        return;
      }

      setCurrentUser(onboardingUser);
      setProject(onboardingUser.project);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("onboarding_tasks")
        .select(`*, assignee:onboarding_users(name, role)`)
        .eq("project_id", onboardingUser.project_id)
        .order("sort_order");

      setTasks(tasksData || []);

      // Fetch users
      const { data: usersData } = await supabase
        .from("onboarding_users")
        .select("*")
        .eq("project_id", onboardingUser.project_id);

      setUsers(usersData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/onboarding-tasks/login");
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluída";
      case "in_progress":
        return "Em andamento";
      default:
        return "Pendente";
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
          <Button onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{project.product_name}</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o progresso do seu onboarding
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Olá, {currentUser?.name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Progress Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Progresso do Onboarding</h2>
                <p className="text-sm text-muted-foreground">
                  {completedTasks} de {totalTasks} etapas concluídas
                </p>
              </div>
              <div className="text-3xl font-bold text-primary">
                {Math.round(progressPercent)}%
              </div>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </CardContent>
        </Card>

        <Tabs defaultValue="tasks">
          <TabsList className="mb-6">
            <TabsTrigger value="tasks" className="gap-2">
              <Eye className="h-4 w-4" />
              Etapas
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chamados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <Card
                  key={task.id}
                  className={task.status === "completed" ? "opacity-60" : ""}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3
                              className={`font-medium ${
                                task.status === "completed" ? "line-through" : ""
                              }`}
                            >
                              Etapa {index + 1}: {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={task.status === "completed" ? "default" : "outline"}
                            className={
                              task.status === "completed"
                                ? "bg-green-500"
                                : task.status === "in_progress"
                                ? "border-amber-500 text-amber-500"
                                : ""
                            }
                          >
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Previsão: {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          )}
                          {task.assignee && (
                            <div className="flex items-center gap-1">
                              <span>
                                Responsável: {task.assignee.name}
                              </span>
                            </div>
                          )}
                        </div>

                        {task.observations && task.status === "completed" && (
                          <div className="mt-3 p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Observações:</p>
                            <p className="text-sm text-muted-foreground">{task.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <TicketsPanel projectId={project.id} users={users} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientOnboardingPage;
