import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConversation } from "./useWhatsAppConversations";
import { RealtimeChannel } from "@supabase/supabase-js";

export function useInstagramConversations() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("instagram_conversations")
        .select(`
          *,
          contact:instagram_contacts(id, instagram_user_id, name, username, profile_picture_url),
          assigned_staff:onboarding_staff(id, name, avatar_url)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Map Instagram conversations to the WhatsAppConversation format
      const mapped: WhatsAppConversation[] = (data || []).map((conv: any) => ({
        id: conv.id,
        instance_id: null,
        official_instance_id: null,
        instagram_instance_id: conv.instance_id,
        contact_id: conv.contact_id,
        status: conv.status || "open",
        assigned_to: conv.assigned_to,
        lead_id: conv.lead_id,
        sector_id: null,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        unread_count: conv.unread_count || 0,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        channel: "instagram" as const,
        contact: conv.contact ? {
          id: conv.contact.id,
          phone: conv.contact.username || conv.contact.instagram_user_id,
          name: conv.contact.name || (conv.contact.username ? `@${conv.contact.username}` : null),
          profile_picture_url: conv.contact.profile_picture_url,
        } : undefined,
        assigned_staff: conv.assigned_staff,
      }));

      setConversations(mapped);
    } catch (err) {
      console.error("Error fetching Instagram conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    // Realtime subscription
    const channel: RealtimeChannel = supabase
      .channel("instagram_conversations_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "instagram_conversations",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string) => {
    await supabase
      .from("instagram_conversations")
      .update({ unread_count: 0 })
      .eq("id", id);
  };

  return {
    conversations,
    loading,
    refetch: fetchConversations,
    markAsRead,
  };
}
