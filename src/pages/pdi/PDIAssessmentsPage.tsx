import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ClipboardCheck, Trash2 } from "lucide-react";

interface Assessment {
  id: string;
  cohort_id: string | null;
  title: string;
  description: string | null;
  assessment_type: string;
  is_active: boolean;
  cohort_name?: string;
}

interface Question {
  id: string;
  assessment_id: string;
  question_text: string;
  category: string;
  options: any;
  correct_option: string | null;
  sort_order: number;
}

const CATEGORIES = [
  { value: "leadership", label: "Liderança" },
  { value: "communication", label: "Comunicação" },
  { value: "mindset", label: "Mentalidade" },
  { value: "management", label: "Gestão" },
  { value: "sales", label: "Vendas" },
  { value: "general", label: "Geral" },
];

export default function PDIAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", assessment_type: "entry", cohort_id: "",
  });
  const [qForm, setQForm] = useState({
    question_text: "", category: "general",
    options: ["", "", "", ""], correct_option: "0",
  });

  const fetchData = useCallback(async () => {
    const [aRes, cRes] = await Promise.all([
      supabase.from("pdi_assessments").select("*").order("created_at", { ascending: false }),
      supabase.from("pdi_cohorts").select("id, name").order("name"),
    ]);
    const cohortsList = (cRes.data as any[]) || [];
    setCohorts(cohortsList);
    const cMap = new Map(cohortsList.map((c) => [c.id, c.name]));
    setAssessments(((aRes.data as any[]) || []).map((a) => ({ ...a, cohort_name: a.cohort_id ? cMap.get(a.cohort_id) || "—" : "Global" })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateAssessment = async () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    await supabase.from("pdi_assessments").insert({
      title: form.title, description: form.description || null,
      assessment_type: form.assessment_type,
      cohort_id: form.cohort_id || null,
    });
    setSaving(false);
    toast.success("Teste criado!");
    setDialogOpen(false);
    setForm({ title: "", description: "", assessment_type: "entry", cohort_id: "" });
    fetchData();
  };

  const openQuestions = async (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    const { data } = await supabase.from("pdi_assessment_questions")
      .select("*").eq("assessment_id", assessment.id).order("sort_order");
    setQuestions((data as any[]) || []);
    setQuestionsDialogOpen(true);
  };

  const handleAddQuestion = async () => {
    if (!qForm.question_text.trim() || !selectedAssessment) return;
    const opts = qForm.options.filter(Boolean);
    await supabase.from("pdi_assessment_questions").insert({
      assessment_id: selectedAssessment.id,
      question_text: qForm.question_text,
      category: qForm.category,
      options: opts.length > 0 ? opts : null,
      correct_option: opts.length > 0 ? qForm.correct_option : null,
      sort_order: questions.length,
    });
    toast.success("Pergunta adicionada!");
    setQForm({ question_text: "", category: "general", options: ["", "", "", ""], correct_option: "0" });
    openQuestions(selectedAssessment);
  };

  const deleteQuestion = async (qId: string) => {
    await supabase.from("pdi_assessment_questions").delete().eq("id", qId);
    if (selectedAssessment) openQuestions(selectedAssessment);
    toast.success("Pergunta removida");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Testes de Avaliação</h1>
          <p className="text-sm text-muted-foreground">Testes de entrada e saída para medir evolução</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Novo Teste
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : assessments.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhum teste criado.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => (
            <Card key={a.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{a.title}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant={a.assessment_type === "entry" ? "default" : "secondary"}>
                          {a.assessment_type === "entry" ? "Entrada" : "Saída"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{a.cohort_name}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                <Button variant="outline" size="sm" className="w-full" onClick={() => openQuestions(a)}>
                  Gerenciar Perguntas
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Assessment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Teste</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.assessment_type} onValueChange={(v) => setForm({ ...form, assessment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Teste de Entrada</SelectItem>
                    <SelectItem value="exit">Teste de Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Turma</Label>
                <Select value={form.cohort_id || "__global__"} onValueChange={(v) => setForm({ ...form, cohort_id: v === "__global__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global</SelectItem>
                    {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreateAssessment} disabled={saving} className="w-full">
              {saving ? "Criando..." : "Criar Teste"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
      <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Perguntas — {selectedAssessment?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <Card key={q.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {CATEGORIES.find((c) => c.value === q.category)?.label || q.category}
                      </Badge>
                      {q.options && (
                        <div className="mt-1 space-y-0.5">
                          {(q.options as string[]).map((opt, idx) => (
                            <p key={idx} className={`text-xs ${String(idx) === q.correct_option ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                              {String.fromCharCode(65 + idx)}) {opt}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteQuestion(q.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm">Adicionar Pergunta</p>
                <div><Label>Pergunta</Label><Textarea value={qForm.question_text} onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })} /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={qForm.category} onValueChange={(v) => setQForm({ ...qForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Opções de Resposta</Label>
                  {qForm.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-5">{String.fromCharCode(65 + idx)})</span>
                      <Input value={opt} onChange={(e) => {
                        const newOpts = [...qForm.options];
                        newOpts[idx] = e.target.value;
                        setQForm({ ...qForm, options: newOpts });
                      }} placeholder={`Opção ${String.fromCharCode(65 + idx)}`} className="flex-1" />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Resposta Correta</Label>
                  <Select value={qForm.correct_option} onValueChange={(v) => setQForm({ ...qForm, correct_option: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {qForm.options.map((_, idx) => (
                        <SelectItem key={idx} value={String(idx)}>Opção {String.fromCharCode(65 + idx)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddQuestion} className="w-full">Adicionar Pergunta</Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
