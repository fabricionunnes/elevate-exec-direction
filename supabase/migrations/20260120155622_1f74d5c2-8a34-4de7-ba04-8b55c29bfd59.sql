-- Fix the trigger to handle empty strings properly by converting them to NULL
DROP TRIGGER IF EXISTS ensure_unique_main_goal_per_scope_trigger ON public.company_kpis;
DROP FUNCTION IF EXISTS ensure_unique_main_goal_per_scope();

-- Create improved function that handles empty strings and null values properly
CREATE OR REPLACE FUNCTION ensure_unique_main_goal_per_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_sector_id UUID;
  v_team_id UUID;
  v_unit_id UUID;
  new_sector_id UUID;
  new_team_id UUID;
  new_unit_id UUID;
BEGIN
  IF NEW.is_main_goal = true THEN
    -- Convert empty strings to NULL for proper comparison
    new_sector_id := CASE WHEN NEW.sector_id IS NULL OR NEW.sector_id::text = '' THEN NULL ELSE NEW.sector_id END;
    new_team_id := CASE WHEN NEW.team_id IS NULL OR NEW.team_id::text = '' THEN NULL ELSE NEW.team_id END;
    new_unit_id := CASE WHEN NEW.unit_id IS NULL OR NEW.unit_id::text = '' THEN NULL ELSE NEW.unit_id END;
    
    -- Unset other main goals that have the SAME scope combination
    UPDATE public.company_kpis 
    SET is_main_goal = false 
    WHERE company_id = NEW.company_id 
      AND id != NEW.id 
      AND is_main_goal = true
      AND COALESCE(scope, 'company') = COALESCE(NEW.scope, 'company')
      AND (
        (sector_id IS NULL AND new_sector_id IS NULL) OR 
        (sector_id = new_sector_id)
      )
      AND (
        (team_id IS NULL AND new_team_id IS NULL) OR 
        (team_id = new_team_id)
      )
      AND (
        (unit_id IS NULL AND new_unit_id IS NULL) OR 
        (unit_id = new_unit_id)
      );
  END IF;
  
  -- Also normalize empty strings to NULL before insert/update
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Create new trigger with updated logic
CREATE TRIGGER ensure_unique_main_goal_per_scope_trigger
BEFORE INSERT OR UPDATE ON public.company_kpis
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_main_goal_per_scope();