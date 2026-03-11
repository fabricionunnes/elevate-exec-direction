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
import { Plus, Search, Route, Edit, Globe, Users, User } from "lucide-react";

interface Track {
  id: string;
  name: string;
  description: string | null;
  category: string;
  total_hours: number;
  is_active: boolean;
  sort_order: number;
  scope: string;
  cohort_id: string | null;
  participant_id: string | null;
  cohort_name?: string;
  participant_name?: string;
}

interface Cohort { id: string; name: string; }
interface Participant { id: string; full_name: string; cohort_id: string; }

const CATEGORIES = [
  { value: "leadership", label: "Liderança" },
  { value: "sales", label: "Vendas" },
  { value: "management", label: "Gestão" },
  { value: "performance", label: "Alta Performance" },
  { value: "mindset", label: "Mentalidade" },
  { value: "general", label: "Geral" },
];

const SCOPE_OPTIONS = [
  { value: "global", label: "Global (Todas as turmas)", icon: Globe },
  { value: "cohort", label: "Turma específica", icon: Users },
  { value: "participant", label: "Participante específico", icon: User },
];

export default function PDITracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterScope, setFilterScope] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", category: "general", total_hours: "0",
    scope: "global", cohort_id: "", participant_id: "",
  });

  const fetchData = useCallback(async () => {
    const [tracksRes, cohortsRes, participantsRes] = await Promise.all([
      supabase.from("pdi_tracks").select("*").order("sort_order").order("name"),
      supabase.from("pdi_cohorts").select("id, name").order("name"),
      supabase.from("pdi_participants").select("id, full_name, cohort_id").eq("status", "active").order("full_name"),
    ]);

    const cohortsList = (cohortsRes.data as any[]) || [];
    const participantsList = (participantsRes.data as any[]) || [];
    setCohorts(cohortsList);
    setParticipants(participantsList);

    const cohortMap = new Map(cohortsList.map((c) => [c.id, c.name]));
    const participantMap = new Map(participantsList.map((p) => [p.id, p.full_name]));

    setTracks(((tracksRes.data as any[]) || []).map((t) => ({
      ...t,
      cohort_name: t.cohort_id ? cohortMap.get(t.cohort_id) : undefined,
      participant_name: t.participant_id ? participantMap.get(t.participant_id) : undefined,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ name: "", description: "", category: "general", total_hours: "0", scope: "global", cohort_id: "", participant_id: "" });
    setEditingTrack(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome da trilha é obrigatório"); return; }
    if (form.scope === "cohort" && !form.cohort_id) { toast.error("Selecione uma turma"); return; }
    if (form.scope === "participant" && !form.participant_id) { toast.error("Selecione um participante"); return; }

    setSaving(true);
    const payload: any = {
      name: form.name, description: form.description || null,
      category: form.category, total_hours: parseInt(form.total_hours) || 0,
      scope: form.scope,
      cohort_id: form.scope === "cohort" ? form.cohort_id : form.scope === "participant" ? (participants.find(p => p.id === form.participant_id)?.cohort_id || null) : null,
      participant_id: form.scope === "participant" ? form.participant_id : null,
    };

    if (editingTrack) {
      await supabase.from("pdi_tracks").update(payload).eq("id", editingTrack.id);
      toast.success("Trilha atualizada!");
    } else {
      await supabase.from("pdi_tracks").insert(payload);
      toast.success("Trilha criada!");
    }
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    setForm({
      name: track.name, description: track.description || "",
      category: track.category, total_hours: String(track.total_hours),
      scope: track.scope || "global",
      cohort_id: track.cohort_id || "",
      participant_id: track.participant_id || "",
    });
    setDialogOpen(true);
  };

  const toggleActive = async (track: Track) => {
    await supabase.from("pdi_tracks").update({ is_active: !track.is_active }).eq("id", track.id);
    fetchData();
    toast.success(track.is_active ? "Trilha desativada" : "Trilha ativada");
  };

  const filtered = tracks.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchScope = filterScope === "all" || t.scope === filterScope;
    return matchSearch && matchScope;
  });

  const getCategoryLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label || val;

  const getScopeInfo = (track: Track) => {
    if (track.scope === "participant") return { label: track.participant_name || "Participante", icon: User, variant: "outline" as const };
    if (track.scope === "cohort") return { label: track.cohort_name || "Turma", icon: Users, variant: "secondary" as const };
    return { label: "Global", icon: Globe, variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trilhas de Desenvolvimento</h1>
          <p className="text-sm text-muted-foreground">Crie trilhas globais ou específicas por turma/participante</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova Trilha
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar trilha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
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
        <div className="text-center text-muted-foreground py-12">Nenhuma trilha encontrada.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((track) => {
            const scopeInfo = getScopeInfo(track);
            const ScopeIcon = scopeInfo.icon;
            return (
              <Card key={track.id} className={`hover:border-primary/30 transition-colors ${!track.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Route className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{track.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{getCategoryLabel(track.category)}</Badge>
                      </div>
                    </div>
                    {!track.is_active && <Badge variant="secondary">Inativa</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ScopeIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{scopeInfo.label}</span>
                  </div>
                  {track.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{track.description}</p>
                  )}
                  {track.total_hours > 0 && (
                    <p className="text-xs text-muted-foreground">{track.total_hours}h de carga horária</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(track)}>
                      <Edit className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(track)}>
                      {track.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrack ? "Editar Trilha" : "Nova Trilha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Trilha de Liderança" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carga Horária (h)</Label>
                <Input type="number" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })} />
              </div>
            </div>

            {/* Scope */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Label className="font-semibold">Escopo da Trilha</Label>
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
              {saving ? "Salvando..." : editingTrack ? "Salvar Alterações" : "Criar Trilha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
