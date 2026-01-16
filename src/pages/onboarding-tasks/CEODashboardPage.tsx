import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain } from "lucide-react";
import { CEOBigNumbers } from "@/components/ceo-dashboard/CEOBigNumbers";
import { CEOBusinessHealth } from "@/components/ceo-dashboard/CEOBusinessHealth";
import { CEODecisions } from "@/components/ceo-dashboard/CEODecisions";
import { CEODecisionResults } from "@/components/ceo-dashboard/CEODecisionResults";
import { CEOAgenda } from "@/components/ceo-dashboard/CEOAgenda";
import { CEOTasks } from "@/components/ceo-dashboard/CEOTasks";
import { CEONotes } from "@/components/ceo-dashboard/CEONotes";
import { CEOAlerts } from "@/components/ceo-dashboard/CEOAlerts";
import { CEOFuturePlanning } from "@/components/ceo-dashboard/CEOFuturePlanning";
import { CEOAIAssistant } from "@/components/ceo-dashboard/CEOAIAssistant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CEO_EMAIL = "fabricio@universidadevendas.com.br";

export default function CEODashboardPage() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Check Supabase auth
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.email === CEO_EMAIL) {
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Check onboarding_staff table
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("email")
          .single();

        if (staffData?.email === CEO_EMAIL) {
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Check localStorage
        const storedEmail = localStorage.getItem("staff_email");
        if (storedEmail === CEO_EMAIL) {
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Not authorized
        setIsAuthorized(false);
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking CEO access:", error);
        setIsAuthorized(false);
        setIsLoading(false);
      }
    };

    checkAccess();
  }, []);

  useEffect(() => {
    if (isAuthorized === false) {
      navigate("/onboarding-tasks");
    }
  }, [isAuthorized, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CEO Dashboard</h1>
            <p className="text-muted-foreground">
              Painel de Comando Estratégico
            </p>
          </div>
        </div>

        {/* Alerts Section */}
        <CEOAlerts />

        {/* Big Numbers */}
        <CEOBigNumbers />

        {/* Main Content Tabs */}
        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="ai" className="gap-2">
              <Brain className="h-4 w-4" />
              IA do CEO
            </TabsTrigger>
            <TabsTrigger value="health">Saúde</TabsTrigger>
            <TabsTrigger value="decisions">Decisões</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas</TabsTrigger>
            <TabsTrigger value="notes">Anotações</TabsTrigger>
            <TabsTrigger value="planning">Planejamento</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-6">
            <CEOAIAssistant />
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            <CEOBusinessHealth />
          </TabsContent>

          <TabsContent value="decisions" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <CEODecisions />
              <CEODecisionResults />
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="space-y-6">
            <CEOAgenda />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <CEOTasks />
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <CEONotes />
          </TabsContent>

          <TabsContent value="planning" className="space-y-6">
            <CEOFuturePlanning />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
