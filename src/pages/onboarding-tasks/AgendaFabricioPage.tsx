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
  ExternalLink, CalendarDays, Eye, RefreshCw, Check, ChevronsUpDown,
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
}

interface ProjectOption {
  projectId: string;
  companyName: string;
  productName: string;
}

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
        .select("id, project_id, meeting_title, meeting_date, meeting_link, google_event_id, staff_id")
        .eq("calendar_owner_id", FABRICIO.userId)
        .gte("meeting_date", weekStart.toISOString())
        .lt("meeting_date", weekEnd.toISOString())
        .order("meeting_date");
      setMeetings((notes || []) as AgendaMeeting[]);
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
              <div className="grid" style={{ gridTemplateColumns: "70px repeat(5, 1fr)" }}>
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
              {/* Grade de horários */}
              {slotTimes.map((time) => (
                <div
                  key={time}
                  className="grid"
                  style={{ gridTemplateColumns: "70px repeat(5, 1fr)" }}
                >
                  <div className="border-b border-r px-2 py-1 text-[11px] text-muted-foreground text-right bg-muted/30">
                    {time}
                  </div>
                  {weekDays.map((day) => {
                    const meeting = meetingsForSlot(day, time);
                    const busy = isSlotBusy(day, time);
                    const key = `${dateKey(day)}-${time}`;
                    if (meeting) {
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedMeeting(meeting)}
                          className="border-b border-r last:border-r-0 min-h-[34px] px-1.5 py-1 text-left bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <div className="text-[11px] font-semibold truncate flex items-center gap-1">
                            <Video className="h-3 w-3 shrink-0" />
                            {meeting.meeting_title}
                          </div>
                          <div className="text-[10px] opacity-80">
                            {format(new Date(meeting.meeting_date), "HH:mm")}
                          </div>
                        </button>
                      );
                    }
                    if (busy) {
                      return (
                        <div
                          key={key}
                          className="border-b border-r last:border-r-0 min-h-[34px] bg-muted flex items-center justify-center"
                        >
                          <span className="text-[10px] text-muted-foreground">Ocupado</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={key}
                        onClick={() => openSchedule(day, time)}
                        disabled={!canEdit}
                        className={`border-b border-r last:border-r-0 min-h-[34px] transition-colors group ${
                          canEdit ? "hover:bg-primary/5 cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {canEdit && (
                          <Plus className="h-3.5 w-3.5 mx-auto text-transparent group-hover:text-primary/60" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Horários ocupados vêm do Google Agenda do Fabrício. Ao agendar, o evento é criado no
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
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {formProjectId
                        ? (() => {
                            const p = projects.find((x) => x.projectId === formProjectId);
                            return p ? `${p.companyName}${p.productName ? ` — ${p.productName}` : ""}` : "Selecione a empresa";
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
                            <span className="truncate">
                              {p.companyName}
                              {p.productName ? ` — ${p.productName}` : ""}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
      <Dialog open={!!selectedMeeting} onOpenChange={(o) => !o && setSelectedMeeting(null)}>
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
            {canEdit && (
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
