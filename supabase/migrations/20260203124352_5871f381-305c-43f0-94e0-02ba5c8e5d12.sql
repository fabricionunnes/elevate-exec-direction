-- Create a trigger function to insert note activities into lead history
CREATE OR REPLACE FUNCTION public.log_note_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log note type activities
  IF NEW.type = 'note' THEN
    INSERT INTO crm_lead_history (
      lead_id,
      action,
      field_changed,
      old_value,
      new_value,
      notes,
      staff_id,
      created_at
    ) VALUES (
      NEW.lead_id,
      'note',
      NULL,
      NULL,
      NEW.title,
      NEW.description,
      NEW.responsible_staff_id,
      COALESCE(NEW.completed_at, NOW())
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_log_note_to_history ON crm_activities;
CREATE TRIGGER trigger_log_note_to_history
  AFTER INSERT ON crm_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_note_to_history();