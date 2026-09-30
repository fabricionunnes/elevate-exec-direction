// Configurações → Mensagens agendadas (refeita em 30/09/2026): antes o botão "Agendar
// mensagem" não fazia nada e ninguém gravava na tabela. Agora: lista com filtro por
// status, busca, editar/cancelar, o mesmo diálogo do chat (com busca de conversa) e a
// visão de calendário (mês) com as agendadas por dia. O envio é o cron crm-scheduled-dispatch.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ChevronLeft, ChevronRight, Search, CalendarClock, Trash2, Pencil, List, CalendarDays, RefreshCw, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCRMContext } from "@/pages/crm/CRMLayout";
import { ScheduleMessageDialog, ScheduledRow } from "@/components/crm/inbox/ScheduleMessageDialog";

interface Row extends ScheduledRow {
  conversation?: {
    id: string;
    contact?: { name: string | null; phone: string } | null;
    lead?: { name: string } | null;
    instance?: { instance_name: string; display_name: string | null } | null;
    official_instance?: { display_name: string | null } | null;
  } | null;
}

interface ScheduledMessagesSectionProps {
  onBack: () => void;
}

type Aba = "pending" | "sent" | "failed" | "cancelled" | "all";
const ABAS: { k: Aba; label: string }[] = [
  { k: "pending", label: "Pendentes" },
  { k: "sent", label: "Enviadas" },
  { k: "failed", label: "Falhas" },
  { k: "cancelled", label: "Canceladas" },
  { k: "all", label: "Todas" },
];

const nomeDe = (r: Row) => {
  const n = String(r.conversation?.lead?.name || r.conversation?.contact?.name || "").trim();
  return /[\p{L}]/u.test(n) ? n : r.phone_number;
};
const numeroDe = (r: Row) => {
  const c = r.conversation;
  return c?.instance ? c.instance.display_name || c.instance.instance_name : c?.official_instance ? `${c.official_instance.display_name || "API oficial"} (oficial)` : "";
};

export const ScheduledMessagesSection = ({ onBack }: ScheduledMessagesSectionProps) => {
  const { staffId } = useCRMContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [aba, setAba] = useState<Aba>("pending");
  const [visao, setVisao] = useState<"lista" | "calendario">("lista");
  const [mes, setMes] = useState<Date>(() => startOfMonth(new Date()));
  const [diaEscolhido, setDiaEscolhido] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: sf }] = await Promise.all([
        (supabase as any)
          .from("crm_scheduled_messages")
          .select("*, conversation:crm_whatsapp_conversations(id, contact:crm_whatsapp_contacts(name, phone), lead:crm_leads(name), instance:whatsapp_instances(instance_name, display_name), official_instance:whatsapp_official_instances(display_name))")
          .order("scheduled_at", { ascending: false })
          .limit(1000),
        supabase.from("onboarding_staff").select("id, name"),
      ]);
      if (error) throw error;
      setRows((data || []) as Row[]);
      const nm: Record<string, string> = {}; for (const s of (sf || []) as any[]) nm[s.id] = s.name; setStaffNames(nm);
    } catch (error: any) {
      console.error("Error loading messages:", error);
      toast.error(error?.message || "Não consegui carregar as mensagens agendadas");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (message: Row) => {
    if (!confirm("Cancelar esta mensagem agendada?")) return;
    try {
      const { error } = await (supabase as any).from("crm_scheduled_messages")
        .update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", message.id).eq("status", "pending");
      if (error) throw error;
      toast.success("Mensagem cancelada");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar");
    }
  };

  const getStatusBadge = (r: Row) => {
    switch (r.status) {
      case "pending": return <Badge variant="secondary">Pendente</Badge>;
      case "sending": return <Badge variant="secondary">Enviando</Badge>;
      case "sent": return <Badge className="bg-green-500 hover:bg-green-500">Enviada</Badge>;
      case "failed": return <Badge variant="destructive" title={r.error_message || ""}>Falhou</Badge>;
      case "cancelled": return <Badge variant="outline">Cancelada</Badge>;
      default: return <Badge variant="outline">{r.status}</Badge>;
    }
  };

  const contagens = useMemo(() => {
    const c: Record<string, number> = { pending: 0, sent: 0, failed: 0, cancelled: 0, all: rows.length };
    for (const r of rows) {
      const k = r.status === "sending" ? "pending" : r.status;
      if (k in c) c[k] += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((m) => {
      if (aba !== "all" && !(m.status === aba || (aba === "pending" && m.status === "sending"))) return false;
      if (diaEscolhido && !isSameDay(new Date(m.scheduled_at), diaEscolhido)) return false;
      if (!q) return true;
      return m.phone_number.includes(q) || m.message.toLowerCase().includes(q) || nomeDe(m).toLowerCase().includes(q);
    });
  }, [rows, aba, searchTerm, diaEscolhido]);

  // Calendário: agendadas por dia (respeita a aba e a busca, ignora o dia escolhido)
  const porDia = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const map = new Map<string, Row[]>();
    for (const m of rows) {
      if (aba !== "all" && !(m.status === aba || (aba === "pending" && m.status === "sending"))) continue;
      if (q && !(m.phone_number.includes(q) || m.message.toLowerCase().includes(q) || nomeDe(m).toLowerCase().includes(q))) continue;
      const k = format(new Date(m.scheduled_at), "yyyy-MM-dd");
      map.set(k, [...(map.get(k) || []), m]);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return map;
  }, [rows, aba, searchTerm]);

  const diasDoMes = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 0 }),
  }), [mes]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span className="text-foreground">Mensagens agendadas</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Mensagens agendadas</h2>
          <p className="text-sm text-muted-foreground">
            Programe mensagens pra sair sozinhas na hora certa. Elas aparecem na conversa como enviadas.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Agendar mensagem
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => (
            <button key={a.k} onClick={() => setAba(a.k)}
              className={cn("h-7 px-2.5 rounded-full text-[11px] font-medium border whitespace-nowrap flex items-center gap-1",
                aba === a.k ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted")}>
              {a.label}
              {contagens[a.k] > 0 && <span className={cn("rounded-full px-1 text-[10px]", aba === a.k ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>{contagens[a.k]}</span>}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Nome, telefone ou texto" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-8" />
        </div>
        <div className="flex rounded-md border border-border overflow-hidden ml-auto">
          <button onClick={() => setVisao("lista")} title="Lista" className={cn("h-8 w-8 flex items-center justify-center", visao === "lista" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}><List className="h-4 w-4" /></button>
          <button onClick={() => setVisao("calendario")} title="Calendário" className={cn("h-8 w-8 flex items-center justify-center", visao === "calendario" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}><CalendarDays className="h-4 w-4" /></button>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Atualizar" onClick={loadData}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
      </div>

      {visao === "calendario" && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMes(addMonths(mes, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</span>
              {!isSameMonth(mes, new Date()) && <Button variant="link" size="sm" className="h-6 px-1 text-xs" onClick={() => setMes(startOfMonth(new Date()))}>hoje</Button>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMes(addMonths(mes, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 text-[10px] font-semibold uppercase text-muted-foreground border-b border-border">
            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <div key={d} className="px-2 py-1 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {diasDoMes.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const itens = porDia.get(k) || [];
              const escolhido = diaEscolhido && isSameDay(d, diaEscolhido);
              return (
                <button key={k} type="button" onClick={() => setDiaEscolhido(escolhido ? null : d)}
                  className={cn("min-h-[84px] border-b border-r border-border/60 p-1 text-left align-top hover:bg-muted/40 transition-colors",
                    !isSameMonth(d, mes) && "bg-muted/20 text-muted-foreground", escolhido && "bg-primary/10 ring-1 ring-inset ring-primary")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-medium h-5 w-5 flex items-center justify-center rounded-full", isToday(d) && "bg-primary text-primary-foreground")}>{format(d, "d")}</span>
                    {itens.length > 0 && <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1">{itens.length}</span>}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {itens.slice(0, 3).map((m) => (
                      <div key={m.id} className={cn("text-[10px] truncate rounded px-1", m.status === "sent" ? "bg-green-500/10 text-green-700 dark:text-green-400" : m.status === "failed" ? "bg-destructive/10 text-destructive" : m.status === "cancelled" ? "bg-muted text-muted-foreground line-through" : "bg-primary/10 text-primary")}
                        title={`${format(new Date(m.scheduled_at), "HH:mm")} ${nomeDe(m)}: ${m.message}`}>
                        {format(new Date(m.scheduled_at), "HH:mm")} {nomeDe(m)}
                      </div>
                    ))}
                    {itens.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{itens.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {diaEscolhido && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Mostrando só {format(diaEscolhido, "dd/MM/yyyy")}
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => setDiaEscolhido(null)}><X className="h-3 w-3 mr-1" />limpar</Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CONTATO</TableHead>
            <TableHead>MENSAGEM</TableHead>
            <TableHead>AGENDADA PARA</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((msg) => (
            <TableRow key={msg.id}>
              <TableCell>
                <div className="font-medium">{nomeDe(msg)}</div>
                <div className="text-xs text-muted-foreground">{msg.phone_number}{numeroDe(msg) ? ` · ${numeroDe(msg)}` : ""}</div>
              </TableCell>
              <TableCell className="max-w-xs">
                <div className="truncate" title={msg.message}>{msg.message}</div>
                {msg.created_by && staffNames[msg.created_by] && <div className="text-[11px] text-muted-foreground">por {staffNames[msg.created_by].split(" ")[0]}</div>}
              </TableCell>
              <TableCell>
                {format(new Date(msg.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                {msg.sent_at && <div className="text-[11px] text-muted-foreground">enviada {format(new Date(msg.sent_at), "dd/MM HH:mm")}</div>}
              </TableCell>
              <TableCell>
                {getStatusBadge(msg)}
                {msg.status === "failed" && msg.error_message && <div className="text-[11px] text-destructive max-w-[200px] truncate" title={msg.error_message}>{msg.error_message}</div>}
              </TableCell>
              <TableCell>
                {(msg.status === "pending" || msg.status === "failed") && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" title={msg.status === "failed" ? "Editar e reagendar" : "Editar"} onClick={() => { setEditing(msg); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {msg.status === "pending" && (
                      <Button variant="ghost" size="icon" title="Cancelar" onClick={() => handleCancel(msg)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {rows.length === 0 ? "Nenhuma mensagem agendada" : "Nada nesse filtro"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ScheduleMessageDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        staffId={staffId}
        onSaved={loadData}
      />
    </div>
  );
};
