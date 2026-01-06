-- Tabela para sessões de suporte de clientes
CREATE TABLE public.support_room_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  company_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  attended_by UUID REFERENCES public.onboarding_staff(id),
  meet_link TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attended_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.support_room_sessions ENABLE ROW LEVEL SECURITY;

-- Política para staff ver todas as sessões
CREATE POLICY "Staff can view all support sessions"
ON public.support_room_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Política para clientes verem suas próprias sessões
CREATE POLICY "Clients can view their own sessions"
ON public.support_room_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid() AND ou.id = support_room_sessions.user_id
  )
);

-- Política para clientes criarem sessões
CREATE POLICY "Clients can create support sessions"
ON public.support_room_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid() AND ou.id = user_id
  )
);

-- Política para staff atualizar sessões
CREATE POLICY "Staff can update support sessions"
ON public.support_room_sessions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Política para staff deletar sessões
CREATE POLICY "Staff can delete support sessions"
ON public.support_room_sessions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true AND os.role = 'admin'
  )
);

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_room_sessions;

-- Função para notificar staff quando cliente entra na sala de suporte
CREATE OR REPLACE FUNCTION public.notify_support_room_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_company RECORD;
  v_staff_member RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Apenas notificar em novas sessões com status 'waiting'
  IF NEW.status != 'waiting' THEN
    RETURN NEW;
  END IF;

  -- Buscar informações do projeto e empresa
  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  v_notification_title := '🆘 Cliente na Sala de Suporte';
  v_notification_message := NEW.client_name || ' (' || COALESCE(NEW.company_name, v_project.product_name) || ') está aguardando atendimento na Sala de Suporte.';

  -- Notificar CS responsável
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
      'support_room',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'support_session'
    );
  END IF;

  -- Notificar Consultor responsável (se diferente do CS)
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
      NEW.project_id,
      'support_room',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'support_session'
    );
  END IF;

  -- Notificar todos os admins e CS
  FOR v_staff_member IN 
    SELECT id FROM public.onboarding_staff 
    WHERE is_active = true 
    AND role IN ('admin', 'cs')
    AND id IS DISTINCT FROM v_project.cs_id
    AND id IS DISTINCT FROM v_project.consultant_id
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
      v_staff_member.id,
      NEW.project_id,
      'support_room',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'support_session'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger para notificar quando cliente entra na sala
CREATE TRIGGER on_support_room_entry
  AFTER INSERT ON public.support_room_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_room_entry();