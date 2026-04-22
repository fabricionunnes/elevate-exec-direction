-- 1) Colunas para mídia em steps
ALTER TABLE public.crm_cadence_steps
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS branches jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_cadence_steps_media_type_check'
  ) THEN
    ALTER TABLE public.crm_cadence_steps
      ADD CONSTRAINT crm_cadence_steps_media_type_check
      CHECK (media_type IN ('text','image','audio','video','document'));
  END IF;
END$$;

-- 2) Coluna para guardar texto da última resposta para avaliar branches
ALTER TABLE public.crm_cadence_enrollments
  ADD COLUMN IF NOT EXISTS last_inbound_text text;

-- 3) Atualiza o trigger de detecção de inbound para salvar o texto
CREATE OR REPLACE FUNCTION public.handle_crm_whatsapp_inbound_cadence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  -- Resolve lead via conversa
  SELECT lead_id INTO v_lead_id
  FROM public.crm_whatsapp_conversations
  WHERE id = NEW.conversation_id
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atualiza enrollments ativos do lead
  UPDATE public.crm_cadence_enrollments e
  SET last_inbound_at = COALESCE(NEW.created_at, now()),
      last_inbound_text = LEFT(COALESCE(NEW.content, ''), 2000),
      status = CASE
        WHEN c.stop_on_reply THEN 'replied'
        ELSE e.status
      END,
      stopped_reason = CASE
        WHEN c.stop_on_reply THEN 'lead_replied'
        ELSE e.stopped_reason
      END,
      completed_at = CASE
        WHEN c.stop_on_reply THEN now()
        ELSE e.completed_at
      END
  FROM public.crm_cadences c
  WHERE e.cadence_id = c.id
    AND e.lead_id = v_lead_id
    AND e.status = 'active';

  RETURN NEW;
END;
$$;

-- 4) Bucket de mídia
INSERT INTO storage.buckets (id, name, public)
VALUES ('cadence-media', 'cadence-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cadence media public read') THEN
    CREATE POLICY "Cadence media public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'cadence-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cadence media staff upload') THEN
    CREATE POLICY "Cadence media staff upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'cadence-media'
        AND EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cadence media staff update') THEN
    CREATE POLICY "Cadence media staff update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'cadence-media'
        AND EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cadence media staff delete') THEN
    CREATE POLICY "Cadence media staff delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'cadence-media'
        AND EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
      );
  END IF;
END$$;

-- 5) Função para inscrição manual em massa
CREATE OR REPLACE FUNCTION public.enroll_leads_in_cadence(
  p_cadence_id uuid,
  p_lead_ids uuid[]
)
RETURNS TABLE(enrolled_count int, skipped_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_step record;
  v_now timestamptz := now();
  v_delay_ms bigint;
  v_next_run timestamptz;
  v_enrolled int := 0;
  v_skipped int := 0;
  v_lead_id uuid;
  v_inserted boolean;
BEGIN
  -- Permissão: apenas equipe interna ativa
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Carregar primeiro step
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
    BEGIN
      INSERT INTO public.crm_cadence_enrollments (
        cadence_id, lead_id, current_step_index, status, next_run_at, enrolled_at
      ) VALUES (
        p_cadence_id, v_lead_id, 0, 'active', v_next_run, v_now
      );
      v_enrolled := v_enrolled + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_enrolled, v_skipped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_leads_in_cadence(uuid, uuid[]) TO authenticated;