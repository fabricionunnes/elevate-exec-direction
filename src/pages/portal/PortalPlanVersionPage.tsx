import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  FileText, 
  Target, 
  CheckCircle2, 
  Lock,
  Copy,
  Printer,
  Download,
  Calendar,
  User,
  TrendingUp,
  Star
} from "lucide-react";

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

interface PlanData {
  id: string;
  year: number;
  version: number;
  status: string;
  vision: string | null;
  theme: string | null;
  published_at: string | null;
  created_at: string;
  portal_companies: {
    name: string;
  };
}

interface Objective {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  portal_key_results: KeyResult[];
}

interface KeyResult {
  id: string;
  title: string;
  baseline: number | null;
  target: number;
  current_value: number | null;
  unit: string | null;
  status: string;
}

interface NorthStar {
  id: string;
  name: string;
  definition: string | null;
  unit: string | null;
  annual_target: number | null;
}

interface Rock {
  id: string;
  title: string;
  description: string | null;
  quarter: number;
  status: string;
  target: string | null;
}

const PortalPlanVersionPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: PortalUser }>();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [northStars, setNorthStars] = useState<NorthStar[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);

  useEffect(() => {
    if (planId) {
      fetchPlanData();
    }
  }, [planId]);

  const fetchPlanData = async () => {
    setLoading(true);
    
    try {
      // Fetch plan
      const { data: planData, error: planError } = await supabase
        .from("portal_plans")
        .select("*, portal_companies(name)")
        .eq("id", planId)
        .single();

      if (planError) throw planError;
      setPlan(planData);

      // Fetch objectives with KRs
      const { data: objData } = await supabase
        .from("portal_objectives")
        .select("*, portal_key_results(*)")
        .eq("plan_id", planId)
        .order("priority");

      setObjectives(objData || []);

      // Fetch north stars
      const { data: nsData } = await supabase
        .from("portal_north_stars")
        .select("*")
        .eq("plan_id", planId);

      setNorthStars(nsData || []);

      // Fetch rocks
      const { data: rocksData } = await supabase
        .from("portal_rocks")
        .select("*")
        .eq("plan_id", planId)
        .order("quarter");

      setRocks(rocksData || []);

    } catch (error) {
      toast.error("Erro ao carregar plano");
      navigate("/portal/app");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      const { error } = await supabase
        .from("portal_plans")
        .update({ 
          status: "published" as const, 
          published_at: new Date().toISOString() 
        })
        .eq("id", planId);

      if (error) throw error;

      toast.success("Plano publicado com sucesso!");
      setPublishDialogOpen(false);
      fetchPlanData();
    } catch (error) {
      toast.error("Erro ao publicar plano");
    }
  };

  const handleCreateNewVersion = async () => {
    try {
      // Create new plan as copy
      const { data: newPlan, error: planError } = await supabase
        .from("portal_plans")
        .insert({
          company_id: user.company_id,
          year: plan!.year,
          version: plan!.version + 1,
          status: "draft" as const,
          vision: plan!.vision,
          theme: plan!.theme,
          current_step: 7 // Start at review step
        })
        .select()
        .single();

      if (planError) throw planError;

      // Copy north stars
      for (const ns of northStars) {
        await supabase.from("portal_north_stars").insert({
          plan_id: newPlan.id,
          name: ns.name,
          definition: ns.definition,
          unit: ns.unit,
          annual_target: ns.annual_target
        });
      }

      // Copy objectives and KRs
      for (const obj of objectives) {
        const { data: newObj } = await supabase
          .from("portal_objectives")
          .insert({
            plan_id: newPlan.id,
            title: obj.title,
            description: obj.description,
            priority: obj.priority
          })
          .select()
          .single();

        if (newObj) {
          for (const kr of obj.portal_key_results) {
            await supabase.from("portal_key_results").insert({
              objective_id: newObj.id,
              title: kr.title,
              baseline: kr.current_value || kr.baseline, // Use current as new baseline
              target: kr.target,
              current_value: kr.current_value || 0,
              unit: kr.unit,
              status: "on_track" as const
            });
          }
        }
      }

      // Copy rocks
      for (const rock of rocks) {
        await supabase.from("portal_rocks").insert({
          plan_id: newPlan.id,
          title: rock.title,
          description: rock.description,
          quarter: rock.quarter,
          target: rock.target,
          status: "on_track" as const
        });
      }

      toast.success(`Versão ${plan!.version + 1} criada com sucesso!`);
      setNewVersionDialogOpen(false);
      navigate(`/portal/app/planejamento/${newPlan.id}`);

    } catch (error) {
      toast.error("Erro ao criar nova versão");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "attention": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "off_track": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "completed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "on_track": return "No Ritmo";
      case "attention": return "Atenção";
      case "off_track": return "Fora da Meta";
      case "completed": return "Concluído";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Plano não encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/portal/app")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Plano {plan.year} - v{plan.version}
              {plan.status === "published" && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <Lock className="w-3 h-3 mr-1" />
                  Publicado
                </Badge>
              )}
              {plan.status === "draft" && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  Rascunho
                </Badge>
              )}
            </h1>
            <p className="text-slate-400">{plan.portal_companies?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>

          {plan.status === "published" && (
            <Dialog open={newVersionDialogOpen} onOpenChange={setNewVersionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Copy className="w-4 h-4 mr-2" />
                  Nova Versão
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Criar Nova Versão</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Isso criará uma cópia do plano atual como v{plan.version + 1} em modo rascunho.
                    Os valores atuais dos KRs serão usados como baseline da nova versão.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setNewVersionDialogOpen(false)} className="border-slate-700 text-slate-300">
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateNewVersion} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                    Criar Versão {plan.version + 1}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {plan.status === "draft" && (
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                  <Lock className="w-4 h-4 mr-2" />
                  Publicar Plano
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Publicar Plano Oficial</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Ao publicar, este plano será travado e se tornará a versão oficial.
                    Você poderá criar novas versões a partir dele no futuro.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setPublishDialogOpen(false)} className="border-slate-700 text-slate-300">
                    Cancelar
                  </Button>
                  <Button onClick={handlePublish} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Publicação
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Print-friendly content */}
      <div ref={printRef} className="space-y-6 print:p-8">
        {/* Header for print */}
        <div className="hidden print:block mb-8">
          <h1 className="text-3xl font-bold">Plano Estratégico {plan.year} - Versão {plan.version}</h1>
          <p className="text-lg text-slate-600">{plan.portal_companies?.name}</p>
          {plan.published_at && (
            <p className="text-sm text-slate-500">
              Publicado em: {new Date(plan.published_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {/* Vision & Theme */}
        {(plan.vision || plan.theme) && (
          <Card className="bg-slate-900/50 border-slate-800 print:bg-white print:border-gray-200">
            <CardHeader>
              <CardTitle className="text-white print:text-black flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Visão e Tema do Ano
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.vision && (
                <div>
                  <p className="text-sm text-slate-400 print:text-gray-500 mb-1">Visão</p>
                  <p className="text-white print:text-black">{plan.vision}</p>
                </div>
              )}
              {plan.theme && (
                <div>
                  <p className="text-sm text-slate-400 print:text-gray-500 mb-1">Tema do Ano</p>
                  <p className="text-white print:text-black">{plan.theme}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* North Stars */}
        {northStars.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800 print:bg-white print:border-gray-200">
            <CardHeader>
              <CardTitle className="text-white print:text-black flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                North Stars
              </CardTitle>
              <CardDescription className="text-slate-400 print:text-gray-500">
                Métricas principais de sucesso para o ano
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {northStars.map((ns) => (
                  <div key={ns.id} className="p-4 rounded-lg bg-slate-800/50 print:bg-gray-100 border border-slate-700 print:border-gray-300">
                    <h4 className="font-semibold text-white print:text-black">{ns.name}</h4>
                    {ns.definition && (
                      <p className="text-sm text-slate-400 print:text-gray-500 mt-1">{ns.definition}</p>
                    )}
                    {ns.annual_target && (
                      <p className="text-lg font-bold text-amber-400 print:text-amber-600 mt-2">
                        Meta: {ns.annual_target.toLocaleString()} {ns.unit}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Objectives & KRs */}
        {objectives.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800 print:bg-white print:border-gray-200">
            <CardHeader>
              <CardTitle className="text-white print:text-black flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Objetivos e Key Results (OKRs)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {objectives.map((obj, index) => (
                <div key={obj.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white print:text-black">{obj.title}</h4>
                      {obj.description && (
                        <p className="text-sm text-slate-400 print:text-gray-500 mt-1">{obj.description}</p>
                      )}
                    </div>
                  </div>

                  {obj.portal_key_results.length > 0 && (
                    <div className="ml-11 space-y-2">
                      {obj.portal_key_results.map((kr) => (
                        <div 
                          key={kr.id} 
                          className="p-3 rounded-lg bg-slate-800/30 print:bg-gray-50 border border-slate-700/50 print:border-gray-200 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <p className="text-sm text-white print:text-black">{kr.title}</p>
                            <p className="text-xs text-slate-500 print:text-gray-500">
                              Baseline: {kr.baseline || 0} → Meta: {kr.target} {kr.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-300 print:text-gray-700">
                              Atual: {kr.current_value || 0}
                            </span>
                            <Badge className={getStatusColor(kr.status)}>
                              {getStatusLabel(kr.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {index < objectives.length - 1 && <Separator className="bg-slate-800 print:bg-gray-200 mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Rocks */}
        {rocks.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800 print:bg-white print:border-gray-200">
            <CardHeader>
              <CardTitle className="text-white print:text-black flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                Rocks (Entregas Trimestrais)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((quarter) => {
                  const quarterRocks = rocks.filter(r => r.quarter === quarter);
                  if (quarterRocks.length === 0) return null;
                  
                  return (
                    <div key={quarter} className="space-y-2">
                      <h4 className="font-semibold text-slate-300 print:text-gray-700">Q{quarter}</h4>
                      {quarterRocks.map((rock) => (
                        <div 
                          key={rock.id}
                          className="p-3 rounded-lg bg-slate-800/30 print:bg-gray-50 border border-slate-700/50 print:border-gray-200"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-white print:text-black">{rock.title}</p>
                              {rock.target && (
                                <p className="text-xs text-slate-500 print:text-gray-500 mt-1">Meta: {rock.target}</p>
                              )}
                            </div>
                            <Badge className={getStatusColor(rock.status)}>
                              {getStatusLabel(rock.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer for print */}
        <div className="hidden print:block pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Portal do Planejamento 2026 - Mansão Empreendedora</p>
          <p>Documento gerado em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </div>
    </div>
  );
};

export default PortalPlanVersionPage;
