-- Create table for detailed client activity logs
CREATE TABLE public.client_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_log_id UUID REFERENCES public.client_access_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'page_view', 'task_completed', 'task_created', 'meeting_scheduled', 'ticket_created', 'file_uploaded', 'note_added', 'form_submitted', etc.
  action_description TEXT NOT NULL,
  entity_type TEXT, -- 'task', 'meeting', 'ticket', 'file', 'note', 'form', 'page', etc.
  entity_id UUID,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  page_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_client_activity_logs_access_log ON public.client_activity_logs(access_log_id);
CREATE INDEX idx_client_activity_logs_user ON public.client_activity_logs(user_id);
CREATE INDEX idx_client_activity_logs_project ON public.client_activity_logs(project_id);
CREATE INDEX idx_client_activity_logs_created ON public.client_activity_logs(created_at DESC);
CREATE INDEX idx_client_activity_logs_action_type ON public.client_activity_logs(action_type);

-- Enable RLS
ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

-- Staff can view all activity logs
CREATE POLICY "Staff can view all activity logs"
ON public.client_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Staff can insert activity logs
CREATE POLICY "Staff can insert activity logs"
ON public.client_activity_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Clients can view their own activity logs
CREATE POLICY "Clients can view own activity logs"
ON public.client_activity_logs
FOR SELECT
USING (user_id = auth.uid());

-- Clients can insert their own activity logs
CREATE POLICY "Clients can insert own activity logs"
ON public.client_activity_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());