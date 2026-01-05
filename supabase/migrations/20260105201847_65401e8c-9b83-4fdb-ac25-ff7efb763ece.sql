-- Add notice_end_date field to track when the notice period ends
ALTER TABLE public.onboarding_projects 
ADD COLUMN IF NOT EXISTS notice_end_date DATE;

-- Create function to check and notify about notice period ending
CREATE OR REPLACE FUNCTION public.check_notice_period_ending()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project RECORD;
  v_company RECORD;
BEGIN
  -- Find all projects in "Cumprindo Aviso" status where notice_end_date is today
  FOR v_project IN 
    SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
    FROM public.onboarding_projects p
    LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
    WHERE p.status = 'notice'
      AND p.notice_end_date = CURRENT_DATE
  LOOP
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
        v_project.id,
        'notice_expiring',
        '⏰ Aviso expirando hoje: ' || COALESCE(v_project.company_name, v_project.product_name),
        'O período de aviso do projeto ' || COALESCE(v_project.company_name, v_project.product_name) || ' termina hoje. Defina se o cliente será reativado ou encerrado.',
        v_project.id,
        'project'
      );
    END IF;

    -- Notify Consultant if exists and different from CS
    IF v_project.consultant_id IS NOT NULL AND v_project.consultant_id IS DISTINCT FROM v_project.cs_id THEN
      INSERT INTO public.onboarding_notifications (
        staff_id,
        project_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_project.consultant_id,
        v_project.id,
        'notice_expiring',
        '⏰ Aviso expirando hoje: ' || COALESCE(v_project.company_name, v_project.product_name),
        'O período de aviso do projeto ' || COALESCE(v_project.company_name, v_project.product_name) || ' termina hoje. Defina se o cliente será reativado ou encerrado.',
        v_project.id,
        'project'
      );
    END IF;
  END LOOP;
END;
$$;