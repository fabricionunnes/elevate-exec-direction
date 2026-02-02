-- Add action mode and configuration columns to crm_stage_actions
ALTER TABLE public.crm_stage_actions 
ADD COLUMN IF NOT EXISTS action_mode TEXT DEFAULT 'task',
ADD COLUMN IF NOT EXISTS whatsapp_template TEXT,
ADD COLUMN IF NOT EXISTS meeting_staff_id UUID REFERENCES public.onboarding_staff(id),
ADD COLUMN IF NOT EXISTS meeting_duration_minutes INTEGER DEFAULT 60;

-- Add automation tracking columns to crm_activities
ALTER TABLE public.crm_activities 
ADD COLUMN IF NOT EXISTS is_automation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS automation_config JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.crm_stage_actions.action_mode IS 'Type of action: task, whatsapp_send, or schedule_meeting';
COMMENT ON COLUMN public.crm_stage_actions.whatsapp_template IS 'Template message for WhatsApp with variables like {nome}, {empresa}';
COMMENT ON COLUMN public.crm_stage_actions.meeting_staff_id IS 'Default staff member for meeting scheduling';
COMMENT ON COLUMN public.crm_stage_actions.meeting_duration_minutes IS 'Default duration for scheduled meetings';
COMMENT ON COLUMN public.crm_activities.is_automation IS 'Whether this activity was created by stage automation';
COMMENT ON COLUMN public.crm_activities.automation_config IS 'Configuration data for automated activities (template, staff_id, etc)';