import { useState, useEffect, useMemo, useCallback } from "react";
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
  Settings,
  BarChart3,
  Video,
  ClipboardCheck,
  ChevronDown,
  Building2,
  Check,
} from "lucide-react";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { motion, AnimatePresence } from "framer-motion";
import { ClientJourneyTrail } from "@/components/client-portal/ClientJourneyTrail";
import { ClientCalendarView } from "@/components/client-portal/ClientCalendarView";
import { ClientTasksList } from "@/components/client-portal/ClientTasksList";
import { ClientTaskDetailSheet } from "@/components/client-portal/ClientTaskDetailSheet";
import { ClientSettingsSheet } from "@/components/client-portal/ClientSettingsSheet";

import { TicketsPanel } from "@/components/onboarding-tasks/TicketsPanel";
import { GoalProjectionAlertDialog } from "@/components/onboarding-tasks/GoalProjectionAlertDialog";
import { ClientSupportButton } from "@/components/client-portal/ClientSupportButton";
import { SupportHistoryPanel } from "@/components/onboarding-tasks/SupportHistoryPanel";
import { ClientMeetingsView } from "@/components/client-portal/ClientMeetingsView";
import { ClientAssessmentsView } from "@/components/client-portal/ClientAssessmentsView";
import { KPIMetasPanel } from "@/components/onboarding-tasks/kpis/KPIMetasPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface UserProject {
  id: string;
  product_name: string;
  onboarding_company: { name: string } | null;
}

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
  is_internal: boolean;
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

type ViewType = "kpis" | "trail" | "timeline" | "list" | "metrics" | "tickets" | "supports" | "meetings" | "assessments";

const ClientOnboardingPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [currentUser, setCurrentUser] = useState<OnboardingUser | null>(null);
  const [activeView, setActiveView] = useState<ViewType>("kpis");
  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    
    const { data: tasksData } = await supabase
      .from("onboarding_tasks")
      .select(`
        *,
        assignee:onboarding_users!onboarding_tasks_assignee_id_fkey(id, name, role),
        responsible_staff:onboarding_staff!onboarding_tasks_responsible_staff_id_fkey(id, name)
      `)
      .eq("project_id", projectId)
      .or("is_internal.eq.false,is_internal.is.null") // Filter out internal tasks for clients
      .order("sort_order");

    setTasks(tasksData || []);
  }, [projectId]);

  const fetchUsers = useCallback(async () => {
    if (!projectId) return;
    
    const { data: usersData } = await supabase
      .from("onboarding_users")
      .select("*")
      .eq("project_id", projectId);

    setUsers(usersData || []);
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;
    
    const checkAuthAndLoadData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!isMounted) return;
        
        if (authError || !user) {
          navigate("/onboarding-tasks/login");
          return;
        }

        // Fetch all projects the user has access to
        const { data: allUserProjects } = await supabase
          .from("onboarding_users")
          .select("project:onboarding_projects(id, product_name, onboarding_company:onboarding_companies(name))")
          .eq("user_id", user.id);

        if (allUserProjects && isMounted) {
          const projects = allUserProjects
            .map(u => u.project)
            .filter((p): p is UserProject => p !== null);
          setUserProjects(projects);
        }

        // Find onboarding user for this project
        const { data: onboardingUser, error: userError } = await supabase
          .from("onboarding_users")
          .select("*, project:onboarding_projects(*, onboarding_company:onboarding_companies(name))")
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .maybeSingle();

        if (!isMounted) return;

        if (userError) {
          console.error("Error fetching onboarding user:", userError);
          toast.error("Erro ao carregar dados do usuário");
          navigate("/onboarding-tasks/login");
          return;
        }
        
        if (!onboardingUser) {
          toast.error("Você não tem acesso a este projeto");
          navigate("/onboarding-tasks/login");
          return;
        }

        console.log("[ClientOnboardingPage] onboardingUser.project:", onboardingUser.project);
        console.log("[ClientOnboardingPage] onboarding_company_id:", onboardingUser.project?.onboarding_company_id);

        setCurrentUser(onboardingUser);
        setProject(onboardingUser.project);
        setCompany(onboardingUser.project?.onboarding_company);

        await Promise.all([fetchTasks(), fetchUsers()]);
      } catch (error: any) {
        console.error("Error loading data:", error);
        if (isMounted) {
          toast.error("Erro ao carregar dados");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuthAndLoadData();
    
    return () => {
      isMounted = false;
    };
  }, [projectId, navigate, fetchTasks, fetchUsers]);

  // Real-time subscriptions
  useEffect(() => {
    if (!projectId) return;

    // Subscribe to task changes
    const tasksChannel = supabase
      .channel(`client-tasks-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_tasks',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('Task change received:', payload);
          fetchTasks();
        }
      )
      .subscribe();

    // Subscribe to ticket changes
    const ticketsChannel = supabase
      .channel(`client-tickets-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_tickets',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('Ticket change received:', payload);
          // Tickets panel will handle its own refresh
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(ticketsChannel);
    };
  }, [projectId, fetchTasks]);

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
    { id: "kpis" as ViewType, icon: BarChart3, label: "KPIs" },
    { id: "trail" as ViewType, icon: Map, label: "Trilha" },
    { id: "timeline" as ViewType, icon: Calendar, label: "Cronograma" },
    { id: "list" as ViewType, icon: List, label: "Lista" },
    { id: "tickets" as ViewType, icon: MessageSquare, label: "Chamados" },
    { id: "meetings" as ViewType, icon: Video, label: "Reuniões" },
    { id: "assessments" as ViewType, icon: ClipboardCheck, label: "Testes" },
  ];

  const handleSwitchProject = (newProjectId: string) => {
    if (newProjectId !== projectId) {
      navigate(`/onboarding-client/${newProjectId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-4 safe-area-inset">
      {/* Goal Projection Alert Dialog for clients */}
      {projectId && project && (
        <GoalProjectionAlertDialog
          projectId={projectId}
          companyName={company?.name || project.product_name}
          isStaff={false}
          onNavigateToGoals={() => setActiveView("metrics")}
        />
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/98 backdrop-blur-md border-b safe-area-top">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Company/Project selector */}
            <div className="flex-1 min-w-0">
              <WelcomeHeader className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider" />
              
              {userProjects.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-base md:text-lg font-bold leading-tight hover:text-primary transition-colors group max-w-full">
                      <span className="truncate">{company?.name || project.product_name}</span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 bg-popover border shadow-lg">
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      Seus Projetos
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userProjects.map((proj) => (
                      <DropdownMenuItem
                        key={proj.id}
                        onClick={() => handleSwitchProject(proj.id)}
                        className="flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">
                            {proj.onboarding_company?.name || proj.product_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {proj.product_name}
                          </span>
                        </div>
                        {proj.id === projectId && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <h1 className="text-base md:text-lg font-bold truncate leading-tight">
                  {company?.name || project.product_name}
                </h1>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {viewTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.id;
                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveView(tab.id)}
                    className={`gap-2 ${isActive ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </Button>
                );
              })}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-full touch-manipulation" 
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-full touch-manipulation" 
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs font-bold text-primary tabular-nums">{progressPercent}%</span>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-md border-t safe-area-bottom md:hidden">
        <div className="flex items-stretch">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`
                  flex-1 flex flex-col items-center justify-center py-2 px-1 gap-0.5
                  transition-colors touch-manipulation min-h-[56px]
                  ${isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                  }
                `}
              >
                <div className={`
                  p-1.5 rounded-xl transition-colors
                  ${isActive ? "bg-primary/10" : ""}
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="p-4 pb-0 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeView === "kpis" && (
            <motion.div
              key="kpis"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <KPIMetasPanel 
                companyId={project.onboarding_company_id || ""} 
                isAdmin={false}
              />
            </motion.div>
          )}

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
              <ClientCalendarView
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

          {activeView === "supports" && (
            <motion.div
              key="supports"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SupportHistoryPanel projectId={project.id} />
            </motion.div>
          )}

          {activeView === "meetings" && (
            <motion.div
              key="meetings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientMeetingsView projectId={project.id} />
            </motion.div>
          )}

          {activeView === "assessments" && (
            <motion.div
              key="assessments"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientAssessmentsView projectId={project.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ClientTaskDetailSheet
        task={selectedTask}
        open={showTaskDetail}
        onOpenChange={setShowTaskDetail}
      />

      {/* Settings sheet */}
      <ClientSettingsSheet
        open={showSettings}
        onOpenChange={setShowSettings}
        userName={currentUser?.name || ""}
        userEmail={currentUser?.email || ""}
      />

      {/* Support Button */}
      {currentUser && projectId && (
        <ClientSupportButton
          projectId={projectId}
          userId={currentUser.id}
          userName={currentUser.name}
          companyName={company?.name || project?.product_name || ""}
        />
      )}
      {activeView === "trail" && progressPercent === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-4 right-4 z-40"
        >
          <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                <Map className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Bem-vindo à sua jornada!</h3>
                <p className="text-xs opacity-90 mt-1">
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
