create or replace function public.crm_agent_meetings(p_days int default 30)
returns table(
  activity_id uuid, title text, scheduled_at timestamptz, created_at timestamptz, status text,
  meeting_link text, lead_id uuid, lead_name text, company text, staff_name text,
  agent_id uuid, agent_name text, outcome text, fora_icp boolean, fechou boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare st record;
begin
  select s.id, s.tenant_id into st from onboarding_staff s
  where s.user_id = auth.uid() and s.is_active = true limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;

  return query
  with base as (
    select a.id, a.title, a.scheduled_at, a.created_at, a.status, a.meeting_link, a.lead_id,
      l.name lead_name, l.company, os.name staff_name,
      coalesce(a.ai_agent_id, ag2.id) agente_id,
      coalesce(ag.name, ag2.name) agente_nome,
      sg.name etapa, sg.final_type
    from crm_activities a
    left join crm_leads l on l.id = a.lead_id
    left join crm_stages sg on sg.id = l.stage_id
    left join onboarding_staff os on os.id = a.responsible_staff_id
    left join crm_ai_agents ag on ag.id = a.ai_agent_id
    left join crm_ai_agents ag2 on a.ai_agent_id is null
      and ag2.name = substring(a.description from 'agente IA "([^"]+)"')
    where a.type = 'meeting'
      and (a.ai_agent_id is not null or a.description ilike 'Agendada pelo agente%')
      and (p_days is null or a.created_at >= now() - make_interval(days => p_days))
  ), ev as (
    -- desfecho registrado na reunião (mesma prioridade da tela de Reuniões)
    select b.id aid,
      max(case e.event_type when 'realized' then 4 when 'realized_out_of_icp' then 4
        when 'no_show' then 3 when 'out_of_icp' then 2 else 1 end) prio,
      bool_or(e.event_type in ('out_of_icp','realized_out_of_icp')) icp
    from base b
    join crm_meeting_events e on e.lead_id = b.lead_id
      and e.event_date >= b.created_at - interval '5 minutes'
    group by b.id
  )
  select b.id, b.title, b.scheduled_at, b.created_at, b.status, b.meeting_link, b.lead_id,
    b.lead_name, b.company, b.staff_name, b.agente_id, b.agente_nome,
    case
      when b.status in ('cancelled','canceled') then 'cancelada'
      when b.status = 'no_show' or ev.prio = 3 then 'no_show'
      when b.status = 'completed' or ev.prio = 4 then 'realizada'
      when coalesce(ev.prio, 0) = 2 then 'fora_icp'
      when b.scheduled_at > now() then 'agendada'
      else 'sem_registro'
    end::text,
    coalesce(ev.icp, false) or b.etapa ~* 'fora do icp|fora de perfil|sem fit',
    coalesce(b.final_type = 'won', false)
  from base b left join ev on ev.aid = b.id
  order by b.scheduled_at desc;
end $$;

grant execute on function public.crm_agent_meetings(int) to authenticated;
notify pgrst, 'reload schema';
