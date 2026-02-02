import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon, AlertCircle, Check, Copy, Video } from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  user_id: string;
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
  const [durationMinutes] = useState(60);

  // Load connected staff on mount
  useEffect(() => {
    loadConnectedStaff();
  }, []);

  // Fetch available slots when staff or date changes
  useEffect(() => {
    if (selectedStaffUserId && selectedDate) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
    }
  }, [selectedStaffUserId, selectedDate]);

  const loadConnectedStaff = async () => {
    setLoadingStaff(true);
    try {
      // Fetch staff with CRM access
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
        // Filter to only show staff with CRM access
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
      const endHours = hours + Math.floor(durationMinutes / 60);
      const endMinutes = minutes + (durationMinutes % 60);
      const endTime = `${String(endHours).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const startDateTime = `${dateStr}T${selectedSlot}:00`;
      const endDateTime = `${dateStr}T${endTime}:00`;

      const attendees = leadEmail ? [leadEmail] : undefined;

      const { data, error } = await supabase.functions.invoke(
        "google-calendar?action=create-event",
        {
          body: {
            title: meetingTitle,
            description: `Agendamento via checklist CRM: ${checklistItemTitle}`,
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
        // Save as CRM activity
        const { data: userData } = await supabase.auth.getUser();
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", userData.user?.id)
          .single();

        await supabase.from("crm_activities").insert({
          lead_id: leadId,
          type: "meeting",
          title: meetingTitle,
          description: `Agendamento via checklist: ${checklistItemTitle}`,
          scheduled_at: startDateTime,
          responsible_staff_id: staffData?.id,
          status: "pending",
        });

        if (data.event?.meetingLink) {
          setCreatedMeetLink(data.event.meetingLink);
        }

        toast.success("Reunião agendada com sucesso!");
        onScheduled();
      }
    } catch (error: any) {
      console.error("Schedule meeting error:", error);
      toast.error(error.message || "Erro ao agendar reunião");
    } finally {
      setScheduling(false);
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

  const selectedStaff = useMemo(() => 
    connectedStaff.find(s => s.user_id === selectedStaffUserId),
    [connectedStaff, selectedStaffUserId]
  );

  // If meeting was created, show success state
  if (createdMeetLink) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="font-semibold">Reunião Agendada!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Link do Google Meet gerado
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <Label className="text-xs text-muted-foreground">Link da reunião</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-xs break-all">{createdMeetLink}</code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyMeetLink}
              className="shrink-0 h-8 w-8"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* No-show toggle */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Marcar no-show</span>
          <Switch checked={markAsNoShow} onCheckedChange={setMarkAsNoShow} />
        </div>
      </div>

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
                <span>
                  Nenhum usuário conectou o Google Calendar ainda.
                </span>
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
                        <Badge variant="secondary" className="text-xs">
                          {getRoleLabel(staff.role)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedStaff && (
              <p className="text-xs text-muted-foreground">
                {selectedStaff.name}
              </p>
            )}
            <button className="text-xs text-primary hover:underline">
              Opções de disponibilidade...
            </button>
          </div>

          {/* Meeting title */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Título da reunião</Label>
            <Input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Reunião com..."
            />
          </div>

          {/* Date and Time Picker */}
          {selectedStaffUserId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escolha uma data e horário</Label>
              <div className="flex gap-4">
                {/* Calendar */}
                <div className="bg-background rounded-lg border border-border">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    locale={ptBR}
                    className="rounded-md"
                  />
                </div>

                {/* Time slots */}
                <div className="flex-1 min-w-[120px]">
                  {selectedDate && (
                    <>
                      <p className="text-sm font-medium mb-2">
                        {format(selectedDate, "EEEE, d", { locale: ptBR })}
                      </p>
                      {loadingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          Nenhum horário disponível
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                "w-full py-2 px-3 text-sm rounded-lg border transition-colors",
                                selectedSlot === slot
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {!selectedDate && (
                    <p className="text-sm text-muted-foreground py-4">
                      Selecione uma data
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Schedule Button */}
      {selectedSlot && (
        <div className="p-4 border-t border-border">
          <Button
            className="w-full"
            onClick={handleSchedule}
            disabled={scheduling}
          >
            {scheduling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Agendar Reunião
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
