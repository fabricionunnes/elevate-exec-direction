import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, ListTodo, Calendar as CalIcon, Columns3, Target, TrendingUp } from "lucide-react";
import { ACTION_CATEGORIES, ACTION_STATUSES, MONTH_NAMES, type CommercialAction } from "../types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal, toDateString } from "@/lib/dateUtils";

interface Props {
  projectId: string;
  staffList: { id: string; name: string; role: string }[];
  consultantStaffId?: string | null;
}

export const CommercialActionsCompanyTab = ({ projectId, staffList, consultantStaffId }: Props) => {
  const [actions, setActions] = useState<CommercialAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showForm, setShowForm] = useState(false);
  const [editingAction, setEditingAction] = useState<CommercialAction | null>(null);
  const [showDetail, setShowDetail] = useState<CommercialAction | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", objective: "", category: "Prospecção",
    step_by_step: "", script: "", start_date: "", deadline: "",
    responsible_staff_id: "", priority: "medium", goal: "", result: "",
    status: "planned", recurrence: "", month: "", week: "",
    year: new Date().getFullYear().toString(),
  });

  useEffect(() => { fetchActions(); }, [projectId]);

  const fetchActions = async () => {
    const { data } = await supabase
      .from("commercial_actions")
      .select("*, responsible_staff:onboarding_staff!commercial_actions_responsible_staff_id_fkey(id, name, avatar_url)")
      .eq("project_id", projectId)
      .order("month").order("week").order("created_at");
    setActions((data as any[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", objective: "", category: "Prospecção",
      step_by_step: "", script: "", start_date: "", deadline: "",
      responsible_staff_id: consultantStaffId || "", priority: "medium",
      goal: "", result: "", status: "planned", recurrence: "",
      month: "", week: "", year: new Date().getFullYear().toString(),
    });
    setEditingAction(null);
  };

  const handleEdit = (a: CommercialAction) => {
    setEditingAction(a);
    setForm({
      title: a.title, description: a.description || "", objective: a.objective || "",
      category: a.category, step_by_step: a.step_by_step || "", script: a.script || "",
      start_date: a.start_date || "", deadline: a.deadline || "",
      responsible_staff_id: a.responsible_staff_id || "", priority: a.priority,
      goal: a.goal || "", result: a.result || "", status: a.status,
      recurrence: a.recurrence || "", month: a.month?.toString() || "",
      week: a.week?.toString() || "", year: a.year?.toString() || new Date().getFullYear().toString(),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload = {
      project_id: projectId,
      title: form.title, description: form.description || null,
      objective: form.objective || null, category: form.category,
      step_by_step: form.step_by_step || null, script: form.script || null,
      start_date: form.start_date || null, deadline: form.deadline || null,
      responsible_staff_id: form.responsible_staff_id || null,
      priority: form.priority, goal: form.goal || null,
      result: form.result || null, status: form.status,
      recurrence: form.recurrence || null,
      month: form.month ? parseInt(form.month) : null,
      week: form.week ? parseInt(form.week) : null,
      year: form.year ? parseInt(form.year) : new Date().getFullYear(),
    };

    if (editingAction) {
      const { error } = await supabase.from("commercial_actions")
        .update(payload as any).eq("id", editingAction.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Ação atualizada");
    } else {
      const { error } = await supabase.from("commercial_actions")
        .insert(payload as any);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Ação criada");
    }
    setShowForm(false);
    resetForm();
    fetchActions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta ação?")) return;
    await supabase.from("commercial_actions").delete().eq("id", id);
    toast.success("Ação excluída");
    fetchActions();
  };

  const handleCreateTask = async (action: CommercialAction) => {
    try {
      const { error } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        title: action.title,
        description: [action.description, action.step_by_step].filter(Boolean).join("\n\n"),
        due_date: action.deadline,
        start_date: action.start_date,
        responsible_staff_id: action.responsible_staff_id,
        status: "pending",
        priority: action.priority,
        tags: ["calendario_acoes"],
      });
      if (error) throw error;

      // Update action with task reference
      await supabase.from("commercial_actions")
        .update({ status: "in_progress" } as any).eq("id", action.id);

      toast.success("Tarefa criada na Jornada!");
      fetchActions();
    } catch {
      toast.error("Erro ao criar tarefa");
    }
  };

  const filtered = actions.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = ACTION_STATUSES.find(st => st.value === status);
    return <Badge className={s?.color || ""}>{s?.label || status}</Badge>;
  };

  // Kanban columns
  const kanbanColumns = useMemo(() => {
    const cols: Record<string, CommercialAction[]> = {
      planned: [], in_progress: [], completed: [],
    };
    filtered.forEach(a => {
      if (cols[a.status]) cols[a.status].push(a);
      else cols.planned.push(a);
    });
    return cols;
  }, [filtered]);

  const handleDragStatusChange = async (actionId: string, newStatus: string) => {
    await supabase.from("commercial_actions").update({ status: newStatus } as any).eq("id", actionId);
    fetchActions();
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = actions.length;
    const planned = actions.filter(a => a.status === "planned").length;
    const inProgress = actions.filter(a => a.status === "in_progress").length;
    const completed = actions.filter(a => a.status === "completed").length;
    const overdue = actions.filter(a => a.status === "overdue").length;
    const withGoal = actions.filter(a => a.goal);
    const goalsAchieved = actions.filter(a => a.result && a.goal).length;
    return { total, planned, inProgress, completed, overdue, goalsAchieved, withGoals: withGoal.length };
  }, [actions]);

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-2xl font-bold">{metrics.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-yellow-600">{metrics.inProgress}</div>
          <div className="text-xs text-muted-foreground">Em execução</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-green-600">{metrics.completed}</div>
          <div className="text-xs text-muted-foreground">Concluídas</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-red-600">{metrics.overdue}</div>
          <div className="text-xs text-muted-foreground">Atrasadas</div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar ação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ACTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ACTION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="rounded-r-none">
              <ListTodo className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("kanban")} className="rounded-l-none">
              <Columns3 className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Ação
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["planned", "in_progress", "completed"] as const).map(status => {
            const statusInfo = ACTION_STATUSES.find(s => s.value === status);
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <Badge className={statusInfo?.color}>{statusInfo?.label}</Badge>
                  <span className="text-sm text-muted-foreground">({kanbanColumns[status]?.length || 0})</span>
                </div>
                <div className="space-y-2 min-h-[100px] p-2 bg-muted/30 rounded-lg">
                  {(kanbanColumns[status] || []).map(action => (
                    <Card key={action.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDetail(action)}>
                      <CardContent className="p-3 space-y-2">
                        <div className="font-medium text-sm">{action.title}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{action.category}</Badge>
                          {action.responsible_staff && (
                            <span className="text-xs text-muted-foreground">{action.responsible_staff.name}</span>
                          )}
                        </div>
                        {action.goal && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" /> {action.goal}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma ação encontrada</p>
            </div>
          ) : filtered.map(action => (
            <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setShowDetail(action)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{action.title}</span>
                  {getStatusBadge(action.status)}
                  <Badge variant="outline" className="text-xs">{action.category}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {action.responsible_staff && <span>{action.responsible_staff.name}</span>}
                  {action.deadline && <span>Prazo: {format(parseDateLocal(action.deadline), "dd/MM/yyyy")}</span>}
                  {action.goal && <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {action.goal}</span>}
                  {action.result && <span className="flex items-center gap-1 text-green-600"><TrendingUp className="h-3 w-3" /> {action.result}</span>}
                </div>
              </div>
              <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(action)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCreateTask(action)} title="Criar tarefa na Jornada">
                  <ListTodo className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(action.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      {showDetail && (
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showDetail.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {getStatusBadge(showDetail.status)}
                <Badge variant="outline">{showDetail.category}</Badge>
              </div>
              {showDetail.description && <div><Label className="text-xs text-muted-foreground">Descrição</Label><p className="text-sm">{showDetail.description}</p></div>}
              {showDetail.objective && <div><Label className="text-xs text-muted-foreground">Objetivo</Label><p className="text-sm">{showDetail.objective}</p></div>}
              {showDetail.step_by_step && <div><Label className="text-xs text-muted-foreground">Passo a Passo</Label><p className="text-sm whitespace-pre-wrap">{showDetail.step_by_step}</p></div>}
              {showDetail.script && <div><Label className="text-xs text-muted-foreground">Script</Label><p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">{showDetail.script}</p></div>}
              <div className="grid grid-cols-2 gap-3">
                {showDetail.goal && <div><Label className="text-xs text-muted-foreground">Meta</Label><p className="text-sm font-medium">{showDetail.goal}</p></div>}
                {showDetail.result && <div><Label className="text-xs text-muted-foreground">Resultado</Label><p className="text-sm font-medium text-green-600">{showDetail.result}</p></div>}
                {showDetail.responsible_staff && <div><Label className="text-xs text-muted-foreground">Responsável</Label><p className="text-sm">{showDetail.responsible_staff.name}</p></div>}
                {showDetail.deadline && <div><Label className="text-xs text-muted-foreground">Prazo</Label><p className="text-sm">{format(parseDateLocal(showDetail.deadline), "dd/MM/yyyy")}</p></div>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { handleEdit(showDetail); setShowDetail(null); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </Button>
                <Button className="flex-1" onClick={() => { handleCreateTask(showDetail); setShowDetail(null); }}>
                  <ListTodo className="h-4 w-4 mr-2" /> Criar Tarefa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) resetForm(); setShowForm(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAction ? "Editar Ação" : "Nova Ação Comercial"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.responsible_staff_id || "none"} onValueChange={v => setForm({ ...form, responsible_staff_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalIcon className="mr-2 h-4 w-4" />
                    {form.start_date ? format(parseDateLocal(form.start_date), "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.start_date ? parseDateLocal(form.start_date) : undefined}
                    onSelect={d => setForm({ ...form, start_date: d ? toDateString(d) : "" })} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalIcon className="mr-2 h-4 w-4" />
                    {form.deadline ? format(parseDateLocal(form.deadline), "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.deadline ? parseDateLocal(form.deadline) : undefined}
                    onSelect={d => setForm({ ...form, deadline: d ? toDateString(d) : "" })} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={form.month || "none"} onValueChange={v => setForm({ ...form, month: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semana</Label>
              <Select value={form.week || "none"} onValueChange={v => setForm({ ...form, week: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {[1, 2, 3, 4, 5].map(w => <SelectItem key={w} value={String(w)}>Semana {w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meta</Label>
              <Input value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} placeholder="Ex: 50 leads gerados" />
            </div>
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Input value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} placeholder="Preenchido após execução" />
            </div>
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={form.recurrence || "none"} onValueChange={v => setForm({ ...form, recurrence: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Objetivo</Label>
              <Input value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Passo a Passo</Label>
              <Textarea value={form.step_by_step} onChange={e => setForm({ ...form, step_by_step: e.target.value })} rows={3} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Script</Label>
              <Textarea value={form.script} onChange={e => setForm({ ...form, script: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave}>{editingAction ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
