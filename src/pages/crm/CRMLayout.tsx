import { useEffect, useState, createContext, useContext } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ChevronLeft,
  Settings,
  User,
  LogOut,
  HelpCircle,
  Menu,
  LayoutDashboard,
  Kanban,
  Users,
  ListTodo,
  MessageSquare,
  FileText,
  CalendarDays,
  TrendingUp,
  Repeat2,
  ClipboardList,
  Building2,
  BarChart3,
  Phone,
  ChevronDown,
} from "lucide-react";
import logoUnv from "@/assets/logo-unv-nexus.png";
import { CRMOriginsSidebar } from "@/components/crm/CRMOriginsSidebar";
import { CRMNotificationsBell } from "@/components/crm/CRMNotificationsBell";
import { useIsMobile } from "@/hooks/use-mobile";

const CRM_ROLES = ["master", "admin", "head_comercial", "closer", "sdr", "social_setter", "bdr"];

interface CRMContextType {
  staffRole: string | null;
  staffName: string | null;
  staffId: string | null;
  isAdmin: boolean;
  isMaster: boolean;
  selectedOrigin: string | null;
  setSelectedOrigin: (id: string | null) => void;
  selectedPipeline: string | null;
  setSelectedPipeline: (id: string | null) => void;
}

const CRMContext = createContext<CRMContextType | null>(null);

export const useCRMContext = () => {
  const context = useContext(CRMContext);
  if (!context) throw new Error("useCRMContext must be used within CRMLayout");
  return context;
};

const baseNavTabs = [
  { title: "Dashboard", href: "/crm/reports", icon: LayoutDashboard },
  { title: "Negócios", href: "/crm/pipeline", icon: Kanban },
  { title: "Contatos", href: "/crm/leads", icon: Users },
  { title: "Atividades", href: "/crm/activities", icon: ListTodo },
  { title: "Atendimento", href: "/crm/inbox", icon: MessageSquare, badge: true },
  { title: "Transcrições", href: "/crm/transcriptions", icon: FileText },
  { title: "Contratos", href: "/contratos", icon: ClipboardList },
  { title: "Reuniões", href: "/crm/meetings", icon: CalendarDays },
  { title: "Forecast", href: "/crm/forecast", icon: TrendingUp },
  { title: "Cadências", href: "/crm/cadences", icon: Repeat2 },
  { title: "Aplicações", href: "/crm/applications", icon: BarChart3 },
  { title: "Nota Fiscal", href: "/onboarding-tasks/nota-fiscal", icon: FileText },
  { title: "Escritório", href: "/crm/office", icon: Building2 },
];

const getNavTabs = (role: string | null) => {
  const tabs = [...baseNavTabs];
  if (role === "master" || role === "head_comercial") {
    tabs.push({ title: "Head Comercial", href: "/crm/head", icon: BarChart3 });
  }
  if (role === "master" || role === "admin" || role === "head_comercial") {
    tabs.push({ title: "Resumo Calls", href: "/crm/call-summary", icon: Phone });
  }
  return tabs;
};

// Tabs principais visíveis na navbar (sem overflow)
const MAIN_TAB_HREFS = [
  "/crm/reports",
  "/crm/pipeline",
  "/crm/leads",
  "/crm/activities",
  "/crm/inbox",
];

export const CRMLayout = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffAvatarUrl, setStaffAvatarUrl] = useState<string | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          navigate("/onboarding-tasks/login");
          return;
        }

        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id, role, name, avatar_url")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!staff) {
          navigate("/onboarding-tasks");
          return;
        }

        // Only master has automatic access - admins need explicit permission
        if (staff.role === "master") {
          setHasAccess(true);
          setStaffRole(staff.role);
          setStaffName(staff.name);
          setStaffId(staff.id);
          setStaffAvatarUrl(staff.avatar_url);
          setIsLoading(false);
          return;
        }

        if (!CRM_ROLES.includes(staff.role)) {
          navigate("/onboarding-tasks");
          return;
        }

        const { data: permission } = await supabase
          .from("staff_menu_permissions")
          .select("id")
          .eq("staff_id", staff.id)
          .eq("menu_key", "crm")
          .maybeSingle();

        if (!permission) {
          navigate("/onboarding-tasks");
          return;
        }

        setHasAccess(true);
        setStaffRole(staff.role);
        setStaffName(staff.name);
        setStaffId(staff.id);
        setStaffAvatarUrl(staff.avatar_url);
      } catch (error) {
        console.error("[CRM] Error checking access:", error);
        navigate("/onboarding-tasks/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasAccess) return null;

  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";
  const isMaster = staffRole === "master";
  const initials = staffName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";
  const navTabs = getNavTabs(staffRole);

  const isTabActive = (href: string) => {
    if (href === "/crm/reports") {
      return location.pathname === "/crm" || location.pathname.startsWith("/crm/reports");
    }
    return location.pathname.startsWith(href);
  };

  const isInboxRoute = location.pathname.includes("/crm/inbox");
  const isPipelineRoute = location.pathname.includes("/crm/pipeline");
  const lockViewportHeight = isInboxRoute || isPipelineRoute;

  const mainTabs = navTabs.filter((t) => MAIN_TAB_HREFS.includes(t.href));
  const moreTabs = navTabs.filter((t) => !MAIN_TAB_HREFS.includes(t.href));
  const isMoreActive = moreTabs.some((t) => isTabActive(t.href));

  return (
    <CRMContext.Provider value={{
      staffRole,
      staffName,
      staffId,
      isAdmin,
      isMaster,
      selectedOrigin,
      setSelectedOrigin,
      selectedPipeline,
      setSelectedPipeline,
    }}>
      <div
        className={cn(
          "bg-background flex flex-col",
          lockViewportHeight ? "h-dvh overflow-hidden" : "min-h-screen",
        )}
      >
        {/* Top Header */}
        <header className="mobile-safe-header sticky top-0 z-50 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center h-14 px-3 sm:px-5 gap-3">

            {/* Mobile Menu Toggle */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="p-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2">
                      <img src={logoUnv} alt="UNV Nexus" className="h-6" />
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col p-2 gap-0.5">
                    {navTabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <Link
                          key={tab.href}
                          to={tab.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "px-3 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-3",
                            isTabActive(tab.href)
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {tab.title}
                          {tab.badge && (
                            <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full" />
                          )}
                        </Link>
                      );
                    })}
                    {isAdmin && (
                      <Link
                        to="/crm/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-3"
                      >
                        <Settings className="h-4 w-4" />
                        Configurações
                      </Link>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            )}

            {/* Logo */}
            <Link to="/crm" className="flex items-center gap-2 shrink-0 mr-1">
              <img src={logoUnv} alt="UNV Nexus" className="h-6 sm:h-7" />
            </Link>

            {/* Divider */}
            <div className="hidden md:block h-5 w-px bg-border/70 shrink-0" />

            {/* Navigation Tabs - Desktop */}
            <nav className="hidden md:flex items-stretch h-14 gap-0.5 flex-1">
              {mainTabs.map((tab) => {
                const Icon = tab.icon;
                const active = isTabActive(tab.href);
                return (
                  <Link
                    key={tab.href}
                    to={tab.href}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3.5 text-sm font-medium transition-all",
                      "border-b-2 -mb-px",
                      active
                        ? "text-primary border-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {tab.title}
                    {tab.badge && (
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    )}
                  </Link>
                );
              })}

              {/* Mais dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "relative flex items-center gap-1.5 px-3.5 text-sm font-medium transition-all outline-none",
                      "border-b-2 -mb-px",
                      isMoreActive
                        ? "text-primary border-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                    )}
                  >
                    Mais
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {moreTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <DropdownMenuItem key={tab.href} asChild>
                        <Link to={tab.href} className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {tab.title}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/crm/settings" className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          Configurações
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {isMaster && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/crm/api" className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          API
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/crm/trafego-pago/api" className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          API · Tráfego Pago
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 ml-auto">
              <CRMNotificationsBell staffId={staffId} />

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-muted/60"
                  >
                    <Avatar className="h-6 w-6">
                      {staffAvatarUrl && <AvatarImage src={staffAvatarUrl} alt={staffName || ""} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                      {staffName?.split(" ")[0]}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="font-semibold text-sm">{staffName}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{staffRole?.replace("_", " ")}</p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link to="/crm/settings" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Conta
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/crm/settings" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configurações
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Ajuda
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/onboarding-tasks" className="flex items-center gap-2">
                      <ChevronLeft className="h-4 w-4" />
                      Voltar ao Nexus
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                    onClick={() => {
                      supabase.auth.signOut();
                      navigate("/onboarding-tasks/login");
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

      {/* Main Content with Sidebar */}
        <div className={cn(
          "flex flex-1 min-h-0",
          lockViewportHeight ? "overflow-hidden" : ""
        )}>
          {/* Origins Sidebar - Hidden on Mobile, use Sheet instead */}
          {!isMobile && (location.pathname.includes("/crm/pipeline") || 
            location.pathname.includes("/crm/leads")) && (
            <div className={cn(
              "shrink-0 self-start",
              lockViewportHeight
                ? "h-full"
                : "sticky top-14 h-[calc(100dvh-3.5rem)]"
            )}>
              <CRMOriginsSidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </div>
          )}

          {/* Mobile Sidebar Sheet */}
          {isMobile && (location.pathname.includes("/crm/pipeline") || 
            location.pathname.includes("/crm/leads")) && (
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="fixed bottom-4 left-4 z-40 shadow-lg"
                >
                  Origens
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <CRMOriginsSidebar
                  collapsed={false}
                  onToggleCollapse={() => setMobileSidebarOpen(false)}
                />
              </SheetContent>
            </Sheet>
          )}

          {/* Main Content - use overflow-hidden for inbox page to contain scroll internally */}
          <main className={cn(
            "flex-1 min-h-0",
             lockViewportHeight ? "overflow-hidden" : "overflow-auto"
          )}>
            <Outlet context={{ staffRole, isAdmin, staffId }} />
          </main>
        </div>
      </div>
    </CRMContext.Provider>
  );
};
