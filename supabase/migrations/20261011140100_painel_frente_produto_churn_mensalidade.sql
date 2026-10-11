-- Clientes por produto, grupo churn: mensalidade perdida (sem o filtro no_mrr, que zera pra projeto encerrado).
CREATE OR REPLACE FUNCTION public.painel_frente_detalhe(p_month date, p_bloco text, p_filtro jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  f_de date := nullif(p_filtro->>'de', '')::date;
  f_ate date := nullif(p_filtro->>'ate', '')::date;
  f_tipo text := nullif(p_filtro->>'tipo', '');
  f_classe text := nullif(p_filtro->>'classe', '');
  f_grupo text := nullif(p_filtro->>'grupo', '');
  f_staff uuid := nullif(p_filtro->>'staff_id', '')::uuid;
  f_stage uuid := nullif(p_filtro->>'stage_id', '')::uuid;
  f_produto text := nullif(p_filtro->>'produto', '');
  f_centro text := nullif(p_filtro->>'centro', '');
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date;
  t_ini timestamptz; t_fim timestamptz;
  saida jsonb;
begin
  if not is_master() then raise exception 'Só o master'; end if;
  t_ini := v_ini::timestamp at time zone 'America/Sao_Paulo';
  t_fim := (v_ini + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';

  case p_bloco

  when 'caixa_movimentos' then
    with base as (
      select i.tipo, i.origem, i.ref_id, i.company_id, i.nome, i.descricao, i.vencimento, i.valor, i.classe, i.dias_atraso,
             i.data_c, i.valor_c, i.data_r, i.valor_r, i.motivo_r
        from painel_caixa_itens() i
       where (f_tipo is null or i.tipo = f_tipo) and (f_classe is null or i.classe = f_classe)
         and (f_de is null or (i.data_c between f_de and coalesce(f_ate, f_de)) or (i.data_r between f_de and coalesce(f_ate, f_de)))
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      -- com janela, cada soma só conta o que cai na janela naquele cenário (bate com a linha da semana)
      'entra_c', (select coalesce(sum(valor_c), 0) from base where tipo = 'entrada' and (f_de is null or data_c between f_de and coalesce(f_ate, f_de))),
      'entra_r', (select coalesce(sum(valor_r), 0) from base where tipo = 'entrada' and (f_de is null or data_r between f_de and coalesce(f_ate, f_de))),
      'sai', (select coalesce(sum(valor_c), 0) from base where tipo = 'saida' and (f_de is null or data_c between f_de and coalesce(f_ate, f_de))),
      -- o que está na lista mas não entra em nenhum cenário (vencido há mais de 30 dias)
      'fora_valor', (select coalesce(sum(valor), 0) from base where valor_c is null and valor_r is null),
      'fora_n', (select count(*) from base where valor_c is null and valor_r is null),
      'soma', (select coalesce(sum(valor), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.tipo, coalesce(b.data_c, b.data_r, b.vencimento), b.valor desc), '[]')
                   from (select * from base order by tipo, coalesce(data_c, data_r, vencimento), valor desc limit 500) b)) into saida;

  when 'vendas_grupo' then
    -- vendas do mês por quem fechou: fundador, time ou sem fechador (venda do site)
    with fab as (select s.id from onboarding_staff s where s.role = 'master' and s.tenant_id is null and s.is_active order by s.created_at limit 1),
    base as (
      select l.id lead_id, l.name nome, l.company empresa, l.opportunity_value valor, (l.closed_at at time zone 'America/Sao_Paulo')::date data,
             cs.name closer, sd.name sdr, p.name funil, coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) origem,
             case when coalesce(l.closer_staff_id, l.owner_staff_id) is null then 'sem_fechador'
                  when coalesce(l.closer_staff_id, l.owner_staff_id) = (select id from fab) then 'fundador' else 'time' end grupo,
             (select string_agg(s.product_name, ', ') from crm_sales s where s.lead_id = l.id) produto
        from crm_leads l join crm_stages st on st.id = l.stage_id
        left join onboarding_staff cs on cs.id = coalesce(l.closer_staff_id, l.owner_staff_id) left join onboarding_staff sd on sd.id = l.sdr_staff_id
        left join crm_pipelines p on p.id = l.pipeline_id
       where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= t_ini and l.closed_at < t_fim
    )
    select jsonb_build_object('total', (select count(*) from base where f_grupo is null or grupo = f_grupo),
      'soma', (select coalesce(sum(valor), 0) from base where f_grupo is null or grupo = f_grupo),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc, b.valor desc), '[]')
                   from (select * from base where f_grupo is null or grupo = f_grupo order by data desc limit 500) b)) into saida;

  when 'mrr_clientes' then
    -- mensalidade por cliente. base = cobrança ativa, de empresa ativa, com fatura a vencer.
    -- fora = cobrança marcada como ativa que não está mais faturando.
    with cob as (
      -- a mesma regra do MRR oficial (fut = está no MRR)
      select m.charge_id id, m.company_id, m.valor, m.descricao description, m.parcelas installments, m.ultima_parcela ult, m.no_mrr fut, m.motivo_fora mf
        from painel_mrr_cobrancas() m
    ),
    cli as (
      select c.id company_id, c.name empresa, c.status empresa_status, st.name consultor, c.contract_end_date contrato_fim, c.renewal_plan_type plano,
             sum(k.valor) valor, count(*) cobrancas, max(k.ult) parcelas_ate, string_agg(k.description, ' + ') descricao,
             string_agg(distinct k.mf, '; ') motivo_fora,
             (c.status = 'active') na_base_emp
        from cob k join onboarding_companies c on c.id = k.company_id left join onboarding_staff st on st.id = c.consultant_id
       where (coalesce(f_grupo, 'base') = 'base' and c.status = 'active' and k.fut) or (f_grupo = 'fora' and not (c.status = 'active' and k.fut))
       group by c.id, c.name, c.status, st.name, c.contract_end_date, c.renewal_plan_type
    ),
    tot as (select coalesce(sum(valor), 0) t from cli)
    select jsonb_build_object('total', (select count(*) from cli), 'soma', (select t from tot),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]')
                   from (select c.*, case when (select t from tot) > 0 then round(c.valor / (select t from tot), 4) end pct from cli c order by c.valor desc limit 500) b)) into saida;

  when 'reunioes_futuras' then
    -- reuniões na agenda (atividade tipo reunião, não cancelada) numa janela de datas
    with base as (
      select a.id, a.lead_id, l.name nome, l.company empresa, (a.scheduled_at at time zone 'America/Sao_Paulo')::date dia,
             to_char(a.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI') hora, a.scheduled_at quando, s.name closer, a.status, a.title titulo,
             p.name funil, st.name etapa, l.opportunity_value valor, sd.name sdr, a.responsible_staff_id
        from crm_activities a left join crm_leads l on l.id = a.lead_id left join onboarding_staff s on s.id = a.responsible_staff_id
        left join crm_pipelines p on p.id = l.pipeline_id left join crm_stages st on st.id = l.stage_id left join onboarding_staff sd on sd.id = l.sdr_staff_id
       where a.type = 'meeting' and a.status <> 'cancelled'
         and (a.scheduled_at at time zone 'America/Sao_Paulo')::date between coalesce(f_de, hoje) and coalesce(f_ate, hoje + 13)
         and (f_staff is null or a.responsible_staff_id = f_staff)
    )
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.quando), '[]') from (select * from base order by quando limit 500) b)) into saida;

  when 'pipeline_aberto' then
    -- leads abertos com valor. grupo vivo = movimento nos últimos 90 dias; parado = o resto
    with base as (
      select l.id lead_id, l.name nome, l.company empresa, l.opportunity_value valor, p.name funil, st.name etapa, st.id stage_id, ow.name dono,
             (greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)))::date ultimo_movimento, hoje - (greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)))::date dias_parado, (l.created_at at time zone 'America/Sao_Paulo')::date criado_em,
             coalesce(l.origin, l.utm_source) origem
        from crm_leads l join crm_stages st on st.id = l.stage_id left join crm_pipelines p on p.id = l.pipeline_id left join onboarding_staff ow on ow.id = l.owner_staff_id
       where l.tenant_id is null and not st.is_final and l.opportunity_value > 0
         and (f_stage is null or l.stage_id = f_stage)
         and ((coalesce(f_grupo, 'vivo') = 'vivo' and greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)) >= now() - interval '90 days') or (f_grupo = 'parado' and greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)) < now() - interval '90 days'))
    )
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]') from (select * from base order by valor desc limit 500) b)) into saida;

  when 'leads_atencao' then
    -- leads recentes dos funis que contam: novos7 (últimos 7 dias), sem_dono, sem_atividade (últimos 14 dias, ainda abertos)
    with base as (
      select l.id lead_id, l.name nome, l.company empresa, p.name funil, st.name etapa, ow.name dono, (l.created_at at time zone 'America/Sao_Paulo')::date criado_em,
             hoje - (l.created_at at time zone 'America/Sao_Paulo')::date dias, coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) origem, l.phone telefone,
             (l.owner_staff_id is null) sem_dono,
             (not exists (select 1 from crm_activities a where a.lead_id = l.id)
              and not exists (select 1 from crm_lead_history h where h.lead_id = l.id and h.action = 'stage_change' and h.staff_id is not null)
              and not exists (select 1 from crm_whatsapp_conversations c where c.lead_id = l.id and c.last_message_at is not null and (c.last_message_direction = 'outbound' or c.last_inbound_at is distinct from c.last_message_at))) sem_atividade,
             st.is_final
        from crm_leads l join crm_pipelines p on p.id = l.pipeline_id join crm_stages st on st.id = l.stage_id left join onboarding_staff ow on ow.id = l.owner_staff_id
       where l.tenant_id is null and p.counts_lead_inflow and l.created_at >= (hoje - 13)::timestamp at time zone 'America/Sao_Paulo'
    ),
    f as (
      select * from base where case coalesce(f_tipo, 'novos7')
        when 'novos7' then criado_em >= hoje - 6
        when 'sem_dono' then sem_dono and not is_final
        when 'sem_atividade' then sem_atividade and not is_final
        else true end
    )
    select jsonb_build_object('total', (select count(*) from f),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.criado_em desc), '[]') from (select * from f order by criado_em desc limit 500) b)) into saida;

  when 'mrr_movimentos' then
    -- o que mudou no faturado recorrente de cada cliente no mês, contra o mês anterior
    with base as (
      select m.company_id, c.name empresa, c.status empresa_status, st.name consultor, m.antes, m.depois, m.depois - m.antes delta, m.tipo
        from painel_mrr_movimentos(v_ini, v_ini) m join onboarding_companies c on c.id = m.company_id left join onboarding_staff st on st.id = c.consultant_id
       where (f_tipo is null and m.tipo <> 'mantido') or m.tipo = f_tipo
    )
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(delta), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by abs(b.delta) desc, b.empresa), '[]') from (select * from base order by abs(delta) desc limit 500) b)) into saida;

  when 'renovacoes' then
    -- contratos com fim nos próximos N dias (padrão 90). grupo: risco (com prazo) ou mensal (renova sozinho)
    with base as (
      select r.* from painel_renovacoes(coalesce(nullif(p_filtro->>'dias', '')::int, 90)) r
       where f_grupo is null or r.grupo = f_grupo
    )
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor), 0) from base where grupo = 'risco'),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.fim, b.empresa), '[]') from base b)) into saida;

  when 'produto_clientes' then
    -- projetos de um produto (ou de todos): cliente, situação, consultor e mensalidade que fatura
    with base as (
      select p.id project_id, c.id company_id, c.name empresa, p.product_name produto, p.status projeto_status, c.status empresa_status,
             coalesce(sp.name, sc.name) consultor, p.contract_start_date inicio, p.contract_end_date fim, (p.churn_date at time zone 'America/Sao_Paulo')::date churn_em, p.churn_reason churn_motivo,
             (select coalesce(sum(m.valor), 0) from painel_mrr_cobrancas() m
               where m.company_id = c.id and m.no_mrr and painel_produto_de(m.descricao, m.company_id) = p.product_name) mensalidade
             , coalesce(nullif((select coalesce(sum(m.valor), 0) from painel_mrr_cobrancas() m
               where m.company_id = c.id and painel_produto_de(m.descricao, m.company_id) = p.product_name), 0),
               (select coalesce(i.total_with_fees_cents, i.amount_cents)/100.0 from company_invoices i where i.company_id = c.id and i.paid_at is not null and i.recurring_charge_id is not null order by i.paid_at desc limit 1), 0) mensalidade_perdida
        from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
        left join onboarding_staff sp on sp.id = p.consultant_id left join onboarding_staff sc on sc.id = c.consultant_id
       where p.tenant_id is null and coalesce(c.is_simulator, false) = false
         and (f_produto is null or p.product_name = f_produto)
         and case coalesce(f_grupo, 'ativos')
               when 'ativos' then p.status in ('active','notice_period','cancellation_signaled') and c.status = 'active'
               when 'churn' then p.status in ('closed','completed') and p.churn_date >= t_ini and p.churn_date < t_fim
               else true end
    )
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(mensalidade), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.produto, b.empresa), '[]') from (select * from base limit 500) b)) into saida;

  when 'produto_receita' then
    -- faturas pagas no mês, com o produto a que cada uma foi atribuída
    with base as (
      select i.id, c.id company_id, coalesce(c.name, i.custom_receiver_name, '(sem empresa)') empresa, painel_produto_de(i.description, i.company_id) produto, i.description descricao,
             coalesce(i.paid_amount_cents, i.amount_cents) / 100.0 valor, (i.paid_at at time zone 'America/Sao_Paulo')::date pago_em, i.due_date vencimento,
             (i.recurring_charge_id is not null) recorrente
        from company_invoices i left join onboarding_companies c on c.id = i.company_id
       where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim
    )
    select jsonb_build_object('total', (select count(*) from base where f_produto is null or produto = f_produto),
      'soma', (select coalesce(sum(valor), 0) from base where f_produto is null or produto = f_produto),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]')
                   from (select * from base where f_produto is null or produto = f_produto order by valor desc limit 500) b)) into saida;

  when 'contas_centro' then
    -- contas pagas no mês por centro de custo. grupo sem_categoria lista as que estão sem categoria
    with base as (
      select y.id, y.supplier_name fornecedor, y.description descricao, coalesce(cc.name, 'Sem centro de custo') centro, coalesce(fc.name, 'Sem categoria') categoria,
             coalesce(y.paid_amount, y.amount) valor, y.paid_date pago_em, y.due_date vencimento, y.cost_type tipo_custo
        from financial_payables y left join staff_financial_cost_centers cc on cc.id = y.cost_center_id left join staff_financial_categories fc on fc.id = y.category_id
       where y.status = 'paid' and y.tenant_id is null and y.paid_date >= v_ini and y.paid_date < (v_ini + interval '1 month')::date
         and (f_centro is null or coalesce(cc.name, 'Sem centro de custo') = f_centro)
         and (f_grupo is distinct from 'sem_categoria' or y.category_id is null)
    )
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]') from (select * from base order by valor desc limit 500) b)) into saida;

  else
    raise exception 'Bloco desconhecido: %', p_bloco;
  end case;

  return saida || jsonb_build_object('bloco', p_bloco, 'mes', to_char(v_ini, 'YYYY-MM-DD'), 'limite', 500);
end $function$
;
