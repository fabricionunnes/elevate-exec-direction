import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CrmTranscription {
  id: string;
  lead_id: string | null;
  meeting_event_id: string | null;
  project_id: string | null;
  title: string;
  transcription_text: string | null;
  summary: string | null;
  source: string;
  source_meeting_id: string | null;
  source_meeting_url: string | null;
  duration_seconds: number | null;
  language: string | null;
  speakers: { name?: string; id?: string }[];
  highlights: { text?: string; timestamp?: number }[];
  ai_analysis: string | null;
  status: string;
  error_message: string | null;
  recorded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    name: string;
    company: string | null;
  } | null;
  meeting_event?: {
    id: string;
    event_type: string;
    event_date: string;
  } | null;
}

interface UseCrmTranscriptionsOptions {
  leadId?: string;
  meetingEventId?: string;
  projectId?: string;
}

export function useCrmTranscriptions(options: UseCrmTranscriptionsOptions = {}) {
  const [transcriptions, setTranscriptions] = useState<CrmTranscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("crm_transcriptions")
        .select(`
          *,
          lead:crm_leads(id, name, company),
          meeting_event:crm_meeting_events(id, event_type, event_date)
        `)
        .order("recorded_at", { ascending: false });

      if (options.leadId) {
        query = query.eq("lead_id", options.leadId);
      }

      if (options.meetingEventId) {
        query = query.eq("meeting_event_id", options.meetingEventId);
      }

      if (options.projectId) {
        query = query.eq("project_id", options.projectId);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      // Parse JSONB fields
      const parsed = (data || []).map((t) => ({
        ...t,
        speakers: Array.isArray(t.speakers) ? t.speakers : [],
        highlights: Array.isArray(t.highlights) ? t.highlights : [],
      }));

      setTranscriptions(parsed as CrmTranscription[]);
    } catch (err) {
      console.error("Error fetching transcriptions:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar transcrições");
    } finally {
      setLoading(false);
    }
  }, [options.leadId, options.meetingEventId, options.projectId]);

  useEffect(() => {
    fetchTranscriptions();
  }, [fetchTranscriptions]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("crm_transcriptions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_transcriptions",
        },
        () => {
          fetchTranscriptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTranscriptions]);

  const deleteTranscription = async (id: string) => {
    try {
      const { error } = await supabase
        .from("crm_transcriptions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTranscriptions((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transcrição excluída");
    } catch (err) {
      console.error("Error deleting transcription:", err);
      toast.error("Erro ao excluir transcrição");
    }
  };

  const createTranscription = async (data: {
    lead_id?: string | null;
    meeting_event_id?: string | null;
    project_id?: string | null;
    title: string;
    transcription_text?: string | null;
    summary?: string | null;
    source?: string;
    duration_seconds?: number | null;
    status?: string;
    recorded_at?: string | null;
  }) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data: newTranscription, error } = await supabase
        .from("crm_transcriptions")
        .insert({
          lead_id: data.lead_id || null,
          meeting_event_id: data.meeting_event_id || null,
          project_id: data.project_id || null,
          title: data.title,
          transcription_text: data.transcription_text || null,
          summary: data.summary || null,
          source: data.source || "manual",
          duration_seconds: data.duration_seconds || null,
          status: data.status || "completed",
          recorded_at: data.recorded_at || null,
          created_by: session?.session?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTranscriptions();
      toast.success("Transcrição salva com sucesso");
      return newTranscription;
    } catch (err) {
      console.error("Error creating transcription:", err);
      toast.error("Erro ao salvar transcrição");
      throw err;
    }
  };

  return {
    transcriptions,
    loading,
    error,
    refetch: fetchTranscriptions,
    deleteTranscription,
    createTranscription,
  };
}
