
-- Create trigger function to notify consultant on KPI entry
CREATE OR REPLACE FUNCTION public.notify_consultant_on_kpi_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company RECORD;
  v_project RECORD;
  v_kpi RECORD;
  v_salesperson_name TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Get company info
  SELECT * INTO v_company
  FROM public.onboarding_companies
  WHERE id = NEW.company_id;

  IF v_company.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get KPI info
  SELECT * INTO v_kpi
  FROM public.company_kpis
  WHERE id = NEW.kpi_id;

  -- Get salesperson name if individual entry
  IF NEW.salesperson_id IS NOT NULL THEN
    SELECT name INTO v_salesperson_name
    FROM public.company_salespeople
    WHERE id = NEW.salesperson_id;
  END IF;

  -- Get project for this company
  SELECT p.* INTO v_project
  FROM public.onboarding_projects p
  WHERE p.onboarding_company_id = v_company.id
    AND p.status = 'active'
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- Build notification
  v_notification_title := '📊 Novo lançamento: ' || v_company.name;
  
  IF v_salesperson_name IS NOT NULL THEN
    v_notification_message := 'Lançamento de ' || COALESCE(v_kpi.name, 'KPI') || ' para ' || v_salesperson_name || ' na empresa ' || v_company.name || '.';
  ELSE
    v_notification_message := 'Lançamento de ' || COALESCE(v_kpi.name, 'KPI') || ' na empresa ' || v_company.name || '.';
  END IF;

  -- Notify consultant if exists
  IF v_company.consultant_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_company.consultant_id,
      v_project.id,
      'kpi_entry',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'kpi_entry'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on kpi_entries table
DROP TRIGGER IF EXISTS notify_consultant_on_kpi_entry_trigger ON public.kpi_entries;
CREATE TRIGGER notify_consultant_on_kpi_entry_trigger
  AFTER INSERT ON public.kpi_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_consultant_on_kpi_entry();
