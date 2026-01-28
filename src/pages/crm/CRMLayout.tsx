import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Kanban,
  Users,
  CalendarCheck,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoUnv from "@/assets/logo-unv-nexus.png";

const CRM_ROLES = ["master", "admin", "head_comercial", "closer", "sdr"];

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { title: "Pipeline", href: "/crm/pipeline", icon: Kanban },
  { title: "Leads", href: "/crm/leads", icon: Users },
  { title: "Atividades", href: "/crm/activities", icon: CalendarCheck },
  { title: "Relatórios", href: "/crm/reports", icon: BarChart3 },
  { title: "Configurações", href: "/crm/settings", icon: Settings, adminOnly: true },
];

export const CRMLayout = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        console.log("[CRM] Auth check - user:", user?.id, "error:", authError?.message);
        
        if (authError || !user) {
          console.log("[CRM] No user found, redirecting to login");
          navigate("/onboarding-tasks/login");
          return;
        }

        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id, role, name")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        console.log("[CRM] Staff check - staff:", staff, "error:", staffError?.message);

        if (!staff) {
          console.log("[CRM] No staff record found for user");
          navigate("/onboarding-tasks");
          return;
        }

        if (!CRM_ROLES.includes(staff.role)) {
          console.log("[CRM] Staff role", staff.role, "not in CRM_ROLES:", CRM_ROLES);
          navigate("/onboarding-tasks");
          return;
        }

        console.log("[CRM] Access granted for role:", staff.role);
        setHasAccess(true);
        setStaffRole(staff.role);
        setStaffName(staff.name);
      } catch (error) {
        console.error("[CRM] Error checking CRM access:", error);
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

  if (!hasAccess) {
    return null;
  }

  const isAdmin = staffRole === "admin" || staffRole === "head_comercial";
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/crm" className="flex items-center gap-2">
          <img src={logoUnv} alt="UNV Nexus" className="h-8" />
          <span className="font-semibold text-primary">CRM</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/crm" && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Link
          to="/onboarding-tasks"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao Nexus
        </Link>
        {staffName && (
          <p className="mt-2 text-xs text-muted-foreground truncate">
            {staffName}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border flex-col bg-card">
        <NavContent />
      </aside>

      {/* Mobile Header + Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
        <Link to="/crm" className="flex items-center gap-2">
          <img src={logoUnv} alt="UNV Nexus" className="h-6" />
          <span className="font-semibold text-primary text-sm">CRM</span>
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-0 pt-16 lg:pt-0">
        <Outlet context={{ staffRole, isAdmin }} />
      </main>
    </div>
  );
};
