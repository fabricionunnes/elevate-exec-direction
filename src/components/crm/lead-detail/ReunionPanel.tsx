import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Video,
  ExternalLink,
  Calendar as CalendarIcon,
  AlertCircle,
  Copy,
  Clock,
  Trash2,
  RefreshCw,
  UserCog,
  Loader2,
  Check,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  user_id: string;
}

interface ExistingMeeting {
  id: string;
  title: string;
  scheduled_at: string | null;
  meeting_link: string | null;
  google_calendar_event_id: string | null;
  google_calendar_user_id: string | null;
  lead_id: string;
  status: string | null;
  responsible_staff_id: string | null;
}

interface ReunionPanelProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  onNoShowToggle: () => void;
  onRefresh: () => void;
}

const getCurrentStaffId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: staff } = await supabase
    .from("onboarding_staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();
  return staff?.id || null;
};

export function ReunionPanel({
  leadId,
  leadName,
  leadEmail,
  onNoShowToggle,
  onRefresh,
}: ReunionPanelProps) {
  const [markedNoShow, setMarkedNoShow] = useState(false);
  const [meeting, setMeeting] = useState<ExistingMeeting | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [copied, setCopied] = useState(false);

  // Edit modes
  const [editMode, setEditMode] = useState<"reschedule" | "change-closer" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Staff / slots
  const [connectedStaff, setConnectedStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [durationMinutes] = useState(60);

  const selectedStaff = useMemo(
    () => connectedStaff.find((s) => s.user_id === selectedStaffUserId),
    [connectedStaff, selectedStaffUserId]
  );

  // Load existing meeting
  const loadMeeting = async () => {
    setLoadingMeeting(true);
    try {
      const { data } = await supabase
        .from("crm_activities")
        .select("id, title, scheduled_at, meeting_link, google_calendar_event_id, google_calendar_user_id, lead_id, status, responsible_staff_id")
        .eq("lead_id", leadId)
        .eq("type", "meeting")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1);

      setMeeting(data && data.length > 0 ? (data[0] as any) : null);
    } catch (err) {
      console.error("Error loading meeting:", err);
    } finally {
      setLoadingMeeting(false);
    }
  };

  useEffect(() => { loadMeeting(); }, [leadId]);

  // Load staff when entering edit mode
  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data: crmPermissions } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      const crmIds = new Set((crmPermissions || []).map((p) => p.staff_id));

      const { data } = await supabase.functions.invoke(
        "google-calendar?action=list-connected-staff",
        { body: {} }
      );

      if (data?.staff) {
        const filtered = data.staff.filter(
          (s: StaffMember) => s.role === "master" || crmIds.has(s.id)
        );
        setConnectedStaff(filtered);
      }
    } catch (err) {
      console.error("Error loading staff:", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (editMode) loadStaff();
  }, [editMode]);

  // Fetch slots when staff/date changes
  useEffect(() => {
    if (!selectedStaffUserId || !selectedDate || !editMode) return;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const { data } = await supabase.functions.invoke(
          "google-calendar?action=freebusy",
          { body: { target_user_id: selectedStaffUserId, date: dateStr, duration_minutes: durationMinutes } }
        );
        setAvailableSlots(data?.availableSlots || []);
      } catch {
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedStaffUserId, selectedDate, durationMinutes, editMode]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  const getRoleLabel = (role: string) => {
    const map: Record<string, string> = { closer: "Closer", sdr: "SDR", master: "Master", admin: "Admin", consultant: "Consultor", rh: "RH" };
    return map[role] || role;
  };

  // ── Reschedule ──
  const handleReschedule = async () => {
    if (!meeting || !selectedDate || !selectedSlot) return;
    setActionLoading(true);
    try {
      const staffId = await getCurrentStaffId();
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [h, m] = selectedSlot.split(":").map(Number);
      const endH = h + Math.floor(durationMinutes / 60);
      const endM = m + (durationMinutes % 60);
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
      // Use Brasília offset (-03:00) so the stored UTC matches the chosen local time
      const newStart = `${dateStr}T${selectedSlot}:00-03:00`;
      const newEnd = `${dateStr}T${endTime}:00-03:00`;

      const oldUserId = meeting.google_calendar_user_id;
      const newUserId = selectedStaffUserId;
      const closerChanged = oldUserId && newUserId && oldUserId !== newUserId;

      let newEventId = meeting.google_calendar_event_id;
      let newMeetLink = meeting.meeting_link;

      // Build description with lead link
      const baseUrl = getPublicBaseUrl();
      const leadCardUrl = `${baseUrl}/#/crm/leads/${leadId}`;
      const eventDescription = `📋 Link do lead no CRM: ${leadCardUrl}`;

      if (closerChanged) {
        // Delete from old calendar
        if (meeting.google_calendar_event_id) {
          try {
            await supabase.functions.invoke("google-calendar?action=delete-event", {
              body: { eventId: meeting.google_calendar_event_id, target_user_id: oldUserId },
            });
          } catch (err) { console.error(err); }
        }
        // Create on new calendar
        try {
          const { data: createData } = await supabase.functions.invoke("google-calendar?action=create-event", {
            body: {
              title: meeting.title,
              startDateTime: newStart,
              endDateTime: newEnd,
              target_user_id: newUserId,
              attendees: leadEmail ? [leadEmail] : [],
              createMeetLink: true,
              description: eventDescription,
            },
          });
          if (createData?.eventId) newEventId = createData.eventId;
          if (createData?.meetLink) newMeetLink = createData.meetLink;
        } catch (err) { console.error(err); }
      } else if (meeting.google_calendar_event_id) {
        try {
          await supabase.functions.invoke("google-calendar?action=update-event", {
            body: { eventId: meeting.google_calendar_event_id, title: meeting.title, startDateTime: newStart, endDateTime: newEnd, target_user_id: oldUserId, description: eventDescription },
          });
        } catch (err) { console.error(err); }
      }

      const newStaff = connectedStaff.find((s) => s.user_id === newUserId);
      const newResponsibleId = newStaff?.id || meeting.responsible_staff_id;

      const updatePayload: Record<string, any> = { scheduled_at: newStart, status: "pending" };
      if (closerChanged) {
        updatePayload.google_calendar_event_id = newEventId;
        updatePayload.google_calendar_user_id = newUserId;
        updatePayload.responsible_staff_id = newResponsibleId;
        if (newMeetLink) updatePayload.meeting_link = newMeetLink;
      }

      await supabase.from("crm_activities").update(updatePayload).eq("id", meeting.id);

      if (closerChanged && newResponsibleId) {
        await supabase.from("crm_leads").update({
          owner_staff_id: newResponsibleId,
          closer_staff_id: newResponsibleId,
          updated_at: new Date().toISOString(),
        }).eq("id", leadId);
      }

      await supabase.from("crm_activity_history").insert({
        activity_id: meeting.id,
        lead_id: leadId,
        action: "rescheduled",
        performed_by_staff_id: staffId,
        old_scheduled_at: meeting.scheduled_at,
        new_scheduled_at: newStart,
        notes: closerChanged ? `Reagendada e closer alterado para ${newStaff?.name}` : "Reunião reagendada",
      } as any);

      toast.success("Reunião reagendada com sucesso!");
      setEditMode(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      await loadMeeting();
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reagendar reunião");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Change Closer ──
  const handleChangeCloser = async () => {
    if (!meeting || !selectedStaff) return;
    if (selectedStaff.user_id === meeting.google_calendar_user_id) {
      toast.info("Mesmo closer selecionado");
      return;
    }
    setActionLoading(true);
    try {
      const staffId = await getCurrentStaffId();

      // Move calendar event
      if (meeting.google_calendar_event_id && meeting.scheduled_at) {
        const dt = new Date(meeting.scheduled_at);
        const startStr = format(dt, "yyyy-MM-dd'T'HH:mm:ss");
        const endDt = new Date(dt.getTime() + durationMinutes * 60000);
        const endStr = format(endDt, "yyyy-MM-dd'T'HH:mm:ss");

        try {
          await supabase.functions.invoke("google-calendar?action=delete-event", {
            body: { eventId: meeting.google_calendar_event_id, target_user_id: meeting.google_calendar_user_id },
          });
        } catch (err) { console.error(err); }

        try {
          const { data: createData } = await supabase.functions.invoke("google-calendar?action=create-event", {
            body: {
              title: meeting.title,
              startDateTime: startStr,
              endDateTime: endStr,
              target_user_id: selectedStaff.user_id,
              attendees: leadEmail ? [leadEmail] : [],
              createMeetLink: true,
            },
          });

          await supabase.from("crm_activities").update({
            responsible_staff_id: selectedStaff.id,
            google_calendar_user_id: selectedStaff.user_id,
            google_calendar_event_id: createData?.eventId || null,
            meeting_link: createData?.meetLink || meeting.meeting_link,
          }).eq("id", meeting.id);
        } catch (err) { console.error(err); }
      } else {
        await supabase.from("crm_activities").update({
          responsible_staff_id: selectedStaff.id,
          google_calendar_user_id: selectedStaff.user_id,
        }).eq("id", meeting.id);
      }

      // Update lead owner
      await supabase.from("crm_leads").update({
        owner_staff_id: selectedStaff.id,
        closer_staff_id: selectedStaff.id,
        updated_at: new Date().toISOString(),
      }).eq("id", leadId);

      await supabase.from("crm_activity_history").insert({
        activity_id: meeting.id,
        lead_id: leadId,
        action: "rescheduled",
        performed_by_staff_id: staffId,
        notes: `Closer alterado para ${selectedStaff.name}`,
      } as any);

      toast.success(`Closer alterado para ${selectedStaff.name}`);
      setEditMode(null);
      await loadMeeting();
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao alterar closer");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!meeting) return;
    setActionLoading(true);
    try {
      const staffId = await getCurrentStaffId();

      if (meeting.google_calendar_event_id) {
        try {
          await supabase.functions.invoke("google-calendar?action=delete-event", {
            body: { eventId: meeting.google_calendar_event_id, target_user_id: meeting.google_calendar_user_id },
          });
        } catch (err) { console.error(err); }
      }

      await supabase.from("crm_activities").update({ status: "cancelled" }).eq("id", meeting.id);

      await supabase.from("crm_activity_history").insert({
        activity_id: meeting.id,
        lead_id: leadId,
        action: "cancelled",
        performed_by_staff_id: staffId,
        notes: deleteReason || "Reunião cancelada",
      } as any);

      toast.success("Reunião cancelada");
      setShowDeleteConfirm(false);
      setDeleteReason("");
      await loadMeeting();
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar reunião");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading state ──
  if (loadingMeeting) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── No meeting ──
  if (!meeting) {
    return (
      <div className="p-4">
        <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-l-amber-400">
          <p className="text-sm text-muted-foreground">Nenhuma reunião agendada para este lead.</p>
        </div>
      </div>
    );
  }

  // ── Delete confirmation dialog ──
  const deleteDialog = (
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar reunião?</AlertDialogTitle>
          <AlertDialogDescription>
            O evento será removido do Google Calendar. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Motivo do cancelamento (opcional)"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Cancelar Reunião
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ── Change closer mode ──
  if (editMode === "change-closer") {
    return (
      <div className="flex flex-col h-full p-4 space-y-4">
        {deleteDialog}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserCog className="h-4 w-4 text-blue-500" />
            Alterar Closer
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setEditMode(null)}>Voltar</Button>
        </div>

        {loadingStaff ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <Select value={selectedStaffUserId} onValueChange={setSelectedStaffUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione o closer" /></SelectTrigger>
            <SelectContent>
              {connectedStaff.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  <div className="flex items-center gap-2">
                    <span>{s.name}</span>
                    <Badge variant="secondary" className="text-xs">{getRoleLabel(s.role)}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          className="w-full"
          onClick={handleChangeCloser}
          disabled={actionLoading || !selectedStaffUserId || selectedStaffUserId === meeting.google_calendar_user_id}
        >
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCog className="h-4 w-4 mr-2" />}
          Confirmar Alteração
        </Button>
      </div>
    );
  }

  // ── Reschedule mode ──
  if (editMode === "reschedule") {
    const today = startOfDay(new Date());
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {deleteDialog}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              Reagendar Reunião
            </h3>
            <Button variant="ghost" size="sm" onClick={() => { setEditMode(null); setSelectedDate(undefined); setSelectedSlot(null); }}>
              Voltar
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Staff selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escolha uma agenda</Label>
              {loadingStaff ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <Select value={selectedStaffUserId} onValueChange={(v) => { setSelectedStaffUserId(v); setSelectedSlot(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {connectedStaff.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          <Badge variant="secondary" className="text-xs">{getRoleLabel(s.role)}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { setSelectedDate(date); setSelectedSlot(null); }}
                locale={ptBR}
                disabled={(date) => isBefore(date, today)}
                className="rounded-md border"
              />
            </div>

            {/* Slots */}
            {selectedDate && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horários disponíveis — {format(selectedDate, "dd/MM")}
                </Label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando horários...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhum horário disponível nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        variant={selectedSlot === slot ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Confirm */}
            {selectedSlot && (
              <Button className="w-full" onClick={handleReschedule} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Confirmar Reagendamento
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── Default view ──
  const hasMeeting = !!meeting.scheduled_at;
  const meetingDate = meeting.scheduled_at
    ? format(new Date(meeting.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : "";

  return (
    <div className="flex flex-col h-full">
      {deleteDialog}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* No-show toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <span className="text-sm font-medium">Marcar no-show</span>
          <Switch
            checked={markedNoShow}
            onCheckedChange={(checked) => {
              setMarkedNoShow(checked);
              if (checked) onNoShowToggle();
            }}
          />
        </div>

        <div className="flex items-center gap-2 text-sm font-medium">
          <Video className="h-4 w-4 text-blue-600" />
          Reunião
        </div>

        {hasMeeting ? (
          <div className="space-y-4">
            {/* Meeting info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data e horário agendado</p>
                  <p className="text-sm font-semibold">{meetingDate}</p>
                </div>
              </div>
            </div>

            {/* Meeting link */}
            {meeting.meeting_link ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Link da reunião</Label>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                  >
                    <Video className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium truncate">{meeting.meeting_link}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 ml-auto" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.open(meeting.meeting_link!, "_blank")}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Entrar na reunião
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(meeting.meeting_link!)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">Nenhum link de reunião disponível.</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-3 flex-col gap-1.5 text-xs border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => {
                  setEditMode("reschedule");
                  if (meeting.google_calendar_user_id) setSelectedStaffUserId(meeting.google_calendar_user_id);
                }}
              >
                <RefreshCw className="h-4 w-4 text-amber-500" />
                Reagendar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-3 flex-col gap-1.5 text-xs border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => {
                  setEditMode("change-closer");
                  if (meeting.google_calendar_user_id) setSelectedStaffUserId(meeting.google_calendar_user_id);
                }}
              >
                <UserCog className="h-4 w-4 text-blue-500" />
                Trocar Closer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-3 flex-col gap-1.5 text-xs border-destructive/30 hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
                Excluir
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-l-amber-400">
            <p className="text-sm text-muted-foreground">
              Nenhum agendamento encontrado para esse lead.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
