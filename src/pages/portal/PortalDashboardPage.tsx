import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  BarChart3,
  FileText
} from "lucide-react";
import { toast } from "sonner";

interface PortalUser {
  id: string;
  company_id: string;
}

interface Plan {
  id: string;
  theme: string | null;
  status: string;
}

interface Objective {
  id: string;
  title: string;
  key_results: Array<{
    id: string;
    title: string;
    target: number;
    current_value: number;
    status: string;
  }>;
}

interface NorthStar {
  name: string;
  annual_target: number;
  unit: string;
}

const PortalDashboardPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user?.company_id]);

  const loadDashboardData = async () => {
    if (!user?.company_id) return;

    try {
      // Load published plan
      const { data: planData } = await supabase
        .from("portal_plans")
        .select("*")
        .eq("company_id", user.company_id)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .single();

      if (!planData) {
        setLoading(false);
        return;
      }

      setPlan(planData);

      // Load north star
      const { data: nsData } = await supabase
        .from("portal_north_stars")
        .select("*")
        .eq("plan_id", planData.id)
        .single();

      if (nsData) {
        setNorthStar(nsData);
      }

      // Load objectives with key results
      const { data: objData } = await supabase
        .from("portal_objectives")
        .select("*, portal_key_results(*)")
        .eq("plan_id", planData.id)
        .order("priority");

      if (objData) {
        setObjectives(objData.map(obj => ({
          id: obj.id,
          title: obj.title,
          key_results: (obj.portal_key_results || []).map((kr: any) => ({
            id: kr.id,
            title: kr.title,
            target: kr.target || 0,
            current_value: kr.current_value || 0,
            status: kr.status,
          })),
        })));
      }

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "text-green-400 bg-green-500/10";
      case "attention": return "text-yellow-400 bg-yellow-500/10";
      case "off_track": return "text-red-400 bg-red-500/10";
      case "completed": return "text-blue-400 bg-blue-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "on_track": return "On Track";
      case "attention": return "Atenção";
      case "off_track": return "Off Track";
      case "completed": return "Concluído";
      default: return status;
    }
  };

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  // Calculate overall stats
  const allKRs = objectives.flatMap(o => o.key_results);
  const onTrackKRs = allKRs.filter(kr => kr.status === "on_track" || kr.status === "completed").length;
  const attentionKRs = allKRs.filter(kr => kr.status === "attention").length;
  const offTrackKRs = allKRs.filter(kr => kr.status === "off_track").length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Card className="bg-slate-900/50 border-slate-800 text-center py-12">
          <CardContent>
            <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Nenhum plano publicado</h2>
            <p className="text-slate-400 mb-6">
              Publique seu planejamento 2026 para acompanhar o dashboard.
            </p>
            <Link to="/portal/app/planejamento">
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                Ir para Planejamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-slate-400">
            Meta x Realizado • {plan.theme || "Planejamento 2026"}
          </p>
        </div>
        <Link to={`/portal/app/planejamento/${plan.id}`}>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <FileText className="w-4 h-4 mr-2" />
            Ver Plano
          </Button>
        </Link>
      </div>

      {/* North Star */}
      {northStar && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/20 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-7 h-7 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-amber-400 text-sm font-medium mb-1">North Star Metric</p>
                <h2 className="text-2xl font-bold text-white">{northStar.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">
                  {northStar.annual_target?.toLocaleString("pt-BR")}
                </p>
                <p className="text-slate-400 text-sm">{northStar.unit} (meta anual)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{objectives.length}</p>
                <p className="text-xs text-slate-400">Objetivos</p>
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
                <p className="text-2xl font-bold text-white">{onTrackKRs}</p>
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
                <p className="text-2xl font-bold text-white">{attentionKRs}</p>
                <p className="text-xs text-slate-400">Atenção</p>
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
                <p className="text-2xl font-bold text-white">{offTrackKRs}</p>
                <p className="text-xs text-slate-400">Off Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Objectives & Key Results */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">Objetivos e Key Results</h2>

        {objectives.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800 text-center py-8">
            <CardContent>
              <p className="text-slate-400">Nenhum objetivo cadastrado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          objectives.map((obj, index) => (
            <Card key={obj.id} className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-sm">
                    O{index + 1}
                  </span>
                  <CardTitle className="text-white text-lg">{obj.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {obj.key_results.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhum Key Result definido</p>
                ) : (
                  <div className="space-y-4">
                    {obj.key_results.map((kr, krIndex) => {
                      const progress = calculateProgress(kr.current_value, kr.target);
                      return (
                        <div key={kr.id} className="bg-slate-800/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 text-xs font-medium">KR{krIndex + 1}</span>
                              <span className="text-white text-sm">{kr.title}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(kr.status)}`}>
                              {getStatusLabel(kr.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <Progress value={progress} className="flex-1 h-2 bg-slate-700" />
                            <div className="text-right min-w-[100px]">
                              <span className="text-white font-medium">{kr.current_value.toLocaleString("pt-BR")}</span>
                              <span className="text-slate-500"> / {kr.target.toLocaleString("pt-BR")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default PortalDashboardPage;
