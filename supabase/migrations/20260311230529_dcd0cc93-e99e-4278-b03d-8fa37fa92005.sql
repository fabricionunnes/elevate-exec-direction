
-- Service catalog: defines available add-on services with pricing
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_type TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_type IN ('monthly', 'one_time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read the catalog
CREATE POLICY "Authenticated users can view service catalog"
  ON public.service_catalog FOR SELECT TO authenticated USING (true);

-- Only admin staff can manage catalog
CREATE POLICY "Admin staff can manage service catalog"
  ON public.service_catalog FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin')
    )
  );

-- Service requests from clients
CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  service_catalog_id UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Clients can view their own project's requests
CREATE POLICY "Project members can view service requests"
  ON public.service_requests FOR SELECT TO authenticated
  USING (public.is_onboarding_project_member(project_id));

-- Project members can create requests
CREATE POLICY "Project members can create service requests"
  ON public.service_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_onboarding_project_member(project_id));

-- Admin staff can manage all requests
CREATE POLICY "Admin staff can manage service requests"
  ON public.service_requests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin')
    )
  );

-- Insert the service catalog data
INSERT INTO public.service_catalog (menu_key, name, description, price, billing_type, sort_order) VALUES
  ('pontuacao', 'Pontuação (Cashback)', 'Sistema de pontuação e cashback para seus clientes', 50.00, 'monthly', 1),
  ('testes', 'Testes', 'Avaliações e testes para sua equipe', 27.00, 'one_time', 2),
  ('rh', 'RH', 'Módulo completo de Recursos Humanos', 1000.00, 'monthly', 3),
  ('board', 'Board', 'Board virtual estratégico', 67.00, 'monthly', 4),
  ('trafego_pago', 'Tráfego Pago', 'Gestão de tráfego pago e campanhas', 2000.00, 'monthly', 5),
  ('funil_vendas', 'Funil de Vendas', 'Funil de vendas completo', 29.00, 'monthly', 6),
  ('diretor_comercial_ia', 'Diretor Comercial IA', 'Inteligência artificial para direção comercial', 97.00, 'monthly', 7),
  ('gestao_clientes', 'Gestão (Clientes, Vendas, Financeiro, Estoque e Agendamentos)', 'Módulo completo de gestão empresarial', 127.00, 'monthly', 8),
  ('unv_academy', 'UNV Academy', 'Plataforma de treinamentos e cursos', 99.00, 'monthly', 9),
  ('instagram', 'Instagram', 'Integração e análise do Instagram', 47.00, 'monthly', 10),
  ('unv_disparador', 'Disparador', 'Disparador de mensagens em massa', 127.00, 'monthly', 11),
  ('crm_unv', 'CRM UNV', 'CRM completo para gestão de leads', 2000.00, 'monthly', 12);

-- Trigger to notify admins when a service request is created
CREATE OR REPLACE FUNCTION public.notify_service_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_project RECORD;
  v_service RECORD;
  v_staff RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Get requesting user info
  SELECT ou.name, ou.email INTO v_user
  FROM public.onboarding_users ou WHERE ou.id = NEW.requested_by;

  -- Get project/company info
  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Get service info
  SELECT name, price, billing_type INTO v_service
  FROM public.service_catalog WHERE id = NEW.service_catalog_id;

  v_notification_title := '🛒 Solicitação de serviço: ' || v_service.name;
  v_notification_message := COALESCE(v_user.name, 'Cliente') || ' da empresa ' || 
    COALESCE(v_project.company_name, v_project.product_name) || 
    ' solicitou a liberação do serviço "' || v_service.name || 
    '" (R$ ' || to_char(v_service.price, 'FM999G999D00') || 
    CASE WHEN v_service.billing_type = 'monthly' THEN '/mês' ELSE ' único' END || ')';

  -- Notify all admin and master staff
  FOR v_staff IN
    SELECT id FROM public.onboarding_staff
    WHERE is_active = true AND role IN ('master', 'admin')
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_staff.id, NEW.project_id, 'service_request',
      v_notification_title, v_notification_message, NEW.id, 'service_request'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_service_request_created
  AFTER INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_request();
