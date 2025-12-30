import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  X,
  MessageCircle,
  ChevronRight,
  User,
  ClipboardCheck
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  portal_companies?: {
    id: string;
    name: string;
  };
}

const PortalAppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/login?redirect=" + encodeURIComponent(location.pathname));
        return;
      }

      // Get portal user with company
      const { data: portalUser, error } = await supabase
        .from("portal_users")
        .select("*, portal_companies(id, name)")
        .eq("user_id", session.user.id)
        .single();

      if (error || !portalUser) {
        toast.error("Usuário não encontrado no portal");
        await supabase.auth.signOut();
        navigate("/portal/login");
        return;
      }

      setUser(portalUser as unknown as PortalUser);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/portal/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/portal/login");
  };

  const navItems = [
    { href: "/portal/app", icon: LayoutDashboard, label: "Início" },
    { href: "/portal/app/planejamento", icon: FileText, label: "Planejamento" },
    { href: "/portal/app/execucao", icon: ClipboardCheck, label: "Execução" },
    { href: "/portal/app/dashboard", icon: BarChart3, label: "Dashboard" },
    { href: "/portal/app/config", icon: Settings, label: "Configurações" },
    ...(user?.role === "admin_unv" ? [{ href: "/portal/app/admin", icon: Settings, label: "Admin UNV" }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-lg" />
          <div className="h-4 w-32 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  const NavContent = () => (
    <nav className="flex flex-col h-full">
      <div className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors",
                isActive 
                  ? "bg-amber-500/10 text-amber-400" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          );
        })}
      </div>

      {/* User section */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.portal_companies?.name}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800 bg-slate-950">
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <Link to="/portal/app" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Planejamento 2026</h1>
              <p className="text-xs text-slate-500">Mansão Empreendedora</p>
            </div>
          </Link>
        </div>
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center justify-between p-4">
          <Link to="/portal/app" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-950" />
            </div>
            <span className="text-sm font-bold text-white">Planejamento 2026</span>
          </Link>
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-slate-950 border-slate-800 p-0">
              <div className="p-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-slate-950" />
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-white">Planejamento 2026</h1>
                    <p className="text-xs text-slate-500">Mansão Empreendedora</p>
                  </div>
                </div>
              </div>
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-16">
        <Outlet context={{ user }} />
      </main>

      {/* AI Coach Button (Fixed) - Hide when already on coach page */}
      {location.pathname !== "/portal/app/coach" && (
        <Link
          to="/portal/app/coach"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform"
        >
          <MessageCircle className="w-6 h-6 text-slate-950" />
        </Link>
      )}
    </div>
  );
};

export default PortalAppLayout;
