import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Calendar, Video, Users, X } from "lucide-react";
import { format } from "date-fns";

interface Staff {
  id: string;
  name: string;
  user_id: string;
  hasCalendar?: boolean;
}

interface CandidateInfo {
  id: string;
  full_name: string;
  email: string;
}

interface ScheduleGroupInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: CandidateInfo[];
  projectId: string;
  onSuccess: () => void;
}

export function ScheduleGroupInterviewDialog({
  open,
  onOpenChange,
  candidates,
  projectId,
  onSuccess,
}: ScheduleGroupInterviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [formData, setFormData] = useState({
    interviewerId: "",
    scheduledAt: "",
    duration: "90",
    type: "video",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchStaffWithCalendar();
      // Set default date to tomorrow at 10:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      setFormData(prev => ({
        ...prev,
        scheduledAt: format(tomorrow, "yyyy-MM-dd'T'HH:mm"),
      }));
    }
  }, [open]);

  const fetchStaffWithCalendar = async () => {
    const { data: allStaff } = await supabase
      .from("onboarding_staff")
      .select("id, name, user_id")
      .eq("is_active", true)
      .order("name");

    if (!allStaff) {
      setStaffList([]);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      setStaffList(allStaff.map(s => ({ ...s, hasCalendar: false })));
      return;
    }

    try {
      const response = await supabase.functions.invoke("google-calendar?action=list-connected-staff", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      const connectedStaffIds = response.data?.staff?.map((s: any) => s.id) || [];
      
      setStaffList(allStaff.map(s => ({
        ...s,
        hasCalendar: connectedStaffIds.includes(s.id),
      })));
    } catch (e) {
      console.error("Error fetching connected staff:", e);
      setStaffList(allStaff.map(s => ({ ...s, hasCalendar: false })));
    }
  };

  const handleSubmit = async () => {
    if (!formData.interviewerId || !formData.scheduledAt) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (candidates.length === 0) {
      toast.error("Selecione ao menos um candidato");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Você precisa estar logado");
        return;
      }

      const interviewer = staffList.find(s => s.id === formData.interviewerId);
      if (!interviewer) {
        toast.error("Entrevistador não encontrado");
        return;
      }

      let meetLink = "";
      let eventId = "";

      const startDate = new Date(formData.scheduledAt);
      const endDate = new Date(startDate.getTime() + parseInt(formData.duration) * 60000);

      // Generate a group session ID
      const groupSessionId = crypto.randomUUID();

      // Create Google Calendar event with all candidates
      if (interviewer.hasCalendar && formData.type === "video") {
        try {
          const candidateNames = candidates.map(c => c.full_name).join(", ");
          const attendeeEmails = candidates.map(c => c.email);
          
          const response = await supabase.functions.invoke("google-calendar?action=create-event", {
            body: {
              title: `Entrevista em Grupo: ${candidateNames}`,
              description: `Entrevista em grupo com ${candidates.length} candidatos:\n${candidates.map(c => `• ${c.full_name} (${c.email})`).join("\n")}\n\n${formData.notes || ""}`,
              startDateTime: startDate.toISOString(),
              endDateTime: endDate.toISOString(),
              target_user_id: interviewer.user_id,
              attendees: attendeeEmails,
            },
            headers: {
              Authorization: `Bearer ${session.session.access_token}`,
            },
          });

          if (response.data?.event) {
            meetLink = response.data.event.hangoutLink || "";
            eventId = response.data.event.id || "";
          }
        } catch (e) {
          console.error("Error creating calendar event:", e);
          toast.warning("Evento criado sem integração com Google Calendar");
        }
      } else if (!interviewer.hasCalendar && formData.type === "video") {
        toast.warning("Entrevistador não tem Google Calendar conectado");
      }

      // Create interview records for each candidate
      const interviewRecords = candidates.map(candidate => ({
        candidate_id: candidate.id,
        interviewer_id: formData.interviewerId,
        scheduled_at: formData.scheduledAt,
        interview_type: formData.type,
        status: "scheduled",
        meet_link: meetLink || null,
        calendar_event_id: eventId || null,
        notes: formData.notes || null,
        group_session_id: groupSessionId,
      }));

      const { error: interviewError } = await supabase.from("interviews").insert(interviewRecords);

      if (interviewError) throw interviewError;

      // Add to hiring history for each candidate
      const historyRecords = candidates.map(candidate => ({
        candidate_id: candidate.id,
        action: "interview_scheduled",
        notes: `Entrevista em grupo agendada para ${format(startDate, "dd/MM/yyyy 'às' HH:mm")} com ${interviewer.name} (${candidates.length} candidatos)`,
        performed_by: interviewer.id,
      }));

      await supabase.from("hiring_history").insert(historyRecords);

      toast.success(`Entrevista em grupo agendada para ${candidates.length} candidatos!`);
      
      if (meetLink) {
        navigator.clipboard.writeText(meetLink);
        toast.info("Link do Meet copiado para a área de transferência");
      }

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        interviewerId: "",
        scheduledAt: "",
        duration: "90",
        type: "video",
        notes: "",
      });
    } catch (error) {
      console.error("Error scheduling group interview:", error);
      toast.error("Erro ao agendar entrevista em grupo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agendar Entrevista em Grupo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Candidates */}
          <div className="space-y-2">
            <Label>Candidatos Selecionados ({candidates.length})</Label>
            <ScrollArea className="h-24 border rounded-lg p-2">
              <div className="flex flex-wrap gap-2">
                {candidates.map(candidate => (
                  <Badge key={candidate.id} variant="secondary" className="gap-1">
                    {candidate.full_name}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>Entrevistador *</Label>
            <Select
              value={formData.interviewerId}
              onValueChange={(value) => setFormData({ ...formData, interviewerId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o entrevistador" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    <span className="flex items-center gap-2">
                      {staff.name}
                      {staff.hasCalendar && <Calendar className="h-3 w-3 text-green-500" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select
                value={formData.duration}
                onValueChange={(value) => setFormData({ ...formData, duration: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="180">3 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Entrevista</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">
                  <span className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Videoconferência (Google Meet)
                  </span>
                </SelectItem>
                <SelectItem value="in_person">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Dinâmica, tópicos a abordar..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Agendar para {candidates.length} candidato{candidates.length > 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
