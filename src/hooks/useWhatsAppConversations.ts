import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface WhatsAppContact {
  id: string;
  phone: string;
  name: string | null;
  profile_picture_url: string | null;
}

export interface WhatsAppConversation {
  id: string;
  instance_id: string | null;
  contact_id: string;
  status: string;
  assigned_to: string | null;
  lead_id: string | null;
  sector_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  contact?: WhatsAppContact;
  assigned_staff?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

interface UseWhatsAppConversationsOptions {
  instanceId?: string | null;
  status?: string;
  assignedTo?: string | null;
}

export function useWhatsAppConversations(options: UseWhatsAppConversationsOptions = {}) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('crm_whatsapp_conversations')
        .select(`
          *,
          contact:crm_whatsapp_contacts(*),
          assigned_staff:onboarding_staff(id, name, avatar_url)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (options.instanceId) {
        query = query.eq('instance_id', options.instanceId);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.assignedTo) {
        query = query.eq('assigned_to', options.assignedTo);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setConversations(data || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    // Subscribe to realtime updates
    const channel: RealtimeChannel = supabase
      .channel('whatsapp_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_whatsapp_conversations',
        },
        (payload) => {
          console.log('Conversation change:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Fetch full conversation with contact
            fetchSingleConversation(payload.new.id).then((conv) => {
              if (conv) {
                setConversations((prev) => [conv, ...prev]);
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === payload.new.id) {
                  return { ...c, ...payload.new };
                }
                return c;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            setConversations((prev) =>
              prev.filter((c) => c.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.instanceId, options.status, options.assignedTo]);

  const fetchSingleConversation = async (id: string): Promise<WhatsAppConversation | null> => {
    const { data, error } = await supabase
      .from('crm_whatsapp_conversations')
      .select(`
        *,
        contact:crm_whatsapp_contacts(*),
        assigned_staff:onboarding_staff(id, name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching single conversation:', error);
      return null;
    }

    return data;
  };

  const updateConversation = async (id: string, updates: Partial<WhatsAppConversation>) => {
    const { error } = await supabase
      .from('crm_whatsapp_conversations')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  };

  const markAsRead = async (id: string) => {
    await updateConversation(id, { unread_count: 0 });
  };

  const assignToStaff = async (id: string, staffId: string | null) => {
    await updateConversation(id, { assigned_to: staffId });
  };

  const closeConversation = async (id: string) => {
    await updateConversation(id, { status: 'closed' });
  };

  const reopenConversation = async (id: string) => {
    await updateConversation(id, { status: 'open' });
  };

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
    updateConversation,
    markAsRead,
    assignToStaff,
    closeConversation,
    reopenConversation,
  };
}