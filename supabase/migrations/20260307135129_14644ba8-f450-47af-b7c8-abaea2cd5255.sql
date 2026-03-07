-- Drop the trigger that enforces unique main goal per scope
-- This allows multiple KPIs to be marked as main goal within the same scope
DROP TRIGGER IF EXISTS ensure_unique_main_goal_per_scope_trigger ON public.company_kpis;

-- Keep the function but modify it to only normalize empty strings (remove the unset logic)
CREATE OR REPLACE FUNCTION public.ensure_unique_main_goal_per_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Normalize empty strings to NULL before insert/update
  IF NEW.sector_id IS NOT NULL AND NEW.sector_id::text = '' THEN
    NEW.sector_id := NULL;
  END IF;
  IF NEW.team_id IS NOT NULL AND NEW.team_id::text = '' THEN
    NEW.team_id := NULL;
  END IF;
  IF NEW.unit_id IS NOT NULL AND NEW.unit_id::text = '' THEN
    NEW.unit_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Re-create the trigger with just the normalization logic
CREATE TRIGGER ensure_unique_main_goal_per_scope_trigger
  BEFORE INSERT OR UPDATE ON public.company_kpis
  FOR EACH ROW
  EXECUTE FUNCTION ensure_unique_main_goal_per_scope();