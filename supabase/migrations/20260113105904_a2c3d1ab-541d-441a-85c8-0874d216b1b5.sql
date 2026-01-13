
-- Create table for stage actions (activities that should be created when lead enters a stage)
CREATE TABLE public.crm_stage_actions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    activity_title TEXT NOT NULL,
    activity_description TEXT,
    days_offset INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_stage_actions ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view
CREATE POLICY "Authenticated users can view stage actions"
ON public.crm_stage_actions
FOR SELECT
TO authenticated
USING (true);

-- Create policy for authenticated users to manage
CREATE POLICY "Authenticated users can manage stage actions"
ON public.crm_stage_actions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_crm_stage_actions_stage_id ON public.crm_stage_actions(stage_id);

-- Enable realtime for stage actions
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_stage_actions;
