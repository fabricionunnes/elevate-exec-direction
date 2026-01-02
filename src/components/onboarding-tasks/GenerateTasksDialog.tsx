import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertCircle, Check, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface GeneratedTask {
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
  responsible_role: "consultant" | "cs" | "client";
  estimated_days: number;
  selected?: boolean;
}

interface GenerateTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  companyId: string | null;
  onTasksGenerated: () => void;
}

const PHASE_ORDER: Record<string, number> = {
  "Pré-Onboarding": 0,
  "Aceleração e Fundação": 1,
  "Onboarding & Setup": 2,
  "Diagnóstico Comercial": 3,
  "Desenho do Processo": 4,
  "Implementação CRM": 5,
  "Playbook & Padronização": 6,
  "Treinamento & Adoção": 7,
  "Estabilização & Governança": 8,
  "Crescimento Contínuo": 9,
};

export const GenerateTasksDialog = ({
  open,
  onOpenChange,
  projectId,
  companyId,
  onTasksGenerated,
}: GenerateTasksDialogProps) => {
  const [step, setStep] = useState<"context" | "generating" | "review">("context");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setStep("generating");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-playbook-tasks",
        {
          body: {
            projectId,
            companyId,
            context: additionalContext,
          },
        }
      );

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      const tasks = (data.tasks || []).map((t: GeneratedTask) => ({
        ...t,
        selected: true,
      }));

      setGeneratedTasks(tasks);
      setStep("review");
    } catch (err: any) {
      console.error("Error generating tasks:", err);
      setError(err.message || "Erro ao gerar tarefas");
      setStep("context");
    }
  };

  const handleToggleTask = (index: number) => {
    setGeneratedTasks((prev) =>
      prev.map((task, i) =>
        i === index ? { ...task, selected: !task.selected } : task
      )
    );
  };

  const handleRemoveTask = (index: number) => {
    setGeneratedTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const selectedTasks = generatedTasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      toast.error("Selecione pelo menos uma tarefa");
      return;
    }

    setSaving(true);

    try {
      // Get max sort order
      const { data: existingTasks } = await supabase
        .from("onboarding_tasks")
        .select("sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let sortOrder = (existingTasks?.[0]?.sort_order || 0) + 1;

      // Create tasks
      const tasksToInsert = selectedTasks.map((task) => {
        const phaseOrder = PHASE_ORDER[task.phase] ?? 99;
        return {
          project_id: projectId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          tags: [task.phase, String(phaseOrder)],
          sort_order: sortOrder++,
          status: "pending" as const,
        };
      });

      const { error: insertError } = await supabase
        .from("onboarding_tasks")
        .insert(tasksToInsert);

      if (insertError) throw insertError;

      toast.success(`${selectedTasks.length} tarefas criadas com sucesso!`);
      onTasksGenerated();
      handleClose();
    } catch (err: any) {
      console.error("Error saving tasks:", err);
      toast.error("Erro ao salvar tarefas");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep("context");
    setAdditionalContext("");
    setGeneratedTasks([]);
    setError(null);
    onOpenChange(false);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta</Badge>;
      case "medium":
        return <Badge variant="secondary">Média</Badge>;
      case "low":
        return <Badge variant="outline">Baixa</Badge>;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "consultant":
        return <Badge className="bg-purple-500">Consultor</Badge>;
      case "cs":
        return <Badge className="bg-blue-500">CS</Badge>;
      case "client":
        return <Badge variant="outline">Cliente</Badge>;
      default:
        return null;
    }
  };

  const selectedCount = generatedTasks.filter((t) => t.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Tarefas do Playbook
          </DialogTitle>
          <DialogDescription>
            {step === "context" &&
              "A IA vai analisar o contexto do projeto e sugerir tarefas personalizadas baseadas no Playbook da UNV."}
            {step === "generating" && "Gerando tarefas personalizadas..."}
            {step === "review" &&
              "Revise as tarefas sugeridas, selecione as que deseja adicionar e clique em salvar."}
          </DialogDescription>
        </DialogHeader>

        {step === "context" && (
          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="context">Contexto adicional (opcional)</Label>
              <Textarea
                id="context"
                placeholder="Adicione informações extras que ajudarão a IA a gerar tarefas mais relevantes. Ex: 'A empresa está focada em aumentar a conversão de leads' ou 'Precisamos implementar CRM urgentemente'"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                A IA já tem acesso ao briefing da empresa e informações do
                projeto. Use este campo para dar direcionamentos específicos.
              </p>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              Analisando contexto e gerando tarefas personalizadas...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Isso pode levar alguns segundos
            </p>
          </div>
        )}

        {step === "review" && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-4">
              {generatedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma tarefa foi gerada.</p>
                  <Button
                    variant="outline"
                    onClick={() => setStep("context")}
                    className="mt-4"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                generatedTasks.map((task, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-colors ${
                      task.selected
                        ? "bg-primary/5 border-primary/20"
                        : "bg-muted/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.selected}
                        onCheckedChange={() => handleToggleTask(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{task.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {task.phase}
                          </Badge>
                          {getPriorityBadge(task.priority)}
                          {getRoleBadge(task.responsible_role)}
                          {task.estimated_days && (
                            <span className="text-xs text-muted-foreground">
                              ~{task.estimated_days} dias
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveTask(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex items-center justify-between">
          {step === "review" && generatedTasks.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedCount} de {generatedTasks.length} selecionadas
            </span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {step === "context" && (
              <Button onClick={handleGenerate}>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Tarefas
              </Button>
            )}
            {step === "review" && generatedTasks.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("context")}
                  disabled={saving}
                >
                  Gerar Novamente
                </Button>
                <Button onClick={handleSave} disabled={saving || selectedCount === 0}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Salvar {selectedCount} Tarefas
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
