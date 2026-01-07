import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Video, Building2, Loader2, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  meetingLink?: string;
  calendarLink: string;
}

interface Project {
  id: string;
  product_name: string;
  onboarding_company?: {
    id: string;
    name: string;
  } | null;
}

interface MeetingNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onSaved?: () => void;
}

export const MeetingNotesDialog = ({
  open,
  onOpenChange,
  event,
  onSaved,
}: MeetingNotesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState("");
  const [recordingLink, setRecordingLink] = useState("");
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProjects();
      fetchCurrentStaff();
      // Pre-fill subject with event title
      if (event) {
        setSubject(event.title);
        setAttendees(event.description || "");
      }
    }
  }, [open, event]);

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

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          product_name,
          onboarding_company_id,
          onboarding_companies:onboarding_company_id (
            id,
            name
          )
        `)
        .eq("status", "active")
        .order("product_name");

      if (error) throw error;

      const projectsWithCompany = (data || []).map((p) => ({
        id: p.id,
        product_name: p.product_name,
        onboarding_company: p.onboarding_companies as { id: string; name: string } | null,
      }));

      setProjects(projectsWithCompany);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast.error("Selecione um cliente/projeto");
      return;
    }

    if (!subject.trim()) {
      toast.error("Informe o assunto da reunião");
      return;
    }

    if (!notes.trim()) {
      toast.error("Descreva o que foi tratado na reunião");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("onboarding_meeting_notes").insert({
        project_id: selectedProjectId,
        staff_id: currentStaffId,
        google_event_id: event?.id || null,
        meeting_title: event?.title || subject,
        meeting_date: event?.start || new Date().toISOString(),
        subject: subject.trim(),
        notes: notes.trim(),
        attendees: attendees.trim() || null,
        meeting_link: event?.meetingLink || null,
        recording_link: recordingLink.trim() || null,
        is_finalized: true, // Auto-finalize when notes are provided
      });

      if (error) throw error;

      toast.success("Registro da reunião salvo com sucesso!");
      resetForm();
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error("Error saving meeting notes:", error);
      toast.error("Erro ao salvar registro da reunião");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedProjectId("");
    setSubject("");
    setNotes("");
    setAttendees("");
    setRecordingLink("");
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Registrar Reunião Realizada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Info */}
          {event && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
              <Video className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(event.start), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Cliente / Projeto *</Label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando clientes...
              </div>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {project.onboarding_company?.name || project.product_name}
                        </span>
                        {project.onboarding_company && (
                          <span className="text-xs text-muted-foreground">
                            ({project.product_name})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Assunto *</Label>
            <Input
              placeholder="Ex: Alinhamento de expectativas, Revisão de processos..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>O que foi tratado na reunião? *</Label>
            <Textarea
              placeholder="Descreva os principais pontos discutidos, decisões tomadas, próximos passos..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Participantes (opcional)</Label>
            <Input
              placeholder="Nomes dos participantes da reunião"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />
          </div>

          {/* Recording Link */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-red-500" />
              Link da Gravação (opcional)
            </Label>
            <Input
              placeholder="https://drive.google.com/file/... ou link da gravação"
              value={recordingLink}
              onChange={(e) => setRecordingLink(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cole o link da gravação do Google Meet ou outro serviço
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
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
};
