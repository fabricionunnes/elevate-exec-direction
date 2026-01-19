import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RecurrenceSelector } from "@/components/onboarding-tasks/RecurrenceSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Video, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface StaffWithCalendar extends StaffMember {
  hasCalendar: boolean;
  google_calendar_token?: string;
}
interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialTitle?: string;
  staffList: StaffMember[];
  onTaskAdded: () => void;
  currentSortOrder?: number;
  forceInternal?: boolean; // When true, task is always created as internal (hidden from client)
}

const TASK_PHASES = [
  "Pré-Onboarding",
  "Onboarding & Setup",
  "Diagnóstico Comercial",
  "Desenho do Processo",
  "Implementação CRM",
  "Playbook & Padronização",
  "Treinamento & Adoção",
  "Estabilização & Governança",
];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
});

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1h 30min" },
  { value: "120", label: "2 horas" },
];

export const AddTaskDialog = ({
  open,
  onOpenChange,
  projectId,
  initialTitle = "",
  staffList,
  onTaskAdded,
  currentSortOrder = 0,
  forceInternal = false,
}: AddTaskDialogProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [phase, setPhase] = useState<string>("");
  const [responsibleStaffId, setResponsibleStaffId] = useState<string>("");
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Meeting fields
  const [isMeeting, setIsMeeting] = useState(false);
  const [meetingTime, setMeetingTime] = useState("09:00");
  const [meetingDuration, setMeetingDuration] = useState("60");
  const [targetCalendarStaffId, setTargetCalendarStaffId] = useState<string>("");
  const [staffWithCalendar, setStaffWithCalendar] = useState<StaffWithCalendar[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [projectConsultantId, setProjectConsultantId] = useState<string | null>(null);

  // Fetch staff with calendar via edge function (like ScheduleMeetingDialog)
  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get current user role
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", session.user.id)
        .single();

      if (staffData) {
        setCurrentUserRole(staffData.role);
        setCurrentStaffId(staffData.id);
      }

      // Get staff with connected calendars via edge function
      const response = await supabase.functions.invoke("google-calendar?action=list-connected-staff", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.error && response.data?.staff) {
        let staffList: StaffWithCalendar[] = response.data.staff.map((s: any) => ({
          ...s,
          hasCalendar: true,
        }));

        // If consultant, only show their own calendar
        if (staffData?.role === "consultant") {
          staffList = staffList.filter((s) => s.id === staffData.id);
        }

        setStaffWithCalendar(staffList);
      }

      // Get company name and consultant for meeting title and default responsible
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company:onboarding_companies(name), consultant_id")
        .eq("id", projectId)
        .single();

      if (projectData?.onboarding_company?.name) {
        setCompanyName(projectData.onboarding_company.name);
      }
      
      // Set project consultant as default responsible
      if (projectData?.consultant_id) {
        setProjectConsultantId(projectData.consultant_id);
        setResponsibleStaffId(projectData.consultant_id);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open, projectId]);

  // Filter calendars based on role (consultants can only see their own)
  const availableCalendars = currentUserRole === "consultant" && currentStaffId
    ? staffWithCalendar.filter(s => s.id === currentStaffId)
    : staffWithCalendar;

  // Check if user can select calendar (only CS and Admin)
  const canSelectCalendar = currentUserRole === "admin" || currentUserRole === "cs";

  // Auto-set calendar for consultants
  useEffect(() => {
    if (isMeeting && currentUserRole === "consultant" && currentStaffId && staffWithCalendar.length > 0) {
      const ownCalendar = staffWithCalendar.find(s => s.id === currentStaffId);
      if (ownCalendar) {
        setTargetCalendarStaffId(ownCalendar.id);
      }
    }
  }, [isMeeting, currentUserRole, currentStaffId, staffWithCalendar]);

  // Reset form when dialog opens with new initial title
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription("");
      setDueDate(undefined);
      setPhase("");
      // Set consultant as default responsible when opening
      setResponsibleStaffId(projectConsultantId || "");
      setRecurrence(null);
      setIsMeeting(false);
      setMeetingTime("09:00");
      setMeetingDuration("60");
      setTargetCalendarStaffId("");
    }
  }, [open, initialTitle, projectConsultantId]);

  const createGoogleMeetMeeting = async () => {
    if (!dueDate || !targetCalendarStaffId) {
      toast.error("Selecione a data e a agenda para criar a reunião");
      return null;
    }

    const targetStaff = staffWithCalendar.find(s => s.id === targetCalendarStaffId);
    if (!targetStaff) {
      toast.error("O colaborador selecionado não tem calendário conectado");
      return null;
    }

    try {
      const [hours, minutes] = meetingTime.split(":").map(Number);
      const startDateTime = setMinutes(setHours(dueDate, hours), minutes);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(meetingDuration) * 60000);

      const meetingTitle = title.trim() || `Reunião - ${companyName}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      // Get target staff's user_id for the calendar
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("user_id")
        .eq("id", targetCalendarStaffId)
        .single();

      if (!staffData?.user_id) {
        throw new Error("Usuário do staff não encontrado");
      }

      const { data, error } = await supabase.functions.invoke("google-calendar?action=create-event", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          title: meetingTitle,
          description: description || `Reunião agendada para o projeto`,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          target_user_id: staffData.user_id,
        },
      });

      if (error) throw error;

      const meetLink = data?.hangoutLink || data?.conferenceData?.entryPoints?.[0]?.uri;
      return { meetLink, calendarOwnerName: targetStaff.name, startDateTime };
    } catch (error) {
      console.error("Error creating Google Meet:", error);
      toast.error("Erro ao criar reunião no Google Calendar");
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Digite o título da tarefa");
      return;
    }

    if (isMeeting && !dueDate) {
      toast.error("Selecione a data para a reunião");
      return;
    }

    if (isMeeting && !targetCalendarStaffId) {
      toast.error("Selecione a agenda para a reunião");
      return;
    }

    setLoading(true);
    try {
      let meetLink: string | null = null;
      let calendarOwnerName: string | null = null;

      // Create Google Meet if it's a meeting
      if (isMeeting) {
        const meetingResult = await createGoogleMeetMeeting();
        if (!meetingResult) {
          setLoading(false);
          return;
        }
        meetLink = meetingResult.meetLink;
        calendarOwnerName = meetingResult.calendarOwnerName;
      }

      const insertData: any = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        tags: phase ? [phase] : null,
        responsible_staff_id: responsibleStaffId || targetCalendarStaffId || null,
        recurrence: recurrence,
        sort_order: currentSortOrder + 1,
        status: "pending",
        meeting_link: meetLink || null,
        is_internal: forceInternal || false,
      };

      const { data: taskData, error } = await supabase
        .from("onboarding_tasks")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // If it's a meeting, also create meeting_notes entry
      if (isMeeting && taskData && meetLink) {
        const [hours, minutes] = meetingTime.split(":").map(Number);
        const meetingDateTime = setMinutes(setHours(dueDate!, hours), minutes);
        const targetStaff = staffWithCalendar.find(s => s.id === targetCalendarStaffId);

        await supabase.from("onboarding_meeting_notes").insert({
          project_id: projectId,
          staff_id: currentStaffId,
          meeting_title: title.trim() || `Reunião - ${companyName}`,
          meeting_date: meetingDateTime.toISOString(),
          subject: title.trim() || `Reunião - ${companyName}`,
          notes: "",
          meeting_link: meetLink,
          is_finalized: false,
          scheduled_by: currentStaffId,
          calendar_owner_id: targetStaff?.id,
          calendar_owner_name: calendarOwnerName,
        } as any);
      }

      const successMessage = isMeeting
        ? "Reunião agendada com sucesso!"
        : recurrence
          ? "Tarefa recorrente criada!"
          : "Tarefa criada com sucesso!";

      toast.success(successMessage);
      onTaskAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isMeeting ? "Nova Reunião" : forceInternal ? "Nova Tarefa Interna" : "Nova Tarefa"}
          </DialogTitle>
          {forceInternal && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              Esta tarefa será visível apenas para a equipe interna
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Toggle Reunião */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <Label htmlFor="is-meeting" className="cursor-pointer">
                Agendar como Reunião (Google Meet)
              </Label>
            </div>
            <Switch
              id="is-meeting"
              checked={isMeeting}
              onCheckedChange={setIsMeeting}
            />
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMeeting ? "Ex: Reunião de Kickoff" : "Digite o título da tarefa"}
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os detalhes..."
              rows={3}
            />
          </div>

          {/* Data de entrega */}
          <div className="space-y-2">
            <Label>{isMeeting ? "Data da Reunião *" : "Data de Entrega"}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Meeting specific fields */}
          {isMeeting && (
            <>
              {/* Horário e Duração */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Horário
                  </Label>
                  <Select value={meetingTime} onValueChange={setMeetingTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duração</Label>
                  <Select value={meetingDuration} onValueChange={setMeetingDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Agenda (Calendar) - Only show for Admin and CS */}
              {canSelectCalendar ? (
                <div className="space-y-2">
                  <Label>Agendar na Agenda de *</Label>
                  <Select value={targetCalendarStaffId} onValueChange={setTargetCalendarStaffId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a agenda..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCalendars.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name} ({staff.role === "admin" ? "Admin" : staff.role === "cs" ? "CS" : "Consultor"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableCalendars.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum colaborador com calendário conectado
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    A reunião será agendada na sua agenda pessoal
                  </p>
                </div>
              )}
            </>
          )}

          {/* Fase - only for non-meeting tasks */}
          {!isMeeting && (
            <div className="space-y-2">
              <Label>Fase</Label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fase..." />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PHASES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Responsável - only for non-meeting tasks */}
          {!isMeeting && (
            <div className="space-y-2">
              <Label>Responsável (Staff)</Label>
              <Select value={responsibleStaffId} onValueChange={setResponsibleStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role === "admin" ? "Admin" : staff.role === "cs" ? "CS" : "Consultor"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recorrência - available for both tasks and meetings */}
          <div className="space-y-2">
            <Label>Recorrência</Label>
            <RecurrenceSelector
              value={recurrence}
              onChange={setRecurrence}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isMeeting ? "Agendar Reunião" : "Criar Tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};