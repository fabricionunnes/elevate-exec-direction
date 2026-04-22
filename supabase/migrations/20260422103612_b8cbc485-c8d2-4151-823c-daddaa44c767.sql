
CREATE OR REPLACE FUNCTION public.enroll_leads_in_cadence(p_cadence_id uuid, p_lead_ids uuid[])
RETURNS TABLE(enrolled_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first_step record;
  v_now timestamptz := now();
  v_delay_ms bigint;
  v_next_run timestamptz;
  v_enrolled int := 0;
  v_skipped int := 0;
  v_lead_id uuid;
  v_existing record;
BEGIN
  -- Permissão: apenas equipe interna ativa
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Carregar primeiro step ativo
  SELECT delay_value, delay_unit INTO v_first_step
  FROM public.crm_cadence_steps
  WHERE cadence_id = p_cadence_id AND is_active = true
  ORDER BY sort_order ASC
  LIMIT 1;

  IF v_first_step IS NULL THEN
    RAISE EXCEPTION 'cadence has no active steps';
  END IF;

  v_delay_ms := CASE v_first_step.delay_unit
    WHEN 'minutes' THEN v_first_step.delay_value::bigint * 60000
    WHEN 'hours' THEN v_first_step.delay_value::bigint * 3600000
    ELSE v_first_step.delay_value::bigint * 86400000
  END;
  v_next_run := v_now + (v_delay_ms || ' milliseconds')::interval;

  FOREACH v_lead_id IN ARRAY p_lead_ids LOOP
    -- Verifica se já existe inscrição
    SELECT id, status INTO v_existing
    FROM public.crm_cadence_enrollments
    WHERE cadence_id = p_cadence_id AND lead_id = v_lead_id
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      -- Não existe: cria nova
      INSERT INTO public.crm_cadence_enrollments (
        cadence_id, lead_id, current_step_index, status, next_run_at, enrolled_at
      ) VALUES (
        p_cadence_id, v_lead_id, 0, 'active', v_next_run, v_now
      );
      v_enrolled := v_enrolled + 1;
    ELSIF v_existing.status IN ('active', 'paused') THEN
      -- Já está rodando: pula
      v_skipped := v_skipped + 1;
    ELSE
      -- Foi completed/stopped/cancelled: reativa do início
      UPDATE public.crm_cadence_enrollments
      SET status = 'active',
          current_step_index = 0,
          next_run_at = v_next_run,
          enrolled_at = v_now,
          completed_at = NULL,
          stopped_reason = NULL,
          last_message_sent_at = NULL,
          updated_at = v_now
      WHERE id = v_existing.id;
      v_enrolled := v_enrolled + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_enrolled, v_skipped;
END;
$function$;
