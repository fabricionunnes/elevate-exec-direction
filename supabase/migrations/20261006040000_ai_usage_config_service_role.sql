-- ai_usage_config guarda o telefone que recebe os avisos (custo de IA, WhatsApp
-- oficial, saldo do Meta, resumo semanal). A tabela não tinha grant pra
-- service_role: as edge functions liam nulo e caíam no número fixo de reserva,
-- e a que não tinha reserva (painel-resumo-semanal) não enviava.
grant select on public.ai_usage_config to service_role;
