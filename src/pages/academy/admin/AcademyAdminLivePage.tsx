import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radio, Plus, Users, Pencil, Trash2, Flame } from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";
import { iaDb, fmtDateTime, LIVE_KIND_LABEL, type IaLiveSession, type IaLiveRegistration } from "@/lib/academy/iaAcademy";

// Admin dos encontros ao vivo: agenda o hotseat mensal, cola o link da sala,
// vê inscritos e os casos enviados, marca presença e anexa a gravação (aula).

interface RegRow extends IaLiveRegistration { student_name: string; student_email: string }

const emptyForm = () => ({
  kind: "hotseat" as IaLiveSession["kind"],
  title: "",
  description: "",
  scheduled_at: "",
  duration_minutes: 90,
  meeting_url: "",
  host_name: "Fabrício Nunnes",
  status: "scheduled" as IaLiveSession["status"],
  recording_url: "",
  recording_lesson_id: "",
});

export const AcademyAdminLivePage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [sessions, setSessions] = useState<IaLiveSession[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<IaLiveSession | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regsFor, setRegsFor] = useState<IaLiveSession | null>(null);
  const [regs, setRegs] = useState<RegRow[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [{ data: s }, { data: l }] = await Promise.all([
        iaDb.from("ia_academy_live_sessions").select("*").order("scheduled_at", { ascending: false }),
        supabase.from("academy_lessons").select("id, title").eq("is_active", true).order("title"),
      ]);
      setSessions((s as IaLiveSession[]) || []);
      setLessons((l as any[]) || []);
    } finally {
      setLoading(false);
    }
  };

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (s: IaLiveSession) => {
    setEditing(s);
    setForm({
      kind: s.kind, title: s.title, description: s.description || "", scheduled_at: toLocalInput(s.scheduled_at),
      duration_minutes: s.duration_minutes, meeting_url: s.meeting_url || "", host_name: s.host_name, status: s.status,
      recording_url: s.recording_url || "", recording_lesson_id: s.recording_lesson_id || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.scheduled_at) return toast.error("Título e data são obrigatórios");
    setSaving(true);
    try {
      const payload = {
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 90,
        meeting_url: form.meeting_url.trim() || null,
        host_name: form.host_name.trim() || "Fabrício Nunnes",
        status: form.status,
        recording_url: form.recording_url.trim() || null,
        recording_lesson_id: form.recording_lesson_id || null,
        created_by: userContext.staffId,
      };
      const { error } = editing
        ? await iaDb.from("ia_academy_live_sessions").update(payload).eq("id", editing.id)
        : await iaDb.from("ia_academy_live_sessions").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Encontro atualizado" : "Encontro criado");
      setOpen(false);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: IaLiveSession) => {
    if (!confirm(`Cancelar "${s.title}"?`)) return;
    await iaDb.from("ia_academy_live_sessions").update({ status: "cancelled" }).eq("id", s.id);
    toast.success("Encontro cancelado");
    load();
  };

  const openRegs = async (s: IaLiveSession) => {
    setRegsFor(s);
    const { data } = await iaDb.from("ia_academy_live_registrations").select("*").eq("session_id", s.id).order("created_at");
    const list = (data as IaLiveRegistration[]) || [];
    const ids = [...new Set(list.map((r) => r.onboarding_user_id))];
    const { data: users } = ids.length ? await supabase.from("onboarding_users").select("id, name, email").in("id", ids) : { data: [] as any[] };
    const umap = new Map<string, any>(); (users || []).forEach((u: any) => umap.set(u.id, u));
    setRegs(list.map((r) => ({ ...r, student_name: umap.get(r.onboarding_user_id)?.name || "—", student_email: umap.get(r.onboarding_user_id)?.email || "" })));
  };

  const updateReg = async (r: RegRow, patch: Partial<IaLiveRegistration>) => {
    await iaDb.from("ia_academy_live_registrations").update(patch).eq("id", r.id);
    if (regsFor) openRegs(regsFor);
  };

  if (!userContext.isAdmin) {
    return <div className="p-4 md:p-6"><Card className="p-12 text-center"><h3 className="font-semibold">Acesso negado</h3></Card></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Radio className="h-7 w-7 text-primary" /> Encontros ao Vivo</h1>
          <p className="text-muted-foreground mt-1">Hotseat mensal, implementações ao vivo e masterclasses do IA Academy.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo encontro</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhum encontro. Crie o primeiro hotseat do mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Encontro</TableHead>
                  <TableHead className="hidden sm:table-cell">Quando</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Gravação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="min-w-[160px]">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{LIVE_KIND_LABEL[s.kind]} · {s.host_name}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{fmtDateTime(s.scheduled_at)} · {s.duration_minutes} min</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{fmtDateTime(s.scheduled_at)} · {s.duration_minutes} min</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "live" ? "destructive" : s.status === "done" ? "default" : s.status === "cancelled" ? "outline" : "secondary"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{s.recording_lesson_id ? "Aula vinculada" : s.recording_url ? "Link" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openRegs(s)}><Users className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Inscritos</span></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        {s.status !== "cancelled" && <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar encontro" : "Novo encontro"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hotseat de outubro · agentes SDR na prática" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as IaLiveSession["kind"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LIVE_KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as IaLiveSession["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="live">Ao vivo agora</SelectItem>
                  <SelectItem value="done">Realizado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Link da sala (Zoom / Meet)</Label>
              <Input value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Host</Label>
              <Input value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value })} />
            </div>
            <div>
              <Label>Gravação publicada como aula</Label>
              <Select value={form.recording_lesson_id || "none"} onValueChange={(v) => setForm({ ...form, recording_lesson_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Ou link direto da gravação</Label>
              <Input value={form.recording_url} onChange={(e) => setForm({ ...form, recording_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição / pauta</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inscritos */}
      <Dialog open={!!regsFor} onOpenChange={(o) => !o && setRegsFor(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Inscritos · {regsFor?.title}</DialogTitle></DialogHeader>
          {regs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ninguém inscrito ainda.</p>
          ) : (
            <div className="space-y-3">
              {regs.map((r) => (
                <Card key={r.id} className={r.picked_for_hotseat ? "border-amber-500/50" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                      {r.student_name} <span className="text-xs font-normal text-muted-foreground min-w-0 break-all">{r.student_email}</span>
                      {r.wants_hotseat && <Badge variant="outline" className="text-amber-600 border-amber-500/50"><Flame className="h-3 w-3 mr-1" /> quer a cadeira</Badge>}
                      <Badge variant="secondary" className="ml-auto">{r.status}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {r.question ? <p className="text-sm whitespace-pre-wrap">{r.question}</p> : <p className="text-xs text-muted-foreground">Sem caso enviado.</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant={r.picked_for_hotseat ? "default" : "outline"} onClick={() => updateReg(r, { picked_for_hotseat: !r.picked_for_hotseat })}>
                        <Flame className="h-4 w-4 mr-1" /> {r.picked_for_hotseat ? "Selecionado" : "Selecionar pro hotseat"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateReg(r, { status: "attended" })}>Presente</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateReg(r, { status: "missed" })}>Faltou</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyAdminLivePage;
