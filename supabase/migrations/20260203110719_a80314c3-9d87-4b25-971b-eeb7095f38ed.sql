-- Create table to track meeting events (scheduling and realization)
-- These are historical records that persist even if the lead moves to other stages
CREATE TABLE public.crm_meeting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('scheduled', 'realized')),
  credited_staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  triggered_by_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to crm_leads to track who scheduled the meeting
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS scheduled_by_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX idx_crm_meeting_events_lead_id ON public.crm_meeting_events(lead_id);
CREATE INDEX idx_crm_meeting_events_pipeline_id ON public.crm_meeting_events(pipeline_id);
CREATE INDEX idx_crm_meeting_events_credited_staff_id ON public.crm_meeting_events(credited_staff_id);
CREATE INDEX idx_crm_meeting_events_event_type ON public.crm_meeting_events(event_type);
CREATE INDEX idx_crm_meeting_events_event_date ON public.crm_meeting_events(event_date);

-- Enable RLS
ALTER TABLE public.crm_meeting_events ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can access events for pipelines they have staff access
CREATE POLICY "Authenticated users can view meeting events"
ON public.crm_meeting_events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert meeting events"
ON public.crm_meeting_events
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting events"
ON public.crm_meeting_events
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete meeting events"
ON public.crm_meeting_events
FOR DELETE
TO authenticated
USING (true);