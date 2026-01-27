import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface StartConversationButtonProps {
  currentProfileId: string;
  targetProfileId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function StartConversationButton({
  currentProfileId,
  targetProfileId,
  variant = "outline",
  size = "default",
}: StartConversationButtonProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const startConversation = async () => {
    setIsLoading(true);
    try {
      // Ensure user is authenticated (RLS will block inserts otherwise)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Você precisa estar logado para enviar mensagens",
          variant: "destructive",
        });
        return;
      }

      // Start/reuse conversation via backend function (avoids RLS edge cases)
      const { data: conversationId, error: rpcError } = await supabase.rpc(
        "circle_start_conversation",
        {
          current_profile_id: currentProfileId,
          target_profile_id: targetProfileId,
        },
      );

      if (rpcError) throw rpcError;
      if (!conversationId) throw new Error("Não foi possível iniciar a conversa");

      queryClient.invalidateQueries({ queryKey: ["circle-conversations"] });
      navigate(`/circle/messages?conversation=${conversationId}`);
    } catch (error) {
      console.error("Error starting conversation:", error);
      const message =
        (error as any)?.message ||
        (error as any)?.error_description ||
        (error as any)?.hint ||
        "Erro inesperado";
      toast({
        title: "Erro ao iniciar conversa",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={startConversation}
      disabled={isLoading}
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      {isLoading ? "Abrindo..." : "Mensagem"}
    </Button>
  );
}
