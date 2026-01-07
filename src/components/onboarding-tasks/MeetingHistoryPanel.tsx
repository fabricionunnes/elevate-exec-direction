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
  CheckCircle2
} from "lucide-react";

interface MeetingNote {
  id: string;
  meeting_title: string;
  meeting_date: string;
  subject: string;
  notes: string | null;
  attendees: string | null;
  meeting_link: string | null;
  recording_link: string | null;
  created_at: string;
  is_finalized: boolean;
  google_event_id: string | null;
  staff?: {
    id: string;
    name: string;
  } | null;
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
}

export const MeetingHistoryPanel = ({ projectId }: MeetingHistoryPanelProps) => {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingNote | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  
  // Finalize meeting dialog
  const [meetingToFinalize, setMeetingToFinalize] = useState<MeetingNote | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({
    notes: "",
    attendees: "",
    recordingLink: "",
  });

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
      syncCalendarEvents(),
    ]);
    setLoading(false);
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
    }
  };

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          *,
          staff:staff_id (
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

  const syncCalendarEvents = async () => {
    try {
      // Check if calendar is connected
      const { data: connectionData } = await supabase.functions.invoke("google-calendar?action=check-connection", {
        body: {},
      });

      if (!connectionData?.connected) {
        setCalendarConnected(false);
        return;
      }

      setCalendarConnected(true);

      // Fetch events from Google Calendar
      const { data } = await supabase.functions.invoke("google-calendar?action=events", {
        body: {},
      });

      if (data?.events) {
        setCalendarEvents(data.events);
        
        // Auto-create meeting entries for past events that don't exist yet
        await createMeetingsFromCalendarEvents(data.events);
      }
    } catch (error) {
      console.error("Error syncing calendar events:", error);
    }
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

      const response = await supabase.functions.invoke("google-calendar?action=sync-recordings", {
        body: { projectId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const payload = response.data as
        | { synced?: number; total?: number; needsDriveAuth?: boolean; message?: string }
        | undefined;

      if (payload?.needsDriveAuth) {
        toast.error(payload.message || "Para buscar gravações automaticamente, reconecte sua conta Google com permissão do Drive.");
        return;
      }

      const synced = payload?.synced ?? 0;
      const total = payload?.total ?? 0;

      if (synced > 0) {
        toast.success(`${synced} gravação(ões) vinculada(s) às reuniões`);
      } else {
        toast.message(
          total > 0
            ? "Nenhuma gravação encontrada ainda (pode levar um tempo para aparecer no Drive)."
            : "Nenhuma reunião pendente de gravação para sincronizar."
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
    
    if (!finalizeForm.notes.trim()) {
      toast.error("Descreva o que foi tratado na reunião");
      return;
    }

    setFinalizing(true);
    try {
      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({
          notes: finalizeForm.notes.trim(),
          attendees: finalizeForm.attendees.trim() || null,
          recording_link: finalizeForm.recordingLink.trim() || null,
          is_finalized: true,
        })
        .eq("id", meetingToFinalize.id);

      if (error) throw error;

      // Mark associated task as completed if meeting has a link
      if (meetingToFinalize.meeting_link) {
        const { error: taskError } = await supabase
          .from("onboarding_tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("project_id", projectId)
          .eq("meeting_link", meetingToFinalize.meeting_link);

        if (taskError) {
          console.error("Error updating task status:", taskError);
        }
      }

      toast.success("Reunião finalizada com sucesso!");
      setMeetingToFinalize(null);
      setFinalizeForm({ notes: "", attendees: "", recordingLink: "" });
      fetchMeetings();
    } catch (error) {
      console.error("Error finalizing meeting:", error);
      toast.error("Erro ao finalizar reunião");
    } finally {
      setFinalizing(false);
    }
  };

  const openFinalizeDialog = (meeting: MeetingNote) => {
    setMeetingToFinalize(meeting);
    setFinalizeForm({
      notes: meeting.notes || "",
      attendees: meeting.attendees || "",
      recordingLink: meeting.recording_link || "",
    });
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
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "HH:mm", { locale: ptBR })}
                          </span>
                        </div>
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
              {finalizedMeetings.map((meeting) => (
                <Card 
                  key={meeting.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "HH:mm", { locale: ptBR })}
                          </span>
                          {meeting.staff && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {meeting.staff.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {meeting.notes}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
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

              <div className="space-y-2">
                <Label>O que foi tratado? *</Label>
                <Textarea
                  placeholder="Descreva os principais pontos discutidos, decisões tomadas, próximos passos..."
                  value={finalizeForm.notes}
                  onChange={(e) => setFinalizeForm({ ...finalizeForm, notes: e.target.value })}
                  rows={5}
                />
              </div>

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes da Reunião
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && (
            <div className="space-y-4">
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
                   {selectedMeeting.meeting_link && (
                     <Button
                       variant="outline"
                       size="sm"
                       className="gap-2"
                       onClick={() => window.open(selectedMeeting.meeting_link!, "_blank")}
                     >
                       <ExternalLink className="h-3.5 w-3.5" />
                       Link da reunião
                     </Button>
                   )}

                   {selectedMeeting.recording_link ? (
                     <Button
                       variant="default"
                       size="sm"
                       className="gap-2"
                       onClick={() => window.open(selectedMeeting.recording_link!, "_blank")}
                     >
                       <PlayCircle className="h-3.5 w-3.5" />
                       Ver Gravação
                     </Button>
                   ) : (
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                       <PlayCircle className="h-3.5 w-3.5" />
                       <span>Gravação ainda não disponível</span>
                     </div>
                   )}
                 </div>
              </div>

              {/* Notes */}
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">O que foi tratado</span>
                <div className="mt-2 p-4 bg-background border rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedMeeting.notes}</p>
                </div>
              </div>

              {/* Actions - only Admin can delete */}
              {isAdmin && (
                <div className="flex justify-end">
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
                </div>
              )}
            </div>
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
    </>
  );
};
