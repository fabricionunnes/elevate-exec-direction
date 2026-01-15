import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Settings2,
  ClipboardList,
  QrCode,
  Menu,
  LogOut,
  Trophy,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

export default function CustomerPointsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId: paramCompanyId } = useParams<{ companyId: string }>();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pointsName, setPointsName] = useState("Pontos");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "" },
    { id: "clients", label: "Clientes", icon: Users, href: "clients" },
    { id: "rules", label: "Regras de Pontuação", icon: Settings2, href: "rules" },
    { id: "transactions", label: "Ações / Registros", icon: ClipboardList, href: "transactions" },
    { id: "qrcodes", label: "QR Code & Formulários", icon: QrCode, href: "qr-codes" },
  ];

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          navigate("/onboarding-tasks/login");
          return;
        }

        // First check if user is staff (admin, cs, consultant)
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id, role, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffData && ["admin", "cs", "consultant"].includes(staffData.role)) {
          // Staff member - use companyId from URL params
          setIsStaff(true);
          setStaffRole(staffData.role);
          
          if (!paramCompanyId) {
            toast.error("Empresa não especificada");
            navigate("/onboarding-tasks/companies");
            return;
          }

          // Verify company exists
          const { data: company } = await supabase
            .from("onboarding_companies")
            .select("id, name")
            .eq("id", paramCompanyId)
            .single();

          if (!company) {
            toast.error("Empresa não encontrada");
            navigate("/onboarding-tasks/companies");
            return;
          }

          setCompanyId(company.id);
          setCompanyName(company.name);

          // Load points config
          const { data: config } = await supabase
            .from("customer_points_config")
            .select("points_name")
            .eq("company_id", company.id)
            .maybeSingle();

          if (config?.points_name) {
            setPointsName(config.points_name);
          }

          setLoading(false);
          return;
        }

        // Check if user is a client (onboarding_users)
        const { data: onboardingUser, error: userError } = await supabase
          .from("onboarding_users")
          .select("*, project:onboarding_projects(id, onboarding_company_id, onboarding_company:onboarding_companies(id, name))")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userError || !onboardingUser) {
          toast.error("Acesso não autorizado");
          navigate("/onboarding-tasks/login");
          return;
        }

        const company = onboardingUser.project?.onboarding_company;
        if (!company) {
          toast.error("Empresa não encontrada");
          navigate("/onboarding-tasks/login");
          return;
        }

        // Verify URL companyId matches user's company (for clients)
        if (paramCompanyId && paramCompanyId !== company.id) {
          toast.error("Acesso não autorizado a esta empresa");
          navigate(`/customer-points/${company.id}`);
          return;
        }

        setCompanyId(company.id);
        setCompanyName(company.name);
        setProjectId(onboardingUser.project?.id || null);

        // Load points config
        const { data: config } = await supabase
          .from("customer_points_config")
          .select("points_name")
          .eq("company_id", company.id)
          .maybeSingle();

        if (config?.points_name) {
          setPointsName(config.points_name);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error checking access:", error);
        toast.error("Erro ao verificar acesso");
        navigate("/onboarding-tasks/login");
      }
    };

    checkAccess();
  }, [navigate, paramCompanyId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/onboarding-tasks/login");
  };

  const handleBack = () => {
    if (isStaff) {
      navigate(`/onboarding-tasks/companies/${companyId}`);
    } else if (projectId) {
      navigate(`/onboarding-client/${projectId}`);
    }
  };

  const basePath = `/customer-points/${companyId}`;
  const currentPath = location.pathname.replace(basePath, "").replace(/^\//, "");
  const activeNav = navItems.find(item => 
    item.href === "" ? currentPath === "" : currentPath.startsWith(item.href)
  )?.id || "dashboard";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg truncate">Pontuação de Clientes</h1>
              {isStaff && (
                <Badge variant="outline" className="text-xs shrink-0">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Staff
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{companyName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3",
                isActive && "bg-primary/10 text-primary"
              )}
              onClick={() => {
                navigate(item.href ? `${basePath}/${item.href}` : basePath);
                setMobileMenuOpen(false);
              }}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={handleBack}
        >
          <ChevronLeft className="h-4 w-4" />
          {isStaff ? "Voltar à Empresa" : "Voltar ao Portal"}
        </Button>
        {!isStaff && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">{pointsName}</span>
            {isStaff && (
              <Badge variant="outline" className="text-xs">Staff</Badge>
            )}
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:overflow-auto">
        <div className="pt-16 lg:pt-0">
          <Outlet context={{ companyId, companyName, pointsName, projectId, isStaff, staffRole }} />
        </div>
      </main>
    </div>
  );
}
