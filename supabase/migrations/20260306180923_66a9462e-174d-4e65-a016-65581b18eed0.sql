
ALTER TABLE public.onboarding_companies 
  ADD COLUMN IF NOT EXISTS is_billing_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_blocked_reason text;
