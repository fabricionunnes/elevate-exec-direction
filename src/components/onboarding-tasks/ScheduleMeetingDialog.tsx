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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Video, Users, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { buildProjectEventDescription } from "@/lib/projectMeetingDescription";
import { RecurrenceSelector } from "@/components/onboarding-tasks/RecurrenceSelector";

function recurrenceToRRule(recurrence: string | null): string | null {
  switch (recurrence) {
    case "daily_weekdays": return "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR";
    case "daily_all_days": return "RRULE:FREQ=DAILY";
    case "weekly":         return "RRULE:FREQ=WEEKLY";
    case "biweekly":       return "RRULE:FREQ=WEEKLY;INTERVAL=2";
    case "monthly":        return "RRULE:FREQ=MONTHLY";
    case "quarterly":      return "RRULE:FREQ=MONTHLY;INTERVAL=3";
    default: return null;
  }
}

interface StaffWithCalendar {
  id: string;
  name: string;
  role: string;
  user_id: string;
  hasCalendar: boolean;
}

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  companyName?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultDate?: string;
  consultantId?: string | null;
  csId?: string | null;
  onMeetingCreated?: (meetingLink: string, eventId: string) => void;
}

export const ScheduleMeetingDialog = ({
  open,
  onOpenChange,
  projectId,
  companyName,
  defaultTitle = "",
  defaultDescription = "",
  defaultDate,
  consultantId,
  csId,
  onMeetingCreated,
}: ScheduleMeetingDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [connectedStaff, setConnectedStaff] = useState<StaffWithCalendar[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [date, setDate] = useState<Date | undefined>(defaultDate ? parseISO(defaultDate) : undefined);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [targetStaffId, setTargetStaffId] = useState<string>("");
  const [attendeeEmails, setAttendeeEmails] = useState<string>("");
  const [isInternal, setIsInternal] = useState(false);
  const [recurrence, setRecurrence] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchConnectedStaff();
      fetchCurrentUserEmail();
      // Reset form with defaults
      setTitle(defaultTitle || `Reunião - ${companyName || "Cliente"}`);
      setDescription(defaultDescription);
      if (defaultDate) {
        setDate(parseISO(defaultDate));
      }
    }
  }, [open, defaultTitle, defaultDescription, defaultDate, companyName]);

  const fetchCurrentUserEmail = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      setCurrentUserEmail(session.user.email);
      
      // Fetch current user's staff info to get their role
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", session.user.id)
        .single();
      
      if (staffData) {
        setCurrentUserRole(staffData.role);
        setCurrentStaffId(staffData.id);
      }
    }
  };

  const fetchConnectedStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get staff with connected calendars
      const response = await supabase.functions.invoke("google-calendar?action=list-connected-staff", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Error fetching connected staff:", response.error);
        return;
      }

      const staffWithCalendar = response.data?.staff || [];
      
      // Mark staff with calendar
      let staffList: StaffWithCalendar[] = staffWithCalendar.map((s: any) => ({
        ...s,
        hasCalendar: true,
      }));

      // Get current user's staff info to check role
      const { data: currentStaffData } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", session.user.id)
        .single();

      // If current user is a consultant, they can only schedule on their own calendar
      if (currentStaffData?.role === "consultant") {
        staffList = staffList.filter((s: StaffWithCalendar) => s.id === currentStaffData.id);
      }

      setConnectedStaff(staffList);

      // Auto-select based on role
      if (currentStaffData?.role === "consultant") {
        // Consultants can only use their own calendar
        const ownCalendar = staffList.find((s: StaffWithCalendar) => s.id === currentStaffData.id);
        if (ownCalendar) {
          setTargetStaffId(ownCalendar.id);
        }
      } else if (consultantId) {
        // Admin/CS: auto-select consultant if available
        const consultant = staffList.find((s: StaffWithCalendar) => s.id === consultantId);
        if (consultant) {
          setTargetStaffId(consultant.id);
        }
      } else if (csId) {
        const cs = staffList.find((s: StaffWithCalendar) => s.id === csId);
        if (cs) {
          setTargetStaffId(cs.id);
        }
      } else if (staffList.length > 0) {
        setTargetStaffId(staffList[0].id);
      }
    } catch (error) {
      console.error("Error fetching connected staff:", error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!date) {
      toast.error("Selecione uma data para a reunião");
      return;
    }

    if (!targetStaffId) {
      toast.error("Selecione em qual agenda criar a reunião");
      return;
    }

    if (!title.trim()) {
      toast.error("Informe o título da reunião");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Get the target staff's user_id
      const targetStaff = connectedStaff.find(s => s.id === targetStaffId);
      if (!targetStaff) {
        toast.error("Staff selecionado não encontrado");
        return;
      }

      // Parse date and time
      const [hours, minutes] = time.split(":").map(Number);
      const startDate = new Date(date);
      startDate.setHours(hours, minutes, 0, 0);
      
      const durationMinutes = parseInt(duration);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      // Build attendees list — apenas convidados explícitos.
      // Não adicionamos o criador automaticamente, para que ao agendar na
      // agenda de outro usuário (ex: Natallia), o evento NÃO apareça também
      // na agenda do criador (ex: Fabrício).
      const attendees: string[] = [];

      if (attendeeEmails.trim()) {
        const additionalEmails = attendeeEmails
          .split(/[,;\s]+/)
          .map(e => e.trim())
          .filter(e => e && e.includes("@"));
        attendees.push(...additionalEmails);
      }

      // Create event in target staff's calendar
      const response = await supabase.functions.invoke("google-calendar?action=create-event", {
        body: {
          title,
          description: buildProjectEventDescription(description, projectId, { companyName }),
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          target_user_id: targetStaff.user_id,
          attendees,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao criar reunião");
      }

      const data = response.data;
      
      if (data.error) {
        if (data.needsAuth) {
          toast.error(`${targetStaff.name} precisa reconectar a conta Google Calendar`);
        } else {
          toast.error(data.error);
        }
        return;
      }

      const meetingLink = data.event.meetingLink;
      const eventId = data.event.id;

      // Get current staff ID for meeting notes
      const { data: currentStaff } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("user_id", session.user.id)
        .single();

      // Create meeting notes record with scheduling info
      if (currentStaff) {
        await supabase.from("onboarding_meeting_notes").insert({
          project_id: projectId,
          staff_id: currentStaff.id,
          google_event_id: eventId,
          meeting_title: title,
          meeting_date: startDate.toISOString(),
          subject: title,
          notes: "",
          meeting_link: meetingLink,
          is_finalized: false,
          scheduled_by: currentStaff.id,
          calendar_owner_id: targetStaff.user_id,
          calendar_owner_name: targetStaff.name,
          is_internal: isInternal,
        });
      }

      toast.success(`Reunião criada na agenda de ${targetStaff.name}!`);
      
      if (onMeetingCreated) {
        onMeetingCreated(meetingLink, eventId);
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      toast.error(error.message || "Erro ao criar reunião");
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "cs": return "CS";
      case "consultant": return "Consultor";
      default: return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Agendar Reunião com Google Meet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Target Calendar Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Criar na agenda de
            </Label>
            {loadingStaff ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando agendas conectadas...
              </div>
            ) : connectedStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum membro da equipe conectou a agenda do Google. 
                Peça para o consultor ou CS conectar a conta no menu de Agenda.
              </p>
            ) : (
              <Select value={targetStaffId} onValueChange={setTargetStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a agenda" />
                </SelectTrigger>
                <SelectContent>
                  {connectedStaff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name} ({getRoleLabel(staff.role)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Meeting Title */}
          <div className="space-y-2">
            <Label>Título da reunião *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião de Alinhamento"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Horário *</Label>
              <Input
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Attendees */}
          <div className="space-y-2">
            <Label>Participantes adicionais (emails)</Label>
            <Textarea
              value={attendeeEmails}
              onChange={(e) => setAttendeeEmails(e.target.value)}
              placeholder="email1@empresa.com, email2@empresa.com"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Separe os emails por vírgula. Você será adicionado automaticamente como participante.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pauta ou observações da reunião..."
              rows={3}
            />
          </div>

          {/* Internal Meeting Checkbox */}
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
            <Checkbox
              id="is-internal"
              checked={isInternal}
              onCheckedChange={(checked) => setIsInternal(checked === true)}
            />
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <Label htmlFor="is-internal" className="text-sm font-normal cursor-pointer">
                Reunião Interna (não visível para o cliente)
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateMeeting}
              disabled={loading || !date || !targetStaffId || !title.trim()}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Video className="h-4 w-4 mr-2" />
              )}
              Criar Reunião
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
