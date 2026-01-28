import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  ArrowLeft, 
  Activity,
  TrendingDown,
  Users2,
  FileBarChart
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Import existing dashboard components
import ExecutiveDashboardContent from "@/components/leader-dashboard/ExecutiveDashboardContent";
import ChurnPredictionContent from "@/components/leader-dashboard/ChurnPredictionContent";
import CohortRetentionContent from "@/components/leader-dashboard/CohortRetentionContent";
import CompaniesReportContent from "@/components/leader-dashboard/CompaniesReportContent";

const CEO_EMAIL = "fabricio@universidadevendas.com.br";

const leaderTabs = [
  { value: "executive", label: "Dashboard Executivo", icon: Activity, color: "text-blue-600" },
  { value: "churn", label: "Previsão de Churn", icon: TrendingDown, color: "text-rose-600" },
  { value: "cohort", label: "Análise de Cohort", icon: Users2, color: "text-violet-600" },
  { value: "report", label: "Relatório de Empresas", icon: FileBarChart, color: "text-emerald-600" },
];

export default function LeaderDashboardPage() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("executive");

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.error("Error checking Leader access:", error);
        }

        if (!user) {
          setIsAuthorized(false);
          setIsLoading(false);
          navigate("/onboarding-tasks/login");
          return;
        }

        // CEO goes to the CEO Panel, not here
        if (user.email?.toLowerCase() === CEO_EMAIL) {
          setIsAuthorized(false);
          setIsLoading(false);
          navigate("/onboarding-tasks/ceo");
          return;
        }

        // Check if user is admin
        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffError) {
          console.error("Error checking staff:", staffError);
        }

        if (!staff || (staff.role !== "admin" && staff.role !== "master")) {
          setIsAuthorized(false);
          setIsLoading(false);
          navigate("/onboarding-tasks");
          return;
        }

        setIsAuthorized(true);
        setIsLoading(false);
      } catch (err) {
        console.error("Error checking Leader access:", err);
        setIsAuthorized(false);
        setIsLoading(false);
        navigate("/onboarding-tasks/login");
      }
    };

    checkAccess();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/onboarding-tasks")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                  Painel do Líder
                </h1>
                <p className="text-sm text-muted-foreground hidden md:block">
                  Visão consolidada de métricas e análises estratégicas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <div className="mb-6">
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex h-12 items-center justify-start rounded-lg bg-white border p-1 gap-1 shadow-sm">
                {leaderTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <tab.icon className={`h-4 w-4 mr-2 ${activeTab === tab.value ? "" : tab.color}`} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Tab Contents */}
          <TabsContent value="executive" className="mt-0">
            <ExecutiveDashboardContent />
          </TabsContent>

          <TabsContent value="churn" className="mt-0">
            <ChurnPredictionContent />
          </TabsContent>

          <TabsContent value="cohort" className="mt-0">
            <CohortRetentionContent />
          </TabsContent>

          <TabsContent value="report" className="mt-0">
            <CompaniesReportContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
