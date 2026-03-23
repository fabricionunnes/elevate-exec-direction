import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Send, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { sendLoggedWhatsAppText } from "@/lib/whatsapp/sendLoggedWhatsAppText";

interface AutomationConfig {
  mode: 'task' | 'whatsapp_send' | 'schedule_meeting';
  whatsapp_template?: string;
  meeting_staff_id?: string;
  meeting_duration_minutes?: number;
}

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

interface InstanceOption {
  id: string;
  instance_name: string;
  status: string;
}

interface WhatsAppQuickSendButtonProps {
  activityId: string;
  automationConfig: AutomationConfig;
  lead: Lead;
  stageName?: string;
  pipelineName?: string;
  onSuccess?: () => void;
}

function replaceTemplateVariables(
  template: string,
  lead: Lead,
  stageName?: string,
  pipelineName?: string,
  ownerName?: string
): string {
  return template
    .replace(/{nome}/g, lead.name || '')
    .replace(/{empresa}/g, lead.company || '')
    .replace(/{email}/g, lead.email || '')
    .replace(/{telefone}/g, lead.phone || '')
    .replace(/{etapa}/g, stageName || '')
    .replace(/{funil}/g, pipelineName || '')
    .replace(/\{\{responsavel\}\}/g, ownerName || '')
    .replace(/\{\{link_agendamento\}\}/g, '')
    .replace(/\{\{data_hora_agendamento\}\}/g, '');
}

export function WhatsAppQuickSendButton({
  activityId,
  automationConfig,
  lead,
  stageName,
  pipelineName,
  onSuccess,
}: WhatsAppQuickSendButtonProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch user's authorized instances
  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!staff) return;
        setStaffId(staff.id);

        if (staff.role === "master") {
          // Master has access to all instances
          const { data: allInstances } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_name, status")
            .eq("status", "connected")
            .order("instance_name");

          setInstances(allInstances || []);
        } else {
          // Others: only instances with can_send permission
          const { data: access } = await supabase
            .from("whatsapp_instance_access")
            .select("instance_id, instance:whatsapp_instances(id, instance_name, status)")
            .eq("staff_id", staff.id)
            .eq("can_send", true);

          const available = (access || [])
            .filter((a: any) => a.instance?.status === "connected")
            .map((a: any) => ({
              id: a.instance.id,
              instance_name: a.instance.instance_name,
              status: a.instance.status,
            }));

          setInstances(available);
        }
      } catch (err) {
        console.error("Error fetching instances:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, []);

  const sendViaInstance = async (instanceId: string) => {
    if (!automationConfig.whatsapp_template || !lead.phone) {
      toast.error("Telefone do lead ou template não configurado");
      return;
    }

    setSending(true);
    setError(null);
    setPopoverOpen(false);

    try {
      const message = replaceTemplateVariables(
        automationConfig.whatsapp_template,
        lead,
        stageName,
        pipelineName
      );

      await sendLoggedWhatsAppText({
        instanceId,
        phoneRaw: lead.phone,
        message,
        leadId: lead.id,
        leadName: lead.name,
        staffId: staffId || undefined,
      });

      // Mark activity as completed
      await supabase
        .from("crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activityId);

      toast.success("Mensagem enviada com sucesso!");
      onSuccess?.();
    } catch (err: any) {
      console.error("Error sending WhatsApp:", err);
      const msg = err?.message || "Erro ao enviar mensagem";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleClick = () => {
    if (instances.length === 0) {
      toast.error("Você não tem nenhuma instância WhatsApp autorizada para envio.");
      return;
    }
    if (instances.length === 1) {
      sendViaInstance(instances[0].id);
    } else {
      setPopoverOpen(true);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        Carregando...
      </Button>
    );
  }

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/50"
              onClick={handleClick}
            >
              <AlertCircle className="h-3.5 w-3.5 mr-1" />
              Tentar novamente
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Multiple instances: show popover selector
  if (instances.length > 1) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={sending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1" />
            )}
            Enviar
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="end">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
            Enviar por qual instância?
          </p>
          {instances.map((inst) => (
            <Button
              key={inst.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm font-normal"
              onClick={() => sendViaInstance(inst.id)}
            >
              <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
              {inst.instance_name}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  // Single or no instance
  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleClick}
      disabled={sending}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5 mr-1" />
      )}
      Enviar
    </Button>
  );
}
