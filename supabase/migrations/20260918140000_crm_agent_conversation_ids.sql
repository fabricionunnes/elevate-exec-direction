-- 18/09/2026: filtro "Agente de IA" no Atendimento. Devolve as conversas em que o agente atuou
-- (respondeu/sugeriu) ou está ligado por ajuste manual. p_agent nulo = qualquer agente.
create or replace function public.crm_agent_conversation_ids(p_agent uuid default null)
returns table(conversation_id uuid) language sql stable security definer set search_path = public as $$
  select distinct x.cid from (
    select r.conversation_id cid from crm_ai_agent_runs r
      where r.conversation_id is not null and (p_agent is null or r.agent_id = p_agent)
        and (r.outcome like 'sent%' or r.outcome like 'suggest%' or r.mode = 'followup')
    union
    select o.conversation_id from crm_ai_agent_conversation_overrides o
      where o.enabled and o.conversation_id is not null and (p_agent is null or o.agent_id = p_agent)
  ) x
  where exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active);
$$;
revoke all on function public.crm_agent_conversation_ids(uuid) from public;
grant execute on function public.crm_agent_conversation_ids(uuid) to authenticated;
