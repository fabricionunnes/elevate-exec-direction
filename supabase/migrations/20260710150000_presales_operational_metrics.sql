-- Métricas operacionais da aba Pré-vendas do CRM.
-- Agrega no servidor (crm_calls tem milhares de linhas/mês e o inbound de WhatsApp
-- passa de 1000 — buscar no cliente cortaria em 1000 e daria número errado).
-- Regras:
--  * Ligações realizadas  = ligações do discador + tarefas de ligação concluídas
--                           que NÃO vieram do discador (evita contar em dobro).
--  * Ligações atendidas   = ligações do discador com >= 50s + tarefas de ligação
--                           concluídas (marcadas na mão = conversa real).
--  * Pessoas via WhatsApp  = conversas com ao menos 1 mensagem recebida (inbound) no período.
--  * Perdidos sem resposta = leads com motivo de perda "Sem resposta/Ghosting" fechados no período.
--  * Deadline de fechamento= média de dias entre a chegada do lead e o fechamento (vendas ganhas).
-- Filtros: período (obrigatório), SDR (null = todos) e funil (null = todos).
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
  deadline_dias numeric
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
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Acesso restrito ao staff UNV';
  END IF;

  -- Ligações do discador no período (pipeline via lead)
  SELECT
    count(*),
    count(*) FILTER (WHERE c.duration_seconds >= 50)
  INTO dialer_total, dialer_atendidas
  FROM crm_calls c
  LEFT JOIN crm_leads l ON l.id = c.lead_id
  WHERE c.started_at >= p_start AND c.started_at <= p_end
    AND (p_sdr IS NULL OR c.agent_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  -- Tarefas de ligação concluídas que NÃO vieram do discador.
  -- Exige responsible_staff_id: uma ligação registrada por uma pessoa. Sem isso
  -- entrariam as tarefas de Playbook (stage actions "Playbook ·"), que são lembretes
  -- de processo auto-criados sem responsável, não ligações reais.
  SELECT count(*)
  INTO tarefas_concluidas
  FROM crm_activities a
  LEFT JOIN crm_leads l ON l.id = a.lead_id
  WHERE a.type = 'call'
    AND a.status = 'completed'
    AND a.responsible_staff_id IS NOT NULL
    AND a.created_at >= p_start AND a.created_at <= p_end
    AND (p_sdr IS NULL OR a.responsible_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline)
    AND NOT EXISTS (SELECT 1 FROM crm_calls c WHERE c.activity_id = a.id);

  ligacoes_realizadas := COALESCE(dialer_total, 0) + COALESCE(tarefas_concluidas, 0);
  ligacoes_atendidas  := COALESCE(dialer_atendidas, 0) + COALESCE(tarefas_concluidas, 0);

  -- Pessoas que entraram em contato via WhatsApp (conversa com inbound no período)
  SELECT count(*)
  INTO whatsapp_pessoas
  FROM crm_whatsapp_conversations conv
  WHERE (p_sdr IS NULL OR conv.assigned_to = p_sdr)
    AND EXISTS (
      SELECT 1 FROM crm_whatsapp_messages m
      WHERE m.conversation_id = conv.id
        AND m.direction = 'inbound'
        AND m.created_at >= p_start AND m.created_at <= p_end
    );

  -- Leads perdidos por falta de resposta (motivo "Sem resposta/Ghosting")
  SELECT count(*)
  INTO leads_perdidos_sem_resposta
  FROM crm_leads l
  WHERE l.loss_reason_id IN (
      SELECT id FROM crm_loss_reasons
      WHERE name ILIKE '%sem resposta%' OR name ILIKE '%ghosting%'
    )
    AND l.closed_at >= p_start AND l.closed_at <= p_end
    AND (p_sdr IS NULL OR l.sdr_staff_id = p_sdr OR l.owner_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  -- Deadline de fechamento: média de dias entre chegada do lead e a venda ganha
  SELECT round(avg(EXTRACT(EPOCH FROM (l.closed_at - l.created_at)) / 86400)::numeric, 1)
  INTO deadline_dias
  FROM crm_leads l
  JOIN crm_stages s ON s.id = l.stage_id
  WHERE s.final_type = 'won'
    AND l.closed_at IS NOT NULL
    AND l.closed_at >= p_start AND l.closed_at <= p_end
    AND l.closed_at >= l.created_at
    AND (p_sdr IS NULL OR l.sdr_staff_id = p_sdr OR l.closer_staff_id = p_sdr)
    AND (p_pipeline IS NULL OR l.pipeline_id = p_pipeline);

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_presales_operational_metrics(timestamptz, timestamptz, uuid, uuid) TO authenticated;
