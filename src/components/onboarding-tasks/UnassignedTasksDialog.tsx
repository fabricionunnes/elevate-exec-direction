import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  UserX,
  UserPlus,
  Loader2,
  AlertTriangle,
  CheckSquare,
} from "lucide-react";
import { formatDateLocal } from "@/lib/dateUtils";
import { isBefore, startOfDay } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";

interface UnassignedTask {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
  project_id: string;
  project_name: string;
  company_name: string;
  company_id: string | null;
  consultant_id: string | null;
  consultant_name: string | null;
  is_overdue: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UnassignedTasksDialog = ({ open, onOpenChange }: Props) => {
  const [tasks, setTasks] = useState<UnassignedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchUnassignedTasks();
      setSelectedIds(new Set());
    }
  }, [open]);

  const fetchUnassignedTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select(`
          id,
          title,
          due_date,
          status,
          priority,
          project_id,
          project:onboarding_projects(
            id,
            product_name,
            status,
            onboarding_company_id,
            onboarding_company:onboarding_companies(
              id,
              name,
              status,
              is_simulator,
              consultant_id,
              consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(id, name)
            )
          )
        `)
        .is("responsible_staff_id", null)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error fetching unassigned tasks:", error);
        toast.error("Erro ao buscar tarefas");
        return;
      }

      const todayStart = startOfDay(new Date());

      const mapped: UnassignedTask[] = (data || [])
        .filter((task: any) => {
          const project = task.project;
          if (!project || project.status !== "active") return false;
          const company = project.onboarding_company;
          if (!company) return false;
          if (company.is_simulator) return false;
          if (company.status === "inactive" || company.status === "closed") return false;
          return true;
        })
        .map((task: any) => {
          const company = task.project?.onboarding_company;
          const isOverdue = task.due_date
            ? isBefore(parseDateLocal(task.due_date), todayStart)
            : false;

          return {
            id: task.id,
            title: task.title,
            due_date: task.due_date,
            status: task.status,
            priority: task.priority,
            project_id: task.project_id,
            project_name: task.project?.product_name || "Projeto",
            company_name: company?.name || "Empresa",
            company_id: company?.id || null,
            consultant_id: company?.consultant?.id || null,
            consultant_name: company?.consultant?.name || null,
            is_overdue: isOverdue,
          };
        });

      setTasks(mapped);
    } catch (err) {
      console.error("Error:", err);
      toast.error("Erro ao buscar tarefas");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const assignable = tasks.filter((t) => t.consultant_id);
    if (selectedIds.size === assignable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assignable.map((t) => t.id)));
    }
  };

  const handleDistribute = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Selecione ao menos uma tarefa");
      return;
    }

    const tasksToAssign = tasks.filter(
      (t) => selectedIds.has(t.id) && t.consultant_id
    );

    if (tasksToAssign.length === 0) {
      toast.warning("Nenhuma tarefa selecionada possui consultor na empresa");
      return;
    }

    setAssigning(true);
    try {
      let successCount = 0;
      for (const task of tasksToAssign) {
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({ responsible_staff_id: task.consultant_id })
          .eq("id", task.id);

        if (!error) successCount++;
      }

      toast.success(`${successCount} tarefa(s) distribuída(s) com sucesso`);
      fetchUnassignedTasks();
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error distributing:", err);
      toast.error("Erro ao distribuir tarefas");
    } finally {
      setAssigning(false);
    }
  };

  const assignableCount = tasks.filter((t) => t.consultant_id).length;
  const selectedCount = selectedIds.size;
  const overdueCount = tasks.filter((t) => t.is_overdue).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-amber-500" />
            Tarefas sem Responsável
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 mb-2">
          <Badge variant="outline" className="text-sm py-1 px-3">
            {tasks.length} tarefa(s)
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-sm py-1 px-3">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {overdueCount} atrasada(s)
            </Badge>
          )}
          {assignableCount > 0 && (
            <Badge className="bg-emerald-500 text-sm py-1 px-3">
              {assignableCount} com consultor
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckSquare className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
            <p className="font-medium">Todas as tarefas possuem responsável!</p>
          </div>
        ) : (
          <>
            {/* Select all */}
            {assignableCount > 0 && (
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedIds.size === assignableCount && assignableCount > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todas com consultor ({assignableCount})
                </span>
              </div>
            )}

            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-2 pr-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      task.consultant_id
                        ? "hover:bg-muted/50 cursor-pointer"
                        : "opacity-60"
                    } ${selectedIds.has(task.id) ? "bg-primary/5 border-primary/30" : ""}`}
                    onClick={() => task.consultant_id && toggleSelect(task.id)}
                  >
                    <div className="flex items-start gap-3">
                      {task.consultant_id && (
                        <Checkbox
                          checked={selectedIds.has(task.id)}
                          onCheckedChange={() => toggleSelect(task.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">
                            {task.company_name} • {task.project_name}
                          </span>
                          {task.is_overdue && (
                            <Badge variant="destructive" className="text-[10px] py-0 h-4">
                              Atrasada
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className={`text-xs ${task.is_overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {formatDateLocal(task.due_date, "dd/MM/yyyy")}
                              </span>
                            </div>
                          )}
                          {task.consultant_id ? (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-emerald-300 text-emerald-600">
                              → {task.consultant_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-muted-foreground/40 text-muted-foreground">
                              Sem consultor na empresa
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t">
          <span className="text-xs text-muted-foreground">
            {selectedCount > 0 && `${selectedCount} selecionada(s)`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {assignableCount > 0 && (
              <Button
                onClick={handleDistribute}
                disabled={selectedCount === 0 || assigning}
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Distribuir para Consultor
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
