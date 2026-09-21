import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Video, Plus, Trash2,
  ExternalLink, CalendarDays, Eye, RefreshCw, Check, ChevronsUpDown, CalendarClock,
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { buildProjectEventDescription } from "@/lib/projectMeetingDescription";

// Agenda fixa do Fabrício — eventos criados sempre no calendário dele
const FABRICIO = {
  userId: "98f3de7f-6d6f-4f3c-b2da-b9e479ce96e3",
  name: "Fabrício Nunes",
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const EDIT_ROLES = ["master", "admin", "cs"];

interface BusyPeriod {
  start: string;
  end: string;
}

interface AgendaMeeting {
  id: string;
  project_id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_link: string | null;
  google_event_id: string | null;
  staff_id: string | null;
  duration_minutes?: number | null;
  origem?: "projeto" | "crm";
  lead_id?: string | null;
}

interface ProjectOption {
  projectId: string;
  companyName: string;
  productName: string;
}

// os dois cadastros de staff do Fabrício (reunião antiga pode estar no nome de qualquer um)
const FABRICIO_STAFF_IDS = ["b1a918b1-8776-4962-898e-5d97c7cc80c1", "e5be1fb8-fce8-4a48-b993-bd03b09520a6"];
const ROW_H = 30; // altura de cada meia hora na grade (px)

// Janelas dedicadas a reunião de produto com cliente (10h Acceleration, 14h Partners)
const PRODUCT_SLOTS = new Set(["10:00", "14:00"]);

const slotTimes: string[] = [];
for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
  slotTimes.push(`${String(h).padStart(2, "0")}:00`);
  slotTimes.push(`${String(h).padStart(2, "0")}:30`);
}

const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

const AgendaFabricioPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [busyByDay, setBusyByDay] = useState<Record<string, BusyPeriod[]>>({});
  const [meetings, setMeetings] = useState<AgendaMeeting[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Dialog de agendamento
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formProjectId, setFormProjectId] = useState("");
  const [formDuration, setFormDuration] = useState("20");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Dialog de detalhes/cancelamento
  const [selectedMeeting, setSelectedMeeting] = useState<AgendaMeeting | null>(null);
  const [canceling, setCanceling] = useState(false);
  // Reagendar (alterar dia e horário) — move no Google Agenda e no projeto
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rsDate, setRsDate] = useState("");
  const [rsTime, setRsTime] = useState("10:00");
  const [rescheduling, setRescheduling] = useState(false);

  const weekDays = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (staff) {
        setCurrentStaffId(staff.id);
        setCanEdit(EDIT_ROLES.includes(staff.role));
      }
    };
    init();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProjects = async () => {
    const { data: projs } = await supabase
      .from("onboarding_projects")
      .select("id, product_name, onboarding_company_id")
      // ativo, sinalizou cancelamento e cumprindo aviso: enquanto for cliente,
      // reunião com o Fabrício pode (e deve) ser agendada
      .in("status", ["active", "cancellation_signaled", "notice_period"]);
    if (!projs || projs.length === 0) return;
    const companyIds = [...new Set(projs.map((p) => p.onboarding_company_id).filter(Boolean))];
    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name")
      .in("id", companyIds as string[]);
    const nameById = new Map((companies || []).map((c) => [c.id, c.name]));
    const options: ProjectOption[] = projs
      .filter((p) => p.onboarding_company_id && nameById.has(p.onboarding_company_id))
      .map((p) => ({
        projectId: p.id,
        companyName: nameById.get(p.onboarding_company_id!) || "",
        productName: p.product_name || "",
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "pt-BR"));
    setProjects(options);
  };

  const fetchWeek = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const busyResults = await Promise.all(
        weekDays.map(async (day) => {
          const { data } = await supabase.functions.invoke(
            "google-calendar?action=freebusy",
            {
              body: {
                target_user_id: FABRICIO.userId,
                date: dateKey(day),
                duration_minutes: 20,
              },
              headers: authHeaders,
            }
          );
          if (data?.needsAuth) setNeedsAuth(true);
          return { key: dateKey(day), busy: (data?.busyPeriods || []) as BusyPeriod[] };
        })
      );
      const busyMap: Record<string, BusyPeriod[]> = {};
      busyResults.forEach((r) => { busyMap[r.key] = r.busy; });
      setBusyByDay(busyMap);

      const weekEnd = addDays(weekStart, 5);
      const { data: notes } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, project_id, meeting_title, meeting_date, meeting_link, google_event_id, staff_id, duration_minutes")
        // tudo que o sistema agendou na agenda dele: por esta tela, de dentro do projeto, e as antigas sem dono gravado
        .or(`calendar_owner_id.eq.${FABRICIO.userId},and(calendar_owner_id.is.null,staff_id.in.(${FABRICIO_STAFF_IDS.join(",")}))`)
        .gte("meeting_date", weekStart.toISOString())
        .lt("meeting_date", weekEnd.toISOString())
        .order("meeting_date");
      // reuniões com lead marcadas pelo CRM (tela do negócio, Atendimento ou agente de IA) na agenda dele
      const { data: crmMeetings } = await (supabase as any)
        .from("crm_activities")
        .select("id, title, scheduled_at, meeting_link, google_calendar_event_id, lead_id, status, responsible_staff_id")
        .eq("type", "meeting").eq("google_calendar_user_id", FABRICIO.userId)
        .not("status", "in", "(cancelled,canceled)")
        .gte("scheduled_at", weekStart.toISOString()).lt("scheduled_at", weekEnd.toISOString());
      const doProjeto = ((notes || []) as AgendaMeeting[]).map((m) => ({ ...m, origem: "projeto" as const }));
      const eventosProjeto = new Set(doProjeto.map((m) => m.google_event_id).filter(Boolean));
      const doCrm: AgendaMeeting[] = ((crmMeetings || []) as any[])
        .filter((a) => a.scheduled_at && !eventosProjeto.has(a.google_calendar_event_id))
        .map((a) => ({ id: `crm-${a.id}`, project_id: "", meeting_title: a.title || "Reunião (CRM)", meeting_date: a.scheduled_at,
          meeting_link: a.meeting_link || null, google_event_id: a.google_calendar_event_id || null, staff_id: a.responsible_staff_id || null,
          duration_minutes: null, origem: "crm" as const, lead_id: a.lead_id || null }));
      setMeetings([...doProjeto, ...doCrm].sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime()));
    } catch (err) {
      console.error("Erro ao carregar agenda:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekDays, weekStart]);

  useEffect(() => {
    fetchWeek(true);
  }, [fetchWeek]);

  // Fim REAL da reunião (21/09/2026): a grade pintava só os primeiros 30 min e o resto virava "Ocupado" cinza,
  // parecendo que a reunião de 1h ocupava meia hora. Duração: a gravada; nas antigas, o bloco ocupado do Google
  // que começa junto com ela (limitado ao início da próxima reunião e a 3h, porque o Google junta blocos colados).
  const meetingEnd = (mt: AgendaMeeting): Date => {
    const start = new Date(mt.meeting_date);
    if (mt.duration_minutes && mt.duration_minutes > 0) return new Date(start.getTime() + mt.duration_minutes * 60000);
    const busy = busyByDay[dateKey(start)] || [];
    const own = busy.find((b) => Math.abs(new Date(b.start).getTime() - start.getTime()) < 60000);
    let end = own ? new Date(own.end) : new Date(start.getTime() + 30 * 60000);
    const proxima = meetings.map((o) => new Date(o.meeting_date)).filter((d) => d > start && isSameDay(d, start)).sort((a, b) => a.getTime() - b.getTime())[0];
    if (proxima && end > proxima) end = proxima;
    const teto = new Date(start.getTime() + 180 * 60000);
    if (end > teto) end = teto;
    if (end <= start) end = new Date(start.getTime() + 30 * 60000);
    return end;
  };
  // reunião que começou antes e ainda está acontecendo neste horário
  const meetingContinuing = (day: Date, time: string): AgendaMeeting | null => {
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(day);
    slotStart.setHours(h, m, 0, 0);
    return meetings.find((mt) => {
      const start = new Date(mt.meeting_date);
      return isSameDay(start, day) && start < slotStart && meetingEnd(mt) > slotStart;
    }) || null;
  };

  const meetingsForSlot = (day: Date, time: string): AgendaMeeting | null => {
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(day);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    return (
      meetings.find((mt) => {
        const start = new Date(mt.meeting_date);
        return isSameDay(start, day) && start >= slotStart && start < slotEnd;
      }) || null
    );
  };

  const isSlotBusy = (day: Date, time: string): boolean => {
    const busy = busyByDay[dateKey(day)] || [];
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(day);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    return busy.some((b) => overlaps(slotStart, slotEnd, new Date(b.start), new Date(b.end)));
  };

  const openSchedule = (day: Date, time: string) => {
    if (!canEdit) return;
    setFormDate(dateKey(day));
    setFormTime(time);
    setFormProjectId("");
    setFormDuration("20");
    setFormTitle("");
    setFormDescription("");
    setScheduleOpen(true);
  };

  const handleProjectChange = (projectId: string) => {
    setFormProjectId(projectId);
    const opt = projects.find((p) => p.projectId === projectId);
    if (opt) setFormTitle(`Reunião UNV — ${opt.companyName}`);
  };

  const handleSchedule = async () => {
    if (!formProjectId) { toast.error("Selecione a empresa"); return; }
    if (!formDate || !formTime) { toast.error("Informe data e horário"); return; }
    if (!formTitle.trim()) { toast.error("Informe o título"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const [h, m] = formTime.split(":").map(Number);
      const start = new Date(`${formDate}T00:00:00`);
      start.setHours(h, m, 0, 0);
      const durationMin = parseInt(formDuration);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);

      // Regra: não agendar por cima de horário ocupado na agenda do Fabrício
      const { data: fb, error: fbError } = await supabase.functions.invoke(
        "google-calendar?action=freebusy",
        {
          body: { target_user_id: FABRICIO.userId, date: formDate, duration_minutes: durationMin },
          headers: authHeaders,
        }
      );
      if (fbError) throw new Error("Não foi possível verificar a disponibilidade");
      if (fb?.needsAuth) {
        toast.error("Fabrício precisa reconectar o Google Agenda");
        return;
      }
      const busy: BusyPeriod[] = fb?.busyPeriods || [];
      const conflict = busy.find((b) => overlaps(start, end, new Date(b.start), new Date(b.end)));
      if (conflict) {
        toast.error(
          `Horário ocupado: ${format(new Date(conflict.start), "HH:mm")}–${format(new Date(conflict.end), "HH:mm")}. Escolha outra janela.`
        );
        return;
      }

      const opt = projects.find((p) => p.projectId === formProjectId);
      const companyName = opt?.companyName || null;

      const { data: created, error: createError } = await supabase.functions.invoke(
        "google-calendar?action=create-event",
        {
          body: {
            title: formTitle,
            description: buildProjectEventDescription(formDescription, formProjectId, { companyName }),
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
            target_user_id: FABRICIO.userId,
            attendees: [],
          },
          headers: authHeaders,
        }
      );
      if (createError) throw new Error(createError.message || "Erro ao criar evento");
      if (created?.error) {
        if (created.needsAuth) toast.error("Fabrício precisa reconectar o Google Agenda");
        else toast.error(created.error);
        return;
      }

      const meetingLink = created.event?.meetingLink || null;
      const eventId = created.event?.id || null;

      const { error: insertError } = await supabase.from("onboarding_meeting_notes").insert({
        project_id: formProjectId,
        staff_id: currentStaffId,
        google_event_id: eventId,
        meeting_title: formTitle,
        meeting_date: start.toISOString(),
        duration_minutes: durationMin,
        subject: formTitle,
        notes: "",
        meeting_link: meetingLink,
        is_finalized: false,
        scheduled_by: currentStaffId,
        calendar_owner_id: FABRICIO.userId,
        calendar_owner_name: FABRICIO.name,
        is_internal: false,
      });
      if (insertError) {
        console.error("Evento criado no Google, mas falhou o registro no projeto:", insertError);
        toast.warning("Evento criado no Google, mas houve erro ao registrar no projeto");
      } else {
        toast.success(`Reunião agendada na agenda do Fabrício${companyName ? ` com ${companyName}` : ""}`);
      }

      setScheduleOpen(false);
      fetchWeek(false);
    } catch (err: any) {
      console.error("Erro ao agendar:", err);
      toast.error(err.message || "Erro ao agendar reunião");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelMeeting = async () => {
    if (!selectedMeeting) return;
    setCanceling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      if (selectedMeeting.google_event_id) {
        await supabase.functions.invoke("google-calendar?action=delete-event", {
          body: { eventId: selectedMeeting.google_event_id, target_user_id: FABRICIO.userId },
          headers: authHeaders,
        });
      }
      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .delete()
        .eq("id", selectedMeeting.id);
      if (error) {
        toast.error("Sem permissão para cancelar esta reunião");
      } else {
        toast.success("Reunião cancelada");
      }
      setSelectedMeeting(null);
      fetchWeek(false);
    } catch (err) {
      console.error("Erro ao cancelar:", err);
      toast.error("Erro ao cancelar reunião");
    } finally {
      setCanceling(false);
    }
  };

  const openReschedule = () => {
    if (!selectedMeeting) return;
    const d = new Date(selectedMeeting.meeting_date);
    setRsDate(format(d, "yyyy-MM-dd"));
    setRsTime(format(d, "HH:mm"));
    setRescheduleMode(true);
  };

  const handleReschedule = async () => {
    if (!selectedMeeting) return;
    if (!rsDate || !rsTime) { toast.error("Informe o novo dia e horário"); return; }
    setRescheduling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const oldStart = new Date(selectedMeeting.meeting_date);
      const [h, m] = rsTime.split(":").map(Number);
      const start = new Date(`${rsDate}T00:00:00`);
      start.setHours(h, m, 0, 0);
      if (start.getTime() === oldStart.getTime()) { toast.info("É o mesmo dia e horário"); return; }

      // duração original: pelo período ocupado da própria reunião no dia atual (fallback 60 min)
      let durationMin = 60;
      {
        const { data: fbOld } = await supabase.functions.invoke("google-calendar?action=freebusy", {
          body: { target_user_id: FABRICIO.userId, date: format(oldStart, "yyyy-MM-dd"), duration_minutes: 30 },
          headers: authHeaders,
        });
        const own = ((fbOld?.busyPeriods || []) as BusyPeriod[]).find((b) => Math.abs(new Date(b.start).getTime() - oldStart.getTime()) < 60000);
        if (own) durationMin = Math.max(15, Math.round((new Date(own.end).getTime() - new Date(own.start).getTime()) / 60000));
      }
      const end = new Date(start.getTime() + durationMin * 60000);

      // Regra: nunca por cima de horário ocupado (ignora o slot da própria reunião)
      const { data: fb, error: fbError } = await supabase.functions.invoke("google-calendar?action=freebusy", {
        body: { target_user_id: FABRICIO.userId, date: rsDate, duration_minutes: durationMin },
        headers: authHeaders,
      });
      if (fbError) throw new Error("Não foi possível verificar a disponibilidade");
      if (fb?.needsAuth) { toast.error("Fabrício precisa reconectar o Google Agenda"); return; }
      const busy = ((fb?.busyPeriods || []) as BusyPeriod[])
        .filter((b) => Math.abs(new Date(b.start).getTime() - oldStart.getTime()) >= 60000);
      const conflict = busy.find((b) => overlaps(start, end, new Date(b.start), new Date(b.end)));
      if (conflict) {
        toast.error(`Horário ocupado: ${format(new Date(conflict.start), "HH:mm")}–${format(new Date(conflict.end), "HH:mm")}. Escolha outra janela.`);
        return;
      }

      let meetingLink = selectedMeeting.meeting_link;
      if (selectedMeeting.google_event_id) {
        const { data: moved, error: mvError } = await supabase.functions.invoke("google-calendar?action=move-event", {
          body: {
            eventId: selectedMeeting.google_event_id,
            target_user_id: FABRICIO.userId,
            startDateTime: start.toISOString(),
            durationMinutes: durationMin,
          },
          headers: authHeaders,
        });
        if (mvError) throw new Error(mvError.message || "Erro ao mover no Google Agenda");
        if (moved?.error) {
          toast.error(moved.needsAuth ? "Fabrício precisa reconectar o Google Agenda" : moved.error);
          return;
        }
        meetingLink = moved?.event?.meetingLink || meetingLink;
      }

      const { error: upError } = await supabase
        .from("onboarding_meeting_notes")
        .update({ meeting_date: start.toISOString(), meeting_link: meetingLink, duration_minutes: durationMin } as any)
        .eq("id", selectedMeeting.id);
      if (upError) {
        toast.warning("Movida no Google Agenda, mas não consegui atualizar no projeto");
      } else {
        toast.success(`Reunião remarcada para ${format(start, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}`);
      }
      setRescheduleMode(false);
      setSelectedMeeting(null);
      fetchWeek(false);
    } catch (err: any) {
      console.error("Erro ao reagendar:", err);
      toast.error(err.message || "Erro ao reagendar reunião");
    } finally {
      setRescheduling(false);
    }
  };

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.projectId, p.companyName));
    return map;
  }, [projects]);

  return (
    <div className="min-h-screen bg-background">
      <NexusHeader title="Agenda do Fabrício" />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Agenda do Fabrício</h1>
            </div>
            {!canEdit && (
              <Badge variant="secondary" className="gap-1">
                <Eye className="h-3 w-3" /> Somente visualização
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center">
              {format(weekDays[0], "dd/MM", { locale: ptBR })} – {format(weekDays[4], "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fetchWeek(false)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {needsAuth && (
          <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
            O Fabrício precisa reconectar o Google Agenda para a disponibilidade aparecer aqui.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <div className="min-w-[860px]">
              {/* Cabeçalho dos dias */}
              <div className="grid" style={{ gridTemplateColumns: "70px repeat(5, minmax(0, 1fr))" }}>
                <div className="border-b border-r bg-muted/50" />
                {weekDays.map((day) => (
                  <div
                    key={dateKey(day)}
                    className={`border-b border-r last:border-r-0 py-2 text-center bg-muted/50 ${
                      isSameDay(day, new Date()) ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="text-xs uppercase text-muted-foreground">
                      {format(day, "EEE", { locale: ptBR })}
                    </div>
                    <div className="text-sm font-semibold">
                      {format(day, "dd/MM", { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
              {/* Grade de horários — estilo Google Agenda: linhas de meia hora ao fundo e os compromissos como blocos
                  por cima, com a altura real da duração. Clicar num espaço livre agenda naquele horário (:00 ou :30). */}
              <div className="relative">
                {slotTimes.map((time) => {
                  const cheia = time.endsWith(":00");
                  return (
                    <div key={time} className="grid" style={{ gridTemplateColumns: "70px repeat(5, minmax(0, 1fr))", height: ROW_H }}>
                      <div className={`border-r px-2 text-[11px] text-right leading-none pt-1 ${cheia ? "border-t" : ""} ${
                        PRODUCT_SLOTS.has(time) ? "bg-emerald-100/70 text-emerald-700 font-semibold" : "bg-muted/30 text-muted-foreground"
                      }`}>
                        {cheia ? time : ""}
                      </div>
                      {weekDays.map((day) => {
                        const key = `${dateKey(day)}-${time}`;
                        const tomado = isSlotBusy(day, time) || !!meetingsForSlot(day, time) || !!meetingContinuing(day, time);
                        return (
                          <button
                            key={key}
                            onClick={() => !tomado && openSchedule(day, time)}
                            disabled={!canEdit || tomado}
                            title={!tomado && canEdit ? `Agendar às ${time}` : undefined}
                            className={`border-r last:border-r-0 group transition-colors ${cheia ? "border-t" : "border-t border-t-border/40 border-dashed"} ${
                              PRODUCT_SLOTS.has(time) ? "bg-emerald-50" : ""
                            } ${!tomado && canEdit ? "cursor-pointer hover:bg-primary/10" : "cursor-default"}`}
                          >
                            {!tomado && canEdit && (
                              <span className="hidden group-hover:flex items-center justify-center gap-1 text-[10px] text-primary/80 font-medium">
                                <Plus className="h-3 w-3" /> {time}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {/* blocos por cima */}
                {weekDays.map((day, di) => {
                  const inicioDia = new Date(day); inicioDia.setHours(DAY_START_HOUR, 0, 0, 0);
                  const fimDia = new Date(day); fimDia.setHours(DAY_END_HOUR, 0, 0, 0);
                  const pos = (ini: Date, fim: Date) => {
                    const a = Math.max(ini.getTime(), inicioDia.getTime()), b = Math.min(fim.getTime(), fimDia.getTime());
                    if (b <= a) return null;
                    return { top: ((a - inicioDia.getTime()) / 1800000) * ROW_H, height: Math.max(((b - a) / 1800000) * ROW_H - 2, 14) };
                  };
                  const colStyle = (p: { top: number; height: number }) => ({
                    top: p.top + 1, height: p.height,
                    left: `calc(70px + (100% - 70px) * ${di} / 5 + 2px)`, width: `calc((100% - 70px) / 5 - 5px)`,
                  });
                  const doDia = meetings.filter((mt) => isSameDay(new Date(mt.meeting_date), day));
                  const ocupados = (busyByDay[dateKey(day)] || [])
                    .map((b) => ({ ini: new Date(b.start), fim: new Date(b.end) }))
                    // o que já aparece como reunião não repete como "Ocupado"
                    .flatMap((b) => {
                      let partes = [b];
                      for (const mt of doDia) {
                        const mi = new Date(mt.meeting_date), mf = meetingEnd(mt);
                        partes = partes.flatMap((x) => {
                          if (mf <= x.ini || mi >= x.fim) return [x];
                          const r: { ini: Date; fim: Date }[] = [];
                          if (mi > x.ini) r.push({ ini: x.ini, fim: mi });
                          if (mf < x.fim) r.push({ ini: mf, fim: x.fim });
                          return r;
                        });
                      }
                      return partes;
                    })
                    .filter((x) => x.fim.getTime() - x.ini.getTime() >= 5 * 60000);
                  return (
                    <div key={`ov-${dateKey(day)}`}>
                      {ocupados.map((o, k) => {
                        const p = pos(o.ini, o.fim); if (!p) return null;
                        return (
                          <div key={`b-${k}`} className="absolute rounded-md bg-muted border border-border/60 px-1.5 py-0.5 overflow-hidden pointer-events-none" style={colStyle(p)}>
                            <span className="text-[10px] text-muted-foreground">Ocupado · {format(o.ini, "HH:mm")}–{format(o.fim, "HH:mm")}</span>
                          </div>
                        );
                      })}
                      {doDia.map((mt) => {
                        const ini = new Date(mt.meeting_date), fim = meetingEnd(mt);
                        const p = pos(ini, fim); if (!p) return null;
                        const crm = mt.origem === "crm";
                        return (
                          <button
                            key={mt.id}
                            onClick={() => (crm ? (mt.lead_id ? window.open(`#/crm/leads/${mt.lead_id}`, "_blank") : undefined) : setSelectedMeeting(mt))}
                            title={`${mt.meeting_title} · ${format(ini, "HH:mm")}–${format(fim, "HH:mm")}${crm ? " · reunião do CRM (abre o negócio)" : ""}`}
                            className={`absolute rounded-md px-1.5 py-1 text-left overflow-hidden shadow-sm transition-colors ${
                              crm ? "bg-blue-600 hover:bg-blue-600/90 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"
                            }`}
                            style={colStyle(p)}
                          >
                            <div className="text-[11px] font-semibold leading-tight truncate flex items-center gap-1">
                              <Video className="h-3 w-3 shrink-0" />
                              {mt.meeting_title}
                            </div>
                            {p.height >= 26 && (
                              <div className="text-[10px] opacity-85 leading-tight">{format(ini, "HH:mm")}–{format(fim, "HH:mm")}{crm ? " · CRM" : ""}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Faixas em verde (10h e 14h) são as janelas dedicadas a reuniões de produto com clientes. Em vermelho, reuniões de cliente (agendadas aqui ou dentro do projeto); em azul, reuniões do CRM com leads. Clique num espaço livre para agendar naquele horário, inclusive nas meias horas. Horários ocupados vêm do Google Agenda do Fabrício. Ao agendar, o evento é criado no
          Google Agenda com link do Meet e a reunião entra automaticamente na aba Reuniões do
          projeto do cliente.
        </p>
      </div>

      {/* Dialog de agendamento */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> Agendar na agenda do Fabrício
            </DialogTitle>
            <DialogDescription>
              O evento é criado no Google Agenda do Fabrício e registrado na aba Reuniões do projeto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal overflow-hidden"
                  >
                    <span className="min-w-0 flex-1 text-left truncate">
                      {formProjectId
                        ? (() => {
                            const p = projects.find((x) => x.projectId === formProjectId);
                            return p ? p.companyName : "Selecione a empresa";
                          })()
                        : "Digite pra buscar a empresa"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList className="max-h-64">
                      <CommandEmpty>Nenhuma empresa encontrada</CommandEmpty>
                      <CommandGroup>
                        {projects.map((p) => (
                          <CommandItem
                            key={p.projectId}
                            value={`${p.companyName} ${p.productName}`}
                            onSelect={() => {
                              handleProjectChange(p.projectId);
                              setCompanyPickerOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                formProjectId === p.projectId ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{p.companyName}</span>
                              {p.productName && (
                                <span className="block truncate text-xs text-muted-foreground">{p.productName}</span>
                              )}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formProjectId && (() => {
                const p = projects.find((x) => x.projectId === formProjectId);
                return p?.productName ? (
                  <p className="text-xs text-muted-foreground">{p.companyName} · {p.productName}</p>
                ) : null;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Input type="time" step={600} value={formTime} onChange={(e) => setFormTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={formDuration} onValueChange={setFormDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Reunião UNV — Empresa" />
            </div>
            <div className="space-y-2">
              <Label>Pauta (opcional)</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setScheduleOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSchedule} disabled={saving || !formProjectId || !formTitle.trim()}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
                Agendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalhes da reunião */}
      <Dialog open={!!selectedMeeting} onOpenChange={(o) => { if (!o) { setSelectedMeeting(null); setRescheduleMode(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> {selectedMeeting?.meeting_title}
            </DialogTitle>
            <DialogDescription>
              {selectedMeeting &&
                format(new Date(selectedMeeting.meeting_date), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
              {selectedMeeting && projectNameById.get(selectedMeeting.project_id)
                ? ` · ${projectNameById.get(selectedMeeting.project_id)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedMeeting?.meeting_link && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open(selectedMeeting.meeting_link!, "_blank")}
              >
                <Video className="h-4 w-4 mr-2" /> Abrir Google Meet
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate(`/onboarding-tasks/${selectedMeeting?.project_id}`)}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir projeto do cliente
            </Button>
            {canEdit && !rescheduleMode && (
              <Button variant="outline" className="w-full justify-start" onClick={openReschedule}>
                <CalendarClock className="h-4 w-4 mr-2" /> Alterar dia e horário
              </Button>
            )}
            {canEdit && rescheduleMode && (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Novo dia e horário</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Dia</Label>
                    <Input type="date" value={rsDate} onChange={(e) => setRsDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Horário</Label>
                    <Select value={rsTime} onValueChange={setRsTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {(slotTimes.includes(rsTime) ? slotTimes : [rsTime, ...slotTimes]).map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Mantém a duração, o link do Meet e os convidados. O Google Agenda é atualizado e os convidados recebem o aviso.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setRescheduleMode(false)} disabled={rescheduling}>Voltar</Button>
                  <Button size="sm" className="flex-1" onClick={handleReschedule} disabled={rescheduling}>
                    {rescheduling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
                  </Button>
                </div>
              </div>
            )}
            {canEdit && !rescheduleMode && (
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleCancelMeeting}
                disabled={canceling}
              >
                {canceling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Cancelar reunião
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgendaFabricioPage;
