import { Outlet, useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Instagram, Settings, LayoutGrid, Loader2, BookOpen, Menu } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const useIsClientUser = () => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsClient(!data);
    };
    check();
  }, []);
  return isClient;
};

interface ProjectInfo {
  id: string;
  product_name: string | null;
  company_name: string | null;
  board_id: string | null;
}

export const SocialLayout = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isClient = useIsClientUser();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (projectId) {
      loadProjectInfo();
    }
  }, [projectId]);

  const loadProjectInfo = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          product_name,
          onboarding_companies(name)
        `)
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      let { data: board, error: boardError } = await supabase
        .from("social_content_boards")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (boardError && boardError.code === "PGRST116") {
        const { data: newBoard, error: createError } = await supabase
          .from("social_content_boards")
          .insert({ project_id: projectId, name: "Pipeline de Conteúdo" })
          .select("id")
          .single();

        if (createError) throw createError;
        board = newBoard;

        await supabase.rpc("create_social_default_stages", { p_board_id: board.id });
      } else if (boardError) {
        throw boardError;
      }

      setProject({
        id: projectData.id,
        product_name: projectData.product_name,
        company_name: (projectData.onboarding_companies as any)?.name || null,
        board_id: board?.id || null,
      });
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Erro ao carregar projeto");
      navigate("/onboarding-tasks");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const backPath = isClient ? `/onboarding-client/${projectId}` : `/onboarding-tasks/${projectId}`;

  const navItems = [
    { to: `/social/${projectId}`, label: "Pipeline", icon: LayoutGrid, end: true },
    { to: `/social/${projectId}/strategy`, label: "Base Estratégica", icon: BookOpen },
    ...(!isClient ? [{ to: `/social/${projectId}/settings`, label: "Configurações", icon: Settings }] : []),
  ];

  const isActive = (item: typeof navItems[0]) => {
    const currentPath = location.pathname;
    if (item.end) {
      return currentPath === item.to;
    }
    return currentPath.startsWith(item.to);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate(backPath)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                <Instagram className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-base md:text-lg leading-tight">UNV Social</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {project.company_name || project.product_name}
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive(item) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-left flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                      <Instagram className="h-4 w-4 text-white" />
                    </div>
                    UNV Social
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-2 gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant={isActive(item) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet context={{ project, boardId: project.board_id }} />
      </main>
    </div>
  );
};
