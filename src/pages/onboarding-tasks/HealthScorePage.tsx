import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";
import { HealthScoreDetailPanel } from "@/components/onboarding-tasks/health-score/HealthScoreDetailPanel";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const HealthScorePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: staff } = await supabase
            .from("onboarding_staff")
            .select("role")
            .eq("user_id", user.id)
            .single();
          
          setIsAdmin(staff?.role === "admin");
        }

        if (projectId) {
          const { data: project } = await supabase
            .from("onboarding_projects")
            .select("product_name, onboarding_company:onboarding_companies(name)")
            .eq("id", projectId)
            .single();

          if (project) {
            setProjectName(project.onboarding_company?.name || project.product_name);
          }
        }
      } catch (error) {
        console.error("Error checking access:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <p>Projeto não encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            Score Card de Saúde
          </h1>
          {projectName && (
            <p className="text-muted-foreground">{projectName}</p>
          )}
        </div>
      </div>

      <HealthScoreDetailPanel projectId={projectId} isAdmin={isAdmin} />
    </div>
  );
};

export default HealthScorePage;
