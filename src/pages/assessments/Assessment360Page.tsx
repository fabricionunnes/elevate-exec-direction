import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { assessment360Competencies } from "@/data/discQuestions";
import { CheckCircle2, ArrowRight, ArrowLeft, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface EvaluationData {
  leadership_score: number | null;
  communication_score: number | null;
  teamwork_score: number | null;
  conflict_management_score: number | null;
  proactivity_score: number | null;
  results_delivery_score: number | null;
  strengths: string;
  improvements: string;
  additional_comments: string;
}

export default function Assessment360Page() {
  const [searchParams] = useSearchParams();
  const cycleId = searchParams.get("cycle");
  const evaluatedId = searchParams.get("evaluated");
  const relationship = searchParams.get("rel") || "peer";
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [projectInfo, setProjectInfo] = useState<{ productName: string; companyName: string | null } | null>(null);
  const [evaluatedInfo, setEvaluatedInfo] = useState<{ name: string } | null>(null);

  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatorEmail, setEvaluatorEmail] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [evaluation, setEvaluation] = useState<EvaluationData>({
    leadership_score: null,
    communication_score: null,
    teamwork_score: null,
    conflict_management_score: null,
    proactivity_score: null,
    results_delivery_score: null,
    strengths: "",
    improvements: "",
    additional_comments: "",
  });

  const steps = [
    { id: "info", name: "Seus Dados" },
    ...assessment360Competencies.map(c => ({ id: c.key, name: c.name })),
    { id: "comments", name: "Comentários" },
  ];

  const scoreLabels = [
    { value: 1, label: "Muito Abaixo" },
    { value: 2, label: "Abaixo" },
    { value: 3, label: "Na Média" },
    { value: 4, label: "Acima" },
    { value: 5, label: "Excelente" },
  ];

  useEffect(() => {
    if (!cycleId || !evaluatedId || !token) {
      toast.error("Link inválido");
      return;
    }
    fetchData();
  }, [cycleId, evaluatedId, token]);

  const fetchData = async () => {
    try {
      // Validate token and get evaluated participant info
      const { data: evaluated, error: evaluatedError } = await supabase
        .from("assessment_participants")
        .select("name, access_token, cycle_id")
        .eq("id", evaluatedId)
        .single();

      if (evaluatedError || !evaluated || evaluated.access_token !== token) {
        toast.error("Link inválido ou expirado");
        setLoading(false);
        return;
      }

      setEvaluatedInfo({ name: evaluated.name });

      // Get cycle and project info
      const { data: cycle, error: cycleError } = await supabase
        .from("assessment_cycles")
        .select("project_id, status")
        .eq("id", cycleId)
        .single();

      if (cycleError || !cycle) {
        toast.error("Ciclo de avaliação não encontrado");
        setLoading(false);
        return;
      }

      if (cycle.status !== "active") {
        toast.error("Este ciclo de avaliação foi encerrado");
        setLoading(false);
        return;
      }

      // Get project info
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("product_name, onboarding_company_id")
        .eq("id", cycle.project_id)
        .single();

      if (project) {
        let companyName = null;
        if (project.onboarding_company_id) {
          const { data: company } = await supabase
            .from("onboarding_companies")
            .select("name")
            .eq("id", project.onboarding_company_id)
            .single();
          companyName = company?.name || null;
        }
        setProjectInfo({ productName: project.product_name, companyName });
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
      setLoading(false);
    }
  };

  const handleScoreChange = (competencyKey: string, score: number) => {
    const scoreKey = `${competencyKey}_score` as keyof EvaluationData;
    setEvaluation(prev => ({ ...prev, [scoreKey]: score }));
  };

  const getScoreForCompetency = (competencyKey: string): number | null => {
    const scoreKey = `${competencyKey}_score` as keyof EvaluationData;
    return evaluation[scoreKey] as number | null;
  };

  const handleNext = () => {
    if (currentStep === 0 && !evaluatorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    // Validate competency step
    if (currentStep > 0 && currentStep <= assessment360Competencies.length) {
      const competency = assessment360Competencies[currentStep - 1];
      const score = getScoreForCompetency(competency.key);
      if (!score) {
        toast.error("Por favor, selecione uma nota para esta competência");
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!evaluatorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    // Check all competencies have scores
    const allScored = assessment360Competencies.every(c => getScoreForCompetency(c.key) !== null);
    if (!allScored) {
      toast.error("Por favor, avalie todas as competências");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("assessment_360_evaluations").insert({
        cycle_id: cycleId,
        evaluated_id: evaluatedId,
        evaluator_name: evaluatorName,
        evaluator_email: evaluatorEmail || null,
        relationship,
        leadership_score: evaluation.leadership_score,
        communication_score: evaluation.communication_score,
        teamwork_score: evaluation.teamwork_score,
        conflict_management_score: evaluation.conflict_management_score,
        proactivity_score: evaluation.proactivity_score,
        results_delivery_score: evaluation.results_delivery_score,
        strengths: evaluation.strengths || null,
        improvements: evaluation.improvements || null,
        additional_comments: evaluation.additional_comments || null,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success("Avaliação enviada com sucesso!");
    } catch (error) {
      console.error("Error submitting:", error);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (!cycleId || !evaluatedId || !token || !projectInfo || !evaluatedInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Link inválido ou expirado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Obrigado!</h2>
            <p className="text-muted-foreground">
              Sua avaliação 360° de {evaluatedInfo.name} foi enviada com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const relationshipLabels = {
    self: "Autoavaliação",
    manager: "Gestor Avaliando",
    peer: "Avaliação de Par",
    subordinate: "Subordinado Avaliando",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center text-white space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Users className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Avaliação 360°</h1>
          </div>
          <p className="text-white/70">
            {projectInfo.companyName || projectInfo.productName}
          </p>
          <p className="text-white/50 text-sm">
            {relationshipLabels[relationship as keyof typeof relationshipLabels] || "Avaliação"}:{" "}
            <span className="font-semibold text-white/80">{evaluatedInfo.name}</span>
          </p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{steps[currentStep].name}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          {currentStep === 0 && (
            <>
              <CardHeader>
                <CardTitle className="text-lg">Seus Dados</CardTitle>
                <CardDescription>Informe seus dados para identificação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input
                    id="name"
                    value={evaluatorName}
                    onChange={(e) => setEvaluatorName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={evaluatorEmail}
                    onChange={(e) => setEvaluatorEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
              </CardContent>
            </>
          )}

          {currentStep > 0 && currentStep <= assessment360Competencies.length && (
            <>
              {(() => {
                const competency = assessment360Competencies[currentStep - 1];
                const currentScore = getScoreForCompetency(competency.key);
                return (
                  <>
                    <CardHeader>
                      <CardTitle className="text-lg">{competency.name}</CardTitle>
                      <CardDescription>{competency.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <p className="text-sm font-medium">Aspectos avaliados:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {competency.questions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-4">
                        <Label>Qual nota você dá para {evaluatedInfo.name} nesta competência?</Label>
                        <RadioGroup
                          value={currentScore?.toString() || ""}
                          onValueChange={(value) => handleScoreChange(competency.key, parseInt(value))}
                          className="grid grid-cols-5 gap-2"
                        >
                          {scoreLabels.map((score) => (
                            <div key={score.value} className="text-center">
                              <RadioGroupItem
                                value={score.value.toString()}
                                id={`${competency.key}-${score.value}`}
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor={`${competency.key}-${score.value}`}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-all",
                                  "hover:bg-muted/50",
                                  currentScore === score.value && "border-primary bg-primary/10"
                                )}
                              >
                                <span className="text-2xl font-bold">{score.value}</span>
                                <span className="text-xs text-muted-foreground">{score.label}</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </>
                );
              })()}
            </>
          )}

          {currentStep === steps.length - 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-lg">Comentários</CardTitle>
                <CardDescription>Compartilhe suas observações sobre {evaluatedInfo.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="strengths">Pontos Fortes</Label>
                  <Textarea
                    id="strengths"
                    value={evaluation.strengths}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, strengths: e.target.value }))}
                    placeholder="Quais são os principais pontos fortes desta pessoa?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="improvements">Pontos de Melhoria</Label>
                  <Textarea
                    id="improvements"
                    value={evaluation.improvements}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, improvements: e.target.value }))}
                    placeholder="Em quais aspectos esta pessoa pode melhorar?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comments">Comentários Adicionais (opcional)</Label>
                  <Textarea
                    id="comments"
                    value={evaluation.additional_comments}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, additional_comments: e.target.value }))}
                    placeholder="Algum comentário adicional?"
                    rows={3}
                  />
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="text-white border-white/30 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button onClick={handleNext}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="bg-green-500 hover:bg-green-600"
            >
              {submitting ? "Enviando..." : "Finalizar Avaliação"}
              <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
