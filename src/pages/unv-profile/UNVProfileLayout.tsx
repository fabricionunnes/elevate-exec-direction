import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Briefcase, UserCheck, Brain, Rocket, Target,
  TrendingUp, GraduationCap, MessageSquare, Network, Heart, FileText,
  Sparkles, Settings, ArrowLeft, Building2, BarChart3, Zap, Shield, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModuleGuard } from "@/components/whitelabel/ModuleGuard";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { PATH_TO_PROFILE_KEY, type ProfileMenuKey } from "@/types/profilePermissions";

interface NavItem { to: string; label: string; icon: any; group: string; permKey: ProfileMenuKey }

const NAV: NavItem[] = [
  { to: "/unv-profile", label: "Home", icon: LayoutDashboard, group: "Visão Geral", permKey: "profile_home" },
  { to: "/unv-profile/dashboard", label: "Dashboard", icon: BarChart3, group: "Visão Geral" },

  { to: "/unv-profile/employees", label: "Colaboradores", icon: Users, group: "Pessoas" },
  { to: "/unv-profile/org-chart", label: "Organograma", icon: Network, group: "Pessoas" },
  { to: "/unv-profile/positions", label: "Cargos & Salários", icon: Building2, group: "Pessoas" },

  { to: "/unv-profile/recruitment", label: "Recrutamento", icon: Briefcase, group: "Atração" },
  { to: "/unv-profile/talent-pool", label: "Banco de Talentos", icon: UserCheck, group: "Atração" },

  { to: "/unv-profile/disc", label: "Perfil DISC", icon: Brain, group: "Desenvolvimento" },
  { to: "/unv-profile/onboarding", label: "Onboarding", icon: Rocket, group: "Desenvolvimento" },
  { to: "/unv-profile/pdi", label: "PDI", icon: Target, group: "Desenvolvimento" },
  { to: "/unv-profile/career", label: "Plano de Carreira", icon: TrendingUp, group: "Desenvolvimento" },
  { to: "/unv-profile/trainings", label: "Treinamentos", icon: GraduationCap, group: "Desenvolvimento" },

  { to: "/unv-profile/evaluations", label: "Avaliações", icon: FileText, group: "Performance" },
  { to: "/unv-profile/feedbacks", label: "Feedbacks & 1:1", icon: MessageSquare, group: "Performance" },
  { to: "/unv-profile/climate", label: "Clima & eNPS", icon: Heart, group: "Performance" },

  { to: "/unv-profile/ai", label: "UNV IA", icon: Sparkles, group: "Inteligência" },
  { to: "/unv-profile/reports", label: "Relatórios", icon: BarChart3, group: "Inteligência" },

  { to: "/unv-profile/me", label: "Minha Área", icon: User, group: "Pessoal" },
  { to: "/unv-profile/admin", label: "Admin UNV", icon: Shield, group: "Administração" },
  { to: "/unv-profile/integrations", label: "Integrações", icon: Zap, group: "Administração" },
  { to: "/unv-profile/permissions", label: "Permissões", icon: Settings, group: "Administração" },
];

const GROUPS = ["Visão Geral", "Pessoas", "Atração", "Desenvolvimento", "Performance", "Inteligência", "Pessoal", "Administração"];

export default function UNVProfileLayout() {
  const location = useLocation();
  return (
    <ModuleGuard module="profile" label="UNV Profile">
      <div className="min-h-screen bg-background flex">
        <aside className="w-64 border-r border-border bg-card hidden lg:flex flex-col sticky top-0 h-screen">
          <div className="p-4 border-b border-border">
            <Link to="/onboarding-tasks" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="h-3 w-3" /> Voltar ao painel
            </Link>
            <Link to="/unv-profile" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground leading-tight">UNV Profile</h1>
                <p className="text-[10px] text-muted-foreground">Gestão de Pessoas</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
            {GROUPS.map(group => (
              <div key={group}>
                <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">{group}</p>
                {NAV.filter(n => n.group === group).map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/unv-profile"}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </ModuleGuard>
  );
}
