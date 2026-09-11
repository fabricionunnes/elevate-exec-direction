// Calendário do lead: abre pelo ícone de calendário no cabeçalho do negócio.
// Mês com os dias de reunião marcados + painel de reuniões (mesmo da aba Reuniões,
// com agendar/reagendar/cancelar). Pedido do Fabrício 11/09/2026.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ptBR } from "date-fns/locale";
import { format, isSameDay } from "date-fns";
import { CalendarDays, Video } from "lucide-react";
import { LeadMeetingsPanel } from "./LeadMeetingsPanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
}

interface Mtg { id: string; title: string | null; scheduled_at: string | null; status: string | null; meeting_link: string | null; responsible?: { name: string } | null }

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Agendada", variant: "default" },
  completed: { label: "Realizada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "destructive" },
  no_show: { label: "Não compareceu", variant: "destructive" },
};

export function LeadCalendarDialog({ open, onOpenChange, leadId, leadName }: Props) {
  const [meetings, setMeetings] = useState<Mtg[]>([]);
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("crm_activities")
        .select("id, title, scheduled_at, status, meeting_link, responsible:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)")
        .eq("lead_id", leadId).eq("type", "meeting").not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });
      const list = ((data || []) as any[]) as Mtg[];
      setMeetings(list);
      // abre no mês da próxima reunião (ou da última, se não houver futura)
      const now = Date.now();
      const next = list.find((m) => m.scheduled_at && new Date(m.scheduled_at).getTime() >= now) || list[list.length - 1];
      if (next?.scheduled_at) { setMonth(new Date(next.scheduled_at)); setSelected(new Date(next.scheduled_at)); }
      else { setMonth(new Date()); setSelected(undefined); }
    })();
  }, [open, leadId]);

  const days = useMemo(() => meetings.filter((m) => m.scheduled_at).map((m) => new Date(m.scheduled_at!)), [meetings]);
  const daysCancelled = useMemo(() => meetings.filter((m) => m.scheduled_at && /cancel|no_show/i.test(m.status || "")).map((m) => new Date(m.scheduled_at!)), [meetings]);
  const daysActive = useMemo(() => meetings.filter((m) => m.scheduled_at && !/cancel|no_show/i.test(m.status || "")).map((m) => new Date(m.scheduled_at!)), [meetings]);
  const ofDay = selected ? meetings.filter((m) => m.scheduled_at && isSameDay(new Date(m.scheduled_at), selected)) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Agenda de {leadName}</DialogTitle>
          <DialogDescription>{meetings.length ? `${meetings.length} reunião(ões) registrada(s) para este lead.` : "Nenhuma reunião registrada ainda."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col md:flex-row min-h-0 flex-1">
          {/* Mês */}
          <div className="md:w-[330px] shrink-0 border-b md:border-b-0 md:border-r p-3 space-y-2 overflow-y-auto">
            <Calendar
              mode="single"
              locale={ptBR}
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={setSelected}
              modifiers={{ reuniao: daysActive, cancelada: daysCancelled }}
              modifiersClassNames={{
                reuniao: "bg-primary/15 text-primary font-semibold rounded-md",
                cancelada: "line-through text-muted-foreground",
              }}
              className="p-0"
            />
            <div className="text-[11px] text-muted-foreground flex items-center gap-3 px-1">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30 inline-block" /> com reunião</span>
              <span className="line-through">cancelada</span>
            </div>
            {selected && (
              <div className="rounded-md border p-2 space-y-1.5">
                <p className="text-xs font-medium">{format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                {ofDay.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem reunião neste dia.</p>
                ) : ofDay.map((m) => {
                  const st = STATUS[String(m.status || "pending").toLowerCase()] || { label: m.status || "", variant: "outline" as const };
                  return (
                    <div key={m.id} className="text-xs flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{format(new Date(m.scheduled_at!), "HH:mm")} · {m.title || "Reunião"}</div>
                        <div className="text-muted-foreground truncate">{m.responsible?.name || ""}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noreferrer" title="Abrir reunião"><Video className="h-3.5 w-3.5 text-primary" /></a>}
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Lista completa com ações (mesmo painel da aba Reuniões) */}
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            <LeadMeetingsPanel leadId={leadId} leadName={leadName} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
