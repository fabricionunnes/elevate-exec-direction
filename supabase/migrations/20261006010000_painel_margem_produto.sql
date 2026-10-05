-- Painel de Controle: margem por produto, do jeito honesto (06/10/2026).
-- Carregado sob demanda (painel_bloco 'produtos').
--
-- Por produto (product_name do projeto): clientes ativos, consultores, MRR que
-- fatura, receita recebida no mês, ticket médio e churn do produto.
--
-- Fatura e cobrança não têm campo de produto. A atribuição é feita assim, nessa
-- ordem, e o que sobra fica na linha "Não identificado" (não é espalhado):
--   1. descrição começa com o nome de um produto ou de um centro de custo
--      ("UNV Ads - ...", "UNV Social - ...", "CRM - ...", "Mansão Empreendedora");
--   2. descrição fala de "UNV Sales" sem ser o Sales Acceleration: é o SaaS;
--   3. a empresa só tem um produto entre os projetos ativos (ou, sem ativo, entre
--      todos): vai pra ele.
--
-- Custo: a conta a pagar tem categoria (staff_financial_categories), mas a
-- categoria diz a NATUREZA do gasto (salário, software, evento), não o produto.
-- O que liga gasto a produto é o centro de custo, e alguns centros têm o nome do
-- produto (UNV Ads, UNV Social, Mansão Empreendedora). Esse custo direto, lançado
-- no centro do próprio produto, aparece do lado dele. O custo compartilhado
-- (centros Produto, Administrativo, Comercial, Marketing, Evento) NÃO é rateado:
-- aparece numa tabela à parte. Produto sem centro com lançamento fica "-". As
-- contas sem categoria e sem centro de custo são contadas, pra alguém classificar.

create or replace function public.painel_produto_de(p_desc text, p_company uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- 1. prefixo com nome de produto ou de centro de custo (o mais comprido ganha)
    (select n.nome from (
        select distinct product_name nome from onboarding_projects where tenant_id is null and product_name is not null
        union select name from staff_financial_cost_centers where tenant_id is null
      ) n
      where lower(trim(coalesce(p_desc, ''))) like lower(n.nome) || '%' and n.nome not in ('Produto','Administrativo','Comercial','Marketing','Evento')
      order by length(n.nome) desc limit 1),
    -- 2. UNV Sales, o SaaS
    case when p_desc ~* 'unv sales' and p_desc !~* 'acceleration|force' then 'UNV Sales (SaaS)' end,
    -- 3. produto único da empresa: primeiro entre os projetos ativos, depois entre todos
    (select min(p.product_name) from onboarding_projects p
      where p.onboarding_company_id = p_company and p.status in ('active','notice_period','cancellation_signaled') and p.product_name is not null
     having count(distinct p.product_name) = 1),
    (select min(p.product_name) from onboarding_projects p
      where p.onboarding_company_id = p_company and p.product_name is not null
     having count(distinct p.product_name) = 1),
    'Não identificado');
$$;

create or replace function public.painel_produtos_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date;
  v_fim date; t_ini timestamptz; t_fim timestamptz;
  prods jsonb; custos jsonb;
begin
  v_fim := (v_ini + interval '1 month')::date;
  t_ini := v_ini::timestamp at time zone v_tz; t_fim := v_fim::timestamp at time zone v_tz;

  with proj as (
    select p.product_name produto, p.onboarding_company_id cid, p.status, c.status emp, coalesce(p.consultant_id, c.consultant_id) cons, p.churn_date
      from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
     where p.tenant_id is null and p.product_name is not null and coalesce(c.is_simulator, false) = false
  ),
  pa as (
    select produto, count(*) projetos, count(distinct cid) clientes, count(distinct cons) consultores
      from proj where status in ('active','notice_period','cancellation_signaled') and emp = 'active' group by 1
  ),
  ch as (select produto, count(*) n from proj where status in ('closed','completed') and churn_date >= t_ini and churn_date < t_fim group by 1),
  mrr as (
    select painel_produto_de(r.description, r.company_id) produto, sum(r.amount_cents) / 100.0 v, count(distinct r.company_id) cli
      from company_recurring_charges r join onboarding_companies c on c.id = r.company_id
     where r.is_active and r.recurrence = 'monthly' and c.status = 'active'
       and exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= hoje)
     group by 1
  ),
  rec as (
    select painel_produto_de(i.description, i.company_id) produto, sum(coalesce(i.paid_amount_cents, i.amount_cents)) / 100.0 v, count(*) n, count(distinct i.company_id) cli
      from company_invoices i where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim group by 1
  ),
  cst as (
    select cc.name produto, sum(coalesce(y.paid_amount, y.amount)) v, count(*) n
      from financial_payables y join staff_financial_cost_centers cc on cc.id = y.cost_center_id
     where y.status = 'paid' and y.tenant_id is null and y.paid_date >= v_ini and y.paid_date < v_fim
       and cc.name not in ('Produto','Administrativo','Comercial','Marketing','Evento')
     group by 1
  ),
  nomes as (select produto from pa union select produto from ch union select produto from mrr union select produto from rec union select produto from cst)
  select coalesce(jsonb_agg(jsonb_build_object(
      'produto', n.produto, 'clientes', pa.clientes, 'projetos', pa.projetos, 'consultores', pa.consultores,
      'mrr', mrr.v, 'mrr_clientes', mrr.cli, 'ticket', case when mrr.cli > 0 then round(mrr.v / mrr.cli, 2) end,
      'receita', rec.v, 'receita_n', rec.n, 'receita_clientes', rec.cli,
      'churn_n', ch.n, 'churn_pct', case when coalesce(pa.projetos, 0) + coalesce(ch.n, 0) > 0 and ch.n is not null then round(ch.n::numeric / (coalesce(pa.projetos, 0) + ch.n), 4) end,
      'custo_direto', cst.v, 'custo_n', cst.n,
      'margem_direta', case when cst.v is not null then coalesce(rec.v, 0) - cst.v end
    ) order by coalesce(rec.v, 0) desc, coalesce(mrr.v, 0) desc, n.produto), '[]') into prods
    from nomes n left join pa on pa.produto = n.produto left join ch on ch.produto = n.produto
    left join mrr on mrr.produto = n.produto left join rec on rec.produto = n.produto left join cst on cst.produto = n.produto;

  with pg as (
    select y.id, coalesce(y.paid_amount, y.amount) v, y.category_id, cc.name centro, fc.name categoria
      from financial_payables y left join staff_financial_cost_centers cc on cc.id = y.cost_center_id
      left join staff_financial_categories fc on fc.id = y.category_id
     where y.status = 'paid' and y.tenant_id is null and y.paid_date >= v_ini and y.paid_date < v_fim
  )
  select jsonb_build_object(
    'pago_total', (select coalesce(sum(v), 0) from pg), 'pago_n', (select count(*) from pg),
    'sem_categoria_n', (select count(*) from pg where category_id is null),
    'sem_categoria_valor', (select coalesce(sum(v), 0) from pg where category_id is null),
    'sem_centro_n', (select count(*) from pg where centro is null),
    'sem_centro_valor', (select coalesce(sum(v), 0) from pg where centro is null),
    'compartilhado_valor', (select coalesce(sum(v), 0) from pg where centro in ('Produto','Administrativo','Comercial','Marketing','Evento')),
    'direto_valor', (select coalesce(sum(v), 0) from pg where centro is not null and centro not in ('Produto','Administrativo','Comercial','Marketing','Evento')),
    'por_centro', (select coalesce(jsonb_agg(jsonb_build_object('centro', coalesce(centro, 'Sem centro de custo'), 'n', n, 'valor', v,
                     'tipo', case when centro is null then 'sem_centro' when centro in ('Produto','Administrativo','Comercial','Marketing','Evento') then 'compartilhado' else 'direto' end) order by v desc), '[]')
                     from (select centro, count(*) n, sum(v) v from pg group by centro) x),
    'por_categoria', (select coalesce(jsonb_agg(jsonb_build_object('categoria', coalesce(categoria, 'Sem categoria'), 'n', n, 'valor', v) order by v desc), '[]')
                        from (select categoria, count(*) n, sum(v) v from pg group by categoria) x),
    'aberto_sem_categoria_n', (select count(*) from financial_payables y where y.tenant_id is null and y.status in ('pending','partial') and y.category_id is null and y.due_date <= hoje + 90),
    'aberto_sem_categoria_valor', (select coalesce(sum(y.amount - coalesce(y.paid_amount, 0)), 0) from financial_payables y where y.tenant_id is null and y.status in ('pending','partial') and y.category_id is null and y.due_date <= hoje + 90)
  ) into custos;

  return jsonb_build_object('mes', to_char(v_ini, 'YYYY-MM-DD'), 'produtos', prods, 'custos', custos,
    'totais', jsonb_build_object(
      'receita', (select coalesce(sum((e->>'receita')::numeric), 0) from jsonb_array_elements(prods) e),
      'mrr', (select coalesce(sum((e->>'mrr')::numeric), 0) from jsonb_array_elements(prods) e),
      'nao_identificado_receita', (select (e->>'receita')::numeric from jsonb_array_elements(prods) e where e->>'produto' = 'Não identificado'),
      'nao_identificado_mrr', (select (e->>'mrr')::numeric from jsonb_array_elements(prods) e where e->>'produto' = 'Não identificado')));
end $$;

create or replace function public.painel_bloco(p_month date, p_nome text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_master() then raise exception 'Só o master'; end if;
  case p_nome
    when 'receita' then return painel_receita_interno(p_month);
    when 'produtos' then return painel_produtos_interno(p_month);
    else raise exception 'Bloco desconhecido: %', p_nome;
  end case;
end $$;

-- Listas de detalhe dos blocos "pra frente" (acrescenta):
--   produto_clientes  {produto, grupo: ativos|churn|todos}
--   produto_receita   {produto}
--   contas_centro     {centro, grupo: sem_categoria}
create or replace function public.painel_frente_detalhe(p_month date, p_bloco text, p_filtro jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      select r.id, r.company_id, r.amount_cents / 100.0 valor, r.description, r.installments,
             (select max(i.due_date) from company_invoices i where i.recurring_charge_id = r.id) ult,
             exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= hoje) fut
        from company_recurring_charges r where r.is_active and r.recurrence = 'monthly'
    ),
    cli as (
      select c.id company_id, c.name empresa, c.status empresa_status, st.name consultor, c.contract_end_date contrato_fim, c.renewal_plan_type plano,
             sum(k.valor) valor, count(*) cobrancas, max(k.ult) parcelas_ate, string_agg(k.description, ' + ') descricao,
             case when c.status <> 'active' then 'empresa inativa' when not bool_or(k.fut) then 'sem fatura a vencer (cobrança avulsa ou plano encerrado)' end motivo_fora,
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
             (select coalesce(sum(r.amount_cents), 0) / 100.0 from company_recurring_charges r
               where r.company_id = c.id and r.is_active and r.recurrence = 'monthly' and painel_produto_de(r.description, r.company_id) = p.product_name
                 and exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= hoje)) mensalidade
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
end $$;

revoke all on function public.painel_produto_de(text, uuid) from public, anon, authenticated;
grant execute on function public.painel_produto_de(text, uuid) to service_role;
revoke all on function public.painel_produtos_interno(date) from public, anon, authenticated;
grant execute on function public.painel_produtos_interno(date) to service_role;
revoke all on function public.painel_bloco(date, text) from public, anon;
grant execute on function public.painel_bloco(date, text) to authenticated;
revoke all on function public.painel_frente_detalhe(date, text, jsonb) from public, anon;
grant execute on function public.painel_frente_detalhe(date, text, jsonb) to authenticated;
