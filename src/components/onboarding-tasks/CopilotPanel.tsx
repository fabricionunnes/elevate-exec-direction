import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, X, ListPlus, CalendarClock, MessageSquare, ClipboardList, GraduationCap, Package, Target, Send } from "lucide-react";
import { motion } from "framer-motion";

interface Suggestion {
  id: string;
  company_id: string;
  project_id: string | null;
  suggestion_date: string;
  assigned_staff_id: string | null;
  type: string;
  priority: string;
  title: string;
  rationale: string | null;
  next_step: string | null;
  source_signals: any;
  status: string;
  task_id: string | null;
  onboarding_companies?: { name: string } | null;
}

const TYPE_META: Record<string, { label: string; icon: any }> = {
  reuniao: { label: "Reunião", icon: CalendarClock },
  grupo: { label: "Interação no grupo", icon: MessageSquare },
  plano: { label: "Plano de ação", icon: ClipboardList },
  tarefa: { label: "Tarefa", icon: ListPlus },
  treinamento: { label: "Treinamento", icon: GraduationCap },
  oferta: { label: "Oferta de módulo", icon: Package },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-red-500/15 text-red-600" },
  media: { label: "Média", cls: "bg-amber-500/15 text-amber-600" },
  baixa: { label: "Baixa", cls: "bg-muted text-muted-foreground" },
};

const priorityToTask = (p: string) => (p === "alta" ? "high" : p === "baixa" ? "low" : "medium");

export const CopilotPanel = () => {
  const { currentStaff, isMaster } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // Dialog "Enviar no grupo"
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupSending, setGroupSending] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");
  const [groupTarget, setGroupTarget] = useState<string | null>(null);
  const [groupSug, setGroupSug] = useState<Suggestion | null>(null);

  const isSupervisor = isMaster || currentStaff?.role === "admin";

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("cs_action_suggestions")
        .select("*, onboarding_companies(name)")
        .gte("suggestion_date", since)
        .neq("status", "dismissed")
        .order("suggestion_date", { ascending: false });
      setSuggestions((data || []) as Suggestion[]);

      const ids = [...new Set((data || []).map((s: any) => s.assigned_staff_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: staff } = await supabase.from("onboarding_staff").select("id, name").in("id", ids);
        setStaffNames(Object.fromEntries((staff || []).map((s: any) => [s.id, s.name])));
      }
    } catch (e) {
      console.error("Erro ao carregar copiloto:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const setStatus = async (s: Suggestion, status: string) => {
    setBusy((b) => ({ ...b, [s.id]: true }));
    const { error } = await supabase.from("cs_action_suggestions").update({ status, updated_at: new Date().toISOString() }).eq("id", s.id);
    setBusy((b) => ({ ...b, [s.id]: false }));
    if (error) { toast.error("Não foi possível atualizar."); return; }
    setSuggestions((prev) => (status === "dismissed" ? prev.filter((x) => x.id !== s.id) : prev.map((x) => (x.id === s.id ? { ...x, status } : x))));
    toast.success(status === "done" ? "Marcada como concluída." : "Atualizada.");
  };

  const createTask = async (s: Suggestion) => {
    if (!s.project_id) { toast.error("Sem projeto vinculado para criar a tarefa."); return; }
    setBusy((b) => ({ ...b, [s.id]: true }));
    try {
      const description = [s.rationale, s.next_step].filter(Boolean).join("\n\n");
      const { data: task, error } = await supabase
        .from("onboarding_tasks")
        .insert({
          project_id: s.project_id,
          title: s.title,
          description,
          status: "pending",
          priority: priorityToTask(s.priority),
          responsible_staff_id: s.assigned_staff_id,
          tags: ["copiloto"],
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("cs_action_suggestions").update({ status: "task_created", task_id: task.id, updated_at: new Date().toISOString() }).eq("id", s.id);
      setSuggestions((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: "task_created", task_id: task.id } : x)));
      toast.success("Tarefa criada no projeto.");
    } catch (e: any) {
      toast.error("Falha ao criar tarefa: " + (e?.message || ""));
    } finally {
      setBusy((b) => ({ ...b, [s.id]: false }));
    }
  };

  const openGroupDialog = async (s: Suggestion) => {
    setGroupSug(s);
    setGroupOpen(true);
    setGroupLoading(true);
    setGroupDraft("");
    setGroupTarget(null);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-execute", { body: { suggestion_id: s.id } });
      if (error) throw error;
      if (!data?.has_group) { toast.error("Esse cliente não tem grupo de WhatsApp vinculado."); setGroupOpen(false); return; }
      setGroupDraft(data.draft || "");
      setGroupTarget(data.group_name || null);
    } catch (e: any) {
      toast.error("Não foi possível gerar a mensagem.");
      setGroupOpen(false);
    } finally {
      setGroupLoading(false);
    }
  };

  const sendGroup = async () => {
    if (!groupSug || !groupDraft.trim()) return;
    setGroupSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-execute", { body: { suggestion_id: groupSug.id, text: groupDraft, confirm: true } });
      if (error || data?.error) throw new Error(data?.error || "erro");
      setSuggestions((prev) => prev.map((x) => (x.id === groupSug.id ? { ...x, status: "done" } : x)));
      toast.success(`Mensagem enviada no grupo ${data.group_name || ""}.`);
      setGroupOpen(false);
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e?.message || ""));
    } finally {
      setGroupSending(false);
    }
  };

  const grouped = useMemo(() => {
    const order = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
    const byCompany = new Map<string, Suggestion[]>();
    suggestions.forEach((s) => {
      const name = s.onboarding_companies?.name || "Cliente";
      const a = byCompany.get(name) || [];
      a.push(s);
      byCompany.set(name, a);
    });
    return [...byCompany.entries()].map(([name, items]) => ({
      name,
      items: items.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1)),
    }));
  }, [suggestions]);

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent" />
        <CardContent className="relative p-4 flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Copiloto de Resultados</p>
            <p className="text-xs text-muted-foreground">
              {isSupervisor ? "Ações sugeridas de todos os consultores" : "Suas ações sugeridas para os clientes"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-primary">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground">pendentes</p>
          </div>
        </CardContent>
      </Card>

      {grouped.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhuma ação sugerida no momento.</p>
      )}

      {grouped.map((grp) => (
        <div key={grp.name} className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{grp.name}</p>
          {grp.items.map((s, idx) => {
            const tm = TYPE_META[s.type] || TYPE_META.tarefa;
            const pm = PRIORITY_META[s.priority] || PRIORITY_META.media;
            const done = s.status === "done";
            const taskCreated = s.status === "task_created";
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.03, 0.3) }}>
                <Card className={`border-0 ${done ? "bg-emerald-500/[0.04]" : "bg-card/60"}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                        <tm.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-primary/10 text-primary">{tm.label}</Badge>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${pm.cls}`}>{pm.label}</Badge>
                          {isSupervisor && s.assigned_staff_id && staffNames[s.assigned_staff_id] && (
                            <span className="text-[10px] text-muted-foreground">→ {staffNames[s.assigned_staff_id]}</span>
                          )}
                          {taskCreated && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-blue-500/15 text-blue-600">Tarefa criada</Badge>}
                          {done && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-emerald-500/15 text-emerald-600">Concluída</Badge>}
                        </div>
                        <p className={`text-sm font-semibold ${done ? "line-through text-muted-foreground" : ""}`}>{s.title}</p>
                        {s.rationale && <p className="text-xs text-muted-foreground mt-0.5">{s.rationale}</p>}
                        {s.next_step && (
                          <p className="text-xs mt-1.5 rounded-md bg-muted/50 p-2"><span className="font-semibold">Próximo passo:</span> {s.next_step}</p>
                        )}
                        {!done && (
                          <div className="flex items-center gap-2 mt-2">
                            {!taskCreated && (
                              <Button size="sm" variant="default" className="h-7 text-xs gap-1" disabled={busy[s.id]} onClick={() => createTask(s)}>
                                <ListPlus className="h-3 w-3" /> Criar tarefa
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy[s.id]} onClick={() => openGroupDialog(s)}>
                              <Send className="h-3 w-3" /> Enviar no grupo
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy[s.id]} onClick={() => setStatus(s, "done")}>
                              <CheckCircle2 className="h-3 w-3" /> Concluir
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" disabled={busy[s.id]} onClick={() => setStatus(s, "dismissed")}>
                              <X className="h-3 w-3" /> Dispensar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ))}

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" /> Enviar no grupo via Marcelo
            </DialogTitle>
          </DialogHeader>
          {groupLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Gerando a mensagem...
            </div>
          ) : (
            <div className="space-y-3">
              {groupTarget && (
                <p className="text-xs text-muted-foreground">
                  Será postada no grupo <span className="font-semibold text-foreground">{groupTarget}</span> pelo Marcelo. Revise e edite antes de enviar.
                </p>
              )}
              <Textarea value={groupDraft} onChange={(e) => setGroupDraft(e.target.value)} rows={10} className="text-sm" />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGroupOpen(false)} disabled={groupSending}>Cancelar</Button>
            <Button onClick={sendGroup} disabled={groupLoading || groupSending || !groupDraft.trim()} className="gap-1">
              {groupSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar no grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CopilotPanel;
