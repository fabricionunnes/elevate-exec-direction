import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserPlus,
  Route,
  BookOpen,
  FileText,
  Award,
  Trophy,
  Settings,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/pdi" },
  { label: "Turmas", icon: Users, path: "/pdi/cohorts" },
  { label: "Inscrições", icon: UserPlus, path: "/pdi/applications" },
  { label: "Participantes", icon: ClipboardList, path: "/pdi/participants" },
  { label: "Trilhas", icon: Route, path: "/pdi/tracks" },
  // Phase 2+
  // { label: "Tarefas", icon: FileText, path: "/pdi/tasks" },
  // { label: "Biblioteca", icon: BookOpen, path: "/pdi/library" },
  // { label: "Ranking", icon: Trophy, path: "/pdi/ranking" },
  // { label: "Certificados", icon: Award, path: "/pdi/certificates" },
  // { label: "Configurações", icon: Settings, path: "/pdi/settings" },
];

export default function PDILayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Route className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">PDI</h2>
              <p className="text-[10px] text-muted-foreground">Plano de Desenvolvimento</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.path || 
                (item.path !== "/pdi" && currentPath.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="lg:hidden p-3 border-b border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm">PDI</span>
        </div>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
