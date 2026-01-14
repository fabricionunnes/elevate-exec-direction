import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Video, 
  Calendar, 
  FileText, 
  User, 
  Clock, 
  ExternalLink, 
  Trash2,
  Users,
  ChevronRight,
  PlayCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileAudio,
  Plus,
  Copy,
  MessageSquareHeart,
  ClipboardPaste,
  UserX,
  Sparkles
} from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { ScheduleMeetingDialog } from "./ScheduleMeetingDialog";
import { GenerateMeetingActionsDialog } from "./GenerateMeetingActionsDialog";

interface MeetingNote {
  id: string;
  meeting_title: string;
  meeting_date: string;
  subject: string;
  notes: string | null;
  transcript: string | null;
  manual_transcript?: string | null;
  attendees: string | null;
  meeting_link: string | null;
  recording_link: string | null;
  created_at: string;
  is_finalized: boolean;
  is_no_show?: boolean;
  google_event_id: string | null;
  scheduled_by: string | null;
  calendar_owner_id: string | null;
  calendar_owner_name: string | null;
  staff?: {
    id: string;
    name: string;
  } | null;
  scheduled_by_staff?: {
    id: string;
    name: string;
  } | null;
}

interface CSATSurvey {
  id: string;
  meeting_id: string;
  access_token: string;
  status: string | null;
  csat_responses: { score: number }[] | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  meetingLink?: string;
  calendarLink: string;
}

interface MeetingHistoryPanelProps {
  projectId: string;
  onTasksRefresh?: () => void;
}

export const MeetingHistoryPanel = ({ projectId, onTasksRefresh }: MeetingHistoryPanelProps) => {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [csatSurveys, setCsatSurveys] = useState<CSATSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingNote | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCS, setIsCS] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [projectConsultantUserId, setProjectConsultantUserId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  // Finalize meeting dialog
  const [meetingToFinalize, setMeetingToFinalize] = useState<MeetingNote | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({
    notes: "",
    attendees: "",
    recordingLink: "",
    isNoShow: false,
  });

  // Manual meeting/recording link edit (fallback when automatic sync isn't available)
  const [isEditingMeetingLink, setIsEditingMeetingLink] = useState(false);
  const [meetingLinkDraft, setMeetingLinkDraft] = useState("");

  const [isEditingRecordingLink, setIsEditingRecordingLink] = useState(false);
  const [recordingLinkDraft, setRecordingLinkDraft] = useState("");
  
  // Transcription state
  const [transcribing, setTranscribing] = useState(false);
  const [savingMeetingLink, setSavingMeetingLink] = useState(false);
  const [savingRecordingLink, setSavingRecordingLink] = useState(false);
  
  // Manual transcription paste
  const [isPastingTranscription, setIsPastingTranscription] = useState(false);
  const [manualTranscriptionDraft, setManualTranscriptionDraft] = useState("");
  const [savingManualTranscription, setSavingManualTranscription] = useState(false);
  
  // Schedule meeting dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  
  // Generate actions dialog
  const [showActionsDialog, setShowActionsDialog] = useState(false);
  const [meetingForActions, setMeetingForActions] = useState<MeetingNote | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchAll();
    
    // Subscribe to realtime updates on meeting notes
    const channel = supabase
      .channel(`meetings-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_meeting_notes',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchMeetings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchCurrentStaff(),
      fetchMeetings(),
      fetchCSATSurveys(),
    ]);
    // Fetch consultant info and then sync calendar with the returned values
    const consultantInfo = await fetchProjectConsultant();
    await syncCalendarEvents(consultantInfo?.consultantUserId, consultantInfo?.companyName);
    // Get product ID for phase creation
    await fetchProductId();
    setLoading(false);
  };

  const fetchProductId = async () => {
    try {
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("product_id")
        .eq("id", projectId)
        .single();
      
      if (project?.product_id) {
        // Check if product_id is a UUID or a product name
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.product_id);
        
        if (isUUID) {
          setProductId(project.product_id);
        } else {
          // product_id is a name, look up the service by name
          const { data: service } = await supabase
            .from("onboarding_services")
            .select("id")
            .ilike("name", `%${project.product_id}%`)
            .single();
          
          if (service?.id) {
            setProductId(service.id);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching product ID:", error);
    }
  };

  const fetchCSATSurveys = async () => {
    try {
      const { data } = await supabase
        .from("csat_surveys")
        .select(`
          id,
          meeting_id,
          access_token,
          status,
          csat_responses (score)
        `)
        .eq("project_id", projectId);
      
      setCsatSurveys((data as unknown as CSATSurvey[]) || []);
    } catch (error) {
      console.error("Error fetching CSAT surveys:", error);
    }
  };

  const getCSATSurveyForMeeting = (meetingId: string) => {
    return csatSurveys.find(s => s.meeting_id === meetingId);
  };

  const copyCSATLink = (survey: CSATSurvey) => {
    const link = `${getPublicBaseUrl()}/#/csat?token=${survey.access_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link CSAT copiado para a área de transferência");
  };

  const fetchProjectConsultant = async (): Promise<{ consultantUserId: string | null; companyName: string | null }> => {
    try {
      // Get the project's consultant and company info
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("consultant_id, onboarding_company_id")
        .eq("id", projectId)
        .single();

      if (!project) return { consultantUserId: null, companyName: null };

      let consultantStaffId = project.consultant_id;
      let fetchedCompanyName: string | null = null;

      // Get company name for filtering calendar events
      if (project.onboarding_company_id) {
        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name, consultant_id")
          .eq("id", project.onboarding_company_id)
          .single();
        
        if (company?.name) {
          fetchedCompanyName = company.name;
          setCompanyName(company.name);
        }
        
        // If no project-level consultant, use company-level
        if (!consultantStaffId && company?.consultant_id) {
          consultantStaffId = company.consultant_id;
        }
      }

      if (!consultantStaffId) return { consultantUserId: null, companyName: fetchedCompanyName };

      // Get the user_id for this consultant
      const { data: consultant } = await supabase
        .from("onboarding_staff")
        .select("user_id")
        .eq("id", consultantStaffId)
        .single();

      if (consultant?.user_id) {
        setProjectConsultantUserId(consultant.user_id);
        return { consultantUserId: consultant.user_id, companyName: fetchedCompanyName };
      }
      
      return { consultantUserId: null, companyName: fetchedCompanyName };
    } catch (error) {
      console.error("Error fetching project consultant:", error);
      return { consultantUserId: null, companyName: null };
    }
  };

  const fetchCurrentStaff = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setCurrentStaffId(data.id);
      setIsAdmin(data.role === "admin");
      setIsCS(data.role === "cs");
    }
  };

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          *,
          staff:onboarding_staff!staff_id (
            id,
            name
          ),
          scheduled_by_staff:onboarding_staff!scheduled_by (
            id,
            name
          )
        `)
        .eq("project_id", projectId)
        .order("meeting_date", { ascending: false });

      if (error) throw error;

      const nextMeetings = data || [];
      setMeetings(nextMeetings);

      // If a detail dialog is open, keep it in sync with fresh DB data
      if (selectedMeeting) {
        const updated = nextMeetings.find((m) => m.id === selectedMeeting.id);
        if (updated) setSelectedMeeting(updated);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  };

  const syncCalendarEvents = async (consultantUserId?: string | null, clientCompanyName?: string | null) => {
    try {
      // Use passed values or fall back to state
      const targetUserId = consultantUserId ?? projectConsultantUserId;
      const targetCompanyName = clientCompanyName ?? companyName;

      // IMPORTANT: Only sync the consultant's calendar, never admin/CS calendars
      // If there's no consultant assigned, don't sync at all
      if (!targetUserId) {
        console.log("No consultant assigned to project, skipping calendar sync");
        setCalendarConnected(false);
        return;
      }

      const checkConnectionUrl = `google-calendar?action=check-connection&target_user_id=${targetUserId}`;

      // Check if consultant's calendar is connected
      const { data: connectionData } = await supabase.functions.invoke(checkConnectionUrl, {
        body: {},
      });

      if (!connectionData?.connected) {
        setCalendarConnected(false);
        return;
      }

      setCalendarConnected(true);

      // Fetch events from consultant's Google Calendar only
      const eventsUrl = `google-calendar?action=events&target_user_id=${targetUserId}`;

      const { data } = await supabase.functions.invoke(eventsUrl, {
        body: {},
      });

      if (data?.events) {
        // Filter events to only include meetings for this specific client
        const filteredEvents = filterEventsForClient(data.events, targetCompanyName);
        setCalendarEvents(filteredEvents);
        
        // Auto-create meeting entries for past events that don't exist yet
        await createMeetingsFromCalendarEvents(filteredEvents);
      }
    } catch (error) {
      console.error("Error syncing calendar events:", error);
    }
  };

  // Filter calendar events to only include those related to this client
  const filterEventsForClient = (events: CalendarEvent[], clientName?: string | null): CalendarEvent[] => {
    const nameToUse = clientName ?? companyName;
    if (!nameToUse) {
      console.log("No company name available, cannot filter events");
      return [];
    }

    const normalizedCompanyName = nameToUse.toLowerCase().trim();
    
    return events.filter(event => {
      const title = (event.title || "").toLowerCase();
      const description = (event.description || "").toLowerCase();
      
      // Check if the event title or description contains the company name
      return title.includes(normalizedCompanyName) || description.includes(normalizedCompanyName);
    });
  };

  const createMeetingsFromCalendarEvents = async (events: CalendarEvent[]) => {
    if (!currentStaffId) return;

    // Get existing google_event_ids
    const { data: existingMeetings } = await supabase
      .from("onboarding_meeting_notes")
      .select("google_event_id")
      .eq("project_id", projectId)
      .not("google_event_id", "is", null);

    const existingEventIds = new Set((existingMeetings || []).map(m => m.google_event_id));

    // Filter past events that don't exist yet
    const pastEvents = events.filter(event => {
      const eventDate = parseISO(event.start);
      return isPast(eventDate) && !existingEventIds.has(event.id);
    });

    if (pastEvents.length === 0) return;

    // Create meeting entries for new past events
    const newMeetings = pastEvents.map(event => ({
      project_id: projectId,
      staff_id: currentStaffId,
      google_event_id: event.id,
      meeting_title: event.title,
      meeting_date: event.start,
      subject: event.title,
      notes: null,
      meeting_link: event.meetingLink || null,
      is_finalized: false,
    }));

    const { error } = await supabase
      .from("onboarding_meeting_notes")
      .insert(newMeetings);

    if (!error) {
      await fetchMeetings();
    }
  };

  const handleRefreshCalendar = async () => {
    setSyncing(true);
    await syncCalendarEvents();
    await syncRecordings();
    await fetchMeetings();
    setSyncing(false);
    toast.success("Reuniões e gravações sincronizadas");
  };

  const syncRecordings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // IMPORTANT: Only sync recordings from consultant's calendar
      // If there's no consultant assigned, don't sync recordings
      if (!projectConsultantUserId) {
        console.log("No consultant assigned to project, skipping recordings sync");
        return;
      }

      const syncUrl = `google-calendar?action=sync-recordings&target_user_id=${projectConsultantUserId}`;

      const response = await supabase.functions.invoke(syncUrl, {
        body: { projectId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const payload = response.data as
        | {
            synced?: number;
            transcriptsSynced?: number;
            total?: number;
            needsDriveAuth?: boolean;
            needsDriveApi?: boolean;
            message?: string;
          }
        | undefined;

      if (payload?.needsDriveApi) {
        toast.error(payload.message || "Ative a Google Drive API para buscar gravações automaticamente.");
        return;
      }

      if (payload?.needsDriveAuth) {
        toast.error(
          payload.message ||
            "Para buscar gravações automaticamente, reconecte sua conta Google com permissão do Drive."
        );
        return;
      }

      const synced = payload?.synced ?? 0;
      const transcriptsSynced = payload?.transcriptsSynced ?? 0;
      const total = payload?.total ?? 0;

      if (synced > 0 || transcriptsSynced > 0) {
        const parts: string[] = [];
        if (synced > 0) parts.push(`${synced} gravação(ões)`);
        if (transcriptsSynced > 0) parts.push(`${transcriptsSynced} transcrição(ões)`);
        toast.success(`${parts.join(" e ")} vinculada(s) às reuniões`);
      } else {
        toast.message(
          total > 0
            ? "Nenhuma gravação/transcrição encontrada ainda (pode levar um tempo para aparecer no Drive)."
            : "Nenhuma reunião pendente para sincronizar."
        );
      }
    } catch (error) {
      console.error("Error syncing recordings:", error);
      toast.error("Erro ao sincronizar gravações");
    }
  };

  const handleDelete = async () => {
    if (!meetingToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .delete()
        .eq("id", meetingToDelete.id);

      if (error) throw error;

      toast.success("Registro excluído com sucesso");
      setMeetingToDelete(null);
      fetchMeetings();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      toast.error("Erro ao excluir registro");
    } finally {
      setDeleting(false);
    }
  };

  const handleFinalizeMeeting = async () => {
    if (!meetingToFinalize) return;

    // If not a no-show, notes are required
    if (!finalizeForm.isNoShow && !finalizeForm.notes.trim()) {
      toast.error("Descreva o que foi tratado na reunião");
      return;
    }

    setFinalizing(true);
    try {
      const notesValue = finalizeForm.isNoShow 
        ? (finalizeForm.notes.trim() || "Cliente não compareceu à reunião (No Show)")
        : finalizeForm.notes.trim();

      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({
          notes: notesValue,
          attendees: finalizeForm.attendees.trim() || null,
          recording_link: finalizeForm.recordingLink.trim() || null,
          is_finalized: true,
          is_no_show: finalizeForm.isNoShow,
        })
        .eq("id", meetingToFinalize.id);

      if (error) throw error;

      // Mark associated task as completed if meeting has a link
      if (meetingToFinalize.meeting_link) {
        // First get the task to log history properly
        const { data: taskToUpdate } = await supabase
          .from("onboarding_tasks")
          .select("id, status")
          .eq("project_id", projectId)
          .eq("meeting_link", meetingToFinalize.meeting_link)
          .maybeSingle();

        if (taskToUpdate && taskToUpdate.status !== "completed") {
          const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", taskToUpdate.id);

          if (taskError) {
            console.error("Error updating task status:", taskError);
          } else {
            // Log task history
            await supabase.from("onboarding_task_history").insert({
              task_id: taskToUpdate.id,
              staff_id: currentStaffId,
              action: "status_change",
              field_changed: "status",
              old_value: taskToUpdate.status === "pending" ? "Pendente" : "Em Progresso",
              new_value: "Concluída",
            });
          }
        }
      }

      toast.success(finalizeForm.isNoShow ? "Reunião marcada como No Show!" : "Reunião finalizada com sucesso!");
      setMeetingToFinalize(null);
      setFinalizeForm({ notes: "", attendees: "", recordingLink: "", isNoShow: false });
      fetchMeetings();
    } catch (error) {
      console.error("Error finalizing meeting:", error);
      toast.error("Erro ao finalizar reunião");
    } finally {
      setFinalizing(false);
    }
  };

  const handleSaveMeetingLink = async () => {
    if (!selectedMeeting) return;
    setSavingMeetingLink(true);
    try {
      const nextLink = meetingLinkDraft.trim();
      const normalized = nextLink ? nextLink : null;

      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({ meeting_link: normalized })
        .eq("id", selectedMeeting.id);

      if (error) throw error;

      // Update local UI immediately (selectedMeeting is not updated by fetchMeetings)
      setSelectedMeeting((prev) => (prev ? { ...prev, meeting_link: normalized } : prev));
      setMeetings((prev) => prev.map((m) => (m.id === selectedMeeting.id ? { ...m, meeting_link: normalized } : m)));

      toast.success("Link da reunião atualizado");
      setIsEditingMeetingLink(false);
      await fetchMeetings();
    } catch (e) {
      console.error("Error saving meeting link:", e);
      toast.error("Não foi possível salvar o link da reunião");
    } finally {
      setSavingMeetingLink(false);
    }
  };

  const handleSaveRecordingLink = async () => {
    if (!selectedMeeting) return;
    setSavingRecordingLink(true);
    try {
      const nextLink = recordingLinkDraft.trim();
      const normalized = nextLink ? nextLink : null;

      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({ recording_link: normalized })
        .eq("id", selectedMeeting.id);

      if (error) throw error;

      // Update local UI immediately (selectedMeeting is not updated by fetchMeetings)
      setSelectedMeeting((prev) => (prev ? { ...prev, recording_link: normalized } : prev));
      setMeetings((prev) => prev.map((m) => (m.id === selectedMeeting.id ? { ...m, recording_link: normalized } : m)));

      toast.success("Link da gravação atualizado");
      setIsEditingRecordingLink(false);
      await fetchMeetings();
    } catch (e) {
      console.error("Error saving recording link:", e);
      toast.error("Não foi possível salvar o link da gravação");
    } finally {
      setSavingRecordingLink(false);
    }
  };

  const openFinalizeDialog = (meeting: MeetingNote) => {
    setMeetingToFinalize(meeting);
    setFinalizeForm({
      notes: meeting.notes || "",
      attendees: meeting.attendees || "",
      recordingLink: meeting.recording_link || "",
      isNoShow: false,
    });
  };

  const handleTranscribe = async (meeting: MeetingNote) => {
    if (!meeting.recording_link) {
      toast.error("Esta reunião não possui link de gravação");
      return;
    }

    setTranscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      toast.info("Iniciando transcrição com AssemblyAI... Isso pode levar vários minutos para arquivos grandes.", { duration: 10000 });

      const response = await supabase.functions.invoke("transcribe-assemblyai", {
        body: { 
          audioUrl: meeting.recording_link,
          staffId: currentStaffId 
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro na transcrição");
      }

      const data = response.data as { text?: string; error?: string; duration?: number; words?: number };
      
      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.text) {
        throw new Error("Transcrição vazia retornada");
      }

      // Save transcription to meeting notes
      const existingNotes = meeting.notes || "";
      const separator = existingNotes ? "\n\n---\n\n" : "";
      const durationInfo = data.duration ? ` (${Math.round(data.duration / 60)} minutos)` : "";
      const newNotes = existingNotes + separator + `## Transcrição Automática${durationInfo}\n\n${data.text}`;

      const { error: updateError } = await supabase
        .from("onboarding_meeting_notes")
        .update({ notes: newNotes })
        .eq("id", meeting.id);

      if (updateError) throw updateError;

      // Update local state
      if (selectedMeeting?.id === meeting.id) {
        setSelectedMeeting(prev => prev ? { ...prev, notes: newNotes } : prev);
      }
      setMeetings(prev => prev.map(m => m.id === meeting.id ? { ...m, notes: newNotes } : m));

      toast.success(`Transcrição concluída! ${data.words ? `${data.words} palavras` : ''}`);
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao transcrever gravação");
    } finally {
      setTranscribing(false);
    }
  };

  const handleSaveManualTranscription = async () => {
    if (!selectedMeeting || !manualTranscriptionDraft.trim()) {
      toast.error("Cole a transcrição no campo de texto");
      return;
    }

    setSavingManualTranscription(true);
    try {
      const existingNotes = selectedMeeting.notes || "";
      const separator = existingNotes ? "\n\n---\n\n" : "";
      const newNotes = existingNotes + separator + "## Transcrição Manual\n\n" + manualTranscriptionDraft.trim();

      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({ notes: newNotes })
        .eq("id", selectedMeeting.id);

      if (error) throw error;

      // Update local state
      setSelectedMeeting(prev => prev ? { ...prev, notes: newNotes } : prev);
      setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? { ...m, notes: newNotes } : m));

      toast.success("Transcrição adicionada às notas!");
      setIsPastingTranscription(false);
      setManualTranscriptionDraft("");
    } catch (error) {
      console.error("Error saving manual transcription:", error);
      toast.error("Erro ao salvar transcrição");
    } finally {
      setSavingManualTranscription(false);
    }
  };

  // Separate meetings into pending and finalized
  const pendingMeetings = meetings.filter(m => !m.is_finalized);
  const finalizedMeetings = meetings.filter(m => m.is_finalized);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Reuniões
          </h3>
          <div className="flex items-center gap-2">
            {(isAdmin || isCS) && (
              <Button 
                size="sm" 
                onClick={() => setShowScheduleDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agendar Reunião
              </Button>
            )}
            {calendarConnected && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshCalendar}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
            )}
            <Badge variant="secondary">{meetings.length} reuniões</Badge>
          </div>
        </div>

        {/* Calendar Connection Notice */}
        {!calendarConnected && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Google Calendar não conectado
                </p>
                <p className="text-xs text-amber-600">
                  Conecte seu Google Calendar no Escritório Virtual para sincronizar reuniões automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Meetings Section */}
        {pendingMeetings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <h4 className="font-medium text-destructive">
                Reuniões pendentes de finalização ({pendingMeetings.length})
              </h4>
            </div>
            <div className="space-y-3">
              {pendingMeetings.map((meeting) => (
                <Card 
                  key={meeting.id} 
                  className="border-destructive/50 bg-destructive/5"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{meeting.subject}</h4>
                          <Badge variant="destructive" className="shrink-0 text-xs">
                            Pendente
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "HH:mm", { locale: ptBR })}
                          </span>
                          {/* Mostrar responsável do projeto OU quem está na agenda */}
                          {(meeting.calendar_owner_name || meeting.staff?.name) && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {meeting.calendar_owner_name || meeting.staff?.name}
                            </span>
                          )}
                        </div>
                        {/* Linha separada para quem agendou */}
                        {meeting.scheduled_by_staff && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <span>Agendado por {meeting.scheduled_by_staff.name}</span>
                            {meeting.calendar_owner_name && (
                              <span>na agenda de {meeting.calendar_owner_name}</span>
                            )}
                          </div>
                        )}
                        {meeting.meeting_link && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 mb-2"
                            onClick={() => window.open(meeting.meeting_link!, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Link da reunião
                          </Button>
                        )}
                      </div>
                      <Button 
                        onClick={() => openFinalizeDialog(meeting)}
                        size="sm"
                      >
                        Finalizar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Finalized Meetings Section */}
        {finalizedMeetings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-muted-foreground">
                Reuniões finalizadas ({finalizedMeetings.length})
              </h4>
            </div>
            <div className="space-y-3">
              {finalizedMeetings.map((meeting) => {
                const csatSurvey = getCSATSurveyForMeeting(meeting.id);
                const csatResponse = csatSurvey?.csat_responses?.[0];
                
                return (
                  <Card 
                    key={meeting.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium truncate">{meeting.subject}</h4>
                            {meeting.meeting_link && (
                              <Badge variant="outline" className="shrink-0 text-xs">
                                <Video className="h-3 w-3 mr-1" />
                                Meet
                              </Badge>
                            )}
                            {meeting.recording_link && (
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                <PlayCircle className="h-3 w-3 mr-1" />
                                Gravação
                              </Badge>
                            )}
                            {csatSurvey && (
                              <Badge 
                                variant={csatResponse ? "default" : "outline"} 
                                className={`shrink-0 text-xs ${csatResponse ? "bg-green-500 hover:bg-green-600" : ""}`}
                              >
                                <MessageSquareHeart className="h-3 w-3 mr-1" />
                                {csatResponse ? `CSAT: ${csatResponse.score}` : "CSAT pendente"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(meeting.meeting_date), "HH:mm", { locale: ptBR })}
                            </span>
                            {/* Mostrar responsável do projeto OU quem está na agenda */}
                            {(meeting.calendar_owner_name || meeting.staff?.name) && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {meeting.calendar_owner_name || meeting.staff?.name}
                              </span>
                            )}
                          </div>
                          {/* Linha separada para quem agendou e status */}
                          <div className="flex items-center gap-3 text-xs mb-2 flex-wrap">
                            {meeting.is_no_show ? (
                              <span className="text-destructive font-medium flex items-center gap-1">
                                <UserX className="h-3 w-3" />
                                No Show
                              </span>
                            ) : (
                              <span className="text-primary font-medium">
                                Finalizado
                              </span>
                            )}
                            {meeting.scheduled_by_staff && (
                              <span className="text-muted-foreground">
                                • Agendado por {meeting.scheduled_by_staff.name}
                              </span>
                            )}
                            {meeting.calendar_owner_name && meeting.scheduled_by_staff && (
                              <span className="text-muted-foreground">
                                na agenda de {meeting.calendar_owner_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {meeting.notes}
                          </p>
                          
                          {/* CSAT Link Button - visible for Admin/CS */}
                          {csatSurvey && (isAdmin || isCS) && (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyCSATLink(csatSurvey);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                                Copiar link CSAT
                              </Button>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {meetings.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nenhuma reunião ainda</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                As reuniões do Google Calendar aparecerão aqui automaticamente quando ocorrerem.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Finalize Meeting Dialog */}
      <Dialog open={!!meetingToFinalize} onOpenChange={(open) => !open && setMeetingToFinalize(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Finalizar Reunião
            </DialogTitle>
          </DialogHeader>

          {meetingToFinalize && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium">{meetingToFinalize.subject}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(meetingToFinalize.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                {meetingToFinalize.meeting_link && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs"
                    onClick={() => window.open(meetingToFinalize.meeting_link!, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver link da reunião
                  </Button>
                )}
              </div>

              {/* No Show Checkbox */}
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <Checkbox
                  id="noShow"
                  checked={finalizeForm.isNoShow}
                  onCheckedChange={(checked) => 
                    setFinalizeForm({ ...finalizeForm, isNoShow: checked === true })
                  }
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="noShow" 
                    className="flex items-center gap-2 cursor-pointer font-medium text-destructive"
                  >
                    <UserX className="h-4 w-4" />
                    Cliente não compareceu (No Show)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Marque esta opção se o cliente não apareceu para a reunião
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{finalizeForm.isNoShow ? "Observações (opcional)" : "O que foi tratado? *"}</Label>
                <Textarea
                  placeholder={finalizeForm.isNoShow 
                    ? "Adicione observações sobre a tentativa de contato..." 
                    : "Descreva os principais pontos discutidos, decisões tomadas, próximos passos..."
                  }
                  value={finalizeForm.notes}
                  onChange={(e) => setFinalizeForm({ ...finalizeForm, notes: e.target.value })}
                  rows={finalizeForm.isNoShow ? 3 : 5}
                />
              </div>

              {!finalizeForm.isNoShow && (
                <>
                  <div className="space-y-2">
                    <Label>Participantes (opcional)</Label>
                    <Input
                      placeholder="Nomes dos participantes"
                      value={finalizeForm.attendees}
                      onChange={(e) => setFinalizeForm({ ...finalizeForm, attendees: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4 text-red-500" />
                      Link da Gravação (opcional)
                    </Label>
                    <Input
                      placeholder="https://drive.google.com/file/..."
                      value={finalizeForm.recordingLink}
                      onChange={(e) => setFinalizeForm({ ...finalizeForm, recordingLink: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMeetingToFinalize(null)} disabled={finalizing}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizeMeeting} disabled={finalizing}>
              {finalizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                "Finalizar Reunião"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes da Reunião
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && (
            <ScrollArea className="flex-1 pr-4">
            <div
              className="space-y-4"
              onMouseDown={(e) => {
                const target = e.target as HTMLElement | null;
                // Don't close editors when interacting with them (e.g., clicking "Salvar")
                if (target?.closest?.('[data-inline-editor="true"]')) return;

                if (isEditingRecordingLink) setIsEditingRecordingLink(false);
                if (isEditingMeetingLink) setIsEditingMeetingLink(false);
              }}
            >
              {/* Header Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Assunto</span>
                  <h3 className="font-semibold">{selectedMeeting.subject}</h3>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(selectedMeeting.meeting_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(selectedMeeting.meeting_date), "HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
                {selectedMeeting.staff && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Registrado por {selectedMeeting.staff.name}</span>
                  </div>
                )}
                {selectedMeeting.attendees && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedMeeting.attendees}</span>
                  </div>
                )}
                 <div className="flex flex-wrap gap-2">
                   {selectedMeeting.meeting_link ? (
                     <Button
                       variant="outline"
                       size="sm"
                       className="gap-2"
                       onClick={() => window.open(selectedMeeting.meeting_link!, "_blank")}
                     >
                       <ExternalLink className="h-3.5 w-3.5" />
                       Link da reunião
                     </Button>
                   ) : (isAdmin || isCS || currentStaffId) ? (
                     !isEditingMeetingLink ? (
                       <div className="flex items-center gap-3">
                         <div className="flex items-center gap-2 text-sm text-muted-foreground">
                           <ExternalLink className="h-3.5 w-3.5" />
                           <span>Link da reunião não vinculado</span>
                         </div>
                         <Button
                           variant="outline"
                           size="sm"
                           className="gap-2"
                           onClick={() => {
                             setIsEditingMeetingLink(true);
                             setMeetingLinkDraft("");
                           }}
                         >
                           Inserir link
                         </Button>
                       </div>
                     ) : (
                       <div className="flex flex-col sm:flex-row gap-2 w-full" data-inline-editor="true">
                         <Input
                           value={meetingLinkDraft}
                           onChange={(e) => setMeetingLinkDraft(e.target.value)}
                           placeholder="Cole aqui o link da reunião (Google Meet)"
                           autoFocus
                         />
                         <div className="flex gap-2">
                           <Button
                             size="sm"
                             onClick={handleSaveMeetingLink}
                             disabled={savingMeetingLink}
                           >
                             {savingMeetingLink ? (
                               <Loader2 className="h-4 w-4 animate-spin" />
                             ) : (
                               "Salvar"
                             )}
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setIsEditingMeetingLink(false)}
                             disabled={savingMeetingLink}
                           >
                             Cancelar
                           </Button>
                         </div>
                       </div>
                     )
                   ) : null}

                   {selectedMeeting.recording_link ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2"
                            onClick={() => window.open(selectedMeeting.recording_link!, "_blank")}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Ver Gravação
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleTranscribe(selectedMeeting)}
                            disabled={transcribing}
                            data-inline-editor="true"
                          >
                            {transcribing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileAudio className="h-3.5 w-3.5" />
                            )}
                            {transcribing ? "Transcrevendo..." : "Transcrever"}
                          </Button>
                          {!isPastingTranscription && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setIsPastingTranscription(true);
                                setManualTranscriptionDraft("");
                              }}
                            >
                              <ClipboardPaste className="h-3.5 w-3.5" />
                              Colar Transcrição
                            </Button>
                          )}
                        </div>
                        
                        {/* Inline Manual Transcription Paste Area */}
                        {isPastingTranscription && (
                          <div className="mt-3 space-y-3 p-4 border rounded-lg bg-muted/30" data-inline-editor="true">
                            <div className="flex items-center gap-2">
                              <ClipboardPaste className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Colar Transcrição Manual</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Para arquivos de gravação grandes (&gt;25MB), use uma ferramenta externa de transcrição e cole o resultado aqui.
                            </p>
                            <Textarea
                              value={manualTranscriptionDraft}
                              onChange={(e) => setManualTranscriptionDraft(e.target.value)}
                              placeholder="Cole aqui a transcrição da reunião..."
                              rows={6}
                              className="resize-none"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setIsPastingTranscription(false);
                                  setManualTranscriptionDraft("");
                                }}
                                disabled={savingManualTranscription}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveManualTranscription}
                                disabled={savingManualTranscription || !manualTranscriptionDraft.trim()}
                              >
                                {savingManualTranscription ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Salvando...
                                  </>
                                ) : (
                                  "Salvar Transcrição"
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (isAdmin || isCS || currentStaffId) ? (
                     <div className="flex flex-col gap-2">
                       {!isEditingRecordingLink ? (
                         <div className="flex items-center gap-3">
                           <div className="flex items-center gap-2 text-sm text-muted-foreground">
                             <PlayCircle className="h-3.5 w-3.5" />
                             <span>Gravação não vinculada</span>
                           </div>
                           <Button
                             variant="outline"
                             size="sm"
                             className="gap-2"
                             onClick={() => {
                               setIsEditingRecordingLink(true);
                               setRecordingLinkDraft("");
                             }}
                           >
                             Inserir link
                           </Button>
                         </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2" data-inline-editor="true">
                            <Input
                              value={recordingLinkDraft}
                              onChange={(e) => setRecordingLinkDraft(e.target.value)}
                              placeholder="Cole aqui o link da gravação (Drive)"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveRecordingLink}
                                disabled={savingRecordingLink}
                              >
                                {savingRecordingLink ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Salvar"
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingRecordingLink(false)}
                                disabled={savingRecordingLink}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                       <p className="text-xs text-muted-foreground">
                         Dica: a sincronização automática depende da API do Drive; enquanto isso, você pode colar o link manualmente.
                       </p>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                       <PlayCircle className="h-3.5 w-3.5" />
                       <span>Gravação ainda não disponível</span>
                     </div>
                   )}
                 </div>

                 {/* CSAT Link in Meeting Details */}
                 {(() => {
                   const csatSurvey = getCSATSurveyForMeeting(selectedMeeting.id);
                   const csatResponse = csatSurvey?.csat_responses?.[0];
                   
                   if (csatSurvey && (isAdmin || isCS)) {
                     return (
                       <div className="mt-3 p-3 border rounded-lg bg-muted/30">
                         <div className="flex items-center justify-between gap-3">
                           <div className="flex items-center gap-2">
                             <MessageSquareHeart className="h-4 w-4 text-primary" />
                             <span className="text-sm font-medium">Pesquisa CSAT</span>
                             {csatResponse ? (
                               <Badge className="bg-green-500">Respondida: {csatResponse.score}/5</Badge>
                             ) : (
                               <Badge variant="outline">Pendente</Badge>
                             )}
                           </div>
                           <Button
                             variant="outline"
                             size="sm"
                             className="gap-2"
                             onClick={() => copyCSATLink(csatSurvey)}
                           >
                             <Copy className="h-3.5 w-3.5" />
                             Copiar link
                           </Button>
                         </div>
                       </div>
                     );
                   }
                   return null;
                 })()}
              </div>

              {/* Transcript (highlighted, separate from notes) */}
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Transcrição
                </span>

                <div className="mt-2 p-4 bg-muted/30 border rounded-lg max-h-[300px] overflow-y-auto">
                  {(selectedMeeting.transcript || selectedMeeting.manual_transcript) ? (
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedMeeting.transcript || selectedMeeting.manual_transcript}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ainda não disponível. Use o botão "Colar Transcrição" acima para adicionar manualmente.
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">O que foi tratado</span>
                <div className="mt-2 p-4 bg-background border rounded-lg max-h-[250px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{selectedMeeting.notes}</p>
                </div>
              </div>


              {/* Actions - Generate Actions and Delete */}
              <div className="flex justify-between items-center">
                {(selectedMeeting.transcript || selectedMeeting.manual_transcript || selectedMeeting.notes) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMeetingForActions(selectedMeeting);
                      setShowActionsDialog(true);
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Ações
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedMeeting(null);
                      setMeetingToDelete(selectedMeeting);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Registro
                  </Button>
                )}
              </div>
            </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!meetingToDelete} onOpenChange={(open) => !open && setMeetingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule Meeting Dialog */}
      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        projectId={projectId}
        onMeetingCreated={() => {
          fetchMeetings();
          syncCalendarEvents();
        }}
      />

      {/* Generate Meeting Actions Dialog */}
      {meetingForActions && (
        <GenerateMeetingActionsDialog
          open={showActionsDialog}
          onOpenChange={(open) => {
            setShowActionsDialog(open);
            if (!open) setMeetingForActions(null);
          }}
          meetingId={meetingForActions.id}
          meetingSubject={meetingForActions.subject}
          projectId={projectId}
          productId={productId || undefined}
          onActionsCreated={() => {
            toast.success("Ações criadas com sucesso!");
            onTasksRefresh?.();
          }}
        />
      )}
    </>
  );
};
