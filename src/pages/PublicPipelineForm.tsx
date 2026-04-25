import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from "lucide-react";

interface FormConfig {
  id: string;
  title: string | null;
  description: string | null;
  pipeline_id: string;
  form_token: string;
  is_active: boolean;
  origin_name: string | null;
  redirect_url: string | null;
}

interface FormQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const cleanPhone = (value: string) => value.replace(/\D/g, "");

const PublicPipelineForm = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const prefilledLeadId = searchParams.get("lead_id");
  const autoSubmit = searchParams.get("auto_submit") === "1";
  const autoNome = (searchParams.get("nome") || "").trim();
  const autoTelefone = (searchParams.get("telefone") || "").trim();
  const autoEmail = (searchParams.get("email") || "").trim();
  const autoSubmittedRef = useRef(false);
  const pixelLoadedRef = useRef(false);

  // Meta Pixel
  useEffect(() => {
    if (pixelLoadedRef.current) return;
    pixelLoadedRef.current = true;
    const pixelId = '247392077001023';
    (function(f: any,b: any,e: any,v: any,n?: any,t?: any,s?: any){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    })(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    (window as any).fbq('init', pixelId);
    (window as any).fbq('track', 'PageView');
  }, []);

  const [form, setForm] = useState<FormConfig | null>(null);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingStep1, setSubmittingStep1] = useState(false);
  const [submittingStep2, setSubmittingStep2] = useState(false);
  const [step, setStep] = useState(prefilledLeadId ? 2 : 1);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(prefilledLeadId);

  const [nome, setNome] = useState(autoNome);
  const [telefone, setTelefone] = useState(autoTelefone ? formatPhone(autoTelefone) : "");
  const [email, setEmail] = useState(autoEmail);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleFormComplete = () => {
    if (form?.redirect_url) {
      window.location.href = form.redirect_url;
    } else if (prefilledLeadId || autoSubmit) {
      window.location.hash = "/sessao-estrategica/obrigado";
    } else {
      setSubmitted(true);
    }
  };

  useEffect(() => {
    if (token) loadForm();
  }, [token]);

  const loadForm = async () => {
    const formRes = await supabase
      .from("crm_pipeline_forms")
      .select("id, title, description, pipeline_id, form_token, is_active, origin_name, redirect_url")
      .eq("form_token", token)
      .eq("is_active", true)
      .maybeSingle();

    const formData = formRes.data;

    let loadedQuestions: any[] = [];
    if (formData) {
      const { data: qData } = await supabase
        .from("crm_pipeline_form_questions" as any)
        .select("id, question_text, question_type, options, is_required, sort_order")
        .eq("form_id", formData.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      loadedQuestions = (qData as any[]) || [];
    }

    // Set both together to avoid race condition with auto-submit
    setQuestions(loadedQuestions);
    setForm(formData);
    setLoading(false);
  };

  const submitStep1 = async (payload?: { nome?: string; telefone?: string; email?: string }) => {
    if (!form) return;

    const finalNome = (payload?.nome ?? nome).trim();
    const finalTelefone = cleanPhone(payload?.telefone ?? telefone);
    const finalEmail = (payload?.email ?? email).trim();

    if (!finalNome || !finalTelefone || !finalEmail) {
      setError("Preencha nome, WhatsApp e e-mail.");
      return;
    }

    setSubmittingStep1(true);
    setError(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-pipeline-form`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_token: form.form_token,
            nome: finalNome,
            telefone: finalTelefone,
            email: finalEmail,
            utm_source: searchParams.get("utm_source") || undefined,
            utm_medium: searchParams.get("utm_medium") || undefined,
            utm_campaign: searchParams.get("utm_campaign") || undefined,
            utm_content: searchParams.get("utm_content") || undefined,
            utm_term: searchParams.get("utm_term") || undefined,
            fbclid: searchParams.get("fbclid") || undefined,
            ad_name: searchParams.get("ad_name") || undefined,
            adset_name: searchParams.get("adset_name") || undefined,
            campaign_name: searchParams.get("campaign_name") || undefined,
            // IDs do Meta Ads (preenchidos via URL Parameters do anúncio)
            meta_campaign_id: searchParams.get("meta_campaign_id") || searchParams.get("campaign_id") || undefined,
            meta_adset_id: searchParams.get("meta_adset_id") || searchParams.get("adset_id") || undefined,
            meta_ad_id: searchParams.get("meta_ad_id") || searchParams.get("ad_id") || undefined,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao enviar");

      setLeadId(data.lead_id);
      if (questions.length > 0) {
        setStep(2);
      } else {
        handleFormComplete();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao enviar formulário");
    } finally {
      setSubmittingStep1(false);
    }
  };

  useEffect(() => {
    if (!form || prefilledLeadId || !autoSubmit || autoSubmittedRef.current) return;
    if (!autoNome || !autoTelefone || !autoEmail) return;

    autoSubmittedRef.current = true;
    void submitStep1({ nome: autoNome, telefone: autoTelefone, email: autoEmail });
  }, [form, prefilledLeadId, autoSubmit, autoNome, autoTelefone, autoEmail, questions.length]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitStep1();
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    for (const q of questions) {
      if (q.is_required && (!answers[q.id] || !answers[q.id].trim())) {
        setError(`Por favor, responda: "${q.question_text}"`);
        return;
      }
    }

    setSubmittingStep2(true);
    setError(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-pipeline-form`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit_answers",
            lead_id: leadId,
            answers: Object.entries(answers)
              .filter(([, v]) => v.trim())
              .map(([questionId, answerText]) => ({ question_id: questionId, answer_text: answerText })),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao enviar respostas");
      }

      handleFormComplete();
    } catch (err: any) {
      setError(err.message || "Erro ao enviar respostas");
    } finally {
      setSubmittingStep2(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Formulário não encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Este formulário não existe ou está inativo.
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
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Enviado com sucesso!</h2>
            <p className="text-sm text-muted-foreground">
              Seus dados foram recebidos. Entraremos em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>{form.title || "Formulário de Contato"}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
          {questions.length > 0 && (
            <div className="flex gap-2 mt-3">
              <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {step === 1 && (
            autoSubmit ? (
              <div className="py-8 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Abrindo formulário e captando seu cadastro...</p>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            ) : (
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhone(e.target.value))}
                    required
                    maxLength={16}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={submittingStep1}>
                  {submittingStep1 ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {questions.length > 0 ? "Continuar" : "Enviar"}
                </Button>
              </form>
            )
          )}

          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Responda as perguntas abaixo para completar seu cadastro.
              </p>

              {questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label>
                    {q.question_text} {q.is_required && "*"}
                  </Label>

                  {q.question_type === "open" ? (
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      maxLength={2000}
                      rows={3}
                      required={q.is_required}
                    />
                  ) : (
                    <RadioGroup
                      value={answers[q.id] || ""}
                      onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      className="space-y-2"
                    >
                      {(q.options || []).map((opt, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`${q.id}-${idx}`} />
                          <Label htmlFor={`${q.id}-${idx}`} className="font-normal cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              ))}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={submittingStep2}>
                {submittingStep2 && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicPipelineForm;
