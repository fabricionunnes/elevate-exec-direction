import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { AdminActivityHistory } from "@/components/onboarding-tasks/AdminActivityHistory";

const OnboardingActivityHistoryPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff || staff.role !== "admin") {
        navigate("/onboarding-tasks");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/onboarding-tasks");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Histórico de Atividades</h1>
              <WelcomeHeader className="text-sm text-muted-foreground" />
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/onboarding-tasks/login");
            }}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Activity History */}
        <AdminActivityHistory />
      </div>
    </div>
  );
};

export default OnboardingActivityHistoryPage;
