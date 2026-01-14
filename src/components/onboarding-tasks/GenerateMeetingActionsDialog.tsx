import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ListTodo,
} from "lucide-react";

interface GeneratedAction {
  id: string;
  title: string;
  description: string;
  due_days: number;
  priority: "high" | "medium" | "low";
  selected: boolean;
}

interface GenerateMeetingActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingSubject: string;
  projectId: string;
  productId?: string;
  onActionsCreated: () => void;
}

export const GenerateMeetingActionsDialog = ({
  open,
  onOpenChange,
  meetingId,
  meetingSubject,
  projectId,
  productId,
  onActionsCreated,
}: GenerateMeetingActionsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actions, setActions] = useState<GeneratedAction[]>([]);
  const [phaseName, setPhaseName] = useState("");
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setActions([]);
    setGenerated(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error: fnError } = await supabase.functions.invoke("generate-meeting-actions", {
        body: { meetingId, projectId },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.actions || data.actions.length === 0) {
        throw new Error("Nenhuma ação identificada na transcrição");
      }

      setActions(data.actions);
      setPhaseName(data.phase_name || meetingSubject);
      setGenerated(true);
      toast.success(`${data.actions.length} ações identificadas!`);
    } catch (err) {
      console.error("Error generating actions:", err);
      const message = err instanceof Error ? err.message : "Erro ao gerar ações";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAction = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, selected: !a.selected } : a))
    );
  };

  const toggleAll = (selected: boolean) => {
    setActions((prev) => prev.map((a) => ({ ...a, selected })));
  };

  const handleApprove = async () => {
    const selectedActions = actions.filter((a) => a.selected);
    if (selectedActions.length === 0) {
      toast.error("Selecione pelo menos uma ação");
      return;
    }

    if (!phaseName.trim()) {
      toast.error("Informe o nome da fase");
      return;
    }

    setCreating(true);

    try {
      // Get current staff
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!staff) throw new Error("Staff não encontrado");

      // Get max phase order for the product/service
      let maxOrder = 0;
      if (productId) {
        const { data: existingPhases } = await supabase
          .from("onboarding_service_phases")
          .select("sort_order")
          .eq("service_id", productId)
          .order("sort_order", { ascending: false })
          .limit(1);

        if (existingPhases && existingPhases.length > 0) {
          maxOrder = existingPhases[0].sort_order;
        }
      }

      // Create the phase
      let phaseId: string | null = null;
      if (productId) {
        const { data: newPhase, error: phaseError } = await supabase
          .from("onboarding_service_phases")
          .insert({
            service_id: productId,
            name: phaseName.trim(),
            sort_order: maxOrder + 1,
            is_active: true,
          })
          .select()
          .single();

        if (phaseError) {
          console.error("Error creating phase:", phaseError);
          // Continue without phase if it fails
        } else {
          phaseId = newPhase.id;
        }
      }

      // Create tasks with the phase
      const today = new Date();
      const tasksToCreate = selectedActions.map((action, index) => {
        const dueDate = addDays(today, action.due_days);
        return {
          project_id: projectId,
          title: action.title,
          description: action.description,
          status: "pending" as const,
          priority: action.priority,
          due_date: dueDate.toISOString().split("T")[0],
          tags: phaseId
            ? [phaseName.trim(), String(maxOrder + 1)]
            : [phaseName.trim()],
          sort_order: index,
        };
      });

      const { error: tasksError } = await supabase
        .from("onboarding_tasks")
        .insert(tasksToCreate);

      if (tasksError) throw tasksError;

      // Activity is logged automatically via task creation

      toast.success(
        `${selectedActions.length} tarefas criadas na fase "${phaseName}"!`
      );
      onActionsCreated();
      handleClose();
    } catch (err) {
      console.error("Error creating tasks:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao criar tarefas");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setActions([]);
    setPhaseName("");
    setGenerated(false);
    setError(null);
    onOpenChange(false);
  };

  const selectedCount = actions.filter((a) => a.selected).length;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case "medium":
        return <Badge variant="default" className="text-xs">Média</Badge>;
      case "low":
        return <Badge variant="secondary" className="text-xs">Baixa</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Ações da Reunião
          </DialogTitle>
          <DialogDescription>
            {meetingSubject}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!generated ? (
            <div className="py-8 text-center space-y-4">
              {error ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <p className="text-destructive font-medium">{error}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifique se a reunião possui transcrição ou notas detalhadas.
                    </p>
                  </div>
                  <Button onClick={handleGenerate} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      "Tentar novamente"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <ListTodo className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Analisar transcrição com IA
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      A IA irá identificar ações e prazos mencionados na reunião.
                    </p>
                  </div>
                  <Button onClick={handleGenerate} disabled={loading} size="lg">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analisando transcrição...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Ações
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Phase name input */}
              <div className="space-y-2">
                <Label htmlFor="phaseName">Nome da Fase</Label>
                <Input
                  id="phaseName"
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  placeholder="Nome da fase na jornada"
                />
                <p className="text-xs text-muted-foreground">
                  As tarefas serão agrupadas nesta fase dentro da jornada do cliente.
                </p>
              </div>

              {/* Select all toggle */}
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAll"
                    checked={selectedCount === actions.length}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                  <Label htmlFor="selectAll" className="cursor-pointer text-sm">
                    Selecionar todas ({selectedCount}/{actions.length})
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Regenerar"
                  )}
                </Button>
              </div>

              {/* Actions list */}
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {actions.map((action) => {
                    const dueDate = addDays(new Date(), action.due_days);
                    return (
                      <div
                        key={action.id}
                        className={`p-3 border rounded-lg transition-colors ${
                          action.selected
                            ? "border-primary/50 bg-primary/5"
                            : "border-muted bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={action.selected}
                            onCheckedChange={() => toggleAction(action.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm">
                                {action.title}
                              </span>
                              {getPriorityBadge(action.priority)}
                            </div>
                            {action.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {action.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Prazo: {format(dueDate, "dd/MM/yyyy", { locale: ptBR })} ({action.due_days} dias)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={creating}>
            Cancelar
          </Button>
          {generated && (
            <Button
              onClick={handleApprove}
              disabled={creating || selectedCount === 0}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprovar {selectedCount} {selectedCount === 1 ? "ação" : "ações"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
