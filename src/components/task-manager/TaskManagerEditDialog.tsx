import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Building2, FolderOpen } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["onboarding_task_status"];

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface TaskManagerEditDialogProps {
  task: TaskWithProject | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  staffList: StaffMember[];
  isAdmin: boolean;
  currentStaffId: string | null;
}

export const TaskManagerEditDialog = ({
  task,
  onClose,
  onTaskUpdated,
  staffList,
  isAdmin,
  currentStaffId,
}: TaskManagerEditDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<string>("medium");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [responsibleStaffId, setResponsibleStaffId] = useState<string | null>(null);
  const [observations, setObservations] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority || "medium");
      setDueDate(task.due_date);
      setResponsibleStaffId(task.responsible_staff_id);
      // Load observations
      loadObservations(task.id);
    }
  }, [task]);

  const loadObservations = async (taskId: string) => {
    const { data } = await supabase
      .from("onboarding_tasks")
      .select("observations")
      .eq("id", taskId)
      .single();
    setObservations(data?.observations || "");
  };

  const handleSave = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const updates: Record<string, any> = {
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate,
        responsible_staff_id: responsibleStaffId,
        observations: observations || null,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Tarefa atualizada");
      onTaskUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar tarefa");
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
        </DialogHeader>

        {/* Context info */}
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{task.company_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span>{task.project_name}</span>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data de Execução</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate
                    ? format(parseISO(dueDate), "dd/MM/yyyy", { locale: ptBR })
                    : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate ? parseISO(dueDate) : undefined}
                  onSelect={(date) =>
                    setDueDate(date ? format(date, "yyyy-MM-dd") : null)
                  }
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={responsibleStaffId || "none"}
              onValueChange={(v) => setResponsibleStaffId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Adicione observações sobre a execução..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
