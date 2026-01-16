import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

// DISC questions - 28 scenarios
const discQuestions = [
  { id: 1, D: "Competitivo", I: "Entusiasmado", S: "Paciente", C: "Analítico" },
  { id: 2, D: "Direto", I: "Otimista", S: "Estável", C: "Preciso" },
  { id: 3, D: "Determinado", I: "Comunicativo", S: "Cooperativo", C: "Cuidadoso" },
  { id: 4, D: "Assertivo", I: "Expressivo", S: "Acolhedor", C: "Metódico" },
  { id: 5, D: "Pioneiro", I: "Persuasivo", S: "Leal", C: "Sistemático" },
  { id: 6, D: "Orientado a resultados", I: "Inspirador", S: "Compreensivo", C: "Detalhista" },
  { id: 7, D: "Decidido", I: "Sociável", S: "Gentil", C: "Organizado" },
  { id: 8, D: "Corajoso", I: "Animado", S: "Relaxado", C: "Perfeccionista" },
  { id: 9, D: "Inovador", I: "Influente", S: "Confiável", C: "Lógico" },
  { id: 10, D: "Independente", I: "Carismático", S: "Calmo", C: "Reservado" },
  { id: 11, D: "Objetivo", I: "Amigável", S: "Tolerante", C: "Criterioso" },
  { id: 12, D: "Confiante", I: "Motivador", S: "Pacífico", C: "Cauteloso" },
  { id: 13, D: "Destemido", I: "Encantador", S: "Moderado", C: "Investigativo" },
  { id: 14, D: "Audacioso", I: "Divertido", S: "Tradicional", C: "Exato" },
  { id: 15, D: "Empreendedor", I: "Popular", S: "Previsível", C: "Rigoroso" },
  { id: 16, D: "Exigente", I: "Espontâneo", S: "Harmonioso", C: "Planejador" },
  { id: 17, D: "Dominante", I: "Conversador", S: "Consistente", C: "Reflexivo" },
  { id: 18, D: "Resolutivo", I: "Vibrante", S: "Estabilizador", C: "Analítico" },
  { id: 19, D: "Incisivo", I: "Cativante", S: "Tranquilo", C: "Discreto" },
  { id: 20, D: "Firme", I: "Convincente", S: "Sensato", C: "Meticuloso" },
  { id: 21, D: "Arrojado", I: "Festivo", S: "Complacente", C: "Calculista" },
  { id: 22, D: "Competidor", I: "Extrovertido", S: "Atencioso", C: "Técnico" },
  { id: 23, D: "Aventureiro", I: "Energético", S: "Diplomático", C: "Sério" },
  { id: 24, D: "Ousado", I: "Entusiasta", S: "Pacificador", C: "Formal" },
  { id: 25, D: "Ativo", I: "Contagiante", S: "Acomodado", C: "Racional" },
  { id: 26, D: "Desafiador", I: "Expressivo", S: "Prestativo", C: "Cético" },
  { id: 27, D: "Persistente", I: "Otimista", S: "Receptivo", C: "Pensativo" },
  { id: 28, D: "Impetuoso", I: "Jovial", S: "Plácido", C: "Sóbrio" },
];

interface Answer {
  questionId: number;
  most: string;
  least: string;
}

interface CandidateData {
  id: string;
  full_name: string;
  email: string;
}

interface DiscRecord {
  id: string;
  candidate_id: string;
  status: string;
}

export default function HrCandidateDiscPage() {
  const { token } = useParams<{ token: string }>();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [discRecord, setDiscRecord] = useState<DiscRecord | null>(null);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentMost, setCurrentMost] = useState<string | null>(null);
  const [currentLeast, setCurrentLeast] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setError("Link inválido");
      setLoading(false);
    }
  }, [token]);

  const fetchData = async () => {
    try {
      // Find the DISC record by access_token
      const { data: disc, error: discError } = await supabase
        .from("candidate_disc_results")
        .select("id, candidate_id, status")
        .eq("access_token", token)
        .single();

      if (discError || !disc) {
        setError("Link inválido ou expirado");
        setLoading(false);
        return;
      }

      if (disc.status === "completed") {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      setDiscRecord(disc);

      // Get candidate info
      const { data: candidateData, error: candidateError } = await supabase
        .from("candidates")
        .select("id, full_name, email")
        .eq("id", disc.candidate_id)
        .single();

      if (candidateError || !candidateData) {
        setError("Candidato não encontrado");
        setLoading(false);
        return;
      }

      setCandidate(candidateData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Erro ao carregar dados");
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
    } else {
      handleSubmit(updatedAnswers);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers.find(a => a.questionId === discQuestions[currentQuestion - 1].id);
      setCurrentMost(prevAnswer?.most || null);
      setCurrentLeast(prevAnswer?.least || null);
    }
  };

  const calculateScores = (responses: Answer[]) => {
    let D = 0, I = 0, S = 0, C = 0;
    
    responses.forEach((response) => {
      // Most = +2, Least = -1
      switch (response.most) {
        case "D": D += 2; break;
        case "I": I += 2; break;
        case "S": S += 2; break;
        case "C": C += 2; break;
      }
      switch (response.least) {
        case "D": D -= 1; break;
        case "I": I -= 1; break;
        case "S": S -= 1; break;
        case "C": C -= 1; break;
      }
    });

    // Normalize to 0-100%
    const total = Math.abs(D) + Math.abs(I) + Math.abs(S) + Math.abs(C);
    const normalize = (v: number) => Math.max(0, Math.round((v / total) * 100));
    
    const scores = {
      D: normalize(D),
      I: normalize(I),
      S: normalize(S),
      C: normalize(C),
    };

    // Ensure total is 100%
    const sum = scores.D + scores.I + scores.S + scores.C;
    if (sum !== 100) {
      const diff = 100 - sum;
      const maxKey = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0] as keyof typeof scores;
      scores[maxKey] += diff;
    }

    return scores;
  };

  const getDominantProfile = (scores: { D: number; I: number; S: number; C: number }) => {
    const entries = Object.entries(scores);
    const max = entries.reduce((a, b) => a[1] > b[1] ? a : b);
    return max[0];
  };

  const getInterpretation = (profile: string) => {
    const interpretations: Record<string, string> = {
      D: "Perfil Dominante: Orientado a resultados, direto, assertivo e competitivo. Tende a assumir riscos e buscar desafios.",
      I: "Perfil Influente: Comunicativo, entusiasmado, otimista e persuasivo. Valoriza relacionamentos e trabalho em equipe.",
      S: "Perfil Estável: Paciente, confiável, cooperativo e bom ouvinte. Aprecia ambientes harmoniosos e previsíveis.",
      C: "Perfil Consciente: Analítico, preciso, sistemático e detalhista. Valoriza qualidade e precisão no trabalho.",
    };
    return interpretations[profile] || "";
  };

  const handleSubmit = async (finalAnswers: Answer[]) => {
    if (!discRecord) return;
    
    setSubmitting(true);
    
    try {
      const scores = calculateScores(finalAnswers);
      const dominantProfile = getDominantProfile(scores);
      const interpretation = getInterpretation(dominantProfile);

      const { error: updateError } = await supabase
        .from("candidate_disc_results")
        .update({
          status: "completed",
          d_score: scores.D,
          i_score: scores.I,
          s_score: scores.S,
          c_score: scores.C,
          dominant_profile: dominantProfile,
          interpretation,
          raw_responses: JSON.parse(JSON.stringify(finalAnswers)),
          completed_at: new Date().toISOString(),
        })
        .eq("id", discRecord.id);

      if (updateError) throw updateError;

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSubmitted(true);
      toast.success("Avaliação DISC concluída com sucesso!");
    } catch (err) {
      console.error("Error submitting:", err);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando avaliação...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Avaliação Concluída!</h2>
            <p className="text-muted-foreground">
              Obrigado por completar a avaliação DISC. Os resultados serão analisados pela equipe de RH.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQ = discQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / discQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Avaliação DISC</CardTitle>
            <CardDescription className="text-center">
              {candidate?.full_name && (
                <span className="font-medium text-foreground">{candidate.full_name}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Progresso</span>
                <span>{currentQuestion + 1} de {discQuestions.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Questão {currentQuestion + 1}</CardTitle>
            <CardDescription>
              Escolha a palavra que <strong>MAIS</strong> combina com você e a que <strong>MENOS</strong> combina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-3">
              {(["D", "I", "S", "C"] as const).map((profile) => (
                <div
                  key={profile}
                  className={`
                    p-4 rounded-lg border-2 transition-all cursor-pointer
                    ${currentMost === profile ? "border-green-500 bg-green-50" : ""}
                    ${currentLeast === profile ? "border-red-500 bg-red-50" : ""}
                    ${!currentMost && !currentLeast ? "border-muted hover:border-primary/50" : ""}
                    ${currentMost !== profile && currentLeast !== profile ? "border-muted" : ""}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{currentQ[profile]}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={currentMost === profile ? "default" : "outline"}
                        onClick={() => handleSelectMost(profile)}
                        className={currentMost === profile ? "bg-green-500 hover:bg-green-600" : ""}
                      >
                        Mais
                      </Button>
                      <Button
                        size="sm"
                        variant={currentLeast === profile ? "default" : "outline"}
                        onClick={() => handleSelectLeast(profile)}
                        className={currentLeast === profile ? "bg-red-500 hover:bg-red-600" : ""}
                      >
                        Menos
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestion === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              <Button
                onClick={handleNextQuestion}
                disabled={!currentMost || !currentLeast || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : currentQuestion === discQuestions.length - 1 ? (
                  "Finalizar"
                ) : (
                  <>
                    Próxima
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
