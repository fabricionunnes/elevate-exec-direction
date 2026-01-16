-- Allow clients (onboarding_users) to insert job openings for their project
CREATE POLICY "Clients can create job openings" ON public.job_openings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.project_id = job_openings.project_id
    )
  );

-- Allow clients to insert candidates for their project
CREATE POLICY "Clients can create candidates" ON public.candidates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.project_id = candidates.project_id
    )
  );

-- Allow clients to view job openings for their project
CREATE POLICY "Clients can view their job openings" ON public.job_openings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.project_id = job_openings.project_id
    )
  );

-- Allow clients to view candidates for their project
CREATE POLICY "Clients can view their candidates" ON public.candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.project_id = candidates.project_id
    )
  );

-- Allow clients to insert hiring history (needed for logging creation)
CREATE POLICY "Clients can create hiring history" ON public.hiring_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN public.onboarding_users ou ON ou.project_id = c.project_id
      WHERE c.id = hiring_history.candidate_id
      AND ou.user_id = auth.uid()
    )
  );

-- Update job opening notification trigger to also notify consultant and CS
CREATE OR REPLACE FUNCTION public.notify_job_opening_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_staff_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Get project and company info
  SELECT p.*, c.name as company_name, c.consultant_id, c.cs_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  v_notification_title := '📋 Nova vaga aberta: ' || NEW.title;
  v_notification_message := 'Vaga "' || NEW.title || '" foi aberta para ' || COALESCE(v_project.company_name, v_project.product_name) || ' (' || NEW.area || ' - ' || NEW.job_type || ')';

  -- Notify all active RH staff members
  FOR v_staff_id IN 
    SELECT id FROM public.onboarding_staff 
    WHERE is_active = true 
    AND role = 'rh'
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_staff_id,
      NEW.project_id,
      'job_opening',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'job_opening'
    );
  END LOOP;

  -- Notify the consultant if assigned
  IF v_project.consultant_id IS NOT NULL THEN
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
      NEW.project_id,
      'job_opening',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'job_opening'
    );
  END IF;

  -- Notify the CS if assigned
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
      'job_opening',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'job_opening'
    );
  END IF;

  RETURN NEW;
END;
$$;