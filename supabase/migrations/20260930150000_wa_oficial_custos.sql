-- Medidor de mensagens enviadas pela API oficial do WhatsApp (Meta cobra por mensagem a partir de 01/10/2026)
alter table public.ai_usage_config
  add column if not exists wa_teto_mes integer not null default 6000,
  add column if not exists wa_preco_servico_brl numeric;
create or replace function public.wa_oficial_custos(p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare out jsonb; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    raise exception 'sem acesso';
  end if;
  with cfg as (select wa_teto_mes, wa_preco_servico_brl from ai_usage_config where id),
  base as (
    select c.official_instance_id inst, (m.created_at at time zone 'America/Sao_Paulo')::date dia, m.conversation_id, coalesce(m.is_ai,false) ia
    from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
    where c.official_instance_id is not null and m.direction = 'outbound' and m.deleted_at is null
      and m.created_at >= (least(p_de, date_trunc('month', hoje)::date))::timestamp at time zone 'America/Sao_Paulo'
  ),
  inst as (
    select o.id, o.display_name, o.phone_number, o.status,
      coalesce((select wa_preco_servico_brl from cfg), (o.pricing_rates->>'UTILITY')::numeric, 0.04) preco_brl
    from whatsapp_official_instances o
  )
  select jsonb_build_object(
    'teto_mes', (select wa_teto_mes from cfg),
    'preco_config', (select wa_preco_servico_brl from cfg),
    'dias_mes', extract(day from (date_trunc('month', hoje) + interval '1 month - 1 day'))::int,
    'dia_mes', extract(day from hoje)::int,
    'numeros', (select coalesce(jsonb_agg(x order by (x->>'mes')::int desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'id', i.id, 'nome', i.display_name, 'telefone', i.phone_number, 'status', i.status, 'preco_brl', i.preco_brl,
        'hoje', (select count(*) from base b where b.inst = i.id and b.dia = hoje),
        'ontem', (select count(*) from base b where b.inst = i.id and b.dia = hoje - 1),
        'mes', (select count(*) from base b where b.inst = i.id and b.dia >= date_trunc('month', hoje)::date),
        'mes_ia', (select count(*) from base b where b.inst = i.id and b.dia >= date_trunc('month', hoje)::date and b.ia),
        'conversas_mes', (select count(distinct b.conversation_id) from base b where b.inst = i.id and b.dia >= date_trunc('month', hoje)::date),
        'periodo', (select count(*) from base b where b.inst = i.id and b.dia between p_de and p_ate),
        'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(d.dia,'YYYY-MM-DD'), 'msgs', d.n) order by d.dia), '[]'::jsonb)
                    from (select dia, count(*) n from base b where b.inst = i.id and b.dia between p_de and p_ate group by dia) d)
      ) x from inst i) y)
  ) into out;
  return out;
end $fn$;
grant execute on function public.wa_oficial_custos(date, date) to authenticated;
create or replace function public.wa_oficial_contagem(p_ini timestamptz, p_fim timestamptz)
returns table(instance_id uuid, msgs bigint) language sql stable security definer set search_path = public as $fn$
  select c.official_instance_id, count(*)
  from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
  where c.official_instance_id is not null and m.direction = 'outbound' and m.deleted_at is null
    and m.created_at >= p_ini and m.created_at < p_fim
  group by 1;
$fn$;
revoke all on function public.wa_oficial_contagem(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.wa_oficial_contagem(timestamptz, timestamptz) to service_role;
