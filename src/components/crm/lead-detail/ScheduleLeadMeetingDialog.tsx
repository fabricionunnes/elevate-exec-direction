import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyCrmActivityViaWhatsApp } from "@/lib/crm/notifyActivityWhatsApp";
import { getPublicBaseUrl } from "@/lib/publicDomain";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Calendar, Video, Copy, Check, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  user_id: string;
}

interface ScheduleLeadMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadEmail?: string;
  onSuccess: () => void;
  // Optional pre-configuration for automation
  defaultDuration?: number;
  defaultStaffId?: string;
  activityIdToComplete?: string;
}

export const ScheduleLeadMeetingDialog = ({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadEmail,
  onSuccess,
  defaultDuration,
  defaultStaffId,
  activityIdToComplete,
}: ScheduleLeadMeetingDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [connectedStaff, setConnectedStaff] = useState<StaffMember[]>([]);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string>("");
  const [createdMeetLink, setCreatedMeetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Calculate end time based on default duration
  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const defaultEndTime = defaultDuration 
    ? calculateEndTime("09:00", defaultDuration) 
    : "10:00";

  const [formData, setFormData] = useState({
    title: `Reunião com ${leadName}`,
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: defaultEndTime,
    attendees: leadEmail || "",
  });

  useEffect(() => {
    if (open) {
      loadConnectedStaff();
      const endTime = defaultDuration 
        ? calculateEndTime("09:00", defaultDuration) 
        : "10:00";
      setFormData({
        title: `Reunião com ${leadName}`,
        description: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime,
        attendees: leadEmail || "",
      });
      setCreatedMeetLink(null);
      setCopied(false);
    }
  }, [open, leadName, leadEmail, defaultDuration]);

  const loadConnectedStaff = async () => {
    setLoadingStaff(true);
    try {
      // Fetch staff with CRM access (master role or explicit permission)
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
        // Filter to only show staff with CRM access (master always has access, others need permission)
        const filteredStaff = data.staff.filter((staff: StaffMember) => 
          staff.role === "master" || staffIdsWithCRMAccess.has(staff.id)
        );
        
        setConnectedStaff(filteredStaff);
        
        // Auto-select defaultStaffId if provided and available, otherwise first staff
        if (defaultStaffId) {
          // Find the staff by id and get their user_id
          const defaultStaff = filteredStaff.find((s: StaffMember) => s.id === defaultStaffId);
          if (defaultStaff) {
            setSelectedStaffUserId(defaultStaff.user_id);
          } else if (filteredStaff.length > 0 && !selectedStaffUserId) {
            setSelectedStaffUserId(filteredStaff[0].user_id);
          }
        } else if (filteredStaff.length > 0 && !selectedStaffUserId) {
          setSelectedStaffUserId(filteredStaff[0].user_id);
        }
      }
    } catch (error) {
      console.error("Error loading connected staff:", error);
      toast.error("Erro ao carregar usuários conectados");
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStaffUserId) {
      toast.error("Selecione um usuário para agendar na agenda");
      return;
    }

    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const startDateTime = `${formData.date}T${formData.startTime}:00`;
      const endDateTime = `${formData.date}T${formData.endTime}:00`;
      // ISO com offset Brasil (-03:00) para persistir corretamente em timestamptz
      const startDateTimeISO = `${startDateTime}-03:00`;

      const attendees = formData.attendees
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      // Build description with lead card link
      const baseUrl = getPublicBaseUrl();
      const leadCardUrl = `${baseUrl}/#/crm/leads/${leadId}`;
      const descriptionParts: string[] = [];
      if (formData.description) {
        descriptionParts.push(formData.description);
      }
      descriptionParts.push(`📋 Link do lead no CRM: ${leadCardUrl}`);
      const fullDescription = descriptionParts.join("\n\n");

      const { data, error } = await supabase.functions.invoke(
        "google-calendar?action=create-event",
        {
          body: {
            title: formData.title,
            description: fullDescription,
            startDateTime,
            endDateTime,
            attendees: attendees.length > 0 ? attendees : undefined,
            target_user_id: selectedStaffUserId,
          },
        }
      );

      if (error) throw error;

      if (data?.needsAuth) {
        const staff = connectedStaff.find((s) => s.user_id === selectedStaffUserId);
        toast.error(`${staff?.name || "Usuário"} precisa reconectar a conta Google Calendar`);
        return;
      }

      if (data?.success) {
        toast.success("Reunião agendada com sucesso!");
        
        // Save as CRM activity
        const { data: userData } = await supabase.auth.getUser();
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", userData.user?.id)
          .single();

        // Find the closer's staff_id (the one whose calendar was used)
        const selectedCloser = connectedStaff.find((s) => s.user_id === selectedStaffUserId);
        const closerStaffId = selectedCloser?.id || null;

        const activityInsert: any = {
          lead_id: leadId,
          type: "meeting",
          title: formData.title,
          description: formData.description || null,
          scheduled_at: startDateTimeISO,
          responsible_staff_id: staffData?.id,
          status: "pending",
          meeting_link: data.event?.meetingLink || null,
          google_calendar_event_id: data.event?.id || null,
          google_calendar_user_id: selectedStaffUserId || null,
        };

        await supabase.from("crm_activities").insert(activityInsert);

        // Send WhatsApp notification to responsible staff
        if (staffData?.id) {
          notifyCrmActivityViaWhatsApp({
            staffId: staffData.id,
            leadId,
            leadName,
            activityTitle: formData.title,
            activityType: "meeting",
            scheduledAt: startDateTimeISO,
          });
        }

        // Log the scheduling action in history
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
            new_scheduled_at: startDateTimeISO,
            notes: `Agendado por ${staffData?.id ? "staff" : "sistema"} - ${formData.title}`,
          } as any);
        }

        // Auto-assign the closer as lead owner and move to "Agendada" stage
        if (closerStaffId) {
          const { data: leadData } = await supabase
            .from("crm_leads")
            .select("pipeline_id, stage_id, owner_staff_id")
            .eq("id", leadId)
            .single();

          if (leadData?.pipeline_id) {
            const { data: agendadaStage } = await supabase
              .from("crm_stages")
              .select("id, name")
              .eq("pipeline_id", leadData.pipeline_id)
              .or("name.ilike.%agendada%,name.ilike.%agendou%")
              .order("sort_order")
              .limit(1)
              .single();

            const updatePayload: any = {
              owner_staff_id: closerStaffId,
              closer_staff_id: closerStaffId,
              updated_at: new Date().toISOString(),
            };

            if (agendadaStage) {
              updatePayload.stage_id = agendadaStage.id;
            }

            await supabase
              .from("crm_leads")
              .update(updatePayload)
              .eq("id", leadId);

            // Log stage change
            if (agendadaStage && leadData.stage_id !== agendadaStage.id) {
              await supabase.from("crm_lead_history").insert({
                lead_id: leadId,
                action: "stage_change",
                field_changed: "stage_id",
                old_value: leadData.stage_id,
                new_value: agendadaStage.id,
                notes: `Movido para "${agendadaStage.name}" automaticamente ao agendar reunião`,
                staff_id: staffData?.id || null,
              });
            }

            // Log owner change
            if (leadData.owner_staff_id !== closerStaffId) {
              await supabase.from("crm_lead_history").insert({
                lead_id: leadId,
                action: "owner_change",
                field_changed: "owner_staff_id",
                old_value: leadData.owner_staff_id,
                new_value: closerStaffId,
                notes: `Responsável alterado para ${selectedCloser?.name} automaticamente ao agendar reunião`,
                staff_id: staffData?.id || null,
              });
            }
          }
        }

        // Notify the closer about the scheduled meeting
        if (closerStaffId && closerStaffId !== staffData?.id) {
          const meetingDate = format(new Date(formData.date), "dd/MM/yyyy", { locale: ptBR });
          const meetingTime = formData.startTime;
          
          await supabase.from("onboarding_notifications").insert({
            staff_id: closerStaffId,
            type: "meeting_scheduled",
            title: `📅 Nova reunião agendada: ${leadName}`,
            message: `Uma reunião foi agendada para você com o lead "${leadName}" no dia ${meetingDate} às ${meetingTime}.`,
            reference_id: leadId,
            reference_type: "crm_lead",
          });
        }

        // If this was triggered from an automation activity, mark it as completed
        if (activityIdToComplete) {
          await supabase
            .from("crm_activities")
            .update({ 
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", activityIdToComplete);
        }

        // Enqueue CRM message rules for meeting_scheduled
        try {
          const { data: leadForQueue } = await supabase
            .from("crm_leads")
            .select("phone, email, company, pipeline_id")
            .eq("id", leadId)
            .single();

          if (leadForQueue?.phone) {
            const meetingDate = format(new Date(formData.date), "dd/MM/yyyy", { locale: ptBR });
            const selectedCloserObj = connectedStaff.find(s => s.user_id === selectedStaffUserId);
            const pipelineName = leadForQueue.pipeline_id
              ? (await supabase.from("crm_pipelines").select("name").eq("id", leadForQueue.pipeline_id).single())?.data?.name || ""
              : "";

            await supabase.functions.invoke("crm-message-queue", {
              body: {
                action: "enqueue",
                trigger_type: "meeting_scheduled",
                lead_id: leadId,
                lead_name: leadName,
                lead_phone: leadForQueue.phone,
                lead_email: leadForQueue.email || leadEmail || "",
                company_name: leadForQueue.company || "",
                pipeline_id: leadForQueue.pipeline_id || "",
                pipeline_name: pipelineName,
                stage_id: "",
                stage_name: "",
                meeting_link: data.event?.meetingLink || "",
                meeting_date: meetingDate,
                meeting_time: formData.startTime,
                responsible_name: selectedCloserObj?.name || "",
              },
            });
          }
        } catch (queueErr) {
          console.error("[ScheduleMeeting] Message queue error:", queueErr);
        }

        if (data.event?.meetingLink) {
          setCreatedMeetLink(data.event.meetingLink);
        } else {
          onSuccess();
          onOpenChange(false);
        }
      }
    } catch (error: unknown) {
      console.error("Schedule meeting error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao agendar reunião";
      if (errorMessage.includes("403") || errorMessage.includes("Permissão")) {
        toast.error("Permissão negada. O usuário precisa reconectar com permissões de escrita.");
      } else {
        toast.error("Erro ao agendar reunião");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyMeetLink = () => {
    if (createdMeetLink) {
      navigator.clipboard.writeText(createdMeetLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (createdMeetLink) {
      onSuccess();
    }
    onOpenChange(false);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      master: "Master",
      admin: "Admin",
      cs: "CS",
      closer: "Closer",
      sdr: "SDR",
      socialSetter: "Social Setter",
      bdr: "BDR",
    };
    return labels[role] || role;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Agendar Reunião
          </DialogTitle>
        </DialogHeader>

        {createdMeetLink ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Reunião Criada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                O link do Google Meet foi gerado automaticamente
              </p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <Label className="text-xs text-muted-foreground">Link da reunião</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm break-all">{createdMeetLink}</code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyMeetLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Staff selector */}
            <div className="space-y-2">
              <Label>Agendar na agenda de *</Label>
              {loadingStaff ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando usuários...
                </div>
              ) : connectedStaff.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Nenhum usuário conectou o Google Calendar ainda. Os usuários precisam
                    conectar suas contas na aba "Minha Agenda" do escritório virtual.
                  </span>
                </div>
              ) : (
                <Select
                  value={selectedStaffUserId}
                  onValueChange={setSelectedStaffUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedStaff.map((staff) => (
                      <SelectItem key={staff.user_id} value={staff.user_id}>
                        <div className="flex items-center gap-2">
                          <span>{staff.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getRoleLabel(staff.role)}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Ex: Reunião de apresentação"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Início *</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, startTime: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fim *</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, endTime: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <Label>Convidados (emails separados por vírgula)</Label>
              <Input
                value={formData.attendees}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, attendees: e.target.value }))
                }
                placeholder="email1@exemplo.com, email2@exemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                Um convite será enviado para estes emails
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Detalhes da reunião..."
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || connectedStaff.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar Reunião
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
