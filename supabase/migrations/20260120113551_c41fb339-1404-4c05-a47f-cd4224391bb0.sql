-- Create table for tracking client access sessions
CREATE TABLE public.client_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  logout_at TIMESTAMP WITH TIME ZONE,
  session_duration_minutes INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy for staff to view all access logs
CREATE POLICY "Staff can view all access logs"
ON public.client_access_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid()
  )
);

-- Policy for clients to view their own access logs
CREATE POLICY "Clients can view own access logs"
ON public.client_access_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy for inserting access logs (authenticated users)
CREATE POLICY "Authenticated users can insert access logs"
ON public.client_access_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Policy for updating access logs (own records only)
CREATE POLICY "Users can update own access logs"
ON public.client_access_logs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_client_access_logs_user_id ON public.client_access_logs(user_id);
CREATE INDEX idx_client_access_logs_project_id ON public.client_access_logs(project_id);
CREATE INDEX idx_client_access_logs_company_id ON public.client_access_logs(company_id);
CREATE INDEX idx_client_access_logs_login_at ON public.client_access_logs(login_at DESC);