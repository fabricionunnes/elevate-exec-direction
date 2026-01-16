import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  Brain, 
  FileText, 
  MapPin, 
  Trophy, 
  Users, 
  Calculator, 
  ArrowLeft, 
  Activity,
  Heart,
  CheckSquare,
  Calendar,
  StickyNote,
  TrendingUp
} from "lucide-react";
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
import { CEOWeeklyReport } from "@/components/ceo-dashboard/CEOWeeklyReport";
import { CEODecisionMap } from "@/components/ceo-dashboard/CEODecisionMap";
import { CEOScoreCard } from "@/components/ceo-dashboard/CEOScoreCard";
import { CEOVirtualBoard } from "@/components/ceo-dashboard/CEOVirtualBoard";
import { CEODecisionSimulator } from "@/components/ceo-dashboard/CEODecisionSimulator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const CEO_EMAIL = "fabricio@universidadevendas.com.br";

const mainTabs = [
  { value: "ai", label: "IA do CEO", icon: Brain, color: "text-violet-600" },
  { value: "board", label: "Board Virtual", icon: Users, color: "text-blue-600" },
  { value: "score", label: "Score", icon: Trophy, color: "text-amber-600" },
  { value: "weekly", label: "Relatório Semanal", icon: FileText, color: "text-emerald-600" },
  { value: "decision-map", label: "Mapa de Decisões", icon: MapPin, color: "text-rose-600" },
  { value: "simulator", label: "Simulador", icon: Calculator, color: "text-cyan-600" },
];

const secondaryTabs = [
  { value: "health", label: "Saúde", icon: Heart, color: "text-rose-500" },
  { value: "decisions", label: "Decisões", icon: CheckSquare, color: "text-indigo-500" },
  { value: "agenda", label: "Agenda", icon: Calendar, color: "text-blue-500" },
  { value: "tasks", label: "Tarefas", icon: CheckSquare, color: "text-emerald-500" },
  { value: "notes", label: "Anotações", icon: StickyNote, color: "text-amber-500" },
  { value: "planning", label: "Planejamento", icon: TrendingUp, color: "text-violet-500" },
];

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate("/onboarding-tasks")}
              className="h-10 w-10 bg-white shadow-sm"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Painel do CEO
              </h1>
              <p className="text-slate-500">
                Painel de Comando Estratégico
              </p>
            </div>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate("/onboarding-tasks/executive")}
            className="gap-2 bg-white shadow-sm"
          >
            <Activity className="h-4 w-4" />
            Dashboard Executivo
          </Button>
        </div>

        {/* Alerts Section */}
        <CEOAlerts />

        {/* Big Numbers */}
        <CEOBigNumbers />

        {/* Main Content Tabs */}
        <Tabs defaultValue="ai" className="space-y-4">
          {/* Navigation - All tabs in one fluid container */}
          <div className="bg-white rounded-xl shadow-sm border p-3">
            <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 w-full justify-start">
              {/* Primary tabs */}
              {mainTabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <tab.icon className={`h-4 w-4 ${tab.color}`} />
                  <span className="font-medium">{tab.label}</span>
                </TabsTrigger>
              ))}
              
              {/* Visual separator */}
              <div className="hidden sm:flex items-center px-1">
                <div className="w-px h-6 bg-slate-200" />
              </div>
              
              {/* Secondary tabs */}
              {secondaryTabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 transition-all text-sm"
                >
                  <tab.icon className={`h-3.5 w-3.5 ${tab.color}`} />
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Tab Contents */}
          <TabsContent value="ai" className="space-y-6 mt-6">
            <CEOAIAssistant />
          </TabsContent>

          <TabsContent value="board" className="space-y-6 mt-6">
            <CEOVirtualBoard />
          </TabsContent>

          <TabsContent value="score" className="space-y-6 mt-6">
            <CEOScoreCard />
          </TabsContent>

          <TabsContent value="weekly" className="space-y-6 mt-6">
            <CEOWeeklyReport />
          </TabsContent>

          <TabsContent value="decision-map" className="space-y-6 mt-6">
            <CEODecisionMap />
          </TabsContent>

          <TabsContent value="simulator" className="space-y-6 mt-6">
            <CEODecisionSimulator />
          </TabsContent>

          <TabsContent value="health" className="space-y-6 mt-6">
            <CEOBusinessHealth />
          </TabsContent>

          <TabsContent value="decisions" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <CEODecisions />
              <CEODecisionResults />
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="space-y-6 mt-6">
            <CEOAgenda />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6 mt-6">
            <CEOTasks />
          </TabsContent>

          <TabsContent value="notes" className="space-y-6 mt-6">
            <CEONotes />
          </TabsContent>

          <TabsContent value="planning" className="space-y-6 mt-6">
            <CEOFuturePlanning />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
