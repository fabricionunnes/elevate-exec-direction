import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Building2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2
} from "lucide-react";

interface TaskWithDetails {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  project_id: string;
  project_name: string;
  company_id: string | null;
  company_name: string | null;
}

interface TasksListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "overdue" | "today" | "status";
  taskIds: string[];
  status?: "completed" | "pending" | "in_progress";
  projectIds?: string[];
}

export function TasksListDialog({ open, onOpenChange, type, taskIds, status, projectIds }: TasksListDialogProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (type === "status") {
      fetchTasksByStatus();
      return;
    }

    if (type === "overdue" || type === "today") {
      fetchTasksByDateFilter();
      return;
    }

    if (taskIds.length > 0) {
      fetchTasksDetails();
    } else {
      setTasks([]);
      setLoading(false);
    }
  }, [open, type, status, taskIds, projectIds]);

  const handleCompleteTask = async (e: React.MouseEvent, task: TaskWithDetails) => {
    e.stopPropagation();
    setCompletingTaskId(task.id);
    
    try {
      // Get current user for history tracking
      const { data: { user } } = await supabase.auth.getUser();
      let staffId: string | null = null;
      
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        staffId = staff?.id || null;
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", task.id);

      if (error) throw error;

      // Log to task history
      await supabase.from("onboarding_task_history").insert({
        task_id: task.id,
        staff_id: staffId,
        action: "status_change",
        field_changed: "status",
        old_value: task.status,
        new_value: "completed",
      });

      // Remove completed task from list
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (error) {
      console.error("Error completing task:", error);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const fetchTasksByDateFilter = async () => {
    setLoading(true);
    try {
      const baseProjectIds = projectIds ?? [];
      if (baseProjectIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from("onboarding_tasks")
        .select(
          `
          id,
          title,
          status,
          priority,
          due_date,
          project_id,
          onboarding_projects!inner (
            id,
            product_name,
            onboarding_company_id,
            onboarding_companies (
              id,
              name
            )
          )
        `
        )
        .in("project_id", baseProjectIds)
        .neq("status", "completed");

      if (type === "overdue") {
        query = query.lt("due_date", today);
      } else if (type === "today") {
        query = query.eq("due_date", today);
      }

      const { data: tasksData, error } = await query
        .order("due_date", { ascending: true })
        .limit(500);

      if (error) throw error;

      const formattedTasks: TaskWithDetails[] = (tasksData || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        project_id: task.project_id,
        project_name: task.onboarding_projects?.product_name || "Projeto",
        company_id: task.onboarding_projects?.onboarding_company_id || null,
        company_name: task.onboarding_projects?.onboarding_companies?.name || null,
      }));

      setTasks(formattedTasks);
    } catch (error) {
      console.error("Error fetching tasks by date filter:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksDetails = async () => {
    setLoading(true);
    try {
      // Fetch tasks with project info in batches if needed
      const batchSize = 100;
      let allFormattedTasks: TaskWithDetails[] = [];

      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batch = taskIds.slice(i, i + batchSize);
        
        const { data: tasksData, error } = await supabase
          .from("onboarding_tasks")
          .select(
            `
            id,
            title,
            status,
            priority,
            due_date,
            project_id,
            onboarding_projects!inner (
              id,
              product_name,
              onboarding_company_id,
              onboarding_companies (
                id,
                name
              )
            )
          `
          )
          .in("id", batch)
          .order("due_date", { ascending: true });

        if (error) throw error;

        const formattedTasks: TaskWithDetails[] = (tasksData || []).map((task: any) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          project_id: task.project_id,
          project_name: task.onboarding_projects?.product_name || "Projeto",
          company_id: task.onboarding_projects?.onboarding_company_id || null,
          company_name: task.onboarding_projects?.onboarding_companies?.name || null,
        }));

        allFormattedTasks = allFormattedTasks.concat(formattedTasks);
      }

      // Sort all tasks by due_date
      allFormattedTasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

      setTasks(allFormattedTasks);
    } catch (error) {
      console.error("Error fetching tasks details:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksByStatus = async () => {
    setLoading(true);
    try {
      if (!status) {
        setTasks([]);
        return;
      }

      const baseProjectIds = projectIds ?? [];
      if (baseProjectIds.length === 0) {
        setTasks([]);
        return;
      }

      const { data: tasksData, error } = await supabase
        .from("onboarding_tasks")
        .select(
          `
          id,
          title,
          status,
          priority,
          due_date,
          project_id,
          onboarding_projects!inner (
            id,
            product_name,
            onboarding_company_id,
            onboarding_companies (
              id,
              name
            )
          )
        `
        )
        .in("project_id", baseProjectIds)
        .eq("status", status as "pending" | "in_progress" | "completed")
        .order("due_date", { ascending: true })
        .limit(200);

      if (error) throw error;

      const formattedTasks: TaskWithDetails[] = (tasksData || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        project_id: task.project_id,
        project_name: task.onboarding_projects?.product_name || "Projeto",
        company_id: task.onboarding_projects?.onboarding_company_id || null,
        company_name: task.onboarding_projects?.onboarding_companies?.name || null,
      }));

      setTasks(formattedTasks);
    } catch (error) {
      console.error("Error fetching tasks by status:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: TaskWithDetails) => {
    onOpenChange(false);
    navigate(`/onboarding-tasks/${task.project_id}?task=${task.id}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-[10px]">Alta</Badge>;
      case "medium":
        return <Badge className="bg-amber-500 text-[10px]">Média</Badge>;
      case "low":
        return <Badge variant="secondary" className="text-[10px]">Baixa</Badge>;
      default:
        return null;
    }
  };

  const title =
    type === "overdue"
      ? "Tarefas Atrasadas"
      : type === "today"
        ? "Tarefas de Hoje"
        : status === "completed"
          ? "Tarefas Concluídas"
          : status === "pending"
            ? "Tarefas Pendentes"
            : "Tarefas em Progresso";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "overdue" ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <Calendar className="h-5 w-5 text-blue-500" />
            )}
            {title}
            <Badge variant="outline" className="ml-2">
              {type === "status" ? tasks.length : taskIds.length} {((type === "status" ? tasks.length : taskIds.length) === 1) ? "tarefa" : "tarefas"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
              <p className="font-medium">Nenhuma tarefa encontrada</p>
              <p className="text-sm">
                {type === "overdue"
                  ? "Não há tarefas atrasadas no momento"
                  : type === "today"
                    ? "Não há tarefas para hoje"
                    : "Não há tarefas para este filtro"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="p-4 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {task.status !== "completed" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900"
                          onClick={(e) => handleCompleteTask(e, task)}
                          disabled={completingTaskId === task.id}
                        >
                          {completingTaskId === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                          )}
                        </Button>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{task.title}</h4>
                        {getPriorityBadge(task.priority)}
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {task.company_name && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{task.company_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{task.project_name}</span>
                        </div>
                        {task.due_date && (
                          <div className={`flex items-center gap-1 ${type === "overdue" ? "text-red-500" : ""}`}>
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
