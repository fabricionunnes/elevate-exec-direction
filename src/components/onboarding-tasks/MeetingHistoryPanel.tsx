import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format } from "date-fns";
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
  Plus,
  Loader2
} from "lucide-react";

interface MeetingNote {
  id: string;
  meeting_title: string;
  meeting_date: string;
  subject: string;
  notes: string;
  attendees: string | null;
  meeting_link: string | null;
  recording_link: string | null;
  created_at: string;
  staff?: {
    id: string;
    name: string;
  } | null;
}

interface MeetingHistoryPanelProps {
  projectId: string;
}

export const MeetingHistoryPanel = ({ projectId }: MeetingHistoryPanelProps) => {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingNote | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  
  // New meeting form state
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    subject: "",
    notes: "",
    attendees: "",
    meetingDate: format(new Date(), "yyyy-MM-dd"),
    meetingTime: format(new Date(), "HH:mm"),
    recordingLink: "",
  });

  useEffect(() => {
    fetchMeetings();
    fetchCurrentStaff();
  }, [projectId]);

  const fetchCurrentStaff = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setCurrentStaffId(data.id);
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
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

      setMeetings(data || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      toast.error("Erro ao carregar histórico de reuniões");
    } finally {
      setLoading(false);
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

  const handleSaveNewMeeting = async () => {
    if (!newMeeting.subject.trim()) {
      toast.error("Informe o assunto da reunião");
      return;
    }
    if (!newMeeting.notes.trim()) {
      toast.error("Descreva o que foi tratado na reunião");
      return;
    }

    setSaving(true);
    try {
      const meetingDateTime = `${newMeeting.meetingDate}T${newMeeting.meetingTime}:00`;
      
      const { error } = await supabase.from("onboarding_meeting_notes").insert({
        project_id: projectId,
        staff_id: currentStaffId,
        meeting_title: newMeeting.subject,
        meeting_date: meetingDateTime,
        subject: newMeeting.subject.trim(),
        notes: newMeeting.notes.trim(),
        attendees: newMeeting.attendees.trim() || null,
        recording_link: newMeeting.recordingLink.trim() || null,
      });

      if (error) throw error;

      toast.success("Reunião registrada com sucesso!");
      setShowNewMeetingDialog(false);
      setNewMeeting({
        subject: "",
        notes: "",
        attendees: "",
        meetingDate: format(new Date(), "yyyy-MM-dd"),
        meetingTime: format(new Date(), "HH:mm"),
        recordingLink: "",
      });
      fetchMeetings();
    } catch (error) {
      console.error("Error saving meeting:", error);
      toast.error("Erro ao registrar reunião");
    } finally {
      setSaving(false);
    }
  };

  const NewMeetingButton = () => (
    <Button onClick={() => setShowNewMeetingDialog(true)} className="gap-2">
      <Plus className="h-4 w-4" />
      Registrar Reunião
    </Button>
  );

  const NewMeetingDialog = () => (
    <Dialog open={showNewMeetingDialog} onOpenChange={setShowNewMeetingDialog}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Registrar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={newMeeting.meetingDate}
                onChange={(e) => setNewMeeting({ ...newMeeting, meetingDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário *</Label>
              <Input
                type="time"
                value={newMeeting.meetingTime}
                onChange={(e) => setNewMeeting({ ...newMeeting, meetingTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assunto *</Label>
            <Input
              placeholder="Ex: Alinhamento semanal, Revisão de processos..."
              value={newMeeting.subject}
              onChange={(e) => setNewMeeting({ ...newMeeting, subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>O que foi tratado? *</Label>
            <Textarea
              placeholder="Descreva os principais pontos discutidos, decisões tomadas, próximos passos..."
              value={newMeeting.notes}
              onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Participantes (opcional)</Label>
            <Input
              placeholder="Nomes dos participantes"
              value={newMeeting.attendees}
              onChange={(e) => setNewMeeting({ ...newMeeting, attendees: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-red-500" />
              Link da Gravação (opcional)
            </Label>
            <Input
              placeholder="https://drive.google.com/file/..."
              value={newMeeting.recordingLink}
              onChange={(e) => setNewMeeting({ ...newMeeting, recordingLink: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setShowNewMeetingDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSaveNewMeeting} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Registro"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

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

  if (meetings.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhuma reunião registrada</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Registre as reuniões realizadas com o cliente para manter o histórico.
            </p>
            <NewMeetingButton />
          </CardContent>
        </Card>
        <NewMeetingDialog />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Histórico de Reuniões
          </h3>
          <div className="flex items-center gap-2">
            <NewMeetingButton />
            <Badge variant="secondary">{meetings.length} reuniões</Badge>
          </div>
        </div>

        <div className="space-y-3">
          {meetings.map((meeting) => (
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
                {selectedMeeting.meeting_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(selectedMeeting.meeting_link!, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver link da reunião
                  </Button>
                )}
                {selectedMeeting.recording_link && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(selectedMeeting.recording_link!, "_blank")}
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Ver Gravação
                  </Button>
                )}
              </div>

              {/* Notes */}
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">O que foi tratado</span>
                <div className="mt-2 p-4 bg-background border rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedMeeting.notes}</p>
                </div>
              </div>

              {/* Actions */}
              {currentStaffId === selectedMeeting.staff?.id && (
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
              Esta ação não pode ser desfeita. O registro da reunião será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Meeting Dialog */}
      <NewMeetingDialog />
    </>
  );
};
