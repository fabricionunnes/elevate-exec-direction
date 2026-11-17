-- 16/11/2026, Fabrício: disparos da Black (convite_black) e da reativação (reativacao_diretor_comercial).
-- "os que não entrarem no grupo é pra fazer follow up por pelo menos 3 dias" e "precisa de pelo menos 9 reuniões".
-- 1) retomada agendada de disparo pausado (official-campaign-dispatch, ação retomar_agendados)
-- 2) follow-up das conversas fixadas num agente: o motor lia 600 conversas sem ordem (eram 4.318 no Funil SE)
-- 3) toque depois de resposta automática do lado do lead (crm-agent-respond, ação toques)
-- 4) follow-up de 3 dias de quem pediu o grupo da Black e não entrou (black-agenda)

alter table whatsapp_official_campaigns add column if not exists auto_resume_at timestamptz;
alter table whatsapp_official_campaigns add column if not exists toque_pos_automatica boolean not null default false;
comment on column whatsapp_official_campaigns.auto_resume_at is 'Disparo pausado que volta sozinho neste horário (official-campaign-dispatch, ação retomar_agendados).';
comment on column whatsapp_official_campaigns.toque_pos_automatica is 'Ligado: quem só devolveu resposta automática recebe até 2 toques do agente do disparo enquanto a janela de 24h está aberta.';

create index if not exists crm_ai_ov_agent_fixadas_idx on crm_ai_agent_conversation_overrides (agent_id) where enabled and locked;
create index if not exists wocr_conversation_idx on whatsapp_official_campaign_recipients (conversation_id) where conversation_id is not null;

-- Conversas fixadas no agente em que o lead já falou e a última mensagem é nossa (candidatas a follow-up).
create or replace function crm_agent_fixadas_followup(p_agent uuid, p_min_minutos int default 15)
returns table (id uuid, instance_id uuid, official_instance_id uuid)
language sql stable security definer set search_path = public as $$
  select c.id, c.instance_id, c.official_instance_id
  from crm_ai_agent_conversation_overrides o
  join crm_whatsapp_conversations c on c.id = o.conversation_id
  where o.agent_id = p_agent and o.channel = 'whatsapp' and o.enabled and o.locked
    and o.updated_at > now() - interval '15 days'
    and c.last_message_direction = 'outbound'
    and c.last_message_at < now() - make_interval(mins => greatest(p_min_minutos, 1))
    and c.last_inbound_at > now() - case when c.instance_id is null and c.official_instance_id is not null
                                         then interval '24 hours' else interval '7 days' end
  order by c.last_message_at desc
  limit 160;
$$;
revoke all on function crm_agent_fixadas_followup(uuid, int) from public, anon, authenticated;
grant execute on function crm_agent_fixadas_followup(uuid, int) to service_role;

-- Toques depois de resposta automática
create table if not exists crm_disparo_toques (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  campaign_id uuid not null,
  n int not null,
  texto text,
  erro text,
  enviado_em timestamptz not null default now(),
  unique (conversation_id, n)
);
alter table crm_disparo_toques enable row level security;
grant select, insert, update, delete on crm_disparo_toques to service_role;
grant select on crm_disparo_toques to authenticated;
drop policy if exists crm_disparo_toques_staff_le on crm_disparo_toques;
create policy crm_disparo_toques_staff_le on crm_disparo_toques for select to authenticated
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));

create or replace function disparo_toque_candidatos(p_limite int default 12, p_espera_min int default 90, p_intervalo_min int default 300)
returns table (conversation_id uuid, campaign_id uuid, agent_id uuid, lead_id uuid, lead_name text, sent_at timestamptz,
               delivered_at timestamptz, official_instance_id uuid, phone text, last_inbound_at timestamptz, toques int)
language sql stable security definer set search_path = public as $$
  select r.conversation_id, r.campaign_id, camp.agent_id, r.lead_id, r.lead_name, r.sent_at, r.delivered_at,
         c.official_instance_id, ct.phone, c.last_inbound_at, coalesce(t.n, 0) as toques
  from whatsapp_official_campaigns camp
  join whatsapp_official_campaign_recipients r on r.campaign_id = camp.id
  join crm_whatsapp_conversations c on c.id = r.conversation_id
  join crm_whatsapp_contacts ct on ct.id = c.contact_id
  join crm_ai_agent_conversation_overrides o on o.conversation_id = c.id and o.channel = 'whatsapp' and o.enabled and o.agent_id = camp.agent_id
  left join lateral (select count(*)::int as n, count(*) filter (where x.erro is null)::int as enviados, max(x.enviado_em) as ultimo
                     from crm_disparo_toques x where x.conversation_id = r.conversation_id) t on true
  where camp.toque_pos_automatica and camp.agent_id is not null and camp.created_at > now() - interval '5 days'
    and r.sent_at > now() - interval '3 days'
    and c.official_instance_id is not null
    and c.last_inbound_at > r.sent_at
    and c.last_inbound_at > now() - interval '23 hours'
    and c.last_inbound_at < now() - make_interval(mins => p_espera_min)
    and (
      (coalesce(t.n, 0) = 0 and c.last_message_direction = 'inbound')
      or (coalesce(t.n, 0) = 1 and t.enviados = 1 and c.last_message_direction = 'outbound' and c.last_inbound_at < t.ultimo
          and t.ultimo < now() - make_interval(mins => p_intervalo_min))
    )
  order by c.last_inbound_at asc
  limit greatest(1, least(p_limite, 40));
$$;
revoke all on function disparo_toque_candidatos(int, int, int) from public, anon, authenticated;
grant execute on function disparo_toque_candidatos(int, int, int) to service_role;

-- Black: quem falou com a gente depois do convite e ainda não está no grupo
create table if not exists black_followup_grupo (
  lead_id uuid primary key,
  conversa_oficial uuid,
  telefone text,
  pediu_em timestamptz not null,
  toques int not null default 0,
  ultimo_toque_em timestamptz,
  ultimo_canal text,
  encerrado_em timestamptz,
  motivo_encerramento text,
  erro text,
  criado_em timestamptz not null default now()
);
alter table black_followup_grupo enable row level security;
grant select, insert, update, delete on black_followup_grupo to service_role;
grant select on black_followup_grupo to authenticated;
drop policy if exists black_followup_grupo_staff_le on black_followup_grupo;
create policy black_followup_grupo_staff_le on black_followup_grupo for select to authenticated
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));

-- Registra quem pediu o grupo (clicou no botão ou escreveu depois do convite) e ainda está fora dele.
-- Resposta que chega em até 45 s da entrega é resposta automática (medido em 16/11: nenhuma pessoa escreveu antes de 89 s).
create or replace function black_followup_registrar()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into black_followup_grupo (lead_id, conversa_oficial, telefone, pediu_em)
  select distinct on (r.lead_id) r.lead_id, r.conversation_id, r.phone, m.created_at
  from whatsapp_official_campaigns camp
  join whatsapp_official_campaign_recipients r on r.campaign_id = camp.id
  join crm_leads l on l.id = r.lead_id
  join crm_whatsapp_messages m on m.conversation_id = r.conversation_id and m.direction = 'inbound' and m.created_at > r.sent_at
  where camp.template_name in ('convite_black', 'oferta_projeto_comercial_completo') and camp.created_at > '2026-11-16'
    and r.sent_at is not null and r.conversation_id is not null and r.lead_id is not null
    and l.pipeline_id = 'c6684582-3997-42ed-bf0f-2e418053962c'
    and l.stage_id in ('34703759-efa1-4b14-b05c-d1a3ec1a4cb2', '68ea903a-9385-48bc-9701-108b0974afb6', 'bd85787b-a72c-4aec-996c-48c81ccc881b')
    and m.content !~* '^\s*parar de receber'
    and (m.content ~* '^\s*(quero entrar no grupo|quero saber mais)'
         or m.created_at > greatest(r.sent_at, coalesce(r.delivered_at, r.sent_at)) + interval '45 seconds')
  order by r.lead_id, m.created_at
  on conflict (lead_id) do nothing;
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function black_followup_registrar() from public, anon, authenticated;
grant execute on function black_followup_registrar() to service_role;

-- Mensagem automática do lado do lead (ou "parar de receber") logo depois de um disparo:
-- não conta como não lida, não entra em Esperando e não gera aviso (whatsapp-official-webhook).
alter table crm_whatsapp_messages add column if not exists automatica boolean not null default false;
comment on column crm_whatsapp_messages.automatica is 'Resposta automática do lado do lead (ou clique em "parar de receber") logo depois de um disparo oficial. Não conta como não lida, não entra em Esperando e não gera aviso.';

-- Rodada dos toques a cada 5 min (a função só envia em horário comercial)
do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'crm-agent-toques') then
    perform cron.schedule('crm-agent-toques', '*/5 * * * *', $job$
      select net.http_post(
        url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-agent-respond',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{"action":"toques","limite":12}'::jsonb,
        timeout_milliseconds := 150000);
    $job$);
  end if;
end $do$;
