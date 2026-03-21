import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientConversation {
  id: string;
  channel: "whatsapp" | "instagram";
  contact_name: string | null;
  contact_username: string | null;
  contact_phone: string | null;
  contact_picture: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  instance_id: string | null;
}

export interface ClientMessage {
  id: string;
  content: string | null;
  direction: string;
  message_type: string;
  media_url: string | null;
  timestamp: string;
  status: string | null;
  is_reaction?: boolean;
  reaction_emoji?: string | null;
  story_url?: string | null;
}

export function useClientCRMConversations(projectId: string) {
  const [conversations, setConversations] = useState<ClientConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      // Get Instagram instances for this project
      const { data: igInstances } = await supabase
        .from("instagram_instances")
        .select("id")
        .eq("project_id", projectId)
        .eq("status", "connected");

      const igInstanceIds = (igInstances || []).map((i: any) => i.id);

      const allConversations: ClientConversation[] = [];

      // Fetch Instagram conversations
      if (igInstanceIds.length > 0) {
        const { data: igConvs } = await supabase
          .from("instagram_conversations")
          .select("*, contact:instagram_contacts(id, name, username, profile_picture_url, instagram_user_id)")
          .in("instance_id", igInstanceIds)
          .order("last_message_at", { ascending: false });

        for (const conv of igConvs || []) {
          const contact = conv.contact as any;
          allConversations.push({
            id: conv.id,
            channel: "instagram",
            contact_name: contact?.name || contact?.username || "Desconhecido",
            contact_username: contact?.username || null,
            contact_phone: null,
            contact_picture: contact?.profile_picture_url || null,
            last_message: conv.last_message,
            last_message_at: conv.last_message_at,
            unread_count: conv.unread_count || 0,
            status: conv.status,
            instance_id: conv.instance_id,
          });
        }
      }

      // Sort by last message time
      allConversations.sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return dateB - dateA;
      });

      setConversations(allConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchConversations();
  }, [projectId, fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}

export function useClientCRMMessages(conversationId: string | null, channel: "whatsapp" | "instagram" | null) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !channel) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      if (channel === "instagram") {
        const { data } = await supabase
          .from("instagram_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("timestamp", { ascending: true });

        setMessages(
          (data || []).map((m: any) => ({
            id: m.id,
            content: m.content,
            direction: m.direction,
            message_type: m.message_type,
            media_url: m.media_url,
            timestamp: m.timestamp,
            status: m.status,
            is_reaction: m.is_reaction,
            reaction_emoji: m.reaction_emoji,
            story_url: m.story_url,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, channel]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for Instagram messages
  useEffect(() => {
    if (!conversationId || channel !== "instagram") return;

    const sub = supabase
      .channel(`ig-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instagram_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) => [
            ...prev,
            {
              id: m.id,
              content: m.content,
              direction: m.direction,
              message_type: m.message_type,
              media_url: m.media_url,
              timestamp: m.timestamp,
              status: m.status,
              is_reaction: m.is_reaction,
              reaction_emoji: m.reaction_emoji,
              story_url: m.story_url,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [conversationId, channel]);

  return { messages, loading, refetch: fetchMessages };
}
