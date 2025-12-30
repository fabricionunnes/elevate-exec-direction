import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  CheckCircle2,
  Target,
  Compass,
  Flag,
  Rocket,
  Calendar,
  Play,
  FileCheck,
  Loader2
} from "lucide-react";
import { toast } from "sonner";


interface PortalUser {
  id: string;
  name: string;
  company_id: string;
}

// Simple debounce function
const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

interface Plan {
  id: string;
  year: number;
  version: number;
  status: string;
  theme: string | null;
  vision: string | null;
  current_step: number;
  context_data: any;
}

const STEPS = [
  { step: 1, title: "Contexto e Diagnóstico", icon: Target, description: "Fotografia atual do negócio" },
  { step: 2, title: "Direção", icon: Compass, description: "Visão e North Star Metric" },
  { step: 3, title: "OKRs", icon: Flag, description: "Objetivos e Resultados-Chave" },
  { step: 4, title: "Iniciativas", icon: Rocket, description: "Ações estratégicas" },
  { step: 5, title: "Rocks Trimestrais", icon: Calendar, description: "Prioridades Q1-Q4" },
  { step: 6, title: "Plano de Execução", icon: Play, description: "Cadência e riscos" },
  { step: 7, title: "Publicar", icon: FileCheck, description: "Finalizar plano" },
];

const PortalPlanningWizard = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: PortalUser }>();
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form data for all steps
  const [formData, setFormData] = useState<Record<string, any>>({
    // Step 1 - Context
    segment: "",
    avg_ticket: "",
    channels: "",
    team_size: "",
    delivery_capacity: "",
    margin: "",
    constraints: "",
    current_revenue: "",
    current_margin: "",
    cac: "",
    ltv: "",
    leads_month: "",
    conversion: "",
    nps: "",
    
    // Step 2 - Direction
    vision: "",
    theme: "",
    north_star_name: "",
    north_star_definition: "",
    north_star_unit: "",
    north_star_target: "",
    
    // Step 3 - OKRs (handled separately)
    objectives: [] as Array<{
      title: string;
      description: string;
      key_results: Array<{
        title: string;
        unit: string;
        target: string;
        baseline: string;
      }>;
    }>,
    
    // Step 5 - Rocks
    q1_rocks: "",
    q2_rocks: "",
    q3_rocks: "",
    q4_rocks: "",
    
    // Step 6 - Execution
    weekly_cadence: "",
    monthly_review: "",
    quarterly_review: "",
    risks: "",
    mitigations: "",
  });

  useEffect(() => {
    if (planId) {
      loadPlan();
    }
  }, [planId]);

  const loadPlan = async () => {
    try {
      const { data, error } = await supabase
        .from("portal_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (error) throw error;

      setPlan(data as Plan);
      setCurrentStep(data.current_step || 1);
      
      // Load context data
      if (data.context_data && typeof data.context_data === 'object') {
        setFormData(prev => ({ ...prev, ...(data.context_data as Record<string, any>) }));
      }
      if (data.theme) {
        setFormData(prev => ({ ...prev, theme: data.theme }));
      }
      if (data.vision) {
        setFormData(prev => ({ ...prev, vision: data.vision }));
      }

      // Load north star
      const { data: northStar } = await supabase
        .from("portal_north_stars")
        .select("*")
        .eq("plan_id", planId)
        .single();

      if (northStar) {
        setFormData(prev => ({
          ...prev,
          north_star_name: northStar.name || "",
          north_star_definition: northStar.definition || "",
          north_star_unit: northStar.unit || "",
          north_star_target: northStar.annual_target?.toString() || "",
        }));
      }

      // Load objectives
      const { data: objectives } = await supabase
        .from("portal_objectives")
        .select("*, portal_key_results(*)")
        .eq("plan_id", planId)
        .order("priority");

      if (objectives && objectives.length > 0) {
        setFormData(prev => ({
          ...prev,
          objectives: objectives.map(obj => ({
            id: obj.id,
            title: obj.title,
            description: obj.description || "",
            key_results: (obj.portal_key_results || []).map((kr: any) => ({
              id: kr.id,
              title: kr.title,
              unit: kr.unit || "",
              target: kr.target?.toString() || "",
              baseline: kr.baseline?.toString() || "",
            })),
          })),
        }));
      }

    } catch (error) {
      console.error("Error loading plan:", error);
      toast.error("Erro ao carregar plano");
      navigate("/portal/app");
    } finally {
      setLoading(false);
    }
  };

  // Autosave with debounce
  const debouncedSave = useCallback(
    debounce(async (data: Record<string, any>, step: number) => {
      if (!planId) return;
      
      try {
        const { theme, vision, objectives, ...contextData } = data;
        
        await supabase
          .from("portal_plans")
          .update({
            theme: theme || null,
            vision: vision || null,
            context_data: contextData,
            current_step: Math.max(step, plan?.current_step || 1),
          })
          .eq("id", planId);

      } catch (error) {
        console.error("Autosave error:", error);
      }
    }, 1000),
    [planId, plan?.current_step]
  );

  const handleInputChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    debouncedSave(newData, currentStep);
  };

  const saveStep = async () => {
    if (!planId) return;
    setSaving(true);

    try {
      const { theme, vision, objectives, ...contextData } = formData;

      // Save plan
      await supabase
        .from("portal_plans")
        .update({
          theme: theme || null,
          vision: vision || null,
          context_data: contextData,
          current_step: currentStep,
        })
        .eq("id", planId);

      // Save north star (step 2)
      if (currentStep === 2 && formData.north_star_name) {
        const { data: existingNS } = await supabase
          .from("portal_north_stars")
          .select("id")
          .eq("plan_id", planId)
          .single();

        const northStarData = {
          plan_id: planId,
          name: formData.north_star_name,
          definition: formData.north_star_definition,
          unit: formData.north_star_unit,
          annual_target: formData.north_star_target ? parseFloat(formData.north_star_target) : null,
        };

        if (existingNS) {
          await supabase.from("portal_north_stars").update(northStarData).eq("id", existingNS.id);
        } else {
          await supabase.from("portal_north_stars").insert(northStarData);
        }
      }

      // Save objectives (step 3)
      if (currentStep === 3) {
        for (const obj of formData.objectives) {
          if (!obj.title.trim()) continue;

          let objectiveId = obj.id;

          if (obj.id) {
            await supabase
              .from("portal_objectives")
              .update({ title: obj.title, description: obj.description })
              .eq("id", obj.id);
          } else {
            const { data: newObj } = await supabase
              .from("portal_objectives")
              .insert({
                plan_id: planId,
                title: obj.title,
                description: obj.description,
                priority: formData.objectives.indexOf(obj) + 1,
              })
              .select()
              .single();
            
            if (newObj) objectiveId = newObj.id;
          }

          // Save key results
          if (objectiveId) {
            for (const kr of obj.key_results) {
              if (!kr.title.trim()) continue;

              const krData = {
                objective_id: objectiveId,
                title: kr.title,
                unit: kr.unit,
                target: kr.target ? parseFloat(kr.target) : 0,
                baseline: kr.baseline ? parseFloat(kr.baseline) : 0,
              };

              if (kr.id) {
                await supabase.from("portal_key_results").update(krData).eq("id", kr.id);
              } else {
                await supabase.from("portal_key_results").insert(krData);
              }
            }
          }
        }
      }

      toast.success("Salvo com sucesso!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    await saveStep();
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const publishPlan = async () => {
    if (!planId) return;
    setSaving(true);

    try {
      await supabase
        .from("portal_plans")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          current_step: 7,
        })
        .eq("id", planId);

      toast.success("Plano publicado com sucesso!");
      navigate("/portal/app/dashboard");
    } catch (error) {
      console.error("Publish error:", error);
      toast.error("Erro ao publicar plano");
    } finally {
      setSaving(false);
    }
  };

  const addObjective = () => {
    setFormData(prev => ({
      ...prev,
      objectives: [
        ...prev.objectives,
        { title: "", description: "", key_results: [{ title: "", unit: "", target: "", baseline: "" }] }
      ],
    }));
  };

  const addKeyResult = (objIndex: number) => {
    const newObjectives = [...formData.objectives];
    newObjectives[objIndex].key_results.push({ title: "", unit: "", target: "", baseline: "" });
    setFormData(prev => ({ ...prev, objectives: newObjectives }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const progress = Math.round((currentStep / 7) * 100);
  const StepIcon = STEPS[currentStep - 1].icon;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 lg:top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-white">Planejamento 2026</h1>
              <p className="text-sm text-slate-400">
                Etapa {currentStep} de 7: {STEPS[currentStep - 1].title}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={saveStep}
              disabled={saving}
              className="border-slate-700 text-slate-300"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Progress value={progress} className="flex-1 h-2 bg-slate-800" />
            <span className="text-xs text-slate-400 w-12 text-right">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <StepIcon className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-white">{STEPS[currentStep - 1].title}</CardTitle>
                <CardDescription className="text-slate-400">
                  {STEPS[currentStep - 1].description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Context */}
            {currentStep === 1 && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Segmento de Atuação</Label>
                    <Input
                      placeholder="Ex: SaaS B2B, E-commerce, Serviços"
                      value={formData.segment}
                      onChange={(e) => handleInputChange("segment", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Ticket Médio (R$)</Label>
                    <Input
                      placeholder="Ex: 5000"
                      value={formData.avg_ticket}
                      onChange={(e) => handleInputChange("avg_ticket", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Canais de Venda</Label>
                  <Input
                    placeholder="Ex: Inside Sales, Field Sales, E-commerce"
                    value={formData.channels}
                    onChange={(e) => handleInputChange("channels", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Tamanho do Time</Label>
                    <Input
                      placeholder="Ex: 15 pessoas"
                      value={formData.team_size}
                      onChange={(e) => handleInputChange("team_size", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Capacidade de Entrega</Label>
                    <Input
                      placeholder="Ex: 50 clientes/mês"
                      value={formData.delivery_capacity}
                      onChange={(e) => handleInputChange("delivery_capacity", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Margem (%)</Label>
                    <Input
                      placeholder="Ex: 30%"
                      value={formData.margin}
                      onChange={(e) => handleInputChange("margin", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-white font-medium mb-4">📊 Fotografia Atual (Números)</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Receita Mensal (R$)</Label>
                      <Input
                        placeholder="500.000"
                        value={formData.current_revenue}
                        onChange={(e) => handleInputChange("current_revenue", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">CAC (R$)</Label>
                      <Input
                        placeholder="1.000"
                        value={formData.cac}
                        onChange={(e) => handleInputChange("cac", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">LTV (R$)</Label>
                      <Input
                        placeholder="15.000"
                        value={formData.ltv}
                        onChange={(e) => handleInputChange("ltv", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Leads/Mês</Label>
                      <Input
                        placeholder="300"
                        value={formData.leads_month}
                        onChange={(e) => handleInputChange("leads_month", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Conversão (%)</Label>
                      <Input
                        placeholder="5%"
                        value={formData.conversion}
                        onChange={(e) => handleInputChange("conversion", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">NPS</Label>
                      <Input
                        placeholder="45"
                        value={formData.nps}
                        onChange={(e) => handleInputChange("nps", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Restrições e Limitações</Label>
                  <Textarea
                    placeholder="Descreva limitações de orçamento, time, tecnologia, mercado..."
                    value={formData.constraints}
                    onChange={(e) => handleInputChange("constraints", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white min-h-[100px]"
                  />
                </div>
              </>
            )}

            {/* Step 2: Direction */}
            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">Visão para 2026</Label>
                  <Textarea
                    placeholder="Como você quer que sua empresa esteja ao final de 2026?"
                    value={formData.vision}
                    onChange={(e) => handleInputChange("vision", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Tema do Ano (1 frase)</Label>
                  <Input
                    placeholder='Ex: "O ano da escala", "Consolidar e crescer 3x"'
                    value={formData.theme}
                    onChange={(e) => handleInputChange("theme", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-white font-medium mb-4">🎯 North Star Metric</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    A métrica única que, se crescer, significa que tudo está funcionando.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Nome da Métrica</Label>
                      <Input
                        placeholder="Ex: MRR, Clientes Ativos, NPS"
                        value={formData.north_star_name}
                        onChange={(e) => handleInputChange("north_star_name", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Unidade</Label>
                      <Input
                        placeholder="Ex: R$, unidades, %"
                        value={formData.north_star_unit}
                        onChange={(e) => handleInputChange("north_star_unit", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label className="text-slate-300">Definição</Label>
                    <Textarea
                      placeholder="Explique como essa métrica é calculada e por que ela importa"
                      value={formData.north_star_definition}
                      onChange={(e) => handleInputChange("north_star_definition", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label className="text-slate-300">Meta Anual</Label>
                    <Input
                      placeholder="Ex: 1.000.000"
                      value={formData.north_star_target}
                      onChange={(e) => handleInputChange("north_star_target", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 3: OKRs */}
            {currentStep === 3 && (
              <>
                <p className="text-slate-400 text-sm mb-4">
                  Defina 3 a 5 objetivos para 2026, cada um com 2 a 4 resultados-chave mensuráveis.
                </p>

                {formData.objectives.map((obj: any, objIndex: number) => (
                  <div key={objIndex} className="border border-slate-700 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-sm">
                        O{objIndex + 1}
                      </span>
                      <span className="text-white font-medium">Objetivo {objIndex + 1}</span>
                    </div>

                    <div className="space-y-2">
                      <Input
                        placeholder="Título do objetivo (inspiracional, qualitativo)"
                        value={obj.title}
                        onChange={(e) => {
                          const newObjs = [...formData.objectives];
                          newObjs[objIndex].title = e.target.value;
                          setFormData(prev => ({ ...prev, objectives: newObjs }));
                        }}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                      <Textarea
                        placeholder="Descrição do objetivo"
                        value={obj.description}
                        onChange={(e) => {
                          const newObjs = [...formData.objectives];
                          newObjs[objIndex].description = e.target.value;
                          setFormData(prev => ({ ...prev, objectives: newObjs }));
                        }}
                        className="bg-slate-800/50 border-slate-700 text-white text-sm"
                        rows={2}
                      />
                    </div>

                    <div className="pl-4 border-l-2 border-slate-700 space-y-3">
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Key Results</p>
                      {obj.key_results.map((kr: any, krIndex: number) => (
                        <div key={krIndex} className="grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <Input
                              placeholder="KR: resultado mensurável"
                              value={kr.title}
                              onChange={(e) => {
                                const newObjs = [...formData.objectives];
                                newObjs[objIndex].key_results[krIndex].title = e.target.value;
                                setFormData(prev => ({ ...prev, objectives: newObjs }));
                              }}
                              className="bg-slate-800/50 border-slate-700 text-white text-sm"
                            />
                          </div>
                          <Input
                            placeholder="Meta"
                            value={kr.target}
                            onChange={(e) => {
                              const newObjs = [...formData.objectives];
                              newObjs[objIndex].key_results[krIndex].target = e.target.value;
                              setFormData(prev => ({ ...prev, objectives: newObjs }));
                            }}
                            className="bg-slate-800/50 border-slate-700 text-white text-sm"
                          />
                          <Input
                            placeholder="Baseline"
                            value={kr.baseline}
                            onChange={(e) => {
                              const newObjs = [...formData.objectives];
                              newObjs[objIndex].key_results[krIndex].baseline = e.target.value;
                              setFormData(prev => ({ ...prev, objectives: newObjs }));
                            }}
                            className="bg-slate-800/50 border-slate-700 text-white text-sm"
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addKeyResult(objIndex)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        + Adicionar Key Result
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addObjective}
                  className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white"
                >
                  + Adicionar Objetivo
                </Button>
              </>
            )}

            {/* Step 4: Initiatives - simplified for now */}
            {currentStep === 4 && (
              <div className="text-center py-12">
                <Rocket className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-2">Iniciativas</h3>
                <p className="text-slate-400 text-sm mb-4">
                  As iniciativas serão cadastradas após publicar o plano, vinculadas a cada Key Result.
                </p>
                <Button variant="outline" onClick={nextStep} className="border-slate-700 text-slate-300">
                  Continuar para Rocks
                </Button>
              </div>
            )}

            {/* Step 5: Quarterly Rocks */}
            {currentStep === 5 && (
              <>
                <p className="text-slate-400 text-sm mb-4">
                  Defina as prioridades (Rocks) para cada trimestre de 2026.
                </p>

                {["Q1", "Q2", "Q3", "Q4"].map((quarter, index) => (
                  <div key={quarter} className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      <span className="w-8 h-8 bg-amber-500/10 text-amber-400 rounded flex items-center justify-center text-sm font-bold">
                        {quarter}
                      </span>
                      {quarter} - {["Jan-Mar", "Abr-Jun", "Jul-Set", "Out-Dez"][index]}
                    </Label>
                    <Textarea
                      placeholder={`Principais prioridades e metas do ${quarter}...`}
                      value={formData[`q${index + 1}_rocks`]}
                      onChange={(e) => handleInputChange(`q${index + 1}_rocks`, e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                      rows={3}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Step 6: Execution Plan */}
            {currentStep === 6 && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">Cadência Semanal</Label>
                  <Textarea
                    placeholder="Qual a rotina de check-in semanal? Quem participa? Quando?"
                    value={formData.weekly_cadence}
                    onChange={(e) => handleInputChange("weekly_cadence", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Revisão Mensal</Label>
                  <Textarea
                    placeholder="Como será a revisão mensal de progresso?"
                    value={formData.monthly_review}
                    onChange={(e) => handleInputChange("monthly_review", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Revisão Trimestral</Label>
                  <Textarea
                    placeholder="Como será a revisão trimestral? Ajustes de plano?"
                    value={formData.quarterly_review}
                    onChange={(e) => handleInputChange("quarterly_review", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-white font-medium mb-4">⚠️ Riscos e Mitigação</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Principais Riscos</Label>
                      <Textarea
                        placeholder="Liste os principais riscos que podem impedir a execução do plano"
                        value={formData.risks}
                        onChange={(e) => handleInputChange("risks", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Plano de Mitigação</Label>
                      <Textarea
                        placeholder="Como você vai mitigar cada risco identificado?"
                        value={formData.mitigations}
                        onChange={(e) => handleInputChange("mitigations", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 7: Publish */}
            {currentStep === 7 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Pronto para publicar!</h3>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                  Ao publicar, seu plano será travado como versão oficial. 
                  Você poderá criar novas versões ao longo do ano.
                </p>

                <div className="bg-slate-800/50 rounded-lg p-6 text-left max-w-lg mx-auto mb-8">
                  <h4 className="text-white font-medium mb-3">Resumo do Plano</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tema:</span>
                      <span className="text-white">{formData.theme || "Não definido"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">North Star:</span>
                      <span className="text-white">{formData.north_star_name || "Não definido"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Objetivos:</span>
                      <span className="text-white">{formData.objectives.filter((o: any) => o.title).length}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={publishPlan}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Publicar Plano 2026
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-slate-950 border-t border-slate-800 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <div className="flex items-center gap-1">
            {STEPS.map((step) => (
              <button
                key={step.step}
                onClick={() => setCurrentStep(step.step)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentStep === step.step
                    ? "bg-amber-500"
                    : currentStep > step.step
                    ? "bg-green-500"
                    : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {currentStep < 7 ? (
            <Button
              onClick={nextStep}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalPlanningWizard;
