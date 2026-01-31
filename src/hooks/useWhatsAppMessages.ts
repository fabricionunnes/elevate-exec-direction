import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  remote_id: string | null;
  content: string | null;
  type: string;
  direction: 'inbound' | 'outbound';
  status: string;
  media_url: string | null;
  media_mimetype: string | null;
  quoted_message_id: string | null;
  sent_by: string | null;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export function useWhatsAppMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('crm_whatsapp_messages')
        .select(`
          *,
          sender:onboarding_staff(id, name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Cast direction to the expected type
      const typedData = (data || []).map(msg => ({
        ...msg,
        direction: msg.direction as 'inbound' | 'outbound',
      }));

      setMessages(typedData);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();

    if (!conversationId) return;

    // Subscribe to realtime updates for this conversation
    const channel: RealtimeChannel = supabase
      .channel(`whatsapp_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('Message change:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Check if message already exists (optimistic update may have added it)
            setMessages((prev) => {
              const exists = prev.some(m => m.id === payload.new.id);
              if (exists) return prev;
              
              // Cast and format the realtime payload
              const newMsg = {
                ...payload.new,
                direction: payload.new.direction as 'inbound' | 'outbound',
              } as WhatsAppMessage;
              
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === payload.new.id) {
                  return { 
                    ...m, 
                    ...payload.new,
                    direction: payload.new.direction as 'inbound' | 'outbound',
                  };
                }
                return m;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter((m) => m.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  const sendMessage = async (
    content: string,
    instanceId: string,
    contactPhone: string,
    staffId?: string
  ) => {
    if (!conversationId || !content.trim()) return;

    setSending(true);
    try {
      // First, insert the message in the database with pending status
      const { data: newMessage, error: insertError } = await supabase
        .from('crm_whatsapp_messages')
        .insert({
          conversation_id: conversationId,
          content: content.trim(),
          type: 'text',
          direction: 'outbound',
          status: 'pending',
          sent_by: staffId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Optimistically add the message to local state immediately
      const optimisticMessage: WhatsAppMessage = {
        id: newMessage.id,
        conversation_id: newMessage.conversation_id,
        remote_id: newMessage.remote_id,
        content: newMessage.content,
        type: newMessage.type,
        direction: 'outbound',
        status: 'pending',
        media_url: newMessage.media_url,
        media_mimetype: newMessage.media_mimetype,
        quoted_message_id: newMessage.quoted_message_id,
        sent_by: newMessage.sent_by,
        created_at: newMessage.created_at,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      // Then, send via Evolution API
      const { error: sendError } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'sendText',
          instanceId,
          phone: contactPhone,
          message: content.trim(),
        },
      });

      if (sendError) {
        // Update message status to failed
        await supabase
          .from('crm_whatsapp_messages')
          .update({ status: 'failed' })
          .eq('id', newMessage.id);
        throw sendError;
      }

      // Update message status to sent
      await supabase
        .from('crm_whatsapp_messages')
        .update({ status: 'sent' })
        .eq('id', newMessage.id);

      // Update conversation
      await supabase
        .from('crm_whatsapp_conversations')
        .update({
          last_message: content.trim(),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    refetch: fetchMessages,
  };
}