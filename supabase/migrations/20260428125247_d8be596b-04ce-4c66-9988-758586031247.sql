-- Impede que leads em estágios finais (Ganho/Perdido) sejam inscritos em cadências de boas-vindas
CREATE OR REPLACE FUNCTION public.crm_cadence_auto_enroll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cadence RECORD;
  v_first_step RECORD;
  v_existing_enrollment RECORD;
  v_next_run TIMESTAMPTZ;
  v_stage_final_type TEXT;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.stage_id IS DISTINCT FROM OLD.stage_id) THEN

    -- Bloqueia auto-enroll quando o estágio destino é final (won/lost)
    SELECT final_type INTO v_stage_final_type
    FROM public.crm_stages
    WHERE id = NEW.stage_id;

    IF v_stage_final_type IN ('won', 'lost') THEN
      -- Para qualquer cadência ativa que ainda esteja rodando para esse lead
      UPDATE public.crm_cadence_enrollments
      SET status = 'stopped', stopped_reason = 'stage_final', updated_at = now()
      WHERE lead_id = NEW.id AND status = 'active';
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      UPDATE public.crm_cadence_enrollments e
      SET status = 'stopped', stopped_reason = 'stage_changed', updated_at = now()
      WHERE e.lead_id = NEW.id
        AND e.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM public.crm_cadences c
          WHERE c.id = e.cadence_id
            AND c.stop_on_stage_change = true
        );
    END IF;

    FOR v_cadence IN
      SELECT c.*
      FROM public.crm_cadences c
      WHERE c.is_active = true
        AND (
          (c.scope = 'stage' AND c.stage_id = NEW.stage_id)
          OR (c.scope = 'pipeline' AND c.pipeline_id = NEW.pipeline_id)
        )
    LOOP
      SELECT * INTO v_first_step
      FROM public.crm_cadence_steps
      WHERE cadence_id = v_cadence.id
        AND is_active = true
      ORDER BY sort_order ASC
      LIMIT 1;

      IF v_first_step.id IS NOT NULL THEN
        v_next_run := public.crm_cadence_calc_next_run(now(), v_first_step.delay_value, v_first_step.delay_unit);

        SELECT * INTO v_existing_enrollment
        FROM public.crm_cadence_enrollments e
        WHERE e.cadence_id = v_cadence.id
          AND e.lead_id = NEW.id
        LIMIT 1;

        IF v_existing_enrollment.id IS NULL THEN
          INSERT INTO public.crm_cadence_enrollments (
            cadence_id, lead_id, current_step_index, status, next_run_at, tenant_id
          )
          VALUES (
            v_cadence.id, NEW.id, 0, 'active', v_next_run, NEW.tenant_id
          );
        ELSIF v_existing_enrollment.status NOT IN ('active', 'paused') THEN
          UPDATE public.crm_cadence_enrollments
          SET current_step_index = 0,
              status = 'active',
              next_run_at = v_next_run,
              tenant_id = COALESCE(NEW.tenant_id, tenant_id),
              completed_at = NULL,
              stopped_reason = NULL,
              enrolled_at = now(),
              updated_at = now()
          WHERE id = v_existing_enrollment.id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Faz o mesmo para a regra antiga de notificações (enqueue_lead_created_notifications, se existir)
DO $$
DECLARE
  fn_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'enqueue_lead_notifications'
  ) INTO fn_exists;
  -- noop: bloqueio principal já é via cadências; regras lead_created só rodam em INSERT
  -- e o usuário relatou disparo no Ganho, que vinha do trigger acima.
  NULL;
END $$;