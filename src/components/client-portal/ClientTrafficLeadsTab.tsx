import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Phone, UserPlus, StickyNote, Trash2 } from "lucide-react";
import { format } from "date-fns";

// Leads do tráfego pago registrados pela SDR do CLIENTE: cada lead que chegou
// das campanhas entra aqui com o desfecho — fecha o loop investimento → resultado.

interface TrafficLead {
  id: string;
  name: string;
  phone: string | null;
  arrived_at: string;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "novo", label: "Novo", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "em_contato", label: "Em contato", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { value: "agendou", label: "Agendou avaliação", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { value: "compareceu", label: "Compareceu", color: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  { value: "fechou", label: "Fechou", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "sem_resposta", label: "Sem resposta", color: "bg-zinc-500/15 text-zinc-500" },
  { value: "perdido", label: "Perdido", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
];

const statusOf = (value: string) => STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];

export const ClientTrafficLeadsTab = ({ projectId }: { projectId: string }) => {
  const [leads, setLeads] = useState<TrafficLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDate, setNewDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrafficLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_traffic_leads" as never)
      .select("*")
      .eq("project_id", projectId)
      .order("arrived_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar leads");
    } else {
      setLeads((data as unknown as TrafficLead[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const addLead = async () => {
    if (!newName.trim()) {
      toast.error("Informe o nome do lead");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_traffic_leads" as never).insert({
      project_id: projectId,
      name: newName.trim(),
      phone: newPhone.trim() || null,
      arrived_at: newDate,
      created_by: userData?.user?.id || null,
    } as never);
    setSaving(false);
    if (error) {
      toast.error("Erro ao adicionar lead");
      return;
    }
    setNewName("");
    setNewPhone("");
    setNewDate(format(new Date(), "yyyy-MM-dd"));
    setAddOpen(false);
    toast.success("Lead registrado");
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await supabase
      .from("client_traffic_leads" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      setLeads(prev);
      toast.error("Erro ao atualizar");
    }
  };

  const deleteLead = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("client_traffic_leads" as never)
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir o lead");
      return;
    }
    setLeads((ls) => ls.filter((l) => l.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Lead excluído");
  };

  const saveNotes = async (id: string) => {
    const notes = (notesDraft[id] ?? "").trim() || null;
    const { error } = await supabase
      .from("client_traffic_leads" as never)
      .update({ notes, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar anotação");
      return;
    }
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, notes } : l)));
    setNotesOpenFor(null);
  };

  const stats = useMemo(() => {
    const total = leads.length;
    const count = (s: string) => leads.filter((l) => l.status === s).length;
    const agendou = count("agendou") + count("compareceu") + count("fechou");
    const fechou = count("fechou");
    return {
      total,
      agendou,
      compareceu: count("compareceu") + fechou,
      fechou,
      convAgendamento: total > 0 ? Math.round((agendou / total) * 100) : 0,
      convFechamento: total > 0 ? Math.round((fechou / total) * 100) : 0,
    };
  }, [leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {[
          { label: "Leads", value: stats.total },
          { label: "Agendaram", value: stats.agendou },
          { label: "Compareceram", value: stats.compareceu },
          { label: "Fecharam", value: stats.fechou },
          { label: "Conv. agendamento", value: `${stats.convAgendamento}%` },
          { label: "Conv. fechamento", value: `${stats.convFechamento}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Registre cada lead que chegou das campanhas e marque o que aconteceu com ele.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Lead
        </Button>
      </div>

      {/* Lista */}
      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <UserPlus className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum lead registrado ainda. Clique em <strong>+ Lead</strong> pra registrar o primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {leads.map((l) => {
            const st = statusOf(l.status);
            return (
              <div key={l.id} className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      <span className="truncate">{l.name}</span>
                      {l.source === "lead_ads" && (
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0 border-blue-400/40 text-blue-500" title="Importado automaticamente do formulário do Meta Ads">
                          Meta
                        </Badge>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                      {l.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" />
                          {l.phone}
                        </span>
                      )}
                      <span>{format(new Date(l.arrived_at + "T12:00:00"), "dd/MM/yyyy")}</span>
                    </p>
                  </div>
                  <Badge className={`${st.color} border-0 text-[10px] shrink-0`}>{st.label}</Badge>
                  <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                    <SelectTrigger className="h-7 w-[150px] text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title={l.notes ? `Anotações: ${l.notes}` : "Adicionar anotação"}
                    onClick={() => {
                      setNotesDraft((d) => ({ ...d, [l.id]: l.notes || "" }));
                      setNotesOpenFor(notesOpenFor === l.id ? null : l.id);
                    }}
                  >
                    <StickyNote className={`h-3.5 w-3.5 ${l.notes ? "text-amber-500" : "text-muted-foreground/50"}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive"
                    title="Excluir lead"
                    onClick={() => setDeleteTarget(l)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {notesOpenFor === l.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={notesDraft[l.id] ?? ""}
                      onChange={(e) => setNotesDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveNotes(l.id)}
                      placeholder="O que aconteceu com esse lead?"
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button size="sm" className="h-8" onClick={() => saveNotes(l.id)}>
                      Salvar
                    </Button>
                  </div>
                )}
                {l.notes && notesOpenFor !== l.id && (
                  <p className="text-[11px] text-muted-foreground mt-1 pl-0.5">{l.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead e as anotações dele saem da lista e dos contadores. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteLead(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de novo lead */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar lead do tráfego</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do lead" autoFocus />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(31) 9...." />
            </div>
            <div>
              <Label>Data que chegou</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={addLead} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
