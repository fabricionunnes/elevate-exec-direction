-- Create table for Mastermind applications
CREATE TABLE public.mastermind_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Section 1: Applicant Data
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  role_other TEXT,
  
  -- Section 2: Company Info
  monthly_revenue TEXT NOT NULL,
  company_age TEXT NOT NULL,
  employees_count INTEGER NOT NULL,
  salespeople_count INTEGER NOT NULL,
  
  -- Section 3: Moment and Challenges
  main_challenge TEXT NOT NULL,
  upcoming_decision TEXT NOT NULL,
  energy_drain TEXT NOT NULL,
  feels_alone TEXT NOT NULL,
  
  -- Section 4: Maturity and Posture
  willing_to_share_numbers BOOLEAN NOT NULL,
  reaction_to_confrontation TEXT NOT NULL,
  contribution_to_group TEXT NOT NULL,
  validation_or_confrontation TEXT NOT NULL,
  
  -- Section 5: Availability and Commitment
  available_for_meetings BOOLEAN NOT NULL,
  understands_mansion_costs BOOLEAN NOT NULL,
  agrees_confidentiality BOOLEAN NOT NULL,
  
  -- Section 6: Investment and Expectation
  aware_of_investment BOOLEAN NOT NULL,
  why_right_moment TEXT NOT NULL,
  success_definition TEXT NOT NULL,
  
  -- Section 7: Final Declaration
  is_decision_maker BOOLEAN NOT NULL DEFAULT false,
  understands_not_operational BOOLEAN NOT NULL DEFAULT false,
  understands_may_be_refused BOOLEAN NOT NULL DEFAULT false,
  commits_confidentiality BOOLEAN NOT NULL DEFAULT false,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.mastermind_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit application
CREATE POLICY "Anyone can submit mastermind application"
ON public.mastermind_applications
FOR INSERT
WITH CHECK (true);

-- Only admins can read applications
CREATE POLICY "Admins can read mastermind applications"
ON public.mastermind_applications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update applications
CREATE POLICY "Admins can update mastermind applications"
ON public.mastermind_applications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));