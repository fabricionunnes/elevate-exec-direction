
-- ============================================================
-- CENTRAL DE CADÊNCIAS DO CRM (módulo novo, isolado)
-- ============================================================

-- 1) CADÊNCIAS (configuração principal)
CREATE TABLE public.crm_cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'stage' CHECK (scope IN ('pipeline','stage')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  stop_on_reply BOOLEAN NOT NULL DEFAULT true,
  stop_on_stage_change BOOLEAN NOT NULL DEFAULT true,
  -- Janela de horário (override do global em crm_settings). NULL = usa global.
  window_start TIME,
  window_end TIME,
  window_weekdays INT[] DEFAULT NULL, -- 0=dom..6=sáb
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  created_by UUID,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((scope = 'pipeline' AND pipeline_id IS NOT NULL) OR (scope = 'stage' AND stage_id IS NOT NULL))
);

CREATE INDEX idx_crm_cadences_pipeline ON public.crm_cadences(pipeline_id) WHERE is_active = true;
CREATE INDEX idx_crm_cadences_stage ON public.crm_cadences(stage_id) WHERE is_active = true;

-- 2) STEPS (mensagens da cadência)
CREATE TABLE public.crm_cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.crm_cadences(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- delay relativo ao step anterior (ou ao enrollment para o step 0)
  delay_value INTEGER NOT NULL DEFAULT 0,
  delay_unit TEXT NOT NULL DEFAULT 'hours' CHECK (delay_unit IN ('minutes','hours','days')),
  message_template TEXT NOT NULL,
  -- Modo de seleção da instância
  instance_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (instance_mode IN ('fixed','from_owner')),
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  -- condição extra para envio (skip se houve resposta após último envio etc.)
  send_condition TEXT NOT NULL DEFAULT 'always' CHECK (send_condition IN ('always','no_reply')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_cadence_steps_cadence ON public.crm_cadence_steps(cadence_id, sort_order);

-- 3) ENROLLMENTS (lead inscrito em cadência)
CREATE TABLE public.crm_cadence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.crm_cadences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','replied','stopped','failed')),
  next_run_at TIMESTAMPTZ,
  last_message_sent_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  stopped_reason TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cadence_id, lead_id)
);

CREATE INDEX idx_crm_cadence_enrollments_due ON public.crm_cadence_enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX idx_crm_cadence_enrollments_lead ON public.crm_cadence_enrollments(lead_id);

-- 4) LOG DE MENSAGENS ENVIADAS PELA CADÊNCIA
CREATE TABLE public.crm_cadence_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.crm_cadence_enrollments(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.crm_cadences(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.crm_cadence_steps(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  phone TEXT,
  message_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_cadence_messages_enrollment ON public.crm_cadence_messages(enrollment_id);
CREATE INDEX idx_crm_cadence_messages_lead ON public.crm_cadence_messages(lead_id);

-- ============================================================
-- TRIGGERS DE TIMESTAMP
-- ============================================================
CREATE TRIGGER trg_crm_cadences_updated BEFORE UPDATE ON public.crm_cadences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_cadence_steps_updated BEFORE UPDATE ON public.crm_cadence_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_cadence_enrollments_updated BEFORE UPDATE ON public.crm_cadence_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.crm_cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_cadence_messages ENABLE ROW LEVEL SECURITY;

-- Acesso para staff autenticado (mesmo padrão das outras tabelas crm_*)
CREATE POLICY "Staff can view cadences" ON public.crm_cadences FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);
CREATE POLICY "Staff can manage cadences" ON public.crm_cadences FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);

CREATE POLICY "Staff can view cadence steps" ON public.crm_cadence_steps FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);
CREATE POLICY "Staff can manage cadence steps" ON public.crm_cadence_steps FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);

CREATE POLICY "Staff can view enrollments" ON public.crm_cadence_enrollments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);
CREATE POLICY "Staff can manage enrollments" ON public.crm_cadence_enrollments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);

CREATE POLICY "Staff can view cadence messages" ON public.crm_cadence_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);
CREATE POLICY "System can insert cadence messages" ON public.crm_cadence_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
);

-- ============================================================
-- FUNÇÃO: Calcula o next_run_at do step atual respeitando janela
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_cadence_calc_next_run(
  p_base_time TIMESTAMPTZ,
  p_delay_value INTEGER,
  p_delay_unit TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_delay_unit
    WHEN 'minutes' THEN p_base_time + (p_delay_value || ' minutes')::INTERVAL
    WHEN 'hours' THEN p_base_time + (p_delay_value || ' hours')::INTERVAL
    WHEN 'days' THEN p_base_time + (p_delay_value || ' days')::INTERVAL
    ELSE p_base_time
  END;
END;
$$;

-- ============================================================
-- TRIGGER: auto-enrollment quando lead entra em etapa
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_cadence_auto_enroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadence RECORD;
  v_first_step RECORD;
  v_next_run TIMESTAMPTZ;
BEGIN
  -- só dispara se mudou de etapa (ou inserção)
  IF (TG_OP = 'INSERT') OR (NEW.stage_id IS DISTINCT FROM OLD.stage_id) THEN

    -- Se mudou etapa, parar enrollments ativos com stop_on_stage_change
    IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      UPDATE public.crm_cadence_enrollments e
      SET status = 'stopped', stopped_reason = 'stage_changed', updated_at = now()
      WHERE e.lead_id = NEW.id
        AND e.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.crm_cadences c
          WHERE c.id = e.cadence_id AND c.stop_on_stage_change = true
        );
    END IF;

    -- Inscrever em cadências aplicáveis (por stage ou por pipeline)
    FOR v_cadence IN
      SELECT c.* FROM public.crm_cadences c
      WHERE c.is_active = true
        AND (
          (c.scope = 'stage' AND c.stage_id = NEW.stage_id)
          OR (c.scope = 'pipeline' AND c.pipeline_id = NEW.pipeline_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_cadence_enrollments e
          WHERE e.cadence_id = c.id AND e.lead_id = NEW.id AND e.status IN ('active','paused')
        )
    LOOP
      -- buscar primeiro step
      SELECT * INTO v_first_step
      FROM public.crm_cadence_steps
      WHERE cadence_id = v_cadence.id AND is_active = true
      ORDER BY sort_order ASC
      LIMIT 1;

      IF v_first_step.id IS NOT NULL THEN
        v_next_run := public.crm_cadence_calc_next_run(now(), v_first_step.delay_value, v_first_step.delay_unit);

        INSERT INTO public.crm_cadence_enrollments
          (cadence_id, lead_id, current_step_index, status, next_run_at, tenant_id)
        VALUES
          (v_cadence.id, NEW.id, 0, 'active', v_next_run, NEW.tenant_id);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_lead_cadence_enroll
AFTER INSERT OR UPDATE OF stage_id ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.crm_cadence_auto_enroll();

-- ============================================================
-- TRIGGER: detectar resposta do lead (inbound em crm_whatsapp_messages)
-- e parar enrollments com stop_on_reply
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_cadence_handle_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  -- buscar lead vinculado à conversa
  SELECT lead_id INTO v_lead_id
  FROM public.crm_whatsapp_conversations
  WHERE id = NEW.conversation_id
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- marcar enrollments como replied
  UPDATE public.crm_cadence_enrollments e
  SET status = 'replied',
      stopped_reason = 'lead_replied',
      last_inbound_at = NEW.created_at,
      updated_at = now()
  WHERE e.lead_id = v_lead_id
    AND e.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.crm_cadences c
      WHERE c.id = e.cadence_id AND c.stop_on_reply = true
    );

  -- atualizar last_inbound_at em todos enrollments ativos do lead
  UPDATE public.crm_cadence_enrollments
  SET last_inbound_at = NEW.created_at
  WHERE lead_id = v_lead_id AND status = 'active';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_whatsapp_inbound_cadence
AFTER INSERT ON public.crm_whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.crm_cadence_handle_inbound();

-- ============================================================
-- SETTINGS GLOBAIS DE JANELA (semente)
-- ============================================================
INSERT INTO public.crm_settings (setting_key, setting_value)
VALUES ('cadence_global_window', jsonb_build_object(
  'window_start', '09:00',
  'window_end', '18:00',
  'weekdays', '[1,2,3,4,5]'::jsonb,
  'timezone', 'America/Sao_Paulo'
))
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- ADICIONAR campo default_whatsapp_instance_id em onboarding_staff
-- (para o modo from_owner com múltiplas instâncias)
-- ============================================================
ALTER TABLE public.onboarding_staff
ADD COLUMN IF NOT EXISTS default_whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;
