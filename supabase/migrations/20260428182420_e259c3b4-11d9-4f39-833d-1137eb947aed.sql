-- Permitir que a remoção de staff de um tenant não quebre históricos antigos
-- que ficam sem responsável após ON DELETE SET NULL.
ALTER TABLE public.onboarding_task_history
  DROP CONSTRAINT IF EXISTS history_user_or_staff;

-- Mantém a validação apenas na criação de novos históricos, sem bloquear updates
-- automáticos de FK durante exclusões de tenants/staff.
CREATE OR REPLACE FUNCTION public.validate_onboarding_task_history_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.staff_id IS NULL THEN
    RAISE EXCEPTION 'Histórico de tarefa precisa ter user_id ou staff_id ao ser criado.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_onboarding_task_history_actor ON public.onboarding_task_history;
CREATE TRIGGER trg_validate_onboarding_task_history_actor
  BEFORE INSERT ON public.onboarding_task_history
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_onboarding_task_history_actor();