import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClientAccessTracking } from "@/hooks/useClientAccessTracking";
import { useClientActivityTracking } from "@/hooks/useClientActivityTracking";
import { useClientPermissions, VIEW_TO_MENU_KEY } from "@/hooks/useClientPermissions";
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
  Gift,
  Users,
  Wallet,
  Package,
  ShoppingBag,
  Briefcase,
  ChevronRight,
  GraduationCap,
  ExternalLink,
  Send,
  CalendarDays,
  Receipt,
  Megaphone,
  Filter as FunnelIcon,
  Instagram,
  BrainCircuit,
  Target,
  Building,
  DollarSign,
} from "lucide-react";
import { ShoppingCart } from "lucide-react";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { motion, AnimatePresence } from "framer-motion";
import { ClientJourneyTrail } from "@/components/client-portal/ClientJourneyTrail";
import { ClientCalendarView } from "@/components/client-portal/ClientCalendarView";
import { ClientTasksList } from "@/components/client-portal/ClientTasksList";
import { ClientTaskDetailSheet } from "@/components/client-portal/ClientTaskDetailSheet";
import { ClientSettingsSheet } from "@/components/client-portal/ClientSettingsSheet";
import { ThemeToggle } from "@/components/settings/ThemeToggle";

import { TicketsPanel } from "@/components/onboarding-tasks/TicketsPanel";
import { GoalProjectionAlertDialog } from "@/components/onboarding-tasks/GoalProjectionAlertDialog";
import { ClientSupportButton } from "@/components/client-portal/ClientSupportButton";
import { SupportHistoryPanel } from "@/components/onboarding-tasks/SupportHistoryPanel";
import { ClientMeetingsView } from "@/components/client-portal/ClientMeetingsView";
import { ClientAssessmentsView } from "@/components/client-portal/ClientAssessmentsView";
import { KPIMetasPanel } from "@/components/onboarding-tasks/kpis/KPIMetasPanel";
import { ClientReferralsPanel } from "@/components/client-portal/ClientReferralsPanel";
import { ClientHRView } from "@/components/client-portal/ClientHRView";
import { ClientVirtualBoard } from "@/components/onboarding-tasks/ClientVirtualBoard";
import { ClientFinancialModule } from "@/components/client-financial/ClientFinancialModule";
import { ClientInventoryModule } from "@/components/client-inventory/ClientInventoryModule";
import { ClientSalesModule } from "@/components/client-sales/ClientSalesModule";
import { ClientAppointmentsModule } from "@/components/client-appointments/ClientAppointmentsModule";
import { ClientCustomersPanel } from "@/components/client-inventory/ClientCustomersPanel";
import { ClientBillingPanel } from "@/components/client-portal/ClientBillingPanel";
import { ClientPaidTrafficPanel } from "@/components/client-portal/ClientPaidTrafficPanel";
import { BillingBlockedScreen } from "@/components/client-portal/BillingBlockedScreen";
import { ClientInstagramModule } from "@/components/client-instagram/ClientInstagramModule";
import { SalesFunnelPanel } from "@/components/sales-funnel/SalesFunnelPanel";
import { CommercialDirectorModule } from "@/components/commercial-director/CommercialDirectorModule";
import { ClientOtherServicesPanel } from "@/components/client-portal/ClientOtherServicesPanel";
import { ClientCRMModule } from "@/components/client-crm/ClientCRMModule";
import { B2BProspectionEmbed } from "@/components/b2b-prospection/B2BProspectionEmbed";
import { StrategicDiagnosticModule } from "@/components/client-diagnostic/StrategicDiagnosticModule";
const ClientUNVOffice = lazy(() => import("@/components/client-office/ClientUNVOffice"));
import { SFCommissionsPanel } from "@/components/sf-commissions/SFCommissionsPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Brain } from "lucide-react";
import { CLIENT_MENU_KEYS } from "@/types/onboarding";
import { Card, CardContent } from "@/components/ui/card";

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
  status: "pending" | "in_progress" | "completed" | "inactive";
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

import type { OnboardingUser } from "@/types/onboarding";

interface TaskPhase {
  name: string;
  order: number;
  tasks: OnboardingTask[];
  completedCount: number;
}

type ViewType = "kpis" | "trail" | "timeline" | "list" | "metrics" | "tickets" | "supports" | "meetings" | "assessments" | "referrals" | "rh" | "board" | "financial" | "inventory" | "sales" | "customers" | "appointments" | "billing" | "paid_traffic" | "sales_funnel" | "instagram" | "commercial_director" | "other_services" | "crm_comercial" | "b2b_prospection" | "diagnostic" | "unv_office" | "sf_comissoes";

const ClientOnboardingPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [isBillingBlocked, setIsBillingBlocked] = useState(false);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [currentUser, setCurrentUser] = useState<OnboardingUser | null>(null);
  const [activeView, setActiveView] = useState<ViewType>("kpis");
  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);

  // IMPORTANT: hooks must be called unconditionally (before any early returns)
  const {
    loading: permissionsLoading,
    hasPermission,
    hasAnyPermission,
    isFullAccess,
    salespersonId,
  } = useClientPermissions(projectId);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    
    const { data: tasksData } = await supabase
      .from("onboarding_tasks")
      .select(`
        *,
        assignee:onboarding_users!onboarding_tasks_assignee_id_fkey(id, name, role, avatar_url),
        responsible_staff:onboarding_staff!onboarding_tasks_responsible_staff_id_fkey(id, name, avatar_url)
      `)
      .eq("project_id", projectId)
      .neq("status", "inactive")
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

        // Fetch all projects the user has access to (only active ones)
        const { data: allUserProjects } = await supabase
          .from("onboarding_users")
          .select("project:onboarding_projects(id, product_name, status, onboarding_company:onboarding_companies(name, status))")
          .eq("user_id", user.id);

        if (allUserProjects && isMounted) {
          const projects = allUserProjects
            .map(u => u.project)
            .filter((p): p is UserProject & { status: string; onboarding_company: { name: string; status: string } | null } => {
              if (!p) return false;
              // Only show active projects with active companies
              const isProjectActive = p.status !== "closed" && p.status !== "completed";
              const isCompanyActive = !p.onboarding_company || p.onboarding_company.status !== "inactive";
              return isProjectActive && isCompanyActive;
            });
          setUserProjects(projects);
        }

        // Find onboarding user for this project
        const { data: onboardingUser, error: userError } = await supabase
          .from("onboarding_users")
          .select("*, project:onboarding_projects(*, onboarding_company:onboarding_companies(name, status, is_billing_blocked, billing_unblocked_at))")
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

        // Block access if project is closed/completed or company is inactive
        const projectStatus = onboardingUser.project?.status;
        const companyStatus = onboardingUser.project?.onboarding_company?.status;
        
        if (projectStatus === "closed" || projectStatus === "completed" || companyStatus === "inactive") {
          toast.error("Este projeto foi encerrado e não está mais disponível");
          await supabase.auth.signOut();
          navigate("/onboarding-tasks/login");
          return;
        }

        console.log("[ClientOnboardingPage] onboardingUser.project:", onboardingUser.project);
        console.log("[ClientOnboardingPage] onboarding_company_id:", onboardingUser.project?.onboarding_company_id);

        setCurrentUser(onboardingUser);
        setProject(onboardingUser.project);
        setCompany(onboardingUser.project?.onboarding_company);

        // Check billing block: either from DB flag or by checking overdue invoices > 5 days
        const companyData = onboardingUser.project?.onboarding_company;
        let billingBlocked = (companyData as any)?.is_billing_blocked || false;

        if (!billingBlocked && onboardingUser.project?.onboarding_company_id) {
          // Check if there are invoices overdue > 5 days directly by date
          const fiveDaysAgo = new Date();
          fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
          const fiveDaysAgoStr = fiveDaysAgo.toISOString().split("T")[0];

          // Check grace period: if manually unblocked, only re-block 5 days after unblock
          const unblockedAt = (companyData as any)?.billing_unblocked_at;
          let pastGracePeriod = true;
          if (unblockedAt) {
            const unblockedDate = new Date(unblockedAt);
            const gracePeriodEnd = new Date(unblockedDate);
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);
            pastGracePeriod = new Date() >= gracePeriodEnd;
          }

          if (pastGracePeriod) {
            const { data: overdueInvoices } = await supabase
              .from("company_invoices")
              .select("id")
              .eq("company_id", onboardingUser.project.onboarding_company_id)
              .in("status", ["pending", "overdue"])
              .lt("due_date", fiveDaysAgoStr)
              .limit(1);

            if (overdueInvoices && overdueInvoices.length > 0) {
              billingBlocked = true;
              // Also update the DB flag
              await supabase
                .from("onboarding_companies")
                .update({
                  is_billing_blocked: true,
                  billing_blocked_at: new Date().toISOString(),
                  billing_blocked_reason: "Bloqueio automático: fatura vencida há mais de 5 dias",
                  billing_unblocked_at: null,
                } as any)
                .eq("id", onboardingUser.project.onboarding_company_id);
            }
          }
        }

        setIsBillingBlocked(billingBlocked);

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

  // Track client access
  const { sessionId } = useClientAccessTracking(
    currentUser && project
      ? {
          userId: currentUser.user_id!,
          userEmail: currentUser.email,
          userName: currentUser.name,
          projectId: project.id,
          companyId: project.onboarding_company_id || undefined,
        }
      : null
  );

  // Track client activities
  const { trackPageView, trackTabChanged, trackTaskCompleted } = useClientActivityTracking(
    currentUser && project
      ? {
          userId: currentUser.user_id!,
          projectId: project.id,
          accessLogId: sessionId,
        }
      : null
  );

  // Track page view on load
  useEffect(() => {
    if (currentUser && project && sessionId) {
      trackPageView("Portal do Cliente", window.location.hash);
    }
  }, [currentUser, project, sessionId, trackPageView]);

  // Track tab changes
  useEffect(() => {
    if (currentUser && project && sessionId && activeView) {
      const viewNames: Record<ViewType, string> = {
        kpis: "KPIs e Metas",
        trail: "Jornada",
        timeline: "Calendário",
        list: "Lista de Tarefas",
        metrics: "Métricas",
        tickets: "Chamados",
        supports: "Suporte",
        meetings: "Reuniões",
        assessments: "Avaliações",
        referrals: "Indicações",
        rh: "RH",
        board: "Board Virtual",
        financial: "Financeiro",
        inventory: "Estoque & Compras",
        sales: "Vendas",
        customers: "Clientes",
        appointments: "Agendamentos",
        billing: "Minhas Faturas",
        paid_traffic: "Tráfego Pago",
        sales_funnel: "Funil de Vendas",
        instagram: "Instagram",
        commercial_director: "Diretor Comercial IA",
        other_services: "Outros Serviços",
        crm_comercial: "CRM Comercial",
        b2b_prospection: "Prospecção B2B",
        diagnostic: "Diagnóstico",
        unv_office: "UNV Office",
        sf_comissoes: "Comissões",
      };
      trackTabChanged(viewNames[activeView] || activeView);
    }
  }, [activeView, currentUser, project, sessionId, trackTabChanged]);

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
    const phaseGroups: Record<string, { tasks: OnboardingTask[]; order: number }> = {};
    
    tasks.forEach(task => {
      // Use tags for phase name and order
      const phaseName = task.tags?.[0] || "Tarefas";
      const phaseOrder = task.tags?.[1] ? parseInt(task.tags[1]) : 999;
      
      if (!phaseGroups[phaseName]) {
        phaseGroups[phaseName] = { tasks: [], order: phaseOrder };
      }
      phaseGroups[phaseName].tasks.push(task);
      // Use the smallest order found for this phase
      if (phaseOrder < phaseGroups[phaseName].order) {
        phaseGroups[phaseName].order = phaseOrder;
      }
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
          phaseGroups[phaseName] = { tasks: [], order: phaseIndex + 1 };
        }
        phaseGroups[phaseName].tasks.push(task);
      });
    }

    return Object.entries(phaseGroups)
      .map(([name, group]) => ({
        name,
        order: group.order,
        tasks: group.tasks,
        completedCount: group.tasks.filter(t => t.status === "completed").length,
      }))
      .sort((a, b) => a.order - b.order);
  }, [tasks]);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Menu structure with submenus - filtered by permissions
  // IMPORTANT: this is a hook (useMemo) and must stay above any conditional return
  const menuStructure = useMemo(() => {
    const allMenus = [
      { id: "kpis" as ViewType, icon: BarChart3, label: "KPIs", menuKey: CLIENT_MENU_KEYS.kpis },
      {
        id: "trilha-group",
        icon: Map,
        label: "Jornada",
        submenu: [
          { id: "trail" as ViewType, icon: Map, label: "Trilha", menuKey: CLIENT_MENU_KEYS.jornada_trilha },
          { id: "list" as ViewType, icon: List, label: "Lista", menuKey: CLIENT_MENU_KEYS.jornada_lista },
          { id: "timeline" as ViewType, icon: Calendar, label: "Cronograma", menuKey: CLIENT_MENU_KEYS.jornada_cronograma },
        ],
      },
      {
        id: "gestao-group",
        icon: Briefcase,
        label: "Gestão",
        submenu: [
          { id: "customers" as ViewType, icon: Users, label: "Clientes", menuKey: CLIENT_MENU_KEYS.gestao_clientes },
          { id: "sales" as ViewType, icon: ShoppingBag, label: "Vendas", menuKey: CLIENT_MENU_KEYS.gestao_vendas },
          { id: "financial" as ViewType, icon: Wallet, label: "Financeiro", menuKey: CLIENT_MENU_KEYS.gestao_financeiro },
          { id: "inventory" as ViewType, icon: Package, label: "Estoque", menuKey: CLIENT_MENU_KEYS.gestao_estoque },
          { id: "appointments" as ViewType, icon: CalendarDays, label: "Agendamentos", menuKey: CLIENT_MENU_KEYS.gestao_agendamentos },
        ],
      },
      { id: "tickets" as ViewType, icon: MessageSquare, label: "Chamados", menuKey: CLIENT_MENU_KEYS.chamados },
      { id: "meetings" as ViewType, icon: Video, label: "Reuniões", menuKey: CLIENT_MENU_KEYS.reunioes },
      { id: "assessments" as ViewType, icon: ClipboardCheck, label: "Testes", menuKey: CLIENT_MENU_KEYS.testes },
      { id: "rh" as ViewType, icon: Users, label: "RH", menuKey: CLIENT_MENU_KEYS.rh },
      { id: "board" as ViewType, icon: Brain, label: "Board", menuKey: CLIENT_MENU_KEYS.board },
      { id: "academy" as const, icon: GraduationCap, label: "Academy", href: "/academy", menuKey: CLIENT_MENU_KEYS.unv_academy },
      { id: "referrals" as ViewType, icon: Gift, label: "Indicar", menuKey: CLIENT_MENU_KEYS.indicar },
      { id: "billing" as ViewType, icon: Receipt, label: "Faturas", menuKey: CLIENT_MENU_KEYS.minhas_faturas },
      { id: "paid_traffic" as ViewType, icon: Megaphone, label: "Tráfego Pago", menuKey: CLIENT_MENU_KEYS.trafego_pago },
      { id: "sales_funnel" as ViewType, icon: FunnelIcon, label: "Funil de Vendas", menuKey: CLIENT_MENU_KEYS.funil_vendas },
      { id: "instagram" as ViewType, icon: Instagram, label: "Instagram", menuKey: CLIENT_MENU_KEYS.instagram },
      { id: "social" as const, icon: Instagram, label: "UNV Social IA", href: `/social/${projectId}`, menuKey: CLIENT_MENU_KEYS.unv_social },
      { id: "commercial_director" as ViewType, icon: BrainCircuit, label: "Diretor Comercial IA", menuKey: CLIENT_MENU_KEYS.diretor_comercial_ia },
      { id: "other_services" as ViewType, icon: ShoppingCart, label: "Outros Serviços", menuKey: CLIENT_MENU_KEYS.outros_servicos },
      { id: "crm_comercial" as ViewType, icon: Briefcase, label: "CRM Comercial", menuKey: CLIENT_MENU_KEYS.crm_comercial },
      { id: "b2b_prospection" as ViewType, icon: Target, label: "Prospecção B2B", menuKey: CLIENT_MENU_KEYS.prospeccao_b2b },
      { id: "diagnostic" as ViewType, icon: ClipboardCheck, label: "Diagnóstico", menuKey: CLIENT_MENU_KEYS.diagnostico },
      { id: "unv_office" as ViewType, icon: Building, label: "UNV Office", menuKey: CLIENT_MENU_KEYS.unv_office },
    ];

    // Add SF Commissions menu only for UNV Sales Force projects and admin roles (client/gerente)
    const isSalesForceProject = project?.product_name === "UNV Sales Force";
    const isAdminRole = currentUser?.role === "client" || currentUser?.role === "gerente";
    if (isSalesForceProject && isAdminRole) {
      allMenus.push({ id: "sf_comissoes" as ViewType, icon: DollarSign, label: "Comissões", menuKey: CLIENT_MENU_KEYS.sf_comissoes as any });
    }

    // Project-level menu filtering applies to ALL roles including full access

    return allMenus
      .map((item) => {
        if ("submenu" in item && item.submenu) {
          const filteredSubmenu = item.submenu.filter((subItem) => hasPermission(subItem.menuKey));
          if (filteredSubmenu.length === 0) return null;
          return { ...item, submenu: filteredSubmenu };
        }
        if ("menuKey" in item && !hasPermission(item.menuKey)) return null;
        return item;
      })
      .filter(Boolean) as typeof allMenus;
  }, [hasPermission]);

  const hasViewAccess = useCallback(
    (view: ViewType) => {
      const key = VIEW_TO_MENU_KEY[view];
      // Some views are legacy/unused; if not mapped, default to allow (they won't appear in menu anyway)
      if (!key) return true;
      return hasPermission(key);
    },
    [hasPermission]
  );

  // If user lands in a view they can't access (direct link/state), move to the first allowed menu.
  useEffect(() => {
    if (loading || permissionsLoading) return;
    if (!activeView) return;
    if (hasViewAccess(activeView)) return;

    const firstAllowed = (() => {
      const first = menuStructure[0] as any;
      if (!first) return null;
      if (first.submenu && first.submenu.length > 0) return first.submenu[0].id as ViewType;
      return first.id as ViewType;
    })();

    if (firstAllowed) setActiveView(firstAllowed);
  }, [activeView, hasViewAccess, loading, menuStructure, permissionsLoading]);

  if (loading || permissionsLoading) {
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
          <Button onClick={() => navigate("/onboarding-tasks/login")}>Voltar</Button>
        </div>
      </div>
    );
  }

  // Show billing blocked screen
  if (isBillingBlocked && project?.onboarding_company_id) {
    return (
      <BillingBlockedScreen
        companyId={project.onboarding_company_id}
        companyName={company?.name}
      />
    );
  }

  // Helper to check if active view is in a submenu
  const isInSubmenu = (submenu: { id: ViewType }[] | undefined) => {
    return submenu?.some(item => item.id === activeView);
  };

  // Get company ID for customer points link
  const companyId = project?.onboarding_company_id;

  const handleSwitchProject = (newProjectId: string) => {
    if (newProjectId !== projectId) {
      navigate(`/onboarding-client/${newProjectId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-4 safe-area-inset">
      {/* Goal Projection Alert Dialog for clients */}
      {projectId && project && (
        <GoalProjectionAlertDialog
          projectId={projectId}
          companyName={company?.name || project.product_name}
          isStaff={false}
          onNavigateToGoals={() => setActiveView("kpis")}
        />
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background backdrop-blur-md border-b">
        <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] max-w-7xl mx-auto">
          {/* Top row: Welcome + Actions */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Left: Welcome + Company */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <WelcomeHeader showAvatar className="hidden md:flex text-sm text-foreground" />
              
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

            {/* Right: Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {companyId && hasPermission(CLIENT_MENU_KEYS.pontuacao) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="hidden md:flex gap-2 text-muted-foreground hover:text-primary"
                  onClick={() => navigate(`/customer-points/${companyId}`)}
                >
                  <Gift className="h-4 w-4" />
                  <span>Pontuação</span>
                </Button>
              )}

              {hasPermission(CLIENT_MENU_KEYS.unv_circle) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="hidden md:flex gap-2 text-muted-foreground hover:text-primary"
                  onClick={() => navigate("/circle")}
                >
                  <Users className="h-4 w-4" />
                  <span>UNV Circle</span>
                </Button>
              )}

              {hasPermission(CLIENT_MENU_KEYS.unv_disparador) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="hidden md:flex gap-2 text-muted-foreground hover:text-primary"
                  onClick={() => navigate(`/disparador/${projectId}`)}
                >
                  <Send className="h-4 w-4" />
                  <span>UNV Disparador</span>
                </Button>
              )}

              {hasPermission(CLIENT_MENU_KEYS.crm_unv) && currentUser?.role === "client" && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden md:flex gap-2 text-muted-foreground hover:text-primary"
                >
                  <a
                    href="https://crm.universidadevendas.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>CRM UNV</span>
                  </a>
                </Button>
              )}

              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full touch-manipulation" 
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full touch-manipulation" 
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs font-bold text-primary tabular-nums whitespace-nowrap">{progressPercent}%</span>
          </div>

          {/* Navigation tabs - Desktop with dropdowns */}
          <div className="hidden lg:flex items-center gap-1 flex-wrap">
            {menuStructure.map((item) => {
              const Icon = item.icon;
              
              // Items with submenu
              if ('submenu' in item && item.submenu) {
                const isSubmenuActive = isInSubmenu(item.submenu);
                return (
                  <DropdownMenu key={item.id}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={isSubmenuActive ? "default" : "ghost"}
                        size="sm"
                        className={`gap-1.5 h-8 text-xs ${isSubmenuActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                        <ChevronDown className="h-3 w-3 ml-0.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px]">
                      {item.submenu.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeView === subItem.id;
                        return (
                          <DropdownMenuItem
                            key={subItem.id}
                            onClick={() => setActiveView(subItem.id)}
                            className={`gap-2 cursor-pointer ${isSubActive ? "bg-primary/10 text-primary" : ""}`}
                          >
                            <SubIcon className="h-4 w-4" />
                            <span>{subItem.label}</span>
                            {isSubActive && <Check className="h-3.5 w-3.5 ml-auto" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              
              // Items with external navigation (href)
              if ('href' in item && item.href) {
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(item.href)}
                    className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Button>
                );
              }
              
              // Regular items
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView(item.id as ViewType)}
                  className={`gap-1.5 h-8 text-xs ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom lg:hidden">
        <div className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide px-2">
          {menuStructure.map((item) => {
            const Icon = item.icon;
            
            // Items with submenu - show as sheet/popover on mobile
            if ('submenu' in item && item.submenu) {
              const isSubmenuActive = isInSubmenu(item.submenu);
              return (
                <DropdownMenu key={item.id}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`
                        flex-none w-20 flex flex-col items-center justify-center py-2 px-1 gap-0.5
                        transition-colors touch-manipulation min-h-[62px]
                        ${isSubmenuActive
                          ? "text-primary"
                          : "text-muted-foreground active:text-foreground"
                        }
                      `}
                    >
                      <div className={`
                        p-1.5 rounded-xl transition-colors
                        ${isSubmenuActive ? "bg-primary/10" : ""}
                      `}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-medium leading-tight text-center break-words">{item.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="min-w-[140px] mb-2">
                    {item.submenu.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeView === subItem.id;
                      return (
                        <DropdownMenuItem
                          key={subItem.id}
                          onClick={() => setActiveView(subItem.id)}
                          className={`gap-2 cursor-pointer ${isSubActive ? "bg-primary/10 text-primary" : ""}`}
                        >
                          <SubIcon className="h-4 w-4" />
                          <span>{subItem.label}</span>
                          {isSubActive && <Check className="h-3.5 w-3.5 ml-auto" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            
            // Items with external navigation (href)
            if ('href' in item && item.href) {
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.href)}
                  className="flex-none w-20 flex flex-col items-center justify-center py-2 px-1 gap-0.5 transition-colors touch-manipulation min-h-[62px] text-muted-foreground active:text-foreground"
                >
                  <div className="p-1.5 rounded-xl transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-tight text-center break-words">{item.label}</span>
                </button>
              );
            }
            
            // Regular items
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as ViewType)}
                className={`
                  flex-none w-20 flex flex-col items-center justify-center py-2 px-1 gap-0.5
                  transition-colors touch-manipulation min-h-[62px]
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
                <span className="text-[10px] font-medium leading-tight text-center break-words">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="p-4 pb-0 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeView === "kpis" && hasViewAccess("kpis") && (
            <motion.div
              key="kpis"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <KPIMetasPanel 
                companyId={project.onboarding_company_id || ""} 
                isAdmin={false}
                projectId={projectId}
                salespersonId={salespersonId}
                canSeeDashboard={hasPermission(CLIENT_MENU_KEYS.kpis_dashboard)}
                canSeeEndomarketing={hasPermission(CLIENT_MENU_KEYS.kpis_endomarketing)}
                canSeeSalesLinks={hasPermission(CLIENT_MENU_KEYS.kpis_sales_links)}
                canSeeConfig={hasPermission(CLIENT_MENU_KEYS.kpis_config)}
                isClientView={true}
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

          {activeView === "referrals" && (
            <motion.div
              key="referrals"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientReferralsPanel 
                companyId={companyId || ""} 
                projectId={projectId || ""} 
                userName={currentUser?.name || ""} 
              />
            </motion.div>
          )}

          {activeView === "rh" && (
            <motion.div
              key="rh"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientHRView projectId={projectId || ""} />
            </motion.div>
          )}

          {activeView === "board" && (
            <motion.div
              key="board"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientVirtualBoard 
                projectId={projectId || ""} 
                companyId={companyId || ""}
                companyName={company?.name || ""}
                isClientView={true}
              />
            </motion.div>
          )}

          {activeView === "financial" && (
            <motion.div
              key="financial"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientFinancialModule 
                projectId={projectId || ""} 
                userRole={currentUser?.role}
              />
            </motion.div>
          )}

          {activeView === "inventory" && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientInventoryModule 
                projectId={projectId || ""} 
                userRole={currentUser?.role}
              />
            </motion.div>
          )}

          {activeView === "sales" && (
            <motion.div
              key="sales"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientSalesModule 
                projectId={projectId || ""} 
                userRole={currentUser?.role}
                salespersonId={salespersonId}
              />
            </motion.div>
          )}

          {activeView === "customers" && (
            <motion.div
              key="customers"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientCustomersPanel 
                projectId={projectId || ""} 
                canEdit={true}
              />
            </motion.div>
          )}

          {activeView === "appointments" && (
            <motion.div
              key="appointments"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientAppointmentsModule 
                projectId={projectId || ""} 
                userRole={currentUser?.role}
              />
            </motion.div>
          )}

          {activeView === "billing" && hasViewAccess("billing") && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientBillingPanel companyId={companyId || ""} />
            </motion.div>
          )}

          {activeView === "paid_traffic" && hasViewAccess("paid_traffic") && (
            <motion.div
              key="paid_traffic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientPaidTrafficPanel projectId={projectId || ""} />
            </motion.div>
          )}

          {activeView === "sales_funnel" && (
            <motion.div
              key="sales_funnel"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SalesFunnelPanel
                projectId={projectId || ""}
                companyId={companyId || undefined}
                isStaff={false}
                canEdit={currentUser?.role === "client" || currentUser?.role === "gerente"}
              />
            </motion.div>
          )}

          {activeView === "instagram" && hasViewAccess("instagram") && (
            <motion.div
              key="instagram"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientInstagramModule projectId={projectId || ""} />
            </motion.div>
          )}

          {activeView === "commercial_director" && hasViewAccess("commercial_director") && (
            <motion.div
              key="commercial_director"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <CommercialDirectorModule
                projectId={projectId || ""}
                companyId={companyId || ""}
                companyName={company?.name}
              />
            </motion.div>
          )}

          {activeView === "other_services" && (
            <motion.div
              key="other_services"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientOtherServicesPanel
                projectId={projectId || ""}
                currentUserId={currentUser?.id || ""}
              />
            </motion.div>
          )}

          {activeView === "crm_comercial" && (
            <motion.div
              key="crm_comercial"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClientCRMModule
                projectId={projectId || ""}
                currentUser={currentUser}
              />
            </motion.div>
          )}

          {activeView === "b2b_prospection" && (
            <motion.div
              key="b2b_prospection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="py-4">
                <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                  <B2BProspectionEmbed />
                </Suspense>
              </div>
            </motion.div>
          )}

          {activeView === "diagnostic" && hasViewAccess("diagnostic") && (
            <motion.div
              key="diagnostic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="py-4">
                <StrategicDiagnosticModule projectId={projectId || ""} />
              </div>
            </motion.div>
          )}

          {activeView === "unv_office" && hasViewAccess("unv_office") && (
            <motion.div
              key="unv_office"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                <ClientUNVOffice projectId={projectId || ""} currentUserId={currentUser?.user_id || ""} />
              </Suspense>
            </motion.div>
          )}

          {activeView === "sf_comissoes" && (
            <motion.div
              key="sf_comissoes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SFCommissionsPanel
                projectId={projectId || ""}
                companyId={project?.onboarding_company_id || ""}
                viewerRole={currentUser?.role || null}
              />
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
        userRole={currentUser?.role}
        projectId={projectId}
        companyId={companyId}
        canManageUsers={hasPermission(CLIENT_MENU_KEYS.gestao_usuarios)}
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
