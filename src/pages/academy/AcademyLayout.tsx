import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap,
  BookOpen,
  Trophy,
  ClipboardCheck,
  BarChart3,
  Settings,
  Users,
  ChevronLeft,
  Menu,
  Home,
  Award,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoUnv from "@/assets/logo-unv-nexus.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  clientManagerOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Home", href: "/academy", icon: Home },
  { title: "Trilhas", href: "/academy/tracks", icon: BookOpen },
  { title: "Meu Progresso", href: "/academy/progress", icon: Trophy },
  { title: "Ranking", href: "/academy/ranking", icon: Award },
  { title: "Provas", href: "/academy/quizzes", icon: ClipboardCheck },
  { title: "Meu Time", href: "/academy/team", icon: Users, clientManagerOnly: true },
  { title: "Relatórios", href: "/academy/reports", icon: BarChart3, clientManagerOnly: true },
  { title: "Admin: Conteúdos", href: "/academy/admin/content", icon: BookOpen, adminOnly: true },
  { title: "Admin: Provas & IA", href: "/academy/admin/quizzes", icon: Sparkles, adminOnly: true },
  { title: "Admin: Gamificação", href: "/academy/admin/gamification", icon: Trophy, adminOnly: true },
  { title: "Admin: Acessos", href: "/academy/admin/access", icon: Users, adminOnly: true },
  { title: "Admin: Relatórios", href: "/academy/admin/reports", icon: BarChart3, adminOnly: true },
  { title: "Configurações", href: "/academy/settings", icon: Settings, adminOnly: true },
];

export interface AcademyUserContext {
  isAdmin: boolean;
  isClientManager: boolean;
  isUser: boolean;
  staffId: string | null;
  onboardingUserId: string | null;
  companyId: string | null;
  projectId: string | null;
  userName: string;
  userRole: string | null;
}

export const AcademyLayout = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userContext, setUserContext] = useState<AcademyUserContext>({
    isAdmin: false,
    isClientManager: false,
    isUser: false,
    staffId: null,
    onboardingUserId: null,
    companyId: null,
    projectId: null,
    userName: "",
    userRole: null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          navigate("/onboarding-tasks/login");
          return;
        }

        // Check if staff (admin/cs/consultant)
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role, name")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staff && ["master", "admin", "cs", "consultant"].includes(staff.role)) {
          setUserContext({
            isAdmin: true,
            isClientManager: false,
            isUser: true,
            staffId: staff.id,
            onboardingUserId: null,
            companyId: null,
            projectId: null,
            userName: staff.name,
            userRole: staff.role,
          });
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // Check if client user
        const { data: onboardingUser } = await supabase
          .from("onboarding_users")
          .select(`
            id, name, role, project_id,
            onboarding_projects!inner(id, onboarding_company_id)
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (onboardingUser) {
          const project = onboardingUser.onboarding_projects as any;
          const isClientManager = onboardingUser.role === "client" || onboardingUser.role === "gerente";
          
          // Check if user has academy access
          const { data: accessData } = await supabase
            .from("academy_user_access")
            .select("id")
            .or(`onboarding_user_id.eq.${onboardingUser.id},company_id.eq.${project?.onboarding_company_id}`)
            .eq("is_active", true)
            .limit(1);

          // Allow client managers or users with explicit access
          if (isClientManager || (accessData && accessData.length > 0)) {
            setUserContext({
              isAdmin: false,
              isClientManager,
              isUser: true,
              staffId: null,
              onboardingUserId: onboardingUser.id,
              companyId: project?.onboarding_company_id || null,
              projectId: onboardingUser.project_id,
              userName: onboardingUser.name,
            });
            setHasAccess(true);
            setIsLoading(false);
            return;
          }
        }

        // No access
        navigate("/onboarding-tasks");
      } catch (error) {
        console.error("Error checking Academy access:", error);
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

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !userContext.isAdmin) return false;
    if (item.clientManagerOnly && !userContext.isClientManager && !userContext.isAdmin) return false;
    return true;
  });

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/academy" className="flex items-center gap-2">
          <img src={logoUnv} alt="UNV Nexus" className="h-8" />
          <div className="flex items-center gap-1">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">Academy</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/academy" && location.pathname.startsWith(item.href));
          
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
      <div className="p-4 border-t border-border space-y-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            setSidebarOpen(false);
            navigate(userContext.isAdmin ? "/onboarding-tasks" : "/portal/app");
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
        {userContext.userName && (
          <p className="text-xs text-muted-foreground truncate">
            {userContext.userName}
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
        <Link to="/academy" className="flex items-center gap-2">
          <img src={logoUnv} alt="UNV Nexus" className="h-6" />
          <GraduationCap className="h-4 w-4 text-primary" />
          <span className="font-semibold text-primary text-sm">Academy</span>
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-0 pt-16 lg:pt-0">
        <Outlet context={userContext} />
      </main>
    </div>
  );
};

export default AcademyLayout;
