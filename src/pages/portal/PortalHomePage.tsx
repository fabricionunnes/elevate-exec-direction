import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Target, 
  TrendingUp, 
  Calendar,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

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

interface Plan {
  id: string;
  year: number;
  version: number;
  status: string;
  theme: string | null;
  current_step: number;
  created_at: string;
}

const WIZARD_STEPS = [
  { step: 1, name: "Contexto", description: "Diagnóstico atual" },
  { step: 2, name: "Direção", description: "North Star" },
  { step: 3, name: "OKRs", description: "Objetivos" },
  { step: 4, name: "Iniciativas", description: "Ações" },
  { step: 5, name: "Rocks", description: "Trimestres" },
  { step: 6, name: "Execução", description: "Cadência" },
  { step: 7, name: "Publicar", description: "Finalizar" },
];

const PortalHomePage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, [user?.company_id]);

  const loadPlans = async () => {
    if (!user?.company_id) return;

    try {
      const { data, error } = await supabase
        .from("portal_plans")
        .select("*")
        .eq("company_id", user.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error loading plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  const createNewPlan = async () => {
    if (!user?.company_id) return;

    try {
      const { data, error } = await supabase
        .from("portal_plans")
        .insert({
          company_id: user.company_id,
          year: 2026,
          version: plans.length + 1,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Plano criado! Vamos começar.");
      window.location.href = `/portal/app/planejamento/${data.id}`;
    } catch (error) {
      console.error("Error creating plan:", error);
      toast.error("Erro ao criar plano");
    }
  };

  const activePlan = plans.find(p => p.status === "draft") || plans[0];
  const progress = activePlan ? Math.round((activePlan.current_step / 7) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
          Olá, {user?.name?.split(" ")[0]}! 👋
        </h1>
        <p className="text-slate-400">
          Bem-vindo ao Portal do Planejamento 2026 • {user?.portal_companies?.name}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{plans.length}</p>
                <p className="text-xs text-slate-400">Planos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">0</p>
                <p className="text-xs text-slate-400">KRs On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">0</p>
                <p className="text-xs text-slate-400">Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">0</p>
                <p className="text-xs text-slate-400">Alertas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Plan / Create Plan */}
        <div className="lg:col-span-2">
          {activePlan ? (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-amber-400" />
                      Planejamento 2026 v{activePlan.version}
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-1">
                      {activePlan.theme || "Sem tema definido ainda"}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    activePlan.status === "published" 
                      ? "bg-green-500/10 text-green-400" 
                      : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {activePlan.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-400">Progresso do Planejamento</span>
                    <span className="text-white font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-slate-800" />
                </div>

                {/* Steps */}
                <div className="grid grid-cols-7 gap-1 mb-6">
                  {WIZARD_STEPS.map((step) => (
                    <div key={step.step} className="text-center">
                      <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-medium mb-1 ${
                        activePlan.current_step > step.step
                          ? "bg-green-500 text-white"
                          : activePlan.current_step === step.step
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-800 text-slate-500"
                      }`}>
                        {activePlan.current_step > step.step ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          step.step
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 hidden lg:block">{step.name}</p>
                    </div>
                  ))}
                </div>

                <Link to={`/portal/app/planejamento/${activePlan.id}`}>
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                    Continuar Planejamento
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900/50 border-slate-800 border-dashed">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Comece seu Planejamento 2026
                </h3>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Crie seu primeiro plano estratégico com metodologia OKR e orientação da IA Coach.
                </p>
                <Button 
                  onClick={createNewPlan}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Plano 2026
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/portal/app/coach">
                <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                  <TrendingUp className="w-4 h-4 mr-3 text-amber-400" />
                  Conversar com IA Coach
                </Button>
              </Link>
              <Link to="/portal/app/dashboard">
                <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                  <Calendar className="w-4 h-4 mr-3 text-blue-400" />
                  Ver Dashboard
                </Button>
              </Link>
              <Link to="/portal/app/config">
                <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800">
                  <FileText className="w-4 h-4 mr-3 text-green-400" />
                  Gerenciar Equipe
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* All Plans */}
          {plans.length > 1 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Outros Planos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {plans.slice(1).map((plan) => (
                  <Link 
                    key={plan.id}
                    to={`/portal/app/planejamento/${plan.id}`}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">2026 v{plan.version}</p>
                      <p className="text-xs text-slate-500">{plan.theme || "Sem tema"}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      plan.status === "published" 
                        ? "bg-green-500/10 text-green-400" 
                        : "bg-slate-700 text-slate-400"
                    }`}>
                      {plan.status === "published" ? "Publicado" : "Rascunho"}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalHomePage;
