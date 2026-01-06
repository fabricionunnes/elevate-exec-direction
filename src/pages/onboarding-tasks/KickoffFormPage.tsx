import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPANY_SEGMENTS } from "@/data/companySegments";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Trash2,
  Send,
  Briefcase,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface Stakeholder {
  name: string;
  role: string;
  email: string;
  phone: string;
  isDecisionMaker: boolean;
}

interface KickoffFormData {
  name: string;
  cnpj: string;
  segment: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  company_description: string;
  main_challenges: string;
  goals_short_term: string;
  goals_long_term: string;
  target_audience: string;
  competitors: string;
  stakeholders: Stakeholder[];
  notes: string;
}

const STEPS = [
  { id: 1, title: "Dados da Empresa", icon: Building2 },
  { id: 2, title: "Negócio & Mercado", icon: Briefcase },
  { id: 3, title: "Objetivos & Desafios", icon: Target },
  { id: 4, title: "Stakeholders", icon: Users },
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
  stakeholders: [],
  notes: "",
};

const KickoffFormPage = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<KickoffFormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
    }
  }, [companyId]);

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
        const stakeholders = Array.isArray(data.stakeholders)
          ? (data.stakeholders as any[]).map((s) => ({
              name: s.name || "",
              role: s.role || "",
              email: s.email || "",
              phone: s.phone || "",
              isDecisionMaker: s.isDecisionMaker || false,
            }))
          : [];

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
          stakeholders,
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

  const handleSubmit = async () => {
    if (!companyId) return;
    
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
          stakeholders: JSON.parse(JSON.stringify(formData.stakeholders)),
          notes: formData.notes || null,
        })
        .eq("id", companyId);

      if (error) throw error;

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
            <Badge variant="secondary" className="text-base px-4 py-2">
              {companyName}
            </Badge>
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

            <div className="space-y-2">
              <Label htmlFor="notes">Observações Adicionais</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Alguma informação adicional que gostaria de compartilhar?"
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
                          <Label>Cargo</Label>
                          <Input
                            value={stakeholder.role}
                            onChange={(e) => updateStakeholder(index, "role", e.target.value)}
                            placeholder="Ex: CEO, Diretor Comercial"
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
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor={`decision-maker-${index}`} className="text-sm font-normal">
                          Decisor Principal
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="max-w-3xl mx-auto p-4 py-8">
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
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-full transition-all
                    ${isCurrent 
                      ? "bg-primary text-primary-foreground" 
                      : isCompleted 
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium hidden md:inline">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${isCompleted ? "bg-green-500" : "bg-muted"}`} />
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
          <CardContent>
            <ScrollArea className="max-h-[60vh]">
              {renderStepContent()}
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
