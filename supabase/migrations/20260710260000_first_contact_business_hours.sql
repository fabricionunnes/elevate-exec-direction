-- Tempo de primeiro contato: ignora leads que ENTRAM NO FUNIL fora do horário
-- comercial — fim de semana (sáb/dom) e entre 19h e 08h (fuso de Brasília) — porque
-- o time não está trabalhando e o relógio não deve correr. Só banco (mesma assinatura).
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
  reagendamentos bigint,
  primeiro_contato_min numeric
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

  SELECT round(avg(EXTRACT(EPOCH FROM (l.closed_at - COALESCE(l.entered_pipeline_at, l.created_at))) / 86400)::numeric, 1)
  INTO deadline_dias
  FROM crm_leads l
  JOIN crm_stages s ON s.id = l.stage_id
  WHERE s.final_type = 'won' AND l.closed_at IS NOT NULL
    AND l.closed_at >= p_start AND l.closed_at <= p_end
    AND l.closed_at >= COALESCE(l.entered_pipeline_at, l.created_at)
    AND (p_sdr IS NULL OR l.sdr_staff_id = p_sdr OR l.closer_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  SELECT count(DISTINCT h.lead_id)
  INTO qualificacoes
  FROM crm_lead_history h
  WHERE h.field_changed = 'stage_id'
    AND h.new_value IN (SELECT id::text FROM crm_stages WHERE name ILIKE '%qualif%')
    AND h.created_at >= p_start AND h.created_at <= p_end
    AND (p_sdr IS NULL OR h.staff_id = p_sdr)
    AND (p_pipeline IS NULL OR EXISTS (SELECT 1 FROM crm_leads l WHERE l.id = h.lead_id AND l.pipeline_id = p_pipeline));

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

  -- Tempo de primeiro contato — só leads que entraram no funil em HORÁRIO COMERCIAL
  -- (seg-sex, 08h-19h, fuso de Brasília). Fim de semana e noite ficam de fora.
  SELECT round(avg(EXTRACT(EPOCH FROM (x.first_contact - l.entered_pipeline_at)) / 60)
               FILTER (WHERE x.first_contact >= l.entered_pipeline_at)::numeric, 1)
  INTO primeiro_contato_min
  FROM crm_leads l
  CROSS JOIN LATERAL (
    SELECT LEAST(
      (SELECT min(cc.started_at) FROM crm_calls cc WHERE cc.lead_id = l.id),
      (SELECT min(a.completed_at) FROM crm_activities a WHERE a.lead_id = l.id AND a.type = 'call' AND a.status = 'completed'),
      (SELECT min(m.created_at) FROM crm_whatsapp_messages m
         JOIN crm_whatsapp_conversations conv ON conv.id = m.conversation_id
        WHERE conv.lead_id = l.id AND m.direction = 'outbound')
    ) AS first_contact
  ) x
  WHERE l.entered_pipeline_at >= p_start AND l.entered_pipeline_at <= p_end
    AND EXTRACT(dow  FROM (l.entered_pipeline_at AT TIME ZONE 'America/Sao_Paulo')) BETWEEN 1 AND 5
    AND EXTRACT(hour FROM (l.entered_pipeline_at AT TIME ZONE 'America/Sao_Paulo')) >= 8
    AND EXTRACT(hour FROM (l.entered_pipeline_at AT TIME ZONE 'America/Sao_Paulo')) < 19
    AND (p_sdr IS NULL OR l.sdr_staff_id = p_sdr OR l.owner_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_presales_operational_metrics(timestamptz, timestamptz, uuid, uuid) TO authenticated;
