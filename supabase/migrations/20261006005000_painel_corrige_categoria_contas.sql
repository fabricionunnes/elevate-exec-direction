-- Painel de Controle: categoria das contas a pagar vinha da tabela errada (06/10/2026).
--
-- financial_payables.category_id aponta pra staff_financial_categories (o plano de
-- contas do Financeiro do staff), e o painel juntava com financial_categories, que
-- não casa com nenhuma linha. Resultado: "Pago por categoria" e os detalhes de
-- contas pagas e a pagar mostravam tudo como "Sem categoria" desde a primeira
-- versão, e a tela de Fontes dizia que as contas não tinham categoria. Têm: as
-- lançadas de junho/2026 pra cá estão categorizadas; só o legado importado não.
-- Só a junção muda; o resto das duas funções é igual.

create or replace function public.painel_controle_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date;
  v_fim date;
  v_tz text := 'America/Sao_Paulo';
  t_ini timestamptz;
  t_fim timestamptz;
  s_ini date;          -- início da série (12 meses terminando no mês atual)
  s_fim date;
  ts_ini timestamptz;
  ts_fim timestamptz;
  fin jsonb; com jsonb; tra jsonb; cli jsonb; ate jsonb; ia jsonb; roda jsonb; equipe jsonb; serie jsonb;
  frente jsonb;  -- blocos "pra frente" (caixa projetado etc.), montados em painel_frente_interno
  alertas jsonb := '[]'::jsonb;
  lt record;
  n_vencidas int; v_vencidas numeric; n_venc7 int; v_venc7 numeric;
  n_pagar3 int; v_pagar3 numeric; v_pagar7 numeric; v_saldo numeric;
  n_ganhos_sem_valor int; n_conv24 int; n_conv_wait int;
  custo_ia numeric; teto_ia numeric; custo_hoje numeric; n_health_baixo int; n_vencendo int;
  n_checkup int; n_aviso int; n_nps_baixo int;
  -- conexão do Meta Ads (conta do CRM da UNV)
  m_tem_conta boolean := false; m_id uuid; m_nome text; m_act text; m_sync timestamptz;
  m_horas numeric; m_ult_gasto date; m_dias_sem int; m_gasto_antes numeric;
  -- saldo da conta de anúncios (gravado de hora em hora pela edge crm-meta-ads-balance)
  m_situacao text; m_pre boolean; m_saldo numeric; m_devido numeric; m_forma text; m_media numeric;
  m_saldo_em timestamptz; m_saldo_erro text; m_nivel text; m_dias_saldo numeric;
begin

  v_ini := date_trunc('month', coalesce(p_month, hoje))::date;
  v_fim := (v_ini + interval '1 month')::date;
  t_ini := v_ini::timestamp at time zone v_tz;
  t_fim := v_fim::timestamp at time zone v_tz;
  s_fim := (date_trunc('month', hoje) + interval '1 month')::date;
  s_ini := (s_fim - interval '12 months')::date;
  ts_ini := s_ini::timestamp at time zone v_tz;
  ts_fim := s_fim::timestamp at time zone v_tz;

  ---------------------------------------------------------------- financeiro
  select count(*), coalesce(sum(coalesce(i.total_with_fees_cents, i.amount_cents))/100.0, 0)
    into n_vencidas, v_vencidas
    from company_invoices i
   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje;

  select count(*), coalesce(sum(coalesce(i.total_with_fees_cents, i.amount_cents))/100.0, 0)
    into n_venc7, v_venc7
    from company_invoices i
   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje - 7;

  select count(*), coalesce(sum(p.amount - coalesce(p.paid_amount,0)), 0)
    into n_pagar3, v_pagar3
    from financial_payables p
   where p.status in ('pending','partial') and p.tenant_id is null and p.due_date between hoje and hoje + 3;

  select coalesce(sum(p.amount - coalesce(p.paid_amount,0)), 0) into v_pagar7
    from financial_payables p
   where p.status in ('pending','partial') and p.tenant_id is null and p.due_date between hoje and hoje + 7;

  select coalesce(sum(b.current_balance_cents)/100.0, 0) into v_saldo
    from financial_banks b where b.is_active and b.tenant_id is null;

  select jsonb_build_object(
    'recebido', (select coalesce(sum(coalesce(i.paid_amount_cents, i.amount_cents))/100.0,0) from company_invoices i
                  where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim),
    'recebido_n', (select count(*) from company_invoices i where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim),
    'a_receber', (select coalesce(sum(i.amount_cents)/100.0,0) from company_invoices i
                   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date >= v_ini and i.due_date < v_fim),
    'a_receber_n', (select count(*) from company_invoices i
                   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date >= v_ini and i.due_date < v_fim),
    'vencidas', v_vencidas, 'vencidas_n', n_vencidas,
    'vencidas_7d', v_venc7, 'vencidas_7d_n', n_venc7,
    'pago', (select coalesce(sum(coalesce(p.paid_amount, p.amount)),0) from financial_payables p
              where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim),
    'pago_n', (select count(*) from financial_payables p
              where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim),
    'a_pagar', (select coalesce(sum(p.amount - coalesce(p.paid_amount,0)),0) from financial_payables p
                 where p.status in ('pending','partial') and p.tenant_id is null and p.due_date >= v_ini and p.due_date < v_fim),
    'a_pagar_n', (select count(*) from financial_payables p
                 where p.status in ('pending','partial') and p.tenant_id is null and p.due_date >= v_ini and p.due_date < v_fim),
    'a_pagar_3d', v_pagar3, 'a_pagar_3d_n', n_pagar3, 'a_pagar_7d', v_pagar7,
    'saldo_bancos', v_saldo,
    'bancos', (select coalesce(jsonb_agg(jsonb_build_object('nome', b.name, 'saldo', b.current_balance_cents/100.0,
                 'saldo_provedor', case when b.provider_balance_at is not null then b.provider_balance_cents/100.0 end,
                 'atualizado_em', b.provider_balance_at) order by b.current_balance_cents desc), '[]')
               from financial_banks b where b.is_active and b.tenant_id is null),
    'mrr', (select coalesce(sum(c.amount_cents)/100.0,0) from company_recurring_charges c where c.is_active and c.recurrence = 'monthly'),
    'mrr_n', (select count(*) from company_recurring_charges c where c.is_active and c.recurrence = 'monthly'),
    'mrr_em_aviso', (select coalesce(sum(c.amount_cents)/100.0,0) from company_recurring_charges c
                      join onboarding_projects p on p.onboarding_company_id = c.company_id
                     where c.is_active and c.recurrence = 'monthly' and p.status in ('notice_period','cancellation_signaled')),
    'vencidas_lista', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]') from (
        select jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', coalesce(i.total_with_fees_cents, i.amount_cents)/100.0,
                 'vencimento', i.due_date, 'dias', hoje - i.due_date, 'descricao', i.description) x
          from company_invoices i join onboarding_companies c on c.id = i.company_id
         where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje
         order by coalesce(i.total_with_fees_cents, i.amount_cents) desc limit 40) y),
    'a_pagar_lista', (select coalesce(jsonb_agg(x order by x->>'vencimento'), '[]') from (
        select jsonb_build_object('fornecedor', p.supplier_name, 'descricao', p.description, 'valor', p.amount - coalesce(p.paid_amount,0),
                 'vencimento', p.due_date, 'status', p.status) x
          from financial_payables p
         where p.status in ('pending','partial') and p.tenant_id is null and p.due_date >= least(v_ini, hoje) and p.due_date < greatest(v_fim, hoje + 8)
         order by p.due_date limit 60) y),
    'recebido_por_empresa', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]') from (
        select jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', sum(coalesce(i.paid_amount_cents, i.amount_cents))/100.0, 'n', count(*)) x
          from company_invoices i join onboarding_companies c on c.id = i.company_id
         where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim
         group by c.id, c.name order by 1 desc limit 25) y),
    'pago_por_categoria', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]') from (
        select jsonb_build_object('categoria', coalesce(fc.name, 'Sem categoria'), 'valor', sum(coalesce(p.paid_amount, p.amount)), 'n', count(*)) x
          from financial_payables p left join staff_financial_categories fc on fc.id = p.category_id
         where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim
         group by fc.name order by 1 desc limit 20) y)
  ) into fin;

  fin := fin || jsonb_build_object('lucro', (fin->>'recebido')::numeric - (fin->>'pago')::numeric);

  ---------------------------------------------------------------- comercial
  select count(*) into n_ganhos_sem_valor
    from crm_leads l join crm_stages st on st.id = l.stage_id
   where st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim and l.tenant_id is null
     and coalesce(l.opportunity_value,0) <= 0;

  with ganhos as (
    select l.id, l.name, l.company, l.opportunity_value val, l.closed_at, l.pipeline_id,
           coalesce(l.closer_staff_id, l.owner_staff_id) closer_id, l.sdr_staff_id, l.origin, l.utm_source, l.meta_campaign_id
      from crm_leads l join crm_stages st on st.id = l.stage_id
     where st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim and l.tenant_id is null
  ),
  ev as (
    select e.event_type, e.credited_staff_id, e.owner_staff_id, e.pipeline_id, e.lead_id, e.event_date
      from crm_meeting_events e where e.event_date >= t_ini and e.event_date < t_fim
  ),
  novos as (
    select l.pipeline_id, count(*) n from crm_leads l
     where l.created_at >= t_ini and l.created_at < t_fim and l.tenant_id is null group by 1
  )
  select jsonb_build_object(
    'leads', (select coalesce(sum(n),0) from novos),
    'leads_inflow', (select coalesce(sum(n.n),0) from novos n join crm_pipelines p on p.id = n.pipeline_id where p.counts_lead_inflow),
    'agendadas', (select count(*) from ev where event_type = 'scheduled'),
    'realizadas', (select count(*) from ev where event_type in ('realized','realized_out_of_icp')),
    'no_show', (select count(*) from ev where event_type = 'no_show'),
    'fora_icp', (select count(*) from ev where event_type in ('out_of_icp','realized_out_of_icp')),
    'vendas', (select count(*) from ganhos),
    'receita', (select coalesce(sum(val),0) from ganhos),
    'ganhos_sem_valor', n_ganhos_sem_valor,
    'por_closer', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, (x->>'vendas')::int desc), '[]') from (
        select jsonb_build_object('id', s.id, 'nome', s.name, 'papel', s.role,
                 'realizadas', (select count(*) from ev where ev.owner_staff_id = s.id and ev.event_type in ('realized','realized_out_of_icp')),
                 'no_show', (select count(*) from ev where ev.owner_staff_id = s.id and ev.event_type = 'no_show'),
                 'vendas', (select count(*) from ganhos g where g.closer_id = s.id),
                 'receita', (select coalesce(sum(val),0) from ganhos g where g.closer_id = s.id)) x
          from onboarding_staff s
         where s.tenant_id is null and (s.id in (select owner_staff_id from ev) or s.id in (select closer_id from ganhos))) y),
    'por_sdr', (select coalesce(jsonb_agg(x order by (x->>'agendadas')::int desc), '[]') from (
        select jsonb_build_object('id', s.id, 'nome', s.name, 'papel', s.role,
                 'agendadas', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type = 'scheduled'),
                 'realizadas', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type in ('realized','realized_out_of_icp')),
                 'no_show', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type = 'no_show'),
                 'fora_icp', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type in ('out_of_icp','realized_out_of_icp')),
                 'vendas', (select count(*) from ganhos g where g.sdr_staff_id = s.id)) x
          from onboarding_staff s
         where s.tenant_id is null and (s.id in (select credited_staff_id from ev) or s.id in (select sdr_staff_id from ganhos))) y),
    'por_funil', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, (x->>'leads')::int desc), '[]') from (
        select jsonb_build_object('id', p.id, 'nome', p.name, 'conta_entrada', p.counts_lead_inflow,
                 'leads', coalesce((select n from novos where novos.pipeline_id = p.id),0),
                 'agendadas', (select count(*) from ev where ev.pipeline_id = p.id and ev.event_type = 'scheduled'),
                 'realizadas', (select count(*) from ev where ev.pipeline_id = p.id and ev.event_type in ('realized','realized_out_of_icp')),
                 'no_show', (select count(*) from ev where ev.pipeline_id = p.id and ev.event_type = 'no_show'),
                 'vendas', (select count(*) from ganhos g where g.pipeline_id = p.id),
                 'receita', (select coalesce(sum(val),0) from ganhos g where g.pipeline_id = p.id)) x
          from crm_pipelines p
         where p.tenant_id is null and p.is_active
           and (p.id in (select pipeline_id from novos) or p.id in (select pipeline_id from ev) or p.id in (select pipeline_id from ganhos))) y),
    'vendas_lista', (select coalesce(jsonb_agg(x order by x->>'data' desc), '[]') from (
        select jsonb_build_object('lead_id', g.id, 'nome', g.name, 'empresa', g.company, 'valor', g.val,
                 'data', (g.closed_at at time zone v_tz)::date, 'closer', cs.name, 'sdr', sd.name, 'funil', p.name,
                 'origem', coalesce(g.origin, g.utm_source, case when g.meta_campaign_id is not null then 'Meta Ads' end),
                 'pago', (g.meta_campaign_id is not null or lower(coalesce(g.utm_source,'')) in ('facebook','fb','ig','instagram','meta'))) x
          from ganhos g left join onboarding_staff cs on cs.id = g.closer_id left join onboarding_staff sd on sd.id = g.sdr_staff_id
          left join crm_pipelines p on p.id = g.pipeline_id) y),
    'reunioes_lista', (select coalesce(jsonb_agg(x order by x->>'data' desc), '[]') from (
        select jsonb_build_object('lead_id', e.lead_id, 'nome', l.name, 'empresa', l.company, 'tipo', e.event_type,
                 'data', e.event_date, 'sdr', sd.name, 'closer', ow.name, 'funil', p.name) x
          from ev e left join crm_leads l on l.id = e.lead_id left join onboarding_staff sd on sd.id = e.credited_staff_id
          left join onboarding_staff ow on ow.id = e.owner_staff_id left join crm_pipelines p on p.id = e.pipeline_id
          order by e.event_date desc limit 400) y)
  ) into com;

  com := com || jsonb_build_object(
    'ticket', case when (com->>'vendas')::int > 0 then (com->>'receita')::numeric / (com->>'vendas')::int end,
    'conv_reuniao_venda', case when (com->>'realizadas')::int > 0 then (com->>'vendas')::numeric / (com->>'realizadas')::int end,
    'presenca', case when ((com->>'realizadas')::int + (com->>'no_show')::int) > 0
                     then (com->>'realizadas')::numeric / ((com->>'realizadas')::int + (com->>'no_show')::int) end);

  ---------------------------------------------------------------- tráfego pago
  -- Estado da conexão: a conta conectada mais recente do CRM da UNV. Os crons 138
  -- (2 em 2 h) e 139 (diário) chamam a edge crm-meta-ads-sync; se last_synced_at
  -- ficar velho é porque o acesso venceu ou a conexão caiu.
  select a.id, a.ad_account_name, a.ad_account_id, a.last_synced_at,
         a.meta_account_status_label, a.is_prepaid, a.available_balance, a.amount_owed, a.funding_source,
         a.daily_spend_avg, a.balance_checked_at, a.balance_error, a.balance_alert_level
    into m_id, m_nome, m_act, m_sync,
         m_situacao, m_pre, m_saldo, m_devido, m_forma, m_media, m_saldo_em, m_saldo_erro, m_nivel
    from crm_meta_ads_accounts a
   where a.tenant_id is null and a.is_connected
   order by a.last_synced_at desc nulls last limit 1;
  m_tem_conta := found;
  if m_sync is not null then m_horas := round(extract(epoch from (now() - m_sync)) / 3600.0, 1); end if;
  -- saldo nunca conferido fica nulo (a tela mostra "-"), não zero
  if m_saldo_em is null then m_saldo := null; m_nivel := null; end if;
  if m_saldo is not null and coalesce(m_media,0) > 0 then m_dias_saldo := round(m_saldo / m_media, 1); end if;
  select max(m.date_start) into m_ult_gasto from crm_meta_ads_campaigns m where m.tenant_id is null and m.spend > 0;
  if m_ult_gasto is not null then
    m_dias_sem := hoje - m_ult_gasto;
    select coalesce(sum(m.spend),0) into m_gasto_antes from crm_meta_ads_campaigns m
     where m.tenant_id is null and m.date_start >= m_ult_gasto - 14 and m.date_start < m_ult_gasto;
  end if;

  with meta as (
    select * from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= v_ini and m.date_start < v_fim
  ),
  pagos as (
    select l.id, l.created_at, l.closed_at, l.opportunity_value, st.final_type
      from crm_leads l left join crm_stages st on st.id = l.stage_id
     where l.tenant_id is null
       and (l.meta_campaign_id is not null or l.meta_lead_id is not null or lower(coalesce(l.utm_source,'')) in ('facebook','fb','ig','instagram','meta'))
       and ((l.created_at >= t_ini and l.created_at < t_fim) or (l.closed_at >= t_ini and l.closed_at < t_fim))
  )
  select jsonb_build_object(
    'spend', (select coalesce(sum(spend),0) from meta),
    'tem_dados', (select count(*) > 0 from meta),
    'impressoes', (select coalesce(sum(impressions),0) from meta),
    'cliques', (select coalesce(sum(clicks),0) from meta),
    'leads_meta', (select coalesce(sum(leads),0) from meta),
    'leads_pagos_crm', (select count(*) from pagos where created_at >= t_ini and created_at < t_fim),
    'vendas_leads_pagos', (select count(*) from pagos where final_type = 'won' and closed_at >= t_ini and closed_at < t_fim),
    'receita_leads_pagos', (select coalesce(sum(opportunity_value),0) from pagos where final_type = 'won' and closed_at >= t_ini and closed_at < t_fim),
    'custo_discador', null,
    'meta', jsonb_build_object('conectada', m_tem_conta, 'conta', m_nome, 'ad_account_id', m_act, 'account_row_id', m_id,
              'ultimo_sync', m_sync, 'horas_desde_sync', m_horas, 'ultimo_dia_com_gasto', m_ult_gasto, 'dias_sem_gasto', m_dias_sem,
              'situacao', m_situacao, 'pre_paga', m_pre, 'saldo', m_saldo, 'devido', m_devido, 'forma_pagamento', m_forma,
              'media_dia', m_media, 'dias_de_saldo', m_dias_saldo, 'saldo_conferido_em', m_saldo_em, 'saldo_erro', m_saldo_erro, 'nivel_saldo', m_nivel),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', y.date_start, 'spend', y.s, 'leads', y.l, 'impressoes', y.i, 'cliques', y.c, 'campanhas', y.n) order by y.date_start), '[]')
                  from (select date_start, sum(spend) s, sum(leads) l, sum(impressions) i, sum(clicks) c, count(*) filter (where spend > 0) n from meta group by 1) y),
    'campanhas', (select coalesce(jsonb_agg(x order by (x->>'spend')::numeric desc), '[]') from (
        select jsonb_build_object('nome', (array_agg(g.campaign_name order by g.date_start desc))[1], 'campaign_id', g.campaign_id, 'spend', sum(g.spend), 'leads', sum(g.leads),
                 'impressoes', sum(g.impressions), 'cliques', sum(g.clicks), 'status', (array_agg(g.status order by g.date_start desc))[1],
                 'objetivo', max(g.objective), 'dias', count(*) filter (where g.spend > 0),
                 'leads_crm', (select count(*) from crm_leads l where l.meta_campaign_id = g.campaign_id and l.created_at >= t_ini and l.created_at < t_fim),
                 'vendas_crm', (select count(*) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_campaign_id = g.campaign_id and st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim),
                 'receita_crm', (select coalesce(sum(l.opportunity_value),0) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_campaign_id = g.campaign_id and st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim)) x
          from meta g group by g.campaign_id order by sum(g.spend) desc limit 30) y)
  ) into tra;

  tra := tra || jsonb_build_object(
    'cpl', case when (tra->>'leads_meta')::int > 0 then (tra->>'spend')::numeric / (tra->>'leads_meta')::int end,
    'roas', case when (tra->>'spend')::numeric > 0 then (tra->>'receita_leads_pagos')::numeric / (tra->>'spend')::numeric end,
    'cac', case when (tra->>'spend')::numeric > 0 and (com->>'vendas')::int > 0 then (tra->>'spend')::numeric / (com->>'vendas')::int end,
    'custo_reuniao_agendada', case when (tra->>'spend')::numeric > 0 and (com->>'agendadas')::int > 0 then (tra->>'spend')::numeric / (com->>'agendadas')::int end,
    'custo_reuniao_realizada', case when (tra->>'spend')::numeric > 0 and (com->>'realizadas')::int > 0 then (tra->>'spend')::numeric / (com->>'realizadas')::int end);

  ---------------------------------------------------------------- clientes / entrega
  select count(*) into n_aviso from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
   where c.status = 'active' and p.status in ('notice_period','cancellation_signaled');

  select count(*) into n_vencendo from onboarding_companies c
   where c.status = 'active' and coalesce(c.is_simulator,false) = false and c.tenant_id is null
     and coalesce(c.renewal_plan_type,'monthly') not in ('monthly','mensal')
     and c.contract_end_date between hoje and hoje + 30;

  select count(*) into n_checkup from produto_checkup_itens i
   where i.dia = hoje and i.tratado_em is null;

  select count(*) into n_nps_baixo from onboarding_nps_responses n join onboarding_projects p on p.id = n.project_id
    join onboarding_companies c on c.id = p.onboarding_company_id
   where c.status = 'active' and n.created_at >= t_ini and n.created_at < t_fim and n.score <= 6;

  with emp as (
    select c.id, c.name, c.consultant_id, c.cs_id, c.contract_value, c.renewal_plan_type, c.contract_end_date, c.contract_start_date
      from onboarding_companies c
     where c.status = 'active' and coalesce(c.is_simulator,false) = false and c.tenant_id is null
  ),
  proj as (
    select p.id, p.onboarding_company_id cid, p.status from onboarding_projects p join emp e on e.id = p.onboarding_company_id
     where p.status in ('active','notice_period','cancellation_signaled')
  ),
  saude as (
    -- um score por empresa: empresa com dois projetos ativos pega o mais recente
    select distinct on (pr.cid) pr.cid, h.total_score, h.risk_level, h.trend_direction
      from client_health_scores h join proj pr on pr.id = h.project_id order by pr.cid, h.updated_at desc
  ),
  tarefas as (
    select t.responsible_staff_id, pr.cid, count(*) n
      from onboarding_tasks t join proj pr on pr.id = t.project_id
     where t.status::text in ('pending','in_progress') and t.due_date < hoje group by 1, 2
  )
  select jsonb_build_object(
    'ativas', (select count(*) from emp),
    'em_aviso', n_aviso,
    'novos', (select count(*) from onboarding_companies c where c.tenant_id is null and coalesce(c.is_simulator,false) = false
               and c.contract_start_date >= v_ini and c.contract_start_date < v_fim),
    'novos_lista', (select coalesce(jsonb_agg(jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', c.contract_value, 'inicio', c.contract_start_date, 'plano', c.renewal_plan_type) order by c.contract_start_date), '[]')
                    from onboarding_companies c where c.tenant_id is null and coalesce(c.is_simulator,false) = false
                     and c.contract_start_date >= v_ini and c.contract_start_date < v_fim),
    'churn_n', (select count(*) from onboarding_projects p where p.churn_date >= t_ini and p.churn_date < t_fim and p.status in ('closed','completed')),
    'churn_valor', (select coalesce(sum(c.contract_value),0) from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
                     where p.churn_date >= t_ini and p.churn_date < t_fim and p.status in ('closed','completed')),
    'churn_lista', (select coalesce(jsonb_agg(jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', c.contract_value, 'data', (p.churn_date at time zone v_tz)::date, 'motivo', p.churn_reason) order by p.churn_date), '[]')
                    from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
                     where p.churn_date >= t_ini and p.churn_date < t_fim and p.status in ('closed','completed')),
    'vencendo_30d', (select coalesce(jsonb_agg(jsonb_build_object('empresa', e.name, 'company_id', e.id, 'fim', e.contract_end_date, 'plano', e.renewal_plan_type, 'valor', e.contract_value, 'dias', e.contract_end_date - hoje) order by e.contract_end_date), '[]')
                     from emp e where coalesce(e.renewal_plan_type,'monthly') not in ('monthly','mensal') and e.contract_end_date between hoje and hoje + 30),
    'vencendo_30d_n', n_vencendo,
    'health', jsonb_build_object(
        'media', (select round(avg(total_score),1) from saude),
        'n', (select count(*) from saude),
        'excellent', (select count(*) from saude where risk_level = 'excellent'),
        'healthy', (select count(*) from saude where risk_level = 'healthy'),
        'attention', (select count(*) from saude where risk_level = 'attention'),
        'at_risk', (select count(*) from saude where risk_level = 'at_risk'),
        'critical', (select count(*) from saude where risk_level = 'critical')),
    'health_baixo', (select coalesce(jsonb_agg(jsonb_build_object('empresa', e.name, 'company_id', e.id, 'score', s.total_score, 'nivel', s.risk_level, 'tendencia', s.trend_direction, 'consultor', st.name) order by s.total_score), '[]')
                     from saude s join emp e on e.id = s.cid left join onboarding_staff st on st.id = e.consultant_id
                     where s.risk_level in ('critical','at_risk')),
    'nps', (select round(avg(n.score),1) from onboarding_nps_responses n where n.created_at >= t_ini and n.created_at < t_fim),
    'nps_n', (select count(*) from onboarding_nps_responses n where n.created_at >= t_ini and n.created_at < t_fim),
    'nps_baixo_n', n_nps_baixo,
    'csat', (select round(avg(r.score),1) from csat_responses r where coalesce(r.responded_at, r.created_at) >= t_ini and coalesce(r.responded_at, r.created_at) < t_fim),
    'csat_n', (select count(*) from csat_responses r where coalesce(r.responded_at, r.created_at) >= t_ini and coalesce(r.responded_at, r.created_at) < t_fim),
    'tarefas_atrasadas', (select coalesce(sum(n),0) from tarefas),
    'tarefas_por_responsavel', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc), '[]') from (
        select jsonb_build_object('staff_id', t.responsible_staff_id, 'nome', coalesce(s.name, 'Sem responsável'), 'n', sum(t.n), 'empresas', count(distinct t.cid)) x
          from tarefas t left join onboarding_staff s on s.id = t.responsible_staff_id group by t.responsible_staff_id, s.name) y),
    'checkup_pendentes', n_checkup,
    'checkup_por_bloco', (select coalesce(jsonb_agg(jsonb_build_object('bloco', bloco, 'n', n) order by n desc), '[]') from (
        select i.bloco, count(*) n from produto_checkup_itens i where i.dia = hoje and i.tratado_em is null group by 1) y),
    'por_consultor', (select coalesce(jsonb_agg(x order by (x->>'empresas')::int desc), '[]') from (
        select jsonb_build_object('staff_id', s.id, 'nome', s.name, 'papel', s.role,
                 'empresas', (select count(*) from emp e where e.consultant_id = s.id),
                 'health_media', (select round(avg(sd.total_score),1) from saude sd join emp e on e.id = sd.cid where e.consultant_id = s.id),
                 'criticas', (select count(*) from saude sd join emp e on e.id = sd.cid where e.consultant_id = s.id and sd.risk_level in ('critical','at_risk')),
                 'tarefas_atrasadas', (select coalesce(sum(t.n),0) from tarefas t where t.responsible_staff_id = s.id),
                 'em_aviso', (select count(*) from proj pr join emp e on e.id = pr.cid where e.consultant_id = s.id and pr.status <> 'active'),
                 'mensalidades', (select coalesce(sum(c.amount_cents)/100.0,0) from company_recurring_charges c join emp e on e.id = c.company_id where e.consultant_id = s.id and c.is_active and c.recurrence = 'monthly')) x
          from onboarding_staff s where s.tenant_id is null and s.is_active and s.id in (select consultant_id from emp)) y)
  ) into cli;

  select count(*) into n_health_baixo from jsonb_array_elements(cli->'health_baixo');

  ---------------------------------------------------------------- atendimento
  select count(*) into n_conv_wait from crm_whatsapp_conversations c
   where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null;
  select count(*) into n_conv24 from crm_whatsapp_conversations c
   where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null and c.last_inbound_at < now() - interval '24 hours';

  with msgs as (
    select m.direction, coalesce(m.is_ai,false) eh_ia, m.conversation_id
      from crm_whatsapp_messages m where m.created_at >= t_ini and m.created_at < t_fim and m.deleted_at is null
  )
  select jsonb_build_object(
    'conversas', (select count(distinct conversation_id) from msgs),
    'recebidas', (select count(*) from msgs where direction = 'inbound'),
    'enviadas', (select count(*) from msgs where direction = 'outbound'),
    'enviadas_ia', (select count(*) from msgs where direction = 'outbound' and eh_ia),
    'esperando', n_conv_wait,
    'esperando_24h', n_conv24,
    'esperando_lista', (select coalesce(jsonb_agg(x order by x->>'desde'), '[]') from (
        select jsonb_build_object('conversation_id', c.id, 'lead_id', c.lead_id, 'nome', coalesce(l.name, ct.name, ct.phone), 'desde', c.last_inbound_at,
                 'horas', round(extract(epoch from (now() - c.last_inbound_at))/3600), 'atendente', s.name, 'ultima', left(c.last_message, 90)) x
          from crm_whatsapp_conversations c left join crm_leads l on l.id = c.lead_id left join crm_whatsapp_contacts ct on ct.id = c.contact_id
          left join onboarding_staff s on s.id = c.assigned_to
         where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null and c.last_inbound_at < now() - interval '24 hours'
         order by c.last_inbound_at limit 40) y),
    'por_atendente', (select coalesce(jsonb_agg(x order by (x->>'esperando')::int desc), '[]') from (
        select jsonb_build_object('nome', coalesce(s.name, 'Sem atendente'), 'esperando', count(*),
                 'mais_24h', count(*) filter (where c.last_inbound_at < now() - interval '24 hours')) x
          from crm_whatsapp_conversations c left join onboarding_staff s on s.id = c.assigned_to
         where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null
         group by s.name) y)
  ) into ate;

  ---------------------------------------------------------------- IA e automações
  select coalesce(sum(custo_usd_estimado),0) into custo_ia from ai_usage_daily where dia >= v_ini and dia < v_fim;
  select teto_usd into teto_ia from ai_usage_config where id;
  select coalesce(sum(custo_usd_estimado),0) into custo_hoje from ai_usage_daily where dia = hoje;

  with runs as (
    select r.agent_id, r.mode, r.outcome, r.channel from crm_ai_agent_runs r where r.created_at >= t_ini and r.created_at < t_fim
  ),
  wa as (
    select count(*) n, coalesce(sum(coalesce((select wa_preco_servico_brl from ai_usage_config where id), (o.pricing_rates->>'UTILITY')::numeric, 0.04)),0) custo
      from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
      join whatsapp_official_instances o on o.id = c.official_instance_id
     where m.direction = 'outbound' and m.deleted_at is null and m.created_at >= t_ini and m.created_at < t_fim
  )
  select jsonb_build_object(
    'custo_usd', round(custo_ia,2), 'teto_dia_usd', teto_ia, 'custo_hoje_usd', round(custo_hoje,2),
    'teto_mes_usd', case when teto_ia > 0 then teto_ia * extract(day from (v_fim - 1))::int end,
    'pct_teto_mes', case when teto_ia > 0 then round(custo_ia / (teto_ia * extract(day from (v_fim - 1))::int), 3) end,
    'pct_teto_hoje', case when teto_ia > 0 then round(custo_hoje / teto_ia, 3) end,
    'dolar', (select dolar from ai_usage_config where id),
    'custo_brl', case when (select dolar from ai_usage_config where id) > 0 then round(custo_ia * (select dolar from ai_usage_config where id), 2) end,
    'chamadas', (select coalesce(sum(chamadas),0) from ai_usage_daily where dia >= v_ini and dia < v_fim),
    'wa_msgs', (select n from wa), 'wa_custo', (select round(custo,2) from wa),
    'wa_teto', (select wa_teto_mes from ai_usage_config where id),
    'agentes_ativos', (select count(*) from crm_ai_agents a where a.is_active and a.tenant_id is null),
    'runs', (select count(*) from runs),
    'runs_enviadas', (select count(*) from runs where outcome like 'sent%'),
    'runs_auto', (select count(*) from runs where mode = 'auto' and outcome like 'sent%'),
    'runs_followup', (select count(*) from runs where mode = 'followup' and outcome like 'sent%'),
    'runs_opt_out', (select count(*) from runs where outcome = 'opt_out'),
    'por_agente', (select coalesce(jsonb_agg(x order by (x->>'enviadas')::int desc), '[]') from (
        select jsonb_build_object('id', a.id, 'nome', a.name, 'ativo', a.is_active, 'runs', count(r.*),
                 'enviadas', count(*) filter (where r.outcome like 'sent%'),
                 'followups', count(*) filter (where r.mode = 'followup' and r.outcome like 'sent%'),
                 'opt_out', count(*) filter (where r.outcome = 'opt_out')) x
          from crm_ai_agents a join runs r on r.agent_id = a.id where a.tenant_id is null group by a.id, a.name, a.is_active) y),
    'por_fn', (select coalesce(jsonb_agg(x order by (x->>'custo')::numeric desc), '[]') from (
        select jsonb_build_object('nome', fn, 'custo', round(sum(custo_usd_estimado),2), 'chamadas', sum(chamadas)) x
          from ai_usage_daily where dia >= v_ini and dia < v_fim group by fn order by sum(custo_usd_estimado) desc limit 15) y),
    'automacoes_ativas', (select count(*) from crm_automations a where a.is_active) + (select count(*) from automation_rules r where r.is_active),
    'automacoes_runs', (select count(*) from crm_automation_runs r where r.created_at >= t_ini and r.created_at < t_fim)
                       + (select count(*) from automation_executions e where e.executed_at >= t_ini and e.executed_at < t_fim)
  ) into ia;

  ---------------------------------------------------------------- roda sozinho
  select jsonb_build_object(
    'agente_respostas', (ia->>'runs_auto')::int,
    'agente_followups', (ia->>'runs_followup')::int,
    'cobrancas', (select count(*) from billing_notification_logs b where b.sent_at >= t_ini and b.sent_at < t_fim),
    'lembretes_reuniao', (select count(*) from crm_meeting_reminder_runs r where r.created_at >= t_ini and r.created_at < t_fim and coalesce(r.status,'') not in ('error','failed')),
    'automacoes_crm', (ia->>'automacoes_runs')::int,
    'disparos', (select coalesce(sum(total),0) from whatsapp_official_campaigns c where c.created_at >= t_ini and c.created_at < t_fim and c.status = 'done'),
    'leads_formulario_meta', (select count(*) from crm_leads l where l.tenant_id is null and l.meta_lead_id is not null and l.created_at >= t_ini and l.created_at < t_fim),
    'leads_sem_criador', (select count(*) from crm_leads l where l.tenant_id is null and l.created_by is null and l.created_at >= t_ini and l.created_at < t_fim),
    'followups_personalizados', (select count(*) from crm_lead_followups f where f.created_at >= t_ini and f.created_at < t_fim and f.status = 'sent'),
    'atividades_automaticas', (select count(*) from crm_activities a where a.is_automation and a.created_at >= t_ini and a.created_at < t_fim),
    'mensagens_ia', (ate->>'enviadas_ia')::int
  ) into roda;

  ---------------------------------------------------------------- equipe
  select coalesce(jsonb_agg(jsonb_build_object('papel', role, 'n', n) order by n desc), '[]') into equipe
    from (select role, count(*) n from onboarding_staff where is_active and tenant_id is null group by role) y;

  ---------------------------------------------------------------- série 12 meses
  with meses as (
    select generate_series(s_ini, (s_fim - interval '1 month')::date, interval '1 month')::date m
  ),
  rec as (select date_trunc('month', (i.paid_at at time zone v_tz))::date m, sum(coalesce(i.paid_amount_cents, i.amount_cents))/100.0 v, count(*) n
            from company_invoices i where i.status = 'paid' and i.paid_at >= ts_ini and i.paid_at < ts_fim group by 1),
  inv as (select date_trunc('month', i.due_date)::date m, count(*) n from company_invoices i where i.due_date >= s_ini and i.due_date < s_fim group by 1),
  pag as (select date_trunc('month', p.paid_date)::date m, sum(coalesce(p.paid_amount, p.amount)) v
            from financial_payables p where p.status = 'paid' and p.tenant_id is null and p.paid_date >= s_ini and p.paid_date < s_fim group by 1),
  ven as (select date_trunc('month', (l.closed_at at time zone v_tz))::date m, count(*) n, sum(coalesce(l.opportunity_value,0)) v
            from crm_leads l join crm_stages st on st.id = l.stage_id
           where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= ts_ini and l.closed_at < ts_fim group by 1),
  led as (select date_trunc('month', (l.created_at at time zone v_tz))::date m, count(*) n,
                 count(*) filter (where p.counts_lead_inflow) n_inflow
            from crm_leads l left join crm_pipelines p on p.id = l.pipeline_id
           where l.tenant_id is null and l.created_at >= ts_ini and l.created_at < ts_fim group by 1),
  reu as (select date_trunc('month', (e.event_date at time zone v_tz))::date m,
                 count(*) filter (where e.event_type = 'scheduled') ag,
                 count(*) filter (where e.event_type in ('realized','realized_out_of_icp')) re,
                 count(*) filter (where e.event_type = 'no_show') ns
            from crm_meeting_events e where e.event_date >= ts_ini and e.event_date < ts_fim group by 1),
  met as (select date_trunc('month', m.date_start)::date m, sum(m.spend) v, sum(m.leads) n
            from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= s_ini and m.date_start < s_fim group by 1),
  iau as (select date_trunc('month', dia)::date m, sum(custo_usd_estimado) v from ai_usage_daily where dia >= s_ini and dia < s_fim group by 1),
  chu as (select date_trunc('month', (p.churn_date at time zone v_tz))::date m, count(*) n from onboarding_projects p
           where p.status in ('closed','completed') and p.churn_date >= ts_ini and p.churn_date < ts_fim group by 1),
  nov as (select date_trunc('month', c.contract_start_date)::date m, count(*) n from onboarding_companies c
           where c.tenant_id is null and coalesce(c.is_simulator,false) = false and c.contract_start_date >= s_ini and c.contract_start_date < s_fim group by 1),
  runs as (select date_trunc('month', (r.created_at at time zone v_tz))::date m, count(*) filter (where r.outcome like 'sent%') n
            from crm_ai_agent_runs r where r.created_at >= ts_ini and r.created_at < ts_fim group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'mes', to_char(x.m, 'YYYY-MM-DD'),
      'recebido', case when rec.m is not null or inv.m is not null then coalesce(rec.v,0) end, 'recebido_n', coalesce(rec.n,0),
      'pago', case when pag.m is not null then pag.v end,
      'lucro', case when (rec.m is not null or inv.m is not null) and pag.m is not null then coalesce(rec.v,0) - pag.v end,
      'vendas', case when led.m is not null or ven.m is not null then coalesce(ven.n,0) end, 'receita', case when led.m is not null or ven.m is not null then coalesce(ven.v,0) end,
      'leads', case when led.m is not null then led.n end, 'leads_inflow', case when led.m is not null then led.n_inflow end,
      'agendadas', case when led.m is not null or reu.m is not null then coalesce(reu.ag,0) end,
      'realizadas', case when led.m is not null or reu.m is not null then coalesce(reu.re,0) end,
      'no_show', case when led.m is not null or reu.m is not null then coalesce(reu.ns,0) end,
      'spend', case when met.m is not null then met.v end, 'leads_meta', case when met.m is not null then met.n end,
      'custo_ia', case when iau.m is not null then iau.v end,
      'churn', coalesce(chu.n,0), 'novos', coalesce(nov.n,0), 'agente_msgs', case when runs.m is not null then runs.n end
    ) order by x.m), '[]') into serie
    from meses x
    left join rec on rec.m = x.m left join inv on inv.m = x.m left join pag on pag.m = x.m left join ven on ven.m = x.m left join led on led.m = x.m
    left join reu on reu.m = x.m left join met on met.m = x.m left join iau on iau.m = x.m left join chu on chu.m = x.m
    left join nov on nov.m = x.m left join runs on runs.m = x.m;

  ---------------------------------------------------------------- alertas (estado de hoje)
  if n_venc7 > 0 then
    alertas := alertas || jsonb_build_object('area','financeiro','gravidade', case when v_venc7 >= 5000 then 'alta' else 'media' end,
      'titulo', n_venc7 || ' fatura' || case when n_venc7 > 1 then 's' else '' end || ' vencida' || case when n_venc7 > 1 then 's' else '' end || ' há mais de 7 dias',
      'detalhe', 'R$ ' || replace(to_char(v_venc7, 'FM999G999G990'), ',', '.') || ' parados. Cobrar ou negociar hoje.',
      'link', '/onboarding-tasks/financeiro', 'view', 'financeiro');
  end if;
  if v_saldo < v_pagar7 then
    alertas := alertas || jsonb_build_object('area','financeiro','gravidade','alta',
      'titulo', 'Saldo em banco abaixo das contas da semana',
      'detalhe', 'Saldo R$ ' || replace(to_char(v_saldo, 'FM999G999G990'), ',', '.') || ' contra R$ ' || replace(to_char(v_pagar7, 'FM999G999G990'), ',', '.') || ' a pagar em 7 dias. Saldo é o do Nexus, confira no banco.',
      'link', '/onboarding-tasks/financeiro', 'view', 'financeiro');
  end if;
  if n_pagar3 > 0 then
    alertas := alertas || jsonb_build_object('area','financeiro','gravidade','media',
      'titulo', n_pagar3 || ' conta' || case when n_pagar3 > 1 then 's' else '' end || ' a pagar vence' || case when n_pagar3 > 1 then 'm' else '' end || ' em 3 dias',
      'detalhe', 'R$ ' || replace(to_char(v_pagar3, 'FM999G999G990'), ',', '.') || ' até ' || to_char(hoje + 3, 'DD/MM') || '.',
      'link', '/onboarding-tasks/financeiro', 'view', 'financeiro');
  end if;
  -- Meta Ads: conexão, saldo e investimento
  if not m_tem_conta then
    alertas := alertas || jsonb_build_object('area','trafego','gravidade','alta',
      'titulo', 'Sem conta do Meta Ads conectada',
      'detalhe', 'O painel fica sem investimento, CPL e ROAS. Conecte em CRM, Tráfego Pago.',
      'link', '/crm', 'view', 'trafego');
  else
    if m_horas is null or m_horas > 8 then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade','alta',
        'titulo', case when m_horas is null then 'Meta Ads conectado, mas nunca sincronizou'
                       when m_horas >= 48 then 'Meta Ads não sincroniza há ' || floor(m_horas / 24)::int || ' dias'
                       else 'Meta Ads não sincroniza há ' || round(m_horas)::int || ' horas' end,
        'detalhe', 'A sincronização roda sozinha de 2 em 2 horas. Parada assim é acesso vencido ou conexão caída. Reconecte em CRM, Tráfego Pago.',
        'link', '/crm', 'view', 'trafego');
    end if;
    -- saldo da conta pré-paga: zerado, crítico ou baixo (o nível quem calcula é a edge do saldo)
    if m_nivel = 'zerado' then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade','alta',
        'titulo', 'Saldo do Meta Ads zerado',
        'detalhe', 'Campanhas ativas não entregam sem crédito. Recarregue no Gerenciador de Anúncios.'
                   || case when m_ult_gasto is not null and m_dias_sem >= 1 then ' Sem gasto desde ' || to_char(m_ult_gasto, 'DD/MM') || '.' else '' end,
        'link', '/crm', 'view', 'trafego');
    elsif m_nivel in ('critico','baixo') then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade', case when m_nivel = 'critico' then 'alta' else 'media' end,
        'titulo', 'Saldo do Meta Ads no fim: R$ ' || replace(to_char(m_saldo, 'FM999G999G990'), ',', '.')
                  || case when m_dias_saldo is not null then ', dá pra ' || replace(m_dias_saldo::text, '.', ',') || ' dia' || case when m_dias_saldo = 1 then '' else 's' end else '' end,
        'detalhe', 'Campanhas ativas não entregam sem crédito. Recarregue no Gerenciador de Anúncios.',
        'link', '/crm', 'view', 'trafego');
    end if;
    -- sem investimento: só com o sync em dia (senão é falta de dado) e só quando a
    -- causa não é saldo zerado (aí o alerta de cima já diz o porquê)
    if m_horas is not null and m_horas <= 8 and coalesce(m_nivel,'') <> 'zerado'
       and m_ult_gasto is not null and m_dias_sem >= 2 and coalesce(m_gasto_antes,0) > 0 then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade','media',
        'titulo', 'Sem investimento no Meta há ' || m_dias_sem || ' dias',
        'detalhe', 'Último dia com gasto: ' || to_char(m_ult_gasto, 'DD/MM') || '. Nos 14 dias antes foram R$ ' || replace(to_char(m_gasto_antes, 'FM999G999G990'), ',', '.') || '. Tem saldo na conta: campanha pausada ou cartão recusado.',
        'link', '/crm', 'view', 'trafego');
    end if;
  end if;
  if n_vencendo > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','media',
      'titulo', n_vencendo || ' contrato' || case when n_vencendo > 1 then 's' else '' end || ' vence' || case when n_vencendo > 1 then 'm' else '' end || ' em 30 dias',
      'detalhe', 'Sem renovação registrada. Marcar reunião de renovação.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;
  if n_aviso > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','alta',
      'titulo', n_aviso || ' cliente' || case when n_aviso > 1 then 's' else '' end || ' em aviso de saída',
      'detalhe', 'R$ ' || replace(to_char((fin->>'mrr_em_aviso')::numeric, 'FM999G999G990'), ',', '.') || ' de mensalidade em risco. Ligar antes que vire churn.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;
  if n_ganhos_sem_valor > 0 then
    alertas := alertas || jsonb_build_object('area','comercial','gravidade','media',
      'titulo', n_ganhos_sem_valor || ' venda' || case when n_ganhos_sem_valor > 1 then 's' else '' end || ' ganha' || case when n_ganhos_sem_valor > 1 then 's' else '' end || ' sem valor no mês',
      'detalhe', 'Lead em estágio ganho com valor zerado. A receita vendida está subestimada.',
      'link', '/crm/leads', 'view', 'comercial');
  end if;
  if n_conv24 > 0 then
    alertas := alertas || jsonb_build_object('area','atendimento','gravidade', case when n_conv24 >= 50 then 'alta' else 'media' end,
      'titulo', n_conv24 || ' conversa' || case when n_conv24 > 1 then 's' else '' end || ' sem resposta há mais de 24 h',
      'detalhe', 'Cliente ou lead mandou a última mensagem e ninguém respondeu. ' || n_conv_wait || ' esperando no total.',
      'link', '/crm/inbox', 'view', 'atendimento');
  end if;
  if teto_ia > 0 and custo_hoje >= 0.8 * teto_ia then
    alertas := alertas || jsonb_build_object('area','ia','gravidade', case when custo_hoje >= teto_ia then 'alta' else 'media' end,
      'titulo', 'Custo de IA de hoje em ' || round(100 * custo_hoje / teto_ia) || '% do teto diário',
      'detalhe', 'US$ ' || round(custo_hoje,2) || ' hoje contra teto de US$ ' || teto_ia || ' por dia. No mês: US$ ' || round(custo_ia,2) || '.',
      'link', '/onboarding-tasks/custo-ia', 'view', 'ia');
  end if;
  if n_health_baixo > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade', case when n_health_baixo >= 10 then 'alta' else 'media' end,
      'titulo', n_health_baixo || ' cliente' || case when n_health_baixo > 1 then 's' else '' end || ' com health score crítico ou em risco',
      'detalhe', 'De ' || (cli->>'ativas') || ' ativos. Ver a lista e cobrar plano de ação do consultor.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;
  for lt in select * from jsonb_to_recordset(cli->'tarefas_por_responsavel') as t(staff_id uuid, nome text, n int, empresas int) where n >= 10 order by n desc loop
    alertas := alertas || jsonb_build_object('area','clientes','gravidade', case when lt.n >= 30 then 'alta' else 'media' end,
      'titulo', lt.nome || ' com ' || lt.n || ' tarefas atrasadas',
      'detalhe', 'Em ' || lt.empresas || ' cliente' || case when lt.empresas > 1 then 's' else '' end || '. Tarefa vencida sem conclusão.',
      'link', '/onboarding-tasks', 'view', 'clientes');
  end loop;
  if n_checkup > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','baixa',
      'titulo', n_checkup || ' pendência' || case when n_checkup > 1 then 's' else '' end || ' no checkup de hoje',
      'detalhe', 'Itens do checkup diário do produto ainda sem tratamento.',
      'link', '/onboarding-tasks/checkup', 'view', 'clientes');
  end if;
  if n_nps_baixo > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','alta',
      'titulo', n_nps_baixo || ' NPS detrator' || case when n_nps_baixo > 1 then 'es' else '' end || ' no mês',
      'detalhe', 'Nota 6 ou menos de cliente ativo. Ligar pro cliente.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;

  -- blocos "pra frente": os alertas deles entram na frente da fila (caixa negativo é o mais grave)
  frente := painel_frente_interno(v_ini);
  -- "Caixa fica negativo" já diz o que "Saldo em banco abaixo das contas da semana"
  -- diria, com data e tamanho do buraco: com o primeiro ativo, o segundo sai.
  if exists (select 1 from jsonb_array_elements(coalesce(frente->'alertas', '[]'::jsonb)) a where a->>'titulo' like 'Caixa fica negativo%') then
    select coalesce(jsonb_agg(a), '[]'::jsonb) into alertas
      from jsonb_array_elements(alertas) a where a->>'titulo' <> 'Saldo em banco abaixo das contas da semana';
  end if;
  alertas := coalesce(frente->'alertas', '[]'::jsonb) || alertas;
  -- os mais graves primeiro, mantendo a ordem dentro de cada gravidade
  select coalesce(jsonb_agg(x.a order by case x.a->>'gravidade' when 'alta' then 1 when 'media' then 2 else 3 end, x.i), '[]'::jsonb) into alertas
    from jsonb_array_elements(alertas) with ordinality x(a, i);

  return jsonb_build_object(
    'mes', to_char(v_ini, 'YYYY-MM-DD'), 'hoje', to_char(hoje, 'YYYY-MM-DD'), 'gerado_em', now(),
    'financeiro', fin, 'comercial', com, 'trafego', tra, 'clientes', cli, 'atendimento', ate, 'ia', ia,
    'roda_sozinho', roda, 'equipe', equipe, 'alertas', alertas, 'serie', serie, 'frente', frente - 'alertas');
end $$;

create or replace function public.painel_controle_detalhe(p_month date, p_bloco text, p_filtro jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tz text := 'America/Sao_Paulo';
  v_ini date; v_fim date; t_ini timestamptz; t_fim timestamptz;
  f_company uuid := nullif(p_filtro->>'company_id','')::uuid;
  f_closer uuid := nullif(p_filtro->>'closer_id','')::uuid;
  f_sdr uuid := nullif(p_filtro->>'sdr_id','')::uuid;
  f_pipe uuid := nullif(p_filtro->>'pipeline_id','')::uuid;
  f_owner uuid := nullif(p_filtro->>'owner_id','')::uuid;
  f_staff uuid := nullif(p_filtro->>'staff_id','')::uuid;
  f_consult uuid := nullif(p_filtro->>'consultant_id','')::uuid;
  f_agent uuid := nullif(p_filtro->>'agent_id','')::uuid;
  f_atend uuid := nullif(p_filtro->>'atendente_id','')::uuid;
  f_tipo text := nullif(p_filtro->>'tipo','');
  f_nivel text := nullif(p_filtro->>'nivel','');
  f_origem text := nullif(p_filtro->>'origem','');
  f_categoria text := nullif(p_filtro->>'categoria','');
  f_campaign text := nullif(p_filtro->>'campaign_id','');
  f_fn text := nullif(p_filtro->>'fn','');
  f_adset text := nullif(p_filtro->>'adset_id','');
  f_dia date := nullif(p_filtro->>'dia','')::date;
  c_ini timestamptz; c_fim timestamptz;  -- janela dos leads do CRM: o dia filtrado ou o mês
  f_mode text := nullif(p_filtro->>'mode','');
  f_outcome text := nullif(p_filtro->>'outcome','');
  f_pago boolean := case when p_filtro ? 'pago' then (p_filtro->>'pago')::boolean end;
  f_24h boolean := coalesce((p_filtro->>'mais_24h')::boolean, false);
  out jsonb;
begin
  if not is_master() then raise exception 'Só o master'; end if;

  v_ini := date_trunc('month', coalesce(p_month, hoje))::date;
  v_fim := (v_ini + interval '1 month')::date;
  t_ini := v_ini::timestamp at time zone v_tz;
  t_fim := v_fim::timestamp at time zone v_tz;
  c_ini := coalesce(f_dia::timestamp at time zone v_tz, t_ini);
  c_fim := coalesce((f_dia + 1)::timestamp at time zone v_tz, t_fim);

  case p_bloco

  when 'faturas_pagas' then
    with base as (
      select i.id, c.name empresa, c.id company_id, coalesce(i.paid_amount_cents, i.amount_cents)/100.0 valor, i.amount_cents/100.0 valor_fatura,
             (i.paid_at at time zone v_tz)::date data, i.payment_method forma, b.name banco, i.description descricao,
             i.installment_number parcela, i.total_installments parcelas, i.due_date vencimento
        from company_invoices i join onboarding_companies c on c.id = i.company_id left join financial_banks b on b.id = i.bank_id
       where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim and (f_company is null or i.company_id = f_company))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc, b.valor desc), '[]') from (select * from base limit 500) b)) into out;

  when 'faturas_vencidas' then
    with base as (
      select i.id, c.name empresa, c.id company_id, coalesce(i.total_with_fees_cents, i.amount_cents)/100.0 valor, i.amount_cents/100.0 valor_original,
             i.due_date vencimento, hoje - i.due_date dias, i.status, i.description descricao, st.name consultor, c.status empresa_status,
             (select max(l.sent_at) from billing_notification_logs l where l.invoice_id = i.id) ultimo_contato,
             (select count(*) from billing_notification_logs l where l.invoice_id = i.id) contatos,
             i.payment_link_url link_pagamento
        from company_invoices i join onboarding_companies c on c.id = i.company_id left join onboarding_staff st on st.id = c.consultant_id
       where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje and (f_company is null or i.company_id = f_company))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]') from (select * from base limit 500) b)) into out;

  when 'faturas_a_receber' then
    with base as (
      select i.id, c.name empresa, c.id company_id, i.amount_cents/100.0 valor, i.due_date vencimento, i.due_date - hoje dias, i.status,
             i.description descricao, i.payment_method forma, st.name consultor, i.payment_link_url link_pagamento
        from company_invoices i join onboarding_companies c on c.id = i.company_id left join onboarding_staff st on st.id = c.consultant_id
       where i.paid_at is null and i.status in ('pending','overdue') and i.due_date >= v_ini and i.due_date < v_fim and (f_company is null or i.company_id = f_company))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.vencimento), '[]') from (select * from base limit 500) b)) into out;

  when 'contas_pagas' then
    with base as (
      select p.id, p.supplier_name fornecedor, p.description descricao, coalesce(fc.name,'Sem categoria') categoria, coalesce(p.paid_amount, p.amount) valor,
             p.due_date vencimento, p.paid_date pago_em, p.payment_method forma, b.name banco, p.cost_type tipo_custo
        from financial_payables p left join staff_financial_categories fc on fc.id = p.category_id left join financial_banks b on b.id = p.bank_id
       where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim
         and (f_categoria is null or coalesce(fc.name,'Sem categoria') = f_categoria))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.pago_em desc, b.valor desc), '[]') from (select * from base limit 500) b)) into out;

  when 'contas_a_pagar' then
    with base as (
      select p.id, p.supplier_name fornecedor, p.description descricao, coalesce(fc.name,'Sem categoria') categoria, p.amount - coalesce(p.paid_amount,0) valor,
             p.due_date vencimento, p.due_date - hoje dias, p.status, p.payment_method forma, p.is_recurring recorrente
        from financial_payables p left join staff_financial_categories fc on fc.id = p.category_id
       where p.status in ('pending','partial') and p.tenant_id is null
         and p.due_date >= least(v_ini, hoje - 60) and p.due_date < greatest(v_fim, hoje + 8))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.vencimento), '[]') from (select * from base limit 500) b)) into out;

  when 'bancos' then
    with base as (
      select b.id, b.name nome, b.bank_code codigo, b.current_balance_cents/100.0 saldo,
             case when b.provider_balance_at is not null then b.provider_balance_cents/100.0 end saldo_provedor, b.provider_balance_at atualizado_em,
             b.provider_balance_error erro,
             (select coalesce(sum(case when t.type in ('credit','in','entrada') then t.amount_cents else -t.amount_cents end),0)/100.0
                from financial_bank_transactions t where t.bank_id = b.id and t.created_at >= t_ini and t.created_at < t_fim) movimento_mes,
             (select count(*) from financial_bank_transactions t where t.bank_id = b.id and t.created_at >= t_ini and t.created_at < t_fim) lancamentos_mes
        from financial_banks b where b.is_active and b.tenant_id is null)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(saldo),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.saldo desc), '[]') from base b)) into out;

  when 'mrr' then
    with base as (
      select r.id, c.name empresa, c.id company_id, r.amount_cents/100.0 valor, r.description descricao, r.next_charge_date proxima_cobranca,
             r.payment_method forma, st.name consultor, c.contract_start_date inicio, c.renewal_plan_type plano,
             (select string_agg(p.status, ', ') from onboarding_projects p where p.onboarding_company_id = c.id and p.status in ('active','notice_period','cancellation_signaled')) projeto_status
        from company_recurring_charges r join onboarding_companies c on c.id = r.company_id left join onboarding_staff st on st.id = c.consultant_id
       where r.is_active and r.recurrence = 'monthly' and (f_consult is null or c.consultant_id = f_consult))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]') from base b)) into out;

  when 'vendas' then
    with base as (
      select l.id lead_id, l.name nome, l.company empresa, l.opportunity_value valor, (l.closed_at at time zone v_tz)::date data,
             cs.name closer, sd.name sdr, p.name funil, st.name etapa,
             coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) origem,
             (l.meta_campaign_id is not null or l.meta_lead_id is not null or lower(coalesce(l.utm_source,'')) in ('facebook','fb','ig','instagram','meta')) pago,
             (select string_agg(s.product_name, ', ') from crm_sales s where s.lead_id = l.id) produto,
             l.campaign_name campanha, l.phone telefone, l.segment segmento
        from crm_leads l join crm_stages st on st.id = l.stage_id
        left join onboarding_staff cs on cs.id = coalesce(l.closer_staff_id, l.owner_staff_id) left join onboarding_staff sd on sd.id = l.sdr_staff_id
        left join crm_pipelines p on p.id = l.pipeline_id
       where st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim and l.tenant_id is null
         and (f_closer is null or coalesce(l.closer_staff_id, l.owner_staff_id) = f_closer) and (f_sdr is null or l.sdr_staff_id = f_sdr)
         and (f_pipe is null or l.pipeline_id = f_pipe)
         and (f_pago is null or (l.meta_campaign_id is not null or l.meta_lead_id is not null or lower(coalesce(l.utm_source,'')) in ('facebook','fb','ig','instagram','meta')) = f_pago))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc, b.valor desc), '[]') from (select * from base limit 500) b)) into out;

  when 'reunioes' then
    with base as (
      select e.id, e.lead_id, l.name nome, l.company empresa, e.event_type tipo, e.event_date data, sd.name sdr, ow.name closer, p.name funil,
             st.name etapa_atual, st.final_type desfecho, l.opportunity_value valor
        from crm_meeting_events e left join crm_leads l on l.id = e.lead_id left join crm_stages st on st.id = l.stage_id
        left join onboarding_staff sd on sd.id = e.credited_staff_id left join onboarding_staff ow on ow.id = e.owner_staff_id
        left join crm_pipelines p on p.id = e.pipeline_id
       where e.event_date >= t_ini and e.event_date < t_fim
         and (f_tipo is null or e.event_type = f_tipo or (f_tipo = 'realizadas' and e.event_type in ('realized','realized_out_of_icp'))
              or (f_tipo = 'fora_icp' and e.event_type in ('out_of_icp','realized_out_of_icp')))
         and (f_closer is null or e.owner_staff_id = f_closer) and (f_sdr is null or e.credited_staff_id = f_sdr) and (f_pipe is null or e.pipeline_id = f_pipe))
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc), '[]') from (select * from base limit 500) b)) into out;

  when 'leads' then
    with base as (
      select l.id lead_id, l.name nome, l.company empresa, coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) origem,
             p.name funil, st.name etapa, st.final_type desfecho, ow.name dono, (l.created_at at time zone v_tz)::date criado_em,
             hoje - coalesce(l.stage_entered_at, l.created_at)::date dias_parado, l.opportunity_value valor, l.phone telefone, l.segment segmento,
             l.campaign_name campanha, l.pipeline_id, l.owner_staff_id
        from crm_leads l left join crm_pipelines p on p.id = l.pipeline_id left join crm_stages st on st.id = l.stage_id
        left join onboarding_staff ow on ow.id = l.owner_staff_id
       where l.created_at >= t_ini and l.created_at < t_fim and l.tenant_id is null
         and (f_pipe is null or l.pipeline_id = f_pipe) and (f_owner is null or l.owner_staff_id = f_owner)
         and (f_origem is null or coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) = f_origem)
         and (f_pago is null or (l.meta_campaign_id is not null or l.meta_lead_id is not null or lower(coalesce(l.utm_source,'')) in ('facebook','fb','ig','instagram','meta')) = f_pago))
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.criado_em desc), '[]') from (select * from base order by criado_em desc limit 500) b)) into out;

  when 'campanhas' then
    with base as (
      select m.campaign_id, (array_agg(m.campaign_name order by m.date_start desc))[1] nome, (array_agg(m.status order by m.date_start desc))[1] status, max(m.objective) objetivo,
             sum(m.spend) spend, sum(m.leads) leads, sum(m.impressions) impressoes, sum(m.clicks) cliques,
             case when sum(m.impressions) > 0 then sum(m.clicks)::numeric / sum(m.impressions) end ctr,
             case when sum(m.clicks) > 0 then sum(m.spend) / sum(m.clicks) end cpc,
             case when sum(m.impressions) > 0 then sum(m.spend) * 1000 / sum(m.impressions) end cpm,
             case when sum(m.leads) > 0 then sum(m.spend)/sum(m.leads) end cpl, count(*) filter (where m.spend > 0) dias,
             (select count(*) from crm_leads l where l.meta_campaign_id = m.campaign_id and l.created_at >= c_ini and l.created_at < c_fim) leads_crm,
             (select count(*) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_campaign_id = m.campaign_id and st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim) vendas_crm,
             (select coalesce(sum(l.opportunity_value),0) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_campaign_id = m.campaign_id and st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim) receita_crm
        from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= v_ini and m.date_start < v_fim and (f_dia is null or m.date_start = f_dia)
       group by m.campaign_id)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(spend),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.spend desc), '[]') from (select * from base order by spend desc limit 500) b)) into out;

  when 'campanhas_dia' then
    with base as (
      select m.date_start data, m.campaign_name campanha, m.campaign_id, m.spend, m.leads, m.impressions impressoes, m.clicks cliques,
             case when m.impressions > 0 then m.clicks::numeric / m.impressions end ctr,
             case when m.clicks > 0 then m.spend / m.clicks end cpc,
             case when m.impressions > 0 then m.spend * 1000 / m.impressions end cpm,
             case when m.leads > 0 then m.spend/m.leads end cpl, m.status
        from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= v_ini and m.date_start < v_fim
         and (f_campaign is null or m.campaign_id = f_campaign) and (f_dia is null or m.date_start = f_dia))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(spend),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc, b.spend desc), '[]') from (select * from base order by data desc, spend desc limit 500) b)) into out;

  when 'meta_dia' then
    -- um total por dia do mês (todas as campanhas somadas)
    with base as (
      select m.date_start dia, sum(m.spend) spend, sum(m.leads) leads, sum(m.impressions) impressoes, sum(m.clicks) cliques,
             case when sum(m.impressions) > 0 then sum(m.clicks)::numeric / sum(m.impressions) end ctr,
             case when sum(m.clicks) > 0 then sum(m.spend) / sum(m.clicks) end cpc,
             case when sum(m.impressions) > 0 then sum(m.spend) * 1000 / sum(m.impressions) end cpm,
             case when sum(m.leads) > 0 then sum(m.spend)/sum(m.leads) end cpl,
             count(*) filter (where m.spend > 0) campanhas,
             (select count(*) from crm_leads l where l.tenant_id is null and l.meta_campaign_id is not null
                and l.created_at >= m.date_start::timestamp at time zone v_tz and l.created_at < (m.date_start + 1)::timestamp at time zone v_tz) leads_crm
        from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= v_ini and m.date_start < v_fim
         and (f_campaign is null or m.campaign_id = f_campaign)
       group by m.date_start)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(spend),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.dia desc), '[]') from base b)) into out;

  when 'meta_conjuntos' then
    -- conjuntos de anúncio (adsets) do mês, de uma campanha ou de todas
    with base as (
      select s.adset_id, (array_agg(s.adset_name order by s.date_start desc))[1] nome, (array_agg(s.campaign_name order by s.date_start desc))[1] campanha, max(s.campaign_id) campaign_id,
             (array_agg(s.status order by s.date_start desc))[1] status, max(s.daily_budget) orcamento_dia,
             sum(s.spend) spend, sum(s.leads) leads, sum(s.impressions) impressoes, sum(s.clicks) cliques,
             case when sum(s.impressions) > 0 then sum(s.clicks)::numeric / sum(s.impressions) end ctr,
             case when sum(s.clicks) > 0 then sum(s.spend) / sum(s.clicks) end cpc,
             case when sum(s.impressions) > 0 then sum(s.spend) * 1000 / sum(s.impressions) end cpm,
             case when sum(s.leads) > 0 then sum(s.spend)/sum(s.leads) end cpl, count(*) filter (where s.spend > 0) dias,
             (select count(*) from crm_leads l where l.meta_adset_id = s.adset_id and l.created_at >= c_ini and l.created_at < c_fim) leads_crm,
             (select count(*) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_adset_id = s.adset_id and st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim) vendas_crm,
             (select coalesce(sum(l.opportunity_value),0) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_adset_id = s.adset_id and st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim) receita_crm
        from crm_meta_ads_adsets s where s.tenant_id is null and s.date_start >= v_ini and s.date_start < v_fim
         and (f_campaign is null or s.campaign_id = f_campaign) and (f_dia is null or s.date_start = f_dia)
       group by s.adset_id)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(spend),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.spend desc), '[]') from (select * from base order by spend desc limit 500) b)) into out;

  when 'meta_anuncios' then
    -- anúncios do mês, de um conjunto, de uma campanha ou de todos. Miniatura: a
    -- cópia permanente (crm_meta_ad_thumbs) vale mais que a URL da Meta, que expira.
    with agg as (
      select a.ad_id, (array_agg(a.ad_name order by a.date_start desc))[1] nome, (array_agg(a.adset_name order by a.date_start desc))[1] conjunto, max(a.adset_id) adset_id,
             (array_agg(a.campaign_name order by a.date_start desc))[1] campanha, max(a.campaign_id) campaign_id,
             (array_agg(a.status order by a.date_start desc))[1] status,
             (array_agg(a.creative_thumbnail_url order by a.date_start desc) filter (where a.creative_thumbnail_url is not null))[1] thumb_meta,
             max(a.creative_title) titulo, left(max(a.creative_body), 160) texto, max(a.creative_link_url) link,
             sum(a.spend) spend, sum(a.leads) leads, sum(a.impressions) impressoes, sum(a.clicks) cliques,
             case when sum(a.impressions) > 0 then sum(a.clicks)::numeric / sum(a.impressions) end ctr,
             case when sum(a.clicks) > 0 then sum(a.spend) / sum(a.clicks) end cpc,
             case when sum(a.impressions) > 0 then sum(a.spend) * 1000 / sum(a.impressions) end cpm,
             case when sum(a.leads) > 0 then sum(a.spend)/sum(a.leads) end cpl, count(*) filter (where a.spend > 0) dias
        from crm_meta_ads_ads a where a.tenant_id is null and a.date_start >= v_ini and a.date_start < v_fim
         and (f_adset is null or a.adset_id = f_adset) and (f_campaign is null or a.campaign_id = f_campaign) and (f_dia is null or a.date_start = f_dia)
       group by a.ad_id),
    base as (
      select g.ad_id, g.nome, g.conjunto, g.adset_id, g.campanha, g.campaign_id, g.status,
             coalesce((select t.url from crm_meta_ad_thumbs t where t.ad_id = g.ad_id limit 1),
                      (select t.url from crm_meta_ad_thumbs t where t.ad_key = g.nome limit 1), g.thumb_meta) thumb,
             g.titulo, g.texto, g.link, g.spend, g.leads, g.impressoes, g.cliques, g.ctr, g.cpc, g.cpm, g.cpl, g.dias,
             (select count(*) from crm_leads l where l.meta_ad_id = g.ad_id and l.created_at >= c_ini and l.created_at < c_fim) leads_crm,
             (select count(*) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_ad_id = g.ad_id and st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim) vendas_crm,
             (select coalesce(sum(l.opportunity_value),0) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_ad_id = g.ad_id and st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim) receita_crm
        from agg g)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(spend),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.spend desc), '[]') from (select * from base order by spend desc limit 500) b)) into out;

  when 'clientes' then
    with proj as (
      select distinct on (p.onboarding_company_id) p.onboarding_company_id cid, p.id, p.status, p.churn_date, p.churn_reason, p.product_name, p.notice_end_date
        from onboarding_projects p order by p.onboarding_company_id, (p.status in ('active','notice_period','cancellation_signaled')) desc, p.created_at desc),
    base as (
      select c.id company_id, c.name empresa, c.status empresa_status, st.name consultor, cs.name cs, c.contract_start_date inicio, c.contract_end_date fim,
             c.renewal_plan_type plano, c.contract_value valor_cadastro,
             (select coalesce(sum(r.amount_cents),0)/100.0 from company_recurring_charges r where r.company_id = c.id and r.is_active and r.recurrence = 'monthly') mensalidade,
             pr.status projeto_status, pr.product_name produto, (pr.churn_date at time zone v_tz)::date churn_em, pr.churn_reason churn_motivo,
             h.total_score score, h.risk_level nivel, h.trend_direction tendencia,
             (select n.score from onboarding_nps_responses n where n.project_id = pr.id order by n.created_at desc limit 1) nps,
             (select (n.created_at at time zone v_tz)::date from onboarding_nps_responses n where n.project_id = pr.id order by n.created_at desc limit 1) nps_em,
             (select count(*) from onboarding_tasks t where t.project_id = pr.id and t.status::text in ('pending','in_progress') and t.due_date < hoje) tarefas_atrasadas,
             (select coalesce(sum(coalesce(i.total_with_fees_cents, i.amount_cents)),0)/100.0 from company_invoices i where i.company_id = c.id and i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje) vencido,
             c.segment segmento
        from onboarding_companies c left join proj pr on pr.cid = c.id
        left join onboarding_staff st on st.id = c.consultant_id left join onboarding_staff cs on cs.id = c.cs_id
        left join lateral (select h.total_score, h.risk_level, h.trend_direction from client_health_scores h where h.project_id = pr.id order by h.updated_at desc limit 1) h on true
       where c.tenant_id is null and coalesce(c.is_simulator,false) = false
         and (f_consult is null or c.consultant_id = f_consult) and (f_nivel is null or h.risk_level = f_nivel)
         and case coalesce(f_tipo,'ativos')
               when 'ativos' then c.status = 'active'
               when 'vencendo' then c.status = 'active' and coalesce(c.renewal_plan_type,'monthly') not in ('monthly','mensal') and c.contract_end_date between hoje and hoje + 30
               when 'churn' then pr.churn_date >= t_ini and pr.churn_date < t_fim and pr.status in ('closed','completed')
               when 'novos' then c.contract_start_date >= v_ini and c.contract_start_date < v_fim
               when 'health_baixo' then c.status = 'active' and h.risk_level in ('critical','at_risk')
               when 'em_aviso' then c.status = 'active' and pr.status in ('notice_period','cancellation_signaled')
               else true end)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(mensalidade),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.score nulls last, b.empresa), '[]') from (select * from base limit 500) b)) into out;

  when 'tarefas_atrasadas' then
    with base as (
      select t.id, t.title titulo, c.name empresa, c.id company_id, t.project_id, s.name responsavel, t.due_date vencimento, hoje - t.due_date dias,
             t.priority prioridade, t.status::text status, t.start_date inicio
        from onboarding_tasks t join onboarding_projects p on p.id = t.project_id join onboarding_companies c on c.id = p.onboarding_company_id
        left join onboarding_staff s on s.id = t.responsible_staff_id
       where t.status::text in ('pending','in_progress') and t.due_date < hoje and p.status in ('active','notice_period','cancellation_signaled') and c.status = 'active'
         and (f_staff is null or t.responsible_staff_id = f_staff) and (f_company is null or c.id = f_company))
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.dias desc), '[]') from (select * from base limit 500) b)) into out;

  when 'nps' then
    with base as (
      select n.id, c.name empresa, c.id company_id, n.score nota, n.feedback, n.what_can_improve melhorar, n.respondent_name respondente,
             (n.created_at at time zone v_tz)::date data, st.name consultor
        from onboarding_nps_responses n join onboarding_projects p on p.id = n.project_id join onboarding_companies c on c.id = p.onboarding_company_id
        left join onboarding_staff st on st.id = c.consultant_id
       where n.created_at >= t_ini and n.created_at < t_fim)
    select jsonb_build_object('total', (select count(*) from base), 'media', (select round(avg(nota),1) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.nota, b.data desc), '[]') from base b)) into out;

  when 'csat' then
    with base as (
      select r.id, c.name empresa, c.id company_id, r.score nota, r.feedback, r.respondent_name respondente,
             (coalesce(r.responded_at, r.created_at) at time zone v_tz)::date data, st.name consultor
        from csat_responses r join onboarding_projects p on p.id = r.project_id join onboarding_companies c on c.id = p.onboarding_company_id
        left join onboarding_staff st on st.id = c.consultant_id
       where coalesce(r.responded_at, r.created_at) >= t_ini and coalesce(r.responded_at, r.created_at) < t_fim)
    select jsonb_build_object('total', (select count(*) from base), 'media', (select round(avg(nota),1) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.nota, b.data desc), '[]') from base b)) into out;

  when 'checkup' then
    with base as (
      select i.item_key, i.bloco, i.titulo, c.name empresa, c.id company_id, s.name responsavel, i.dia, i.tratado_em, i.nota
        from produto_checkup_itens i left join onboarding_companies c on c.id = i.company_id left join onboarding_staff s on s.id = i.staff_id
       where i.dia = hoje)
    select jsonb_build_object('total', (select count(*) from base where tratado_em is null),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by (b.tratado_em is not null), b.bloco), '[]') from base b)) into out;

  when 'conversas_esperando' then
    with base as (
      select c.id conversation_id, c.lead_id, coalesce(l.name, ct.name, ct.phone) nome, ct.phone telefone, c.last_inbound_at desde,
             round(extract(epoch from (now() - c.last_inbound_at))/3600) horas, s.name atendente, left(c.last_message, 120) ultima,
             coalesce(wi.display_name, wo.display_name) instancia, p.name funil
        from crm_whatsapp_conversations c left join crm_leads l on l.id = c.lead_id left join crm_whatsapp_contacts ct on ct.id = c.contact_id
        left join onboarding_staff s on s.id = c.assigned_to left join whatsapp_instances wi on wi.id = c.instance_id
        left join whatsapp_official_instances wo on wo.id = c.official_instance_id left join crm_pipelines p on p.id = l.pipeline_id
       where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null
         and (not f_24h or c.last_inbound_at < now() - interval '24 hours') and (f_atend is null or c.assigned_to = f_atend))
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.desde), '[]') from (select * from base order by desde limit 500) b)) into out;

  when 'conversas' then
    with base as (
      select c.id conversation_id, c.lead_id, coalesce(l.name, ct.name, ct.phone) nome, ct.phone telefone, c.last_message_at ultima_em,
             c.last_message_direction direcao, s.name atendente, left(c.last_message, 120) ultima, c.status, c.unread_count nao_lidas,
             coalesce(wi.display_name, wo.display_name) instancia
        from crm_whatsapp_conversations c left join crm_leads l on l.id = c.lead_id left join crm_whatsapp_contacts ct on ct.id = c.contact_id
        left join onboarding_staff s on s.id = c.assigned_to left join whatsapp_instances wi on wi.id = c.instance_id
        left join whatsapp_official_instances wo on wo.id = c.official_instance_id
       where c.last_message_at >= t_ini and c.last_message_at < t_fim and c.merged_into is null)
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.ultima_em desc), '[]') from (select * from base order by ultima_em desc limit 500) b)) into out;

  when 'ia_dia' then
    with base as (
      select d.dia, round(sum(d.custo_usd_estimado),2) custo, sum(d.chamadas) chamadas, sum(d.entrada) entrada, sum(d.saida) saida, sum(d.cache_lido) cache_lido,
             string_agg(distinct d.fn, ', ') funcoes
        from ai_usage_daily d where d.dia >= v_ini and d.dia < v_fim and (f_fn is null or d.fn = f_fn) group by d.dia)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(custo),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.dia desc), '[]') from base b)) into out;

  when 'agente_runs' then
    with base as (
      select r.id, r.created_at data, a.name agente, r.channel canal, r.mode modo, r.outcome, r.conversation_id, c.lead_id,
             coalesce(l.name, ct.name) lead, left(r.reply, 160) resposta, r.error erro
        from crm_ai_agent_runs r left join crm_ai_agents a on a.id = r.agent_id left join crm_whatsapp_conversations c on c.id = r.conversation_id
        left join crm_leads l on l.id = c.lead_id left join crm_whatsapp_contacts ct on ct.id = c.contact_id
       where r.created_at >= t_ini and r.created_at < t_fim and (f_agent is null or r.agent_id = f_agent)
         and (f_mode is null or r.mode = f_mode) and (f_outcome is null or (f_outcome = 'sent' and r.outcome like 'sent%') or r.outcome = f_outcome))
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc), '[]') from (select * from base order by data desc limit 500) b)) into out;

  when 'wa_numeros' then
    with base as (
      select o.id, o.display_name nome, o.phone_number telefone, o.status,
             coalesce((select wa_preco_servico_brl from ai_usage_config where id), (o.pricing_rates->>'UTILITY')::numeric, 0.04) preco,
             (select count(*) from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
               where c.official_instance_id = o.id and m.direction = 'outbound' and m.deleted_at is null and m.created_at >= t_ini and m.created_at < t_fim) msgs,
             (select count(*) from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
               where c.official_instance_id = o.id and m.direction = 'outbound' and m.deleted_at is null and coalesce(m.is_ai,false) and m.created_at >= t_ini and m.created_at < t_fim) msgs_ia,
             (select count(distinct m.conversation_id) from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
               where c.official_instance_id = o.id and m.direction = 'outbound' and m.deleted_at is null and m.created_at >= t_ini and m.created_at < t_fim) conversas
        from whatsapp_official_instances o)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(msgs * preco),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object('custo', round(b.msgs * b.preco,2)) order by b.msgs desc), '[]') from base b)) into out;

  when 'wa_templates' then
    with base as (
      select c.id, c.template_name template, c.template_category categoria, c.total, c.status, c.created_at data, c.finished_at fim,
             c.created_by_name criado_por, o.display_name numero, c.source origem, left(c.body_preview, 140) previa
        from whatsapp_official_campaigns c left join whatsapp_official_instances o on o.id = c.official_instance_id
       where c.created_at >= t_ini and c.created_at < t_fim)
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(total),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc), '[]') from (select * from base limit 500) b)) into out;

  when 'automacoes' then
    with base as (
      select a.id, a.name nome, 'CRM' tipo, a.trigger_type gatilho, a.is_active ativa, a.run_count runs_total, a.last_run_at ultima_execucao,
             (select count(*) from crm_automation_runs r where r.automation_id = a.id and r.created_at >= t_ini and r.created_at < t_fim) runs_mes
        from crm_automations a
      union all
      select r.id, r.name, 'Regra', r.trigger_type, r.is_active, null, (select max(e.executed_at) from automation_executions e where e.rule_id = r.id),
             (select count(*) from automation_executions e where e.rule_id = r.id and e.executed_at >= t_ini and e.executed_at < t_fim)
        from automation_rules r
      union all
      select g.id, g.name, 'Agente de IA', array_to_string(g.trigger_channels, ', '), g.is_active, null,
             (select max(x.created_at) from crm_ai_agent_runs x where x.agent_id = g.id),
             (select count(*) from crm_ai_agent_runs x where x.agent_id = g.id and x.created_at >= t_ini and x.created_at < t_fim)
        from crm_ai_agents g where g.tenant_id is null)
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.ativa desc, b.runs_mes desc), '[]') from base b)) into out;

  when 'automacao_runs' then
    with base as (
      select r.id, r.created_at data, a.name automacao, 'CRM' tipo, l.name lead, r.lead_id, s.name atribuido, left(r.result::text, 160) resultado
        from crm_automation_runs r left join crm_automations a on a.id = r.automation_id left join crm_leads l on l.id = r.lead_id
        left join onboarding_staff s on s.id = r.assigned_staff_id
       where r.created_at >= t_ini and r.created_at < t_fim
      union all
      select e.id, e.executed_at, ru.name, 'Regra', null, null, null, coalesce(e.error_message, e.status)
        from automation_executions e left join automation_rules ru on ru.id = e.rule_id
       where e.executed_at >= t_ini and e.executed_at < t_fim)
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc), '[]') from (select * from base order by data desc limit 500) b)) into out;

  when 'cobrancas' then
    with base as (
      select b.id, c.name empresa, c.id company_id, b.phone telefone, b.status, b.sent_at data, left(b.message_sent, 140) mensagem,
             i.amount_cents/100.0 valor, i.due_date vencimento, i.status fatura_status
        from billing_notification_logs b left join onboarding_companies c on c.id = b.company_id left join company_invoices i on i.id = b.invoice_id
       where b.sent_at >= t_ini and b.sent_at < t_fim)
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc), '[]') from (select * from base limit 500) b)) into out;

  when 'lembretes' then
    with base as (
      select r.id, r.created_at data, l.name lead, r.lead_id, r.phone telefone, r.instance_label instancia, r.status, left(r.message, 140) mensagem, r.error erro
        from crm_meeting_reminder_runs r left join crm_leads l on l.id = r.lead_id
       where r.created_at >= t_ini and r.created_at < t_fim)
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc), '[]') from (select * from base limit 500) b)) into out;

  when 'equipe' then
    with base as (
      select s.id, s.name nome, s.role papel, s.email, s.phone telefone, s.hire_date admissao, s.is_crm_closer closer,
             (select count(*) from onboarding_companies c where c.consultant_id = s.id and c.status = 'active') empresas,
             (select count(*) from onboarding_tasks t where t.responsible_staff_id = s.id and t.status::text in ('pending','in_progress') and t.due_date < hoje) tarefas_atrasadas,
             (select count(*) from crm_leads l where l.owner_staff_id = s.id and l.created_at >= t_ini and l.created_at < t_fim) leads_mes
        from onboarding_staff s where s.is_active and s.tenant_id is null)
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.papel, b.nome), '[]') from base b)) into out;

  else
    raise exception 'Bloco desconhecido: %', p_bloco;
  end case;

  return out || jsonb_build_object('bloco', p_bloco, 'mes', to_char(v_ini, 'YYYY-MM-DD'), 'limite', 500);
end $$;

revoke all on function public.painel_controle_interno(date) from public, anon, authenticated;
grant execute on function public.painel_controle_interno(date) to service_role;
revoke all on function public.painel_controle_detalhe(date, text, jsonb) from public;
grant execute on function public.painel_controle_detalhe(date, text, jsonb) to authenticated;
