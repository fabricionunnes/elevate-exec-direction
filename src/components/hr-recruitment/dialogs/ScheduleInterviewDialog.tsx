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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Calendar, Video } from "lucide-react";
import { format } from "date-fns";

interface Staff {
  id: string;
  name: string;
  user_id: string;
  hasCalendar?: boolean;
}

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  projectId: string;
  onSuccess: () => void;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  projectId,
  onSuccess,
}: ScheduleInterviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [formData, setFormData] = useState({
    interviewerId: "",
    scheduledAt: "",
    duration: "60",
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
    // Get all active staff
    const { data: allStaff } = await supabase
      .from("onboarding_staff")
      .select("id, name, user_id")
      .eq("is_active", true)
      .order("name");

    if (!allStaff) {
      setStaffList([]);
      return;
    }

    // Check who has calendar connected via edge function
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

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Get interviewer details
      const interviewer = staffList.find(s => s.id === formData.interviewerId);
      if (!interviewer) {
        toast.error("Entrevistador não encontrado");
        return;
      }

      let meetLink = "";
      let eventId = "";

      const startDate = new Date(formData.scheduledAt);
      const endDate = new Date(startDate.getTime() + parseInt(formData.duration) * 60000);

      // Try to create Google Calendar event if interviewer has calendar connected
      if (interviewer.hasCalendar && formData.type === "video") {
        try {
          const response = await supabase.functions.invoke("google-calendar?action=create-event", {
            body: {
              title: `Entrevista: ${candidateName}`,
              description: `Entrevista com candidato ${candidateName}\nEmail: ${candidateEmail}\n\n${formData.notes || ""}`,
              startDateTime: startDate.toISOString(),
              endDateTime: endDate.toISOString(),
              target_user_id: interviewer.user_id,
              attendees: [candidateEmail],
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

      // Create interview record
      const { error: interviewError } = await supabase.from("interviews").insert({
        candidate_id: candidateId,
        interviewer_id: formData.interviewerId,
        scheduled_at: formData.scheduledAt,
        interview_type: formData.type,
        status: "scheduled",
        meet_link: meetLink || null,
        calendar_event_id: eventId || null,
        notes: formData.notes || null,
      });

      if (interviewError) throw interviewError;

      // Add to hiring history
      await supabase.from("hiring_history").insert({
        candidate_id: candidateId,
        action: "interview_scheduled",
        notes: `Entrevista agendada para ${format(startDate, "dd/MM/yyyy 'às' HH:mm")} com ${interviewer.name}`,
        performed_by: interviewer.id,
      });

      toast.success("Entrevista agendada com sucesso!");
      
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
        duration: "60",
        type: "video",
        notes: "",
      });
    } catch (error) {
      console.error("Error scheduling interview:", error);
      toast.error("Erro ao agendar entrevista");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendar Entrevista
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{candidateName}</p>
            <p className="text-xs text-muted-foreground">{candidateEmail}</p>
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
                step={900}
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
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
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
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="in_person">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Tópicos a abordar, preparação necessária..."
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
            Agendar Entrevista
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
