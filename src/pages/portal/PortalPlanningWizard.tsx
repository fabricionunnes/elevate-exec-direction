import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  CheckCircle2,
  Target,
  Calculator,
  AlertTriangle,
  Users,
  Flag,
  Calendar,
  RotateCcw,
  Shield,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Plus,
  Trash2
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
  { step: 1, title: "Diagnóstico Comercial", icon: Target, description: "Fotografia real do comercial" },
  { step: 2, title: "Meta 2026", icon: Calculator, description: "Faturamento e cálculos" },
  { step: 3, title: "Gargalo Principal", icon: AlertTriangle, description: "Onde está travando" },
  { step: 4, title: "Estrutura Necessária", icon: Users, description: "Time e gestão" },
  { step: 5, title: "OKRs Comerciais", icon: Flag, description: "Objetivos e resultados" },
  { step: 6, title: "Plano 90 Dias", icon: Calendar, description: "Execução prioritária" },
  { step: 7, title: "Rotina de Gestão", icon: RotateCcw, description: "Cadência operacional" },
  { step: 8, title: "Governança", icon: Shield, description: "Responsabilidades" },
];

const BOTTLENECK_OPTIONS = [
  { value: "leads", label: "Geração de Leads", description: "Falta demanda qualificada" },
  { value: "conversion", label: "Conversão", description: "Leads não viram clientes" },
  { value: "team", label: "Time Comercial", description: "Falta gente ou qualificação" },
  { value: "management", label: "Gestão / Cobrança", description: "Falta acompanhamento" },
  { value: "process", label: "Processo / CRM", description: "Falta estrutura e controle" },
];

const OWNER_ROLE_OPTIONS = [
  { value: "operational", label: "Operacional", description: "Vendo e faço gestão" },
  { value: "manager", label: "Gestor", description: "Faço gestão, não vendo" },
  { value: "strategic", label: "Estratégico", description: "Só decisões macro" },
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
    // Step 1 - Diagnóstico Comercial
    leads_month: "",
    proposals_month: "",
    sales_month: "",
    avg_ticket: "",
    sales_cycle_days: "",
    salespeople_count: "",
    has_sales_manager: "",
    sales_responsible_name: "",
    
    // Step 2 - Meta 2026
    annual_revenue_goal: "",
    target_avg_ticket: "",
    
    // Step 3 - Gargalo
    main_bottleneck: "",
    bottleneck_reason: "",
    
    // Step 4 - Estrutura
    ideal_salespeople_count: "",
    owner_role: "",
    needs_sales_management: "",
    needs_process_crm: "",
    
    // Step 5 - OKRs
    objectives: [] as Array<{
      id?: string;
      title: string;
      description: string;
      key_results: Array<{
        id?: string;
        title: string;
        unit: string;
        target: string;
        baseline: string;
        owner: string;
      }>;
    }>,
    
    // Step 6 - Plano 90 dias (ações por KR)
    execution_actions: [] as Array<{
      kr_title: string;
      action: string;
      responsible: string;
      deadline: string;
      success_metric: string;
    }>,
    
    // Step 7 - Rotina
    has_weekly_meeting: "",
    weekly_meeting_owner: "",
    tracked_indicators: [] as string[],
    review_frequency: "",
    
    // Step 8 - Governança
    commercial_owner: "",
    action_if_not_meet_60_days: "",
    first_action_after_planning: "",
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
              owner: kr.owner || "",
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
        const { objectives, ...contextData } = data;
        
        await supabase
          .from("portal_plans")
          .update({
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

  const handleInputChange = (field: string, value: string | string[]) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    debouncedSave(newData, currentStep);
  };

  const saveStep = async () => {
    if (!planId) return;
    setSaving(true);

    try {
      const { objectives, ...contextData } = formData;

      // Save plan context
      await supabase
        .from("portal_plans")
        .update({
          context_data: contextData,
          current_step: currentStep,
        })
        .eq("id", planId);

      // Save objectives (step 5)
      if (currentStep === 5) {
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

  // Validações por etapa
  const validateStep = (step: number): { valid: boolean; message?: string } => {
    switch (step) {
      case 1:
        if (!formData.leads_month || !formData.proposals_month || !formData.sales_month || 
            !formData.avg_ticket || !formData.salespeople_count) {
          return { valid: false, message: "Preencha todos os campos obrigatórios do diagnóstico" };
        }
        return { valid: true };
      case 2:
        if (!formData.annual_revenue_goal) {
          return { valid: false, message: "Defina a meta anual de faturamento" };
        }
        return { valid: true };
      case 3:
        if (!formData.main_bottleneck) {
          return { valid: false, message: "Selecione o gargalo principal" };
        }
        return { valid: true };
      case 5:
        if (formData.objectives.length === 0) {
          return { valid: false, message: "Adicione pelo menos 1 objetivo" };
        }
        if (formData.objectives.length > 3) {
          return { valid: false, message: "Máximo de 3 objetivos permitido" };
        }
        for (const obj of formData.objectives) {
          if (obj.key_results.length < 2 || obj.key_results.length > 3) {
            return { valid: false, message: "Cada objetivo deve ter de 2 a 3 Key Results" };
          }
          for (const kr of obj.key_results) {
            if (!kr.unit || !kr.target || !kr.owner) {
              return { valid: false, message: "Cada KR deve ter unidade, meta e dono" };
            }
          }
        }
        return { valid: true };
      case 7:
        if (!formData.has_weekly_meeting || !formData.review_frequency) {
          return { valid: false, message: "Defina a rotina de gestão" };
        }
        return { valid: true };
      case 8:
        if (!formData.commercial_owner || !formData.first_action_after_planning) {
          return { valid: false, message: "Preencha os campos de governança" };
        }
        return { valid: true };
      default:
        return { valid: true };
    }
  };

  const nextStep = async () => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    
    await saveStep();
    if (currentStep < 8) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const publishPlan = async () => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    if (!planId) return;
    setSaving(true);

    try {
      await saveStep();
      
      await supabase
        .from("portal_plans")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          current_step: 8,
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
    if (formData.objectives.length >= 3) {
      toast.error("Máximo de 3 objetivos");
      return;
    }
    setFormData(prev => ({
      ...prev,
      objectives: [
        ...prev.objectives,
        { 
          title: "", 
          description: "", 
          key_results: [
            { title: "", unit: "", target: "", baseline: "", owner: "" },
            { title: "", unit: "", target: "", baseline: "", owner: "" }
          ] 
        }
      ],
    }));
  };

  const removeObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_: any, i: number) => i !== index),
    }));
  };

  const addKeyResult = (objIndex: number) => {
    if (formData.objectives[objIndex].key_results.length >= 3) {
      toast.error("Máximo de 3 Key Results por objetivo");
      return;
    }
    const newObjectives = [...formData.objectives];
    newObjectives[objIndex].key_results.push({ title: "", unit: "", target: "", baseline: "", owner: "" });
    setFormData(prev => ({ ...prev, objectives: newObjectives }));
  };

  const removeKeyResult = (objIndex: number, krIndex: number) => {
    if (formData.objectives[objIndex].key_results.length <= 2) {
      toast.error("Mínimo de 2 Key Results por objetivo");
      return;
    }
    const newObjectives = [...formData.objectives];
    newObjectives[objIndex].key_results = newObjectives[objIndex].key_results.filter((_: any, i: number) => i !== krIndex);
    setFormData(prev => ({ ...prev, objectives: newObjectives }));
  };

  // Cálculos automáticos da Etapa 2
  const calculations = {
    monthlyGoal: formData.annual_revenue_goal ? parseFloat(formData.annual_revenue_goal) / 12 : 0,
    salesNeeded: formData.annual_revenue_goal && formData.target_avg_ticket 
      ? Math.ceil((parseFloat(formData.annual_revenue_goal) / 12) / parseFloat(formData.target_avg_ticket))
      : (formData.annual_revenue_goal && formData.avg_ticket 
          ? Math.ceil((parseFloat(formData.annual_revenue_goal) / 12) / parseFloat(formData.avg_ticket))
          : 0),
    currentSalesPerMonth: parseFloat(formData.sales_month) || 0,
    currentLeadsPerMonth: parseFloat(formData.leads_month) || 0,
    currentProposalsPerMonth: parseFloat(formData.proposals_month) || 0,
    conversionLeadToProposal: formData.leads_month && formData.proposals_month
      ? ((parseFloat(formData.proposals_month) / parseFloat(formData.leads_month)) * 100).toFixed(1)
      : 0,
    conversionProposalToSale: formData.proposals_month && formData.sales_month
      ? ((parseFloat(formData.sales_month) / parseFloat(formData.proposals_month)) * 100).toFixed(1)
      : 0,
  };

  const proposalsNeeded = calculations.conversionProposalToSale && calculations.salesNeeded
    ? Math.ceil(calculations.salesNeeded / (parseFloat(calculations.conversionProposalToSale as string) / 100))
    : 0;
  
  const leadsNeeded = calculations.conversionLeadToProposal && proposalsNeeded
    ? Math.ceil(proposalsNeeded / (parseFloat(calculations.conversionLeadToProposal as string) / 100))
    : 0;

  const getGapStatus = (current: number, needed: number) => {
    if (needed === 0) return "neutral";
    const ratio = current / needed;
    if (ratio >= 0.9) return "ok";
    if (ratio >= 0.6) return "attention";
    return "critical";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const progress = Math.round((currentStep / 8) * 100);
  const StepIcon = STEPS[currentStep - 1].icon;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 lg:top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-white">Planejamento Comercial 2026</h1>
              <p className="text-sm text-slate-400">
                Etapa {currentStep} de 8: {STEPS[currentStep - 1].title}
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
            {/* Step 1: Diagnóstico Comercial Real */}
            {currentStep === 1 && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                  <p className="text-amber-300 text-sm">
                    <strong>Importante:</strong> Preencha com números reais, não estimativas. 
                    Se não souber exatamente, levante os dados antes de continuar.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Leads/mês atual *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 150"
                      value={formData.leads_month}
                      onChange={(e) => handleInputChange("leads_month", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Propostas/mês atual *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 30"
                      value={formData.proposals_month}
                      onChange={(e) => handleInputChange("proposals_month", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Vendas/mês atual *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 10"
                      value={formData.sales_month}
                      onChange={(e) => handleInputChange("sales_month", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Ticket Médio Real (R$) *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 5000"
                      value={formData.avg_ticket}
                      onChange={(e) => handleInputChange("avg_ticket", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Ciclo Médio de Vendas (dias)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 30"
                      value={formData.sales_cycle_days}
                      onChange={(e) => handleInputChange("sales_cycle_days", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-white font-medium mb-4">Estrutura Atual</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Quantidade de Vendedores *</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 3"
                        value={formData.salespeople_count}
                        onChange={(e) => handleInputChange("salespeople_count", e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Existe Gestor Comercial?</Label>
                      <RadioGroup
                        value={formData.has_sales_manager}
                        onValueChange={(value) => handleInputChange("has_sales_manager", value)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="manager-yes" />
                          <Label htmlFor="manager-yes" className="text-slate-300">Sim</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="manager-no" />
                          <Label htmlFor="manager-no" className="text-slate-300">Não</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label className="text-slate-300">Quem responde pelo comercial? (Nome)</Label>
                    <Input
                      placeholder="Nome do responsável"
                      value={formData.sales_responsible_name}
                      onChange={(e) => handleInputChange("sales_responsible_name", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                {/* Resumo calculado */}
                {formData.leads_month && formData.proposals_month && formData.sales_month && (
                  <div className="bg-slate-800/50 rounded-lg p-4 mt-6">
                    <h4 className="text-white font-medium mb-3">Taxas Calculadas</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Lead → Proposta:</span>
                        <span className="text-white ml-2 font-medium">{calculations.conversionLeadToProposal}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Proposta → Venda:</span>
                        <span className="text-white ml-2 font-medium">{calculations.conversionProposalToSale}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 2: Meta Comercial 2026 */}
            {currentStep === 2 && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Meta Anual de Faturamento (R$) *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 1200000"
                      value={formData.annual_revenue_goal}
                      onChange={(e) => handleInputChange("annual_revenue_goal", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Ticket Médio Desejado (R$)</Label>
                    <Input
                      type="number"
                      placeholder={formData.avg_ticket || "Usar ticket atual"}
                      value={formData.target_avg_ticket}
                      onChange={(e) => handleInputChange("target_avg_ticket", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                    <p className="text-xs text-slate-500">Deixe vazio para usar o ticket atual</p>
                  </div>
                </div>

                {formData.annual_revenue_goal && (
                  <div className="bg-slate-800/50 rounded-lg p-6 mt-6">
                    <h4 className="text-white font-medium mb-4">Cálculos Automáticos</h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm mb-1">Meta Mensal</p>
                        <p className="text-2xl font-bold text-white">
                          R$ {calculations.monthlyGoal.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm mb-1">Vendas/mês necessárias</p>
                        <p className="text-2xl font-bold text-white">{calculations.salesNeeded}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm mb-1">Propostas/mês necessárias</p>
                        <p className="text-2xl font-bold text-white">{proposalsNeeded || "-"}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm mb-1">Leads/mês necessários</p>
                        <p className="text-2xl font-bold text-white">{leadsNeeded || "-"}</p>
                      </div>
                    </div>

                    {/* Comparativo Atual x Necessário */}
                    <div className="mt-6 border-t border-slate-700 pt-6">
                      <h5 className="text-white font-medium mb-4">Comparativo: Atual x Necessário</h5>
                      <div className="space-y-4">
                        {[
                          { label: "Leads/mês", current: calculations.currentLeadsPerMonth, needed: leadsNeeded },
                          { label: "Propostas/mês", current: calculations.currentProposalsPerMonth, needed: proposalsNeeded },
                          { label: "Vendas/mês", current: calculations.currentSalesPerMonth, needed: calculations.salesNeeded },
                        ].map((item) => {
                          const status = getGapStatus(item.current, item.needed);
                          return (
                            <div key={item.label} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                              <span className="text-slate-300">{item.label}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-400">Atual: <strong className="text-white">{item.current}</strong></span>
                                <span className="text-slate-600">→</span>
                                <span className="text-slate-400">Necessário: <strong className="text-white">{item.needed || "-"}</strong></span>
                                {item.needed > 0 && (
                                  <Badge className={
                                    status === "ok" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                                    status === "attention" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                                    "bg-red-500/20 text-red-400 border-red-500/30"
                                  }>
                                    {status === "ok" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                    {status === "attention" && <AlertCircle className="w-3 h-3 mr-1" />}
                                    {status === "critical" && <AlertTriangle className="w-3 h-3 mr-1" />}
                                    {status === "ok" ? "OK" : status === "attention" ? "Atenção" : "Gap Crítico"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Gargalo Principal */}
            {currentStep === 3 && (
              <>
                <div className="space-y-4">
                  <Label className="text-slate-300 text-lg">Onde está o maior gargalo hoje? *</Label>
                  <RadioGroup
                    value={formData.main_bottleneck}
                    onValueChange={(value) => handleInputChange("main_bottleneck", value)}
                    className="grid gap-3"
                  >
                    {BOTTLENECK_OPTIONS.map((option) => (
                      <div 
                        key={option.value}
                        className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-all ${
                          formData.main_bottleneck === option.value 
                            ? "border-amber-500 bg-amber-500/10" 
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                        }`}
                        onClick={() => handleInputChange("main_bottleneck", option.value)}
                      >
                        <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                        <div>
                          <Label htmlFor={option.value} className="text-white font-medium cursor-pointer">
                            {option.label}
                          </Label>
                          <p className="text-sm text-slate-400 mt-1">{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2 mt-6">
                  <Label className="text-slate-300">Por que esse é o gargalo?</Label>
                  <Textarea
                    placeholder="Explique com detalhes o que está travando..."
                    value={formData.bottleneck_reason}
                    onChange={(e) => handleInputChange("bottleneck_reason", e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white min-h-[120px]"
                  />
                </div>
              </>
            )}

            {/* Step 4: Estrutura Comercial Necessária */}
            {currentStep === 4 && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Quantidade ideal de vendedores para a meta</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 5"
                      value={formData.ideal_salespeople_count}
                      onChange={(e) => handleInputChange("ideal_salespeople_count", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                    {formData.salespeople_count && formData.ideal_salespeople_count && (
                      <p className="text-xs text-slate-400">
                        Atual: {formData.salespeople_count} vendedores | 
                        Gap: {parseInt(formData.ideal_salespeople_count) - parseInt(formData.salespeople_count)} pessoa(s)
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <Label className="text-slate-300 text-lg">Papel do dono no comercial</Label>
                  <RadioGroup
                    value={formData.owner_role}
                    onValueChange={(value) => handleInputChange("owner_role", value)}
                    className="grid md:grid-cols-3 gap-3"
                  >
                    {OWNER_ROLE_OPTIONS.map((option) => (
                      <div 
                        key={option.value}
                        className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all text-center ${
                          formData.owner_role === option.value 
                            ? "border-amber-500 bg-amber-500/10" 
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                        }`}
                        onClick={() => handleInputChange("owner_role", option.value)}
                      >
                        <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                        <Label htmlFor={option.value} className="text-white font-medium cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-xs text-slate-400 mt-1">{option.description}</p>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-3">
                    <Label className="text-slate-300">Precisa de gestão comercial dedicada?</Label>
                    <RadioGroup
                      value={formData.needs_sales_management}
                      onValueChange={(value) => handleInputChange("needs_sales_management", value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="needs-mgmt-yes" />
                        <Label htmlFor="needs-mgmt-yes" className="text-slate-300">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="needs-mgmt-no" />
                        <Label htmlFor="needs-mgmt-no" className="text-slate-300">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-slate-300">Precisa de processo/CRM estruturado?</Label>
                    <RadioGroup
                      value={formData.needs_process_crm}
                      onValueChange={(value) => handleInputChange("needs_process_crm", value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="needs-crm-yes" />
                        <Label htmlFor="needs-crm-yes" className="text-slate-300">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="needs-crm-no" />
                        <Label htmlFor="needs-crm-no" className="text-slate-300">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </>
            )}

            {/* Step 5: OKRs Comerciais */}
            {currentStep === 5 && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                  <p className="text-amber-300 text-sm">
                    <strong>Regras:</strong> Máximo de 3 Objetivos. Cada Objetivo com 2 a 3 Key Results. 
                    Cada KR deve ter unidade de medida, meta clara e dono responsável.
                  </p>
                </div>

                {formData.objectives.map((obj: any, objIndex: number) => (
                  <div key={objIndex} className="border border-slate-700 rounded-lg p-4 space-y-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-sm">
                          O{objIndex + 1}
                        </span>
                        <span className="text-white font-medium">Objetivo {objIndex + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeObjective(objIndex)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Input
                        placeholder="Título do objetivo (inspiracional)"
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

                    <div className="pl-4 border-l-2 border-amber-500/30 space-y-3">
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Key Results</p>
                      {obj.key_results.map((kr: any, krIndex: number) => (
                        <div key={krIndex} className="bg-slate-800/30 rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">KR {krIndex + 1}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeKeyResult(objIndex, krIndex)}
                              className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Resultado-chave mensurável"
                            value={kr.title}
                            onChange={(e) => {
                              const newObjs = [...formData.objectives];
                              newObjs[objIndex].key_results[krIndex].title = e.target.value;
                              setFormData(prev => ({ ...prev, objectives: newObjs }));
                            }}
                            className="bg-slate-800/50 border-slate-700 text-white text-sm"
                          />
                          <div className="grid grid-cols-4 gap-2">
                            <Input
                              placeholder="Unidade *"
                              value={kr.unit}
                              onChange={(e) => {
                                const newObjs = [...formData.objectives];
                                newObjs[objIndex].key_results[krIndex].unit = e.target.value;
                                setFormData(prev => ({ ...prev, objectives: newObjs }));
                              }}
                              className="bg-slate-800/50 border-slate-700 text-white text-sm"
                            />
                            <Input
                              placeholder="Meta *"
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
                            <Input
                              placeholder="Dono *"
                              value={kr.owner}
                              onChange={(e) => {
                                const newObjs = [...formData.objectives];
                                newObjs[objIndex].key_results[krIndex].owner = e.target.value;
                                setFormData(prev => ({ ...prev, objectives: newObjs }));
                              }}
                              className="bg-slate-800/50 border-slate-700 text-white text-sm"
                            />
                          </div>
                        </div>
                      ))}
                      {obj.key_results.length < 3 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addKeyResult(objIndex)}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Adicionar Key Result
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {formData.objectives.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addObjective}
                    className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Objetivo ({formData.objectives.length}/3)
                  </Button>
                )}
              </>
            )}

            {/* Step 6: Plano de Execução 90 Dias */}
            {currentStep === 6 && (
              <>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <p className="text-blue-300 text-sm">
                    Para cada Key Result, defina a ação prioritária dos próximos 90 dias.
                  </p>
                </div>

                {formData.objectives.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Nenhum OKR definido ainda.</p>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep(5)}
                      className="mt-4 border-slate-700 text-slate-300"
                    >
                      Voltar para OKRs
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {formData.objectives.map((obj: any, objIndex: number) => (
                      <div key={objIndex}>
                        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs">
                            O{objIndex + 1}
                          </span>
                          {obj.title || `Objetivo ${objIndex + 1}`}
                        </h4>
                        {obj.key_results.map((kr: any, krIndex: number) => {
                          const actionIndex = formData.execution_actions?.findIndex(
                            (a: any) => a.kr_title === kr.title
                          );
                          const action = actionIndex >= 0 ? formData.execution_actions[actionIndex] : {
                            kr_title: kr.title,
                            action: "",
                            responsible: kr.owner || "",
                            deadline: "",
                            success_metric: ""
                          };
                          
                          const updateAction = (field: string, value: string) => {
                            const newActions = [...(formData.execution_actions || [])];
                            const existingIndex = newActions.findIndex(a => a.kr_title === kr.title);
                            if (existingIndex >= 0) {
                              newActions[existingIndex] = { ...newActions[existingIndex], [field]: value };
                            } else {
                              newActions.push({ ...action, kr_title: kr.title, [field]: value });
                            }
                            handleInputChange("execution_actions", newActions as any);
                          };

                          return (
                            <div key={krIndex} className="bg-slate-800/30 rounded-lg p-4 mb-3 ml-8 border-l-2 border-blue-500/30">
                              <p className="text-sm text-slate-400 mb-3">
                                KR: <span className="text-white">{kr.title || `KR ${krIndex + 1}`}</span>
                              </p>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="md:col-span-2 space-y-1">
                                  <Label className="text-xs text-slate-500">Ação Prioritária</Label>
                                  <Input
                                    placeholder="O que fazer nos próximos 90 dias?"
                                    value={action.action}
                                    onChange={(e) => updateAction("action", e.target.value)}
                                    className="bg-slate-800/50 border-slate-700 text-white text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-500">Responsável</Label>
                                  <Input
                                    placeholder="Quem faz?"
                                    value={action.responsible}
                                    onChange={(e) => updateAction("responsible", e.target.value)}
                                    className="bg-slate-800/50 border-slate-700 text-white text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-500">Prazo</Label>
                                  <Input
                                    type="date"
                                    value={action.deadline}
                                    onChange={(e) => updateAction("deadline", e.target.value)}
                                    className="bg-slate-800/50 border-slate-700 text-white text-sm"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                  <Label className="text-xs text-slate-500">Métrica de Sucesso</Label>
                                  <Input
                                    placeholder="Como saber que funcionou?"
                                    value={action.success_metric}
                                    onChange={(e) => updateAction("success_metric", e.target.value)}
                                    className="bg-slate-800/50 border-slate-700 text-white text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 7: Rotina de Gestão */}
            {currentStep === 7 && (
              <>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-slate-300">Existe reunião semanal de vendas? *</Label>
                    <RadioGroup
                      value={formData.has_weekly_meeting}
                      onValueChange={(value) => handleInputChange("has_weekly_meeting", value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="weekly-yes" />
                        <Label htmlFor="weekly-yes" className="text-slate-300">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="weekly-no" />
                        <Label htmlFor="weekly-no" className="text-slate-300">Não, vamos implementar</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Quem puxa os números?</Label>
                    <Input
                      placeholder="Nome do responsável pela reunião"
                      value={formData.weekly_meeting_owner}
                      onChange={(e) => handleInputChange("weekly_meeting_owner", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-300">Indicadores analisados na reunião</Label>
                    <div className="grid md:grid-cols-2 gap-2">
                      {["Leads gerados", "Propostas enviadas", "Vendas fechadas", "Ticket médio", "Conversão", "Pipeline", "Meta vs Realizado", "Forecast"].map((indicator) => (
                        <label 
                          key={indicator}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                            (formData.tracked_indicators || []).includes(indicator)
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={(formData.tracked_indicators || []).includes(indicator)}
                            onChange={(e) => {
                              const current = formData.tracked_indicators || [];
                              if (e.target.checked) {
                                handleInputChange("tracked_indicators", [...current, indicator]);
                              } else {
                                handleInputChange("tracked_indicators", current.filter((i: string) => i !== indicator));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className={`text-sm ${
                            (formData.tracked_indicators || []).includes(indicator) ? "text-amber-300" : "text-slate-300"
                          }`}>
                            {indicator}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-300">Frequência de revisão do plano *</Label>
                    <RadioGroup
                      value={formData.review_frequency}
                      onValueChange={(value) => handleInputChange("review_frequency", value)}
                      className="flex flex-wrap gap-4"
                    >
                      {[
                        { value: "weekly", label: "Semanal" },
                        { value: "biweekly", label: "Quinzenal" },
                        { value: "monthly", label: "Mensal" },
                      ].map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`freq-${option.value}`} />
                          <Label htmlFor={`freq-${option.value}`} className="text-slate-300">{option.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </>
            )}

            {/* Step 8: Governança */}
            {currentStep === 8 && (
              <>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Dono final do resultado comercial *</Label>
                    <Input
                      placeholder="Nome do responsável máximo"
                      value={formData.commercial_owner}
                      onChange={(e) => handleInputChange("commercial_owner", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">O que muda se não bater meta em 60 dias?</Label>
                    <Textarea
                      placeholder="Descreva as consequências e ações de contingência..."
                      value={formData.action_if_not_meet_60_days}
                      onChange={(e) => handleInputChange("action_if_not_meet_60_days", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Primeira ação após o planejamento *</Label>
                    <Textarea
                      placeholder="O que você vai fazer amanhã para começar a executar?"
                      value={formData.first_action_after_planning}
                      onChange={(e) => handleInputChange("first_action_after_planning", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white min-h-[80px]"
                    />
                  </div>

                  {/* Resumo final */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 mt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                      <h4 className="text-white font-medium">Resumo do Planejamento</h4>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Meta anual:</span>
                        <span className="text-white ml-2">R$ {parseFloat(formData.annual_revenue_goal || 0).toLocaleString('pt-BR')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Objetivos:</span>
                        <span className="text-white ml-2">{formData.objectives?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Gargalo principal:</span>
                        <span className="text-white ml-2">
                          {BOTTLENECK_OPTIONS.find(b => b.value === formData.main_bottleneck)?.label || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Dono do resultado:</span>
                        <span className="text-white ml-2">{formData.commercial_owner || "-"}</span>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-green-500/20">
                      <Button
                        onClick={publishPlan}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Publicar Planejamento 2026
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="border-slate-700 text-slate-300"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <div className="flex items-center gap-2">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className={`w-2 h-2 rounded-full transition-all ${
                  s.step === currentStep
                    ? "bg-amber-500 w-4"
                    : s.step < currentStep
                    ? "bg-amber-500/50"
                    : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {currentStep < 8 ? (
            <Button
              onClick={nextStep}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950"
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="w-24" /> // Spacer
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalPlanningWizard;
