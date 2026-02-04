import { Outlet, useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Instagram, Settings, LayoutGrid, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProjectInfo {
  id: string;
  product_name: string | null;
  company_name: string | null;
  board_id: string | null;
}

export const SocialLayout = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProjectInfo();
    }
  }, [projectId]);

  const loadProjectInfo = async () => {
    try {
      // Load project info
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

      // Check if board exists, create if not
      let { data: board, error: boardError } = await supabase
        .from("social_content_boards")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (boardError && boardError.code === "PGRST116") {
        // Board doesn't exist, create it
        const { data: newBoard, error: createError } = await supabase
          .from("social_content_boards")
          .insert({ project_id: projectId, name: "Pipeline de Conteúdo" })
          .select("id")
          .single();

        if (createError) throw createError;
        board = newBoard;

        // Create default stages
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

  const navItems = [
    { to: `/social/${projectId}`, label: "Pipeline", icon: LayoutGrid, end: true },
    { to: `/social/${projectId}/strategy`, label: "Base Estratégica", icon: BookOpen },
    { to: `/social/${projectId}/settings`, label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/onboarding-tasks/${projectId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">UNV Social</h1>
                <p className="text-xs text-muted-foreground">
                  {project.company_name || project.product_name}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = window.location.hash.endsWith(item.to) || 
                (item.end && window.location.hash === `#${item.to}`);
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet context={{ project, boardId: project.board_id }} />
      </main>
    </div>
  );
};
