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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Trash2, EyeOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TaskAttachments } from "./TaskAttachments";
import { TaskHistory } from "./TaskHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  responsible_staff?: { id: string; name: string } | null;
  is_internal?: boolean;
}

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cs" | "consultant" | "client";
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface TaskDetailsDialogProps {
  task: OnboardingTask | null;
  users: OnboardingUser[];
  staffList?: StaffMember[];
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
  staffList = [],
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
        is_internal: task.is_internal ?? false,
      });
    }
  }, [task]);

  // Determine what each role can edit
  const isConsultant = currentUserRole === "consultant";
  const isCS = currentUserRole === "cs";
  const isStaffRole = isConsultant || isCS;
  const isTaskCreatedByCurrentUser = taskCreatedBy === currentUserId;
  
  // CS and Consultant can edit dates and assignee (but only assign to themselves)
  const canEditDatesAndAssignee = isAdmin || isStaffRole;
  
  // CS and Consultant can change status and observations
  const canEditStatusAndObservations = isAdmin || isStaffRole;
  
  // Title: Admin/CS can always edit, Consultant only if they created the task
  const canEditTitle = isAdmin || isCS || (isConsultant && isTaskCreatedByCurrentUser);
  
  // Description: Admin/CS/Consultant can edit
  const canEditDescription = isAdmin || isCS || isConsultant;
  
  // Only admin can delete
  const canDelete = isAdmin;
  
  // For assignee selection: staff can only assign to themselves, admin can assign to anyone
  // Staff users are in staffList, not users array
  const currentStaffMember = staffList.find(s => s.id === currentUserId);
  const selfAsAssignee = currentStaffMember 
    ? [{ id: currentStaffMember.id, name: currentStaffMember.name, email: '', role: currentStaffMember.role as "admin" | "cs" | "consultant" | "client" }]
    : [];
  
  const availableAssignees = isAdmin 
    ? [...users, ...staffList.map(s => ({ id: s.id, name: s.name, email: '', role: s.role as "admin" | "cs" | "consultant" | "client" }))]
    : isStaffRole 
      ? selfAsAssignee
      : [];

  const [historyKey, setHistoryKey] = useState(0);

  const logHistory = async (action: string, fieldChanged: string | null, oldValue: string | null, newValue: string | null) => {
    if (!currentUserId || !task) return;
    
    // Determine if current user is staff or onboarding_user
    const isStaff = isAdmin || currentUserRole === "cs" || currentUserRole === "consultant";
    
    try {
      const insertData: any = {
        task_id: task.id,
        action,
        field_changed: fieldChanged,
        old_value: oldValue,
        new_value: newValue,
      };
      
      if (isStaff) {
        insertData.staff_id = currentUserId;
      } else {
        insertData.user_id = currentUserId;
      }
      
      const { error } = await supabase.from("onboarding_task_history").insert(insertData);
      if (error) {
        console.error("Error logging history:", error);
      }
    } catch (error) {
      console.error("Error logging history:", error);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "in_progress": return "Em andamento";
      case "completed": return "Concluída";
      default: return status;
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "Nenhum";
    const user = users.find(u => u.id === userId);
    return user?.name || "Desconhecido";
  };

  const handleSave = async () => {
    if (!task) return;

    // Validate: cannot set in_progress or completed without a responsible (assignee)
    const newStatus = editedTask.status;
    const effectiveAssigneeId = (editedTask.assignee_id ?? task.assignee_id) || null;
    if ((newStatus === "in_progress" || newStatus === "completed") && !effectiveAssigneeId) {
      toast.error("Atribua um responsável antes de alterar o status da tarefa");
      return;
    }

    setLoading(true);
    try {
      const updates: any = {};
      const historyPromises: Promise<void>[] = [];

      // Only include fields the user can edit
      if (canEditTitle) {
        if (editedTask.title !== task.title) {
          historyPromises.push(logHistory("edit", "título", task.title, editedTask.title || ""));
        }
        updates.title = editedTask.title;
      }
      
      if (canEditDescription) {
        if (editedTask.description !== task.description) {
          historyPromises.push(logHistory("edit", "descrição", task.description || "", editedTask.description || ""));
        }
        updates.description = editedTask.description;
      }

      if (canEditStatusAndObservations) {
        // Auto-assign to current user when completing (CS/Consultant)
        const isCompletingTask = editedTask.status === "completed" && task.status !== "completed";
        const isStaffRole = currentUserRole === "cs" || currentUserRole === "consultant";
        
        if (isCompletingTask && isStaffRole && currentUserId) {
          // Auto-assign to current staff member if not already assigned
          if (!editedTask.assignee_id && !task.assignee_id) {
            // Find the onboarding_user for this staff member in this project
            // The currentUserId here is the staff_id, we need to use it directly
            updates.assignee_id = currentUserId;
            historyPromises.push(logHistory("assign", "responsável", "Nenhum", "Auto-atribuído ao concluir"));
          }
          // Set due_date to today if completing
          const today = format(new Date(), "yyyy-MM-dd");
          if (editedTask.due_date !== today) {
            historyPromises.push(logHistory("edit", "data de execução", task.due_date || "", today));
          }
          updates.due_date = today;
        }
        
        if (editedTask.status !== task.status) {
          historyPromises.push(logHistory("status_change", "status", getStatusLabel(task.status), getStatusLabel(editedTask.status || "")));
        }
        if (editedTask.observations !== task.observations) {
          historyPromises.push(logHistory("edit", "observações", task.observations || "", editedTask.observations || ""));
        }
        updates.status = editedTask.status;
        updates.observations = editedTask.observations;
        
        if (editedTask.status === "completed" && task.status !== "completed") {
          updates.completed_at = new Date().toISOString();
        } else if (editedTask.status !== "completed") {
          updates.completed_at = null;
        }
      }

      if (canEditDatesAndAssignee) {
        if (editedTask.due_date !== task.due_date && !updates.due_date) {
          historyPromises.push(logHistory("edit", "data de execução", task.due_date || "", editedTask.due_date || ""));
          updates.due_date = editedTask.due_date;
        }
        if (editedTask.assignee_id !== task.assignee_id && !updates.assignee_id) {
          historyPromises.push(logHistory("assign", "responsável", getUserName(task.assignee_id), getUserName(editedTask.assignee_id || null)));
          updates.assignee_id = editedTask.assignee_id || null;
        }
      }

      // Admin/CS can toggle internal visibility
      if (isAdmin || currentUserRole === "cs") {
        if (editedTask.is_internal !== (task.is_internal ?? false)) {
          historyPromises.push(logHistory("edit", "visibilidade", task.is_internal ? "Interna" : "Pública", editedTask.is_internal ? "Interna" : "Pública"));
        }
        updates.is_internal = editedTask.is_internal ?? false;
      }

      // Log all history entries
      await Promise.all(historyPromises);

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) throw error;

      setHistoryKey(prev => prev + 1);
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

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editedTask.title || ""}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                disabled={!canEditTitle}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editedTask.description || ""}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                rows={3}
                disabled={!canEditDescription}
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
                        ? format(parseISO(editedTask.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editedTask.due_date ? parseISO(editedTask.due_date) : undefined}
                      onSelect={(date) =>
                        setEditedTask({
                          ...editedTask,
                          due_date: date ? format(date, "yyyy-MM-dd") : null,
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
                  {availableAssignees.map((user) => (
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

            {/* Internal task toggle - only for admin/CS */}
            {(isAdmin || currentUserRole === "cs") && (
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Tarefa Interna</Label>
                    <p className="text-xs text-muted-foreground">
                      Tarefas internas não são visíveis para clientes
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editedTask.is_internal ?? false}
                  onCheckedChange={(checked) => setEditedTask({ ...editedTask, is_internal: checked })}
                />
              </div>
            )}

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
          </TabsContent>
          
          <TabsContent value="history" className="pt-4">
            <TaskHistory key={historyKey} taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
