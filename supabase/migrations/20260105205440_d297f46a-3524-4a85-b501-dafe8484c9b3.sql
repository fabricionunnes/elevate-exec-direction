-- Create trigger function to notify CS when CAC form is submitted
CREATE OR REPLACE FUNCTION public.notify_cac_form_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project RECORD;
  v_company RECORD;
BEGIN
  -- Get project and company info
  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Notify CS if exists
  IF v_project.cs_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_project.cs_id,
      NEW.project_id,
      'cac_form',
      '📊 Formulário CAC preenchido',
      'O cliente ' || COALESCE(v_project.company_name, v_project.product_name) || ' preencheu o formulário de CAC.',
      NEW.id,
      'cac_form'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_cac_form_submitted ON public.onboarding_cac_forms;
CREATE TRIGGER on_cac_form_submitted
  AFTER INSERT ON public.onboarding_cac_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_cac_form_submitted();