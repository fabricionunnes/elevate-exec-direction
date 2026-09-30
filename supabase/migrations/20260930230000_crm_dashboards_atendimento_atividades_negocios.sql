-- Dashboards do CRM (benchmark Datacrazy itens 1, 2, 3 e 16), 30/09/2026.
-- Portado do UNV Sales (migration 0152) pro esquema do Nexus:
--   * CRM único da UNV: sem tenant, só filtro por período (e por atendente/dono quando pedido);
--   * staff em onboarding_staff (assigned_to, sent_by, responsible_staff_id, owner_staff_id apontam pro id dela);
--   * não existe tabela de tarefas internas, então Atividades = crm_activities;
--   * cada função exige staff logado (onboarding_staff.user_id = auth.uid()) antes de ler.
-- Três consultas, uma por painel, devolvendo tudo que a tela mostra num jsonb só.

-- ---------------------------------------------------------------- Atendimento
-- Conversa = WhatsApp (Evolution ou API oficial) ou Instagram. "Iniciada" = criada no período.
-- "Início do atendimento" = da 1ª mensagem recebida até a 1ª enviada por qualquer um (pessoa ou IA).
-- "1ª resposta humana" = até a 1ª enviada por uma pessoa (sent_by preenchido e is_ai falso).
create or replace function public.crm_atendimento_dashboard(
  p_from timestamptz, p_to timestamptz, p_atendente uuid default null, p_setor uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

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
       and ((p_atendente is null and p_setor is null) or exists (
             select 1 from crm_whatsapp_conversations c where c.id = m.conversation_id
               and (p_atendente is null or c.assigned_to = p_atendente) and (p_setor is null or c.sector_id = p_setor)))
    union all
    select (coalesce(m.timestamp, m.created_at) at time zone 'America/Sao_Paulo')
      from instagram_messages m
     where m.direction = 'inbound' and coalesce(m.timestamp, m.created_at) >= p_from and coalesce(m.timestamp, m.created_at) < p_to
       and p_setor is null
       and (p_atendente is null or exists (select 1 from instagram_conversations c where c.id = m.conversation_id and c.assigned_to = p_atendente))
  )
  select jsonb_build_object(
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
revoke all on function public.crm_atendimento_dashboard(timestamptz, timestamptz, uuid, uuid) from public;
grant execute on function public.crm_atendimento_dashboard(timestamptz, timestamptz, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- Atividades
-- crm_activities (sem cancelled). "No período" = agendada no período OU concluída no período.
-- Traz também o que o dashboard antigo (CRMDashboardPage, apagado) mostrava: leads sem atividade
-- e leads atrasados. Base viva = lead aberto, com dono, em funil ativo, criado nos últimos 120 dias
-- (fora disso é o arquivo morto de disparos).
create or replace function public.crm_atividades_dashboard(
  p_from timestamptz, p_to timestamptz, p_dono uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  with base as (
    select a.id, coalesce(a.type, 'other') tipo, a.title, a.status, a.scheduled_at quando, a.completed_at,
           a.created_at, a.responsible_staff_id dono, a.lead_id, l.name lead_nome, l.company lead_empresa, coalesce(a.is_automation, false) automatica
      from crm_activities a left join crm_leads l on l.id = a.lead_id
     where a.status <> 'cancelled'
       and (p_dono is null or a.responsible_staff_id = p_dono)
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
  ),
  sem_atividade as (
    select * from vivos where last_activity_at is null and next_activity_at is null
  ),
  atrasados as (
    select * from vivos where next_activity_at < now() or (next_activity_at is null and last_activity_at < now() - interval '7 days')
  )
  select jsonb_build_object(
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
revoke all on function public.crm_atividades_dashboard(timestamptz, timestamptz, uuid) from public;
grant execute on function public.crm_atividades_dashboard(timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------- Negócios (item 16)
-- Cards do período (criados, ganhos, perdidos, abertos), produtividade por dono e por funil,
-- motivos de perda, e a lista de negócios em aberto com dias em aberto e dias parado na etapa.
-- Data do ganho/perda = closed_at, ou stage_entered_at quando a tela não gravou closed_at
-- (o kanban só grava closed_at no ganho; o trigger update_stage_entered_at cobre os dois).
-- A lista é ordenada e limitada no banco (117k leads abertos na base, quase tudo disparo antigo).
create or replace function public.crm_negocios_dashboard(
  p_from timestamptz, p_to timestamptz, p_pipeline uuid default null, p_owner uuid default null,
  p_only_valued boolean default true, p_order text default 'valor', p_limit int default 300
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

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
  ),
  criados as (select * from base where created_at >= p_from and created_at < p_to),
  ganhos as (select * from base where final_type = 'won' and fechado_em >= p_from and fechado_em < p_to),
  perdidos as (select * from base where final_type = 'lost' and fechado_em >= p_from and fechado_em < p_to),
  abertos as (select * from base where not is_final and coalesce(funil_ativo, true)),
  abertos_periodo as (select * from abertos where created_at >= p_from and created_at < p_to),
  lista_base as (select * from abertos where not p_only_valued or coalesce(valor, 0) > 0)
  select jsonb_build_object(
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
revoke all on function public.crm_negocios_dashboard(timestamptz, timestamptz, uuid, uuid, boolean, text, int) from public;
grant execute on function public.crm_negocios_dashboard(timestamptz, timestamptz, uuid, uuid, boolean, text, int) to authenticated;

-- índices que faltavam pras consultas por período
create index if not exists idx_wa_conv_created_at on public.crm_whatsapp_conversations (created_at);
create index if not exists idx_ig_conv_created_at on public.instagram_conversations (created_at);
create index if not exists idx_wa_messages_conv_dir_created on public.crm_whatsapp_messages (conversation_id, direction, created_at);
create index if not exists idx_wa_messages_inbound_created on public.crm_whatsapp_messages (created_at) where direction = 'inbound';
create index if not exists idx_ig_messages_conv_ts on public.instagram_messages (conversation_id, coalesce("timestamp", created_at));
create index if not exists idx_crm_activities_completed_at on public.crm_activities (completed_at);
create index if not exists idx_crm_leads_stage_entered_at on public.crm_leads (stage_entered_at);
