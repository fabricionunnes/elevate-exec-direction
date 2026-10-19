-- Vigia "lead esperando o agente" (Fabrício, 19/10/2026: "direto a IA está parando de
-- responder, e tenho que ficar conferindo toda hora, precisa resolver isso em definitivo").
-- Lista conversas (WhatsApp e Instagram) em que a IA já respondeu antes, o lead mandou a
-- última mensagem há mais de 30 min (até 24h) e ninguém respondeu. O ai-health-check lê
-- isso a cada 30 min, tenta de novo quando foi erro passageiro e avisa no WhatsApp.

create table if not exists public.crm_agent_silence_alerts (
  id bigserial primary key,
  conversation_id uuid not null,
  channel text not null,
  inbound_at timestamptz not null,
  motivo text,
  retentou boolean not null default false,
  avisou boolean not null default false,
  created_at timestamptz not null default now(),
  unique (conversation_id, channel, inbound_at)
);
alter table public.crm_agent_silence_alerts enable row level security;
-- só service_role mexe (edge function); ninguém do app precisa ler

create or replace function public.crm_agent_leads_esperando(p_min_minutos int default 30, p_max_horas int default 24)
returns table (
  conversation_id uuid, channel text, lead_id uuid, lead_name text, contato text,
  ult_lead timestamptz, minutos int, ultimo_run_outcome text, ultimo_run_erro text, ultimo_run_at timestamptz,
  tentativas_depois int, override_enabled boolean, override_por_pessoa boolean, ja_avisado boolean
)
language sql stable security definer set search_path = public as $$
  with wa as (
    select m.conversation_id,
           max(m.created_at) filter (where m.direction='inbound') ult_lead,
           max(m.created_at) filter (where m.direction='outbound') ult_nossa,
           bool_or(m.direction='outbound' and m.is_ai) teve_ia
    from crm_whatsapp_messages m
    where m.created_at > now() - interval '7 days' and m.deleted_at is null
    group by 1
  ), ig as (
    select m.conversation_id,
           max(m.created_at) filter (where m.direction='inbound') ult_lead,
           max(m.created_at) filter (where m.direction='outbound') ult_nossa,
           bool_or(m.direction='outbound' and m.is_ai) teve_ia
    from instagram_messages m
    where m.created_at > now() - interval '7 days' and coalesce(m.is_reaction,false) = false
    group by 1
  ), base as (
    select 'whatsapp'::text canal, w.conversation_id, c.lead_id, w.ult_lead, w.ult_nossa, w.teve_ia,
           coalesce(l.name, ct.name, ct.phone) lead_name, ct.phone contato
    from wa w join crm_whatsapp_conversations c on c.id = w.conversation_id
    left join crm_whatsapp_contacts ct on ct.id = c.contact_id
    left join crm_leads l on l.id = c.lead_id
    union all
    select 'instagram', i.conversation_id, c.lead_id, i.ult_lead, i.ult_nossa, i.teve_ia,
           coalesce(l.name, ct.name, ct.username), ct.username
    from ig i join instagram_conversations c on c.id = i.conversation_id
    left join instagram_contacts ct on ct.id = c.contact_id
    left join crm_leads l on l.id = c.lead_id
  )
  select b.conversation_id, b.canal, b.lead_id, b.lead_name, b.contato, b.ult_lead,
         (extract(epoch from now() - b.ult_lead) / 60)::int,
         r.outcome, r.error, r.created_at,
         (select count(*)::int from crm_ai_agent_runs x where x.conversation_id = b.conversation_id and x.created_at > b.ult_lead),
         o.enabled, (o.updated_by is not null),
         exists (select 1 from crm_agent_silence_alerts a where a.conversation_id = b.conversation_id and a.channel = b.canal and a.inbound_at = b.ult_lead and a.avisou)
  from base b
  left join crm_leads l on l.id = b.lead_id
  left join crm_stages st on st.id = l.stage_id
  left join crm_ai_agent_conversation_overrides o on o.conversation_id = b.conversation_id and o.channel = b.canal
  left join lateral (
    select x.outcome, x.error, x.created_at from crm_ai_agent_runs x
    where x.conversation_id = b.conversation_id order by x.created_at desc limit 1
  ) r on true
  where b.teve_ia
    and b.ult_lead < now() - make_interval(mins => p_min_minutos)
    and b.ult_lead > now() - make_interval(hours => p_max_horas)
    and (b.ult_nossa is null or b.ult_nossa < b.ult_lead)
    and coalesce(st.final_type, '') not in ('won', 'lost')
  order by b.ult_lead desc;
$$;
revoke all on function public.crm_agent_leads_esperando(int, int) from public, anon, authenticated;
-- a edge roda com service_role; sem este grant dava "permission denied for function"
grant execute on function public.crm_agent_leads_esperando(int, int) to service_role;
