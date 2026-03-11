import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Route, FileText, BookOpen, ClipboardCheck, Trophy, MessageSquare, Send, User, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Participant {
  id: string;
  full_name: string;
  email: string | null;
  cohort_id: string;
  cohort_name?: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  due_days: number | null;
  support_material_url: string | null;
}

interface Submission {
  id: string;
  task_id: string;
  response_text: string | null;
  ai_score: number | null;
  ai_feedback: string | null;
  status: string;
  submitted_at: string;
}

interface Assessment {
  id: string;
  title: string;
  assessment_type: string;
  questions: { id: string; question_text: string; category: string; options: string[] | null; correct_option: string | null; sort_order: number }[];
}

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  post_type: string;
  created_at: string;
  participant_name?: string;
  comments_count: number;
}

export default function PDIParticipantPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [completedAssessments, setCompletedAssessments] = useState<string[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [submissionText, setSubmissionText] = useState<Record<string, string>>({});
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  const [activeAssessment, setActiveAssessment] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Community
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostType, setNewPostType] = useState("discussion");

  const fetchParticipant = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.from("pdi_participants")
      .select("*").eq("access_token", token).maybeSingle();
    if (!data) { setLoading(false); return; }
    const { data: cohort } = await supabase.from("pdi_cohorts")
      .select("name").eq("id", (data as any).cohort_id).maybeSingle();
    setParticipant({ ...(data as any), cohort_name: (cohort as any)?.name || "—" });
    return data as any;
  }, [token]);

  const fetchTasks = useCallback(async (participantData: any) => {
    if (!participantData) return;
    // Get tracks for cohort (all active tracks for now)
    const { data: tasksData } = await supabase.from("pdi_tasks").select("*").eq("is_active", true).order("sort_order");
    setTasks((tasksData as any[]) || []);
    const { data: subsData } = await supabase.from("pdi_task_submissions")
      .select("*").eq("participant_id", participantData.id).order("submitted_at", { ascending: false });
    setSubmissions((subsData as any[]) || []);
  }, []);

  const fetchAssessments = useCallback(async (participantData: any) => {
    if (!participantData) return;
    const { data: aData } = await supabase.from("pdi_assessments")
      .select("id, title, assessment_type").eq("is_active", true);
    const assessmentsList = (aData as any[]) || [];
    const withQuestions = await Promise.all(assessmentsList.map(async (a) => {
      const { data: qData } = await supabase.from("pdi_assessment_questions")
        .select("*").eq("assessment_id", a.id).order("sort_order");
      return { ...a, questions: (qData as any[]) || [] };
    }));
    setAssessments(withQuestions);
    const { data: respData } = await supabase.from("pdi_assessment_responses")
      .select("assessment_id").eq("participant_id", participantData.id);
    setCompletedAssessments(((respData as any[]) || []).map((r) => r.assessment_id));
  }, []);

  const fetchCommunity = useCallback(async (participantData: any) => {
    if (!participantData) return;
    const { data: postsData } = await supabase.from("pdi_community_posts")
      .select("*").eq("cohort_id", participantData.cohort_id).order("created_at", { ascending: false }).limit(20);
    const { data: partsData } = await supabase.from("pdi_participants").select("id, full_name");
    const pMap = new Map(((partsData as any[]) || []).map((p) => [p.id, p.full_name]));
    const { data: commentsData } = await supabase.from("pdi_community_comments").select("post_id");
    const commentCounts = new Map<string, number>();
    ((commentsData as any[]) || []).forEach((c) => {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
    });
    setPosts(((postsData as any[]) || []).map((p) => ({
      ...p, participant_name: pMap.get(p.participant_id) || "—",
      comments_count: commentCounts.get(p.id) || 0,
    })));
  }, []);

  useEffect(() => {
    const init = async () => {
      const p = await fetchParticipant();
      if (p) {
        await Promise.all([fetchTasks(p), fetchAssessments(p), fetchCommunity(p)]);
      }
      setLoading(false);
    };
    init();
  }, [fetchParticipant, fetchTasks, fetchAssessments, fetchCommunity]);

  const submitTask = async (taskId: string) => {
    if (!participant || !submissionText[taskId]?.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("pdi_task_submissions").insert({
      task_id: taskId, participant_id: participant.id,
      response_text: submissionText[taskId], status: "submitted",
    });
    setSaving(false);
    if (error) { toast.error("Erro ao enviar"); return; }
    toast.success("Tarefa enviada! A IA irá avaliar seu resumo.");

    // Trigger AI evaluation
    try {
      await supabase.functions.invoke("pdi-evaluate-summary", {
        body: { participant_id: participant.id, task_id: taskId, text: submissionText[taskId] },
      });
    } catch { /* AI evaluation runs async */ }

    setSubmissionText({ ...submissionText, [taskId]: "" });
    fetchTasks(participant);
  };

  const submitAssessment = async (assessmentId: string) => {
    if (!participant) return;
    const assessment = assessments.find((a) => a.id === assessmentId);
    if (!assessment) return;

    // Calculate score
    let correct = 0;
    const categoryScores: Record<string, { correct: number; total: number }> = {};
    assessment.questions.forEach((q) => {
      if (!categoryScores[q.category]) categoryScores[q.category] = { correct: 0, total: 0 };
      categoryScores[q.category].total++;
      const answer = assessmentAnswers[q.id];
      if (answer === q.correct_option) {
        correct++;
        categoryScores[q.category].correct++;
      }
    });
    const totalScore = assessment.questions.length > 0 ? Math.round((correct / assessment.questions.length) * 100) : 0;
    const catScoresFormatted: Record<string, number> = {};
    Object.entries(categoryScores).forEach(([cat, vals]) => {
      catScoresFormatted[cat] = vals.total > 0 ? Math.round((vals.correct / vals.total) * 100) : 0;
    });

    await supabase.from("pdi_assessment_responses").insert({
      assessment_id: assessmentId, participant_id: participant.id,
      answers: assessmentAnswers, total_score: totalScore,
      category_scores: catScoresFormatted,
    });

    toast.success(`Teste concluído! Score: ${totalScore}%`);
    setActiveAssessment(null);
    setAssessmentAnswers({});
    fetchAssessments(participant);
  };

  const createPost = async () => {
    if (!participant || !newPostTitle.trim() || !newPostContent.trim()) return;
    await supabase.from("pdi_community_posts").insert({
      participant_id: participant.id, cohort_id: participant.cohort_id,
      title: newPostTitle, content: newPostContent, post_type: newPostType,
    });
    toast.success("Publicação criada!");
    setNewPostTitle(""); setNewPostContent(""); setNewPostType("discussion");
    fetchCommunity(participant);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!participant) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
        <p className="text-muted-foreground">Link de acesso inválido.</p>
      </CardContent></Card>
    </div>
  );

  const taskSubmissionMap = new Map(submissions.map((s) => [s.task_id, s]));
  const completedTasksCount = submissions.filter((s) => s.status !== "pending").length;
  const totalProgress = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Meu PDI</h1>
          <p className="text-sm text-muted-foreground">{participant.full_name} • {participant.cohort_name}</p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Progresso Geral</span>
              <span className="text-sm font-bold text-primary">{totalProgress}%</span>
            </div>
            <Progress value={totalProgress} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1">{completedTasksCount} de {tasks.length} tarefas concluídas</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="tasks">Tarefas</TabsTrigger>
            <TabsTrigger value="assessments">Testes</TabsTrigger>
            <TabsTrigger value="community">Comunidade</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-3 mt-4">
            {tasks.map((task) => {
              const sub = taskSubmissionMap.get(task.id);
              return (
                <Card key={task.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">{task.title}</h3>
                      </div>
                      {sub && (
                        <Badge variant={sub.status === "submitted" ? "secondary" : sub.ai_score ? "default" : "outline"}>
                          {sub.status === "submitted" ? "Enviado" : sub.ai_score ? `Nota: ${sub.ai_score}` : sub.status}
                        </Badge>
                      )}
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                    {task.support_material_url && (
                      <a href={task.support_material_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Material de Apoio →
                      </a>
                    )}
                    {sub?.ai_feedback && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-medium text-foreground mb-1">Feedback da IA:</p>
                        <p className="text-xs text-muted-foreground">{sub.ai_feedback}</p>
                      </div>
                    )}
                    {!sub && (
                      <div className="space-y-2">
                        <Textarea
                          value={submissionText[task.id] || ""}
                          onChange={(e) => setSubmissionText({ ...submissionText, [task.id]: e.target.value })}
                          placeholder="Escreva seu resumo ou resposta..."
                          rows={3}
                        />
                        <Button size="sm" onClick={() => submitTask(task.id)} disabled={saving}>
                          <Send className="h-3 w-3 mr-1" />Enviar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {tasks.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma tarefa disponível.</p>}
          </TabsContent>

          {/* Assessments Tab */}
          <TabsContent value="assessments" className="space-y-3 mt-4">
            {activeAssessment ? (
              (() => {
                const assessment = assessments.find((a) => a.id === activeAssessment);
                if (!assessment) return null;
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{assessment.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {assessment.questions.map((q, i) => (
                        <div key={q.id} className="space-y-2">
                          <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                          {q.options && (q.options as string[]).map((opt, idx) => (
                            <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name={q.id}
                                checked={assessmentAnswers[q.id] === String(idx)}
                                onChange={() => setAssessmentAnswers({ ...assessmentAnswers, [q.id]: String(idx) })}
                                className="accent-primary"
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button onClick={() => submitAssessment(activeAssessment)}>Finalizar Teste</Button>
                        <Button variant="outline" onClick={() => { setActiveAssessment(null); setAssessmentAnswers({}); }}>Cancelar</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()
            ) : (
              assessments.map((a) => {
                const isCompleted = completedAssessments.includes(a.id);
                return (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-primary" />
                          <div>
                            <h3 className="font-semibold text-sm">{a.title}</h3>
                            <Badge variant={a.assessment_type === "entry" ? "default" : "secondary"} className="text-[10px]">
                              {a.assessment_type === "entry" ? "Entrada" : "Saída"}
                            </Badge>
                          </div>
                        </div>
                        {isCompleted ? (
                          <Badge variant="outline" className="text-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>
                        ) : (
                          <Button size="sm" onClick={() => setActiveAssessment(a.id)}>Iniciar Teste</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
            {assessments.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum teste disponível.</p>}
          </TabsContent>

          {/* Community Tab */}
          <TabsContent value="community" className="space-y-4 mt-4">
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm">Nova Publicação</p>
                <Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Título" />
                <Textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="Compartilhe..." rows={3} />
                <div className="flex items-center gap-2">
                  <Select value={newPostType} onValueChange={setNewPostType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discussion">Discussão</SelectItem>
                      <SelectItem value="experience">Experiência</SelectItem>
                      <SelectItem value="question">Pergunta</SelectItem>
                      <SelectItem value="learning">Aprendizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={createPost} disabled={!newPostTitle.trim()}>Publicar</Button>
                </div>
              </CardContent>
            </Card>
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm">{post.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{post.content}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                    <span>{post.participant_name}</span>
                    <span>{format(new Date(post.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                    <span>{post.comments_count} comentários</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{participant.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{participant.email || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Turma:</span> <span className="font-medium">{participant.cohort_name}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="default">{participant.status === "active" ? "Ativo" : participant.status}</Badge></div>
                  <div><span className="text-muted-foreground">Tarefas:</span> <span className="font-medium">{completedTasksCount}/{tasks.length}</span></div>
                  <div><span className="text-muted-foreground">Testes:</span> <span className="font-medium">{completedAssessments.length}/{assessments.length}</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
