import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Wand2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format, addDays, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toDateString, getTodayLocal } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface OnboardingTask {
  id: string;
  title: string;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  sort_order: number;
}

interface ReorganizeTasksDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: OnboardingTask[];
  projectId: string;
  onTasksUpdated: () => void;
}

type StatusFilter = "pending" | "in_progress" | "pending_and_in_progress" | "overdue" | "overdue_and_pending";

export const ReorganizeTasksDatesDialog = ({
  open,
  onOpenChange,
  tasks,
  projectId,
  onTasksUpdated,
}: ReorganizeTasksDatesDialogProps) => {
  const [days, setDays] = useState<number>(90);
  const [startDate, setStartDate] = useState<Date>(getTodayLocal());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("overdue_and_pending");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const today = startOfDay(new Date());

  const isOverdue = (task: OnboardingTask) => {
    if (task.status === "completed" || !task.due_date) return false;
    return isBefore(startOfDay(parseISO(task.due_date)), today);
  };

  // Filter tasks based on selected status
  const getFilteredTasks = () => {
    return tasks.filter(task => {
      if (statusFilter === "pending") return task.status === "pending" && !isOverdue(task);
      if (statusFilter === "in_progress") return task.status === "in_progress";
      if (statusFilter === "pending_and_in_progress") 
        return task.status === "pending" || task.status === "in_progress";
      if (statusFilter === "overdue") return isOverdue(task);
      if (statusFilter === "overdue_and_pending") 
        return isOverdue(task) || (task.status === "pending" && !isOverdue(task));
      return false;
    }).sort((a, b) => {
      // Sort by current due_date first, then by sort_order
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return a.sort_order - b.sort_order;
    });
  };

  const filteredTasks = getFilteredTasks();

  // Calculate new dates proportionally
  const calculateNewDates = () => {
    if (filteredTasks.length === 0) return [];
    
    const taskCount = filteredTasks.length;
    const intervalDays = taskCount > 1 ? days / (taskCount - 1) : 0;
    
    return filteredTasks.map((task, index) => {
      const newDate = addDays(startDate, Math.round(intervalDays * index));
      return {
        ...task,
        newDueDate: newDate,
      };
    });
  };

  const previewTasks = calculateNewDates();

  const handleReorganize = async () => {
    if (filteredTasks.length === 0) {
      toast.error("Nenhuma tarefa para reorganizar");
      return;
    }

    setLoading(true);
    try {
      const updates = previewTasks.map(task => ({
        id: task.id,
        due_date: toDateString(task.newDueDate),
      }));

      // Update tasks in batches
      for (const update of updates) {
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({ due_date: update.due_date })
          .eq("id", update.id);
        
        if (error) throw error;
      }

      toast.success(`${updates.length} tarefas reorganizadas com sucesso!`);
      onTasksUpdated();
      onOpenChange(false);
      setShowPreview(false);
    } catch (error) {
      console.error("Error reorganizing tasks:", error);
      toast.error("Erro ao reorganizar tarefas");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (filter: StatusFilter) => {
    switch (filter) {
      case "pending": return "Pendentes (no prazo)";
      case "in_progress": return "Em andamento";
      case "pending_and_in_progress": return "Pendentes + Em andamento";
      case "overdue": return "Atrasadas";
      case "overdue_and_pending": return "Atrasadas + Pendentes";
    }
  };

  const endDate = addDays(startDate, days);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Reorganizar Datas das Tarefas
          </DialogTitle>
          <DialogDescription>
            Redistribua as datas das tarefas proporcionalmente em um período específico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status filter */}
          <div className="space-y-2">
            <Label>Quais tarefas reorganizar?</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overdue_and_pending">Atrasadas + Pendentes</SelectItem>
                <SelectItem value="overdue">Apenas Atrasadas</SelectItem>
                <SelectItem value="pending">Apenas Pendentes (no prazo)</SelectItem>
                <SelectItem value="in_progress">Apenas Em andamento</SelectItem>
                <SelectItem value="pending_and_in_progress">Pendentes + Em andamento</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {filteredTasks.length} tarefa(s) serão reorganizadas
            </p>
          </div>

          {/* Start date */}
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Period in days */}
          <div className="space-y-2">
            <Label>Período (em dias)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24"
              />
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setDays(30)}>30d</Button>
                <Button variant="outline" size="sm" onClick={() => setDays(60)}>60d</Button>
                <Button variant="outline" size="sm" onClick={() => setDays(90)}>90d</Button>
                <Button variant="outline" size="sm" onClick={() => setDays(180)}>180d</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tarefas serão distribuídas de {format(startDate, "dd/MM/yyyy", { locale: ptBR })} até {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* Preview toggle */}
          {filteredTasks.length > 0 && (
            <div className="space-y-3">
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(!showPreview)}
                className="w-full"
              >
                {showPreview ? "Ocultar prévia" : "Ver prévia das alterações"}
              </Button>

              {showPreview && (
                <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2 bg-muted/30">
                  <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                    <span>Tarefa</span>
                    <span>Data atual</span>
                    <span>Nova data</span>
                  </div>
                  {previewTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="grid grid-cols-[1fr,auto,auto] gap-2 items-center text-sm"
                    >
                      <span className="truncate">{task.title}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {task.due_date 
                          ? format(new Date(task.due_date), "dd/MM", { locale: ptBR })
                          : "Sem data"
                        }
                      </Badge>
                      <Badge className="text-xs bg-primary">
                        {format(task.newDueDate, "dd/MM", { locale: ptBR })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Warning */}
          {filteredTasks.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-600">Atenção</p>
                <p className="text-muted-foreground">
                  Esta ação irá substituir as datas de vencimento de {filteredTasks.length} tarefa(s). 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
          )}

          {filteredTasks.length === 0 && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <div className="text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma tarefa {getStatusLabel(statusFilter).toLowerCase()} encontrada</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleReorganize} 
            disabled={loading || filteredTasks.length === 0}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reorganizando...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Reorganizar {filteredTasks.length} tarefa(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
