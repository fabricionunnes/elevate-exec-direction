import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, FileText, Edit, Globe, Users, User } from "lucide-react";

interface Task {
  id: string;
  track_id: string;
  title: string;
  description: string | null;
  task_type: string;
  due_days: number | null;
  support_material_url: string | null;
  sort_order: number;
  is_active: boolean;
  scope: string;
  cohort_id: string | null;
  participant_id: string | null;
  track_name?: string;
  cohort_name?: string;
  participant_name?: string;
}

interface Track { id: string; name: string; }
interface Cohort { id: string; name: string; }
interface Participant { id: string; full_name: string; cohort_id: string; }

const TASK_TYPES = [
  { value: "reading", label: "Leitura de Livro" },
  { value: "summary", label: "Resumo de Capítulo" },
  { value: "practical", label: "Aplicação Prática" },
  { value: "leadership", label: "Exercício de Liderança" },
  { value: "case_study", label: "Estudo de Caso" },
  { value: "other", label: "Outro" },
];

const SCOPE_OPTIONS = [
  { value: "global", label: "Global (Todas as turmas)" },
  { value: "cohort", label: "Turma específica" },
  { value: "participant", label: "Participante específico" },
];

export default function PDITasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTrack, setFilterTrack] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", task_type: "practical", due_days: "",
    support_material_url: "", track_id: "",
    scope: "global", cohort_id: "", participant_id: "",
  });

  const fetchData = useCallback(async () => {
    const [tasksRes, tracksRes, cohortsRes, participantsRes] = await Promise.all([
      supabase.from("pdi_tasks").select("*").order("sort_order").order("created_at", { ascending: false }),
      supabase.from("pdi_tracks").select("id, name").eq("is_active", true).order("name"),
      supabase.from("pdi_cohorts").select("id, name").order("name"),
      supabase.from("pdi_participants").select("id, full_name, cohort_id").eq("status", "active").order("full_name"),
    ]);
    const tracksList = (tracksRes.data as any[]) || [];
    const cohortsList = (cohortsRes.data as any[]) || [];
    const participantsList = (participantsRes.data as any[]) || [];
    setTracks(tracksList);
    setCohorts(cohortsList);
    setParticipants(participantsList);

    const trackMap = new Map(tracksList.map((t) => [t.id, t.name]));
    const cohortMap = new Map(cohortsList.map((c) => [c.id, c.name]));
    const participantMap = new Map(participantsList.map((p) => [p.id, p.full_name]));

    setTasks(((tasksRes.data as any[]) || []).map((t) => ({
      ...t,
      track_name: trackMap.get(t.track_id) || "—",
      cohort_name: t.cohort_id ? cohortMap.get(t.cohort_id) : undefined,
      participant_name: t.participant_id ? participantMap.get(t.participant_id) : undefined,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ title: "", description: "", task_type: "practical", due_days: "", support_material_url: "", track_id: "", scope: "global", cohort_id: "", participant_id: "" });
    setEditingTask(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.track_id) { toast.error("Título e trilha são obrigatórios"); return; }
    if (form.scope === "cohort" && !form.cohort_id) { toast.error("Selecione uma turma"); return; }
    if (form.scope === "participant" && !form.participant_id) { toast.error("Selecione um participante"); return; }

    setSaving(true);
    const payload: any = {
      title: form.title, description: form.description || null,
      task_type: form.task_type, due_days: form.due_days ? parseInt(form.due_days) : null,
      support_material_url: form.support_material_url || null, track_id: form.track_id,
      scope: form.scope,
      cohort_id: form.scope === "cohort" ? form.cohort_id : form.scope === "participant" ? (participants.find(p => p.id === form.participant_id)?.cohort_id || null) : null,
      participant_id: form.scope === "participant" ? form.participant_id : null,
    };

    if (editingTask) {
      await supabase.from("pdi_tasks").update(payload).eq("id", editingTask.id);
      toast.success("Tarefa atualizada!");
    } else {
      await supabase.from("pdi_tasks").insert(payload);
      toast.success("Tarefa criada!");
    }
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title, description: task.description || "",
      task_type: task.task_type, due_days: task.due_days ? String(task.due_days) : "",
      support_material_url: task.support_material_url || "", track_id: task.track_id,
      scope: task.scope || "global",
      cohort_id: task.cohort_id || "",
      participant_id: task.participant_id || "",
    });
    setDialogOpen(true);
  };

  const toggleActive = async (task: Task) => {
    await supabase.from("pdi_tasks").update({ is_active: !task.is_active }).eq("id", task.id);
    fetchData();
    toast.success(task.is_active ? "Tarefa desativada" : "Tarefa ativada");
  };

  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchTrack = filterTrack === "all" || t.track_id === filterTrack;
    const matchScope = filterScope === "all" || t.scope === filterScope;
    return matchSearch && matchTrack && matchScope;
  });

  const getTypeLabel = (val: string) => TASK_TYPES.find((t) => t.value === val)?.label || val;

  const getScopeLabel = (task: Task) => {
    if (task.scope === "participant") return `👤 ${task.participant_name || "Participante"}`;
    if (task.scope === "cohort") return `👥 ${task.cohort_name || "Turma"}`;
    return "🌐 Global";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas e Leituras</h1>
          <p className="text-sm text-muted-foreground">Crie tarefas globais ou específicas por turma/participante</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova Tarefa
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTrack} onValueChange={setFilterTrack}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as trilhas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as trilhas</SelectItem>
            {tracks.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterScope} onValueChange={setFilterScope}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os escopos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os escopos</SelectItem>
            <SelectItem value="global">🌐 Globais</SelectItem>
            <SelectItem value="cohort">👥 Por turma</SelectItem>
            <SelectItem value="participant">👤 Por participante</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhuma tarefa encontrada.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((task) => (
            <Card key={task.id} className={`hover:border-primary/30 transition-colors ${!task.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground">{task.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{getTypeLabel(task.task_type)}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Trilha: {task.track_name}</span>
                        {task.due_days && <span>• Prazo: {task.due_days} dias</span>}
                        <span>• {getScopeLabel(task)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(task)}>
                      <Edit className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(task)}>
                      {task.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trilha *</Label>
                <Select value={form.track_id} onValueChange={(v) => setForm({ ...form, track_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{tracks.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prazo (dias)</Label><Input type="number" value={form.due_days} onChange={(e) => setForm({ ...form, due_days: e.target.value })} /></div>
              <div><Label>Material de Apoio (URL)</Label><Input value={form.support_material_url} onChange={(e) => setForm({ ...form, support_material_url: e.target.value })} /></div>
            </div>

            {/* Scope */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Label className="font-semibold">Escopo da Tarefa</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v, cohort_id: "", participant_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>

              {form.scope === "cohort" && (
                <div>
                  <Label>Turma *</Label>
                  <Select value={form.cohort_id} onValueChange={(v) => setForm({ ...form, cohort_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a turma..." /></SelectTrigger>
                    <SelectContent>
                      {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.scope === "participant" && (
                <div>
                  <Label>Participante *</Label>
                  <Select value={form.participant_id} onValueChange={(v) => setForm({ ...form, participant_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o participante..." /></SelectTrigger>
                    <SelectContent>
                      {participants.map((p) => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingTask ? "Salvar Alterações" : "Criar Tarefa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
