import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppMessage } from "./useWhatsAppMessages";
import { RealtimeChannel } from "@supabase/supabase-js";

export function useInstagramMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("instagram_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: true });

      if (error) throw error;

      // Map to WhatsAppMessage format
      const mapped: WhatsAppMessage[] = (data || []).map((m: any) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        content: m.is_reaction && m.reaction_emoji ? m.reaction_emoji : m.content,
        type: m.message_type === "photo" ? "image" : m.message_type || "text",
        direction: m.direction === "incoming" ? "inbound" : m.direction === "outgoing" ? "outbound" : m.direction,
        status: m.status || "sent",
        media_url: m.media_url,
        whatsapp_message_id: m.message_id,
        sent_by: m.sent_by,
        created_at: m.timestamp,
      }));

      setMessages(mapped);
    } catch (err) {
      console.error("Error fetching Instagram messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!conversationId) return;

    const channel: RealtimeChannel = supabase
      .channel(`ig-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instagram_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return {
    messages,
    loading,
    refetch: fetchMessages,
  };
}
