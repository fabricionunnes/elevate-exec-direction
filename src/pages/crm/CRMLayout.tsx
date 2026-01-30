import { useEffect, useState, createContext, useContext } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Plus,
  Bell,
  Menu,
} from "lucide-react";
import logoUnv from "@/assets/logo-unv-nexus.png";
import { CRMOriginsSidebar } from "@/components/crm/CRMOriginsSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const CRM_ROLES = ["master", "admin", "head_comercial", "closer", "sdr", "social_setter", "bdr"];

interface CRMContextType {
  staffRole: string | null;
  staffName: string | null;
  staffId: string | null;
  isAdmin: boolean;
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

const navTabs = [
  { title: "Dashboard", href: "/crm/reports" },
  { title: "Negócios", href: "/crm/pipeline" },
  { title: "Contatos", href: "/crm/leads" },
  { title: "Atividades", href: "/crm/activities" },
  { title: "Atendimento", href: "/crm/inbox", badge: true },
];

export const CRMLayout = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
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
          .select("id, role, name")
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
  const initials = staffName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  const isTabActive = (href: string) => {
    if (href === "/crm/reports") {
      return location.pathname === "/crm" || location.pathname.startsWith("/crm/reports");
    }
    return location.pathname.startsWith(href);
  };

  const isInboxRoute = location.pathname.includes("/crm/inbox");

  return (
    <CRMContext.Provider value={{
      staffRole,
      staffName,
      staffId,
      isAdmin,
      selectedOrigin,
      setSelectedOrigin,
      selectedPipeline,
      setSelectedPipeline,
    }}>
      <div
        className={cn(
          "bg-background flex flex-col",
          // Inbox must not allow body/page scroll; keep scroll inside the inbox panes.
          isInboxRoute ? "h-dvh overflow-hidden" : "min-h-screen",
        )}
      >
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card flex items-center px-2 sm:px-4 gap-2 sm:gap-4 sticky top-0 z-50">
          {/* Mobile Menu Toggle */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="flex items-center gap-2">
                    <img src={logoUnv} alt="UNV Nexus" className="h-6" />
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-2">
                  {navTabs.map((tab) => (
                    <Link
                      key={tab.href}
                      to={tab.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-4 py-3 text-sm font-medium rounded-md transition-colors relative flex items-center gap-2",
                        isTabActive(tab.href)
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {tab.title}
                      {tab.badge && (
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                      )}
                    </Link>
                  ))}
                  {isAdmin && (
                    <Link
                      to="/crm/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
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
          <Link to="/crm" className="flex items-center gap-2 shrink-0">
            <img src={logoUnv} alt="UNV Nexus" className="h-6 sm:h-7" />
          </Link>

          {/* Navigation Tabs - Hidden on Mobile */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navTabs.map((tab) => (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors relative",
                  isTabActive(tab.href)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.title}
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </Link>
            ))}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  ⋮ Mais
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/crm">Dashboard</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/crm/settings">Configurações</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="absolute top-0 right-0 sm:top-1 sm:right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>


            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-9 sm:w-9">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="font-medium text-sm">{staffName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{staffRole}</p>
                </div>
                <DropdownMenuSeparator />
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
                  className="flex items-center gap-2 text-red-600"
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
        </header>

        {/* Main Content with Sidebar */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Origins Sidebar - Hidden on Mobile, use Sheet instead */}
          {!isMobile && (location.pathname.includes("/crm/pipeline") || 
            location.pathname === "/crm" ||
            location.pathname.includes("/crm/leads")) && (
            <CRMOriginsSidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          )}

          {/* Mobile Sidebar Sheet */}
          {isMobile && (location.pathname.includes("/crm/pipeline") || 
            location.pathname === "/crm" ||
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
            isInboxRoute ? "overflow-hidden" : "overflow-auto"
          )}>
            <Outlet context={{ staffRole, isAdmin, staffId }} />
          </main>
        </div>
      </div>
    </CRMContext.Provider>
  );
};
