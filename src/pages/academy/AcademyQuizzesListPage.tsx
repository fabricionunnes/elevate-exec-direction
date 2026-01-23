import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  quiz_type: string;
  min_score: number;
  max_attempts: number | null;
  track_name: string | null;
  user_attempts: number;
  best_score: number | null;
  passed: boolean;
}

export const AcademyQuizzesListPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, [userContext]);

  const loadQuizzes = async () => {
    try {
      const { data: quizzesData } = await supabase
        .from("academy_quizzes")
        .select(`
          id, title, description, quiz_type, min_score, max_attempts,
          academy_tracks(name)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (quizzesData && userContext.onboardingUserId) {
        const quizzesWithAttempts = await Promise.all(
          quizzesData.map(async (quiz) => {
            const { data: attempts } = await supabase
              .from("academy_quiz_attempts")
              .select("score, passed")
              .eq("quiz_id", quiz.id)
              .eq("onboarding_user_id", userContext.onboardingUserId!)
              .order("score", { ascending: false });

            return {
              id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              quiz_type: quiz.quiz_type,
              min_score: quiz.min_score,
              max_attempts: quiz.max_attempts,
              track_name: (quiz.academy_tracks as any)?.name || null,
              user_attempts: attempts?.length || 0,
              best_score: attempts?.[0]?.score || null,
              passed: attempts?.some((a) => a.passed) || false,
            };
          })
        );

        setQuizzes(quizzesWithAttempts);
      } else if (quizzesData) {
        setQuizzes(
          quizzesData.map((q) => ({
            id: q.id,
            title: q.title,
            description: q.description,
            quiz_type: q.quiz_type,
            min_score: q.min_score,
            max_attempts: q.max_attempts,
            track_name: (q.academy_tracks as any)?.name || null,
            user_attempts: 0,
            best_score: null,
            passed: false,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getQuizTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      track_final: "Prova Final",
      module: "Prova de Módulo",
      lesson: "Quiz de Aula",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Provas & Avaliações</h1>
        <p className="text-muted-foreground mt-1">
          Teste seus conhecimentos e ganhe pontos
        </p>
      </div>

      <div className="grid gap-4">
        {quizzes.map((quiz) => (
          <Card
            key={quiz.id}
            className={quiz.passed ? "border-green-200 bg-green-50/50" : ""}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      quiz.passed ? "bg-green-100" : "bg-primary/10"
                    }`}
                  >
                    {quiz.passed ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <ClipboardCheck className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{quiz.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{getQuizTypeLabel(quiz.quiz_type)}</Badge>
                      {quiz.track_name && (
                        <Badge variant="secondary">{quiz.track_name}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Nota mínima: {quiz.min_score}%
                      {quiz.max_attempts && ` • Máx. ${quiz.max_attempts} tentativas`}
                      {quiz.user_attempts > 0 && (
                        <> • {quiz.user_attempts} tentativa(s)</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {quiz.best_score !== null && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Melhor nota</p>
                      <p
                        className={`text-xl font-bold ${
                          quiz.passed ? "text-green-600" : ""
                        }`}
                      >
                        {quiz.best_score}%
                      </p>
                    </div>
                  )}

                  <Button asChild>
                    <Link to={`/academy/quiz/${quiz.id}`}>
                      {quiz.passed ? "Revisar" : quiz.user_attempts > 0 ? "Tentar novamente" : "Fazer prova"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {quizzes.length === 0 && (
          <Card className="p-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma prova disponível</h3>
            <p className="text-muted-foreground">
              Complete aulas para desbloquear provas de avaliação.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/academy/tracks">Ver trilhas</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AcademyQuizzesListPage;
