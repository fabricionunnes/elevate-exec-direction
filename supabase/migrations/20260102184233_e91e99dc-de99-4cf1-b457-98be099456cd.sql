-- Create notifications table for real-time alerts
CREATE TABLE public.onboarding_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'ticket',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_notifications ENABLE ROW LEVEL SECURITY;

-- Staff can view their own notifications
CREATE POLICY "Staff can view own notifications" 
ON public.onboarding_notifications 
FOR SELECT 
USING (
  staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid()
  )
);

-- Staff can update their own notifications (mark as read)
CREATE POLICY "Staff can update own notifications" 
ON public.onboarding_notifications 
FOR UPDATE 
USING (
  staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid()
  )
);

-- System can insert notifications
CREATE POLICY "System can insert notifications" 
ON public.onboarding_notifications 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_notifications;

-- Function to create task and notification when ticket is created
CREATE OR REPLACE FUNCTION public.handle_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
  v_company RECORD;
  v_ticket_creator RECORD;
  v_responsible_staff_id UUID;
  v_task_id UUID;
  v_task_title TEXT;
BEGIN
  -- Get project and company info
  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Get ticket creator info
  SELECT name INTO v_ticket_creator
  FROM public.onboarding_users
  WHERE id = NEW.created_by;

  -- Determine responsible staff (assigned_to first, then CS, then consultant)
  IF NEW.assigned_to IS NOT NULL THEN
    -- Get the staff_id from onboarding_users if assigned
    SELECT ou.id INTO v_responsible_staff_id
    FROM public.onboarding_users ou
    WHERE ou.id = NEW.assigned_to AND ou.role IN ('cs', 'consultant');
    
    -- If not found in users, check if it's directly a staff assignment
    IF v_responsible_staff_id IS NULL THEN
      v_responsible_staff_id := v_project.cs_id;
    END IF;
  ELSIF v_project.cs_id IS NOT NULL THEN
    v_responsible_staff_id := v_project.cs_id;
  ELSIF v_project.consultant_id IS NOT NULL THEN
    v_responsible_staff_id := v_project.consultant_id;
  END IF;

  -- Create task title
  v_task_title := '[CHAMADO] ' || NEW.subject;

  -- Create urgent task for the ticket
  INSERT INTO public.onboarding_tasks (
    project_id,
    title,
    description,
    priority,
    status,
    due_date,
    responsible_staff_id,
    sort_order
  ) VALUES (
    NEW.project_id,
    v_task_title,
    'Chamado aberto por ' || COALESCE(v_ticket_creator.name, 'cliente') || E'\n\n' || NEW.message,
    'high',
    'pending',
    CURRENT_DATE,
    v_responsible_staff_id,
    0
  ) RETURNING id INTO v_task_id;

  -- Update ticket with task reference
  UPDATE public.onboarding_tickets SET task_id = v_task_id WHERE id = NEW.id;

  -- Create notification for responsible staff
  IF v_responsible_staff_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_responsible_staff_id,
      NEW.project_id,
      'ticket',
      'Novo chamado: ' || NEW.subject,
      'Chamado aberto por ' || COALESCE(v_ticket_creator.name, 'cliente') || ' - ' || COALESCE(v_project.company_name, v_project.product_name),
      NEW.id,
      'ticket'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new tickets
CREATE TRIGGER on_ticket_created
  AFTER INSERT ON public.onboarding_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ticket();