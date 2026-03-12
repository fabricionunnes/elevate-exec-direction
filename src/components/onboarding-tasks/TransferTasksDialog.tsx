import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRightLeft, Copy, Loader2 } from "lucide-react";

interface TransferTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskIds: string[];
  currentProjectId: string;
  companyId: string;
  staffList?: { id: string; name: string }[];
  onComplete: () => void;
}

export const TransferTasksDialog = ({
  open,
  onOpenChange,
  taskIds,
  currentProjectId,
  companyId,
  staffList = [],
  onComplete,
}: TransferTasksDialogProps) => {
  const [mode, setMode] = useState<"move" | "copy">("copy");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [staffMode, setStaffMode] = useState<"keep" | "clear" | "change">("keep");
  const [newStaffId, setNewStaffId] = useState("");
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (open && companyId) {
      fetchProjects();
    }
  }, [open, companyId]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    const { data } = await supabase
      .from("onboarding_projects")
      .select("id, product_name")
      .eq("onboarding_company_id", companyId)
      .neq("id", currentProjectId)
      .eq("status", "active");

    setProjects(
      (data || []).map((p) => ({
        value: p.id,
        label: p.product_name,
      }))
    );
    setLoadingProjects(false);
  };

  const handleSubmit = async () => {
    if (!targetProjectId) {
      toast.error("Selecione o projeto de destino");
      return;
    }

    setLoading(true);
    try {
      if (mode === "move") {
        // Move: update project_id directly
        const updateData: Record<string, any> = { project_id: targetProjectId };
        if (staffMode === "clear") {
          updateData.responsible_staff_id = null;
        } else if (staffMode === "change" && newStaffId) {
          updateData.responsible_staff_id = newStaffId;
        }

        const { error } = await supabase
          .from("onboarding_tasks")
          .update(updateData)
          .in("id", taskIds);

        if (error) throw error;
        toast.success(`${taskIds.length} tarefa(s) transferida(s) com sucesso`);
      } else {
        // Copy: fetch tasks then insert copies
        const { data: tasks, error: fetchError } = await supabase
          .from("onboarding_tasks")
          .select("title, description, due_date, start_date, priority, tags, recurrence, template_id, is_internal, estimated_hours, sort_order, responsible_staff_id, assignee_id, observations")
          .in("id", taskIds);

        if (fetchError) throw fetchError;

        const copies = (tasks || []).map((t) => ({
          ...t,
          project_id: targetProjectId,
          status: "pending" as const,
          completed_at: null,
          responsible_staff_id:
            staffMode === "clear"
              ? null
              : staffMode === "change" && newStaffId
              ? newStaffId
              : t.responsible_staff_id,
        }));

        const { error: insertError } = await supabase
          .from("onboarding_tasks")
          .insert(copies);

        if (insertError) throw insertError;
        toast.success(`${taskIds.length} tarefa(s) copiada(s) com sucesso`);
      }

      onComplete();
      onOpenChange(false);
      setTargetProjectId("");
      setStaffMode("keep");
      setNewStaffId("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar tarefas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir / Copiar Tarefas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <p className="text-sm text-muted-foreground">
            {taskIds.length} tarefa{taskIds.length > 1 ? "s" : ""} selecionada{taskIds.length > 1 ? "s" : ""}
          </p>

          {/* Mode */}
          <div className="space-y-2">
            <Label>Ação</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "move" | "copy")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="move" id="move" />
                <Label htmlFor="move" className="font-normal cursor-pointer flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Mover
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="copy" id="copy" />
                <Label htmlFor="copy" className="font-normal cursor-pointer flex items-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Target project */}
          <div className="space-y-2">
            <Label>Projeto de destino</Label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando projetos...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum outro projeto ativo nesta empresa</p>
            ) : (
              <SearchableSelect
                value={targetProjectId}
                onValueChange={setTargetProjectId}
                options={projects}
                placeholder="Selecione o projeto..."
                emptyMessage="Nenhum projeto encontrado"
              />
            )}
          </div>

          {/* Responsible staff */}
          <div className="space-y-2">
            <Label>Responsável</Label>
            <RadioGroup value={staffMode} onValueChange={(v) => setStaffMode(v as "keep" | "clear" | "change")} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="keep" id="staff-keep" />
                <Label htmlFor="staff-keep" className="font-normal cursor-pointer">Manter o mesmo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="clear" id="staff-clear" />
                <Label htmlFor="staff-clear" className="font-normal cursor-pointer">Remover responsável</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="change" id="staff-change" />
                <Label htmlFor="staff-change" className="font-normal cursor-pointer">Alterar responsável</Label>
              </div>
            </RadioGroup>

            {staffMode === "change" && (
              <SearchableSelect
                value={newStaffId}
                onValueChange={setNewStaffId}
                options={staffList.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Selecione o responsável..."
                emptyMessage="Nenhum responsável encontrado"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !targetProjectId || projects.length === 0}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "move" ? "Mover" : "Copiar"} {taskIds.length} tarefa{taskIds.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
