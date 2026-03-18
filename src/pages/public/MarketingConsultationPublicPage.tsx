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
import { Loader2, CheckCircle, Instagram, ArrowRight, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface FormSection {
  title: string;
  description: string;
  fields: { key: string; label: string; type: "text" | "textarea" | "yesno"; placeholder?: string; required: boolean }[];
}

const SECTIONS: FormSection[] = [
  {
    title: "📱 Presença no Instagram",
    description: "Informações sobre seu perfil e atividade no Instagram",
    fields: [
      { key: "instagram_handle", label: "Qual é o @ do Instagram da empresa?", type: "text", placeholder: "@suaempresa", required: true },
      { key: "instagram_followers", label: "Quantos seguidores possui atualmente?", type: "text", placeholder: "Ex: 5.000, 15k...", required: true },
      { key: "instagram_posting_frequency", label: "Com que frequência você posta no Instagram?", type: "text", placeholder: "Ex: 3x por semana, diariamente, 1x por semana...", required: true },
      { key: "instagram_content_types", label: "Quais tipos de conteúdo você publica?", type: "textarea", placeholder: "Ex: Fotos de produtos, reels educativos, carrosséis informativos, stories interativos...", required: true },
    ],
  },
  {
    title: "📊 Engajamento e Performance",
    description: "Como está o desempenho do seu perfil",
    fields: [
      { key: "instagram_engagement_rate", label: "Qual a média de curtidas/comentários por post?", type: "text", placeholder: "Ex: 50 curtidas e 5 comentários por post", required: true },
      { key: "instagram_best_post", label: "Qual tipo de post teve melhor engajamento? Por quê?", type: "textarea", placeholder: "Descreva o post com melhor performance", required: false },
      { key: "instagram_worst_post", label: "Qual tipo de post teve pior engajamento? O que acha que aconteceu?", type: "textarea", placeholder: "Descreva o post com pior performance", required: false },
      { key: "instagram_stories_usage", label: "Como você utiliza os Stories?", type: "textarea", placeholder: "Ex: Bastidores, enquetes, caixinha de perguntas, promoções...", required: true },
      { key: "instagram_reels_usage", label: "Como você utiliza os Reels?", type: "textarea", placeholder: "Ex: Tutoriais, trends, antes/depois, depoimentos...", required: true },
    ],
  },
  {
    title: "🎨 Identidade e Otimização",
    description: "Sobre a identidade visual e otimização do perfil",
    fields: [
      { key: "instagram_bio_optimized", label: "Sua bio está otimizada com CTA, palavras-chave e link?", type: "textarea", placeholder: "Cole aqui o texto atual da sua bio ou descreva como está", required: true },
      { key: "instagram_highlights", label: "Quais destaques você possui? Estão atualizados?", type: "textarea", placeholder: "Ex: Sobre nós, Depoimentos, Produtos, FAQ...", required: false },
      { key: "instagram_hashtag_strategy", label: "Qual sua estratégia de hashtags?", type: "textarea", placeholder: "Ex: Uso 20 hashtags por post, misturo grandes e nichadas...", required: false },
      { key: "instagram_competitor_profiles", label: "Liste 3 perfis concorrentes ou que você admira", type: "textarea", placeholder: "@ de cada perfil e o que gosta neles", required: true },
    ],
  },
  {
    title: "🏢 Marca e Posicionamento",
    description: "Sobre a identidade da marca",
    fields: [
      { key: "brand_visual_identity", label: "A empresa possui identidade visual definida (logo, cores, fontes)?", type: "textarea", placeholder: "Descreva sua identidade visual atual", required: true },
      { key: "brand_tone_of_voice", label: "Qual é o tom de voz da marca nas redes sociais?", type: "textarea", placeholder: "Ex: Formal, descontraído, educativo, inspirador...", required: true },
      { key: "brand_differentiator", label: "Qual o principal diferencial da sua marca?", type: "textarea", placeholder: "O que te torna único no mercado", required: true },
      { key: "brand_positioning", label: "Como você quer ser percebido pelo seu público?", type: "textarea", placeholder: "Descreva o posicionamento desejado", required: true },
    ],
  },
  {
    title: "📝 Estratégia de Conteúdo",
    description: "Planejamento e produção de conteúdo",
    fields: [
      { key: "content_planning", label: "Você tem um planejamento de conteúdo estruturado?", type: "textarea", placeholder: "Descreva como planeja seus conteúdos atualmente", required: true },
      { key: "content_calendar", label: "Utiliza calendário editorial? Se sim, como funciona?", type: "textarea", placeholder: "Ex: Planilha, ferramenta X, não uso...", required: true },
      { key: "content_pillars", label: "Quais são os pilares de conteúdo da marca?", type: "textarea", placeholder: "Ex: Educação, entretenimento, vendas, bastidores, depoimentos...", required: true },
      { key: "content_production_team", label: "Quem produz o conteúdo atualmente?", type: "textarea", placeholder: "Ex: Eu mesmo, social media interno, agência...", required: true },
    ],
  },
  {
    title: "🚀 Objetivos e Expectativas",
    description: "O que você espera alcançar com a consultoria de marketing",
    fields: [
      { key: "marketing_main_goal", label: "Qual o principal objetivo de marketing digital da empresa?", type: "textarea", placeholder: "Ex: Aumentar seguidores, gerar leads, vender mais pelo Instagram...", required: true },
      { key: "marketing_biggest_challenge", label: "Qual seu maior desafio com marketing digital atualmente?", type: "textarea", placeholder: "Ex: Não tenho engajamento, não sei o que postar, não converto seguidores em clientes...", required: true },
      { key: "marketing_expected_results", label: "Quais resultados espera alcançar nos próximos 3-6 meses?", type: "textarea", placeholder: "Ex: Dobrar seguidores, ter 10 leads/semana pelo Instagram...", required: true },
      { key: "marketing_additional_info", label: "Alguma informação adicional relevante para a análise?", type: "textarea", placeholder: "Fique à vontade para compartilhar qualquer detalhe importante", required: false },
    ],
  },
];

export default function MarketingConsultationPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
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
        .from("marketing_consultation_forms")
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

      setForm(data);

      const companyId = (data as any).onboarding_projects?.onboarding_company_id;
      if (companyId) {
        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle();
        setCompanyName(company?.name || null);
      }

      const initial: Record<string, string> = {};
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = (data as any)[field.key];
          if (val !== null && val !== undefined) {
            initial[field.key] = field.type === "yesno" ? (val ? "yes" : "no") : String(val);
          }
        });
      });
      setFormData(initial);
    } catch (error) {
      console.error("Error loading form:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {};
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = formData[field.key];
          if (val !== undefined) {
            updateData[field.key] = field.type === "yesno" ? val === "yes" : val;
          }
        });
      });

      const { error } = await supabase
        .from("marketing_consultation_forms")
        .update(updateData)
        .eq("id", form.id);

      if (error) throw error;
      toast.success("Progresso salvo!");
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const currentFields = SECTIONS[currentSection].fields;
    const missing = currentFields.filter((f) => f.required && !formData[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    if (currentSection < SECTIONS.length - 1) {
      await saveProgress();
      setCurrentSection(currentSection + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const updateData: Record<string, any> = { submitted_at: new Date().toISOString(), status: "submitted" };
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = formData[field.key];
          if (val !== undefined) {
            updateData[field.key] = field.type === "yesno" ? val === "yes" : val;
          }
        });
      });

      const { error } = await supabase
        .from("marketing_consultation_forms")
        .update(updateData)
        .eq("id", form.id);

      if (error) throw error;
      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-10">
            <h2 className="text-xl font-bold mb-2">Formulário não encontrado</h2>
            <p className="text-muted-foreground">O link pode estar incorreto ou expirado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
        <Card className="max-w-md w-full text-center shadow-xl border-pink-200">
          <CardContent className="pt-12 pb-10">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Formulário Enviado!</h2>
            <p className="text-muted-foreground">
              Obrigado por preencher o diagnóstico de marketing. Nossa equipe analisará suas respostas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const section = SECTIONS[currentSection];
  const progress = ((currentSection + 1) / SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl border-pink-200">
          <CardContent className="pt-8 pb-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Instagram className="h-9 w-9 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Diagnóstico de Marketing</h1>
              {companyName && <p className="text-muted-foreground mt-1">{companyName}</p>}
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Etapa {currentSection + 1} de {SECTIONS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Separator className="mb-6" />

            {/* Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-1">{section.title}</h2>
              <p className="text-sm text-muted-foreground mb-4">{section.description}</p>

              <div className="space-y-5">
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.type === "yesno" ? (
                      <RadioGroup
                        value={formData[field.key] || ""}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, [field.key]: v }))}
                      >
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" id={`${field.key}-yes`} />
                            <Label htmlFor={`${field.key}-yes`}>Sim</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" id={`${field.key}-no`} />
                            <Label htmlFor={`${field.key}-no`}>Não</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    ) : field.type === "textarea" ? (
                      <Textarea
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        rows={3}
                        className="resize-none"
                      />
                    ) : (
                      <Input
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentSection(currentSection - 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={currentSection === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              <Button variant="outline" onClick={saveProgress} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar rascunho"}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : currentSection === SECTIONS.length - 1 ? (
                  <><Send className="h-4 w-4 mr-2" /> Enviar</>
                ) : (
                  <><ArrowRight className="h-4 w-4 mr-2" /> Próximo</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
