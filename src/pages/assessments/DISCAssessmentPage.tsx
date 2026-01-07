import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { discQuestions, discProfiles } from "@/data/discQuestions";
import { CheckCircle2, ArrowRight, ArrowLeft, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface Answer {
  questionId: number;
  most: string; // profile
  least: string; // profile
}

export default function DISCAssessmentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cycleId = searchParams.get("cycle");
  const participantId = searchParams.get("participant");
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [projectInfo, setProjectInfo] = useState<{ productName: string; companyName: string | null } | null>(null);
  const [participantInfo, setParticipantInfo] = useState<{ name: string; email: string | null } | null>(null);

  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentMost, setCurrentMost] = useState<string | null>(null);
  const [currentLeast, setCurrentLeast] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId || !participantId || !token) {
      toast.error("Link inválido");
      return;
    }
    fetchData();
  }, [cycleId, participantId, token]);

  const fetchData = async () => {
    try {
      // Validate token and get participant info
      const { data: participant, error: participantError } = await supabase
        .from("assessment_participants")
        .select("name, email, access_token, cycle_id")
        .eq("id", participantId)
        .single();

      if (participantError || !participant || participant.access_token !== token) {
        toast.error("Link inválido ou expirado");
        setLoading(false);
        return;
      }

      setParticipantInfo({ name: participant.name, email: participant.email });
      setRespondentName(participant.name);
      if (participant.email) setRespondentEmail(participant.email);

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
      const { data: project, error: projectError } = await supabase
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

      // Check if already responded
      const { data: existingResponse } = await supabase
        .from("disc_responses")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("participant_id", participantId)
        .single();

      if (existingResponse) {
        setSubmitted(true);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
      setLoading(false);
    }
  };

  const handleSelectMost = (profile: string) => {
    if (currentLeast === profile) {
      setCurrentLeast(null);
    }
    setCurrentMost(profile);
  };

  const handleSelectLeast = (profile: string) => {
    if (currentMost === profile) {
      setCurrentMost(null);
    }
    setCurrentLeast(profile);
  };

  const handleNextQuestion = () => {
    if (!currentMost || !currentLeast) {
      toast.error("Selecione a opção que MAIS e que MENOS combina com você");
      return;
    }

    const newAnswer: Answer = {
      questionId: discQuestions[currentQuestion].id,
      most: currentMost,
      least: currentLeast,
    };

    const updatedAnswers = [...answers];
    const existingIndex = updatedAnswers.findIndex(a => a.questionId === newAnswer.questionId);
    if (existingIndex >= 0) {
      updatedAnswers[existingIndex] = newAnswer;
    } else {
      updatedAnswers.push(newAnswer);
    }
    setAnswers(updatedAnswers);

    if (currentQuestion < discQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentMost(null);
      setCurrentLeast(null);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers.find(a => a.questionId === discQuestions[currentQuestion - 1].id);
      if (prevAnswer) {
        setCurrentMost(prevAnswer.most);
        setCurrentLeast(prevAnswer.least);
      } else {
        setCurrentMost(null);
        setCurrentLeast(null);
      }
    }
  };

  const calculateScores = () => {
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    
    answers.forEach(answer => {
      // "Most" adds points
      scores[answer.most as keyof typeof scores] += 2;
      // "Least" subtracts points
      scores[answer.least as keyof typeof scores] -= 1;
    });

    // Normalize to 0-100 scale
    const maxPossible = discQuestions.length * 2;
    const minPossible = discQuestions.length * -1;
    const range = maxPossible - minPossible;

    const normalizedScores = {
      D: Math.round(((scores.D - minPossible) / range) * 100),
      I: Math.round(((scores.I - minPossible) / range) * 100),
      S: Math.round(((scores.S - minPossible) / range) * 100),
      C: Math.round(((scores.C - minPossible) / range) * 100),
    };

    // Determine primary and secondary profiles
    const sortedProfiles = Object.entries(normalizedScores)
      .sort(([, a], [, b]) => b - a);
    
    return {
      scores: normalizedScores,
      primary: sortedProfiles[0][0] as 'D' | 'I' | 'S' | 'C',
      secondary: sortedProfiles[1][0] as 'D' | 'I' | 'S' | 'C',
    };
  };

  const handleSubmit = async () => {
    if (!respondentName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    if (answers.length < discQuestions.length) {
      toast.error("Por favor, responda todas as perguntas");
      return;
    }

    setSubmitting(true);

    try {
      const { scores, primary, secondary } = calculateScores();

      const { error } = await supabase.from("disc_responses").insert([{
        cycle_id: cycleId,
        participant_id: participantId,
        respondent_name: respondentName,
        respondent_email: respondentEmail || null,
        dominance_score: scores.D,
        influence_score: scores.I,
        steadiness_score: scores.S,
        conscientiousness_score: scores.C,
        primary_profile: primary,
        secondary_profile: secondary,
        raw_answers: answers as unknown as Json,
      }]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (!cycleId || !participantId || !token || !projectInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Obrigado!</h2>
            <p className="text-muted-foreground">
              Sua avaliação DISC foi enviada com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = discQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / discQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center text-white space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Brain className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Teste DISC</h1>
          </div>
          <p className="text-white/70">
            {projectInfo.companyName || projectInfo.productName}
          </p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Pergunta {currentQuestion + 1} de {discQuestions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>

        {/* Name input (first question only) */}
        {currentQuestion === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seus Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  placeholder="Seu nome"
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
            </CardContent>
          </Card>
        )}

        {/* Question */}
        <Card>
          <CardHeader>
            <CardTitle>Escolha as opções</CardTitle>
            <CardDescription>
              Selecione a palavra que <strong className="text-green-500">MAIS</strong> combina com você e a que <strong className="text-red-500">MENOS</strong> combina.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {question.options.map((option) => (
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
                      className={cn(
                        currentMost === option.profile && "bg-green-500 hover:bg-green-600"
                      )}
                      onClick={() => handleSelectMost(option.profile)}
                    >
                      + Mais
                    </Button>
                    <Button
                      variant={currentLeast === option.profile ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        currentLeast === option.profile && "bg-red-500 hover:bg-red-600"
                      )}
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
            onClick={handlePrevQuestion}
            disabled={currentQuestion === 0}
            className="text-white border-white/30 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {currentQuestion < discQuestions.length - 1 ? (
            <Button onClick={handleNextQuestion} disabled={!currentMost || !currentLeast}>
              Próxima
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !currentMost || !currentLeast}
              className="bg-green-500 hover:bg-green-600"
            >
              {submitting ? "Enviando..." : "Finalizar"}
              <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
