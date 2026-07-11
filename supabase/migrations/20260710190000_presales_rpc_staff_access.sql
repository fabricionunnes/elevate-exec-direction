-- Fix: as RPCs de pré-vendas exigiam tenant_id IS NULL, mas o CRM libera acesso a
-- QUALQUER staff ativo. Staff UNV com tenant preenchido (ex.: a conta do próprio
-- Fabrício com tenant do owner) entrava no CRM mas recebia "Acesso restrito" na RPC,
-- e o dashboard zerava tudo. Verificado: nenhum staff com tenant não-nulo tem acesso
-- ao CRM além de masters da UNV, então liberar por is_active não vaza dado de cliente.
-- Alinha a checagem da RPC com a regra de acesso do CRM (staff ativo).
CREATE OR REPLACE FUNCTION public.get_presales_operational_metrics(
  p_start timestamptz,
  p_end   timestamptz,
  p_sdr   uuid DEFAULT NULL,
  p_pipeline uuid DEFAULT NULL
)
RETURNS TABLE (
  ligacoes_realizadas bigint,
  ligacoes_atendidas bigint,
  whatsapp_pessoas bigint,
  leads_perdidos_sem_resposta bigint,
  deadline_dias numeric,
  qualificacoes bigint,
  cancelamentos bigint,
  reagendamentos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dialer_total bigint;
  dialer_atendidas bigint;
  tarefas_concluidas bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Acesso restrito ao staff';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE c.duration_seconds >= 50)
  INTO dialer_total, dialer_atendidas
  FROM crm_calls c
  LEFT JOIN crm_leads l ON l.id = c.lead_id
  WHERE c.started_at >= p_start AND c.started_at <= p_end
    AND (p_sdr IS NULL OR c.agent_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  SELECT count(*)
  INTO tarefas_concluidas
  FROM crm_activities a
  LEFT JOIN crm_leads l ON l.id = a.lead_id
  WHERE a.type = 'call' AND a.status = 'completed'
    AND a.responsible_staff_id IS NOT NULL
    AND a.created_at >= p_start AND a.created_at <= p_end
    AND (p_sdr IS NULL OR a.responsible_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline)
    AND NOT EXISTS (SELECT 1 FROM crm_calls c WHERE c.activity_id = a.id);

  ligacoes_realizadas := COALESCE(dialer_total, 0) + COALESCE(tarefas_concluidas, 0);
  ligacoes_atendidas  := COALESCE(dialer_atendidas, 0) + COALESCE(tarefas_concluidas, 0);

  SELECT count(*)
  INTO whatsapp_pessoas
  FROM crm_whatsapp_conversations conv
  WHERE (p_sdr IS NULL OR conv.assigned_to = p_sdr)
    AND EXISTS (
      SELECT 1 FROM crm_whatsapp_messages m
      WHERE m.conversation_id = conv.id AND m.direction = 'inbound'
        AND m.created_at >= p_start AND m.created_at <= p_end
    );

  SELECT count(*)
  INTO leads_perdidos_sem_resposta
  FROM crm_leads l
  WHERE l.loss_reason_id IN (
      SELECT id FROM crm_loss_reasons WHERE name ILIKE '%sem resposta%' OR name ILIKE '%ghosting%'
    )
    AND l.closed_at >= p_start AND l.closed_at <= p_end
    AND (p_sdr IS NULL OR l.sdr_staff_id = p_sdr OR l.owner_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  SELECT round(avg(EXTRACT(EPOCH FROM (l.closed_at - l.created_at)) / 86400)::numeric, 1)
  INTO deadline_dias
  FROM crm_leads l
  JOIN crm_stages s ON s.id = l.stage_id
  WHERE s.final_type = 'won' AND l.closed_at IS NOT NULL
    AND l.closed_at >= p_start AND l.closed_at <= p_end AND l.closed_at >= l.created_at
    AND (p_sdr IS NULL OR l.sdr_staff_id = p_sdr OR l.closer_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  SELECT count(DISTINCT h.lead_id)
  INTO qualificacoes
  FROM crm_lead_history h
  JOIN crm_stages s ON s.id::text = h.new_value
  LEFT JOIN crm_leads l ON l.id = h.lead_id
  WHERE h.field_changed = 'stage_id' AND s.name ILIKE '%qualif%'
    AND h.created_at >= p_start AND h.created_at <= p_end
    AND (p_sdr IS NULL OR h.staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  SELECT count(*)
  INTO cancelamentos
  FROM crm_activities a
  LEFT JOIN crm_leads l ON l.id = a.lead_id
  WHERE a.type = 'meeting' AND a.status = 'cancelled'
    AND a.scheduled_at >= p_start AND a.scheduled_at <= p_end
    AND (p_sdr IS NULL OR a.responsible_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  SELECT count(*)
  INTO reagendamentos
  FROM (
    SELECT e.lead_id
    FROM crm_meeting_events e
    LEFT JOIN crm_leads l ON l.id = e.lead_id
    WHERE e.event_type = 'scheduled'
      AND e.event_date >= p_start AND e.event_date <= p_end
      AND (p_sdr IS NULL OR e.credited_staff_id = p_sdr)
      AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline)
    GROUP BY e.lead_id HAVING count(*) >= 2
  ) x;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_presales_operational_metrics(timestamptz, timestamptz, uuid, uuid) TO authenticated;

-- set_presales_target: mantém a exigência de cargo, mas sem tenant_id IS NULL
CREATE OR REPLACE FUNCTION public.set_presales_target(
  p_month int, p_year int, p_target_type text, p_value numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('master','admin','head_comercial')
  ) THEN
    RAISE EXCEPTION 'Só master/admin/head comercial pode definir metas';
  END IF;

  IF p_target_type NOT IN ('calls','meetings') THEN
    RAISE EXCEPTION 'target_type inválido';
  END IF;

  UPDATE crm_sales_targets
     SET target_value = p_value, updated_at = now()
   WHERE staff_id IS NULL AND month = p_month AND year = p_year AND target_type = p_target_type;

  IF NOT FOUND THEN
    INSERT INTO crm_sales_targets (staff_id, target_type, target_value, month, year)
    VALUES (NULL, p_target_type, p_value, p_month, p_year);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_presales_target(int, int, text, numeric) TO authenticated;
