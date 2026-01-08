import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPANY_SEGMENTS } from "@/data/companySegments";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Target,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Trash2,
  Save,
  Briefcase,
  Link,
  Copy,
} from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface Stakeholder {
  name: string;
  role: string;
  email: string;
  phone: string;
  isDecisionMaker: boolean;
}

interface KickoffFormData {
  // Empresa
  name: string;
  cnpj: string;
  segment: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  company_description: string;
  
  // Negócio
  main_challenges: string;
  goals_short_term: string;
  goals_long_term: string;
  target_audience: string;
  competitors: string;
  
  // Contrato
  kickoff_date: string;
  contract_start_date: string;
  contract_end_date: string;
  contract_value: number | null;
  billing_day: number | null;
  
  // Stakeholders
  stakeholders: Stakeholder[];
  
  // Cronograma
  expected_timeline: {
    discovery: string;
    implementation: string;
    goLive: string;
    optimization: string;
  };
  
  // Notas
  notes: string;
}

interface KickoffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, title: "Dados da Empresa", icon: Building2 },
  { id: 2, title: "Negócio & Mercado", icon: Briefcase },
  { id: 3, title: "Objetivos & Desafios", icon: Target },
  { id: 4, title: "Stakeholders", icon: Users },
  { id: 5, title: "Contrato", icon: DollarSign },
  { id: 6, title: "Cronograma", icon: Calendar },
];

const initialFormData: KickoffFormData = {
  name: "",
  cnpj: "",
  segment: "",
  website: "",
  phone: "",
  email: "",
  address: "",
  company_description: "",
  main_challenges: "",
  goals_short_term: "",
  goals_long_term: "",
  target_audience: "",
  competitors: "",
  kickoff_date: "",
  contract_start_date: "",
  contract_end_date: "",
  contract_value: null,
  billing_day: null,
  stakeholders: [],
  expected_timeline: {
    discovery: "",
    implementation: "",
    goLive: "",
    optimization: "",
  },
  notes: "",
};

export const KickoffFormDialog = ({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}: KickoffFormDialogProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<KickoffFormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && companyId) {
      fetchCompanyData();
    }
  }, [open, companyId]);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;

      if (data) {
        const stakeholders = Array.isArray(data.stakeholders) 
          ? (data.stakeholders as any[]).map((s) => ({
              name: s.name || "",
              role: s.role || "",
              email: s.email || "",
              phone: s.phone || "",
              isDecisionMaker: s.isDecisionMaker || false,
            }))
          : [];

        const timelineData = data.expected_timeline as Record<string, string> | null;
        const timeline = timelineData && typeof timelineData === "object" && !Array.isArray(timelineData)
          ? {
              discovery: timelineData.discovery || "",
              implementation: timelineData.implementation || "",
              goLive: timelineData.goLive || "",
              optimization: timelineData.optimization || "",
            }
          : initialFormData.expected_timeline;

        setFormData({
          name: data.name || "",
          cnpj: data.cnpj || "",
          segment: data.segment || "",
          website: data.website || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          company_description: data.company_description || "",
          main_challenges: data.main_challenges || "",
          goals_short_term: data.goals_short_term || "",
          goals_long_term: data.goals_long_term || "",
          target_audience: data.target_audience || "",
          competitors: data.competitors || "",
          kickoff_date: data.kickoff_date || "",
          contract_start_date: data.contract_start_date || "",
          contract_end_date: data.contract_end_date || "",
          contract_value: data.contract_value || null,
          billing_day: data.billing_day || null,
          stakeholders,
          expected_timeline: timeline,
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

  const updateTimeline = (field: keyof KickoffFormData["expected_timeline"], value: string) => {
    setFormData((prev) => ({
      ...prev,
      expected_timeline: { ...prev.expected_timeline, [field]: value },
    }));
  };

  const addStakeholder = () => {
    setFormData((prev) => ({
      ...prev,
      stakeholders: [
        ...prev.stakeholders,
        { name: "", role: "", email: "", phone: "", isDecisionMaker: false },
      ],
    }));
  };

  const removeStakeholder = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      stakeholders: prev.stakeholders.filter((_, i) => i !== index),
    }));
  };

  const updateStakeholder = (index: number, field: keyof Stakeholder, value: any) => {
    setFormData((prev) => ({
      ...prev,
      stakeholders: prev.stakeholders.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({
          name: formData.name,
          cnpj: formData.cnpj || null,
          segment: formData.segment || null,
          website: formData.website || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          company_description: formData.company_description || null,
          main_challenges: formData.main_challenges || null,
          goals_short_term: formData.goals_short_term || null,
          goals_long_term: formData.goals_long_term || null,
          target_audience: formData.target_audience || null,
          competitors: formData.competitors || null,
          kickoff_date: formData.kickoff_date || null,
          contract_start_date: formData.contract_start_date || null,
          contract_end_date: formData.contract_end_date || null,
          contract_value: formData.contract_value,
          billing_day: formData.billing_day,
          stakeholders: JSON.parse(JSON.stringify(formData.stakeholders)),
          expected_timeline: JSON.parse(JSON.stringify(formData.expected_timeline)),
          notes: formData.notes || null,
        })
        .eq("id", companyId);

      if (error) throw error;

      toast.success("Formulário de Kickoff salvo com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving kickoff:", error);
      toast.error("Erro ao salvar formulário de Kickoff");
    } finally {
      setSaving(false);
    }
  };

  const copyFormLink = () => {
    const link = `${getPublicBaseUrl()}/#/kickoff/${companyId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => updateField("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Segmento/Nicho</Label>
                <Select value={formData.segment} onValueChange={(value) => updateField("segment", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SEGMENTS.map((seg) => (
                      <SelectItem key={seg} value={seg}>
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Endereço completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_description">Descrição da Empresa</Label>
              <Textarea
                id="company_description"
                value={formData.company_description}
                onChange={(e) => updateField("company_description", e.target.value)}
                placeholder="Descreva brevemente a empresa, sua história e o que faz..."
                rows={4}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target_audience">Público-Alvo / ICP (Ideal Customer Profile)</Label>
              <Textarea
                id="target_audience"
                value={formData.target_audience}
                onChange={(e) => updateField("target_audience", e.target.value)}
                placeholder="Descreva o cliente ideal da empresa: setor, tamanho, cargo do decisor, dores principais..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitors">Principais Concorrentes</Label>
              <Textarea
                id="competitors"
                value={formData.competitors}
                onChange={(e) => updateField("competitors", e.target.value)}
                placeholder="Liste os principais concorrentes e os diferenciais da empresa em relação a eles..."
                rows={4}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="main_challenges">Principais Dores e Desafios</Label>
              <Textarea
                id="main_challenges"
                value={formData.main_challenges}
                onChange={(e) => updateField("main_challenges", e.target.value)}
                placeholder="Quais são as principais dores que a empresa está enfrentando? O que motivou a busca por ajuda?"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goals_short_term">Metas de Curto Prazo (3-6 meses)</Label>
              <Textarea
                id="goals_short_term"
                value={formData.goals_short_term}
                onChange={(e) => updateField("goals_short_term", e.target.value)}
                placeholder="O que a empresa espera alcançar nos próximos 3 a 6 meses?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goals_long_term">Metas de Longo Prazo (1-2 anos)</Label>
              <Textarea
                id="goals_long_term"
                value={formData.goals_long_term}
                onChange={(e) => updateField("goals_long_term", e.target.value)}
                placeholder="Onde a empresa quer estar em 1 a 2 anos? Qual a visão de futuro?"
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Stakeholders do Projeto</h3>
                <p className="text-sm text-muted-foreground">
                  Adicione as pessoas-chave envolvidas no projeto
                </p>
              </div>
              <Button onClick={addStakeholder} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {formData.stakeholders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum stakeholder adicionado</p>
                  <p className="text-sm">Clique em "Adicionar" para incluir um stakeholder</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {formData.stakeholders.map((stakeholder, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-4">
                        <Badge variant="outline">Stakeholder #{index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStakeholder(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input
                            value={stakeholder.name}
                            onChange={(e) => updateStakeholder(index, "name", e.target.value)}
                            placeholder="Nome completo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo/Função</Label>
                          <Input
                            value={stakeholder.role}
                            onChange={(e) => updateStakeholder(index, "role", e.target.value)}
                            placeholder="Ex: CEO, Diretor Comercial..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={stakeholder.email}
                            onChange={(e) => updateStakeholder(index, "email", e.target.value)}
                            placeholder="email@empresa.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefone</Label>
                          <Input
                            value={stakeholder.phone}
                            onChange={(e) => updateStakeholder(index, "phone", e.target.value)}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`decision-maker-${index}`}
                          checked={stakeholder.isDecisionMaker}
                          onChange={(e) => updateStakeholder(index, "isDecisionMaker", e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor={`decision-maker-${index}`} className="text-sm cursor-pointer">
                          É tomador de decisão
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kickoff_date">Data do Kickoff</Label>
                <Input
                  id="kickoff_date"
                  type="date"
                  value={formData.kickoff_date}
                  onChange={(e) => updateField("kickoff_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_day">Dia de Cobrança</Label>
                <Input
                  id="billing_day"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.billing_day || ""}
                  onChange={(e) => updateField("billing_day", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Ex: 10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract_start_date">Início do Contrato</Label>
                <Input
                  id="contract_start_date"
                  type="date"
                  value={formData.contract_start_date}
                  onChange={(e) => updateField("contract_start_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract_end_date">Término do Contrato</Label>
                <Input
                  id="contract_end_date"
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) => updateField("contract_end_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract_value">Valor do Contrato (R$)</Label>
              <Input
                id="contract_value"
                type="number"
                value={formData.contract_value || ""}
                onChange={(e) => updateField("contract_value", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0,00"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="notes">Notas Internas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Informações adicionais, observações importantes..."
                rows={4}
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina as datas previstas para cada etapa do projeto
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discovery">Fase de Discovery</Label>
                <Input
                  id="discovery"
                  type="date"
                  value={formData.expected_timeline.discovery}
                  onChange={(e) => updateTimeline("discovery", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Entendimento profundo do negócio
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="implementation">Fase de Implementação</Label>
                <Input
                  id="implementation"
                  type="date"
                  value={formData.expected_timeline.implementation}
                  onChange={(e) => updateTimeline("implementation", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Execução das ações planejadas
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goLive">Go Live</Label>
                <Input
                  id="goLive"
                  type="date"
                  value={formData.expected_timeline.goLive}
                  onChange={(e) => updateTimeline("goLive", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Início da operação plena
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="optimization">Fase de Otimização</Label>
                <Input
                  id="optimization"
                  type="date"
                  value={formData.expected_timeline.optimization}
                  onChange={(e) => updateTimeline("optimization", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ajustes e melhorias contínuas
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Formulário de Kickoff
          </DialogTitle>
          <DialogDescription>
            Preencha todas as informações do cliente para iniciar o projeto
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2 py-4 overflow-x-auto bg-white dark:bg-card">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                    isActive
                      ? "text-red-600"
                      : isCompleted
                      ? "text-red-500"
                      : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isActive
                        ? "border-red-600 bg-red-600 text-white"
                        : isCompleted
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap">
                    {step.title}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      isCompleted ? "bg-red-500" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="pr-2">{renderStepContent()}</div>
          )}
        </ScrollArea>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={copyFormLink} title="Copiar link do formulário">
              <Link className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {currentStep === STEPS.length ? (
              <Button onClick={handleSave} disabled={saving || !formData.name}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Kickoff"}
              </Button>
            ) : (
              <Button onClick={nextStep}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
