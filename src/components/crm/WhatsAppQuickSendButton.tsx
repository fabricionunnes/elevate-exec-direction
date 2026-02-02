import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  pipelineName?: string
): string {
  return template
    .replace(/{nome}/g, lead.name || '')
    .replace(/{empresa}/g, lead.company || '')
    .replace(/{email}/g, lead.email || '')
    .replace(/{telefone}/g, lead.phone || '')
    .replace(/{etapa}/g, stageName || '')
    .replace(/{funil}/g, pipelineName || '');
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

  const handleSend = async () => {
    if (!automationConfig.whatsapp_template || !lead.phone) {
      toast.error("Telefone do lead ou template não configurado");
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Get current staff's WhatsApp instance
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Get staff ID
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff) {
        throw new Error("Staff não encontrado");
      }

      // Get linked WhatsApp instance
      const { data: staffDevice } = await supabase
        .from("crm_service_staff_devices")
        .select(`
          instance_id,
          whatsapp_instances!inner(id, instance_name, status, api_endpoint, api_key)
        `)
        .eq("staff_id", staff.id)
        .maybeSingle();

      if (!staffDevice) {
        setError("Você não tem uma instância WhatsApp vinculada");
        toast.error("Você não tem uma instância WhatsApp vinculada. Vá em Configurações > Vinculação de dispositivos.");
        return;
      }

      const instance = staffDevice.whatsapp_instances as any;
      if (instance.status !== "connected") {
        setError("Instância WhatsApp desconectada");
        toast.error("Sua instância WhatsApp está desconectada. Reconecte-a antes de enviar.");
        return;
      }

      // Prepare message with replaced variables
      const message = replaceTemplateVariables(
        automationConfig.whatsapp_template,
        lead,
        stageName,
        pipelineName
      );

      // Format phone number (ensure it's in WhatsApp format)
      const phone = lead.phone.replace(/\D/g, '');
      const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
      const remoteJid = `${formattedPhone}@s.whatsapp.net`;

      // Send message via Evolution API
      const response = await fetch(`${instance.api_endpoint}/message/sendText/${instance.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.api_key,
        },
        body: JSON.stringify({
          number: remoteJid,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao enviar mensagem");
      }

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
      setError(err.message);
      toast.error(err.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/50"
              onClick={handleSend}
            >
              <AlertCircle className="h-3.5 w-3.5 mr-1" />
              Erro
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleSend}
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
