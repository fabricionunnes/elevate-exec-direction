-- Painel de Controle: saúde da receita recorrente (05/10/2026).
-- Carregado sob demanda (painel_bloco), pra não pesar a RPC principal.
--
-- MRR, dois números lado a lado:
-- - "cadastrado": cobranças recorrentes mensais marcadas como ativas (o do topo do
--   painel e do Dashboard financeiro).
-- - "que fatura": só cobrança ativa, de empresa ativa, com fatura a vencer.
--   A diferença são cobranças que seguem ativas no cadastro e não faturam mais.
--
-- Ponte do MRR: company_recurring_charges não guarda histórico de valor nem data
-- de cancelamento, então a ponte é reconstruída pelas FATURAS. Faturado recorrente
-- do cliente no mês = faturas não canceladas, com vencimento no mês, ligadas a uma
-- cobrança recorrente (ficam fora as avulsas: Entrada, Comissão, Cancelamento,
-- Renegociação, Devolução). Comparando com o mês anterior, por cliente:
--   novo (primeira vez), reativação (tinha parado e voltou), expansão (subiu),
--   contração (caiu), churn (zerou). Expansão e contração saem separadas.
-- Limite conhecido: as cobranças entraram no Nexus em maio e junho de 2026, então
-- o "novo" desses dois meses é a entrada do cadastro, não venda nova.
--
-- LTV: a MESMA regra do bloco "LTV & Retenção" da tela inicial (DashboardMetrics):
-- tempo médio = meses inteiros entre o início do contrato e hoje, das empresas não
-- inativas com início preenchido (0 a 180 meses); ticket médio mensal = valor do
-- contrato normalizado pelo ciclo lido de payment_method (monthly = valor,
-- quarterly / 3, semiannual / 6, annual/card/boleto/pix / 12; à vista e forma
-- desconhecida ficam fora); LTV = ticket x tempo.
--
-- Renovações: segue lib/contrato.ts. Plano mensal renova sozinho, não vence. Em
-- risco é contrato com prazo (empresa não mensal, ou projeto com termo
-- trimestral/semestral/anual) que termina na janela.

create or replace function public.painel_mrr_movimentos(p_ini date, p_fim date)
returns table (mes date, company_id uuid, antes numeric, depois numeric, tipo text)
language sql
stable
security definer
set search_path = public
as $$
  with fat as (
    select i.company_id, date_trunc('month', i.due_date)::date m, sum(i.amount_cents) / 100.0 v
      from company_invoices i join company_recurring_charges r on r.id = i.recurring_charge_id
     where i.status <> 'cancelled' and coalesce(r.description, '') !~* '^\s*(entrada|comiss|cancelamento|renegocia|devolu)'
     group by 1, 2
  ),
  prim as (select f.company_id, min(f.m) m0 from fat f group by 1),
  meses as (select generate_series(date_trunc('month', p_ini)::date, date_trunc('month', p_fim)::date, interval '1 month')::date m),
  par as (
    select p.company_id, p.m0, ms.m, coalesce(a.v, 0) depois, coalesce(b.v, 0) antes
      from prim p cross join meses ms
      left join fat a on a.company_id = p.company_id and a.m = ms.m
      left join fat b on b.company_id = p.company_id and b.m = (ms.m - interval '1 month')::date
  )
  select m, company_id, antes, depois,
         case when antes = 0 and depois > 0 and m = m0 then 'novo'
              when antes = 0 and depois > 0 then 'reativacao'
              when depois = 0 and antes > 0 then 'churn'
              when depois > antes then 'expansao'
              when depois < antes then 'contracao'
              else 'mantido' end
    from par where antes > 0 or depois > 0;
$$;

create or replace function public.painel_renovacoes(p_dias int default 90)
returns table (company_id uuid, empresa text, consultor text, grupo text, origem text, plano text, inicio date, fim date, dias int, valor numeric, mensalidade numeric, projeto_status text)
language sql
stable
security definer
set search_path = public
as $$
  with h as (select (now() at time zone 'America/Sao_Paulo')::date d),
  emp as (
    select c.id, c.name, c.consultant_id, c.contract_start_date ini, c.contract_end_date fim, c.contract_value, c.renewal_plan_type, c.payment_method,
           (lower(trim(coalesce(c.renewal_plan_type, ''))) in ('monthly','mensal') or lower(trim(coalesce(c.payment_method, ''))) in ('monthly','mensal')) recorrente,
           (select coalesce(sum(r.amount_cents), 0) / 100.0 from company_recurring_charges r
             where r.company_id = c.id and r.is_active and r.recurrence = 'monthly'
               and exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= (select d from h))) mensalidade,
           (select string_agg(distinct p.status, ', ') from onboarding_projects p where p.onboarding_company_id = c.id and p.status in ('active','notice_period','cancellation_signaled')) proj_status
      from onboarding_companies c
     where c.status = 'active' and coalesce(c.is_simulator, false) = false and c.tenant_id is null
  ),
  -- 1) empresa com prazo (não mensal) terminando na janela
  a as (
    select e.id, e.name, e.consultant_id, 'risco'::text grupo, 'contrato da empresa'::text origem, coalesce(e.renewal_plan_type, 'sem plano') plano, e.ini, e.fim, e.contract_value valor, e.mensalidade, e.proj_status
      from emp e, h where not e.recorrente and e.fim between h.d and h.d + p_dias
  ),
  -- 2) projeto com termo fechado terminando na janela, de empresa cadastrada como mensal
  b as (
    select e.id, e.name, e.consultant_id, 'risco'::text, 'termo do projeto (' || p.product_name || ')', p.contract_term, p.contract_start_date, p.contract_end_date, p.contract_value, e.mensalidade, e.proj_status
      from onboarding_projects p join emp e on e.id = p.onboarding_company_id, h
     where p.status in ('active','notice_period','cancellation_signaled') and nullif(trim(coalesce(p.contract_term, '')), '') is not null
       and lower(p.contract_term) not in ('mensal','monthly') and p.contract_end_date between h.d and h.d + p_dias
       and not exists (select 1 from a where a.id = e.id)
  ),
  -- 3) mensal com aniversário de contrato na janela: renova sozinho, é só pra saber
  c as (
    select e.id, e.name, e.consultant_id, 'mensal'::text, 'mensal, renova sozinho'::text, 'monthly'::text, e.ini, e.fim, e.mensalidade, e.mensalidade, e.proj_status
      from emp e, h where e.recorrente and e.fim between h.d and h.d + p_dias
       and not exists (select 1 from a where a.id = e.id) and not exists (select 1 from b where b.id = e.id)
  ),
  u as (select * from a union all select * from b union all select * from c)
  select u.id, u.name, st.name, u.grupo, u.origem, u.plano, u.ini, u.fim, (u.fim - (select d from h))::int, u.valor, u.mensalidade, u.proj_status
    from u left join onboarding_staff st on st.id = u.consultant_id;
$$;

create or replace function public.painel_receita_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  mes_atual date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  s_ini date; mrr jsonb; ponte jsonb; ltv jsonb; ren jsonb;
begin
  s_ini := (mes_atual - interval '11 months')::date;

  ------------------------------------------------------------------ MRR: os dois números
  with cob as (
    select r.company_id, r.amount_cents / 100.0 valor, c.status emp,
           exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= hoje) fut
      from company_recurring_charges r join onboarding_companies c on c.id = r.company_id
     where r.is_active and r.recurrence = 'monthly'
  )
  select jsonb_build_object(
    'cadastrado', (select coalesce(sum(valor), 0) from cob), 'cadastrado_n', (select count(*) from cob),
    'que_fatura', (select coalesce(sum(valor), 0) from cob where emp = 'active' and fut),
    'que_fatura_n', (select count(*) from cob where emp = 'active' and fut),
    'clientes', (select count(distinct company_id) from cob where emp = 'active' and fut),
    'fora_valor', (select coalesce(sum(valor), 0) from cob where not (emp = 'active' and fut)),
    'fora_n', (select count(*) from cob where not (emp = 'active' and fut)),
    'fora_empresa_inativa', (select coalesce(sum(valor), 0) from cob where emp <> 'active'),
    'fora_sem_fatura', (select coalesce(sum(valor), 0) from cob where emp = 'active' and not fut),
    'em_aviso', (select coalesce(sum(k.valor), 0) from cob k where k.emp = 'active' and k.fut
                   and exists (select 1 from onboarding_projects p where p.onboarding_company_id = k.company_id and p.status in ('notice_period','cancellation_signaled')))
  ) into mrr;

  ------------------------------------------------------------------ ponte mês a mês
  with mv as (select * from painel_mrr_movimentos(s_ini, mes_atual)),
  prim as (select min(mes) m from mv where depois > 0),
  ag as (
    select mes,
           sum(antes) inicial, sum(depois) final,
           coalesce(sum(depois) filter (where tipo = 'novo'), 0) novo,
           coalesce(sum(depois) filter (where tipo = 'reativacao'), 0) reativacao,
           coalesce(sum(depois - antes) filter (where tipo = 'expansao'), 0) expansao,
           coalesce(sum(antes - depois) filter (where tipo = 'contracao'), 0) contracao,
           coalesce(sum(antes) filter (where tipo = 'churn'), 0) churn,
           count(*) filter (where antes > 0) cli_ini, count(*) filter (where depois > 0) cli_fim,
           count(*) filter (where tipo = 'churn') cli_churn, count(*) filter (where tipo in ('novo','reativacao')) cli_novos
      from mv group by mes
  ),
  meses as (select generate_series(s_ini, mes_atual, interval '1 month')::date m)
  select jsonb_agg(jsonb_build_object(
      'mes', to_char(x.m, 'YYYY-MM-DD'),
      'tem_dado', ag.mes is not null,
      'primeiro', x.m = (select m from prim),
      'inicial', ag.inicial, 'novo', ag.novo, 'reativacao', ag.reativacao, 'expansao', ag.expansao, 'contracao', ag.contracao, 'churn', ag.churn, 'final', ag.final,
      'clientes_inicial', ag.cli_ini, 'clientes_final', ag.cli_fim, 'clientes_churn', ag.cli_churn, 'clientes_novos', ag.cli_novos,
      'churn_receita_pct', case when ag.inicial > 0 then round(ag.churn / ag.inicial, 4) end,
      'churn_clientes_pct', case when ag.cli_ini > 0 then round(ag.cli_churn::numeric / ag.cli_ini, 4) end
    ) order by x.m) into ponte
    from meses x left join ag on ag.mes = x.m;

  ------------------------------------------------------------------ LTV, igual à tela inicial
  with emp as (
    select c.contract_start_date ini, c.contract_value v, lower(coalesce(c.payment_method, '')) pm
      from onboarding_companies c
     where c.status not in ('inactive','closed') and coalesce(c.is_simulator, false) = false and c.tenant_id is null
  ),
  vida as (
    select greatest(0, extract(year from age(hoje, ini))::int * 12 + extract(month from age(hoje, ini))::int) meses
      from emp where ini is not null
  ),
  tk as (
    select case when pm in ('monthly','mensal','recorrente') then v
                when pm in ('quarterly','trimestral') then v / 3
                when pm in ('semiannual','semestral') then v / 6
                when pm in ('annual','anual','card','cartao','cartão','boleto','pix') then v / 12 end mensal
      from emp where v > 0 and pm not like '%vista%' and pm not like '%unico%' and pm not like '%único%'
  )
  select jsonb_build_object(
    'tempo_medio_meses', (select round(avg(meses), 1) from vida where meses between 0 and 180),
    'empresas_tempo', (select count(*) from vida where meses between 0 and 180),
    'ticket_medio_mensal', (select round(avg(mensal)) from tk where mensal is not null),
    'empresas_ticket', (select count(*) from tk where mensal is not null),
    'empresas_fora_ticket', (select count(*) from emp where v > 0) - (select count(*) from tk where mensal is not null),
    'empresas_base', (select count(*) from emp)
  ) into ltv;
  ltv := ltv || jsonb_build_object('ltv', round((ltv->>'ticket_medio_mensal')::numeric * (ltv->>'tempo_medio_meses')::numeric));

  ------------------------------------------------------------------ renovações 30/60/90
  with r as (select * from painel_renovacoes(90))
  select jsonb_build_object(
    'em30', jsonb_build_object('n', (select count(*) from r where grupo = 'risco' and dias <= 30), 'valor', (select coalesce(sum(valor), 0) from r where grupo = 'risco' and dias <= 30)),
    'em60', jsonb_build_object('n', (select count(*) from r where grupo = 'risco' and dias <= 60), 'valor', (select coalesce(sum(valor), 0) from r where grupo = 'risco' and dias <= 60)),
    'em90', jsonb_build_object('n', (select count(*) from r where grupo = 'risco'), 'valor', (select coalesce(sum(valor), 0) from r where grupo = 'risco')),
    'mensais_n', (select count(*) from r where grupo = 'mensal'),
    'mensais_valor', (select coalesce(sum(mensalidade), 0) from r where grupo = 'mensal'),
    'lista', (select coalesce(jsonb_agg(to_jsonb(r) order by r.fim, r.empresa), '[]') from r)
  ) into ren;

  return jsonb_build_object('mes', to_char(date_trunc('month', coalesce(p_month, hoje)), 'YYYY-MM-DD'), 'hoje', hoje,
    'mrr', mrr, 'ponte', ponte, 'ltv', ltv, 'renovacoes', ren);
end $$;

-- Porta do master pros blocos carregados sob demanda.
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
    else raise exception 'Bloco desconhecido: %', p_nome;
  end case;
end $$;

-- Listas de detalhe dos blocos "pra frente":
--   caixa_movimentos  {de, ate, tipo: entrada|saida, classe}
--   vendas_grupo      {grupo: fundador|time|sem_fechador}
--   mrr_clientes      {grupo: base|fora}
--   reunioes_futuras  {de, ate, staff_id}
--   pipeline_aberto   {grupo: vivo|parado, stage_id}
--   leads_atencao     {tipo: novos7|sem_dono|sem_atividade}
--   mrr_movimentos    {tipo: novo|reativacao|expansao|contracao|churn|mantido}  (mês = p_month)
--   renovacoes        {dias, grupo: risco|mensal}
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

  else
    raise exception 'Bloco desconhecido: %', p_bloco;
  end case;

  return saida || jsonb_build_object('bloco', p_bloco, 'mes', to_char(v_ini, 'YYYY-MM-DD'), 'limite', 500);
end $$;

revoke all on function public.painel_mrr_movimentos(date, date) from public, anon, authenticated;
grant execute on function public.painel_mrr_movimentos(date, date) to service_role;
revoke all on function public.painel_renovacoes(int) from public, anon, authenticated;
grant execute on function public.painel_renovacoes(int) to service_role;
revoke all on function public.painel_receita_interno(date) from public, anon, authenticated;
grant execute on function public.painel_receita_interno(date) to service_role;
revoke all on function public.painel_bloco(date, text) from public, anon;
grant execute on function public.painel_bloco(date, text) to authenticated;
revoke all on function public.painel_frente_detalhe(date, text, jsonb) from public, anon;
grant execute on function public.painel_frente_detalhe(date, text, jsonb) to authenticated;
