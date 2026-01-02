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
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed";
  assignee_id: string | null;
  observations: string | null;
  sort_order: number;
}

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "cs" | "consultant" | "client";
}

interface TaskDetailsDialogProps {
  task: OnboardingTask | null;
  users: OnboardingUser[];
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskDetailsDialog = ({
  task,
  users,
  onClose,
  onTaskUpdated,
}: TaskDetailsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<OnboardingTask>>({});

  useEffect(() => {
    if (task) {
      setEditedTask({
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        status: task.status,
        assignee_id: task.assignee_id,
        observations: task.observations,
      });
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;

    setLoading(true);
    try {
      const updates: any = {
        title: editedTask.title,
        description: editedTask.description,
        due_date: editedTask.due_date,
        status: editedTask.status,
        assignee_id: editedTask.assignee_id || null,
        observations: editedTask.observations,
      };

      if (editedTask.status === "completed" && task.status !== "completed") {
        updates.completed_at = new Date().toISOString();
      } else if (editedTask.status !== "completed") {
        updates.completed_at = null;
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Tarefa atualizada");
      onTaskUpdated();
      onClose();
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em andamento";
      case "completed":
        return "Concluída";
      default:
        return status;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "cs":
        return <Badge className="bg-blue-500 text-xs ml-2">CS</Badge>;
      case "consultant":
        return <Badge className="bg-purple-500 text-xs ml-2">Consultor</Badge>;
      case "client":
        return <Badge variant="outline" className="text-xs ml-2">Cliente</Badge>;
      default:
        return null;
    }
  };

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={editedTask.title || ""}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={editedTask.description || ""}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editedTask.status}
                onValueChange={(value: "pending" | "in_progress" | "completed") =>
                  setEditedTask({ ...editedTask, status: value })
                }
              >
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
              <Label>Data de Execução</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editedTask.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editedTask.due_date
                      ? format(new Date(editedTask.due_date), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editedTask.due_date ? new Date(editedTask.due_date) : undefined}
                    onSelect={(date) =>
                      setEditedTask({
                        ...editedTask,
                        due_date: date ? date.toISOString().split("T")[0] : null,
                      })
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={editedTask.assignee_id || "none"}
              onValueChange={(value) =>
                setEditedTask({ ...editedTask, assignee_id: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center">
                      {user.name}
                      {getRoleBadge(user.role)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Adicione observações sobre a execução..."
              value={editedTask.observations || ""}
              onChange={(e) => setEditedTask({ ...editedTask, observations: e.target.value })}
              rows={4}
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
