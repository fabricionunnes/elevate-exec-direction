import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  ClipboardCheck,
  Sparkles,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";

interface Track {
  id: string;
  name: string;
}

interface Lesson {
  id: string;
  title: string;
  track_id: string;
  transcript: string | null;
}

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
  is_active: boolean;
  track_id: string | null;
  lesson_id: string | null;
  track_name: string | null;
  lesson_title: string | null;
  questions_count: number;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: { text: string; isCorrect: boolean }[];
  correct_answer: string | null;
  explanation: string | null;
  difficulty: string;
  points: number;
  is_ai_generated: boolean;
  is_approved: boolean;
}

export const AcademyAdminQuizzesPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Quiz dialog
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    quiz_type: "track_final",
    min_score: 70,
    max_attempts: 3,
    time_limit_minutes: null as number | null,
    randomize_questions: true,
    points_on_pass: 50,
    is_active: true,
    track_id: null as string | null,
    lesson_id: null as string | null,
  });

  // Questions dialog
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Question form
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    question_type: "multiple_choice",
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    explanation: "",
    difficulty: "medium",
    points: 10,
    is_approved: true,
  });

  // AI Generation
  const [generatingAI, setGeneratingAI] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "quiz" | "question"; id: string; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load tracks
      const { data: tracksData } = await supabase
        .from("academy_tracks")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setTracks(tracksData || []);

      // Load lessons
      const { data: lessonsData } = await supabase
        .from("academy_lessons")
        .select("id, title, track_id, transcript")
        .eq("is_active", true)
        .order("title");

      setLessons(lessonsData || []);

      // Load quizzes
      const { data: quizzesData } = await supabase
        .from("academy_quizzes")
        .select(`
          *,
          academy_tracks(name),
          academy_lessons(title),
          academy_quiz_questions(id)
        `)
        .order("created_at", { ascending: false });

      if (quizzesData) {
        setQuizzes(
          quizzesData.map((q) => ({
            ...q,
            track_name: (q.academy_tracks as any)?.name || null,
            lesson_title: (q.academy_lessons as any)?.title || null,
            questions_count: (q.academy_quiz_questions as any[]).length,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setQuestionsDialogOpen(true);
    setLoadingQuestions(true);

    try {
      const { data } = await supabase
        .from("academy_quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("sort_order");

      setQuestions(
        (data || []).map((q) => ({
          ...q,
          options: (q.options as any) || [],
        }))
      );
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleQuizSubmit = async () => {
    try {
      const quizData = {
        ...quizForm,
        time_limit_minutes: quizForm.time_limit_minutes || null,
      };

      if (editingQuiz) {
        await supabase.from("academy_quizzes").update(quizData).eq("id", editingQuiz.id);
        toast.success("Prova atualizada!");
      } else {
        await supabase.from("academy_quizzes").insert(quizData);
        toast.success("Prova criada!");
      }

      setQuizDialogOpen(false);
      setEditingQuiz(null);
      resetQuizForm();
      loadData();
    } catch (error) {
      console.error("Error saving quiz:", error);
      toast.error("Erro ao salvar prova");
    }
  };

  const handleQuestionSubmit = async () => {
    if (!selectedQuiz) return;

    try {
      // Ensure at least one correct option for multiple choice
      if (questionForm.question_type === "multiple_choice") {
        const hasCorrect = questionForm.options.some((o) => o.isCorrect);
        if (!hasCorrect) {
          toast.error("Marque pelo menos uma opção como correta");
          return;
        }
      }

      const questionData = {
        quiz_id: selectedQuiz.id,
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        options: questionForm.options.filter((o) => o.text.trim()),
        explanation: questionForm.explanation || null,
        difficulty: questionForm.difficulty,
        points: questionForm.points,
        is_approved: questionForm.is_approved,
        is_ai_generated: false,
        sort_order: questions.length + 1,
      };

      if (editingQuestion) {
        await supabase
          .from("academy_quiz_questions")
          .update(questionData)
          .eq("id", editingQuestion.id);
        toast.success("Questão atualizada!");
      } else {
        await supabase.from("academy_quiz_questions").insert(questionData);
        toast.success("Questão criada!");
      }

      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      resetQuestionForm();
      loadQuestions(selectedQuiz);
      loadData();
    } catch (error) {
      console.error("Error saving question:", error);
      toast.error("Erro ao salvar questão");
    }
  };

  const handleGenerateWithAI = async () => {
    if (!selectedQuiz) return;

    // Find lesson transcript for context
    let context = "";
    if (selectedQuiz.lesson_id) {
      const lesson = lessons.find((l) => l.id === selectedQuiz.lesson_id);
      context = lesson?.transcript || "";
    }

    if (!context) {
      toast.error("A aula não possui transcrição para gerar questões");
      return;
    }

    setGeneratingAI(true);

    try {
      const { data, error } = await supabase.functions.invoke("academy-generate-quiz", {
        body: {
          quizId: selectedQuiz.id,
          lessonTranscript: context,
          numQuestions: 5,
        },
      });

      if (error) throw error;

      toast.success(`${data.questionsGenerated} questões geradas com IA!`);
      loadQuestions(selectedQuiz);
      loadData();
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error("Erro ao gerar questões com IA");
    } finally {
      setGeneratingAI(false);
    }
  };

  const toggleQuestionApproval = async (question: Question) => {
    try {
      await supabase
        .from("academy_quiz_questions")
        .update({ is_approved: !question.is_approved })
        .eq("id", question.id);

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === question.id ? { ...q, is_approved: !q.is_approved } : q
        )
      );
      toast.success(question.is_approved ? "Questão desaprovada" : "Questão aprovada");
    } catch (error) {
      console.error("Error toggling approval:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.type === "quiz") {
        await supabase.from("academy_quizzes").delete().eq("id", deleteConfirm.id);
        toast.success("Prova excluída!");
        loadData();
      } else {
        await supabase.from("academy_quiz_questions").delete().eq("id", deleteConfirm.id);
        toast.success("Questão excluída!");
        if (selectedQuiz) loadQuestions(selectedQuiz);
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setQuizForm({
      title: quiz.title,
      description: quiz.description || "",
      quiz_type: quiz.quiz_type,
      min_score: quiz.min_score,
      max_attempts: quiz.max_attempts || 3,
      time_limit_minutes: quiz.time_limit_minutes,
      randomize_questions: quiz.randomize_questions,
      points_on_pass: quiz.points_on_pass,
      is_active: quiz.is_active,
      track_id: quiz.track_id,
      lesson_id: quiz.lesson_id,
    });
    setQuizDialogOpen(true);
  };

  const openEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options.length >= 4 ? question.options : [
        ...question.options,
        ...Array(4 - question.options.length).fill({ text: "", isCorrect: false }),
      ],
      explanation: question.explanation || "",
      difficulty: question.difficulty,
      points: question.points,
      is_approved: question.is_approved,
    });
    setQuestionDialogOpen(true);
  };

  const resetQuizForm = () => {
    setQuizForm({
      title: "",
      description: "",
      quiz_type: "track_final",
      min_score: 70,
      max_attempts: 3,
      time_limit_minutes: null,
      randomize_questions: true,
      points_on_pass: 50,
      is_active: true,
      track_id: null,
      lesson_id: null,
    });
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: "",
      question_type: "multiple_choice",
      options: [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
      explanation: "",
      difficulty: "medium",
      points: 10,
      is_approved: true,
    });
  };

  const updateOption = (index: number, field: "text" | "isCorrect", value: string | boolean) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => {
        if (i === index) {
          return { ...opt, [field]: value };
        }
        // For single correct answer, uncheck others when one is checked
        if (field === "isCorrect" && value === true) {
          return { ...opt, isCorrect: false };
        }
        return opt;
      }),
    }));
  };

  if (!userContext.isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Acesso negado</h3>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Provas & IA</h1>
          <p className="text-muted-foreground mt-1">
            Crie provas e gere questões automaticamente com IA
          </p>
        </div>
        <Button onClick={() => { setEditingQuiz(null); resetQuizForm(); setQuizDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Prova
        </Button>
      </div>

      {/* Quizzes List */}
      <div className="grid gap-4">
        {quizzes.map((quiz) => (
          <Card key={quiz.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <ClipboardCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{quiz.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={quiz.is_active ? "default" : "secondary"}>
                        {quiz.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="outline">{quiz.quiz_type}</Badge>
                      {quiz.track_name && (
                        <span className="text-sm text-muted-foreground">
                          Trilha: {quiz.track_name}
                        </span>
                      )}
                      {quiz.lesson_title && (
                        <span className="text-sm text-muted-foreground">
                          Aula: {quiz.lesson_title}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {quiz.questions_count} questões • Nota mínima: {quiz.min_score}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadQuestions(quiz)}>
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Questões
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditQuiz(quiz)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm({ type: "quiz", id: quiz.id, name: quiz.title })}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {quizzes.length === 0 && (
          <Card className="p-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma prova criada</h3>
            <Button onClick={() => { setEditingQuiz(null); resetQuizForm(); setQuizDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar prova
            </Button>
          </Card>
        )}
      </div>

      {/* Quiz Dialog */}
      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? "Editar Prova" : "Nova Prova"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Título *</Label>
              <Input
                value={quizForm.title}
                onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={quizForm.description}
                onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trilha</Label>
                <Select
                  value={quizForm.track_id || "none"}
                  onValueChange={(v) => setQuizForm({ ...quizForm, track_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {tracks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aula (para gerar questões)</Label>
                <Select
                  value={quizForm.lesson_id || "none"}
                  onValueChange={(v) => setQuizForm({ ...quizForm, lesson_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {lessons
                      .filter((l) => !quizForm.track_id || l.track_id === quizForm.track_id)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nota mínima (%)</Label>
                <Input
                  type="number"
                  value={quizForm.min_score}
                  onChange={(e) => setQuizForm({ ...quizForm, min_score: parseInt(e.target.value) || 70 })}
                />
              </div>
              <div>
                <Label>Máximo de tentativas</Label>
                <Input
                  type="number"
                  value={quizForm.max_attempts || ""}
                  onChange={(e) => setQuizForm({ ...quizForm, max_attempts: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tempo limite (minutos)</Label>
                <Input
                  type="number"
                  value={quizForm.time_limit_minutes || ""}
                  onChange={(e) => setQuizForm({ ...quizForm, time_limit_minutes: parseInt(e.target.value) || null })}
                  placeholder="Sem limite"
                />
              </div>
              <div>
                <Label>Pontos ao passar</Label>
                <Input
                  type="number"
                  value={quizForm.points_on_pass}
                  onChange={(e) => setQuizForm({ ...quizForm, points_on_pass: parseInt(e.target.value) || 50 })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Prova ativa</Label>
                <Switch
                  checked={quizForm.is_active}
                  onCheckedChange={(v) => setQuizForm({ ...quizForm, is_active: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Randomizar questões</Label>
                <Switch
                  checked={quizForm.randomize_questions}
                  onCheckedChange={(v) => setQuizForm({ ...quizForm, randomize_questions: v })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setQuizDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleQuizSubmit} disabled={!quizForm.title}>
                {editingQuiz ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
      <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Questões: {selectedQuiz?.title}</span>
              <div className="flex gap-2">
                {selectedQuiz?.lesson_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateWithAI}
                    disabled={generatingAI}
                  >
                    {generatingAI ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Gerar com IA
                  </Button>
                )}
                <Button size="sm" onClick={() => { setEditingQuestion(null); resetQuestionForm(); setQuestionDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Questão
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {loadingQuestions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : questions.length > 0 ? (
              questions.map((question, index) => (
                <Card key={question.id} className={!question.is_approved ? "opacity-60" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <Badge variant="secondary">{question.difficulty}</Badge>
                          <Badge variant="secondary">{question.points} pts</Badge>
                          {question.is_ai_generated && (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Sparkles className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          )}
                          {!question.is_approved && (
                            <Badge variant="destructive">Não aprovada</Badge>
                          )}
                        </div>
                        <p className="font-medium">{question.question_text}</p>
                        <div className="mt-2 space-y-1">
                          {question.options.map((opt, i) => (
                            <div
                              key={i}
                              className={`text-sm flex items-center gap-2 ${
                                opt.isCorrect ? "text-green-600 font-medium" : "text-muted-foreground"
                              }`}
                            >
                              {opt.isCorrect ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              {opt.text}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleQuestionApproval(question)}
                        >
                          {question.is_approved ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditQuestion(question)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ type: "question", id: question.id, name: `Questão #${index + 1}` })}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma questão ainda</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Form Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Editar Questão" : "Nova Questão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Pergunta *</Label>
              <Textarea
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
              />
            </div>
            <div>
              <Label>Opções (marque a correta)</Label>
              <div className="space-y-2 mt-2">
                {questionForm.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox
                      checked={option.isCorrect}
                      onCheckedChange={(v) => updateOption(index, "isCorrect", !!v)}
                    />
                    <Input
                      value={option.text}
                      onChange={(e) => updateOption(index, "text", e.target.value)}
                      placeholder={`Opção ${index + 1}`}
                      className={option.isCorrect ? "border-green-500" : ""}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Explicação (mostrada após responder)</Label>
              <Textarea
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dificuldade</Label>
                <Select
                  value={questionForm.difficulty}
                  onValueChange={(v) => setQuestionForm({ ...questionForm, difficulty: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pontos</Label>
                <Input
                  type="number"
                  value={questionForm.points}
                  onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Aprovada para uso</Label>
              <Switch
                checked={questionForm.is_approved}
                onCheckedChange={(v) => setQuestionForm({ ...questionForm, is_approved: v })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleQuestionSubmit} disabled={!questionForm.question_text}>
                {editingQuestion ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteConfirm?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AcademyAdminQuizzesPage;
