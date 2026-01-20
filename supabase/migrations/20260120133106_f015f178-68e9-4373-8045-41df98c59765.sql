-- Add is_main_goal flag to company_kpis
ALTER TABLE public.company_kpis 
ADD COLUMN IF NOT EXISTS is_main_goal BOOLEAN DEFAULT false;

-- Ensure only one KPI can be marked as main goal per company
CREATE OR REPLACE FUNCTION ensure_single_main_goal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_main_goal = true THEN
    UPDATE public.company_kpis 
    SET is_main_goal = false 
    WHERE company_id = NEW.company_id 
      AND id != NEW.id 
      AND is_main_goal = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_main_goal_trigger ON public.company_kpis;

CREATE TRIGGER ensure_single_main_goal_trigger
BEFORE INSERT OR UPDATE ON public.company_kpis
FOR EACH ROW
EXECUTE FUNCTION ensure_single_main_goal();