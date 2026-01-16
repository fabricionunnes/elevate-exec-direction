
-- Create table for client referrals/indications
CREATE TABLE public.client_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  referrer_project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  referrer_name TEXT,
  referred_name TEXT NOT NULL,
  referred_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'negotiating', 'closed', 'not_closed')),
  reward_value DECIMAL(10,2) DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'nps' CHECK (source IN ('nps', 'portal')),
  nps_response_id UUID REFERENCES public.onboarding_nps_responses(id) ON DELETE SET NULL,
  notes TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_referrals ENABLE ROW LEVEL SECURITY;

-- Policy for staff to manage all referrals
CREATE POLICY "Staff can manage all referrals" 
ON public.client_referrals 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid()
  )
);

-- Policy for clients to view their own referrals via onboarding_users -> project -> company
CREATE POLICY "Clients can view their referrals" 
ON public.client_referrals 
FOR SELECT 
USING (
  referrer_company_id IN (
    SELECT p.onboarding_company_id 
    FROM public.onboarding_users u
    JOIN public.onboarding_projects p ON p.id = u.project_id
    WHERE u.user_id = auth.uid()
  )
);

-- Policy for clients to insert their own referrals
CREATE POLICY "Clients can create referrals" 
ON public.client_referrals 
FOR INSERT 
WITH CHECK (
  referrer_company_id IN (
    SELECT p.onboarding_company_id 
    FROM public.onboarding_users u
    JOIN public.onboarding_projects p ON p.id = u.project_id
    WHERE u.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_client_referrals_updated_at
BEFORE UPDATE ON public.client_referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_referrals;
