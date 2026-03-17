import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, BarChart3, ArrowRight, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface TrafficForm {
  id: string;
  project_id: string;
  status: string;
  has_run_ads: boolean | null;
  platforms_used: string | null;
  monthly_budget: string | null;
  budget_management: string | null;
  main_objective: string | null;
  target_audience_description: string | null;
  geographic_targeting: string | null;
  current_campaigns_types: string | null;
  best_performing_campaign: string | null;
  worst_performing_campaign: string | null;
  average_cpl: string | null;
  average_cpa: string | null;
  average_roas: string | null;
  conversion_tracking: string | null;
  pixel_installed: string | null;
  landing_page_url: string | null;
  landing_page_experience: string | null;
  creative_production: string | null;
  ad_frequency_issue: string | null;
  retargeting_strategy: string | null;
  lookalike_audiences: string | null;
  ab_testing: string | null;
  biggest_challenge: string | null;
  previous_agency: string | null;
  expected_results: string | null;
  additional_info: string | null;
  submitted_at: string | null;
}

interface ProjectInfo {
  company_name: string | null;
}

type FieldType = "yesno" | "text" | "textarea" | "currency";

const formatCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required: boolean;
}

interface FormSection {
  title: string;
  description: string;
  fields: FormField[];
}

const SECTIONS: FormSection[] = [
  {
    title: "📊 Visão Geral",
    description: "Informações básicas sobre seu histórico com tráfego pago",
    fields: [
      { key: "has_run_ads", label: "Você já investiu em tráfego pago (anúncios online)?", type: "yesno", required: true },
      { key: "platforms_used", label: "Quais plataformas de anúncio você utiliza ou já utilizou?", type: "text", placeholder: "Ex: Meta Ads (Facebook/Instagram), Google Ads, TikTok Ads, LinkedIn Ads...", required: true },
      { key: "monthly_budget", label: "Qual é o investimento mensal atual em mídia paga?", type: "currency", placeholder: "R$ 0,00", required: true },
      { key: "budget_management", label: "Quem gerencia atualmente o tráfego pago?", type: "text", placeholder: "Ex: Eu mesmo, agência X, gestor interno...", required: true },
    ],
  },
  {
    title: "🎯 Objetivos e Público",
    description: "Entender seus objetivos e para quem você quer anunciar",
    fields: [
      { key: "main_objective", label: "Qual o principal objetivo das suas campanhas de tráfego pago?", type: "textarea", placeholder: "Ex: Gerar leads, vender online, reconhecimento de marca, tráfego para loja física...", required: true },
      { key: "target_audience_description", label: "Descreva seu público-alvo ideal para as campanhas", type: "textarea", placeholder: "Ex: Mulheres 25-45 anos, classe B, interessadas em estética, moram em SP...", required: true },
      { key: "geographic_targeting", label: "Qual região geográfica você precisa atingir?", type: "text", placeholder: "Ex: Brasil inteiro, São Paulo capital, Região Sudeste...", required: true },
    ],
  },
  {
    title: "📈 Campanhas Atuais",
    description: "Detalhes sobre suas campanhas em andamento",
    fields: [
      { key: "current_campaigns_types", label: "Quais tipos de campanha você roda atualmente?", type: "textarea", placeholder: "Ex: Conversão para WhatsApp, tráfego para site, geração de leads, engajamento...", required: true },
      { key: "best_performing_campaign", label: "Qual campanha/anúncio teve melhor resultado até agora? Por quê?", type: "textarea", placeholder: "Descreva o tipo de campanha, público e por que funcionou bem", required: false },
      { key: "worst_performing_campaign", label: "Qual campanha/anúncio teve pior resultado? O que acha que deu errado?", type: "textarea", placeholder: "Descreva o que não funcionou e sua hipótese do motivo", required: false },
    ],
  },
  {
    title: "💰 Métricas e Resultados",
    description: "Números atuais para entender a performance",
    fields: [
      { key: "average_cpl", label: "Qual o seu custo médio por lead (CPL) atual?", type: "text", placeholder: "Ex: R$ 15, R$ 30, não sei...", required: false },
      { key: "average_cpa", label: "Qual o custo médio por aquisição/venda (CPA)?", type: "text", placeholder: "Ex: R$ 100, R$ 250, não sei...", required: false },
      { key: "average_roas", label: "Qual o ROAS (retorno sobre investimento em anúncios) atual?", type: "text", placeholder: "Ex: 3x, 5x, não sei calcular...", required: false },
      { key: "conversion_tracking", label: "Você acompanha conversões? Como mede os resultados das campanhas?", type: "textarea", placeholder: "Ex: Pelo gerenciador de anúncios, planilha, CRM, não acompanho...", required: true },
    ],
  },
  {
    title: "🔧 Estrutura Técnica",
    description: "Ferramentas e configurações técnicas",
    fields: [
      { key: "pixel_installed", label: "O Pixel do Facebook/Google está instalado no seu site?", type: "text", placeholder: "Ex: Sim, não, não sei...", required: true },
      { key: "landing_page_url", label: "Qual é a URL principal para onde seus anúncios direcionam?", type: "text", placeholder: "Ex: www.meusite.com.br/landing-page", required: false },
      { key: "landing_page_experience", label: "Como você avalia a experiência da sua landing page / site?", type: "textarea", placeholder: "É rápido? Responsivo? Tem formulário claro? Já testou variações?", required: false },
    ],
  },
  {
    title: "🎨 Criativos e Estratégia",
    description: "Sobre a produção e estratégia dos anúncios",
    fields: [
      { key: "creative_production", label: "Como são produzidos os criativos (imagens/vídeos) dos anúncios?", type: "textarea", placeholder: "Ex: Designer interno, eu mesmo no Canva, agência, IA...", required: true },
      { key: "ad_frequency_issue", label: "Você percebe que o público está ficando 'cansado' dos seus anúncios (alta frequência)?", type: "text", placeholder: "Ex: Sim, os resultados caem rápido / Não, troco com frequência...", required: false },
      { key: "retargeting_strategy", label: "Você utiliza remarketing/retargeting? Como?", type: "textarea", placeholder: "Ex: Sim, para quem visitou o site / Não uso / Não sei o que é...", required: false },
      { key: "lookalike_audiences", label: "Utiliza públicos semelhantes (Lookalike/Similar)?", type: "text", placeholder: "Ex: Sim, baseado em clientes / Não...", required: false },
      { key: "ab_testing", label: "Você faz testes A/B nos anúncios? Em quais elementos?", type: "textarea", placeholder: "Ex: Sim, testo imagens e copy / Não, nunca testei...", required: false },
    ],
  },
  {
    title: "🚀 Expectativas",
    description: "O que você espera alcançar com a gestão de tráfego",
    fields: [
      { key: "biggest_challenge", label: "Qual seu maior desafio com tráfego pago atualmente?", type: "textarea", placeholder: "Ex: Alto custo por lead, não sei escalar, criativos ruins...", required: true },
      { key: "previous_agency", label: "Já trabalhou com alguma agência ou gestor de tráfego antes? Como foi a experiência?", type: "textarea", placeholder: "Descreva brevemente sua experiência anterior", required: false },
      { key: "expected_results", label: "Quais resultados você espera alcançar nos próximos 3-6 meses?", type: "textarea", placeholder: "Ex: Dobrar o número de leads, reduzir CPL para R$ 10, aumentar ROAS para 5x...", required: true },
      { key: "additional_info", label: "Alguma informação adicional que considere relevante para a análise?", type: "textarea", placeholder: "Fique à vontade para compartilhar qualquer detalhe importante", required: false },
    ],
  },
];

export default function TrafficAnalysisPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TrafficForm | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("traffic_analysis_forms")
        .select("*, onboarding_projects!inner(onboarding_company_id)")
        .eq("access_token", token)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (data.submitted_at) {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      setForm(data as unknown as TrafficForm);

      // Get company name
      const companyId = (data as any).onboarding_projects?.onboarding_company_id;
      if (companyId) {
        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle();
        setProjectInfo({ company_name: company?.name || null });
      }

      // Initialize form data from existing answers
      const initial: Record<string, string> = {};
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = (data as any)[field.key];
          if (val !== null && val !== undefined) {
            initial[field.key] = String(val);
          }
        });
      });
      setFormData(initial);
    } catch (err) {
      console.error("Error loading traffic form:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (silent = false) => {
    if (!form) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.type === "yesno") {
            payload[field.key] = formData[field.key] === "true" ? true : formData[field.key] === "false" ? false : null;
          } else {
            payload[field.key] = formData[field.key]?.trim() || null;
          }
        });
      });

      const { error } = await supabase
        .from("traffic_analysis_forms")
        .update(payload)
        .eq("id", form.id);

      if (error) throw error;
      if (!silent) toast.success("Respostas salvas!");
    } catch (err) {
      console.error("Error saving:", err);
      if (!silent) toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missing: string[] = [];
    SECTIONS.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.required && !formData[field.key]?.trim()) {
          missing.push(field.label);
        }
      });
    });

    if (missing.length > 0) {
      toast.error(`Preencha os campos obrigatórios (${missing.length} pendentes)`);
      // Find the section with the first missing field
      for (let i = 0; i < SECTIONS.length; i++) {
        const hasMissing = SECTIONS[i].fields.some(
          (f) => f.required && !formData[f.key]?.trim()
        );
        if (hasMissing) {
          setCurrentSection(i);
          break;
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.type === "yesno") {
            payload[field.key] = formData[field.key] === "true" ? true : formData[field.key] === "false" ? false : null;
          } else {
            payload[field.key] = formData[field.key]?.trim() || null;
          }
        });
      });

      const { error } = await supabase
        .from("traffic_analysis_forms")
        .update(payload)
        .eq("id", form!.id);

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting:", err);
      toast.error("Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (() => {
    const allFields = SECTIONS.flatMap((s) => s.fields);
    const filled = allFields.filter((f) => formData[f.key]?.trim()).length;
    return Math.round((filled / allFields.length) * 100);
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">Formulário não encontrado</h2>
            <p className="text-sm text-muted-foreground">
              O link pode estar incorreto ou expirado. Solicite um novo link ao gestor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold">Formulário enviado!</h2>
            <p className="text-sm text-muted-foreground">
              Obrigado por responder. Suas informações serão analisadas pelo nosso gestor de tráfego pago.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const section = SECTIONS[currentSection];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Diagnóstico de Tráfego Pago</h1>
              {projectInfo?.company_name && (
                <p className="text-sm text-muted-foreground">{projectInfo.company_name}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Preencha as perguntas abaixo para que possamos fazer uma análise completa da sua estratégia de tráfego pago.
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progresso: {progress}%</span>
              <span>Seção {currentSection + 1} de {SECTIONS.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Section Nav */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {SECTIONS.map((s, i) => {
            const sectionFilled = s.fields.filter((f) => formData[f.key]?.trim()).length;
            const sectionTotal = s.fields.length;
            const isComplete = sectionFilled === sectionTotal;
            return (
              <button
                key={i}
                onClick={() => { handleSave(true); setCurrentSection(i); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === currentSection
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s.title.split(" ").slice(1).join(" ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>

            <Separator />

            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-sm">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {field.type === "yesno" ? (
                  <RadioGroup
                    value={formData[field.key] || ""}
                    onValueChange={(val) => setFormData((d) => ({ ...d, [field.key]: val }))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id={`${field.key}-yes`} />
                      <Label htmlFor={`${field.key}-yes`} className="font-normal cursor-pointer">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id={`${field.key}-no`} />
                      <Label htmlFor={`${field.key}-no`} className="font-normal cursor-pointer">Não</Label>
                    </div>
                  </RadioGroup>
                ) : field.type === "textarea" ? (
                  <Textarea
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData((d) => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="resize-none"
                  />
                ) : field.type === "currency" ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      value={formData[field.key] || ""}
                      onChange={(e) => {
                        const formatted = formatCurrency(e.target.value);
                        setFormData((d) => ({ ...d, [field.key]: formatted }));
                      }}
                      placeholder={field.placeholder}
                      className="pl-10"
                      inputMode="numeric"
                    />
                  </div>
                ) : (
                  <Input
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData((d) => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pb-8">
          <Button
            variant="outline"
            onClick={() => { handleSave(true); setCurrentSection((c) => c - 1); }}
            disabled={currentSection === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar rascunho
          </Button>

          {currentSection < SECTIONS.length - 1 ? (
            <Button
              onClick={() => { handleSave(true); setCurrentSection((c) => c + 1); }}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Formulário
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
