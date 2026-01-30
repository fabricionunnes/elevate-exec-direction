import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
}

export const ScheduleLeadMeetingDialog = ({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadEmail,
  onSuccess,
}: ScheduleLeadMeetingDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [connectedStaff, setConnectedStaff] = useState<StaffMember[]>([]);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string>("");
  const [createdMeetLink, setCreatedMeetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    title: `Reunião com ${leadName}`,
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    attendees: leadEmail || "",
  });

  useEffect(() => {
    if (open) {
      loadConnectedStaff();
      setFormData({
        title: `Reunião com ${leadName}`,
        description: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        attendees: leadEmail || "",
      });
      setCreatedMeetLink(null);
      setCopied(false);
    }
  }, [open, leadName, leadEmail]);

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
        // Auto-select first staff if available
        if (filteredStaff.length > 0 && !selectedStaffUserId) {
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

      const attendees = formData.attendees
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      const { data, error } = await supabase.functions.invoke(
        "google-calendar?action=create-event",
        {
          body: {
            title: formData.title,
            description: formData.description,
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

        await supabase.from("crm_activities").insert({
          lead_id: leadId,
          type: "meeting",
          title: formData.title,
          description: formData.description || null,
          scheduled_at: startDateTime,
          responsible_staff_id: staffData?.id,
          status: "pending",
        });

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
