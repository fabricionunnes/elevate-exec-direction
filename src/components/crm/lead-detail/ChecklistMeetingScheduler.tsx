import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyCrmActivityViaWhatsApp } from "@/lib/crm/notifyActivityWhatsApp";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Calendar as CalendarIcon,
  AlertCircle,
  Check,
  Copy,
  Video,
  Clock,
  Link2,
  Trash2,
  RefreshCw,
  UserCog,
  ExternalLink,
  History,
  User,
  XCircle,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

interface HistoryEntry {
  id: string;
  action: string;
  performed_by_staff_id: string | null;
  old_scheduled_at: string | null;
  new_scheduled_at: string | null;
  notes: string | null;
  created_at: string;
  staff?: { name: string } | null;
}

interface ChecklistMeetingSchedulerProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  checklistItemId: string;
  checklistItemTitle: string;
  onScheduled: () => void;
}

export function ChecklistMeetingScheduler({
  leadId,
  leadName,
  leadEmail,
  checklistItemId,
  checklistItemTitle,
  onScheduled,
}: ChecklistMeetingSchedulerProps) {
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [connectedStaff, setConnectedStaff] = useState<StaffMember[]>([]);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [markAsNoShow, setMarkAsNoShow] = useState(false);
  const [createdMeetLink, setCreatedMeetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState(`Reunião com ${leadName}`);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [showAvailabilityOptions, setShowAvailabilityOptions] = useState(false);
  const [allowWeekends, setAllowWeekends] = useState(false);

  // Existing meeting state
  const [existingMeeting, setExistingMeeting] = useState<ExistingMeeting | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [editMode, setEditMode] = useState<"view" | "reschedule" | "change-closer" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check for existing meeting on mount
  useEffect(() => {
    loadExistingMeeting();
  }, [leadId, checklistItemId, checklistItemTitle]);

  useEffect(() => {
    loadConnectedStaff();
  }, []);

  useEffect(() => {
    if (selectedStaffUserId && selectedDate) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
    }
  }, [selectedStaffUserId, selectedDate, durationMinutes]);

  const loadExistingMeeting = async () => {
    setLoadingExisting(true);
    try {
      // Only look for meetings tied to THIS specific checklist item.
      // We match by description prefix used when scheduling: "Agendamento via checklist: <title>"
      const descNeedle = `Agendamento via checklist: ${checklistItemTitle}`;
      const { data, error } = await supabase
        .from("crm_activities")
        .select("id, title, scheduled_at, meeting_link, google_calendar_event_id, google_calendar_user_id, lead_id, status, responsible_staff_id, description")
        .eq("lead_id", leadId)
        .eq("type", "meeting")
        .neq("status", "cancelled")
        .ilike("description", `${descNeedle}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setExistingMeeting(data[0] as ExistingMeeting);
        loadHistory(data[0].id);
      } else {
        setExistingMeeting(null);
      }
    } catch (err) {
      console.error("Error loading existing meeting:", err);
    } finally {
      setLoadingExisting(false);
    }
  };

  const loadHistory = async (activityId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("crm_activity_history")
        .select("*, staff:onboarding_staff!crm_activity_history_performed_by_staff_id_fkey(name)")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false }) as any;
      if (!error && data) setHistory(data);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

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

  const loadConnectedStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data: crmPermissions } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      const staffIdsWithCRMAccess = new Set((crmPermissions || []).map(p => p.staff_id));

      const { data, error } = await supabase.functions.invoke(
        "google-calendar?action=list-connected-staff",
        { body: {} }
      );

      if (error) throw error;

      if (data?.staff) {
        const filteredStaff = data.staff.filter((staff: StaffMember) =>
          staff.role === "master" || staffIdsWithCRMAccess.has(staff.id)
        );

        setConnectedStaff(filteredStaff);

        if (filteredStaff.length > 0 && !selectedStaffUserId) {
          setSelectedStaffUserId(filteredStaff[0].user_id);
        }
      }
    } catch (error) {
      console.error("Error loading connected staff:", error);
      toast.error("Erro ao carregar agendas disponíveis");
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchAvailableSlots = async () => {
    if (!selectedStaffUserId || !selectedDate) return;

    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      const { data, error } = await supabase.functions.invoke(
        "google-calendar?action=freebusy",
        {
          body: {
            target_user_id: selectedStaffUserId,
            date: dateStr,
            duration_minutes: durationMinutes,
          },
        }
      );

      if (error) throw error;

      if (data?.needsAuth) {
        const staff = connectedStaff.find((s) => s.user_id === selectedStaffUserId);
        toast.error(`${staff?.name || "Usuário"} precisa reconectar o Google Calendar`);
        setAvailableSlots([]);
        return;
      }

      setAvailableSlots(data?.availableSlots || []);
    } catch (error) {
      console.error("Error fetching available slots:", error);
      toast.error("Erro ao buscar horários disponíveis");
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedStaffUserId || !selectedDate || !selectedSlot) {
      toast.error("Selecione uma agenda, data e horário");
      return;
    }

    setScheduling(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [hours, minutes] = selectedSlot.split(":").map(Number);
      const totalEndMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(totalEndMinutes / 60);
      const endMins = totalEndMinutes % 60;
      const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

      const startDateTime = `${dateStr}T${selectedSlot}:00`;
      const endDateTime = `${dateStr}T${endTime}:00`;

      const attendees = leadEmail ? [leadEmail] : undefined;

        const leadCardUrl = `${getPublicBaseUrl()}/#/crm/leads/${leadId}`;
        const eventDescription = `Agendamento via checklist CRM: ${checklistItemTitle}\n\n📋 Link do lead no CRM: ${leadCardUrl}`;

        const { data, error } = await supabase.functions.invoke(
          "google-calendar?action=create-event",
          {
            body: {
              title: meetingTitle,
              description: eventDescription,
              startDateTime,
              endDateTime,
              attendees,
              target_user_id: selectedStaffUserId,
            },
          }
        );

      if (error) throw error;

      if (data?.needsAuth) {
        const staff = connectedStaff.find((s) => s.user_id === selectedStaffUserId);
        toast.error(`${staff?.name || "Usuário"} precisa reconectar o Google Calendar`);
        return;
      }

      if (data?.success) {
        const { data: userData } = await supabase.auth.getUser();
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", userData.user?.id)
          .single();

        // Find the staff member to set as responsible
        const selectedStaff = connectedStaff.find(s => s.user_id === selectedStaffUserId);

        await supabase.from("crm_activities").insert({
          lead_id: leadId,
          type: "meeting",
          title: meetingTitle,
          description: `Agendamento via checklist: ${checklistItemTitle}`,
          scheduled_at: startDateTime,
          responsible_staff_id: selectedStaff?.id || staffData?.id,
          status: "pending",
          meeting_link: data.event?.meetingLink || null,
          google_calendar_event_id: data.event?.id || null,
          google_calendar_user_id: selectedStaffUserId || null,
        } as any);

        // Send WhatsApp notification to responsible staff
        const responsibleId = selectedStaff?.id || staffData?.id;
        if (responsibleId) {
          notifyCrmActivityViaWhatsApp({
            staffId: responsibleId,
            leadId,
            leadName,
            activityTitle: meetingTitle,
            activityType: "meeting",
            scheduledAt: startDateTime,
          });
        }

        const { data: insertedActivity } = await supabase
          .from("crm_activities")
          .select("id")
          .eq("lead_id", leadId)
          .eq("google_calendar_event_id", data.event?.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (insertedActivity) {
          await supabase.from("crm_activity_history").insert({
            activity_id: insertedActivity.id,
            lead_id: leadId,
            action: "scheduled",
            performed_by_staff_id: staffData?.id,
            new_scheduled_at: startDateTime,
            notes: `Agendado: ${meetingTitle}`,
          } as any);
        }

        // Update lead: set closer as owner and move to "Agendada" stage
        if (selectedStaff) {
          // Get lead's pipeline_id
          const { data: leadData } = await supabase
            .from("crm_leads")
            .select("pipeline_id")
            .eq("id", leadId)
            .single();

          if (leadData?.pipeline_id) {
            // Find "Agendada" stage
            const { data: agendadaStage } = await supabase
              .from("crm_stages")
              .select("id, name")
              .eq("pipeline_id", leadData.pipeline_id)
              .or("name.ilike.%agendada%,name.ilike.%agendou%")
              .limit(1)
              .maybeSingle();

            const updatePayload: Record<string, any> = {
              owner_staff_id: selectedStaff.id,
              closer_staff_id: selectedStaff.id,
              updated_at: new Date().toISOString(),
            };
            if (agendadaStage) {
              updatePayload.stage_id = agendadaStage.id;
            }

            await supabase
              .from("crm_leads")
              .update(updatePayload)
              .eq("id", leadId);

            // Log history
            if (agendadaStage) {
              await supabase.from("crm_lead_history").insert({
                lead_id: leadId,
                field_name: "stage_id",
                new_value: agendadaStage.name,
                changed_by_staff_id: staffData?.id,
                notes: `Lead movido para ${agendadaStage.name} após agendamento`,
              } as any);
            }

            await supabase.from("crm_lead_history").insert({
              lead_id: leadId,
              field_name: "owner_staff_id",
              new_value: selectedStaff.name,
              changed_by_staff_id: staffData?.id,
              notes: `Closer ${selectedStaff.name} definido como responsável após agendamento`,
            } as any);
          }
        }

        if (data.event?.meetingLink) {
          setCreatedMeetLink(data.event.meetingLink);
        }

        toast.success("Reunião agendada com sucesso!");
        await loadExistingMeeting();
        onScheduled();
      }
    } catch (error: any) {
      console.error("Schedule meeting error:", error);
      toast.error(error.message || "Erro ao agendar reunião");
    } finally {
      setScheduling(false);
    }
  };

  // ── Reschedule existing meeting ──
  const handleReschedule = async () => {
    if (!existingMeeting || !selectedDate || !selectedSlot) {
      toast.error("Selecione uma data e horário");
      return;
    }

    setActionLoading(true);
    try {
      const staffId = await getCurrentStaffId();
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [hours, minutes] = selectedSlot.split(":").map(Number);
      const endHours = hours + Math.floor(durationMinutes / 60);
      const endMinutes = minutes + (durationMinutes % 60);
      const endTime = `${String(endHours).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const newStartDateTime = `${dateStr}T${selectedSlot}:00`;
      const newEndDateTime = `${dateStr}T${endTime}:00`;

      const oldCalendarUserId = existingMeeting.google_calendar_user_id;
      const newCalendarUserId = selectedStaffUserId;
      const closerChanged = oldCalendarUserId && newCalendarUserId && oldCalendarUserId !== newCalendarUserId;

      let newEventId = existingMeeting.google_calendar_event_id;
      let newMeetLink = existingMeeting.meeting_link;

      if (closerChanged) {
        // Delete from old closer's calendar
        if (existingMeeting.google_calendar_event_id) {
          try {
            await supabase.functions.invoke("google-calendar?action=delete-event", {
              body: {
                eventId: existingMeeting.google_calendar_event_id,
                target_user_id: oldCalendarUserId,
              },
            });
          } catch (err) {
            console.error("Error deleting old calendar event:", err);
          }
        }
        // Create on new closer's calendar
        try {
          const { data: createData } = await supabase.functions.invoke("google-calendar?action=create-event", {
            body: {
              title: existingMeeting.title,
              startDateTime: newStartDateTime,
              endDateTime: newEndDateTime,
              target_user_id: newCalendarUserId,
              attendees: leadEmail ? [leadEmail] : [],
              createMeetLink: true,
            },
          });
          if (createData?.eventId) newEventId = createData.eventId;
          if (createData?.meetLink) newMeetLink = createData.meetLink;
        } catch (err) {
          console.error("Error creating new calendar event:", err);
          toast.error("Erro ao criar evento na agenda do novo closer");
        }
      } else if (existingMeeting.google_calendar_event_id) {
        // Same closer, just update the event
        try {
          await supabase.functions.invoke("google-calendar?action=update-event", {
            body: {
              eventId: existingMeeting.google_calendar_event_id,
              title: existingMeeting.title,
              startDateTime: newStartDateTime,
              endDateTime: newEndDateTime,
              target_user_id: oldCalendarUserId,
            },
          });
        } catch (calErr) {
          console.error("Calendar update error:", calErr);
          toast.error("Erro ao atualizar Google Agenda, mas a atividade foi reagendada");
        }
      }

      // Find the new closer's staff_id
      const newStaff = connectedStaff.find(s => s.user_id === newCalendarUserId);
      const newResponsibleStaffId = newStaff?.id || existingMeeting.responsible_staff_id;

      const updatePayload: Record<string, any> = {
        scheduled_at: newStartDateTime,
        status: "pending",
      };
      if (closerChanged) {
        updatePayload.google_calendar_event_id = newEventId;
        updatePayload.google_calendar_user_id = newCalendarUserId;
        updatePayload.responsible_staff_id = newResponsibleStaffId;
        if (newMeetLink) updatePayload.meeting_link = newMeetLink;
      }

      await supabase
        .from("crm_activities")
        .update(updatePayload)
        .eq("id", existingMeeting.id);

      // Update lead owner if closer changed
      if (closerChanged && newResponsibleStaffId) {
        await supabase
          .from("crm_leads")
          .update({
            owner_staff_id: newResponsibleStaffId,
            closer_staff_id: newResponsibleStaffId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingMeeting.lead_id);
      }

      const notesText = closerChanged
        ? `Reunião reagendada e closer alterado para ${newStaff?.name || "outro"}`
        : "Reunião reagendada via checklist";

      await supabase.from("crm_activity_history").insert({
        activity_id: existingMeeting.id,
        lead_id: existingMeeting.lead_id,
        action: "rescheduled",
        performed_by_staff_id: staffId,
        old_scheduled_at: existingMeeting.scheduled_at,
        new_scheduled_at: newStartDateTime,
        notes: notesText,
      } as any);

      toast.success("Reunião reagendada com sucesso!");
      setEditMode(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      await loadExistingMeeting();
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error("Erro ao reagendar reunião");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Change closer ──
  const handleChangeCloser = async () => {
    if (!existingMeeting || !selectedStaffUserId) {
      toast.error("Selecione um closer");
      return;
    }

    setActionLoading(true);
    try {
      const staffId = await getCurrentStaffId();
      const selectedStaff = connectedStaff.find(s => s.user_id === selectedStaffUserId);

      // If there's a Google Calendar event, delete from old calendar and create on new one
      if (existingMeeting.google_calendar_event_id && existingMeeting.google_calendar_user_id !== selectedStaffUserId) {
        // Delete from old calendar
        try {
          await supabase.functions.invoke("google-calendar?action=delete-event", {
            body: {
              eventId: existingMeeting.google_calendar_event_id,
              target_user_id: existingMeeting.google_calendar_user_id,
            },
          });
        } catch (calErr) {
          console.error("Calendar delete error:", calErr);
        }

        // Create on new calendar
        if (existingMeeting.scheduled_at) {
          try {
            const scheduledDate = new Date(existingMeeting.scheduled_at);
            const endDate = new Date(scheduledDate.getTime() + durationMinutes * 60000);
            const startDateTime = existingMeeting.scheduled_at;
            const endDateTime = endDate.toISOString().replace("Z", "").split(".")[0];

            const { data: newEvent } = await supabase.functions.invoke("google-calendar?action=create-event", {
              body: {
                title: existingMeeting.title,
                description: `Reunião transferida`,
                startDateTime,
                endDateTime,
                attendees: leadEmail ? [leadEmail] : undefined,
                target_user_id: selectedStaffUserId,
              },
            });

            // Update activity with new calendar info
            await supabase
              .from("crm_activities")
              .update({
                responsible_staff_id: selectedStaff?.id,
                google_calendar_event_id: newEvent?.event?.id || null,
                google_calendar_user_id: selectedStaffUserId,
                meeting_link: newEvent?.event?.meetingLink || existingMeeting.meeting_link,
              } as any)
              .eq("id", existingMeeting.id);
          } catch (calErr) {
            console.error("Calendar create error:", calErr);
            // Still update the staff even if calendar fails
            await supabase
              .from("crm_activities")
              .update({
                responsible_staff_id: selectedStaff?.id,
                google_calendar_user_id: selectedStaffUserId,
              } as any)
              .eq("id", existingMeeting.id);
          }
        }
      } else {
        await supabase
          .from("crm_activities")
          .update({
            responsible_staff_id: selectedStaff?.id,
            google_calendar_user_id: selectedStaffUserId,
          } as any)
          .eq("id", existingMeeting.id);
      }

      await supabase.from("crm_activity_history").insert({
        activity_id: existingMeeting.id,
        lead_id: existingMeeting.lead_id,
        action: "rescheduled",
        performed_by_staff_id: staffId,
        notes: `Closer alterado para ${selectedStaff?.name || "outro"}`,
      } as any);

      toast.success("Closer alterado com sucesso!");
      setEditMode(null);
      await loadExistingMeeting();
    } catch (error) {
      console.error("Change closer error:", error);
      toast.error("Erro ao alterar closer");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete meeting ──
  const handleDelete = async () => {
    if (!existingMeeting) return;

    setActionLoading(true);
    try {
      const staffId = await getCurrentStaffId();

      // Delete from Google Calendar
      if (existingMeeting.google_calendar_event_id) {
        try {
          await supabase.functions.invoke("google-calendar?action=delete-event", {
            body: {
              eventId: existingMeeting.google_calendar_event_id,
              target_user_id: existingMeeting.google_calendar_user_id,
            },
          });
        } catch (calErr) {
          console.error("Calendar delete error:", calErr);
        }
      }

      await supabase
        .from("crm_activities")
        .update({ status: "cancelled" })
        .eq("id", existingMeeting.id);

      await supabase.from("crm_activity_history").insert({
        activity_id: existingMeeting.id,
        lead_id: existingMeeting.lead_id,
        action: "cancelled",
        performed_by_staff_id: staffId,
        old_scheduled_at: existingMeeting.scheduled_at,
        notes: deleteReason || "Agendamento excluído",
      } as any);

      toast.success("Agendamento excluído com sucesso!");
      setShowDeleteConfirm(false);
      setDeleteReason("");
      setExistingMeeting(null);
      setEditMode(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir agendamento");
    } finally {
      setActionLoading(false);
    }
  };

  const copyMeetLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      master: "Master",
      admin: "Admin",
      cs: "CS",
      closer: "Closer",
      sdr: "SDR",
      social_setter: "Social Setter",
      bdr: "BDR",
    };
    return labels[role] || role;
  };

  const selectedStaff = useMemo(
    () => connectedStaff.find(s => s.user_id === selectedStaffUserId),
    [connectedStaff, selectedStaffUserId]
  );

  // Get the staff who owns the existing meeting
  const meetingStaff = useMemo(() => {
    if (!existingMeeting?.google_calendar_user_id) return null;
    return connectedStaff.find(s => s.user_id === existingMeeting.google_calendar_user_id);
  }, [existingMeeting, connectedStaff]);

  const actionLabels: Record<string, { label: string; color: string; icon: typeof CalendarIcon }> = {
    scheduled: { label: "Agendada", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CalendarIcon },
    cancelled: { label: "Cancelada", color: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle },
    rescheduled: { label: "Reagendada", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: RefreshCw },
  };

  // ── Loading state ──
  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Existing meeting view ──
  if (existingMeeting && editMode === null) {
    return (
      <div className="flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Meeting info card */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{existingMeeting.title}</p>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Agendado
                  </Badge>
                </div>
                <Video className="h-5 w-5 text-primary" />
              </div>

              {existingMeeting.scheduled_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(existingMeeting.scheduled_at), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}

              {existingMeeting.scheduled_at && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(existingMeeting.scheduled_at), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}

              {meetingStaff && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{meetingStaff.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{getRoleLabel(meetingStaff.role)}</Badge>
                </div>
              )}

              {existingMeeting.meeting_link && (
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={existingMeeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate flex items-center gap-1"
                  >
                    Link da reunião <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyMeetLink(existingMeeting.meeting_link!)}
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-3 flex-col gap-1.5 text-xs border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => {
                  setEditMode("reschedule");
                  // Pre-select the staff who owns the meeting
                  if (existingMeeting.google_calendar_user_id) {
                    setSelectedStaffUserId(existingMeeting.google_calendar_user_id);
                  }
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
                  if (existingMeeting.google_calendar_user_id) {
                    setSelectedStaffUserId(existingMeeting.google_calendar_user_id);
                  }
                }}
              >
                <UserCog className="h-4 w-4 text-blue-500" />
                Mudar Closer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-3 flex-col gap-1.5 text-xs border-rose-500/30 hover:bg-rose-500/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
                Excluir
              </Button>
            </div>

            {/* History */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Histórico</h4>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Sem histórico registrado</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {history.map((entry) => {
                    const config = actionLabels[entry.action] || actionLabels.scheduled;
                    const Icon = config.icon;
                    return (
                      <div key={entry.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                              {config.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(entry.created_at), "dd/MM/yy HH:mm")}
                            </span>
                          </div>
                          {(entry.staff as any)?.name && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <User className="h-2.5 w-2.5" /> {(entry.staff as any).name}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.notes}</p>
                          )}
                          {entry.action === "rescheduled" && entry.new_scheduled_at && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Nova data: {format(new Date(entry.new_scheduled_at), "dd/MM/yy HH:mm")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá excluir o agendamento e removê-lo do Google Agenda. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ex: Cliente desistiu..."
                rows={2}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {actionLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...</>
                ) : (
                  "Confirmar Exclusão"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Change closer mode ──
  if (editMode === "change-closer") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserCog className="h-4 w-4 text-blue-500" />
              Alterar Closer
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setEditMode(null)}>Voltar</Button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selecione o novo closer</Label>
            {loadingStaff ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <Select value={selectedStaffUserId} onValueChange={setSelectedStaffUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um closer" />
                </SelectTrigger>
                <SelectContent>
                  {connectedStaff.map((staff) => (
                    <SelectItem key={staff.user_id} value={staff.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{staff.name}</span>
                        <Badge variant="secondary" className="text-xs">{getRoleLabel(staff.role)}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleChangeCloser}
            disabled={actionLoading || !selectedStaffUserId}
          >
            {actionLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Alterando...</>
            ) : (
              <><UserCog className="h-4 w-4 mr-2" /> Confirmar Alteração</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Reschedule mode or New scheduling ──
  const isRescheduling = editMode === "reschedule";

  // If meeting was just created, show success state
  if (createdMeetLink && !isRescheduling) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="font-semibold">Reunião Agendada!</h3>
          <p className="text-sm text-muted-foreground mt-1">Link do Google Meet gerado</p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <Label className="text-xs text-muted-foreground">Link da reunião</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-xs break-all">{createdMeetLink}</code>
            <Button variant="outline" size="icon" onClick={() => copyMeetLink(createdMeetLink)} className="shrink-0 h-8 w-8">
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header for reschedule mode */}
      {isRescheduling && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              Reagendar Reunião
            </h3>
            <Button variant="ghost" size="sm" onClick={() => { setEditMode(null); setSelectedDate(undefined); setSelectedSlot(null); }}>Voltar</Button>
          </div>
        </div>
      )}


      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Staff Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Escolha uma agenda</Label>
            {loadingStaff ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando agendas...
              </div>
            ) : connectedStaff.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Nenhum usuário conectou o Google Calendar ainda.</span>
              </div>
            ) : (
              <Select
                value={selectedStaffUserId}
                onValueChange={(value) => {
                  setSelectedStaffUserId(value);
                  setSelectedSlot(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {connectedStaff.map((staff) => (
                    <SelectItem key={staff.user_id} value={staff.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{staff.name}</span>
                        <Badge variant="secondary" className="text-xs">{getRoleLabel(staff.role)}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedStaff && (
              <p className="text-xs text-muted-foreground">{selectedStaff.name}</p>
            )}
            {!isRescheduling && (
              <>
                <button
                  onClick={() => setShowAvailabilityOptions(!showAvailabilityOptions)}
                  className="text-xs text-primary hover:underline"
                >
                  Opções de disponibilidade...
                </button>
                {showAvailabilityOptions && (
                  <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Duração:</Label>
                      <Select
                        value={String(durationMinutes)}
                        onValueChange={(value) => {
                          setDurationMinutes(Number(value));
                          setSelectedSlot(null);
                        }}
                      >
                        <SelectTrigger className="w-[100px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Liberar finais de semana</Label>
                      <Switch checked={allowWeekends} onCheckedChange={setAllowWeekends} className="scale-75" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Meeting title (only for new scheduling) */}
          {!isRescheduling && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Título da reunião</Label>
              <Input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Reunião com..." />
            </div>
          )}

          {/* Date and Time Picker */}
          {selectedStaffUserId && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Escolha uma data e horário</Label>

              <div className="bg-background rounded-lg border border-border p-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedSlot(null);
                  }}
                  disabled={(date) => {
                    const isPast = isBefore(date, startOfDay(new Date()));
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return isPast || (!allowWeekends && isWeekend);
                  }}
                  locale={ptBR}
                  className="rounded-md w-full"
                />
              </div>

              <div className="space-y-2">
                {selectedDate ? (
                  <>
                    <p className="text-sm font-medium text-center">
                      {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum horário disponível</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "py-2.5 px-3 text-sm rounded-lg border transition-colors font-medium",
                              selectedSlot === slot
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Selecione uma data acima</p>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Action Button */}
      {selectedSlot && (
        <div className="p-4 border-t border-border">
          <Button
            className="w-full"
            onClick={isRescheduling ? handleReschedule : handleSchedule}
            disabled={isRescheduling ? actionLoading : scheduling}
          >
            {(isRescheduling ? actionLoading : scheduling) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isRescheduling ? "Reagendando..." : "Agendando..."}
              </>
            ) : (
              <>
                {isRescheduling ? <RefreshCw className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                {isRescheduling ? "Confirmar Reagendamento" : "Agendar Reunião"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
