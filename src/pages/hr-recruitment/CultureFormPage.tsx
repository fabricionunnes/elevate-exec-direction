import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ChevronRight, ChevronLeft, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FORM_SECTIONS = [
  {
    id: "identity",
    title: "Identidade e História",
    description: "Conte a história e origem da empresa",
    fields: [
      { key: "respondent_name", label: "Seu nome", type: "text", required: true },
      { key: "respondent_role", label: "Seu cargo", type: "text", required: true },
      { key: "respondent_email", label: "Seu e-mail", type: "email", required: false },
      { key: "company_history", label: "Qual é a história da empresa?", type: "textarea", placeholder: "Conte a trajetória da empresa desde o início até hoje..." },
      { key: "founding_story", label: "Como a empresa foi fundada?", type: "textarea", placeholder: "Descreva o momento e as circunstâncias da fundação..." },
      { key: "founders_motivation", label: "O que motivou os fundadores?", type: "textarea", placeholder: "Qual foi a inspiração ou problema que quiseram resolver..." },
    ],
  },
  {
    id: "purpose",
    title: "Propósito e Missão",
    description: "Defina a razão de existir da empresa",
    fields: [
      { key: "company_purpose", label: "Qual é o propósito da empresa?", type: "textarea", placeholder: "Por que a empresa existe além de gerar lucro..." },
      { key: "mission_statement", label: "Qual é a missão da empresa?", type: "textarea", placeholder: "O que a empresa faz, para quem e como..." },
      { key: "vision_statement", label: "Qual é a visão de futuro?", type: "textarea", placeholder: "Onde a empresa quer chegar em 5-10 anos..." },
      { key: "core_values", label: "Quais são os valores centrais?", type: "textarea", placeholder: "Liste os 3-5 valores mais importantes e explique cada um..." },
    ],
  },
  {
    id: "culture",
    title: "Cultura e Comportamento",
    description: "Descreva como as pessoas devem agir",
    fields: [
      { key: "cultural_principles", label: "Quais são os princípios culturais?", type: "textarea", placeholder: "Os fundamentos que guiam todas as decisões..." },
      { key: "expected_behaviors", label: "Quais comportamentos são esperados?", type: "textarea", placeholder: "Como as pessoas devem agir no dia a dia..." },
      { key: "unacceptable_behaviors", label: "Quais comportamentos são inaceitáveis?", type: "textarea", placeholder: "O que não é tolerado de forma alguma..." },
    ],
  },
  {
    id: "leadership",
    title: "Liderança",
    description: "Defina o modelo de liderança",
    fields: [
      { key: "leadership_style", label: "Qual é o estilo de liderança?", type: "textarea", placeholder: "Como os líderes devem se comportar..." },
      { key: "leadership_expectations", label: "O que se espera dos líderes?", type: "textarea", placeholder: "Responsabilidades e atitudes esperadas..." },
    ],
  },
  {
    id: "performance",
    title: "Performance e Meritocracia",
    description: "Explique a cultura de resultados",
    fields: [
      { key: "performance_culture", label: "Como é a cultura de performance?", type: "textarea", placeholder: "Como resultados são mensurados e valorizados..." },
      { key: "recognition_approach", label: "Como funciona o reconhecimento?", type: "textarea", placeholder: "Como bons resultados são celebrados..." },
      { key: "meritocracy_principles", label: "Quais são os princípios de meritocracia?", type: "textarea", placeholder: "Como promoções e recompensas funcionam..." },
    ],
  },
  {
    id: "communication",
    title: "Comunicação",
    description: "Defina os padrões de comunicação",
    fields: [
      { key: "communication_style", label: "Qual é o estilo de comunicação?", type: "textarea", placeholder: "Como as pessoas devem se comunicar..." },
      { key: "internal_communication", label: "Como funciona a comunicação interna?", type: "textarea", placeholder: "Canais, frequência, transparência..." },
    ],
  },
  {
    id: "clients",
    title: "Relacionamento com Clientes",
    description: "Descreva a filosofia de atendimento",
    fields: [
      { key: "client_relationship", label: "Como deve ser o relacionamento com clientes?", type: "textarea", placeholder: "Postura, atendimento, resolução de problemas..." },
      { key: "client_experience_vision", label: "Qual é a visão de experiência do cliente?", type: "textarea", placeholder: "Como o cliente deve se sentir..." },
    ],
  },
  {
    id: "people",
    title: "Pessoas e Crescimento",
    description: "Defina o perfil ideal do time",
    fields: [
      { key: "ideal_team_member", label: "Como é o membro ideal do time?", type: "textarea", placeholder: "Perfil, atitudes, competências desejadas..." },
      { key: "who_should_not_join", label: "Quem NÃO deveria fazer parte do time?", type: "textarea", placeholder: "Perfis que não se encaixam na cultura..." },
      { key: "growth_opportunities", label: "Quais são as oportunidades de crescimento?", type: "textarea", placeholder: "Como a empresa investe nas pessoas..." },
    ],
  },
  {
    id: "future",
    title: "Futuro e Legado",
    description: "Compartilhe a visão de longo prazo",
    fields: [
      { key: "company_future_vision", label: "Qual é a visão de futuro da empresa?", type: "textarea", placeholder: "Para onde a empresa está indo..." },
      { key: "legacy_aspiration", label: "Qual legado a empresa quer deixar?", type: "textarea", placeholder: "O impacto duradouro que deseja criar..." },
      { key: "final_leadership_message", label: "Qual é a mensagem final da liderança?", type: "textarea", placeholder: "Uma mensagem pessoal e inspiradora para o time..." },
    ],
  },
];

export default function CultureFormPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formLink, setFormLink] = useState<any>(null);

  useEffect(() => {
    loadFormLink();
  }, [token]);

  const loadFormLink = async () => {
    if (!token) {
      toast.error("Token inválido");
      return;
    }

    const { data, error } = await supabase
      .from("culture_form_links")
      .select("*")
      .eq("access_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      toast.error("Link não encontrado ou expirado");
      return;
    }

    setFormLink(data);
    setIsLoading(false);
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (currentSection < FORM_SECTIONS.length - 1) {
      setCurrentSection((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formLink) return;

    // Validate required fields
    const requiredFields = FORM_SECTIONS[0].fields.filter(f => f.required);
    for (const field of requiredFields) {
      if (!formData[field.key]) {
        toast.error(`Por favor, preencha: ${field.label}`);
        setCurrentSection(0);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("culture_form_responses").insert({
        project_id: formLink.project_id,
        form_link_id: formLink.id,
        ...formData,
        is_complete: true,
      });

      if (error) throw error;

      // Log the submission
      await supabase.from("culture_manual_audit_log").insert({
        project_id: formLink.project_id,
        action: "form_submitted",
        action_details: { respondent_name: formData.respondent_name },
      });

      setIsSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar formulário: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!formLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link não encontrado</h2>
            <p className="text-muted-foreground">
              Este link não existe ou já expirou. Entre em contato com a equipe responsável.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Formulário Enviado!</h2>
            <p className="text-muted-foreground mb-6">
              Suas respostas foram registradas com sucesso. A equipe irá utilizar essas 
              informações para criar o Manual de Cultura da empresa.
            </p>
            <p className="text-sm text-muted-foreground">
              Você pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const section = FORM_SECTIONS[currentSection];
  const progress = ((currentSection + 1) / FORM_SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <BookOpen className="h-12 w-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manual de Cultura
          </h1>
          <p className="text-muted-foreground">
            Preencha este formulário para ajudar na criação do manual de cultura da empresa
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Seção {currentSection + 1} de {FORM_SECTIONS.length}</span>
            <span>{Math.round(progress)}% completo</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.key}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="resize-none"
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentSection === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>

              {currentSection === FORM_SECTIONS.length - 1 ? (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>Enviando...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Formulário
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section Indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {FORM_SECTIONS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSection(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentSection 
                  ? "bg-primary" 
                  : index < currentSection 
                    ? "bg-primary/50" 
                    : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
