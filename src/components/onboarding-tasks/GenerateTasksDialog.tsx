import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Check, Loader2, ListChecks, Sparkles, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type TemplateTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  sort_order: number;
  default_days_offset: number | null;
  duration_days: number | null;
  phase?: string | null;
  phase_order?: number | null;
  recurrence?: string | null;
  is_internal?: boolean;
};

type AISuggestedTask = {
  title: string;
  description: string;
  priority: string;
  phase: string;
  reasoning: string;
};

interface GenerateTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  productId: string;
  onTasksGenerated: () => void;
}

export const GenerateTasksDialog = ({
  open,
  onOpenChange,
  projectId,
  productId,
  onTasksGenerated,
}: GenerateTasksDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateTask[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [activeTab, setActiveTab] = useState<"template" | "ai">("ai");
  
  // AI generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTasks, setAiTasks] = useState<AISuggestedTask[]>([]);
  const [selectedAiTasks, setSelectedAiTasks] = useState<Set<number>>(new Set());
  const [aiContext, setAiContext] = useState<{ completedCount: number; pendingCount: number; companyName: string } | null>(null);
  const [userSuggestion, setUserSuggestion] = useState("");

  const templatesCount = templates.length;
  const titlePreview = useMemo(() => templates.slice(0, 5).map((t) => t.title), [templates]);

  useEffect(() => {
    if (!open) {
      // Reset AI state when dialog closes
      setAiTasks([]);
      setSelectedAiTasks(new Set());
      setAiContext(null);
      setUserSuggestion("");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("onboarding_task_templates")
          .select("id,title,description,priority,sort_order,default_days_offset,duration_days,phase,phase_order,recurrence,is_internal")
          .eq("product_id", productId)
          .order("phase_order", { ascending: true })
          .order("sort_order", { ascending: true });

        if (error) throw error;
        if (!cancelled) setTemplates((data || []) as TemplateTask[]);
      } catch (err: any) {
        console.error(err);
        toast.error("Erro ao carregar templates do serviço");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const handleClose = () => onOpenChange(false);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiTasks([]);
    setSelectedAiTasks(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-tasks", {
        body: { projectId, userSuggestion: userSuggestion.trim() || undefined },
      });

      if (error) throw error;

      if (data?.success && data?.tasks) {
        setAiTasks(data.tasks);
        setAiContext(data.context);
        // Select all tasks by default
        setSelectedAiTasks(new Set(data.tasks.map((_: AISuggestedTask, i: number) => i)));
        toast.success(`${data.tasks.length} tarefas sugeridas pela IA`);
      } else {
        throw new Error(data?.error || "Erro ao gerar tarefas");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar tarefas com IA");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleAiTask = (index: number) => {
    setSelectedAiTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApplyAITasks = async () => {
    if (selectedAiTasks.size === 0) {
      toast.error("Selecione pelo menos uma tarefa");
      return;
    }

    setAiLoading(true);

    try {
      const today = new Date();
      const tasksToInsert = Array.from(selectedAiTasks).map((index, i) => {
        const task = aiTasks[index];
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 7 + i * 3); // Stagger due dates

        return {
          project_id: projectId,
          title: task.title,
          description: `${task.description}\n\n---\n💡 **Por que esta tarefa?** ${task.reasoning}`,
          priority: task.priority || "medium",
          status: "pending" as const,
          due_date: dueDate.toISOString().split("T")[0],
          tags: task.phase ? [task.phase, "IA"] : ["IA"],
          sort_order: i,
        };
      });

      const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);
      if (insertError) throw insertError;

      toast.success(`${tasksToInsert.length} tarefas criadas com sucesso!`);
      onTasksGenerated();
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar tarefas");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (templatesCount === 0) {
      toast.error("Nenhum template encontrado para este serviço");
      return;
    }

    setLoading(true);

    try {
      const today = new Date();

      if (replaceExisting) {
        const { error: delError } = await supabase
          .from("onboarding_tasks")
          .delete()
          .eq("project_id", projectId);
        if (delError) throw delError;
      }

      let baseSortOrder = 0;
      if (!replaceExisting) {
        const { data: existing } = await supabase
          .from("onboarding_tasks")
          .select("sort_order")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: false })
          .limit(1);

        baseSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      }

      const tasksToInsert = templates.map((tpl, idx) => {
        let dueDate: string | null = null;
        const offset = (tpl.default_days_offset ?? 0) + (tpl.duration_days ?? 0);
        if (offset > 0) {
          const due = new Date(today);
          due.setDate(due.getDate() + offset);
          dueDate = due.toISOString().split("T")[0];
        }

        return {
          project_id: projectId,
          template_id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          priority: tpl.priority || "medium",
          status: "pending" as const,
          due_date: dueDate,
          start_date: null,
          sort_order: baseSortOrder + (tpl.sort_order ?? idx),
          recurrence: tpl.recurrence ?? null,
          tags: tpl.phase ? [tpl.phase, String(tpl.phase_order ?? 99)] : null,
          estimated_hours: null,
          is_internal: tpl.is_internal ?? false,
        };
      });

      const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);
      if (insertError) throw insertError;

      toast.success(`${templatesCount} tarefas aplicadas a partir do template!`);
      onTasksGenerated();
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao aplicar template de tarefas");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta</Badge>;
      case "low":
        return <Badge variant="secondary">Baixa</Badge>;
      default:
        return <Badge variant="outline">Média</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Gerar Tarefas
          </DialogTitle>
          <DialogDescription>
            Escolha entre gerar tarefas com IA (recomendado) ou aplicar o template padrão do serviço.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "template" | "ai")} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </TabsTrigger>
            <TabsTrigger value="template" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Template Padrão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {aiTasks.length === 0 ? (
              <div className="flex-1 flex flex-col p-4 border rounded-lg border-dashed space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-8 w-8 text-primary/70" />
                  <div>
                    <h3 className="font-semibold">Gerar tarefas inteligentes</h3>
                    <p className="text-sm text-muted-foreground">
                      Descreva o que você gostaria de focar ou deixe em branco para sugestões gerais.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="user-suggestion">O que você gostaria de trabalhar? (opcional)</Label>
                  <Textarea
                    id="user-suggestion"
                    placeholder="Ex: Quero focar em prospecção ativa, melhorar o processo de follow-up, treinar a equipe para lidar com objeções..."
                    value={userSuggestion}
                    onChange={(e) => setUserSuggestion(e.target.value)}
                    className="min-h-[100px] resize-none"
                    disabled={aiLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA também considerará o contexto do cliente e tarefas já realizadas.
                  </p>
                </div>

                <Button onClick={handleGenerateAI} disabled={aiLoading} className="w-full">
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analisando contexto...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar sugestões
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                {aiContext && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>📊 {aiContext.completedCount} tarefas analisadas</span>
                    <span>📋 {aiContext.pendingCount} pendentes</span>
                  </div>
                )}
                <div className="flex-1 overflow-hidden min-h-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4 pb-2">
                      {aiTasks.map((task, index) => (
                        <Card 
                          key={index} 
                          className={`cursor-pointer transition-all ${
                            selectedAiTasks.has(index) 
                              ? "ring-2 ring-primary bg-primary/5" 
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleAiTask(index)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox 
                                checked={selectedAiTasks.has(index)} 
                                onCheckedChange={() => toggleAiTask(index)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{task.title}</span>
                                  {getPriorityBadge(task.priority)}
                                  {task.phase && (
                                    <Badge variant="outline" className="text-xs">
                                      {task.phase}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {task.description}
                                </p>
                                <p className="text-xs text-primary/80 italic">
                                  💡 {task.reasoning}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={handleGenerateAI} disabled={aiLoading}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar novamente
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedAiTasks.size} de {aiTasks.length} selecionadas
                  </span>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="template" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={replaceExisting}
                onCheckedChange={(v) => setReplaceExisting(Boolean(v))}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label className="font-medium">Substituir tarefas atuais</Label>
                <p className="text-sm text-muted-foreground">
                  Recomendado apenas para projetos novos ou resetar o cronograma.
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Templates encontrados</p>
                  <p className="text-sm text-muted-foreground">Serviço: {productId}</p>
                </div>
                <Badge variant="secondary">{loading ? "..." : templatesCount}</Badge>
              </div>

              {templatesCount > 0 && (
                <ScrollArea className="mt-3 flex-1">
                  <div className="space-y-2 pr-4">
                    {titlePreview.map((t) => (
                      <div key={t} className="text-sm">
                        {t}
                      </div>
                    ))}
                    {templatesCount > titlePreview.length && (
                      <div className="text-xs text-muted-foreground">
                        +{templatesCount - titlePreview.length} outras
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}

              {!loading && templatesCount === 0 && (
                <p className="mt-3 text-sm text-destructive">
                  Nenhum template cadastrado para este serviço.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading || aiLoading}>
            Cancelar
          </Button>
          {activeTab === "ai" ? (
            <Button 
              onClick={handleApplyAITasks} 
              disabled={aiLoading || selectedAiTasks.size === 0}
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar {selectedAiTasks.size} tarefa{selectedAiTasks.size !== 1 ? "s" : ""}
            </Button>
          ) : (
            <Button onClick={handleApplyTemplate} disabled={loading || templatesCount === 0}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Aplicar template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
