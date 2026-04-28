
-- =====================================================================
-- Tenant isolation for broadcast notification triggers
-- Ensures White-Label tenants only receive notifications about their own
-- entities, and never receive notifications from the master UNV tenant
-- (or other WL tenants).
-- =====================================================================

-- 1) notify_company_without_consultant: NEW is a company => use NEW.tenant_id
CREATE OR REPLACE FUNCTION public.notify_company_without_consultant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_staff_member RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  IF NEW.consultant_id IS NULL THEN
    v_notification_title := '⚠️ Nova empresa sem consultor: ' || NEW.name;
    v_notification_message := 'A empresa "' || NEW.name || '" foi cadastrada sem um consultor atribuído. Por favor, atribua um consultor.';

    FOR v_staff_member IN 
      SELECT id FROM public.onboarding_staff 
      WHERE is_active = true 
        AND role IN ('admin', 'cs')
        AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
    LOOP
      INSERT INTO public.onboarding_notifications (
        staff_id, type, title, message, reference_id, reference_type
      ) VALUES (
        v_staff_member.id, 'company_no_consultant',
        v_notification_title, v_notification_message,
        NEW.id, 'company'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) notify_service_request: get tenant from project
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
  SELECT ou.name, ou.email INTO v_user
  FROM public.onboarding_users ou WHERE ou.id = NEW.requested_by;

  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  SELECT name, price, billing_type INTO v_service
  FROM public.service_catalog WHERE id = NEW.service_catalog_id;

  v_notification_title := '🛒 Solicitação de serviço: ' || v_service.name;
  v_notification_message := COALESCE(v_user.name, 'Cliente') || ' da empresa ' || 
    COALESCE(v_project.company_name, v_project.product_name) || 
    ' solicitou a liberação do serviço "' || v_service.name || 
    '" (R$ ' || to_char(v_service.price, 'FM999G999D00') || 
    CASE WHEN v_service.billing_type = 'monthly' THEN '/mês' ELSE ' único' END || ')';

  FOR v_staff IN
    SELECT id FROM public.onboarding_staff
    WHERE is_active = true
      AND role IN ('master', 'admin')
      AND tenant_id IS NOT DISTINCT FROM v_project.tenant_id
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

-- 3) notify_disc_completed: tenant via candidate.project
CREATE OR REPLACE FUNCTION public.notify_disc_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_candidate RECORD;
  v_project RECORD;
  v_staff RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT c.*, jo.title as job_title
    INTO v_candidate
    FROM public.candidates c
    LEFT JOIN public.job_openings jo ON jo.id = c.job_opening_id
    WHERE c.id = NEW.candidate_id;

    IF v_candidate IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.*, co.name as company_name
    INTO v_project
    FROM public.onboarding_projects p
    LEFT JOIN public.onboarding_companies co ON co.id = p.onboarding_company_id
    WHERE p.id = v_candidate.project_id;

    v_notification_title := '✅ DISC concluído: ' || v_candidate.full_name;
    v_notification_message := 'O candidato "' || v_candidate.full_name || '" completou o teste DISC';
    IF v_candidate.job_title IS NOT NULL THEN
      v_notification_message := v_notification_message || ' para a vaga "' || v_candidate.job_title || '"';
    END IF;
    v_notification_message := v_notification_message || ' - Perfil: ' || COALESCE(NEW.dominant_profile, 'N/A');

    FOR v_staff IN 
      SELECT id FROM public.onboarding_staff 
      WHERE is_active = true 
        AND role = 'rh'
        AND tenant_id IS NOT DISTINCT FROM v_project.tenant_id
    LOOP
      INSERT INTO public.onboarding_notifications (
        staff_id, project_id, type, title, message, reference_id, reference_type
      ) VALUES (
        v_staff.id, v_candidate.project_id, 'disc_completed',
        v_notification_title, v_notification_message, NEW.candidate_id, 'candidate'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) notify_candidate_created: tenant via project
CREATE OR REPLACE FUNCTION public.notify_candidate_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_job_title TEXT := NULL;
  v_staff RECORD;
  v_user RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  IF NEW.job_opening_id IS NOT NULL THEN
    SELECT title INTO v_job_title FROM public.job_openings WHERE id = NEW.job_opening_id;
  END IF;

  v_notification_title := '👤 Novo candidato: ' || NEW.full_name;
  v_notification_message := 'Candidato "' || NEW.full_name || '"';

  IF v_job_title IS NOT NULL THEN
    v_notification_message := v_notification_message || ' se candidatou para a vaga "' || v_job_title || '"';
  ELSIF NEW.current_stage = 'talent_pool' THEN
    v_notification_message := v_notification_message || ' se cadastrou no Banco de Talentos';
  ELSE
    v_notification_message := v_notification_message || ' foi adicionado';
  END IF;

  v_notification_message := v_notification_message || ' em ' || COALESCE(v_project.company_name, v_project.product_name, 'Global');

  FOR v_staff IN
    SELECT id FROM public.onboarding_staff
    WHERE is_active = true
      AND role = 'rh'
      AND tenant_id IS NOT DISTINCT FROM v_project.tenant_id
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_staff.id, NEW.project_id, 'new_candidate',
      v_notification_title, v_notification_message, NEW.id, 'candidate'
    );
  END LOOP;

  IF v_project.onboarding_company_id IS NOT NULL THEN
    FOR v_staff IN
      SELECT consultant_id as id FROM public.onboarding_companies
      WHERE id = v_project.onboarding_company_id
        AND consultant_id IS NOT NULL
    LOOP
      INSERT INTO public.onboarding_notifications (
        staff_id, project_id, type, title, message, reference_id, reference_type
      ) VALUES (
        v_staff.id, NEW.project_id, 'new_candidate',
        v_notification_title, v_notification_message, NEW.id, 'candidate'
      );
    END LOOP;
  END IF;

  FOR v_user IN
    SELECT id FROM public.onboarding_users
    WHERE project_id = NEW.project_id
  LOOP
    INSERT INTO public.onboarding_notifications (
      user_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_user.id, NEW.project_id, 'new_candidate',
      v_notification_title, v_notification_message, NEW.id, 'candidate'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 5) notify_job_opening_created: tenant via project
CREATE OR REPLACE FUNCTION public.notify_job_opening_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_staff_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  SELECT p.*, c.name as company_name, c.consultant_id, c.cs_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  v_notification_title := '📋 Nova vaga aberta: ' || NEW.title;
  v_notification_message := 'Vaga "' || NEW.title || '" foi aberta para ' || COALESCE(v_project.company_name, v_project.product_name) || ' (' || NEW.area || ' - ' || NEW.job_type || ')';

  FOR v_staff_id IN 
    SELECT id FROM public.onboarding_staff 
    WHERE is_active = true 
      AND role = 'rh'
      AND tenant_id IS NOT DISTINCT FROM v_project.tenant_id
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_staff_id, NEW.project_id, 'job_opening',
      v_notification_title, v_notification_message, NEW.id, 'job_opening'
    );
  END LOOP;

  IF v_project.consultant_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_project.consultant_id, NEW.project_id, 'job_opening',
      v_notification_title, v_notification_message, NEW.id, 'job_opening'
    );
  END IF;

  IF v_project.cs_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_project.cs_id, NEW.project_id, 'job_opening',
      v_notification_title, v_notification_message, NEW.id, 'job_opening'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 6) notify_low_nps_score: tenant via project
CREATE OR REPLACE FUNCTION public.notify_low_nps_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_staff_member RECORD;
  v_score_label TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  IF NEW.score >= 8 THEN
    RETURN NEW;
  END IF;

  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  IF NEW.score <= 6 THEN
    v_score_label := 'DETRATOR';
  ELSE
    v_score_label := 'NEUTRO';
  END IF;

  v_notification_title := '⚠️ NPS ' || v_score_label || ': Nota ' || NEW.score;
  v_notification_message := 'Cliente ' || COALESCE(NEW.respondent_name, 'anônimo') || 
    ' deu nota ' || NEW.score || ' para ' || COALESCE(v_project.company_name, v_project.product_name) ||
    '. Motivo: ' || COALESCE(SUBSTRING(NEW.would_recommend_why FROM 1 FOR 100), 'não informado');

  IF v_project.cs_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_project.cs_id, NEW.project_id, 'nps_alert',
      v_notification_title, v_notification_message, NEW.id, 'nps'
    );
  END IF;

  IF v_project.consultant_id IS NOT NULL AND v_project.consultant_id IS DISTINCT FROM v_project.cs_id THEN
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_project.consultant_id, NEW.project_id, 'nps_alert',
      v_notification_title, v_notification_message, NEW.id, 'nps'
    );
  END IF;

  FOR v_staff_member IN 
    SELECT id FROM public.onboarding_staff 
    WHERE role = 'admin' AND is_active = true
      AND tenant_id IS NOT DISTINCT FROM v_project.tenant_id
      AND id IS DISTINCT FROM v_project.cs_id
      AND id IS DISTINCT FROM v_project.consultant_id
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_staff_member.id, NEW.project_id, 'nps_alert',
      v_notification_title, v_notification_message, NEW.id, 'nps'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 7) notify_support_room_entry: tenant via project
CREATE OR REPLACE FUNCTION public.notify_support_room_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_staff_member RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  IF NEW.status != 'waiting' THEN
    RETURN NEW;
  END IF;

  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  v_notification_title := '🆘 Cliente na Sala de Suporte';
  v_notification_message := NEW.client_name || ' (' || COALESCE(NEW.company_name, v_project.product_name) || ') está aguardando atendimento na Sala de Suporte.';

  IF v_project.cs_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_project.cs_id, NEW.project_id, 'support_room',
      v_notification_title, v_notification_message, NEW.id, 'support_session'
    );
  END IF;

  IF v_project.consultant_id IS NOT NULL AND v_project.consultant_id IS DISTINCT FROM v_project.cs_id THEN
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_project.consultant_id, NEW.project_id, 'support_room',
      v_notification_title, v_notification_message, NEW.id, 'support_session'
    );
  END IF;

  FOR v_staff_member IN 
    SELECT id FROM public.onboarding_staff 
    WHERE is_active = true 
      AND role IN ('admin', 'cs')
      AND tenant_id IS NOT DISTINCT FROM v_project.tenant_id
      AND id IS DISTINCT FROM v_project.cs_id
      AND id IS DISTINCT FROM v_project.consultant_id
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id, project_id, type, title, message, reference_id, reference_type
    ) VALUES (
      v_staff_member.id, NEW.project_id, 'support_room',
      v_notification_title, v_notification_message, NEW.id, 'support_session'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
