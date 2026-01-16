import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Plus, CalendarIcon, CheckSquare, AlertCircle, Clock, Star } from "lucide-react";
import { format, isToday, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  priority: string;
  related_area: string | null;
  due_date: string | null;
  status: string;
  is_strategic: boolean;
  observations: string | null;
}

const PRIORITIES = [
  { value: "alta", label: "Alta", color: "bg-red-500" },
  { value: "media", label: "Média", color: "bg-yellow-500" },
  { value: "baixa", label: "Baixa", color: "bg-green-500" },
];

const AREAS = [
  "Vendas", "Financeiro", "Produto", "Pessoas", "Marketing", "Operações", "Estratégia"
];

export function CEOTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "overdue" | "strategic">("all");
  const [formData, setFormData] = useState({
    title: "",
    priority: "media",
    related_area: "",
    due_date: null as Date | null,
    is_strategic: false,
    observations: "",
  });

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("ceo_tasks")
        .select("*")
        .neq("status", "cancelada")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error("Digite o título da tarefa");
      return;
    }

    try {
      const { error } = await supabase.from("ceo_tasks").insert({
        title: formData.title,
        priority: formData.priority,
        related_area: formData.related_area || null,
        due_date: formData.due_date ? format(formData.due_date, "yyyy-MM-dd") : null,
        is_strategic: formData.is_strategic,
        observations: formData.observations || null,
        status: "pendente",
      });

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        title: "",
        priority: "media",
        related_area: "",
        due_date: null,
        is_strategic: false,
        observations: "",
      });
      fetchTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    try {
      const newStatus = task.status === "concluida" ? "pendente" : "concluida";
      const { error } = await supabase
        .from("ceo_tasks")
        .update({ status: newStatus })
        .eq("id", task.id);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const getPriorityConfig = (priority: string) => PRIORITIES.find(p => p.value === priority);

  const filteredTasks = tasks.filter(task => {
    if (filter === "today") {
      return task.due_date && isToday(new Date(task.due_date)) && task.status !== "concluida";
    }
    if (filter === "overdue") {
      return task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== "concluida";
    }
    if (filter === "strategic") {
      return task.is_strategic && task.status !== "concluida";
    }
    return true;
  });

  const todayTasks = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== "concluida");
  const overdueTasks = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "concluida");
  const strategicTasks = tasks.filter(t => t.is_strategic && t.status !== "concluida");

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-green-500" />
          Tarefas do CEO
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Nova Tarefa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="O que precisa ser feito?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Área</Label>
                  <Select value={formData.related_area} onValueChange={(v) => setFormData({ ...formData, related_area: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Prazo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "PPP", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.due_date || undefined}
                      onSelect={(d) => setFormData({ ...formData, due_date: d || null })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="strategic"
                  checked={formData.is_strategic}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_strategic: !!checked })}
                />
                <Label htmlFor="strategic" className="flex items-center gap-1 cursor-pointer">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Tarefa Estratégica
                </Label>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Detalhes adicionais..."
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Criar Tarefa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setFilter(filter === "today" ? "all" : "today")}
            className={cn(
              "p-3 rounded-lg border text-center transition-colors",
              filter === "today" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Clock className="h-4 w-4 mx-auto mb-1" />
            <p className="text-2xl font-bold">{todayTasks.length}</p>
            <p className="text-xs">Hoje</p>
          </button>
          <button
            onClick={() => setFilter(filter === "overdue" ? "all" : "overdue")}
            className={cn(
              "p-3 rounded-lg border text-center transition-colors",
              filter === "overdue" ? "bg-red-500 text-white" : overdueTasks.length > 0 ? "border-red-500" : "hover:bg-muted"
            )}
          >
            <AlertCircle className="h-4 w-4 mx-auto mb-1" />
            <p className="text-2xl font-bold">{overdueTasks.length}</p>
            <p className="text-xs">Atrasadas</p>
          </button>
          <button
            onClick={() => setFilter(filter === "strategic" ? "all" : "strategic")}
            className={cn(
              "p-3 rounded-lg border text-center transition-colors",
              filter === "strategic" ? "bg-yellow-500 text-white" : "hover:bg-muted"
            )}
          >
            <Star className="h-4 w-4 mx-auto mb-1" />
            <p className="text-2xl font-bold">{strategicTasks.length}</p>
            <p className="text-xs">Estratégicas</p>
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {filter === "all" ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa nesta categoria"}
            </p>
          ) : (
            filteredTasks.map((task) => {
              const priorityConfig = getPriorityConfig(task.priority);
              const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
              const isDone = task.status === "concluida";

              return (
                <div
                  key={task.id}
                  className={cn(
                    "p-3 rounded-lg border flex items-center gap-3 transition-colors",
                    isDone && "opacity-50",
                    isOverdue && !isDone && "border-red-500"
                  )}
                >
                  <Checkbox
                    checked={isDone}
                    onCheckedChange={() => toggleTaskStatus(task)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {task.is_strategic && <Star className="h-4 w-4 text-yellow-500" />}
                      <span className={cn("font-medium", isDone && "line-through")}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={cn("text-white text-xs", priorityConfig?.color)}>
                        {priorityConfig?.label}
                      </Badge>
                      {task.related_area && (
                        <Badge variant="outline" className="text-xs">
                          {task.related_area}
                        </Badge>
                      )}
                      {task.due_date && (
                        <span className={cn(
                          "text-xs",
                          isOverdue && !isDone ? "text-red-500 font-medium" : "text-muted-foreground"
                        )}>
                          {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
