import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { discQuestions, discProfiles } from "@/data/discQuestions";
import { climateQuestions, climateSections, getQuestionsBySection } from "@/data/climateQuestions";
import { CheckCircle2, ArrowRight, ArrowLeft, Brain, Users, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

// 360° Competencies
const competencies360 = [
  { id: "communication", name: "Comunicação", description: "Clareza, escuta ativa e expressão" },
  { id: "leadership", name: "Liderança", description: "Inspiração, direcionamento e desenvolvimento de pessoas" },
  { id: "teamwork", name: "Trabalho em Equipe", description: "Colaboração e cooperação" },
  { id: "proactivity", name: "Proatividade", description: "Iniciativa e antecipação" },
  { id: "results_delivery", name: "Entrega de Resultados", description: "Cumprimento de metas e qualidade" },
  { id: "conflict_management", name: "Gestão de Conflitos", description: "Mediação e resolução de problemas" },
];

interface DISCAnswer {
  questionId: number;
  most: string;
  least: string;
}

type AssessmentStep = "intro" | "disc" | "360" | "climate" | "success";

export default function UnifiedAssessmentPage() {
  const [searchParams] = useSearchParams();
  const cycleId = searchParams.get("cycle");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cycleInfo, setCycleInfo] = useState<{
    title: string;
    type: "360" | "disc" | "both";
    companyName: string | null;
    projectName: string;
  } | null>(null);

  const [step, setStep] = useState<AssessmentStep>("intro");
  
  // User info
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [department, setDepartment] = useState("");

  // DISC state
  const [currentDiscQuestion, setCurrentDiscQuestion] = useState(0);
  const [discAnswers, setDiscAnswers] = useState<DISCAnswer[]>([]);
  const [currentMost, setCurrentMost] = useState<string | null>(null);
  const [currentLeast, setCurrentLeast] = useState<string | null>(null);

  // 360° state
  const [scores360, setScores360] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");

  // Climate survey state
  const [currentClimateSection, setCurrentClimateSection] = useState(0);
  const [climateAnswers, setClimateAnswers] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    if (!cycleId) {
      setLoading(false);
      return;
    }
    fetchCycleInfo();
  }, [cycleId]);

  const fetchCycleInfo = async () => {
    try {
      const { data: cycle, error: cycleError } = await supabase
        .from("assessment_cycles")
        .select("title, type, status, project_id")
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

      // IMPORTANTE: manter este endpoint 100% público.
      // Algumas tabelas auxiliares (ex.: onboarding_projects/onboarding_companies)
      // podem exigir autenticação por RLS. Se isso acontecer, seguimos mesmo assim,
      // exibindo a avaliação com informações mínimas.
      let projectName = "";
      let companyName: string | null = null;

      try {
        const { data: project, error: projectError } = await supabase
          .from("onboarding_projects")
          .select("product_name, onboarding_company_id")
          .eq("id", cycle.project_id)
          .single();

        if (!projectError && project) {
          projectName = project.product_name || "";

          if (project.onboarding_company_id) {
            const { data: company, error: companyError } = await supabase
              .from("onboarding_companies")
              .select("name")
              .eq("id", project.onboarding_company_id)
              .single();

            if (!companyError && company?.name) {
              companyName = company.name;
            }
          }
        }
      } catch {
        // Silencioso: página pública não pode depender dessas tabelas
      }

      setCycleInfo({
        title: cycle.title,
        type: cycle.type as "360" | "disc" | "both",
        companyName,
        projectName,
      });
      setLoading(false);
    } catch (error) {
      console.error("Error fetching cycle:", error);
      toast.error("Erro ao carregar avaliação");
      setLoading(false);
    }
  };

  const handleStartAssessment = () => {
    if (!respondentName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    // Determine first step based on cycle type
    if (cycleInfo?.type === "disc" || cycleInfo?.type === "both") {
      setStep("disc");
    } else if (cycleInfo?.type === "360") {
      setStep("360");
    } else {
      // Climate only or other types - start with climate
      setStep("climate");
    }
  };

  // DISC handlers
  const handleSelectMost = (profile: string) => {
    if (currentLeast === profile) setCurrentLeast(null);
    setCurrentMost(profile);
  };

  const handleSelectLeast = (profile: string) => {
    if (currentMost === profile) setCurrentMost(null);
    setCurrentLeast(profile);
  };

  const handleNextDiscQuestion = () => {
    if (!currentMost || !currentLeast) {
      toast.error("Selecione a opção que MAIS e que MENOS combina com você");
      return;
    }

    const newAnswer: DISCAnswer = {
      questionId: discQuestions[currentDiscQuestion].id,
      most: currentMost,
      least: currentLeast,
    };

    const updatedAnswers = [...discAnswers];
    const existingIndex = updatedAnswers.findIndex(a => a.questionId === newAnswer.questionId);
    if (existingIndex >= 0) {
      updatedAnswers[existingIndex] = newAnswer;
    } else {
      updatedAnswers.push(newAnswer);
    }
    setDiscAnswers(updatedAnswers);

    if (currentDiscQuestion < discQuestions.length - 1) {
      setCurrentDiscQuestion(currentDiscQuestion + 1);
      setCurrentMost(null);
      setCurrentLeast(null);
    } else {
      // DISC completed - move to 360 then climate, or climate only
      if (cycleInfo?.type === "both") {
        setStep("360");
      } else {
        // For disc only, go to climate
        setStep("climate");
      }
    }
  };

  const handlePrevDiscQuestion = () => {
    if (currentDiscQuestion > 0) {
      setCurrentDiscQuestion(currentDiscQuestion - 1);
      const prevAnswer = discAnswers.find(a => a.questionId === discQuestions[currentDiscQuestion - 1].id);
      if (prevAnswer) {
        setCurrentMost(prevAnswer.most);
        setCurrentLeast(prevAnswer.least);
      } else {
        setCurrentMost(null);
        setCurrentLeast(null);
      }
    }
  };

  const calculateDiscScores = (answers: DISCAnswer[]) => {
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    
    answers.forEach(answer => {
      scores[answer.most as keyof typeof scores] += 2;
      scores[answer.least as keyof typeof scores] -= 1;
    });

    const maxPossible = discQuestions.length * 2;
    const minPossible = discQuestions.length * -1;
    const range = maxPossible - minPossible;

    const normalizedScores = {
      D: Math.round(((scores.D - minPossible) / range) * 100),
      I: Math.round(((scores.I - minPossible) / range) * 100),
      S: Math.round(((scores.S - minPossible) / range) * 100),
      C: Math.round(((scores.C - minPossible) / range) * 100),
    };

    const sortedProfiles = Object.entries(normalizedScores).sort(([, a], [, b]) => b - a);
    
    return {
      scores: normalizedScores,
      primary: sortedProfiles[0][0] as 'D' | 'I' | 'S' | 'C',
      secondary: sortedProfiles[1][0] as 'D' | 'I' | 'S' | 'C',
    };
  };

  // Climate navigation handlers
  const handleNextClimateSection = () => {
    // Validate current section
    const currentSectionId = climateSections[currentClimateSection].id;
    const sectionQuestions = getQuestionsBySection(currentSectionId);
    
    for (const q of sectionQuestions) {
      if (q.required && climateAnswers[q.id] === undefined) {
        toast.error("Por favor, responda todas as perguntas desta seção");
        return;
      }
    }

    if (currentClimateSection < climateSections.length - 1) {
      setCurrentClimateSection(currentClimateSection + 1);
    } else {
      // All sections completed, submit
      handleSubmit();
    }
  };

  const handlePrevClimateSection = () => {
    if (currentClimateSection > 0) {
      setCurrentClimateSection(currentClimateSection - 1);
    } else {
      // Go back to 360 or disc
      if (cycleInfo?.type === "360" || cycleInfo?.type === "both") {
        setStep("360");
      } else if (cycleInfo?.type === "disc") {
        setStep("disc");
        setCurrentDiscQuestion(discQuestions.length - 1);
      } else {
        setStep("intro");
      }
    }
  };

  const handleSubmit = async (finalDiscAnswers?: DISCAnswer[]) => {
    const answersToUse = finalDiscAnswers || discAnswers;
    
    // Validate 360 if needed
    if ((cycleInfo?.type === "360" || cycleInfo?.type === "both")) {
      const answered360 = Object.keys(scores360).length;
      if (answered360 < competencies360.length) {
        toast.error("Por favor, avalie todas as competências");
        return;
      }
    }

    // Validate required climate questions only if climate step was shown
    const hasClimateAnswers = Object.keys(climateAnswers).length > 0;
    if (hasClimateAnswers) {
      const requiredClimateQuestions = climateQuestions.filter(q => q.required);
      for (const q of requiredClimateQuestions) {
        if (climateAnswers[q.id] === undefined) {
          toast.error("Por favor, responda todas as perguntas obrigatórias da pesquisa de clima");
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const generateId = () => {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
        return `${Date.now()}-${Math.random()}`;
      };

      const participantId = generateId();
      const accessToken = generateId();

      // First, create participant record (no RETURNING to avoid public SELECT requirements)
      const { error: participantError } = await supabase
        .from("assessment_participants")
        .insert({
          id: participantId,
          access_token: accessToken,
          cycle_id: cycleId,
          name: respondentName.trim(),
          email: respondentEmail.trim() || null,
          role: "employee",
          department: department.trim() || null,
        });

      if (participantError) throw participantError;

      const participant = { id: participantId };

      // Save DISC response if applicable
      if (cycleInfo?.type === "disc" || cycleInfo?.type === "both") {
        const { scores, primary, secondary } = calculateDiscScores(answersToUse);
        
        const { error: discError } = await supabase.from("disc_responses").insert({
          cycle_id: cycleId,
          participant_id: participant.id,
          respondent_name: respondentName.trim(),
          respondent_email: respondentEmail.trim() || null,
          dominance_score: scores.D,
          influence_score: scores.I,
          steadiness_score: scores.S,
          conscientiousness_score: scores.C,
          primary_profile: primary,
          secondary_profile: secondary,
          raw_answers: answersToUse as unknown as Json,
        });

        if (discError) throw discError;
      }

      // Save 360 response if applicable
      if (cycleInfo?.type === "360" || cycleInfo?.type === "both") {
        const { error: error360 } = await supabase.from("assessment_360_evaluations").insert({
          cycle_id: cycleId,
          evaluated_id: participant.id,
          evaluator_name: respondentName.trim(),
          evaluator_email: respondentEmail.trim() || null,
          relationship: "self",
          communication_score: scores360.communication,
          leadership_score: scores360.leadership,
          teamwork_score: scores360.teamwork,
          proactivity_score: scores360.proactivity,
          results_delivery_score: scores360.results_delivery,
          conflict_management_score: scores360.conflict_management,
          strengths: strengths.trim() || null,
          improvements: improvements.trim() || null,
          additional_comments: comments.trim() || null,
          is_completed: true,
          completed_at: new Date().toISOString(),
        });

        if (error360) throw error360;
      }

      // Save climate survey response only if there are answers
      const hasClimateAnswers = Object.keys(climateAnswers).length > 0;
      if (hasClimateAnswers) {
        const { error: climateError } = await supabase.from("climate_survey_responses").insert({
          cycle_id: cycleId,
          participant_id: participant.id,
          respondent_name: respondentName.trim(),
          respondent_email: respondentEmail.trim() || null,
          company_satisfaction: climateAnswers.company_satisfaction as number || null,
          organizational_culture: climateAnswers.organizational_culture as number || null,
          feels_valued: climateAnswers.feels_valued as string || null,
          communication_with_superiors: climateAnswers.communication_with_superiors as number || null,
          superior_interest_development: climateAnswers.superior_interest_development as number || null,
          feels_supported: climateAnswers.feels_supported as number || null,
          has_growth_opportunities: climateAnswers.has_growth_opportunities as boolean || null,
          receives_feedback: climateAnswers.receives_feedback as string || null,
          training_rating: climateAnswers.training_rating as number || null,
          company_values_balance: climateAnswers.company_values_balance as boolean || null,
          company_offers_wellness: climateAnswers.company_offers_wellness as boolean || null,
          manages_responsibilities: climateAnswers.manages_responsibilities as boolean || null,
          feels_valued_for_work: climateAnswers.feels_valued_for_work as boolean || null,
          adequate_recognition: climateAnswers.adequate_recognition as boolean || null,
          rewards_rating: climateAnswers.rewards_rating as number || null,
          feels_comfortable_safe: climateAnswers.feels_comfortable_safe as boolean || null,
          good_coworker_relationship: climateAnswers.good_coworker_relationship as boolean || null,
          diversity_inclusion: climateAnswers.diversity_inclusion as number || null,
          what_company_does_well: climateAnswers.what_company_does_well as string || null,
          what_company_should_improve: climateAnswers.what_company_should_improve as string || null,
          enjoys_working_score: climateAnswers.enjoys_working_score as number || null,
          would_recommend_score: climateAnswers.would_recommend_score as number || null,
          open_feedback: climateAnswers.open_feedback as string || null,
        });

        if (climateError) throw climateError;
      }

      setStep("success");
      toast.success("Avaliação enviada com sucesso!");
    } catch (error: any) {
      console.error("Error submitting:", error);
      const message =
        typeof error?.message === "string" && error.message.trim().length > 0
          ? error.message
          : "Erro ao enviar avaliação";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate progress
  const getTotalSteps = () => {
    let total = climateSections.length; // Climate sections always included
    if (cycleInfo?.type === "both") {
      total += discQuestions.length + 1; // DISC questions + 360 page
    } else if (cycleInfo?.type === "disc") {
      total += discQuestions.length;
    } else if (cycleInfo?.type === "360") {
      total += 1; // 360 page
    }
    return total;
  };

  const getCurrentStep = () => {
    let currentStep = 0;
    
    if (step === "disc") {
      currentStep = currentDiscQuestion + 1;
    } else if (step === "360") {
      if (cycleInfo?.type === "both" || cycleInfo?.type === "disc") {
        currentStep = discQuestions.length + 1;
      } else {
        currentStep = 1;
      }
    } else if (step === "climate") {
      if (cycleInfo?.type === "both") {
        currentStep = discQuestions.length + 1 + 1 + currentClimateSection;
      } else if (cycleInfo?.type === "disc") {
        currentStep = discQuestions.length + currentClimateSection + 1;
      } else if (cycleInfo?.type === "360") {
        currentStep = 1 + currentClimateSection + 1;
      } else {
        currentStep = currentClimateSection + 1;
      }
    }
    
    return currentStep;
  };

  const progress = step === "intro" ? 0 : (getCurrentStep() / getTotalSteps()) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  if (!cycleId || !cycleInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Link inválido ou avaliação encerrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Obrigado, {respondentName}!</h2>
            <p className="text-muted-foreground">
              Sua avaliação foi enviada com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center text-white space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            {cycleInfo.type === "disc" ? (
              <Brain className="w-8 h-8" />
            ) : cycleInfo.type === "360" ? (
              <Users className="w-8 h-8" />
            ) : (
              <>
                <Brain className="w-6 h-6" />
                <span className="text-lg">+</span>
                <Users className="w-6 h-6" />
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold">{cycleInfo.title}</h1>
          <p className="text-white/70">{cycleInfo.companyName || cycleInfo.projectName}</p>
        </div>

        {/* Progress (only show after intro) */}
        {step !== "intro" && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {step === "disc" && `DISC - Pergunta ${currentDiscQuestion + 1} de ${discQuestions.length}`}
                    {step === "360" && "Avaliação 360°"}
                    {step === "climate" && `Clima - ${climateSections[currentClimateSection].name}`}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Intro */}
        {step === "intro" && (
          <Card>
            <CardHeader>
              <CardTitle>Bem-vindo à Avaliação</CardTitle>
              <CardDescription>
                {cycleInfo.type === "both" 
                  ? "Esta avaliação consiste em um Teste DISC (perfil comportamental) e uma Autoavaliação 360°."
                  : cycleInfo.type === "disc"
                  ? "Esta avaliação consiste em um Teste DISC para identificar seu perfil comportamental."
                  : "Esta avaliação consiste em uma Autoavaliação 360° sobre competências profissionais."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome completo *</Label>
                <Input
                  id="name"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  placeholder="Digite seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={respondentEmail}
                  onChange={(e) => setRespondentEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Departamento (opcional)</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Ex: Comercial, RH, Operações..."
                />
              </div>
              <Button onClick={handleStartAssessment} className="w-full mt-4">
                Iniciar Avaliação
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: DISC */}
        {step === "disc" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Teste DISC
                </CardTitle>
                <CardDescription>
                  Selecione a palavra que <strong className="text-green-500">MAIS</strong> combina com você e a que <strong className="text-red-500">MENOS</strong> combina.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {discQuestions[currentDiscQuestion].options.map((option) => (
                    <div
                      key={option.profile}
                      className={cn(
                        "flex items-center justify-between p-4 border rounded-lg transition-all",
                        currentMost === option.profile && "border-green-500 bg-green-500/10",
                        currentLeast === option.profile && "border-red-500 bg-red-500/10"
                      )}
                    >
                      <span className="font-medium">{option.text}</span>
                      <div className="flex gap-2">
                        <Button
                          variant={currentMost === option.profile ? "default" : "outline"}
                          size="sm"
                          className={cn(currentMost === option.profile && "bg-green-500 hover:bg-green-600")}
                          onClick={() => handleSelectMost(option.profile)}
                        >
                          + Mais
                        </Button>
                        <Button
                          variant={currentLeast === option.profile ? "default" : "outline"}
                          size="sm"
                          className={cn(currentLeast === option.profile && "bg-red-500 hover:bg-red-600")}
                          onClick={() => handleSelectLeast(option.profile)}
                        >
                          - Menos
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePrevDiscQuestion}
                disabled={currentDiscQuestion === 0}
                className="text-white border-white/30 hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
              <Button onClick={handleNextDiscQuestion} disabled={!currentMost || !currentLeast}>
                {currentDiscQuestion < discQuestions.length - 1 
                  ? "Próxima" 
                  : cycleInfo.type === "both" 
                  ? "Ir para 360°" 
                  : "Finalizar"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* Step: 360 */}
        {step === "360" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Autoavaliação 360°
                </CardTitle>
                <CardDescription>
                  Avalie a si mesmo em cada competência de 1 a 5
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {competencies360.map((comp) => (
                  <div key={comp.id} className="space-y-2">
                    <div>
                      <Label className="text-base font-medium">{comp.name}</Label>
                      <p className="text-sm text-muted-foreground">{comp.description}</p>
                    </div>
                    <RadioGroup
                      value={scores360[comp.id]?.toString() || ""}
                      onValueChange={(value) => setScores360({ ...scores360, [comp.id]: parseInt(value) })}
                      className="flex gap-4"
                    >
                      {[1, 2, 3, 4, 5].map((score) => (
                        <div key={score} className="flex flex-col items-center gap-1">
                          <RadioGroupItem value={score.toString()} id={`${comp.id}-${score}`} />
                          <Label htmlFor={`${comp.id}-${score}`} className="text-xs">
                            {score}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}

                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Quais são seus principais pontos fortes?</Label>
                    <Textarea
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      placeholder="Descreva suas principais qualidades..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quais pontos você gostaria de melhorar?</Label>
                    <Textarea
                      value={improvements}
                      onChange={(e) => setImprovements(e.target.value)}
                      placeholder="O que você gostaria de desenvolver..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Comentários adicionais (opcional)</Label>
                    <Textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Alguma observação extra..."
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between gap-2">
              {cycleInfo.type === "both" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("disc");
                    setCurrentDiscQuestion(discQuestions.length - 1);
                  }}
                  className="text-white border-white/30 hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao DISC
                </Button>
              )}

              {/* For 360-only cycles, allow finishing without the climate survey */}
              {cycleInfo.type === "360" && (
                <Button onClick={() => handleSubmit()} className="ml-auto">
                  Finalizar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              <Button
                onClick={() => setStep("climate")}
                disabled={Object.keys(scores360).length < competencies360.length}
                variant={cycleInfo.type === "360" ? "outline" : "default"}
              >
                Próximo: Pesquisa de Clima
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* Step: Climate Survey */}
        {step === "climate" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Pesquisa de Clima - {climateSections[currentClimateSection].icon} {climateSections[currentClimateSection].name}
                </CardTitle>
                <CardDescription>
                  Seção {currentClimateSection + 1} de {climateSections.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {getQuestionsBySection(climateSections[currentClimateSection].id).map((question) => (
                  <div key={question.id} className="space-y-3">
                    <Label className="text-base">
                      {question.question}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>

                    {/* Scale 1-5 */}
                    {question.type === 'scale_1_5' && (
                      <div className="space-y-2">
                        <RadioGroup
                          value={climateAnswers[question.id]?.toString() || ""}
                          onValueChange={(value) => setClimateAnswers({ ...climateAnswers, [question.id]: parseInt(value) })}
                          className="flex gap-4 justify-center"
                        >
                          {[1, 2, 3, 4, 5].map((score) => (
                            <div key={score} className="flex flex-col items-center gap-1">
                              <RadioGroupItem value={score.toString()} id={`${question.id}-${score}`} />
                              <Label htmlFor={`${question.id}-${score}`} className="text-xs">
                                {score}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <div className="flex justify-between text-xs text-muted-foreground px-2">
                          <span>Muito ruim</span>
                          <span>Muito bom</span>
                        </div>
                      </div>
                    )}

                    {/* Scale 0-5 */}
                    {question.type === 'scale_0_5' && (
                      <div className="space-y-2">
                        <RadioGroup
                          value={climateAnswers[question.id]?.toString() || ""}
                          onValueChange={(value) => setClimateAnswers({ ...climateAnswers, [question.id]: parseInt(value) })}
                          className="flex gap-3 justify-center"
                        >
                          {[0, 1, 2, 3, 4, 5].map((score) => (
                            <div key={score} className="flex flex-col items-center gap-1">
                              <RadioGroupItem value={score.toString()} id={`${question.id}-${score}`} />
                              <Label htmlFor={`${question.id}-${score}`} className="text-xs">
                                {score}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <div className="flex justify-between text-xs text-muted-foreground px-2">
                          <span>{question.id.includes('recommend') ? 'Não indicaria' : question.id.includes('enjoys') ? 'Não gosto' : 'Baixo'}</span>
                          <span>{question.id.includes('recommend') ? 'Indicaria' : question.id.includes('enjoys') ? 'Gosto muito' : 'Alto'}</span>
                        </div>
                      </div>
                    )}

                    {/* Boolean */}
                    {question.type === 'boolean' && (
                      <RadioGroup
                        value={climateAnswers[question.id]?.toString() || ""}
                        onValueChange={(value) => setClimateAnswers({ ...climateAnswers, [question.id]: value === 'true' })}
                        className="flex gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="true" id={`${question.id}-yes`} />
                          <Label htmlFor={`${question.id}-yes`}>Sim</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="false" id={`${question.id}-no`} />
                          <Label htmlFor={`${question.id}-no`}>Não</Label>
                        </div>
                      </RadioGroup>
                    )}

                    {/* Options */}
                    {question.type === 'options' && question.options && (
                      <RadioGroup
                        value={climateAnswers[question.id]?.toString() || ""}
                        onValueChange={(value) => setClimateAnswers({ ...climateAnswers, [question.id]: value })}
                        className="space-y-2"
                      >
                        {question.options.map((option) => (
                          <div key={option.value} className="flex items-center gap-2">
                            <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                            <Label htmlFor={`${question.id}-${option.value}`}>{option.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Text */}
                    {question.type === 'text' && (
                      <Textarea
                        value={climateAnswers[question.id]?.toString() || ""}
                        onChange={(e) => setClimateAnswers({ ...climateAnswers, [question.id]: e.target.value })}
                        placeholder="Digite sua resposta..."
                        rows={4}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePrevClimateSection}
                className="text-white border-white/30 hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              
              {currentClimateSection < climateSections.length - 1 ? (
                <Button onClick={handleNextClimateSection}>
                  Próxima Seção
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleNextClimateSection}
                  disabled={submitting}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Finalizar Avaliação
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
