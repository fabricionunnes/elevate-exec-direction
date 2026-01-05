-- Add status_changed_at column to track when status was last changed
ALTER TABLE public.onboarding_companies 
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;

-- Create trigger function to automatically set status_changed_at when status changes
CREATE OR REPLACE FUNCTION public.update_company_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_company_status_changed_at ON public.onboarding_companies;
CREATE TRIGGER trigger_update_company_status_changed_at
  BEFORE UPDATE ON public.onboarding_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_company_status_changed_at();