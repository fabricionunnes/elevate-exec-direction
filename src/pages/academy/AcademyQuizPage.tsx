import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "./AcademyLayout";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  quiz_type: string;
  min_score: number;
  max_attempts: number | null;
  time_limit_minutes: number | null;
  randomize_questions: boolean;
  points_on_pass: number;
  track_id: string | null;
  track_name: string | null;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: { text: string; isCorrect: boolean }[];
  points: number;
}

interface Answer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  points: number;
}

export const AcademyQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const userContext = useOutletContext<AcademyUserContext>();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [previousAttempts, setPreviousAttempts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    points: number;
    correctAnswers: number;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  useEffect(() => {
    if (quizId) loadQuiz();
  }, [quizId, userContext]);

  useEffect(() => {
    if (!started || !timeRemaining) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [started, timeRemaining]);

  const loadQuiz = async () => {
    try {
      // Load quiz
      const { data: quizData } = await supabase
        .from("academy_quizzes")
        .select(`
          *,
          academy_tracks(id, name)
        `)
        .eq("id", quizId)
        .single();

      if (!quizData) {
        navigate("/academy/quizzes");
        return;
      }

      const track = quizData.academy_tracks as any;
      setQuiz({
        id: quizData.id,
        title: quizData.title,
        description: quizData.description,
        quiz_type: quizData.quiz_type,
        min_score: quizData.min_score,
        max_attempts: quizData.max_attempts,
        time_limit_minutes: quizData.time_limit_minutes,
        randomize_questions: quizData.randomize_questions,
        points_on_pass: quizData.points_on_pass,
        track_id: track?.id || null,
        track_name: track?.name || null,
      });

      // Load questions
      let questionsQuery = supabase
        .from("academy_quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("is_approved", true);

      if (!quizData.randomize_questions) {
        questionsQuery = questionsQuery.order("sort_order", { ascending: true });
      }

      const { data: questionsData } = await questionsQuery;

      let loadedQuestions = (questionsData || []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: (q.options as any) || [],
        points: q.points,
      }));

      // Randomize if enabled
      if (quizData.randomize_questions) {
        loadedQuestions = loadedQuestions.sort(() => Math.random() - 0.5);
      }

      setQuestions(loadedQuestions);

      // Check previous attempts
      if (userContext.onboardingUserId) {
        const { count } = await supabase
          .from("academy_quiz_attempts")
          .select("id", { count: "exact" })
          .eq("quiz_id", quizId)
          .eq("onboarding_user_id", userContext.onboardingUserId);

        setPreviousAttempts(count || 0);
        setAttemptNumber((count || 0) + 1);
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setStarted(true);
    if (quiz?.time_limit_minutes) {
      setTimeRemaining(quiz.time_limit_minutes * 60);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      newAnswers.set(questionId, answer);
      return newAnswers;
    });
  };

  const handleSubmit = async () => {
    if (!quiz || !userContext.onboardingUserId) return;

    setShowConfirmSubmit(false);
    setFinished(true);

    try {
      // Calculate results
      let totalPoints = 0;
      let maxPoints = 0;
      let correctAnswers = 0;

      const answerResults: Answer[] = questions.map((question) => {
        const userAnswer = answers.get(question.id) || "";
        const isCorrect = question.options.find(
          (opt) => opt.text === userAnswer && opt.isCorrect
        );

        maxPoints += question.points;
        if (isCorrect) {
          totalPoints += question.points;
          correctAnswers++;
        }

        return {
          questionId: question.id,
          answer: userAnswer,
          isCorrect: !!isCorrect,
          points: isCorrect ? question.points : 0,
        };
      });

      const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
      const passed = score >= quiz.min_score;

      // Save attempt
      await supabase.from("academy_quiz_attempts").insert([{
        onboarding_user_id: userContext.onboardingUserId,
        quiz_id: quiz.id,
        answers: answerResults as any,
        score,
        total_points: totalPoints,
        max_points: maxPoints,
        passed,
        completed_at: new Date().toISOString(),
        time_taken_seconds: quiz.time_limit_minutes
          ? quiz.time_limit_minutes * 60 - (timeRemaining || 0)
          : null,
        attempt_number: attemptNumber,
      }]);

      // Award points if passed
      let earnedPoints = 0;
      if (passed) {
        earnedPoints = quiz.points_on_pass;
        
        // Bonus for perfect score
        if (score === 100) {
          earnedPoints += 25;
        }

        await supabase.from("academy_points_ledger").insert([{
          onboarding_user_id: userContext.onboardingUserId,
          points: earnedPoints,
          action_type: "quiz_pass",
          description: `Prova aprovada: ${quiz.title} (${score}%)`,
          reference_id: quiz.id,
          reference_type: "quiz",
        }]);
      }

      setResult({
        score,
        passed,
        points: earnedPoints,
        correctAnswers,
      });

      if (passed) {
        toast.success(`Parabéns! Você passou com ${score}%!`);
      } else {
        toast.error(`Você não atingiu a nota mínima de ${quiz.min_score}%`);
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Erro ao enviar prova");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = answers.size;
  const canRetry =
    quiz?.max_attempts === null || previousAttempts < quiz.max_attempts;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Prova não encontrada</h3>
          <Button asChild>
            <Link to="/academy/quizzes">Voltar às provas</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Show results
  if (finished && result) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card className={result.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          <CardContent className="pt-8 pb-8 text-center">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
              result.passed ? "bg-green-100" : "bg-red-100"
            }`}>
              {result.passed ? (
                <Trophy className="h-10 w-10 text-green-600" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600" />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {result.passed ? "Parabéns!" : "Não foi dessa vez"}
            </h2>

            <p className="text-muted-foreground mb-6">
              {result.passed
                ? "Você passou na prova!"
                : `Você não atingiu a nota mínima de ${quiz.min_score}%`}
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-3xl font-bold text-primary">{result.score}%</p>
                <p className="text-sm text-muted-foreground">Sua nota</p>
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {result.correctAnswers}/{questions.length}
                </p>
                <p className="text-sm text-muted-foreground">Acertos</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">+{result.points}</p>
                <p className="text-sm text-muted-foreground">Pontos</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              {!result.passed && canRetry && (
                <Button onClick={() => window.location.reload()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to={quiz.track_id ? `/academy/track/${quiz.track_id}` : "/academy/quizzes"}>
                  Voltar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show start screen
  if (!started) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" asChild>
          <Link to={quiz.track_id ? `/academy/track/${quiz.track_id}` : "/academy/quizzes"}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
            {quiz.description && (
              <p className="text-muted-foreground">{quiz.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Questões</p>
                <p className="text-2xl font-bold">{questions.length}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Nota mínima</p>
                <p className="text-2xl font-bold">{quiz.min_score}%</p>
              </div>
              {quiz.time_limit_minutes && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Tempo limite</p>
                  <p className="text-2xl font-bold">{quiz.time_limit_minutes} min</p>
                </div>
              )}
              {quiz.max_attempts && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Tentativas</p>
                  <p className="text-2xl font-bold">
                    {previousAttempts}/{quiz.max_attempts}
                  </p>
                </div>
              )}
            </div>

            {!canRetry ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">
                  Você atingiu o número máximo de tentativas.
                </p>
              </div>
            ) : (
              <Button onClick={handleStart} className="w-full" size="lg">
                Iniciar Prova
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show quiz
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            Questão {currentQuestionIndex + 1} de {questions.length}
          </p>
        </div>
        {timeRemaining !== null && (
          <Badge
            variant={timeRemaining < 60 ? "destructive" : "secondary"}
            className="text-lg px-4 py-2"
          >
            <Clock className="h-4 w-4 mr-2" />
            {formatTime(timeRemaining)}
          </Badge>
        )}
      </div>

      {/* Progress */}
      <Progress
        value={((currentQuestionIndex + 1) / questions.length) * 100}
        className="h-2"
      />

      {/* Question */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-lg font-medium mb-6">{currentQuestion.question_text}</p>

          <RadioGroup
            value={answers.get(currentQuestion.id) || ""}
            onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
          >
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                    answers.get(currentQuestion.id) === option.text
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <RadioGroupItem value={option.text} id={`option-${index}`} />
                  <Label
                    htmlFor={`option-${index}`}
                    className="flex-1 cursor-pointer"
                  >
                    {option.text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>

        <p className="text-sm text-muted-foreground">
          {answeredCount} de {questions.length} respondidas
        </p>

        {currentQuestionIndex < questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
          >
            Próxima
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => setShowConfirmSubmit(true)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizar
          </Button>
        )}
      </div>

      {/* Confirm Submit Dialog */}
      <AlertDialog open={showConfirmSubmit} onOpenChange={setShowConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar prova?</AlertDialogTitle>
            <AlertDialogDescription>
              Você respondeu {answeredCount} de {questions.length} questões.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-amber-600">
                  Atenção: Você ainda tem {questions.length - answeredCount} questões
                  sem resposta.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Confirmar e Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AcademyQuizPage;
