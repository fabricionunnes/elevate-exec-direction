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
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TaskAttachments } from "./TaskAttachments";
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
  project_id?: string;
  template_id?: string | null;
}

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cs" | "consultant" | "client";
}

interface TaskDetailsDialogProps {
  task: OnboardingTask | null;
  users: OnboardingUser[];
  onClose: () => void;
  onTaskUpdated: () => void;
  isAdmin?: boolean;
  companyId?: string;
  projectId?: string;
  onDelete?: (taskId: string) => void;
  currentUserRole?: "admin" | "cs" | "consultant" | "client" | null;
  currentUserId?: string | null;
  taskCreatedBy?: string | null;
}

export const TaskDetailsDialog = ({
  task,
  users,
  onClose,
  onTaskUpdated,
  isAdmin = false,
  companyId,
  projectId,
  onDelete,
  currentUserRole,
  currentUserId,
  taskCreatedBy,
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

  // Determine what the consultant can edit
  // Consultant can only edit dates/assignee of tasks they created (not templates)
  const isConsultant = currentUserRole === "consultant";
  const isTaskFromTemplate = task?.template_id !== null && task?.template_id !== undefined;
  const isTaskCreatedByCurrentUser = taskCreatedBy === currentUserId;
  
  // Consultant can edit dates/assignee only on their own non-template tasks
  const canEditDatesAndAssignee = isAdmin || (isConsultant && isTaskCreatedByCurrentUser && !isTaskFromTemplate);
  
  // Consultant can always change status and observations
  const canEditStatusAndObservations = isAdmin || isConsultant || currentUserRole === "cs";
  
  // Only admin/CS can edit title and description
  const canEditTitleAndDescription = isAdmin || currentUserRole === "cs";
  
  // Only admin can delete
  const canDelete = isAdmin;

  const handleSave = async () => {
    if (!task) return;

    setLoading(true);
    try {
      const updates: any = {};

      // Only include fields the user can edit
      if (canEditTitleAndDescription) {
        updates.title = editedTask.title;
        updates.description = editedTask.description;
      }

      if (canEditStatusAndObservations) {
        updates.status = editedTask.status;
        updates.observations = editedTask.observations;
        
        if (editedTask.status === "completed" && task.status !== "completed") {
          updates.completed_at = new Date().toISOString();
        } else if (editedTask.status !== "completed") {
          updates.completed_at = null;
        }
      }

      if (canEditDatesAndAssignee) {
        updates.due_date = editedTask.due_date;
        updates.assignee_id = editedTask.assignee_id || null;
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

  const handleDelete = () => {
    if (task && onDelete) {
      onDelete(task.id);
      onClose();
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500 text-xs ml-2">Admin</Badge>;
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

  const taskProjectId = projectId || task.project_id;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes da Tarefa</DialogTitle>
            {canDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A tarefa será removida permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={editedTask.title || ""}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              disabled={!canEditTitleAndDescription}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={editedTask.description || ""}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              rows={3}
              disabled={!canEditTitleAndDescription}
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
                disabled={!canEditStatusAndObservations}
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
                    disabled={!canEditDatesAndAssignee}
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
              disabled={!canEditDatesAndAssignee}
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
              rows={3}
              disabled={!canEditStatusAndObservations}
            />
          </div>

          {/* Attachments section */}
          {companyId && taskProjectId && (
            <div className="border-t pt-4">
              <TaskAttachments
                taskId={task.id}
                companyId={companyId}
                projectId={taskProjectId}
                isAdmin={isAdmin}
              />
            </div>
          )}

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
