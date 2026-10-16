-- Percurso: frases dos alertas com mínimo de 1 dia (mediana até a 1ª reunião é 0,3 dia e saía '0').
-- 3) a aba
create or replace function public.crm_percurso(p_from timestamptz, p_to timestamptz, p_pipeline uuid default null, p_staff uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_med_reuniao numeric; v_med_fechar numeric; v_med_dias numeric;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    raise exception 'Só o time UNV';
  end if;

  create temp table if not exists _pc on commit drop as
  select l.id, l.name, l.created_at, l.closed_at, s.final_type ft, s.name etapa, l.pipeline_id,
         coalesce(l.closer_staff_id, l.owner_staff_id) staff,
         extract(epoch from (l.closed_at - l.created_at)) / 86400 dias,
         (select count(*) from crm_lead_history h where h.lead_id = l.id and h.action = 'stage_change') etapas,
         (select count(*) from crm_activities a where a.lead_id = l.id and a.type = 'meeting') reunioes,
         (select count(*) from crm_activities a where a.lead_id = l.id and a.type = 'meeting' and a.status = 'completed') reunioes_ok,
         (select count(*) from crm_activities a where a.lead_id = l.id and a.type in ('call','whatsapp','followup','follow_up','email')) toques,
         (select count(*) from crm_activities a where a.lead_id = l.id and a.type = 'call') ligacoes,
         (select count(*) from crm_lead_proposals p where p.lead_id = l.id) propostas,
         (select count(*) from whatsapp_official_campaign_recipients r where r.lead_id = l.id and r.status in ('sent','delivered','read')) disparos,
         (select count(*) from crm_lead_history h where h.lead_id = l.id and h.action = 'reentrada') reentradas,
         1 + (select count(*) from crm_lead_history h where h.lead_id = l.id and h.action = 'pipeline_change') funis,
         (select count(*) from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id where c.lead_id = l.id and m.direction = 'outbound') msgs_env,
         (select count(*) from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id where c.lead_id = l.id and m.direction = 'inbound') msgs_rec,
         (select min(a.created_at) from crm_activities a where a.lead_id = l.id and a.type = 'meeting') primeira_reuniao
  from crm_leads l join crm_stages s on s.id = l.stage_id
  where s.final_type in ('won','lost') and l.closed_at >= p_from and l.closed_at < p_to
    and (p_pipeline is null or l.pipeline_id = p_pipeline)
    and (p_staff is null or coalesce(l.closer_staff_id, l.owner_staff_id) = p_staff);

  select percentile_cont(0.5) within group (order by extract(epoch from (primeira_reuniao - created_at)) / 86400),
         percentile_cont(0.5) within group (order by extract(epoch from (closed_at - primeira_reuniao)) / 86400),
         percentile_cont(0.5) within group (order by dias)
    into v_med_reuniao, v_med_fechar, v_med_dias
  from _pc where ft = 'won';

  with
  tipico as (
    select count(*) contratos,
      percentile_cont(0.5) within group (order by dias) dias_mediana, avg(dias) dias_media,
      avg(etapas) etapas, avg(reunioes) reunioes, avg(reunioes_ok) reunioes_ok, avg(toques) toques, avg(ligacoes) ligacoes,
      avg(msgs_env) msgs_env, avg(msgs_rec) msgs_rec, avg(propostas) propostas, avg(disparos) disparos,
      avg(reentradas) reentradas, avg(funis) funis,
      v_med_reuniao dias_ate_reuniao, v_med_fechar dias_reuniao_contrato,
      count(*) filter (where reunioes = 0) sem_reuniao, count(*) filter (where disparos > 0) com_disparo,
      count(*) filter (where reentradas > 0) com_reentrada, count(*) filter (where funis > 1) mais_de_um_funil
    from _pc where ft = 'won'),
  comp as (
    select ft, count(*) n, avg(dias) dias, avg(reunioes) reunioes, avg(toques) toques, avg(ligacoes) ligacoes,
      avg(msgs_env) msgs_env, avg(msgs_rec) msgs_rec, avg(propostas) propostas, avg(disparos) disparos, avg(reentradas) reentradas,
      count(*) filter (where reunioes > 0) com_reuniao, count(*) filter (where msgs_rec > 0) respondeu
    from _pc group by ft),
  viradas as (
    select * from (values
      ('Teve reunião', (select count(*) from _pc where reunioes > 0), (select count(*) from _pc where reunioes > 0 and ft = 'won'),
                       (select count(*) from _pc where reunioes = 0), (select count(*) from _pc where reunioes = 0 and ft = 'won')),
      ('Reunião realizada', (select count(*) from _pc where reunioes_ok > 0), (select count(*) from _pc where reunioes_ok > 0 and ft = 'won'),
                       (select count(*) from _pc where reunioes_ok = 0), (select count(*) from _pc where reunioes_ok = 0 and ft = 'won')),
      ('2 ou mais reuniões', (select count(*) from _pc where reunioes >= 2), (select count(*) from _pc where reunioes >= 2 and ft = 'won'),
                       (select count(*) from _pc where reunioes < 2), (select count(*) from _pc where reunioes < 2 and ft = 'won')),
      ('Recebeu proposta', (select count(*) from _pc where propostas > 0), (select count(*) from _pc where propostas > 0 and ft = 'won'),
                       (select count(*) from _pc where propostas = 0), (select count(*) from _pc where propostas = 0 and ft = 'won')),
      ('Respondeu no WhatsApp', (select count(*) from _pc where msgs_rec > 0), (select count(*) from _pc where msgs_rec > 0 and ft = 'won'),
                       (select count(*) from _pc where msgs_rec = 0), (select count(*) from _pc where msgs_rec = 0 and ft = 'won')),
      ('Recebeu ligação', (select count(*) from _pc where ligacoes > 0), (select count(*) from _pc where ligacoes > 0 and ft = 'won'),
                       (select count(*) from _pc where ligacoes = 0), (select count(*) from _pc where ligacoes = 0 and ft = 'won')),
      ('Recebeu disparo', (select count(*) from _pc where disparos > 0), (select count(*) from _pc where disparos > 0 and ft = 'won'),
                       (select count(*) from _pc where disparos = 0), (select count(*) from _pc where disparos = 0 and ft = 'won'))
    ) t(marco, com, com_ganho, sem, sem_ganho)),
  -- tempo em cada etapa: intervalo entre trocas consecutivas (histórico do período) + quem está parado agora
  troca as (
    select h.lead_id, h.new_value etapa, h.created_at ini,
           lead(h.created_at) over (partition by h.lead_id order by h.created_at) fim
    from crm_lead_history h
    where h.action = 'stage_change' and h.created_at >= p_from and h.created_at < p_to
      and (p_pipeline is null or exists (select 1 from crm_leads l where l.id = h.lead_id and l.pipeline_id = p_pipeline))),
  etapas as (
    select etapa, count(*) passagens, avg(extract(epoch from (fim - ini)) / 86400) dias_medio,
           percentile_cont(0.5) within group (order by extract(epoch from (fim - ini)) / 86400) dias_mediana
    from troca where fim is not null group by etapa),
  parados as (
    select s.name etapa, count(*) parados_agora, avg(extract(epoch from (now() - coalesce(l.stage_entered_at, l.updated_at, l.created_at))) / 86400) dias_parado
    from crm_leads l join crm_stages s on s.id = l.stage_id
    where s.final_type is null and (p_pipeline is null or l.pipeline_id = p_pipeline)
      and (p_staff is null or coalesce(l.closer_staff_id, l.owner_staff_id) = p_staff)
    group by s.name),
  etapas_json as (
    select coalesce(e.etapa, p.etapa) etapa, e.passagens, e.dias_medio, e.dias_mediana, p.parados_agora, p.dias_parado
    from etapas e full join parados p on p.etapa = e.etapa),
  esforco as (
    select (select count(*) from crm_activities a where a.created_at >= p_from and a.created_at < p_to and a.type in ('call','whatsapp','followup','follow_up','email','meeting')
              and (p_pipeline is null or exists (select 1 from crm_leads l where l.id = a.lead_id and l.pipeline_id = p_pipeline))
              and (p_staff is null or exists (select 1 from crm_leads l where l.id = a.lead_id and coalesce(l.closer_staff_id, l.owner_staff_id) = p_staff))) toques_periodo,
           (select count(*) from crm_activities a where a.created_at >= p_from and a.created_at < p_to and a.type = 'meeting'
              and (p_pipeline is null or exists (select 1 from crm_leads l where l.id = a.lead_id and l.pipeline_id = p_pipeline))) reunioes_periodo,
           (select count(*) from _pc where ft = 'won') contratos,
           (select sum(coalesce(opportunity_value, 0)) from crm_leads where id in (select id from _pc where ft = 'won')) receita),
  abertos as (
    select l.id, l.name, s.name etapa, st.name vendedor,
           extract(epoch from (now() - l.created_at)) / 86400 idade,
           extract(epoch from (now() - coalesce(l.stage_entered_at, l.updated_at, l.created_at))) / 86400 dias_etapa,
           (select count(*) from crm_activities a where a.lead_id = l.id and a.type = 'meeting') reunioes,
           (select max(p.created_at) from crm_lead_proposals p where p.lead_id = l.id) ultima_proposta,
           (select max(m.created_at) from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id where c.lead_id = l.id and m.direction = 'inbound') ultima_resposta
    from crm_leads l join crm_stages s on s.id = l.stage_id left join onboarding_staff st on st.id = coalesce(l.closer_staff_id, l.owner_staff_id)
    where s.final_type is null and l.created_at > now() - interval '120 days'
      and (p_pipeline is null or l.pipeline_id = p_pipeline)
      and (p_staff is null or coalesce(l.closer_staff_id, l.owner_staff_id) = p_staff)),
  alertas as (
    (select 'sem_reuniao' tipo, id, name, etapa, vendedor, round(idade) dias,
            'Aberto há ' || round(idade) || ' dias sem reunião (no contrato típico a reunião vem em ' || greatest(1, round(coalesce(v_med_reuniao, 7))) || ' dia' || case when greatest(1, round(coalesce(v_med_reuniao, 7))) = 1 then '' else 's' end || ')' motivo
       from abertos where reunioes = 0 and idade > greatest(2 * coalesce(v_med_reuniao, 7), 7) order by idade desc limit 40)
    union all
    (select 'proposta_parada', id, name, etapa, vendedor, round(extract(epoch from (now() - ultima_proposta)) / 86400),
            'Proposta há ' || round(extract(epoch from (now() - ultima_proposta)) / 86400) || ' dias sem fechar (o típico fecha em ' || greatest(1, round(coalesce(v_med_fechar, 12))) || ' dias depois da reunião)'
       from abertos where ultima_proposta is not null and ultima_proposta < now() - make_interval(days => greatest(2 * coalesce(v_med_fechar, 12), 7)::int)
       order by ultima_proposta limit 40)
    union all
    (select 'respondeu_sem_retorno', id, name, etapa, vendedor, round(extract(epoch from (now() - ultima_resposta)) / 86400),
            'Lead respondeu e está parado na etapa há ' || round(dias_etapa) || ' dias'
       from abertos where ultima_resposta is not null and dias_etapa > greatest(2 * coalesce(v_med_dias, 6), 5)
         and ultima_resposta > now() - interval '45 days' order by dias_etapa desc limit 40)),
  vend as (
    select st.name vendedor, count(*) contratos, percentile_cont(0.5) within group (order by dias) dias_mediana,
           avg(reunioes) reunioes, avg(toques) toques, avg(msgs_env) msgs_env, avg(propostas) propostas,
           (select count(*) from _pc x where x.staff = p.staff and x.ft = 'lost') perdidos
    from _pc p left join onboarding_staff st on st.id = p.staff where ft = 'won' group by st.name, p.staff)
  select jsonb_build_object(
    'tipico', (select to_jsonb(t) from tipico t),
    'comparativo', coalesce((select jsonb_agg(to_jsonb(c)) from comp c), '[]'),
    'viradas', coalesce((select jsonb_agg(to_jsonb(x)) from viradas x), '[]'),
    'etapas', coalesce((select jsonb_agg(to_jsonb(e) order by coalesce(e.dias_medio, e.dias_parado) desc nulls last) from etapas_json e), '[]'),
    'esforco', (select to_jsonb(e) from esforco e),
    'alertas', coalesce((select jsonb_agg(to_jsonb(a)) from alertas a), '[]'),
    'vendedores', coalesce((select jsonb_agg(to_jsonb(x) order by x.contratos desc) from vend x), '[]')
  ) into v;
  drop table if exists _pc;
  return v;
end $$;
revoke all on function public.crm_percurso(timestamptz,timestamptz,uuid,uuid) from public, anon;
grant execute on function public.crm_percurso(timestamptz,timestamptz,uuid,uuid) to authenticated;
