import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare, Loader2 } from "lucide-react";
import { WhatsAppMessageDialog } from "./WhatsAppMessageDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WhatsAppSendButtonProps {
  phone: string;
  recipientName?: string;
  companyId?: string;
  projectId?: string;
  variant?: "icon" | "button" | "ghost";
  defaultMessage?: string;
  className?: string;
}

export const WhatsAppSendButton = ({
  phone,
  recipientName,
  companyId,
  projectId,
  variant = "icon",
  defaultMessage,
  className,
}: WhatsAppSendButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasInstance, setHasInstance] = useState<boolean | null>(null);

  // Clean phone number
  const cleanPhone = phone?.replace(/\D/g, "") || "";
  const isValidPhone = cleanPhone.length >= 10;

  const checkInstance = async () => {
    if (hasInstance !== null) return hasInstance;
    
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("is_default", true)
      .eq("status", "connected")
      .single();
    
    const hasDefault = !!data;
    setHasInstance(hasDefault);
    return hasDefault;
  };

  const handleClick = async () => {
    if (!isValidPhone) {
      toast.error("Telefone inválido");
      return;
    }

    const hasDefaultInstance = await checkInstance();
    if (!hasDefaultInstance) {
      toast.error("Nenhuma instância WhatsApp conectada. Configure em WhatsApp Admin.");
      return;
    }

    setShowDialog(true);
  };

  const handleSend = async (message: string) => {
    setSending(true);
    try {
      // Get default instance
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name")
        .eq("is_default", true)
        .eq("status", "connected")
        .single();

      if (!instance) {
        throw new Error("Nenhuma instância conectada");
      }

      // Get current staff
      const { data: { user } } = await supabase.auth.getUser();
      let staffId: string | null = null;
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .single();
        staffId = staff?.id || null;
      }

      // Send via Evolution API
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          instanceName: instance.instance_name,
          number: cleanPhone,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Log message
      await supabase
        .from("whatsapp_message_log")
        .insert({
          instance_id: instance.id,
          phone_number: cleanPhone,
          message,
          message_type: "text",
          status: "sent",
          company_id: companyId || null,
          project_id: projectId || null,
          sent_by: staffId,
        });

      toast.success("Mensagem enviada com sucesso!");
      setShowDialog(false);
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  if (!isValidPhone) {
    return null;
  }

  const buttonContent = (
    <>
      {sending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      {variant === "button" && <span className="ml-2">WhatsApp</span>}
    </>
  );

  return (
    <>
      {variant === "icon" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={sending}
              className={`h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 ${className}`}
            >
              {buttonContent}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enviar WhatsApp</p>
          </TooltipContent>
        </Tooltip>
      ) : variant === "ghost" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={sending}
          className={`text-green-600 hover:text-green-700 hover:bg-green-50 ${className}`}
        >
          {buttonContent}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={sending}
          className={`text-green-600 border-green-200 hover:bg-green-50 ${className}`}
        >
          {buttonContent}
        </Button>
      )}

      {showDialog && (
        <WhatsAppMessageDialog
          phone={cleanPhone}
          recipientName={recipientName}
          defaultMessage={defaultMessage}
          onClose={() => setShowDialog(false)}
          onSend={handleSend}
          sending={sending}
        />
      )}
    </>
  );
};
