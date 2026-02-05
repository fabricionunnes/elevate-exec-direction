-- Create CRM transcriptions table
CREATE TABLE public.crm_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  meeting_event_id UUID REFERENCES public.crm_meeting_events(id) ON DELETE SET NULL,
  project_id UUID,
  title TEXT NOT NULL,
  transcription_text TEXT,
  summary TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_meeting_id TEXT,
  source_meeting_url TEXT,
  duration_seconds INTEGER,
  language TEXT DEFAULT 'pt-BR',
  speakers JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  ai_analysis TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  recorded_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_transcriptions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_crm_transcriptions_lead_id ON public.crm_transcriptions(lead_id);
CREATE INDEX idx_crm_transcriptions_meeting_event_id ON public.crm_transcriptions(meeting_event_id);
CREATE INDEX idx_crm_transcriptions_project_id ON public.crm_transcriptions(project_id);
CREATE INDEX idx_crm_transcriptions_source ON public.crm_transcriptions(source);
CREATE INDEX idx_crm_transcriptions_status ON public.crm_transcriptions(status);
CREATE INDEX idx_crm_transcriptions_recorded_at ON public.crm_transcriptions(recorded_at DESC);

-- RLS Policies using existing CRM functions
CREATE POLICY "CRM users can view transcriptions"
ON public.crm_transcriptions
FOR SELECT
USING (has_crm_access());

CREATE POLICY "CRM users can insert transcriptions"
ON public.crm_transcriptions
FOR INSERT
WITH CHECK (has_crm_access());

CREATE POLICY "CRM users can update transcriptions"
ON public.crm_transcriptions
FOR UPDATE
USING (has_crm_access());

CREATE POLICY "CRM admins can delete transcriptions"
ON public.crm_transcriptions
FOR DELETE
USING (is_crm_admin());

-- Trigger for updated_at
CREATE TRIGGER update_crm_transcriptions_updated_at
BEFORE UPDATE ON public.crm_transcriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_transcriptions;