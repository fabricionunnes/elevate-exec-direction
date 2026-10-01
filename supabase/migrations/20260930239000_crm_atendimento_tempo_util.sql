-- Atendimento: tempo de resposta em DUAS medidas (decisão do Fabrício, 30/09/2026: "mostrar os 2 lados").
-- Principal = tempo ÚTIL (só os segundos dentro do expediente, via crm_business_seconds_between, que lê
-- crm_business_hours / crm_holidays e cai em seg a sex 08h às 18h se não houver cadastro). Secundário =
-- tempo corrido, como já era. Mensagem que chega às 22h e é respondida às 08:03 do dia útil seguinte conta
-- 3 min úteis. Também marca a conversa cuja 1ª mensagem chegou fora do expediente e mede a espera corrida
-- delas (o custo de não ter atendimento à noite). Conversas mescladas (merged_into) saem da conta.
create or replace function public.crm_atendimento_dashboard(
  p_from timestamptz, p_to timestamptz, p_atendente uuid default null, p_setor uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_esc jsonb; v_ids uuid[];
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Recorte por papel (Fabrício, 30/09/2026): closer/sdr só o próprio; head a equipe comercial; master/admin tudo.
  v_esc := public.crm_escopo_atual();
  v_ids := public.crm_escopo_ids(v_esc);
  p_atendente := case when v_ids is null then p_atendente when p_atendente = any(v_ids) then p_atendente
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

  with conv as (
    select c.id, 'whatsapp'::text plataforma, c.status, c.assigned_to, c.sector_id, c.lead_id, c.created_at, c.last_message_at,
           c.last_message_direction,
           coalesce(nullif(wi.display_name, ''), wi.instance_name, nullif(oi.display_name, ''), oi.phone_number, 'WhatsApp') canal,
           coalesce(nullif(ct.name, ''), ct.phone) contato
      from crm_whatsapp_conversations c
      left join whatsapp_instances wi on wi.id = c.instance_id
      left join whatsapp_official_instances oi on oi.id = c.official_instance_id
      left join crm_whatsapp_contacts ct on ct.id = c.contact_id
     where c.created_at >= p_from and c.created_at < p_to and c.merged_into is null
       and (p_atendente is null or c.assigned_to = p_atendente)
       and (v_ids is null or c.assigned_to = any(v_ids))
       and (p_setor is null or c.sector_id = p_setor)
    union all
    select c.id, 'instagram', c.status, c.assigned_to, null::uuid, c.lead_id, c.created_at, c.last_message_at,
           (select m.direction from instagram_messages m where m.conversation_id = c.id order by coalesce(m.timestamp, m.created_at) desc limit 1),
           coalesce(nullif(ii.instagram_username, ''), ii.instance_name, 'Instagram'),
           coalesce(nullif(ct.name, ''), ct.username)
      from instagram_conversations c
      left join instagram_instances ii on ii.id = c.instance_id
      left join instagram_contacts ct on ct.id = c.contact_id
     where c.created_at >= p_from and c.created_at < p_to
       and (p_atendente is null or c.assigned_to = p_atendente)
       and (v_ids is null or c.assigned_to = any(v_ids))
       and p_setor is null
  ),
  tempos as (
    select cv.*, x.first_in, x.first_out, x.first_human,
           extract(epoch from (x.first_out - x.first_in)) inicio_s,
           extract(epoch from (x.first_human - x.first_in)) resposta_s,
           -- tempo ÚTIL: só os segundos dentro do expediente (crm_business_hours / crm_holidays, Brasília)
           case when x.first_out is not null then public.crm_business_seconds_between(x.first_in, x.first_out) end inicio_util_s,
           case when x.first_human is not null then public.crm_business_seconds_between(x.first_in, x.first_human) end resposta_util_s,
           -- a 1ª mensagem do cliente chegou fora do expediente?
           (x.first_in is not null and public.crm_business_seconds_between(x.first_in, x.first_in + interval '1 second') = 0) fora_expediente
      from conv cv
      left join lateral (
        select fi.first_in,
               (select min(m.created_at) from crm_whatsapp_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound' and m.deleted_at is null and m.created_at > fi.first_in) first_out,
               (select min(m.created_at) from crm_whatsapp_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound' and m.deleted_at is null
                   and m.sent_by is not null and coalesce(m.is_ai, false) = false and m.created_at > fi.first_in) first_human
          from (select min(m.created_at) first_in from crm_whatsapp_messages m
                 where m.conversation_id = cv.id and m.direction = 'inbound' and m.deleted_at is null) fi
         where cv.plataforma = 'whatsapp'
        union all
        select fi.first_in,
               (select min(coalesce(m.timestamp, m.created_at)) from instagram_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound' and coalesce(m.timestamp, m.created_at) > fi.first_in),
               (select min(coalesce(m.timestamp, m.created_at)) from instagram_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound'
                   and m.sent_by is not null and coalesce(m.is_ai, false) = false and coalesce(m.timestamp, m.created_at) > fi.first_in)
          from (select min(coalesce(m.timestamp, m.created_at)) first_in from instagram_messages m
                 where m.conversation_id = cv.id and m.direction = 'inbound') fi
         where cv.plataforma = 'instagram'
      ) x on true
  ),
  kpi as (
    select count(*) iniciadas,
           count(*) filter (where status = 'closed') finalizadas,
           count(*) filter (where status <> 'closed') abertas,
           count(*) filter (where status <> 'closed' and last_message_direction = 'inbound') aguardando,
           count(*) filter (where first_in is not null and first_out is null) sem_resposta,
           count(*) filter (where first_in is not null) recebidas,
           round(avg(inicio_s) filter (where inicio_s is not null and inicio_s >= 0)) inicio_medio_s,
           round(percentile_cont(0.5) within group (order by inicio_s) filter (where inicio_s is not null and inicio_s >= 0)) inicio_mediana_s,
           round(avg(resposta_s) filter (where resposta_s is not null and resposta_s >= 0)) resposta_media_s,
           count(*) filter (where inicio_s is not null and inicio_s <= 300) respondidas_5min,
           round(percentile_cont(0.5) within group (order by resposta_s) filter (where resposta_s is not null and resposta_s >= 0)) resposta_mediana_s,
           round(avg(inicio_util_s) filter (where inicio_util_s is not null)) inicio_util_medio_s,
           round(percentile_cont(0.5) within group (order by inicio_util_s) filter (where inicio_util_s is not null)) inicio_util_mediana_s,
           round(avg(resposta_util_s) filter (where resposta_util_s is not null)) resposta_util_media_s,
           round(percentile_cont(0.5) within group (order by resposta_util_s) filter (where resposta_util_s is not null)) resposta_util_mediana_s,
           count(*) filter (where inicio_util_s is not null and inicio_util_s <= 300) respondidas_5min_util,
           count(*) filter (where fora_expediente) fora_expediente,
           count(*) filter (where fora_expediente and first_out is null) fora_expediente_sem_resposta,
           round(avg(inicio_s) filter (where fora_expediente and inicio_s >= 0)) fora_expediente_espera_media_s,
           round(avg(inicio_s) filter (where not fora_expediente and inicio_s >= 0)) dentro_expediente_espera_media_s
      from tempos
  ),
  -- demanda: toda mensagem recebida no período, por dia da semana e hora (Brasília).
  -- Com filtro de atendente/setor, só as conversas dele.
  entradas as (
    select (m.created_at at time zone 'America/Sao_Paulo') ts
      from crm_whatsapp_messages m
     where m.direction = 'inbound' and m.created_at >= p_from and m.created_at < p_to
       and ((p_atendente is null and p_setor is null and v_ids is null) or exists (
             select 1 from crm_whatsapp_conversations c where c.id = m.conversation_id
               and (p_atendente is null or c.assigned_to = p_atendente) and (p_setor is null or c.sector_id = p_setor)
               and (v_ids is null or c.assigned_to = any(v_ids))))
    union all
    select (coalesce(m.timestamp, m.created_at) at time zone 'America/Sao_Paulo')
      from instagram_messages m
     where m.direction = 'inbound' and coalesce(m.timestamp, m.created_at) >= p_from and coalesce(m.timestamp, m.created_at) < p_to
       and p_setor is null
       and ((p_atendente is null and v_ids is null) or exists (select 1 from instagram_conversations c where c.id = m.conversation_id
             and (p_atendente is null or c.assigned_to = p_atendente) and (v_ids is null or c.assigned_to = any(v_ids))))
  )
  select jsonb_build_object(
    'escopo', v_esc,
    -- expediente que está valendo (null = padrão da função: seg a sex, 08:00 às 18:00)
    'expediente', (select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'is_open', h.is_open, 'open', to_char(h.open_time, 'HH24:MI'), 'close', to_char(h.close_time, 'HH24:MI')) order by h.weekday) from crm_business_hours h),
    'feriados_periodo', (select count(*) from crm_holidays f where f.date >= (p_from at time zone 'America/Sao_Paulo')::date and f.date < (p_to at time zone 'America/Sao_Paulo')::date),
    'kpis', (select to_jsonb(k) from kpi k),
    'por_dia', (select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) from (
        select jsonb_build_object('dia', to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
                 'iniciadas', count(*), 'finalizadas', count(*) filter (where status = 'closed'),
                 'whatsapp', count(*) filter (where plataforma = 'whatsapp'), 'instagram', count(*) filter (where plataforma = 'instagram'),
                 'sem_resposta', count(*) filter (where first_in is not null and first_out is null),
                 'inicio_medio_s', round(avg(inicio_s) filter (where inicio_s >= 0)),
                 'inicio_util_medio_s', round(avg(inicio_util_s) filter (where inicio_util_s is not null)),
                 'fora_expediente', count(*) filter (where fora_expediente)) x
          from tempos group by (created_at at time zone 'America/Sao_Paulo')::date) y),
    'por_setor', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.sector_id, 'nome', coalesce(s.name, 'Sem setor'), 'total', count(*),
                 'finalizadas', count(*) filter (where tp.status = 'closed'), 'abertas', count(*) filter (where tp.status <> 'closed'),
                 'resposta_media_s', round(avg(tp.inicio_s) filter (where tp.inicio_s >= 0)),
                 'resposta_util_media_s', round(avg(tp.inicio_util_s) filter (where tp.inicio_util_s is not null))) x
          from tempos tp left join crm_service_sectors s on s.id = tp.sector_id group by tp.sector_id, s.name) y),
    'por_atendente', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.assigned_to, 'nome', coalesce(st.name, 'Sem atendente'), 'total', count(*),
                 'finalizadas', count(*) filter (where tp.status = 'closed'), 'abertas', count(*) filter (where tp.status <> 'closed'),
                 'aguardando', count(*) filter (where tp.status <> 'closed' and tp.last_message_direction = 'inbound'),
                 'sem_resposta', count(*) filter (where tp.first_in is not null and tp.first_out is null),
                 'resposta_media_s', round(avg(tp.inicio_s) filter (where tp.inicio_s >= 0)),
                 'humana_media_s', round(avg(tp.resposta_s) filter (where tp.resposta_s >= 0)),
                 'resposta_util_media_s', round(avg(tp.inicio_util_s) filter (where tp.inicio_util_s is not null)),
                 'humana_util_media_s', round(avg(tp.resposta_util_s) filter (where tp.resposta_util_s is not null)),
                 'recebidas', count(*) filter (where tp.first_in is not null),
                 'respondidas_5min', count(*) filter (where tp.inicio_s is not null and tp.inicio_s <= 300),
                 'respondidas_5min_util', count(*) filter (where tp.inicio_util_s is not null and tp.inicio_util_s <= 300),
                 'fora_expediente', count(*) filter (where tp.fora_expediente)) x
          from tempos tp left join onboarding_staff st on st.id = tp.assigned_to group by tp.assigned_to, st.name) y),
    'por_canal', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nome', canal, 'plataforma', plataforma, 'total', count(*),
                 'finalizadas', count(*) filter (where status = 'closed'),
                 'sem_resposta', count(*) filter (where first_in is not null and first_out is null)) x from tempos group by canal, plataforma) y),
    'por_plataforma', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('nome', plataforma, 'total', count(*)) x from tempos group by plataforma) y),
    'mapa_calor', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('dow', dow, 'hora', hora, 'n', n) x
          from (select extract(isodow from ts)::int dow, extract(hour from ts)::int hora, count(*) n from entradas group by 1, 2) e) y),
    'lista', (select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.id, 'plataforma', tp.plataforma, 'contato', tp.contato, 'lead_id', tp.lead_id,
                 'status', tp.status, 'aguardando', (tp.status <> 'closed' and tp.last_message_direction = 'inbound'),
                 'atendente', st.name, 'setor', s.name, 'canal', tp.canal,
                 'created_at', tp.created_at, 'last_message_at', tp.last_message_at,
                 'resposta_s', tp.resposta_s, 'inicio_s', tp.inicio_s, 'recebeu', (tp.first_in is not null),
                 'inicio_util_s', tp.inicio_util_s, 'resposta_util_s', tp.resposta_util_s, 'fora_expediente', tp.fora_expediente) x
          from tempos tp left join onboarding_staff st on st.id = tp.assigned_to left join crm_service_sectors s on s.id = tp.sector_id
         order by tp.created_at desc limit 300) y)
  ) into v;
  return v;
end;
$$;
