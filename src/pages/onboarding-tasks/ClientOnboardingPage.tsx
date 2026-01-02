import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  LogOut,
  Map,
  List,
  Calendar,
  MessageSquare,
  Bell,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientJourneyTrail } from "@/components/client-portal/ClientJourneyTrail";
import { ClientTimelineView } from "@/components/client-portal/ClientTimelineView";
import { ClientTasksList } from "@/components/client-portal/ClientTasksList";
import { ClientTaskDetailSheet } from "@/components/client-portal/ClientTaskDetailSheet";
import { TicketsPanel } from "@/components/onboarding-tasks/TicketsPanel";
import { Badge } from "@/components/ui/badge";

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
}

interface TaskPhase {
  name: string;
  order: number;
  tasks: OnboardingTask[];
  completedCount: number;
}

type ViewType = "trail" | "timeline" | "list" | "tickets";

const ClientOnboardingPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [currentUser, setCurrentUser] = useState<OnboardingUser | null>(null);
  const [activeView, setActiveView] = useState<ViewType>("trail");
  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

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
        .select("*, project:onboarding_projects(*, onboarding_company:onboarding_companies(name))")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .single();

      if (userError || !onboardingUser) {
        toast.error("Você não tem acesso a este projeto");
        navigate("/onboarding-tasks/login");
        return;
      }

      setCurrentUser(onboardingUser);
      setProject(onboardingUser.project);
      setCompany(onboardingUser.project?.onboarding_company);

      // Fetch tasks with assignees and responsible staff
      const { data: tasksData } = await supabase
        .from("onboarding_tasks")
        .select(`
          *,
          assignee:onboarding_users!onboarding_tasks_assignee_id_fkey(id, name, role),
          responsible_staff:onboarding_staff!onboarding_tasks_responsible_staff_id_fkey(id, name)
        `)
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

  const handleTaskClick = (task: OnboardingTask) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  // Group tasks into phases using template phases or sort_order ranges
  const phases = useMemo((): TaskPhase[] => {
    // Try to group by template phases first
    const phaseGroups: Record<string, OnboardingTask[]> = {};
    
    tasks.forEach(task => {
      // Use tags or a derived phase name
      const phaseName = task.tags?.[0] || "Tarefas";
      if (!phaseGroups[phaseName]) {
        phaseGroups[phaseName] = [];
      }
      phaseGroups[phaseName].push(task);
    });

    // If we only have one phase, split tasks into logical groups
    const phaseKeys = Object.keys(phaseGroups);
    if (phaseKeys.length <= 1 && tasks.length > 5) {
      const chunkSize = Math.ceil(tasks.length / 4);
      const phaseNames = ["Fase 1 - Diagnóstico", "Fase 2 - Estruturação", "Fase 3 - Implementação", "Fase 4 - Ativação"];
      
      // Reset groups
      Object.keys(phaseGroups).forEach(key => delete phaseGroups[key]);
      
      tasks.forEach((task, index) => {
        const phaseIndex = Math.min(Math.floor(index / chunkSize), phaseNames.length - 1);
        const phaseName = phaseNames[phaseIndex];
        if (!phaseGroups[phaseName]) {
          phaseGroups[phaseName] = [];
        }
        phaseGroups[phaseName].push(task);
      });
    }

    return Object.entries(phaseGroups).map(([name, phaseTasks], index) => ({
      name,
      order: index,
      tasks: phaseTasks,
      completedCount: phaseTasks.filter(t => t.status === "completed").length,
    }));
  }, [tasks]);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Projeto não encontrado</h2>
          <Button onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const viewTabs = [
    { id: "trail" as ViewType, icon: Map, label: "Trilha" },
    { id: "timeline" as ViewType, icon: Calendar, label: "Cronograma" },
    { id: "list" as ViewType, icon: List, label: "Lista" },
    { id: "tickets" as ViewType, icon: MessageSquare, label: "Chamados" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header - Mobile optimized */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">
                {company?.name || project.product_name}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {project.product_name}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
          </div>
        </div>
      </header>

      {/* View selector tabs */}
      <div className="sticky top-[88px] z-40 bg-background border-b">
        <div className="flex overflow-x-auto scrollbar-hide">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`
                  flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3
                  text-sm font-medium transition-all border-b-2
                  ${isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <main className="p-4">
        <AnimatePresence mode="wait">
          {activeView === "trail" && (
            <motion.div
              key="trail"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientJourneyTrail
                phases={phases}
                onTaskClick={handleTaskClick}
              />
            </motion.div>
          )}

          {activeView === "timeline" && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientTimelineView
                tasks={tasks}
                onTaskClick={handleTaskClick}
              />
            </motion.div>
          )}

          {activeView === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientTasksList
                tasks={tasks}
                onTaskClick={handleTaskClick}
              />
            </motion.div>
          )}

          {activeView === "tickets" && (
            <motion.div
              key="tickets"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <TicketsPanel projectId={project.id} users={users} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Task detail sheet */}
      <ClientTaskDetailSheet
        task={selectedTask}
        open={showTaskDetail}
        onOpenChange={setShowTaskDetail}
      />

      {/* Welcome card for first visit - shows on trail view */}
      {activeView === "trail" && progressPercent === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 left-4 right-4 z-50"
        >
          <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                <Map className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Bem-vindo à sua jornada!</h3>
                <p className="text-sm opacity-90 mt-1">
                  Toque nas fases para ver as etapas do seu projeto.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ClientOnboardingPage;
