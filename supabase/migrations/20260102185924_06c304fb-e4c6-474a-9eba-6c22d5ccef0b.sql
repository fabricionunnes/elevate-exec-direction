-- Trigger to notify ticket creator when staff replies
CREATE OR REPLACE FUNCTION public.handle_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_replier_name TEXT;
  v_creator_user_id UUID;
BEGIN
  -- Get ticket info
  SELECT t.*, p.product_name, c.name as company_name
  INTO v_ticket
  FROM public.onboarding_tickets t
  LEFT JOIN public.onboarding_projects p ON p.id = t.project_id
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE t.id = NEW.ticket_id;

  -- Get replier name
  SELECT ou.name INTO v_replier_name
  FROM public.onboarding_users ou
  WHERE ou.id = NEW.user_id;

  -- Get ticket creator's auth user_id
  SELECT ou.user_id INTO v_creator_user_id
  FROM public.onboarding_users ou
  WHERE ou.id = v_ticket.created_by;

  -- Only notify if replier is not the creator
  IF NEW.user_id != v_ticket.created_by AND v_creator_user_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      user_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_ticket.created_by,
      v_ticket.project_id,
      'ticket_reply',
      'Nova resposta no chamado: ' || v_ticket.subject,
      COALESCE(v_replier_name, 'Equipe') || ' respondeu ao seu chamado',
      v_ticket.id,
      'ticket'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for ticket replies
DROP TRIGGER IF EXISTS on_ticket_reply ON public.onboarding_ticket_replies;
CREATE TRIGGER on_ticket_reply
  AFTER INSERT ON public.onboarding_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_reply();

-- Trigger to notify ticket creator when status changes
CREATE OR REPLACE FUNCTION public.handle_ticket_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project RECORD;
  v_creator_user_id UUID;
  v_status_label TEXT;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get project info
  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Get ticket creator's auth user_id
  SELECT ou.user_id INTO v_creator_user_id
  FROM public.onboarding_users ou
  WHERE ou.id = NEW.created_by;

  -- Map status to Portuguese label
  v_status_label := CASE NEW.status
    WHEN 'open' THEN 'Aberto'
    WHEN 'in_progress' THEN 'Em andamento'
    WHEN 'resolved' THEN 'Resolvido'
    WHEN 'closed' THEN 'Fechado'
    ELSE NEW.status::text
  END;

  -- Notify the ticket creator
  IF v_creator_user_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      user_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      NEW.created_by,
      NEW.project_id,
      'ticket_update',
      'Chamado atualizado: ' || NEW.subject,
      'Status alterado para: ' || v_status_label,
      NEW.id,
      'ticket'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for ticket status updates
DROP TRIGGER IF EXISTS on_ticket_status_update ON public.onboarding_tickets;
CREATE TRIGGER on_ticket_status_update
  AFTER UPDATE ON public.onboarding_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_status_update();

-- Add RLS policy for users to view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.onboarding_notifications
FOR SELECT
USING (user_id IN (
  SELECT id FROM public.onboarding_users WHERE user_id = auth.uid()
));

-- Add RLS policy for users to update their own notifications
CREATE POLICY "Users can update own notifications"
ON public.onboarding_notifications
FOR UPDATE
USING (user_id IN (
  SELECT id FROM public.onboarding_users WHERE user_id = auth.uid()
));