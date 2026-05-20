import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { ACTION_STATUSES, MONTH_NAMES, COMMERCIAL_NICHES, type CommercialAction } from "../types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateLocal, toDateString } from "@/lib/dateUtils";
import { ACTION_CATEGORIES } from "../types";

interface Props {
  projectId: string;
  companySegment?: string | null;
  consultantStaffId?: string | null;
  staffList: { id: string; name: string; role: string }[];
}

export const CommercialActionsCalendarTab = ({ projectId, companySegment, consultantStaffId, staffList }: Props) => {
  const [actions, setActions] = useState<CommercialAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedNiche, setSelectedNiche] = useState(companySegment || "");

  // Edit state
  const [editingAction, setEditingAction] = useState<CommercialAction | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", objective: "", category: "Prospecção",
    step_by_step: "", script: "", start_date: "", deadline: "",
    responsible_staff_id: "", priority: "medium", goal: "", result: "",
    status: "planned", recurrence: "", month: "", week: "",
    year: new Date().getFullYear().toString(),
  });

  useEffect(() => { fetchActions(); }, [projectId, selectedYear]);

  const fetchActions = async () => {
    const { data } = await supabase
      .from("commercial_actions")
      .select("*, responsible_staff:onboarding_staff!commercial_actions_responsible_staff_id_fkey(id, name, avatar_url)")
      .eq("project_id", projectId)
      .eq("year", selectedYear)
      .order("month").order("week").order("created_at");
    setActions((data as any[]) || []);
    setLoading(false);
  };

  const monthActions = useMemo(() => {
    return actions.filter(a => a.month === selectedMonth);
  }, [actions, selectedMonth]);

  const weekGroups = useMemo(() => {
    const groups: Record<number, CommercialAction[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    monthActions.forEach(a => {
      const w = a.week || 1;
      if (!groups[w]) groups[w] = [];
      groups[w].push(a);
    });
    return groups;
  }, [monthActions]);

  const getStatusBadge = (status: string) => {
    const s = ACTION_STATUSES.find(st => st.value === status);
    return <Badge className={`text-xs ${s?.color || ""}`}>{s?.label || status}</Badge>;
  };

  const handleGenerate = async () => {
    const niche = selectedNiche || companySegment;
    if (!niche) {
      toast.error("Selecione o nicho da empresa para gerar ações");
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke("generate-commercial-actions", {
        body: {
          project_id: projectId,
          niche,
          year: selectedYear,
          consultant_staff_id: consultantStaffId,
        },
      });

      if (response.error) throw response.error;

      toast.success(`Ações geradas com sucesso para ${niche}!`);
      fetchActions();
    } catch (error: any) {
      console.error("Error generating actions:", error);
      toast.error("Erro ao gerar ações: " + (error.message || "Tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  const yearStats = useMemo(() => {
    const total = actions.length;
    const completed = actions.filter(a => a.status === "completed").length;
    const inProgress = actions.filter(a => a.status === "in_progress").length;
    return { total, completed, inProgress, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [actions]);

  const handleEdit = (a: CommercialAction) => {
    setEditingAction(a);
    setForm({
      title: a.title, description: a.description || "", objective: a.objective || "",
      category: a.category, step_by_step: a.step_by_step || "", script: a.script || "",
      start_date: a.start_date || "", deadline: a.deadline || "",
      responsible_staff_id: a.responsible_staff_id || "", priority: a.priority,
      goal: a.goal || "", result: a.result || "", status: a.status,
      recurrence: a.recurrence || "", month: a.month?.toString() || "",
      week: a.week?.toString() || "", year: a.year?.toString() || selectedYear.toString(),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    if (!editingAction) return;

    const payload = {
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
      year: form.year ? parseInt(form.year) : selectedYear,
    };

    const { error } = await supabase.from("commercial_actions")
      .update(payload as any).eq("id", editingAction.id);
    if (error) { toast.error("Erro ao atualizar"); console.error(error); return; }
    toast.success("Ação atualizada");
    setShowForm(false);
    setEditingAction(null);
    fetchActions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta ação?")) return;
    await supabase.from("commercial_actions").delete().eq("id", id);
    toast.success("Ação excluída");
    fetchActions();
  };

  return (
    <div className="space-y-4">
      {/* Year navigation and generate */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xl font-bold">{selectedYear}</span>
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <span>{yearStats.total} ações</span>
            <span>•</span>
            <span className="text-green-600">{yearStats.completed} concluídas</span>
            <span>•</span>
            <span>{yearStats.rate}% taxa</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!companySegment && (
            <Select value={selectedNiche || "none"} onValueChange={v => setSelectedNiche(v === "none" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o nicho..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione o nicho</SelectItem>
                {COMMERCIAL_NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar Calendário com IA"}
          </Button>
        </div>
      </div>

      {/* Month selector - horizontal scrollable */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {MONTH_NAMES.map((name, idx) => {
          const monthNum = idx + 1;
          const count = actions.filter(a => a.month === monthNum).length;
          return (
            <Button
              key={monthNum}
              variant={selectedMonth === monthNum ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMonth(monthNum)}
              className="whitespace-nowrap relative"
            >
              {name.substring(0, 3)}
              {count > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{count}</Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Calendar content - weeks */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : monthActions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma ação para {MONTH_NAMES[selectedMonth - 1]}</p>
          <p className="text-sm mt-1">Clique em "Gerar Calendário com IA" para criar ações automaticamente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(weekGroups).map(([week, weekActions]) => {
            if (weekActions.length === 0) return null;
            return (
              <Card key={week}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Semana {week}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {weekActions.map(action => (
                      <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{action.title}</span>
                            {getStatusBadge(action.status)}
                            <Badge variant="outline" className="text-xs">{action.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {action.responsible_staff && <span>{action.responsible_staff.name}</span>}
                            {action.goal && <span>Meta: {action.goal}</span>}
                            {action.result && <span className="text-green-600">Resultado: {action.result}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(action)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(action.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditingAction(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Ação Comercial</DialogTitle>
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
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingAction(null); }}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
