-- Drop the old trigger that enforced single main goal per company
DROP TRIGGER IF EXISTS ensure_single_main_goal_trigger ON public.company_kpis;
DROP FUNCTION IF EXISTS ensure_single_main_goal();

-- Create new function that allows multiple main goals if they have different scope combinations
-- The uniqueness is now per: company_id + scope + sector_id + team_id + unit_id
CREATE OR REPLACE FUNCTION ensure_unique_main_goal_per_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_main_goal = true THEN
    -- Unset other main goals that have the SAME scope combination
    UPDATE public.company_kpis 
    SET is_main_goal = false 
    WHERE company_id = NEW.company_id 
      AND id != NEW.id 
      AND is_main_goal = true
      AND scope = NEW.scope
      AND COALESCE(sector_id, '') = COALESCE(NEW.sector_id, '')
      AND COALESCE(team_id, '') = COALESCE(NEW.team_id, '')
      AND COALESCE(unit_id, '') = COALESCE(NEW.unit_id, '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger with updated logic
CREATE TRIGGER ensure_unique_main_goal_per_scope_trigger
BEFORE INSERT OR UPDATE ON public.company_kpis
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_main_goal_per_scope();

-- Add comment explaining the new behavior
COMMENT ON FUNCTION ensure_unique_main_goal_per_scope() IS 
'Allows multiple main goals per company as long as they have different scope combinations (sector, team, unit). Only one main goal is allowed per unique scope combination.';