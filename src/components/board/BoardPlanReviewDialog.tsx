import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, Rocket, Trash2, Undo2, FileText } from "lucide-react";
import { BoardPlanAction } from "./boardTypes";
import { boardDeliverableLabel } from "./boardDeliverableConfig";

interface BoardPlanReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  companyName: string;
  onPublished: () => void;
}

export function BoardPlanReviewDialog({
  open,
  onOpenChange,
  memberId,
  companyName,
  onPublished,
}: BoardPlanReviewDialogProps) {
  const [actions, setActions] = useState<BoardPlanAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("unv_board_plan_actions")
        .select("*")
        .eq("member_id", memberId)
        .order("phase", { ascending: true })
        .order("due_date", { ascending: true });
      if (error) throw error;
      setActions((data || []) as BoardPlanAction[]);
    } catch (err) {
      console.error("Erro ao carregar ações do plano:", err);
      toast.error("Erro ao carregar o plano");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (open) fetchActions();
  }, [open, fetchActions]);

  const updateLocal = (id: string, patch: Partial<BoardPlanAction>) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const persistField = async (id: string, patch: Partial<BoardPlanAction>) => {
    try {
      const { error } = await (supabase as any)
        .from("unv_board_plan_actions")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao salvar ação:", err);
      toast.error("Erro ao salvar alteração");
      fetchActions();
    }
  };

  const toggleDiscard = async (action: BoardPlanAction) => {
    const newStatus = action.status === "discarded" ? "draft" : "discarded";
    updateLocal(action.id, { status: newStatus });
    await persistField(action.id, { status: newStatus });
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("board-engine", {
        body: { action: "generate_plan", member_id: memberId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Plano regenerado: ${data?.actions_created || 0} ações`);
      fetchActions();
    } catch (err: any) {
      console.error("Erro ao regenerar plano:", err);
      toast.error(err?.message || "Erro ao regenerar o plano");
    } finally {
      setRegenerating(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("board-engine", {
        body: { action: "publish_plan", member_id: memberId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Plano publicado: ${data?.tasks_created || 0} tarefas criadas no projeto`);
      onOpenChange(false);
      onPublished();
    } catch (err: any) {
      console.error("Erro ao publicar plano:", err);
      toast.error(err?.message || "Erro ao publicar o plano");
    } finally {
      setPublishing(false);
    }
  };

  const activeActions = actions.filter((a) => a.status !== "discarded");
  const phases = Array.from(new Set(actions.map((a) => a.phase))).sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={(v) => !regenerating && !publishing && onOpenChange(v)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar plano anual — {companyName}</DialogTitle>
          <DialogDescription>
            Ajuste as ações antes de publicar. Ao aprovar, o plano vira um projeto com tarefas no
            Nexus.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {activeActions.length} ações ativas
            {actions.length - activeActions.length > 0 &&
              ` · ${actions.length - activeActions.length} descartadas`}
          </span>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={regenerating || publishing}>
                  {regenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerar plano</AlertDialogTitle>
                  <AlertDialogDescription>
                    A IA vai gerar o plano do zero e as edições feitas nas ações atuais serão
                    perdidas. A geração leva de 60 a 90 segundos. Continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={regenerate}>Regenerar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={regenerating || publishing || activeActions.length === 0}>
                  {publishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4 mr-2" />
                  )}
                  Aprovar e publicar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publicar plano</AlertDialogTitle>
                  <AlertDialogDescription>
                    Serão criadas {activeActions.length} tarefas num projeto do Nexus para{" "}
                    {companyName}. Depois de publicado o plano não volta pra revisão. Confirmar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={publish}>Publicar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {regenerating && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando o plano com IA — isso leva de 60 a 90 segundos. Não feche esta janela.
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : actions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhuma ação encontrada.</p>
        ) : (
          <div className="space-y-6">
            {phases.map((phase) => {
              const phaseActions = actions.filter((a) => a.phase === phase);
              const phaseName = phaseActions[0]?.phase_name || `Fase ${phase}`;
              return (
                <div key={phase}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                    <Badge className="bg-[#0D2B5E] hover:bg-[#0D2B5E]">Fase {phase}</Badge>
                    <span className="font-semibold text-sm">{phaseName}</span>
                  </div>
                  <div className="space-y-2">
                    {phaseActions.map((action) => {
                      const discarded = action.status === "discarded";
                      return (
                        <div
                          key={action.id}
                          className={`border rounded-lg p-3 space-y-2 ${
                            discarded ? "opacity-50 bg-muted/40" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                value={action.title}
                                disabled={discarded}
                                onChange={(e) => updateLocal(action.id, { title: e.target.value })}
                                onBlur={(e) => persistField(action.id, { title: e.target.value })}
                                className="font-medium"
                              />
                              <Textarea
                                value={action.description || ""}
                                disabled={discarded}
                                rows={2}
                                onChange={(e) =>
                                  updateLocal(action.id, { description: e.target.value })
                                }
                                onBlur={(e) =>
                                  persistField(action.id, { description: e.target.value })
                                }
                                className="text-sm"
                              />
                            </div>
                            <div className="flex flex-col items-end gap-2 w-40 shrink-0">
                              <Input
                                type="date"
                                value={action.due_date || ""}
                                disabled={discarded}
                                onChange={(e) => {
                                  updateLocal(action.id, { due_date: e.target.value });
                                  persistField(action.id, { due_date: e.target.value });
                                }}
                              />
                              {action.deliverable_type && (
                                <Badge variant="secondary" className="text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {boardDeliverableLabel(action.deliverable_type)}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className={
                                  discarded
                                    ? "text-green-600 hover:text-green-600"
                                    : "text-destructive hover:text-destructive"
                                }
                                onClick={() => toggleDiscard(action)}
                              >
                                {discarded ? (
                                  <>
                                    <Undo2 className="h-4 w-4 mr-1" /> Restaurar
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-1" /> Descartar
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
