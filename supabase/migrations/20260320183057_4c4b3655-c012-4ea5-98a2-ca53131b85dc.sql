-- Add Google Calendar tracking fields to crm_activities
ALTER TABLE public.crm_activities 
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_calendar_user_id uuid DEFAULT NULL;

-- Create activity history/log table for tracking who scheduled/cancelled/rescheduled
CREATE TABLE IF NOT EXISTS public.crm_activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.crm_activities(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'scheduled', 'cancelled', 'rescheduled'
  performed_by_staff_id uuid REFERENCES public.onboarding_staff(id),
  old_scheduled_at timestamptz,
  new_scheduled_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.crm_activity_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert
CREATE POLICY "Authenticated users can read activity history"
  ON public.crm_activity_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert activity history"
  ON public.crm_activity_history FOR INSERT TO authenticated WITH CHECK (true);