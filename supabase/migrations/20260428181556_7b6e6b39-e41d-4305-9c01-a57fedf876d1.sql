-- 1) FKs em onboarding_staff -> SET NULL
ALTER TABLE public.onboarding_task_history
  DROP CONSTRAINT IF EXISTS onboarding_task_history_staff_id_fkey,
  ALTER COLUMN staff_id DROP NOT NULL,
  ADD CONSTRAINT onboarding_task_history_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_ai_chat
  DROP CONSTRAINT IF EXISTS onboarding_ai_chat_staff_id_fkey,
  ALTER COLUMN staff_id DROP NOT NULL,
  ADD CONSTRAINT onboarding_ai_chat_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_monthly_goals
  DROP CONSTRAINT IF EXISTS onboarding_monthly_goals_target_set_by_fkey,
  ADD CONSTRAINT onboarding_monthly_goals_target_set_by_fkey
    FOREIGN KEY (target_set_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_monthly_goals
  DROP CONSTRAINT IF EXISTS onboarding_monthly_goals_result_set_by_fkey,
  ADD CONSTRAINT onboarding_monthly_goals_result_set_by_fkey
    FOREIGN KEY (result_set_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_projects
  DROP CONSTRAINT IF EXISTS onboarding_projects_consultant_id_fkey,
  ADD CONSTRAINT onboarding_projects_consultant_id_fkey
    FOREIGN KEY (consultant_id) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_projects
  DROP CONSTRAINT IF EXISTS onboarding_projects_cs_id_fkey,
  ADD CONSTRAINT onboarding_projects_cs_id_fkey
    FOREIGN KEY (cs_id) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.virtual_office_rooms
  DROP CONSTRAINT IF EXISTS virtual_office_rooms_created_by_fkey,
  ADD CONSTRAINT virtual_office_rooms_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.virtual_office_room_access
  DROP CONSTRAINT IF EXISTS virtual_office_room_access_granted_by_fkey,
  ADD CONSTRAINT virtual_office_room_access_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_announcements
  DROP CONSTRAINT IF EXISTS onboarding_announcements_created_by_fkey,
  ADD CONSTRAINT onboarding_announcements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.support_room_sessions
  DROP CONSTRAINT IF EXISTS support_room_sessions_attended_by_fkey,
  ADD CONSTRAINT support_room_sessions_attended_by_fkey
    FOREIGN KEY (attended_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_contract_renewals
  DROP CONSTRAINT IF EXISTS onboarding_contract_renewals_created_by_fkey,
  ADD CONSTRAINT onboarding_contract_renewals_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_meeting_notes
  DROP CONSTRAINT IF EXISTS onboarding_meeting_notes_staff_id_fkey,
  ADD CONSTRAINT onboarding_meeting_notes_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.onboarding_meeting_notes
  DROP CONSTRAINT IF EXISTS onboarding_meeting_notes_scheduled_by_fkey,
  ADD CONSTRAINT onboarding_meeting_notes_scheduled_by_fkey
    FOREIGN KEY (scheduled_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.endomarketing_campaigns
  DROP CONSTRAINT IF EXISTS endomarketing_campaigns_created_by_fkey,
  ADD CONSTRAINT endomarketing_campaigns_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.endomarketing_campaigns
  DROP CONSTRAINT IF EXISTS endomarketing_campaigns_ended_manually_by_fkey,
  ADD CONSTRAINT endomarketing_campaigns_ended_manually_by_fkey
    FOREIGN KEY (ended_manually_by) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

ALTER TABLE public.health_score_observations
  DROP CONSTRAINT IF EXISTS health_score_observations_staff_id_fkey,
  ADD CONSTRAINT health_score_observations_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

-- 2) Função utilitária para checar se um e-mail já é do staff master
CREATE OR REPLACE FUNCTION public.is_email_from_master_staff(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE lower(trim(email)) = lower(trim(_email))
      AND tenant_id IS NULL
      AND is_active = true
  );
$$;

-- 3) Trigger no whitelabel_tenants: ao definir owner_user_id, valida o email do auth.users
CREATE OR REPLACE FUNCTION public.prevent_tenant_with_staff_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = NEW.owner_user_id;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  IF public.is_email_from_master_staff(v_email) THEN
    RAISE EXCEPTION 'O e-mail % já pertence a um usuário interno do staff. Use outro e-mail para o tenant.', v_email
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_with_staff_email ON public.whitelabel_tenants;
CREATE TRIGGER trg_prevent_tenant_with_staff_email
  BEFORE INSERT OR UPDATE OF owner_user_id ON public.whitelabel_tenants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_with_staff_email();