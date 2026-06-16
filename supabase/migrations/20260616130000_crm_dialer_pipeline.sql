-- ============ DISCADOR: funil dedicado + vínculo + sessões de agente ============

-- vínculo da campanha com um funil e a etapa-gatilho (1ª etapa)
ALTER TABLE public.crm_dialer_campaigns ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.crm_pipelines(id);
ALTER TABLE public.crm_dialer_campaigns ADD COLUMN IF NOT EXISTS trigger_stage_id UUID REFERENCES public.crm_stages(id);

-- sessões do agente no discador (pra medir tempo logado / "tempo no discador")
CREATE TABLE IF NOT EXISTS public.crm_dialer_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_staff_id UUID REFERENCES public.onboarding_staff(id),
  campaign_id UUID REFERENCES public.crm_dialer_campaigns(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_dialer_sessions_agent ON public.crm_dialer_sessions(agent_staff_id);

ALTER TABLE public.crm_dialer_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CRM users manage dialer sessions" ON public.crm_dialer_sessions;
CREATE POLICY "CRM users manage dialer sessions" ON public.crm_dialer_sessions FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());

-- funil "Discador" + etapas (idempotente)
DO $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM public.crm_pipelines WHERE name = 'Discador' LIMIT 1;
  IF pid IS NULL THEN
    INSERT INTO public.crm_pipelines (name, description, is_active, sort_order)
    VALUES ('Discador', 'Funil do discador: todo lead que entra na 1ª etapa (Para ligar) vai pra fila de ligação quando a campanha iniciar.', true, 100)
    RETURNING id INTO pid;

    INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color, is_final, final_type) VALUES
      (pid, 'Para ligar', 0, '#3b82f6', false, NULL),
      (pid, 'Em qualificação', 1, '#f59e0b', false, NULL),
      (pid, 'Qualificado', 2, '#10b981', false, NULL),
      (pid, 'Retornar depois', 3, '#6366f1', false, NULL),
      (pid, 'Sem interesse', 4, '#ef4444', true, 'lost');
  END IF;
END $$;
