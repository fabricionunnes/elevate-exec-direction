-- painel_controle_detalhe: contas a pagar e faturas a receber aceitam de/ate no vencimento (pop-up 'a pagar hoje') (07/10/2026)
CREATE OR REPLACE FUNCTION public.painel_controle_detalhe(p_month date, p_bloco text, p_filtro jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  f_de date := nullif(p_filtro->>'de','')::date;      -- recorte livre (Gestão à vista: hoje / semana)
  f_ate date := nullif(p_filtro->>'ate','')::date;    -- inclusivo
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
  c_ini := coalesce(f_de::timestamp at time zone v_tz, f_dia::timestamp at time zone v_tz, t_ini);
  c_fim := coalesce((f_ate + 1)::timestamp at time zone v_tz, (f_dia + 1)::timestamp at time zone v_tz, t_fim);

  case p_bloco

  when 'faturas_pagas' then
    with base as (
      select i.id, c.name empresa, c.id company_id, coalesce(i.paid_amount_cents, i.amount_cents)/100.0 valor, i.amount_cents/100.0 valor_fatura,
             (i.paid_at at time zone v_tz)::date data, i.payment_method forma, b.name banco, i.description descricao,
             i.installment_number parcela, i.total_installments parcelas, i.due_date vencimento
        from company_invoices i join onboarding_companies c on c.id = i.company_id left join financial_banks b on b.id = i.bank_id
       where i.status = 'paid' and i.paid_at >= c_ini and i.paid_at < c_fim and (f_company is null or i.company_id = f_company))
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
       where i.paid_at is null and i.status in ('pending','overdue') and i.due_date >= coalesce(f_de, v_ini) and i.due_date < coalesce(f_ate + 1, v_fim) and (f_company is null or i.company_id = f_company))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.vencimento), '[]') from (select * from base limit 500) b)) into out;

  when 'contas_pagas' then
    with base as (
      select p.id, p.supplier_name fornecedor, p.description descricao, coalesce(fc.name,'Sem categoria') categoria, coalesce(p.paid_amount, p.amount) valor,
             p.due_date vencimento, p.paid_date pago_em, p.payment_method forma, b.name banco, p.cost_type tipo_custo
        from financial_payables p left join staff_financial_categories fc on fc.id = p.category_id left join financial_banks b on b.id = p.bank_id
       where p.status = 'paid' and p.tenant_id is null and p.paid_date >= coalesce(f_de, f_dia, v_ini) and p.paid_date < coalesce(f_ate + 1, f_dia + 1, v_fim)
         and (f_categoria is null or coalesce(fc.name,'Sem categoria') = f_categoria))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.pago_em desc, b.valor desc), '[]') from (select * from base limit 500) b)) into out;

  when 'contas_a_pagar' then
    with base as (
      select p.id, p.supplier_name fornecedor, p.description descricao, coalesce(fc.name,'Sem categoria') categoria, p.amount - coalesce(p.paid_amount,0) valor,
             p.due_date vencimento, p.due_date - hoje dias, p.status, p.payment_method forma, p.is_recurring recorrente
        from financial_payables p left join staff_financial_categories fc on fc.id = p.category_id
       where p.status in ('pending','partial') and p.tenant_id is null
         and p.due_date >= coalesce(f_de, least(v_ini, hoje - 60)) and p.due_date < coalesce(f_ate + 1, greatest(v_fim, hoje + 8)))
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
    -- MRR oficial: cobrança mensal ativa, de empresa ativa, com fatura a vencer.
    -- grupo 'fora' lista as cobranças ativas no cadastro que não faturam mais.
    with base as (
      select m.charge_id id, m.empresa, m.company_id, m.valor, m.descricao, m.tipo, m.parcelas, m.primeira_parcela, m.ultima_parcela, m.a_vencer,
             m.proxima_cobranca, m.forma, st.name consultor, c.contract_start_date inicio, c.renewal_plan_type plano, m.em_aviso, m.motivo_fora, m.empresa_status,
             (select string_agg(p.status, ', ') from onboarding_projects p where p.onboarding_company_id = c.id and p.status in ('active','notice_period','cancellation_signaled')) projeto_status
        from painel_mrr_cobrancas() m join onboarding_companies c on c.id = m.company_id left join onboarding_staff st on st.id = m.consultant_id
       where (f_consult is null or m.consultant_id = f_consult)
         and case when p_filtro->>'grupo' = 'fora' then not m.no_mrr else m.no_mrr end
         and (nullif(p_filtro->>'tipo_cobranca', '') is null or m.tipo = p_filtro->>'tipo_cobranca')
         and (p_filtro->>'em_aviso' is null or m.em_aviso)
         and (nullif(p_filtro->>'acaba_em_dias', '') is null or m.ultima_parcela <= hoje + (p_filtro->>'acaba_em_dias')::int))
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor),0) from base),
      'clientes', (select count(distinct company_id) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc, b.empresa), '[]') from base b)) into out;

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
       where st.final_type = 'won' and l.closed_at >= c_ini and l.closed_at < c_fim and l.tenant_id is null
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
       where e.event_date >= c_ini and e.event_date < c_fim
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
       where l.created_at >= c_ini and l.created_at < c_fim and l.tenant_id is null
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
             (select coalesce(sum(m.valor), 0) from painel_mrr_cobrancas() m where m.company_id = c.id and m.no_mrr) mensalidade,
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
       where c.last_message_at >= c_ini and c.last_message_at < c_fim and c.merged_into is null)
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
       where r.created_at >= c_ini and r.created_at < c_fim and (f_agent is null or r.agent_id = f_agent)
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
end $function$
;
