import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, X } from "lucide-react";

interface Question {
  id: string;
  form_id: string;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export const PipelineFormQuestionsManager = ({ formId }: { formId: string }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [newType, setNewType] = useState<"open" | "closed">("open");
  const [newOptions, setNewOptions] = useState<string[]>([""]);
  const [newRequired, setNewRequired] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [formId]);

  const loadQuestions = async () => {
    const { data } = await supabase
      .from("crm_pipeline_form_questions" as any)
      .select("*")
      .eq("form_id", formId)
      .order("sort_order", { ascending: true });
    setQuestions((data as any[]) || []);
    setLoading(false);
  };

  const addQuestion = async () => {
    if (!newQuestion.trim()) return;
    if (newType === "closed" && newOptions.filter((o) => o.trim()).length < 2) {
      toast.error("Adicione pelo menos 2 opções");
      return;
    }

    const { error } = await supabase.from("crm_pipeline_form_questions" as any).insert({
      form_id: formId,
      question_text: newQuestion.trim(),
      question_type: newType,
      options: newType === "closed" ? newOptions.filter((o) => o.trim()) : [],
      is_required: newRequired,
      sort_order: questions.length,
    } as any);

    if (error) {
      console.error("Error creating question:", error);
      toast.error("Erro ao criar pergunta: " + error.message);
      return;
    }

    toast.success("Pergunta criada!");
    setNewQuestion("");
    setNewType("open");
    setNewOptions([""]);
    setNewRequired(false);
    loadQuestions();
  };

  const toggleQuestion = async (id: string, isActive: boolean) => {
    await supabase.from("crm_pipeline_form_questions" as any).update({ is_active: isActive } as any).eq("id", id);
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: isActive } : q)));
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from("crm_pipeline_form_questions" as any).delete().eq("id", id);
    toast.success("Pergunta removida");
    loadQuestions();
  };

  if (loading) return <div className="h-10 bg-muted rounded animate-pulse" />;

  return (
    <div className="space-y-4 mt-3 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Perguntas personalizadas (Etapa 2)</p>

      {questions.map((q) => (
        <div key={q.id} className="flex items-start gap-2 p-2 border rounded-lg bg-muted/30">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">{q.question_text}</span>
              <Badge variant="outline" className="text-[10px]">
                {q.question_type === "open" ? "Aberta" : "Fechada"}
              </Badge>
              {q.is_required && (
                <Badge variant="secondary" className="text-[10px]">Obrigatória</Badge>
              )}
            </div>
            {q.question_type === "closed" && q.options?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {q.options.map((opt: string, i: number) => (
                  <span key={i} className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{opt}</span>
                ))}
              </div>
            )}
          </div>
          <Switch
            checked={q.is_active}
            onCheckedChange={(v) => toggleQuestion(q.id, v)}
            className="flex-shrink-0"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => deleteQuestion(q.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}

      {/* Add new question */}
      <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Nova pergunta</Label>
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ex: Qual seu faturamento mensal?"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={newType} onValueChange={(v) => setNewType(v as "open" | "closed")}>
              <SelectTrigger className="h-8 text-sm w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="closed">Fechada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Switch checked={newRequired} onCheckedChange={setNewRequired} />
            <span className="text-xs">Obrigatória</span>
          </div>
        </div>

        {newType === "closed" && (
          <div className="space-y-2">
            <Label className="text-xs">Opções de resposta</Label>
            {newOptions.map((opt, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const updated = [...newOptions];
                    updated[i] = e.target.value;
                    setNewOptions(updated);
                  }}
                  placeholder={`Opção ${i + 1}`}
                  className="h-7 text-sm"
                />
                {newOptions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setNewOptions([...newOptions, ""])}
            >
              <Plus className="h-3 w-3 mr-1" /> Opção
            </Button>
          </div>
        )}

        <Button size="sm" onClick={addQuestion} disabled={!newQuestion.trim()} className="h-8">
          <Plus className="h-3 w-3 mr-1" /> Adicionar pergunta
        </Button>
      </div>
    </div>
  );
};
