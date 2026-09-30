-- Recorte por papel nos dashboards do CRM (Fabrício, 30/09/2026): "closer e sdr só veem os
-- dados deles; o head, os dados da equipe dele (pode ver o passado); master/admin, tudo".
-- Feito NO BANCO: cada RPC lê o papel de auth.uid() e ignora o filtro de pessoa fora do escopo.
-- Não existe no Nexus uma tabela ligando head a pessoas (crm_leads.team está vazio, onboarding_staff
-- não tem head_id/manager_id), então a equipe do head = todo o time comercial (closer, sdr,
-- social_setter, bdr, ativos ou não) mais o próprio head. Sem piso de data.

create or replace function public.crm_escopo_atual()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select id, role, name from onboarding_staff where user_id = auth.uid() and coalesce(is_active, true) limit 1)
  select case
    when me.role in ('master', 'admin') then
      jsonb_build_object('papel', me.role, 'staff_id', me.id, 'nome', me.name, 'mostrando', 'tudo', 'ids', null)
    when me.role = 'head_comercial' then
      jsonb_build_object('papel', me.role, 'staff_id', me.id, 'nome', me.name, 'mostrando', 'equipe',
        'ids', (select jsonb_agg(s.id) from onboarding_staff s where s.id = me.id or s.role in ('closer', 'sdr', 'social_setter', 'bdr')))
    else
      jsonb_build_object('papel', me.role, 'staff_id', me.id, 'nome', me.name, 'mostrando', 'proprio', 'ids', jsonb_build_array(me.id))
  end from me;
$$;
revoke all on function public.crm_escopo_atual() from public;
grant execute on function public.crm_escopo_atual() to authenticated;

-- jsonb 'ids' → uuid[] (null = sem recorte)
create or replace function public.crm_escopo_ids(p_esc jsonb)
returns uuid[] language sql immutable as $$
  select case when p_esc is null or p_esc->'ids' is null or jsonb_typeof(p_esc->'ids') <> 'array' then null
              else (select array_agg((x)::uuid) from jsonb_array_elements_text(p_esc->'ids') x) end;
$$;
revoke all on function public.crm_escopo_ids(jsonb) from public;

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
     where c.created_at >= p_from and c.created_at < p_to
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
           extract(epoch from (x.first_human - x.first_in)) resposta_s
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
           count(*) filter (where inicio_s is not null and inicio_s <= 300) respondidas_5min
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
    'kpis', (select to_jsonb(k) from kpi k),
    'por_dia', (select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) from (
        select jsonb_build_object('dia', to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
                 'iniciadas', count(*), 'finalizadas', count(*) filter (where status = 'closed'),
                 'whatsapp', count(*) filter (where plataforma = 'whatsapp'), 'instagram', count(*) filter (where plataforma = 'instagram'),
                 'sem_resposta', count(*) filter (where first_in is not null and first_out is null)) x
          from tempos group by (created_at at time zone 'America/Sao_Paulo')::date) y),
    'por_setor', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.sector_id, 'nome', coalesce(s.name, 'Sem setor'), 'total', count(*),
                 'finalizadas', count(*) filter (where tp.status = 'closed'), 'abertas', count(*) filter (where tp.status <> 'closed'),
                 'resposta_media_s', round(avg(tp.inicio_s) filter (where tp.inicio_s >= 0))) x
          from tempos tp left join crm_service_sectors s on s.id = tp.sector_id group by tp.sector_id, s.name) y),
    'por_atendente', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.assigned_to, 'nome', coalesce(st.name, 'Sem atendente'), 'total', count(*),
                 'finalizadas', count(*) filter (where tp.status = 'closed'), 'abertas', count(*) filter (where tp.status <> 'closed'),
                 'aguardando', count(*) filter (where tp.status <> 'closed' and tp.last_message_direction = 'inbound'),
                 'sem_resposta', count(*) filter (where tp.first_in is not null and tp.first_out is null),
                 'resposta_media_s', round(avg(tp.inicio_s) filter (where tp.inicio_s >= 0)),
                 'humana_media_s', round(avg(tp.resposta_s) filter (where tp.resposta_s >= 0))) x
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
                 'resposta_s', tp.resposta_s, 'inicio_s', tp.inicio_s, 'recebeu', (tp.first_in is not null)) x
          from tempos tp left join onboarding_staff st on st.id = tp.assigned_to left join crm_service_sectors s on s.id = tp.sector_id
         order by tp.created_at desc limit 300) y)
  ) into v;
  return v;
end;
$$;

create or replace function public.crm_atividades_dashboard(
  p_from timestamptz, p_to timestamptz, p_dono uuid default null
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
  p_dono := case when v_ids is null then p_dono when p_dono = any(v_ids) then p_dono
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

  with base as (
    select a.id, coalesce(a.type, 'other') tipo, a.title, a.status, a.scheduled_at quando, a.completed_at,
           a.created_at, a.responsible_staff_id dono, a.lead_id, l.name lead_nome, l.company lead_empresa, coalesce(a.is_automation, false) automatica
      from crm_activities a left join crm_leads l on l.id = a.lead_id
     where a.status <> 'cancelled'
       and (p_dono is null or a.responsible_staff_id = p_dono)
       and (v_ids is null or a.responsible_staff_id = any(v_ids))
       and ((a.scheduled_at >= p_from and a.scheduled_at < p_to) or (a.completed_at >= p_from and a.completed_at < p_to))
  ),
  calc as (
    select b.*,
           (b.status <> 'completed' and b.quando is not null and b.quando < now()) atrasada,
           extract(epoch from (b.completed_at - b.created_at)) conclusao_s
      from base b
  ),
  kpi as (
    select count(*) total,
           count(*) filter (where status = 'completed') concluidas,
           count(*) filter (where status <> 'completed') abertas,
           count(*) filter (where atrasada) atrasadas,
           count(*) filter (where status = 'completed' and completed_at <= quando) no_prazo,
           round(avg(conclusao_s) filter (where status = 'completed' and conclusao_s >= 0)) conclusao_media_s,
           count(*) filter (where automatica) automaticas,
           count(distinct lead_id) leads_tocados
      from calc
  ),
  vivos as (
    select l.id, l.name, l.company, l.opportunity_value::numeric valor, l.owner_staff_id, l.created_at,
           l.last_activity_at, l.next_activity_at, s.name etapa, p.name funil
      from crm_leads l
      join crm_stages s on s.id = l.stage_id
      join crm_pipelines p on p.id = l.pipeline_id
     where coalesce(s.is_final, false) = false and p.is_active
       and l.owner_staff_id is not null
       and l.created_at > now() - interval '120 days'
       and (p_dono is null or l.owner_staff_id = p_dono)
       and (v_ids is null or l.owner_staff_id = any(v_ids))
  ),
  sem_atividade as (
    select * from vivos where last_activity_at is null and next_activity_at is null
  ),
  atrasados as (
    select * from vivos where next_activity_at < now() or (next_activity_at is null and last_activity_at < now() - interval '7 days')
  )
  select jsonb_build_object(
    'escopo', v_esc,
    'kpis', (select to_jsonb(k) from kpi k),
    'por_dia', (select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) from (
        select jsonb_build_object('dia', to_char(d, 'YYYY-MM-DD'),
                 'concluidas', count(*) filter (where status = 'completed'),
                 'agendadas', count(*) filter (where (quando at time zone 'America/Sao_Paulo')::date = d)) x
          from (select c.*, coalesce((c.completed_at at time zone 'America/Sao_Paulo')::date, (c.quando at time zone 'America/Sao_Paulo')::date) d from calc c) z
         where d is not null group by d) y),
    'por_tipo', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('tipo', tipo, 'total', count(*), 'concluidas', count(*) filter (where status = 'completed'),
                 'abertas', count(*) filter (where status <> 'completed'), 'atrasadas', count(*) filter (where atrasada)) x
          from calc group by tipo) y),
    'por_dono', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', c.dono, 'nome', coalesce(st.name, 'Sem responsável'), 'total', count(*),
                 'concluidas', count(*) filter (where c.status = 'completed'), 'abertas', count(*) filter (where c.status <> 'completed'),
                 'atrasadas', count(*) filter (where c.atrasada),
                 'no_prazo', count(*) filter (where c.status = 'completed' and c.completed_at <= c.quando),
                 'leads_tocados', count(distinct c.lead_id),
                 'conclusao_media_s', round(avg(c.conclusao_s) filter (where c.status = 'completed' and c.conclusao_s >= 0))) x
          from calc c left join onboarding_staff st on st.id = c.dono group by c.dono, st.name) y),
    'atrasadas', (select coalesce(jsonb_agg(x order by x->>'quando'), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'titulo', c.title, 'quando', c.quando,
                 'dono', st.name, 'lead_id', c.lead_id, 'lead', coalesce(c.lead_nome, c.lead_empresa),
                 'dias_atraso', floor(extract(epoch from (now() - c.quando)) / 86400)::int) x
          from calc c left join onboarding_staff st on st.id = c.dono where c.atrasada order by c.quando limit 100) y),
    'leads_sem_atividade_total', (select count(*) from sem_atividade),
    'leads_sem_atividade', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('id', s.id, 'nome', s.name, 'empresa', s.company, 'valor', s.valor, 'funil', s.funil, 'etapa', s.etapa,
                 'dono', st.name, 'created_at', s.created_at,
                 'dias', floor(extract(epoch from (now() - s.created_at)) / 86400)::int) x
          from sem_atividade s left join onboarding_staff st on st.id = s.owner_staff_id
         order by s.valor desc nulls last, s.created_at desc limit 50) y),
    'leads_atrasados_total', (select count(*) from atrasados),
    'leads_atrasados', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('id', a.id, 'nome', a.name, 'empresa', a.company, 'valor', a.valor, 'funil', a.funil, 'etapa', a.etapa,
                 'dono', st.name, 'last_activity_at', a.last_activity_at, 'next_activity_at', a.next_activity_at,
                 'dias', floor(extract(epoch from (now() - coalesce(a.next_activity_at, a.last_activity_at))) / 86400)::int) x
          from atrasados a left join onboarding_staff st on st.id = a.owner_staff_id
         order by a.valor desc nulls last, coalesce(a.next_activity_at, a.last_activity_at) limit 50) y)
  ) into v;
  return v;
end;
$$;

create or replace function public.crm_negocios_dashboard(
  p_from timestamptz, p_to timestamptz, p_pipeline uuid default null, p_owner uuid default null,
  p_only_valued boolean default true, p_order text default 'valor', p_limit int default 300
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
  p_owner := case when v_ids is null then p_owner when p_owner = any(v_ids) then p_owner
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

  with base as (
    select l.id, l.name, l.company, l.opportunity_value::numeric valor, l.owner_staff_id, l.pipeline_id, l.stage_id,
           l.created_at, l.last_activity_at, l.next_activity_at, l.loss_reason_id,
           coalesce(l.stage_entered_at, l.entered_pipeline_at, l.created_at) etapa_desde,
           coalesce(l.closed_at, l.stage_entered_at) fechado_em,
           s.name etapa, s.color cor, coalesce(s.is_final, false) is_final, s.final_type, p.name funil, p.is_active funil_ativo
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_pipelines p on p.id = l.pipeline_id
     where (p_pipeline is null or l.pipeline_id = p_pipeline)
       and (p_owner is null or l.owner_staff_id = p_owner)
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids))
  ),
  criados as (select * from base where created_at >= p_from and created_at < p_to),
  ganhos as (select * from base where final_type = 'won' and fechado_em >= p_from and fechado_em < p_to),
  perdidos as (select * from base where final_type = 'lost' and fechado_em >= p_from and fechado_em < p_to),
  abertos as (select * from base where not is_final and coalesce(funil_ativo, true)),
  abertos_periodo as (select * from abertos where created_at >= p_from and created_at < p_to),
  lista_base as (select * from abertos where not p_only_valued or coalesce(valor, 0) > 0)
  select jsonb_build_object(
    'escopo', v_esc,
    'kpis', jsonb_build_object(
      'criados', (select count(*) from criados), 'criados_valor', (select coalesce(sum(valor), 0) from criados),
      'ganhos', (select count(*) from ganhos), 'ganhos_valor', (select coalesce(sum(valor), 0) from ganhos),
      'perdidos', (select count(*) from perdidos), 'perdidos_valor', (select coalesce(sum(valor), 0) from perdidos),
      'abertos_periodo', (select count(*) from abertos_periodo), 'abertos_periodo_valor', (select coalesce(sum(valor), 0) from abertos_periodo),
      'abertos_total', (select count(*) from abertos), 'abertos_total_valor', (select coalesce(sum(valor), 0) from abertos),
      'abertos_com_valor', (select count(*) from abertos where coalesce(valor, 0) > 0),
      'ticket_ganho', (select coalesce(avg(valor) filter (where valor > 0), 0) from ganhos),
      'ciclo_medio_dias', (select round(avg(extract(epoch from (fechado_em - created_at)) / 86400)) from ganhos where fechado_em >= created_at)
    ),
    'por_dono', (select coalesce(jsonb_agg(x order by (x->>'ganhos_valor')::numeric desc, (x->>'criados')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', d.dono, 'nome', coalesce(st.name, 'Sem dono'),
                 'criados', count(*) filter (where d.k = 'c'), 'ganhos', count(*) filter (where d.k = 'g'),
                 'ganhos_valor', coalesce(sum(d.valor) filter (where d.k = 'g'), 0),
                 'perdidos', count(*) filter (where d.k = 'p'),
                 'abertos', count(*) filter (where d.k = 'a'), 'abertos_valor', coalesce(sum(d.valor) filter (where d.k = 'a'), 0)) x
          from (select owner_staff_id dono, valor, 'c' k from criados
                union all select owner_staff_id, valor, 'g' from ganhos
                union all select owner_staff_id, valor, 'p' from perdidos
                union all select owner_staff_id, valor, 'a' from abertos_periodo) d
          left join onboarding_staff st on st.id = d.dono
         group by d.dono, st.name) y),
    'por_funil', (select coalesce(jsonb_agg(x order by (x->>'criados')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', d.pipeline_id, 'nome', coalesce(d.funil, 'Sem funil'),
                 'criados', count(*) filter (where d.k = 'c'), 'ganhos', count(*) filter (where d.k = 'g'),
                 'ganhos_valor', coalesce(sum(d.valor) filter (where d.k = 'g'), 0),
                 'perdidos', count(*) filter (where d.k = 'p'),
                 'abertos', count(*) filter (where d.k = 'a'), 'abertos_valor', coalesce(sum(d.valor) filter (where d.k = 'a'), 0)) x
          from (select pipeline_id, funil, valor, 'c' k from criados
                union all select pipeline_id, funil, valor, 'g' from ganhos
                union all select pipeline_id, funil, valor, 'p' from perdidos
                union all select pipeline_id, funil, valor, 'a' from abertos_periodo) d
         group by d.pipeline_id, d.funil) y),
    'por_etapa', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('funil', funil, 'etapa', coalesce(etapa, 'Sem etapa'), 'cor', max(cor), 'total', count(*),
                 'valor', coalesce(sum(valor), 0), 'parados_7d', count(*) filter (where etapa_desde < now() - interval '7 days')) x
          from lista_base group by funil, etapa order by count(*) desc limit 30) y),
    'motivos_perda', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nome', coalesce(r.name, 'Sem motivo'), 'total', count(*), 'valor', coalesce(sum(pd.valor), 0)) x
          from perdidos pd left join crm_loss_reasons r on r.id = pd.loss_reason_id group by r.name) y),
    'lista_total', (select count(*) from lista_base),
    'lista', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('id', b.id, 'nome', b.name, 'empresa', b.company, 'funil', b.funil, 'pipeline_id', b.pipeline_id,
                 'etapa', b.etapa, 'stage_id', b.stage_id, 'cor', b.cor, 'dono', st.name, 'dono_id', b.owner_staff_id,
                 'valor', b.valor, 'created_at', b.created_at, 'etapa_desde', b.etapa_desde,
                 'last_activity_at', b.last_activity_at, 'next_activity_at', b.next_activity_at,
                 'dias_aberto', floor(extract(epoch from (now() - b.created_at)) / 86400)::int,
                 'dias_etapa', floor(extract(epoch from (now() - b.etapa_desde)) / 86400)::int) x
          from lista_base b left join onboarding_staff st on st.id = b.owner_staff_id
         order by
           case when p_order = 'valor' then b.valor end desc nulls last,
           case when p_order = 'dias_aberto' then b.created_at end asc nulls last,
           case when p_order = 'dias_etapa' then b.etapa_desde end asc nulls last,
           case when p_order = 'recentes' then b.created_at end desc nulls last,
           b.created_at desc
         limit greatest(1, least(coalesce(p_limit, 300), 1000))) y)
  ) into v;
  return v;
end;
$$;

create or replace function public.crm_investment_summary(p_from timestamptz, p_to timestamptz, p_closer uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb; v_esc jsonb; v_ids uuid[];
  d_from date := (p_from at time zone 'America/Sao_Paulo')::date;
  d_to date := (p_to at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Recorte por papel (Fabrício, 30/09/2026): closer/sdr só o próprio; head a equipe comercial; master/admin tudo.
  v_esc := public.crm_escopo_atual();
  v_ids := public.crm_escopo_ids(v_esc);
  p_closer := case when v_ids is null then p_closer when p_closer = any(v_ids) then p_closer
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

  with gasto as (
    select c.campaign_id, c.campaign_name, sum(c.spend) spend
      from crm_meta_ads_campaigns c
     where c.tenant_id is null and c.date_start >= d_from and c.date_start <= d_to
     group by c.campaign_id, c.campaign_name
  ),
  vinculo as (
    select campaign_id, pipeline_id, coalesce(weight, 1) peso,
           coalesce(weight, 1) / nullif(sum(coalesce(weight, 1)) over (partition by campaign_id), 0) fracao
      from crm_meta_campaign_pipelines where tenant_id is null
  ),
  gasto_funil as (
    select v.pipeline_id, sum(g.spend * v.fracao) spend
      from gasto g join vinculo v on v.campaign_id = g.campaign_id
     group by v.pipeline_id
    union all
    select null::uuid, sum(g.spend) from gasto g where not exists (select 1 from vinculo v where v.campaign_id = g.campaign_id)
  ),
  custos as (
    select m.id, m.month, m.label, m.amount_cents / 100.0 valor,
           -- dias do período que caem dentro do mês do lançamento
           greatest(0, (least(d_to, (m.month + interval '1 month' - interval '1 day')::date) - greatest(d_from, m.month)) + 1) dias_no_periodo,
           extract(day from (m.month + interval '1 month' - interval '1 day'))::int dias_do_mes
      from crm_marketing_costs m
     where m.month <= d_to and (m.month + interval '1 month' - interval '1 day')::date >= d_from
  ),
  leads as (
    select l.id, l.pipeline_id,
           (case when p_closer is not null then (l.owner_staff_id = p_closer or l.closer_staff_id = p_closer)
                 when v_ids is not null then (l.owner_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
                 else false end) do_closer
      from crm_leads l left join crm_stages s on s.id = l.stage_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at <= p_to
       and coalesce(s.exclude_from_lead_count, false) = false
  )
  select jsonb_build_object(
    'escopo', v_esc,
    'meta_spend_total', (select coalesce(sum(spend), 0) from gasto),
    'meta_campaigns', (select coalesce(jsonb_agg(jsonb_build_object('campaign_id', campaign_id, 'nome', campaign_name, 'spend', spend) order by spend desc), '[]'::jsonb) from gasto),
    'meta_spend_by_pipeline', (select coalesce(jsonb_agg(jsonb_build_object('pipeline_id', gf.pipeline_id, 'nome', p.name, 'spend', gf.spend)), '[]'::jsonb)
                                 from gasto_funil gf left join crm_pipelines p on p.id = gf.pipeline_id where gf.spend is not null),
    'meta_last_sync', (select max(synced_at) from crm_meta_ads_campaigns where tenant_id is null),
    'meta_last_day', (select max(date_start) from crm_meta_ads_campaigns where tenant_id is null),
    'manual_costs_total', (select coalesce(sum(valor * dias_no_periodo / dias_do_mes), 0) from custos),
    'manual_costs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'month', month, 'label', label, 'valor_mes', valor, 'valor_rateado', valor * dias_no_periodo / dias_do_mes) order by month, label), '[]'::jsonb) from custos),
    'leads_total', (select count(*) from leads),
    'leads_closer', (select count(*) filter (where do_closer) from leads),
    'leads_by_pipeline', (select coalesce(jsonb_agg(jsonb_build_object('pipeline_id', x.pipeline_id, 'total', x.total, 'closer', x.closer)), '[]'::jsonb)
                            from (select pipeline_id, count(*) total, count(*) filter (where do_closer) closer from leads group by pipeline_id) x),
    'period_days', (d_to - d_from) + 1
  ) into v;
  return v;
end;
$$;

create or replace function public.crm_visao_geral_janela(
  p_from timestamptz, p_to timestamptz, p_origin uuid, p_campaign text, p_product text, p_staff uuid, p_ids uuid[]
) returns jsonb
language sql stable security definer set search_path = public as $$
  with leads as (
    select l.id, l.opportunity_value::numeric valor,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at < p_to
       and coalesce(s.exclude_from_lead_count, false) = false
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (p_ids is null or l.owner_staff_id = any(p_ids) or l.sdr_staff_id = any(p_ids) or l.closer_staff_id = any(p_ids))
  ),
  vendas as (
    select s.id, coalesce(s.revenue_value, 0)::numeric receita,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_sales s
      left join crm_leads l on l.id = s.lead_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
      left join crm_pipelines p on p.id = s.pipeline_id
     where s.sale_date >= (p_from at time zone 'America/Sao_Paulo')::date
       and s.sale_date <= ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or s.product_name = p_product)
       and (p_staff is null or s.closer_staff_id = p_staff or s.sdr_staff_id = p_staff)
       and (p_ids is null or s.closer_staff_id = any(p_ids) or s.sdr_staff_id = any(p_ids))
  ),
  reunioes as (
    select distinct on (e.lead_id, e.event_type, date_trunc('minute', e.event_date)) e.id, e.event_type
      from crm_meeting_events e
      left join crm_leads l on l.id = e.lead_id
     where e.event_date >= p_from and e.event_date < p_to
       and e.event_type in ('scheduled', 'realized', 'no_show')
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or e.credited_staff_id = p_staff or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (p_ids is null or e.credited_staff_id = any(p_ids) or l.owner_staff_id = any(p_ids) or l.sdr_staff_id = any(p_ids) or l.closer_staff_id = any(p_ids))
  )
  select jsonb_build_object(
    'receita', (select coalesce(sum(receita), 0) from vendas),
    'receita_pagos', (select coalesce(sum(receita) filter (where pago), 0) from vendas),
    'vendas', (select count(*) from vendas),
    'leads', (select count(*) from leads),
    'leads_pagos', (select count(*) filter (where pago) from leads),
    'agendados', (select count(*) filter (where event_type = 'scheduled') from reunioes),
    'realizados', (select count(*) filter (where event_type = 'realized') from reunioes),
    'no_show', (select count(*) filter (where event_type = 'no_show') from reunioes),
    'ligacoes', (select count(*) from crm_calls c where c.tenant_id is null and c.created_at >= p_from and c.created_at < p_to and (p_staff is null or c.agent_staff_id = p_staff) and (p_ids is null or c.agent_staff_id = any(p_ids))),
    'msgs_wa', (select count(*) from crm_whatsapp_messages m where m.direction = 'inbound' and m.created_at >= p_from and m.created_at < p_to
                  and (p_ids is null or exists (select 1 from crm_whatsapp_conversations cv where cv.id = m.conversation_id and cv.assigned_to = any(p_ids)))),
    'msgs_ig', (select count(*) from instagram_messages m where m.direction = 'inbound' and coalesce(m.timestamp, m.created_at) >= p_from and coalesce(m.timestamp, m.created_at) < p_to
                  and (p_ids is null or exists (select 1 from instagram_conversations cv where cv.id = m.conversation_id and cv.assigned_to = any(p_ids))))
  );
$$;

create or replace function public.crm_visao_geral(
  p_from timestamptz, p_to timestamptz, p_origin uuid default null, p_campaign text default null,
  p_product text default null, p_staff uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb; v_esc jsonb; v_ids uuid[];
  d_from date := (p_from at time zone 'America/Sao_Paulo')::date;
  d_to date := ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date;  -- último dia incluído
  v_prev_from timestamptz := p_from - (p_to - p_from);
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Recorte por papel (Fabrício, 30/09/2026): closer/sdr só o próprio; head a equipe comercial; master/admin tudo.
  v_esc := public.crm_escopo_atual();
  v_ids := public.crm_escopo_ids(v_esc);
  p_staff := case when v_ids is null then p_staff when p_staff = any(v_ids) then p_staff
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

  with leads as (
    select l.id, l.name, l.company, l.created_at, l.owner_staff_id, l.sdr_staff_id, l.closer_staff_id, l.origin_id, l.pipeline_id, l.stage_id,
           upper(trim(l.state)) uf, l.opportunity_value::numeric valor, l.last_activity_at, l.meta_campaign_id, l.campaign_name,
           coalesce(s.is_final, false) is_final, s.sort_order etapa_ordem,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago,
           coalesce(o.name, nullif(l.origin, ''), 'Sem origem') origem, g.name grupo
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at < p_to
       and coalesce(s.exclude_from_lead_count, false) = false
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  vendas as (
    select s.id, s.sale_date, coalesce(s.revenue_value, 0)::numeric receita, s.closer_staff_id, s.sdr_staff_id, s.lead_id, s.product_name,
           l.origin_id, upper(trim(l.state)) uf, l.meta_campaign_id, coalesce(l.name, l.company) lead_nome,
           coalesce(o.name, nullif(l.origin, ''), 'Sem origem') origem,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_sales s
      left join crm_leads l on l.id = s.lead_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
      left join crm_pipelines p on p.id = s.pipeline_id
     where s.sale_date >= d_from and s.sale_date <= d_to
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or s.product_name = p_product)
       and (p_staff is null or s.closer_staff_id = p_staff or s.sdr_staff_id = p_staff)
       and (v_ids is null or s.closer_staff_id = any(v_ids) or s.sdr_staff_id = any(v_ids))
  ),
  reunioes as (
    select distinct on (e.lead_id, e.event_type, date_trunc('minute', e.event_date))
           e.id, e.lead_id, e.event_type, e.event_date,
           coalesce(e.credited_staff_id, e.owner_staff_id, l.owner_staff_id) staff, l.sdr_staff_id, l.owner_staff_id
      from crm_meeting_events e
      left join crm_leads l on l.id = e.lead_id
     where e.event_date >= p_from and e.event_date < p_to
       and e.event_type in ('scheduled', 'realized', 'no_show')
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or e.credited_staff_id = p_staff or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (v_ids is null or e.credited_staff_id = any(v_ids) or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  -- meta de Vendas (R$) dos meses que o período toca, pró-rata pelos dias do período em cada mês.
  -- Mesma regra da aba Vendas: head comercial e staff inativo não entram no time.
  meses as (
    select generate_series(date_trunc('month', d_from), date_trunc('month', d_to), interval '1 month')::date m
  ),
  meta as (
    select sum(gv.meta_value) meta_mes, m.m,
           (least(d_to, (m.m + interval '1 month' - interval '1 day')::date) - greatest(d_from, m.m) + 1)::numeric dias_no_periodo,
           extract(day from (m.m + interval '1 month' - interval '1 day'))::numeric dias_do_mes
      from meses m
      join crm_goal_values gv on gv.month = extract(month from m.m) and gv.year = extract(year from m.m)
      join crm_goal_types gt on gt.id = gv.goal_type_id and gt.name = 'Vendas' and gt.is_active
      join onboarding_staff st on st.id = gv.staff_id and coalesce(st.is_active, true) and coalesce(st.role, '') <> 'head_comercial'
     where (p_staff is null or gv.staff_id = p_staff) and (v_ids is null or gv.staff_id = any(v_ids))
     group by m.m
  ),
  -- funil: contatado = teve atividade, ligação ou mensagem enviada; qualificado = passou da 1ª etapa ou tem reunião
  funil as (
    select count(*) leads,
           count(*) filter (where l.last_activity_at is not null
             or exists (select 1 from crm_activities a where a.lead_id = l.id)
             or exists (select 1 from crm_calls c where c.lead_id = l.id)
             or exists (select 1 from crm_whatsapp_conversations cv join crm_whatsapp_messages m on m.conversation_id = cv.id
                         where cv.lead_id = l.id and m.direction = 'outbound')) contatados,
           count(*) filter (where l.etapa_ordem > (select min(s2.sort_order) from crm_stages s2 where s2.pipeline_id = l.pipeline_id)
             or exists (select 1 from crm_meeting_events e where e.lead_id = l.id)) qualificados
      from leads l
  ),
  vivos as (
    select l.id, l.name, l.company, l.opportunity_value::numeric valor, l.owner_staff_id, l.created_at,
           coalesce(l.stage_entered_at, l.entered_pipeline_at, l.created_at) etapa_desde, s.name etapa, s.sort_order, p.name funil
      from crm_leads l
      join crm_stages s on s.id = l.stage_id
      join crm_pipelines p on p.id = l.pipeline_id
      left join crm_origins o on o.id = l.origin_id
     where l.tenant_id is null and coalesce(s.is_final, false) = false and p.is_active
       and coalesce(s.exclude_from_lead_count, false) = false
       and l.created_at > now() - interval '120 days'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  -- pré-vendas = SDRs ativos + quem creditou agendamento no período (mesmo inativo, ex.: férias)
  sdrs as (
    select st.id, st.name from onboarding_staff st
     where ((coalesce(st.is_active, true) and st.role in ('sdr', 'social_setter', 'bdr'))
        or st.id in (select r.staff from reunioes r where r.event_type = 'scheduled')
        or st.id in (select l.sdr_staff_id from leads l where l.sdr_staff_id is not null))
       and (p_staff is null or st.id = p_staff)
       and (v_ids is null or st.id = any(v_ids))
  ),
  closers as (
    select st.id, st.name from onboarding_staff st
     where (st.id in (select v.closer_staff_id from vendas v where v.closer_staff_id is not null)
        or st.id in (select r.staff from reunioes r where r.event_type = 'realized'))
       and coalesce(st.role, '') not in ('sdr', 'social_setter', 'bdr')
       and (p_staff is null or st.id = p_staff)
       and (v_ids is null or st.id = any(v_ids))
  )
  select jsonb_build_object(
    'escopo', v_esc,
    'atual', crm_visao_geral_janela(p_from, p_to, p_origin, p_campaign, p_product, p_staff, v_ids),
    'anterior', crm_visao_geral_janela(v_prev_from, p_from, p_origin, p_campaign, p_product, p_staff, v_ids),
    'periodo', jsonb_build_object('de', d_from, 'ate', d_to, 'dias', (d_to - d_from) + 1, 'anterior_de', (v_prev_from at time zone 'America/Sao_Paulo')::date),
    'meta', jsonb_build_object(
      'mes_total', (select coalesce(sum(meta_mes), 0) from meta),
      'prorata', (select coalesce(sum(meta_mes * dias_no_periodo / dias_do_mes), 0) from meta)),
    'receita_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'receita', r) order by d), '[]'::jsonb)
                      from (select sale_date d, sum(receita) r from vendas group by sale_date) x),
    'funil', (select jsonb_build_object('leads', f.leads, 'contatados', f.contatados, 'qualificados', f.qualificados,
                 'agendados', (select count(distinct lead_id) from reunioes where event_type = 'scheduled'),
                 'realizados', (select count(distinct lead_id) from reunioes where event_type = 'realized'),
                 'vendas', (select count(*) from vendas)) from funil f),
    'origens', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', d.origin_id, 'nome', d.origem, 'grupo', max(d.grupo), 'pago', bool_or(d.pago),
                 'leads', count(*) filter (where d.k = 'l'), 'vendas', count(*) filter (where d.k = 'v'),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'v'), 0)) x
          from (select origin_id, origem, grupo, pago, 0::numeric receita, 'l' k from leads
                union all select origin_id, origem, null, pago, receita, 'v' from vendas) d
         group by d.origin_id, d.origem) y),
    'estados', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('uf', coalesce(nullif(d.uf, ''), 'Sem UF'),
                 'leads', count(*) filter (where d.k = 'l'), 'clientes', count(*) filter (where d.k = 'v'),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'v'), 0)) x
          from (select uf, 0::numeric receita, 'l' k from leads union all select uf, receita, 'v' from vendas) d
         group by d.uf) y),
    'campanhas', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('campaign_id', d.cid, 'nome', max(d.nome),
                 'leads', count(*) filter (where d.k = 'l'), 'vendas', count(*) filter (where d.k = 'v'),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'v'), 0)) x
          from (select meta_campaign_id cid, campaign_name nome, 0::numeric receita, 'l' k from leads where meta_campaign_id is not null
                union all select v.meta_campaign_id, null, v.receita, 'v' from vendas v where v.meta_campaign_id is not null) d
         group by d.cid) y),
    'leads_semana', (select coalesce(jsonb_agg(x order by x->>'semana'), '[]'::jsonb) from (
        select jsonb_build_object('semana', to_char(date_trunc('week', l.created_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD'),
                 'pagos', count(*) filter (where l.pago), 'organicos', count(*) filter (where not l.pago)) x
          from leads l group by date_trunc('week', l.created_at at time zone 'America/Sao_Paulo')) y),
    'sdrs', (select coalesce(jsonb_agg(x order by (x->>'agendados')::int desc, (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', s.id, 'nome', s.name,
                 'leads', (select count(*) from leads l where l.sdr_staff_id = s.id or l.owner_staff_id = s.id),
                 'agendados', (select count(*) from reunioes r where r.event_type = 'scheduled' and (r.staff = s.id or r.sdr_staff_id = s.id)),
                 'realizados', (select count(*) from reunioes r where r.event_type = 'realized' and (r.staff = s.id or r.sdr_staff_id = s.id)),
                 'no_show', (select count(*) from reunioes r where r.event_type = 'no_show' and (r.staff = s.id or r.sdr_staff_id = s.id))) x
          from sdrs s) y),
    'closers', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, (x->>'vendas')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'nome', c.name,
                 'vendas', (select count(*) from vendas v where v.closer_staff_id = c.id),
                 'receita', (select coalesce(sum(receita), 0) from vendas v where v.closer_staff_id = c.id),
                 'realizados', (select count(*) from reunioes r where r.event_type = 'realized' and r.staff = c.id),
                 'agendados', (select count(*) from reunioes r where r.event_type = 'scheduled' and r.staff = c.id)) x
          from closers c) y),
    'pipeline_etapas', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc, (x->>'qtd')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('etapa', etapa, 'funil', funil, 'qtd', count(*), 'valor', coalesce(sum(valor), 0),
                 'com_valor', count(*) filter (where valor > 0)) x
          from vivos group by etapa, funil order by coalesce(sum(valor), 0) desc, count(*) desc limit 12) y),
    'pipeline_total', (select jsonb_build_object('qtd', count(*), 'valor', coalesce(sum(valor), 0), 'com_valor', count(*) filter (where valor > 0)) from vivos),
    'leads_sem_dono_total', (select count(*) from leads l where l.owner_staff_id is null and not l.is_final),
    'leads_sem_dono', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'nome', coalesce(l.name, l.company, 'Lead'), 'sub', l.origem, 'valor', l.valor) order by l.created_at desc), '[]'::jsonb)
                         from (select * from leads l where l.owner_staff_id is null and not l.is_final order by l.created_at desc limit 30) l),
    'leads_parados_total', (select count(*) from vivos where etapa_desde < now() - interval '7 days'),
    'leads_parados', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'nome', coalesce(v.name, v.company, 'Lead'), 'sub', v.funil || ' / ' || v.etapa, 'valor', v.valor,
                          'dias', floor(extract(epoch from (now() - v.etapa_desde)) / 86400)::int) order by v.valor desc nulls last), '[]'::jsonb)
                        from (select * from vivos v where v.etapa_desde < now() - interval '7 days' order by v.valor desc nulls last, v.etapa_desde limit 30) v),
    'vendas_lista', (select coalesce(jsonb_agg(jsonb_build_object('id', v.lead_id, 'nome', coalesce(v.lead_nome, 'Venda'), 'sub', v.origem, 'valor', v.receita, 'dia', v.sale_date) order by v.sale_date desc), '[]'::jsonb) from vendas v)
  ) into v;
  return v;
end;
$$;

drop function if exists public.crm_visao_geral_janela(timestamptz, timestamptz, uuid, text, text, uuid);
revoke all on function public.crm_visao_geral_janela(timestamptz, timestamptz, uuid, text, text, uuid, uuid[]) from public;
