import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, X, ListPlus, CalendarClock, MessageSquare, ClipboardList, GraduationCap, Package, Target } from "lucide-react";
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
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterCompany, setFilterCompany] = useState<string>("all");

  const isSupervisor = isMaster || currentStaff?.role === "admin";

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
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
      // Prazo padrão: 3 dias. tags[0]=nome da fase na jornada, tags[1]=ordem, tags[2]=marcador
      const due = new Date(); due.setDate(due.getDate() + 3);
      const { data: task, error } = await supabase
        .from("onboarding_tasks")
        .insert({
          project_id: s.project_id,
          title: s.title,
          description,
          status: "pending",
          priority: priorityToTask(s.priority),
          responsible_staff_id: s.assigned_staff_id,
          due_date: due.toISOString().split("T")[0],
          tags: ["Ações do Copiloto", "999", "copiloto"],
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

  const staffOptions = useMemo(() => {
    const ids = [...new Set(suggestions.map((s) => s.assigned_staff_id).filter(Boolean) as string[])];
    return ids.map((id) => ({ id, name: staffNames[id] || "—" })).sort((a, b) => a.name.localeCompare(b.name));
  }, [suggestions, staffNames]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    suggestions.forEach((s) => { if (s.company_id) map.set(s.company_id, s.onboarding_companies?.name || "Cliente"); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [suggestions]);

  const filtered = useMemo(() => {
    return suggestions.filter((s) => {
      if (filterStaff !== "all" && s.assigned_staff_id !== filterStaff) return false;
      if (filterDate && s.suggestion_date !== filterDate) return false;
      if (filterCompany !== "all" && s.company_id !== filterCompany) return false;
      return true;
    });
  }, [suggestions, filterStaff, filterDate, filterCompany]);

  const grouped = useMemo(() => {
    const order = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
    const byCompany = new Map<string, Suggestion[]>();
    filtered.forEach((s) => {
      const name = s.onboarding_companies?.name || "Cliente";
      const a = byCompany.get(name) || [];
      a.push(s);
      byCompany.set(name, a);
    });
    return [...byCompany.entries()].map(([name, items]) => ({
      name,
      items: items.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1)),
    }));
  }, [filtered]);

  const pendingCount = filtered.filter((s) => s.status === "pending").length;

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

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Data:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          />
          {filterDate && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setFilterDate("")}>Limpar</Button>
          )}
        </div>
        {isSupervisor && staffOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Consultor:</span>
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="all">Todos</option>
              {staffOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
        {companyOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Empresa:</span>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs max-w-[200px]"
            >
              <option value="all">Todas</option>
              {companyOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

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
    </div>
  );
};

export default CopilotPanel;
