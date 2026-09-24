import { useState, useEffect, useCallback, useRef } from "react";
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
  is_ai?: boolean | null;
  sender_name: string | null;
  sender_phone: string | null;
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
  // conversa já carregada: mensagens novas entram sem apagar a tela
  const loadedFor = useRef<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);

  // Conversa de grupo antiga chega a 20 mil mensagens: puxar tudo de uma vez travava a
  // tela por dezenas de segundos. Abre com as últimas e busca as antigas sob demanda.
  const LOTE_MSGS = 200;
  const [temMaisAntigas, setTemMaisAntigas] = useState(false);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setTemMaisAntigas(false);
      setLoading(false);
      return;
    }

    try {
      if (loadedFor.current !== (conversationId || null)) setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('crm_whatsapp_messages')
        .select(`
          *,
          sender:onboarding_staff(id, name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(LOTE_MSGS);

      if (fetchError) throw fetchError;

      // veio do mais novo pro mais antigo; a tela mostra na ordem do tempo
      const typedData = (data || []).map(msg => ({
        ...msg,
        direction: msg.direction as 'inbound' | 'outbound',
      })).reverse();

      setMessages(typedData);
      setTemMaisAntigas((data || []).length >= LOTE_MSGS);

      loadedFor.current = conversationId || null;
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const carregarAntigas = useCallback(async () => {
    if (!conversationId || carregandoAntigas) return;
    setCarregandoAntigas(true);
    try {
      const maisAntiga = messages[0]?.created_at;
      let q = supabase
        .from('crm_whatsapp_messages')
        .select(`
          *,
          sender:onboarding_staff(id, name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(LOTE_MSGS);
      if (maisAntiga) q = q.lt('created_at', maisAntiga);
      const { data, error: fetchError } = await q;
      if (fetchError) throw fetchError;

      const antigas = (data || []).map(msg => ({
        ...msg,
        direction: msg.direction as 'inbound' | 'outbound',
      })).reverse();

      setMessages((prev) => {
        const vistos = new Set(prev.map((m) => m.id));
        return [...antigas.filter((m: any) => !vistos.has(m.id)), ...prev] as any;
      });
      setTemMaisAntigas((data || []).length >= LOTE_MSGS);
    } catch (err) {
      console.error('Error fetching older messages:', err);
    } finally {
      setCarregandoAntigas(false);
    }
  }, [conversationId, messages, carregandoAntigas]);

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
          const payloadNew = payload.new as Record<string, any>;
          const payloadOld = payload.old as Record<string, any>;
          console.log('Message realtime event:', payload.eventType, payloadNew?.id || payloadOld?.id);
          
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              const exists = prev.some(m => m.id === payloadNew.id);
              if (exists) {
                console.log('Message already exists, skipping:', payloadNew.id);
                return prev;
              }
              
              const newMsg = {
                ...payloadNew,
                direction: payloadNew.direction as 'inbound' | 'outbound',
              } as WhatsAppMessage;
              
              console.log('Adding message via realtime:', newMsg.id, newMsg.direction, newMsg.content?.substring(0, 20));
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            console.log('Updating message status:', payloadNew.id, '->', payloadNew.status);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === payloadNew.id) {
                  return { 
                    ...m, 
                    ...payloadNew,
                    direction: payloadNew.direction as 'inbound' | 'outbound',
                  };
                }
                return m;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter((m) => m.id !== payloadOld.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status, 'for conversation:', conversationId);
        // When subscription reconnects after timeout, refetch to catch missed messages
        if (status === 'SUBSCRIBED') {
          // Small delay to ensure we don't refetch immediately on initial subscribe
          setTimeout(() => {
            fetchMessages();
          }, 500);
        }
        // Handle channel errors by attempting to refetch
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error, refetching messages...');
          setTimeout(() => {
            fetchMessages();
          }, 1000);
        }
      });

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
      const { data: sendData, error: sendError } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'sendText',
          instanceId,
          phone: contactPhone,
          message: content.trim(),
        },
      });

      // Extract remote_id from Evolution API response
      const remoteId = sendData?.key?.id;

      if (sendError) {
        // Update message status to failed
        await supabase
          .from('crm_whatsapp_messages')
          .update({ status: 'failed' })
          .eq('id', newMessage.id);
        throw sendError;
      }

      // Update message status to sent and store remote_id for status tracking
      await supabase
        .from('crm_whatsapp_messages')
        .update({ 
          status: 'sent',
          remote_id: remoteId || null 
        })
        .eq('id', newMessage.id);

      // Update optimistic message with remote_id
      if (remoteId) {
        setMessages((prev) =>
          prev.map((m) => 
            m.id === newMessage.id 
              ? { ...m, status: 'sent', remote_id: remoteId } 
              : m
          )
        );
      }

      // Update conversation
      await supabase
        .from('crm_whatsapp_conversations')
        .update({
          last_message: content.trim(),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      // Force refetch to ensure message appears even if realtime is broken
      await fetchMessages();

    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  const sendMedia = async (
    file: File,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    instanceId: string,
    contactPhone: string,
    staffId?: string,
    caption?: string
  ) => {
    if (!conversationId) return;

    setSending(true);
    try {
      // Upload file to Supabase storage first
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `outbound/${mediaType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePath);

      const mediaUrl = urlData.publicUrl;

      // Determine content label
      const contentLabels: Record<string, string> = {
        image: '[Imagem]',
        video: '[Vídeo]',
        audio: '[Áudio]',
        document: file.name,
      };
      const content = caption || contentLabels[mediaType];

      // Insert message in database
      const { data: newMessage, error: insertError } = await supabase
        .from('crm_whatsapp_messages')
        .insert({
          conversation_id: conversationId,
          content,
          type: mediaType,
          direction: 'outbound',
          status: 'pending',
          sent_by: staffId,
          media_url: mediaUrl,
          media_mimetype: file.type,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Optimistic update
      const optimisticMessage: WhatsAppMessage = {
        id: newMessage.id,
        conversation_id: newMessage.conversation_id,
        remote_id: null,
        content,
        type: mediaType,
        direction: 'outbound',
        status: 'pending',
        media_url: mediaUrl,
        media_mimetype: file.type,
        quoted_message_id: null,
        sent_by: staffId || null,
        created_at: newMessage.created_at,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      // Send via Evolution API
      const { data: sendData, error: sendError } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'sendMedia',
          instanceId,
          phone: contactPhone,
          mediaType,
          mediaUrl,
          caption: caption || '',
          fileName: file.name,
        },
      });

      const remoteId = sendData?.key?.id;

      if (sendError) {
        await supabase
          .from('crm_whatsapp_messages')
          .update({ status: 'failed' })
          .eq('id', newMessage.id);
        throw sendError;
      }

      // Update status
      await supabase
        .from('crm_whatsapp_messages')
        .update({ 
          status: 'sent',
          remote_id: remoteId || null,
        })
        .eq('id', newMessage.id);

      if (remoteId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === newMessage.id
              ? { ...m, status: 'sent', remote_id: remoteId }
              : m
          )
        );
      }

      // Update conversation
      await supabase
        .from('crm_whatsapp_conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      // Force refetch to ensure message appears even if realtime is broken
      await fetchMessages();

    } catch (err) {
      console.error('Error sending media:', err);
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
    sendMedia,
    refetch: fetchMessages,
    temMaisAntigas,
    carregandoAntigas,
    carregarAntigas,
  };
}