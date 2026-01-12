import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecurrenceSelector } from "@/components/onboarding-tasks/RecurrenceSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialTitle?: string;
  staffList: StaffMember[];
  onTaskAdded: () => void;
  currentSortOrder?: number;
}

const TASK_PHASES = [
  "Pré-Onboarding",
  "Onboarding & Setup",
  "Diagnóstico Comercial",
  "Desenho do Processo",
  "Implementação CRM",
  "Playbook & Padronização",
  "Treinamento & Adoção",
  "Estabilização & Governança",
];

export const AddTaskDialog = ({
  open,
  onOpenChange,
  projectId,
  initialTitle = "",
  staffList,
  onTaskAdded,
  currentSortOrder = 0,
}: AddTaskDialogProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [phase, setPhase] = useState<string>("");
  const [responsibleStaffId, setResponsibleStaffId] = useState<string>("");
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens with new initial title
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription("");
      setDueDate(undefined);
      setPhase("");
      setResponsibleStaffId("");
      setRecurrence(null);
    }
  }, [open, initialTitle]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Digite o título da tarefa");
      return;
    }

    setLoading(true);
    try {
      const insertData: any = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        tags: phase ? [phase] : null,
        responsible_staff_id: responsibleStaffId || null,
        recurrence: recurrence,
        sort_order: currentSortOrder + 1,
        status: "pending",
      };

      const { error } = await supabase.from("onboarding_tasks").insert(insertData);

      if (error) throw error;

      toast.success(recurrence ? "Tarefa recorrente criada!" : "Tarefa criada com sucesso!");
      onTaskAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título da tarefa"
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os detalhes da tarefa..."
              rows={3}
            />
          </div>

          {/* Data de entrega */}
          <div className="space-y-2">
            <Label>Data de Entrega</Label>
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
                  {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Fase */}
          <div className="space-y-2">
            <Label>Fase</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fase..." />
              </SelectTrigger>
              <SelectContent>
                {TASK_PHASES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável (Staff)</Label>
            <Select value={responsibleStaffId} onValueChange={setResponsibleStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável..." />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name} ({staff.role === "admin" ? "Admin" : staff.role === "cs" ? "CS" : "Consultor"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recorrência */}
          <RecurrenceSelector
            value={recurrence}
            onChange={setRecurrence}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
