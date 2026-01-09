import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
  Send,
  Loader2,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Compass,
  Flag,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuarterlyGoals {
  q1: { pessimista: string; realista: string; otimista: string };
  q2: { pessimista: string; realista: string; otimista: string };
  q3: { pessimista: string; realista: string; otimista: string };
  q4: { pessimista: string; realista: string; otimista: string };
}

interface SalesHistoryEntry {
  month_year: string;
  revenue: number;
  sales_count: number | null;
}

interface KickoffFormData {
  // Diagnóstico Comercial
  main_challenges: string;
  sales_team_size: string;
  conversion_rate: string;
  average_ticket: string;
  acquisition_channels: string;
  target_audience: string;
  has_structured_process: string;
  crm_usage: string;
  competitors: string;
  has_sales_goals: string;
  
  // SWOT
  swot_strengths: string;
  swot_weaknesses: string;
  swot_opportunities: string;
  swot_threats: string;
  
  // Checklist
  commercial_structure: string;
  growth_target: string;
  tools_used: string;
  
  // OKRs
  objectives_with_unv: string;
  key_results: string;
  
  // Metas Trimestrais
  quarterly_goals: QuarterlyGoals;
  
  // Expectativas
  growth_expectation_3m: string;
  growth_expectation_6m: string;
  growth_expectation_12m: string;
  
  // Notas
  notes: string;
}

const STEPS = [
  { id: 1, title: "Diagnóstico Comercial", icon: BarChart3 },
  { id: 2, title: "Análise SWOT", icon: Compass },
  { id: 3, title: "Checklist & OKRs", icon: Target },
  { id: 4, title: "Metas Trimestrais", icon: TrendingUp },
  { id: 5, title: "Histórico de Vendas", icon: History },
  { id: 6, title: "Expectativas", icon: Flag },
];

// Generate last 12 months for sales history
const generateLast12Months = (): SalesHistoryEntry[] => {
  const months: SalesHistoryEntry[] = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const date = subMonths(now, i);
    const monthYear = format(date, "yyyy-MM-01");
    months.push({ month_year: monthYear, revenue: 0, sales_count: null });
  }
  return months;
};

const initialFormData: KickoffFormData = {
  main_challenges: "",
  sales_team_size: "",
  conversion_rate: "",
  average_ticket: "",
  acquisition_channels: "",
  target_audience: "",
  has_structured_process: "",
  crm_usage: "",
  competitors: "",
  has_sales_goals: "",
  swot_strengths: "",
  swot_weaknesses: "",
  swot_opportunities: "",
  swot_threats: "",
  commercial_structure: "",
  growth_target: "",
  tools_used: "",
  objectives_with_unv: "",
  key_results: "",
  quarterly_goals: {
    q1: { pessimista: "", realista: "", otimista: "" },
    q2: { pessimista: "", realista: "", otimista: "" },
    q3: { pessimista: "", realista: "", otimista: "" },
    q4: { pessimista: "", realista: "", otimista: "" },
  },
  growth_expectation_3m: "",
  growth_expectation_6m: "",
  growth_expectation_12m: "",
  notes: "",
};

const KickoffFormPage = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<KickoffFormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [salesHistory, setSalesHistory] = useState<SalesHistoryEntry[]>(generateLast12Months());

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
      fetchExistingSalesHistory();
    }
  }, [companyId]);

  const fetchExistingSalesHistory = async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from("company_sales_history")
        .select("month_year, revenue, sales_count")
        .eq("company_id", companyId)
        .eq("is_pre_unv", true)
        .order("month_year", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Merge with existing months template
        const template = generateLast12Months();
        const merged = template.map(month => {
          const existing = data.find(d => d.month_year === month.month_year);
          if (existing) {
            return {
              month_year: month.month_year,
              revenue: existing.revenue || 0,
              sales_count: existing.sales_count,
            };
          }
          return month;
        });
        setSalesHistory(merged);
      }
    } catch (error) {
      console.error("Error fetching sales history:", error);
    }
  };

  const fetchCompanyData = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;

      if (data) {
        setCompanyName(data.name);
        
        const rawQuarterlyGoals = data.quarterly_goals as unknown;
        const quarterlyGoals = rawQuarterlyGoals && typeof rawQuarterlyGoals === 'object' && 'q1' in rawQuarterlyGoals
          ? rawQuarterlyGoals as QuarterlyGoals
          : initialFormData.quarterly_goals;

        setFormData({
          main_challenges: data.main_challenges || "",
          sales_team_size: (data as any).sales_team_size || "",
          conversion_rate: (data as any).conversion_rate || "",
          average_ticket: (data as any).average_ticket || "",
          acquisition_channels: (data as any).acquisition_channels || "",
          target_audience: data.target_audience || "",
          has_structured_process: (data as any).has_structured_process || "",
          crm_usage: (data as any).crm_usage || "",
          competitors: data.competitors || "",
          has_sales_goals: (data as any).has_sales_goals || "",
          swot_strengths: (data as any).swot_strengths || "",
          swot_weaknesses: (data as any).swot_weaknesses || "",
          swot_opportunities: (data as any).swot_opportunities || "",
          swot_threats: (data as any).swot_threats || "",
          commercial_structure: (data as any).commercial_structure || "",
          growth_target: (data as any).growth_target || "",
          tools_used: (data as any).tools_used || "",
          objectives_with_unv: (data as any).objectives_with_unv || "",
          key_results: (data as any).key_results || "",
          quarterly_goals: quarterlyGoals || initialFormData.quarterly_goals,
          growth_expectation_3m: (data as any).growth_expectation_3m || "",
          growth_expectation_6m: (data as any).growth_expectation_6m || "",
          growth_expectation_12m: (data as any).growth_expectation_12m || "",
          notes: data.notes || "",
        });
      }
    } catch (error) {
      console.error("Error fetching company:", error);
      toast.error("Erro ao carregar dados da empresa");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof KickoffFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateQuarterlyGoal = (quarter: keyof QuarterlyGoals, type: 'pessimista' | 'realista' | 'otimista', value: string) => {
    setFormData((prev) => ({
      ...prev,
      quarterly_goals: {
        ...prev.quarterly_goals,
        [quarter]: {
          ...prev.quarterly_goals[quarter],
          [type]: value,
        },
      },
    }));
  };

  const updateSalesHistory = (index: number, field: keyof SalesHistoryEntry, value: any) => {
    setSalesHistory(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSubmit = async () => {
    if (!companyId) return;
    
    setSaving(true);
    try {
      // Save company data
      const { error } = await supabase
        .from("onboarding_companies")
        .update({
          main_challenges: formData.main_challenges || null,
          sales_team_size: formData.sales_team_size || null,
          conversion_rate: formData.conversion_rate || null,
          average_ticket: formData.average_ticket || null,
          acquisition_channels: formData.acquisition_channels || null,
          target_audience: formData.target_audience || null,
          has_structured_process: formData.has_structured_process || null,
          crm_usage: formData.crm_usage || null,
          competitors: formData.competitors || null,
          has_sales_goals: formData.has_sales_goals || null,
          swot_strengths: formData.swot_strengths || null,
          swot_weaknesses: formData.swot_weaknesses || null,
          swot_opportunities: formData.swot_opportunities || null,
          swot_threats: formData.swot_threats || null,
          commercial_structure: formData.commercial_structure || null,
          growth_target: formData.growth_target || null,
          tools_used: formData.tools_used || null,
          objectives_with_unv: formData.objectives_with_unv || null,
          key_results: formData.key_results || null,
          quarterly_goals: JSON.parse(JSON.stringify(formData.quarterly_goals)),
          growth_expectation_3m: formData.growth_expectation_3m || null,
          growth_expectation_6m: formData.growth_expectation_6m || null,
          growth_expectation_12m: formData.growth_expectation_12m || null,
          notes: formData.notes || null,
        } as any)
        .eq("id", companyId);

      if (error) throw error;

      // Save sales history - only entries with revenue > 0
      const salesEntries = salesHistory.filter(e => e.revenue > 0);
      if (salesEntries.length > 0) {
        // Delete existing pre-UNV entries first
        await supabase
          .from("company_sales_history")
          .delete()
          .eq("company_id", companyId)
          .eq("is_pre_unv", true);

        // Insert new entries
        const { error: salesError } = await supabase
          .from("company_sales_history")
          .insert(
            salesEntries.map(entry => ({
              company_id: companyId,
              month_year: entry.month_year,
              revenue: entry.revenue,
              sales_count: entry.sales_count,
              is_pre_unv: true,
            }))
          );

        if (salesError) {
          console.error("Error saving sales history:", salesError);
        }
      }

      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error) {
      console.error("Error saving kickoff:", error);
      toast.error("Erro ao enviar formulário");
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Formulário Enviado!</h1>
            <p className="text-muted-foreground mb-6">
              Obrigado por preencher o formulário de Kickoff. Nossa equipe irá analisar as informações.
            </p>
            {companyName && (
              <Badge variant="secondary" className="text-base px-4 py-2">
                {companyName}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <h1 className="text-2xl font-bold mb-2">Link Inválido</h1>
            <p className="text-muted-foreground">
              Este link de formulário não é válido ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="main_challenges">1. Qual o seu principal desafio comercial atualmente? *</Label>
              <Textarea
                id="main_challenges"
                value={formData.main_challenges}
                onChange={(e) => updateField("main_challenges", e.target.value)}
                placeholder="Descreva seu principal desafio..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sales_team_size">2. Quantos vendedores ativos há na equipe?</Label>
                <Input
                  id="sales_team_size"
                  value={formData.sales_team_size}
                  onChange={(e) => updateField("sales_team_size", e.target.value)}
                  placeholder="Ex: 5 vendedores"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion_rate">3. Qual a taxa de conversão atual?</Label>
                <Input
                  id="conversion_rate"
                  value={formData.conversion_rate}
                  onChange={(e) => updateField("conversion_rate", e.target.value)}
                  placeholder="Ex: 15%"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="average_ticket">4. Qual o ticket médio de venda?</Label>
                <Input
                  id="average_ticket"
                  value={formData.average_ticket}
                  onChange={(e) => updateField("average_ticket", e.target.value)}
                  placeholder="Ex: R$ 2.500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisition_channels">5. Quais são os principais canais de aquisição?</Label>
                <Input
                  id="acquisition_channels"
                  value={formData.acquisition_channels}
                  onChange={(e) => updateField("acquisition_channels", e.target.value)}
                  placeholder="Ex: Indicação, leads, prospecção"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">6. Qual é o perfil do seu cliente ideal?</Label>
              <Textarea
                id="target_audience"
                value={formData.target_audience}
                onChange={(e) => updateField("target_audience", e.target.value)}
                placeholder="Ex: Classe A e B, público 90% feminino..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="has_structured_process">7. O time de vendas segue um processo estruturado?</Label>
                <Input
                  id="has_structured_process"
                  value={formData.has_structured_process}
                  onChange={(e) => updateField("has_structured_process", e.target.value)}
                  placeholder="Sim/Não - Descreva..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm_usage">8. O CRM está sendo utilizado corretamente?</Label>
                <Input
                  id="crm_usage"
                  value={formData.crm_usage}
                  onChange={(e) => updateField("crm_usage", e.target.value)}
                  placeholder="Sim/Não - Qual CRM?"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="competitors">9. Quais são os principais concorrentes?</Label>
                <Input
                  id="competitors"
                  value={formData.competitors}
                  onChange={(e) => updateField("competitors", e.target.value)}
                  placeholder="Liste os concorrentes..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="has_sales_goals">10. Existe um plano de metas para os vendedores?</Label>
                <Input
                  id="has_sales_goals"
                  value={formData.has_sales_goals}
                  onChange={(e) => updateField("has_sales_goals", e.target.value)}
                  placeholder="Sim/Não - Descreva..."
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Análise SWOT</h3>
              <p className="text-sm text-muted-foreground">Analise os pontos internos e externos do seu negócio</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-green-600">1. Forças</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.swot_strengths}
                    onChange={(e) => updateField("swot_strengths", e.target.value)}
                    placeholder="Quais são os pontos fortes do seu negócio?"
                    rows={4}
                  />
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-red-600">2. Fraquezas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.swot_weaknesses}
                    onChange={(e) => updateField("swot_weaknesses", e.target.value)}
                    placeholder="Quais são os pontos fracos a melhorar?"
                    rows={4}
                  />
                </CardContent>
              </Card>

              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-blue-600">3. Oportunidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.swot_opportunities}
                    onChange={(e) => updateField("swot_opportunities", e.target.value)}
                    placeholder="Quais oportunidades você vê no mercado?"
                    rows={4}
                  />
                </CardContent>
              </Card>

              <Card className="border-yellow-200 dark:border-yellow-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-yellow-600">4. Ameaças</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.swot_threats}
                    onChange={(e) => updateField("swot_threats", e.target.value)}
                    placeholder="Quais ameaças externas podem impactar?"
                    rows={4}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Checklist de Informações</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>1. Estrutura atual da equipe comercial</Label>
                  <Textarea
                    value={formData.commercial_structure}
                    onChange={(e) => updateField("commercial_structure", e.target.value)}
                    placeholder="Descreva a estrutura atual..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>2. Meta de crescimento</Label>
                  <Input
                    value={formData.growth_target}
                    onChange={(e) => updateField("growth_target", e.target.value)}
                    placeholder="Ex: Crescer 30% no ano"
                  />
                </div>
                <div className="space-y-2">
                  <Label>3. Ferramentas utilizadas (CRM, automação)</Label>
                  <Input
                    value={formData.tools_used}
                    onChange={(e) => updateField("tools_used", e.target.value)}
                    placeholder="Ex: HubSpot, RD Station, etc."
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">OKRs</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>1. Principais objetivos com a UNV</Label>
                  <Textarea
                    value={formData.objectives_with_unv}
                    onChange={(e) => updateField("objectives_with_unv", e.target.value)}
                    placeholder="O que você espera alcançar com a consultoria?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>2. Resultados-chave (O que vai fazer você dizer que valeu a pena?)</Label>
                  <Textarea
                    value={formData.key_results}
                    onChange={(e) => updateField("key_results", e.target.value)}
                    placeholder="Quais resultados concretos você espera?"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold">Metas e Checkpoints</h3>
              <p className="text-sm text-muted-foreground">Defina suas metas trimestrais com cenários pessimista, realista e otimista</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2"></th>
                    <th className="text-center p-2">1º Trimestre</th>
                    <th className="text-center p-2">2º Trimestre</th>
                    <th className="text-center p-2">3º Trimestre</th>
                    <th className="text-center p-2">4º Trimestre</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium text-red-600">Pessimista</td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q1.pessimista}
                        onChange={(e) => updateQuarterlyGoal('q1', 'pessimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q2.pessimista}
                        onChange={(e) => updateQuarterlyGoal('q2', 'pessimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q3.pessimista}
                        onChange={(e) => updateQuarterlyGoal('q3', 'pessimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q4.pessimista}
                        onChange={(e) => updateQuarterlyGoal('q4', 'pessimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium text-yellow-600">Realista</td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q1.realista}
                        onChange={(e) => updateQuarterlyGoal('q1', 'realista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q2.realista}
                        onChange={(e) => updateQuarterlyGoal('q2', 'realista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q3.realista}
                        onChange={(e) => updateQuarterlyGoal('q3', 'realista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q4.realista}
                        onChange={(e) => updateQuarterlyGoal('q4', 'realista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium text-green-600">Otimista</td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q1.otimista}
                        onChange={(e) => updateQuarterlyGoal('q1', 'otimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q2.otimista}
                        onChange={(e) => updateQuarterlyGoal('q2', 'otimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q3.otimista}
                        onChange={(e) => updateQuarterlyGoal('q3', 'otimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={formData.quarterly_goals.q4.otimista}
                        onChange={(e) => updateQuarterlyGoal('q4', 'otimista', e.target.value)}
                        placeholder="R$"
                        className="text-center"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 5:
        const formatMonthLabel = (dateStr: string) => {
          const date = new Date(dateStr + "T12:00:00");
          return format(date, "MMM/yyyy", { locale: ptBR });
        };

        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold">Histórico de Vendas</h3>
              <p className="text-sm text-muted-foreground">
                Informe o faturamento dos últimos 12 meses (antes da UNV)
              </p>
            </div>

            {/* Mensagem de importância */}
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex gap-3">
                <TrendingUp className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Por que preencher o histórico? (opcional)
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Ao compartilhar seu histórico de vendas, nossa equipe consegue acompanhar melhor sua evolução e entregar resultados mais personalizados nos próximos meses. Isso nos ajuda a entender o ponto de partida e celebrar cada conquista com você!
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Mês/Ano</th>
                    <th className="text-right p-3 font-medium">Faturamento (R$)</th>
                    <th className="text-right p-3 font-medium">Qtd. Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.map((entry, index) => (
                    <tr key={entry.month_year} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium capitalize">
                        {formatMonthLabel(entry.month_year)}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={entry.revenue || ""}
                          onChange={(e) => updateSalesHistory(index, "revenue", parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="text-right"
                          min={0}
                          step={0.01}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={entry.sales_count || ""}
                          onChange={(e) => updateSalesHistory(index, "sales_count", parseInt(e.target.value) || null)}
                          placeholder="Opcional"
                          className="text-right"
                          min={0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Preencha apenas os meses que tiver informação. Campos vazios serão ignorados.
            </p>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold">Alinhamento de Expectativa</h3>
              <p className="text-sm text-muted-foreground">Qual sua expectativa de crescimento em faturamento?</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="growth_expectation_3m">
                  1. Qual sua expectativa de crescimento para os primeiros 3 meses? *
                </Label>
                <Textarea
                  id="growth_expectation_3m"
                  value={formData.growth_expectation_3m}
                  onChange={(e) => updateField("growth_expectation_3m", e.target.value)}
                  placeholder="Ex: Aumentar 20% o faturamento..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="growth_expectation_6m">
                  2. Qual sua expectativa de crescimento para os primeiros 6 meses? *
                </Label>
                <Textarea
                  id="growth_expectation_6m"
                  value={formData.growth_expectation_6m}
                  onChange={(e) => updateField("growth_expectation_6m", e.target.value)}
                  placeholder="Ex: Dobrar o faturamento..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="growth_expectation_12m">
                  3. Qual sua expectativa de crescimento para os próximos 12 meses? *
                </Label>
                <Textarea
                  id="growth_expectation_12m"
                  value={formData.growth_expectation_12m}
                  onChange={(e) => updateField("growth_expectation_12m", e.target.value)}
                  placeholder="Ex: Triplicar o faturamento..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações adicionais</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Alguma informação adicional que gostaria de compartilhar?"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="max-w-4xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Formulário de Kickoff</h1>
          <p className="text-muted-foreground">
            Preencha as informações abaixo para iniciarmos o projeto
          </p>
          {companyName && (
            <Badge variant="secondary" className="mt-4 text-base px-4 py-2">
              {companyName}
            </Badge>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-1 md:gap-2 mb-8 flex-wrap">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`
                    flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-full transition-all text-xs md:text-sm
                    ${isCurrent 
                      ? "bg-primary text-primary-foreground" 
                      : isCompleted 
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    <StepIcon className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                  <span className="font-medium hidden lg:inline">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-4 md:w-8 h-0.5 mx-1 ${isCompleted ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = STEPS[currentStep - 1].icon;
                return <StepIcon className="h-5 w-5" />;
              })()}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>
              Etapa {currentStep} de {STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[60vh] px-6 pb-6">
              <div className="pr-4">
                {renderStepContent()}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {currentStep === STEPS.length ? (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Formulário
                </>
              )}
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KickoffFormPage;
