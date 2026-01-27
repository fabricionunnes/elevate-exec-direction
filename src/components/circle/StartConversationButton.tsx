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

      // Check if conversation already exists between these two profiles
      const { data: existingParticipations } = await supabase
        .from("circle_conversation_participants")
        .select("conversation_id")
        .eq("profile_id", currentProfileId);

      if (existingParticipations && existingParticipations.length > 0) {
        // Check if target is in any of these conversations
        for (const p of existingParticipations) {
          const { data: targetParticipation } = await supabase
            .from("circle_conversation_participants")
            .select("id")
            .eq("conversation_id", p.conversation_id)
            .eq("profile_id", targetProfileId)
            .maybeSingle();

          if (targetParticipation) {
            // Conversation exists, navigate to it
            navigate(`/circle/messages?conversation=${p.conversation_id}`);
            return;
          }
        }
      }

      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from("circle_conversations")
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      // IMPORTANT: insert the current user first, then the target user.
      // RLS checks run per-row; inserting both at once can fail for the 2nd row
      // because membership isn't established yet.
      const { error: partSelfError } = await supabase
        .from("circle_conversation_participants")
        .insert({ conversation_id: newConversation.id, profile_id: currentProfileId });

      if (partSelfError) throw partSelfError;

      const { error: partTargetError } = await supabase
        .from("circle_conversation_participants")
        .insert({ conversation_id: newConversation.id, profile_id: targetProfileId });

      if (partTargetError) throw partTargetError;

      queryClient.invalidateQueries({ queryKey: ["circle-conversations"] });
      navigate(`/circle/messages?conversation=${newConversation.id}`);
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
