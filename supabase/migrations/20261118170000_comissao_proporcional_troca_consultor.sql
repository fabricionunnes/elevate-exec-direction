-- Comissão proporcional na troca de consultor.
--
-- Regra do Fabrício (18/11/2026): "se eu tirar a empresa do consultor Weslley no dia 15, ele recebe
-- proporcional até dia 15, e se eu passar pro Taynon, ele vai receber do dia 15 em diante".
--
-- Como ficou: o dia da troca fica com quem saiu; quem entrou recebe do dia seguinte em diante. Assim
-- o mês nunca soma mais de 100%. A data vem do registro da troca, gravado sozinho quando o consultor
-- do projeto muda. Para corrigir uma data, basta alterar data_troca na tabela.
--
-- De passagem: carteira_consultores_raw() podia ser chamada por qualquer pessoa com a chave pública
-- e devolvia a carteira e a comissão de todos. Passa a ser só do banco.

create table if not exists public.onboarding_project_consultant_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  de_consultant_id uuid references public.onboarding_staff(id) on delete set null,
  para_consultant_id uuid references public.onboarding_staff(id) on delete set null,
  data_troca date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  criado_em timestamptz not null default now(),
  criado_por uuid
);
create index if not exists onboarding_project_consultant_changes_proj_idx
  on public.onboarding_project_consultant_changes (project_id, data_troca);
create index if not exists onboarding_project_consultant_changes_data_idx
  on public.onboarding_project_consultant_changes (data_troca);

alter table public.onboarding_project_consultant_changes enable row level security;
drop policy if exists "master le e corrige as trocas de consultor" on public.onboarding_project_consultant_changes;
create policy "master le e corrige as trocas de consultor" on public.onboarding_project_consultant_changes
  for all to authenticated using ((select public.is_master())) with check ((select public.is_master()));
grant select, insert, update, delete on public.onboarding_project_consultant_changes to authenticated;
grant all on public.onboarding_project_consultant_changes to service_role;

create or replace function public.trg_registra_troca_consultor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.tenant_id is null and old.consultant_id is distinct from new.consultant_id then
    insert into onboarding_project_consultant_changes (project_id, de_consultant_id, para_consultant_id, criado_por)
    values (new.id, old.consultant_id, new.consultant_id, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists registra_troca_consultor on public.onboarding_projects;
create trigger registra_troca_consultor
  after update of consultant_id on public.onboarding_projects
  for each row execute function public.trg_registra_troca_consultor();

-- as duas mudam as colunas de saída, então precisam ser recriadas
drop function if exists public.carteira_consultores(uuid);
drop function if exists public.carteira_consultores_raw();

CREATE OR REPLACE FUNCTION public.carteira_consultores_raw()
 RETURNS TABLE(consultant_id uuid, consultant_name text, company_id uuid, company_name text, project_id uuid, product_name text, monthly_cents bigint, origem text, contract_value numeric, contract_start_date date, contract_end_date date, contract_months integer, commission_max_cents bigint, project_status text, contrato_vencido boolean, dias_para_vencer integer, recorrente boolean, proxima_renovacao date, plano text, saindo boolean, retido boolean, cancelamento_solicitado date, dias_comissionados integer, dias_do_mes integer, comissao_cents bigint, comissao_cheia_cents bigint, vence_em_dias integer, vendido_por uuid, vendido_por_nome text, comissao_venda_cents bigint, fator_pago numeric, nao_pago_cents bigint, venda_primeiro_mes boolean, atraso_pago_cents bigint, atual boolean, dia_inicio integer, dia_fim integer, troca_tipo text, troca_data date, troca_com text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dias   int;
  v_pct_venda numeric;
  v_pct_venda_unica numeric;
  v_meses_venda int;
  v_sem_venda text[];
begin
  v_dias := extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))::int;

  select cfg.percentual_venda, cfg.percentual_venda_unica, cfg.produtos_sem_venda, cfg.meses_venda
    into v_pct_venda, v_pct_venda_unica, v_sem_venda, v_meses_venda
    from consultant_commission_config cfg
   where cfg.consultant_id is null
   limit 1;

  return query
  with cfg_padrao as (
    select cfg.piso_cents as piso, cfg.percentual as pct, cfg.teto_cents as teto
      from consultant_commission_config cfg where cfg.consultant_id is null limit 1
  ),
  -- Troca de consultor no mes (Fabricio, 18/11/2026): quem saiu recebe ate o dia
  -- da troca, inclusive; quem entrou recebe do dia seguinte em diante. Cada
  -- projeto vira um ou mais trechos do mes, um por consultor.
  tr as (
    select t.project_id as pid, t.de_consultant_id as de, t.para_consultant_id as para,
           t.data_troca as dt, extract(day from t.data_troca)::int as dia,
           row_number() over w as rn,
           lead(extract(day from t.data_troca)::int) over w as prox
      from onboarding_project_consultant_changes t
     where t.data_troca >= date_trunc('month', current_date)::date
       and t.data_troca < (date_trunc('month', current_date) + interval '1 month')::date
    window w as (partition by t.project_id order by t.data_troca, t.criado_em, t.id)
  ),
  seg as (
    -- sem troca no mes: o consultor atual, o mes inteiro
    select p.id as pid, p.consultant_id as sid, 1 as d1, v_dias as d2, true as atual,
           null::text as tipo, null::date as tdata, null::uuid as outro
      from onboarding_projects p
     where p.tenant_id is null and p.consultant_id is not null
       and not exists (select 1 from tr where tr.pid = p.id)
    union all
    -- quem estava com o projeto antes da primeira troca do mes
    select tr.pid, tr.de, 1, tr.dia, false, 'saiu', tr.dt, tr.para
      from tr where tr.rn = 1 and tr.de is not null
    union all
    -- quem recebeu o projeto em cada troca: do dia seguinte ate a proxima troca
    select tr.pid, tr.para, tr.dia + 1, coalesce(tr.prox, v_dias), (tr.prox is null),
           case when tr.prox is null then 'entrou' else 'passou' end, tr.dt, tr.de
      from tr where tr.para is not null and (tr.prox is null or tr.prox > tr.dia)
  ),
  npc as (
    select p.onboarding_company_id as cid, count(*) as np
      from onboarding_projects p
     where p.tenant_id is null and p.consultant_id is not null
       and p.status in ('active', 'cancellation_signaled', 'notice_period')
     group by p.onboarding_company_id
  ),
  proj as (
    select p.id as pid,
           p.onboarding_company_id as cid,
           sg.sid as sid,
           p.sold_by_staff_id as vid,
           coalesce(p.contract_start_date, p.created_at::date) as inicio,
           p.product_name as prod,
           p.status as st,
           p.monthly_value_cents as mvc,
           p.contract_value as pcv,
           p.contract_start_date as pini,
           p.contract_end_date as pfim,
           p.contract_term as termo,
           p.cancellation_signal_date::date as sinal,
           coalesce(p.churn_date::date, p.notice_end_date) as encerrou,
           p.reactivated_at::date as reat,
           coalesce(npc.np, 1) as np,
           sg.d1 as d1,
           sg.d2 as d2,
           sg.atual as seg_atual,
           sg.tipo as seg_tipo,
           sg.tdata as seg_data,
           sg.outro as seg_outro,
           -- uma linha por projeto carrega o que e do projeto e nao do consultor
           -- (comissao de venda, valor em aberto): a do trecho mais recente
           (row_number() over (partition by p.id order by sg.d1 desc) = 1) as principal
      from onboarding_projects p
      join seg sg on sg.pid = p.id
      left join npc on npc.cid = p.onboarding_company_id
     where p.tenant_id is null
       and p.status in ('active', 'cancellation_signaled', 'notice_period')
  ),
  -- O que a empresa e cobrada no ciclo. As cobrancas recorrentes ativas nao
  -- servem de base: sobraram cadastros duplicados e parados que nao geram
  -- fatura e inflavam a carteira em mais de 50%.
  fat as (
    select i.company_id as cid,
           to_char(i.due_date, 'YYYY-MM') as comp,
           sum(i.amount_cents)::bigint as total
      from company_invoices i
     where i.due_date >= date_trunc('month', current_date)
       and i.due_date < date_trunc('month', current_date) + interval '2 months'
     group by i.company_id, to_char(i.due_date, 'YYYY-MM')
  ),
  rec as (
    select f.cid, (array_agg(f.total order by f.comp desc))[1] as total
      from fat f group by f.cid
  ),
  -- O que o cliente VENCEU e nao pagou no mes. Duas coisas de proposito aqui:
  -- fatura quitada e fatura quitada (o desconto de pix que a UNV da nao e calote
  -- do cliente), e fatura dentro do prazo nao e inadimplencia, entao so conta
  -- depois que passa o vencimento.
  pag as (
    select i.company_id as cid,
           -- vencido no mes e ainda sem pagar: sai da base deste mes
           sum(case when i.paid_at is null
                     and i.due_date >= date_trunc('month', current_date)
                     and i.due_date < current_date
                    then i.amount_cents else 0 end)::bigint as aberto,
           -- atrasado de mes anterior que o cliente quitou agora: volta aqui,
           -- porque no mes do vencimento ja tinha saido da base
           sum(case when i.paid_at is not null
                     and i.due_date < date_trunc('month', current_date)
                     and i.paid_at >= date_trunc('month', current_date)
                    then i.amount_cents else 0 end)::bigint as recuperado,
           -- quanto foi cobrado no mes, pra saber se existe cobranca
           sum(case when i.due_date >= date_trunc('month', current_date)
                    then i.amount_cents else 0 end)::bigint as faturado
      from company_invoices i
     where i.due_date >= date_trunc('month', current_date) - interval '12 months'
       and i.due_date < date_trunc('month', current_date) + interval '1 month'
     group by i.company_id
  ),
  com as (
    select r.company_id as cid, coalesce(max(t.payout_cents), 0)::bigint as teto
      from company_commission_rules r
      left join company_commission_tiers t on t.rule_id = r.id
     where r.is_active
     group by r.company_id
  ),
  calc as (
    select pr.*,
           rec.total as rt,
           coalesce(com.teto, 0) as teto,
           ec.contract_value as ecv,
           ec.contract_end_date as efim,
           lower(coalesce(pr.termo,
                          case ec.renewal_plan_type
                            when 'monthly' then 'mensal'
                            when 'annual' then 'anual'
                            when 'semiannual' then 'semestral'
                            when 'quarterly' then 'trimestral'
                            else ec.renewal_plan_type
                          end,
                          'mensal')) as plano,
           coalesce(ec.billing_day, extract(day from coalesce(pr.pini, ec.contract_start_date))::int) as dia_cob,
           case when pr.pini is not null and pr.pfim is not null
                then greatest(round((pr.pfim - pr.pini) / 30.0)::int, 1) end as meses,
           case when ec.contract_start_date is not null and ec.contract_end_date is not null
                then greatest(round((ec.contract_end_date - ec.contract_start_date) / 30.0)::int, 1) end as meses_emp,
           -- pediu pra sair e nao foi retido: reativacao depois do pedido anula o pedido
           -- Ate quando a comissao conta. Duas coisas encerram: o cancelamento
           -- (churn_date ou fim do aviso) e o fim do prazo do contrato. Contrato
           -- com prazo vencido para de pagar comissao ate ser renovado; mensal
           -- nao vence, so renova.
           least(
             -- Data de encerramento so vale se o projeto nao esta ativo e nao foi
             -- reativado depois dela. A Drogarias Prime tem fim de aviso em maio
             -- e reativacao em junho: cadastro velho nao pode zerar cliente vivo.
             case when pr.st = 'active'
                    or (pr.reat is not null and pr.encerrou is not null and pr.reat >= pr.encerrou)
                  then null else pr.encerrou end,
             case when lower(coalesce(pr.termo,
                    case ec.renewal_plan_type
                      when 'monthly' then 'mensal' when 'annual' then 'anual'
                      when 'semiannual' then 'semestral' when 'quarterly' then 'trimestral'
                      else ec.renewal_plan_type end, 'mensal')) <> 'mensal'
                  then coalesce(pr.pfim, ec.contract_end_date) end
           ) as fim,
           (pr.reat is not null and pr.sinal is not null and pr.reat >= pr.sinal) as e_retido,
           ((pr.sinal is not null or pr.st in ('cancellation_signaled', 'notice_period'))
             and not (pr.reat is not null and pr.sinal is not null and pr.reat >= pr.sinal)) as e_saindo
           ,
           coalesce(pag.aberto, 0) as aberto,
           coalesce(pag.recuperado, 0) as recuperado,
           coalesce(pag.faturado, 0) as faturado
      from proj pr
      left join rec on rec.cid = pr.cid
      left join com on com.cid = pr.cid
      left join pag on pag.cid = pr.cid
      join onboarding_companies ec on ec.id = pr.cid
  ),
  val as (
    select ca.*,
           (case
             when ca.mvc is not null then ca.mvc::bigint
             when ca.np = 1 and ca.rt is not null then ca.rt
             when ca.pcv is not null and ca.meses is not null and ca.meses > 1
               then round(ca.pcv * 100 / ca.meses)::bigint
             when ca.pcv is not null then round(ca.pcv * 100)::bigint
             when ca.ecv is not null and ca.meses_emp is not null and ca.meses_emp > 1
               then round(ca.ecv * 100 / ca.meses_emp)::bigint
             when ca.ecv is not null then round(ca.ecv * 100)::bigint
             else 0::bigint
           end)::bigint as mensal,
           -- Dias que contam pra comissao. Enquanto o cliente paga, o consultor
           -- recebe: a conta para na data em que o contrato ENCERRA de fato, nao
           -- na data em que o cliente avisou. Quem avisou e segue pagando o aviso
           -- previo continua gerando comissao; se parar de pagar, quem corta e o
           -- valor em aberto, que ja sai da base.
           (case
             when ca.fim is null then v_dias
             when ca.fim < date_trunc('month', current_date)::date then 0
             when ca.fim >= (date_trunc('month', current_date) + interval '1 month - 1 day')::date
               then v_dias
             else extract(day from ca.fim)::int
           end) as dias_ok
      from calc ca
  ),
  -- O desconto e o valor em aberto, nao uma porcentagem do mes inteiro. Cliente
  -- que pagou 12 meses adiantado no cartao nao pode perder o mes todo porque
  -- uma parcela de pix do mes ficou em aberto.
  val2 as (
    select v.*,
           sum(v.mensal) filter (where v.principal) over (partition by v.cid) as mensal_emp,
           -- dias do trecho que contam (o trecho cortado pelo fim do contrato) e
           -- dias em que o consultor esteve com o projeto no mes
           greatest(0, least(v.d2, v.dias_ok) - v.d1 + 1) as dias_seg,
           greatest(0, v.d2 - v.d1 + 1) as dias_posse
      from val v
  ),
  val3 as (
    select v2.*,
           (case
              when v2.mensal_emp <= 0 then 1.0
              -- Cliente saindo e sem cobranca nenhuma no mes nao tem o que
              -- receber. Pra quem fica, mes sem fatura significa que pagou
              -- adiantado; pra quem esta de saida, significa que acabou.
              when v2.e_saindo and v2.faturado = 0 and v2.recuperado = 0 then 0.0
              else 1.0
                   - least(v2.aberto, v2.mensal_emp)::numeric / v2.mensal_emp::numeric
                   + v2.recuperado::numeric / v2.mensal_emp::numeric
            end) as fator
      from val2 v2
  )
  select va.sid,
         st.name,
         c.id,
         c.name,
         va.pid,
         va.prod,
         va.mensal,
         (case
           when va.mvc is not null then 'mensalidade do projeto'
           when va.np = 1 and va.rt is not null then 'mensalidade cobrada'
           when va.pcv is not null and va.meses is not null and va.meses > 1 then 'contrato do projeto mensalizado'
           when va.pcv is not null then 'contrato do projeto'
           when va.ecv is not null and va.meses_emp is not null and va.meses_emp > 1 then 'contrato da empresa mensalizado'
           when va.ecv is not null then 'contrato da empresa'
           else 'a definir'
         end)::text,
         va.pcv,
         va.pini,
         va.pfim,
         va.meses,
         va.teto,
         va.st::text,
         (coalesce(va.plano, 'mensal') <> 'mensal'
            and coalesce(va.pfim, va.efim) is not null
            and coalesce(va.pfim, va.efim) < current_date),
         case when coalesce(va.plano, 'mensal') <> 'mensal'
              then (coalesce(va.pfim, va.efim) - current_date)::int end,
         (coalesce(va.plano, 'mensal') = 'mensal'),
         case when coalesce(va.plano, 'mensal') = 'mensal' and va.dia_cob is not null then
           (select min(d)::date from (
              select make_date(
                       extract(year from m)::int,
                       extract(month from m)::int,
                       least(va.dia_cob, extract(day from (m + interval '1 month - 1 day'))::int)
                     ) as d
                from generate_series(date_trunc('month', current_date),
                                     date_trunc('month', current_date) + interval '1 month',
                                     interval '1 month') m
            ) x where x.d >= current_date)
         end,
         coalesce(va.plano, 'mensal')::text,
         va.e_saindo,
         va.e_retido,
         va.sinal,
         va.dias_seg,
         v_dias,
         round(va.mensal * coalesce(cp.pct, 0) / 100.0 * va.dias_seg / v_dias * va.fator)::bigint,
         round(va.mensal * coalesce(cp.pct, 0) / 100.0 * va.dias_posse / v_dias)::bigint,
         -- prazo de fim do contrato olhando todo mundo, mensal inclusive, pra
         -- nao perder renovacao por causa da periodicidade
         (coalesce(va.pfim, va.efim) - current_date)::int,
         vd.id,
         vd.name,
         -- comissao de venda: so com vendedor ativo e produto que gera venda
         -- Produto fora da comissao recorrente (UNV Social) paga uma vez so, no
         -- mes em que o contrato comecou. Os outros pagam todo mes.
         case
           when vd.id is null or not va.principal then null
           -- Comissao de venda tem prazo: a indicacao e um esforco unico, entao
           -- paga pelos primeiros meses do contrato e depois o projeto fica so
           -- com quem entrega. Zero ou nulo em meses_venda = paga pra sempre.
           when not (va.prod = any (coalesce(v_sem_venda, array[]::text[])))
             then case
                    when coalesce(v_meses_venda, 0) > 0
                         and va.inicio is not null
                         and date_trunc('month', va.inicio)
                             + make_interval(months => v_meses_venda) <= date_trunc('month', current_date)
                      then null
                    else round(va.mensal * coalesce(cv.percentual_venda, v_pct_venda, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint
                  end
           when va.inicio is not null
                and date_trunc('month', va.inicio) = date_trunc('month', current_date)
             then round(va.mensal * coalesce(cv.percentual_venda_unica, v_pct_venda_unica, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint
         end,
         round(va.fator, 4),
         case when va.principal
              then round(va.mensal * least(va.aberto, va.mensal_emp)::numeric / nullif(va.mensal_emp, 0))::bigint
              else 0::bigint end,
         (vd.id is not null
            and va.principal
            and va.prod = any (coalesce(v_sem_venda, array[]::text[]))
            and va.inicio is not null
            and date_trunc('month', va.inicio) = date_trunc('month', current_date)),
         case when va.principal
              then round(va.mensal * va.recuperado::numeric / nullif(va.mensal_emp, 0))::bigint
              else 0::bigint end,
         va.seg_atual,
         va.d1,
         va.d2,
         va.seg_tipo,
         va.seg_data,
         (select o.name from onboarding_staff o where o.id = va.seg_outro)::text
    from val3 va
    join onboarding_companies c on c.id = va.cid
    join onboarding_staff st on st.id = va.sid
    left join onboarding_staff vd on vd.id = va.vid and vd.is_active
    left join consultant_commission_config cc on cc.consultant_id = va.sid
    -- a comissao de venda sai do percentual de quem VENDEU, nao do padrao nem
    -- do percentual de quem entrega
    left join consultant_commission_config cv on cv.consultant_id = vd.id
    cross join lateral (
      select coalesce(cc.percentual, (select cfg_padrao.pct from cfg_padrao)) as pct
    ) cp
   where coalesce(c.is_simulator, false) = false
   order by 7 desc;
end
$function$;

CREATE OR REPLACE FUNCTION public.carteira_consultores(p_consultant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(consultant_id uuid, consultant_name text, company_id uuid, company_name text, project_id uuid, product_name text, monthly_cents bigint, origem text, contract_value numeric, contract_start_date date, contract_end_date date, contract_months integer, commission_max_cents bigint, project_status text, contrato_vencido boolean, dias_para_vencer integer, recorrente boolean, proxima_renovacao date, plano text, saindo boolean, retido boolean, cancelamento_solicitado date, dias_comissionados integer, dias_do_mes integer, comissao_cents bigint, comissao_cheia_cents bigint, vence_em_dias integer, vendido_por uuid, vendido_por_nome text, comissao_venda_cents bigint, fator_pago numeric, nao_pago_cents bigint, venda_primeiro_mes boolean, atraso_pago_cents bigint, atual boolean, troca_tipo text, troca_data date, troca_com text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff  uuid;
  v_role   text;
  v_ve     boolean;
  v_master boolean;
  v_filter uuid;
begin
  select s.id, s.role, coalesce(s.ve_comissao, false)
    into v_staff, v_role, v_ve
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  v_master := (v_role = 'master');

  if v_role in ('master', 'admin') then
    v_filter := p_consultant_id;
  else
    v_filter := v_staff;
  end if;

  return query
  select r.consultant_id, r.consultant_name, r.company_id, r.company_name,
         r.project_id, r.product_name, r.monthly_cents, r.origem,
         r.contract_value, r.contract_start_date, r.contract_end_date,
         r.contract_months, r.commission_max_cents, r.project_status,
         r.contrato_vencido, r.dias_para_vencer, r.recorrente,
         r.proxima_renovacao, r.plano, r.saindo, r.retido,
         r.cancelamento_solicitado,
         case when v_master or v_ve then r.dias_comissionados end,
         case when v_master or v_ve then r.dias_do_mes end,
         case when v_master or v_ve then r.comissao_cents end,
         case when v_master or v_ve then r.comissao_cheia_cents end,
         r.vence_em_dias,
         r.vendido_por, r.vendido_por_nome,
         case when v_master or (v_ve and r.vendido_por = v_staff) then r.comissao_venda_cents end,
         r.fator_pago, r.nao_pago_cents, r.venda_primeiro_mes, r.atraso_pago_cents,
         r.atual, r.troca_tipo, r.troca_data, r.troca_com
    from carteira_consultores_raw() r
   where (v_filter is null or r.consultant_id = v_filter)
   order by r.monthly_cents desc;
end
$function$;

CREATE OR REPLACE FUNCTION public.carteira_comissao_resumo(p_consultant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(consultant_id uuid, consultant_name text, papel text, contratos integer, clientes integer, saindo integer, carteira_cents bigint, base_cents bigint, nao_pago_cents bigint, atraso_pago_cents bigint, piso_cents integer, percentual numeric, teto_cents integer, variavel_cents bigint, variavel_cheia_cents bigint, perdido_cents bigint, vendas integer, carteira_vendida_cents bigint, venda_cents bigint, total_cents bigint, acima_teto boolean, peso numeric, percentual_venda numeric, percentual_venda_unica numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff  uuid;
  v_role   text;
  v_ve     boolean;
  v_filter uuid;
begin
  select s.id, s.role, coalesce(s.ve_comissao, false)
    into v_staff, v_role, v_ve
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  if v_role = 'master' then
    v_filter := p_consultant_id;
  elsif v_ve then
    v_filter := v_staff;
  else
    return;
  end if;

  return query
  with padrao as (
    select cfg.piso_cents as piso, cfg.percentual as pct, cfg.teto_cents as teto,
           cfg.percentual_venda as pctv, cfg.percentual_venda_unica as pctvu
      from consultant_commission_config cfg where cfg.consultant_id is null limit 1
  ),
  base as (
    select * from carteira_consultores_raw()
  ),
  entrega as (
    select b.consultant_id as sid,
           -- contrato, cliente e carteira contam so o que esta com o consultor hoje;
           -- a comissao soma tambem o trecho do mes de quem ja passou o cliente adiante
           count(*) filter (where b.atual)::int as qt,
           count(*)::int as tem,
           count(distinct b.company_id) filter (where b.atual)::int as cli,
           count(*) filter (where b.saindo and b.atual)::int as sai,
           coalesce(sum(b.monthly_cents) filter (where b.atual), 0)::bigint as cart,
           coalesce(sum(b.monthly_cents * b.fator_pago) filter (where b.atual), 0)::bigint as base,
           coalesce(sum(b.nao_pago_cents), 0)::bigint as npago,
           coalesce(sum(b.atraso_pago_cents), 0)::bigint as recup,
           coalesce(sum(b.comissao_cents), 0)::bigint as com,
           coalesce(sum(b.comissao_cheia_cents), 0)::bigint as cheia
      from base b
     group by b.consultant_id
  ),
  venda as (
    select b.vendido_por as sid,
           count(*)::int as qt,
           coalesce(sum(b.monthly_cents), 0)::bigint as cart,
           coalesce(sum(b.comissao_venda_cents), 0)::bigint as com
      from base b
     where b.vendido_por is not null and b.comissao_venda_cents is not null
     group by b.vendido_por
  ),
  pessoas as (
    select sid from entrega
    union
    select sid from venda
  )
  select p.sid,
         stf.name::text,
         stf.role::text,
         coalesce(e.qt, 0),
         coalesce(e.cli, 0),
         coalesce(e.sai, 0),
         coalesce(e.cart, 0)::bigint,
         coalesce(e.base, 0)::bigint,
         coalesce(e.npago, 0)::bigint,
         coalesce(e.recup, 0)::bigint,
         (case when coalesce(e.tem, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)::int,
         coalesce(cc.percentual, pa.pct),
         coalesce(cc.teto_cents, pa.teto)::int,
         coalesce(e.com, 0)::bigint,
         coalesce(e.cheia, 0)::bigint,
         (coalesce(e.cheia, 0) - coalesce(e.com, 0))::bigint,
         coalesce(v.qt, 0),
         coalesce(v.cart, 0)::bigint,
         coalesce(v.com, 0)::bigint,
         ((case when coalesce(e.tem, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)
           + coalesce(e.com, 0) + coalesce(v.com, 0))::bigint,
         (coalesce(cc.teto_cents, pa.teto) is not null
           and (case when coalesce(e.tem, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)
               + coalesce(e.com, 0) + coalesce(v.com, 0) > coalesce(cc.teto_cents, pa.teto)),
         case when coalesce(e.cart, 0) + coalesce(v.cart, 0) > 0
              then round(((case when coalesce(e.tem, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)
                           + coalesce(e.com, 0) + coalesce(v.com, 0))::numeric
                         / (coalesce(e.cart, 0) + coalesce(v.cart, 0))::numeric, 4) end,
         pa.pctv,
         pa.pctvu
    from pessoas p
    join onboarding_staff stf on stf.id = p.sid
    cross join padrao pa
    left join entrega e on e.sid = p.sid
    left join venda   v on v.sid = p.sid
    left join consultant_commission_config cc on cc.consultant_id = p.sid
   where stf.role = 'consultant'
     and (v_filter is null or p.sid = v_filter)
   order by 20 desc;
end
$function$;

CREATE OR REPLACE FUNCTION public.carteira_analise(p_consultant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(consultant_id uuid, company_id uuid, company_name text, project_id uuid, product_name text, monthly_cents bigint, saindo boolean, retido boolean, recorrente boolean, plano text, contract_start_date date, contract_end_date date, vence_em_dias integer, tem_success_fee boolean, health_score integer, health_risk text, health_trend text, churn_prob numeric, churn_risk text, churn_factors jsonb, churn_actions jsonb, nps_score integer, nps_date date, tarefas_atrasadas integer, tarefas_abertas integer, ultima_reuniao date, reunioes_90d integer, noshows_90d integer, wa_rag text, wa_last date, wa_msgs_7d integer, inadimplente_cents bigint, meta_nome text, meta_alvo numeric, meta_realizado numeric, produtos text[], segmento text, meses_cliente integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_staff uuid; v_role text; v_filter uuid;
begin
  select s.id, s.role into v_staff, v_role from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if v_staff is null then return; end if;
  if v_role in ('master', 'admin') then v_filter := p_consultant_id; else v_filter := v_staff; end if;

  return query
  with base as (
    select r.* from carteira_consultores_raw() r where r.atual and (v_filter is null or r.consultant_id = v_filter)
  ),
  hs as (
    select distinct on (h.project_id) h.project_id, h.total_score, h.risk_level, h.trend_direction
      from client_health_scores h order by h.project_id, h.last_calculated_at desc nulls last
  ),
  cp as (
    select distinct on (c.project_id) c.project_id, c.churn_probability, c.risk_level, c.risk_factors, c.recommended_actions
      from churn_predictions c order by c.project_id, c.prediction_date desc
  ),
  nps as (
    select distinct on (n.project_id) n.project_id, n.score, n.created_at::date as dt
      from onboarding_nps_responses n order by n.project_id, n.created_at desc
  ),
  tar as (
    select t.project_id,
           count(*) filter (where t.status in ('pending','in_progress') and t.due_date < current_date)::int as atrasadas,
           count(*) filter (where t.status in ('pending','in_progress'))::int as abertas
      from onboarding_tasks t where coalesce(t.is_internal, false) = false group by t.project_id
  ),
  reu as (
    select m.project_id,
           max(m.meeting_date) filter (where not coalesce(m.is_no_show, false))::date as ultima,
           count(*) filter (where m.meeting_date >= current_date - 90 and not coalesce(m.is_no_show, false))::int as r90,
           count(*) filter (where m.meeting_date >= current_date - 90 and coalesce(m.is_no_show, false))::int as ns90
      from onboarding_meeting_notes m where coalesce(m.is_internal, false) = false group by m.project_id
  ),
  inad as (
    select i.company_id, sum(i.amount_cents)::bigint as cents
      from company_invoices i
     where i.status in ('pending','overdue') and i.due_date < current_date group by i.company_id
  ),
  meta as (
    select distinct on (k.company_id) k.company_id, k.name, k.target_value,
           (select coalesce(sum(e.value), 0) from kpi_entries e where e.kpi_id = k.id
              and e.entry_date >= date_trunc('month', current_date) and e.entry_date < date_trunc('month', current_date) + interval '1 month') as realizado
      from company_kpis k
     where k.is_active and k.is_main_goal and coalesce(k.target_value, 0) > 0
     order by k.company_id, k.sort_order
  ),
  prods as (
    select p.onboarding_company_id as cid, array_agg(distinct p.product_name order by p.product_name) as arr
      from onboarding_projects p
     where p.status in ('active','notice_period','cancellation_signaled','pending') and p.product_name is not null
     group by p.onboarding_company_id
  )
  select b.consultant_id, b.company_id, b.company_name, b.project_id, b.product_name,
         b.monthly_cents, b.saindo, b.retido, b.recorrente, b.plano,
         b.contract_start_date, b.contract_end_date, b.vence_em_dias, (coalesce(b.commission_max_cents, 0) > 0),
         hs.total_score::int, hs.risk_level, hs.trend_direction,
         cp.churn_probability, cp.risk_level, to_jsonb(cp.risk_factors), to_jsonb(cp.recommended_actions),
         nps.score::int, nps.dt,
         coalesce(tar.atrasadas, 0), coalesce(tar.abertas, 0),
         reu.ultima, coalesce(reu.r90, 0), coalesce(reu.ns90, 0),
         wa.rag, wa.last_message_at::date, coalesce(wa.msgs_7d, 0)::int,
         coalesce(inad.cents, 0),
         meta.name, meta.target_value, meta.realizado,
         coalesce(prods.arr, array[]::text[]), ec.segment,
         greatest(0, ((extract(year from age(current_date, coalesce(b.contract_start_date, ec.contract_start_date, current_date))) * 12
                      + extract(month from age(current_date, coalesce(b.contract_start_date, ec.contract_start_date, current_date))))::int))
    from base b
    join onboarding_companies ec on ec.id = b.company_id
    left join hs on hs.project_id = b.project_id
    left join cp on cp.project_id = b.project_id
    left join nps on nps.project_id = b.project_id
    left join tar on tar.project_id = b.project_id
    left join reu on reu.project_id = b.project_id
    left join client_whatsapp_signals wa on wa.company_id = b.company_id
    left join inad on inad.company_id = b.company_id
    left join meta on meta.company_id = b.company_id
    left join prods on prods.cid = b.company_id
   order by b.monthly_cents desc;
end $function$;

CREATE OR REPLACE FUNCTION public.projecao_comissao_mes(p_staff uuid, p_mes date)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ini   date := date_trunc('month', p_mes)::date;
  v_fim   date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_dias  int  := extract(day from (date_trunc('month', p_mes) + interval '1 month - 1 day'))::int;
  v_piso  int; v_pct numeric; v_pctv numeric;
  v_qt    int; v_ent numeric; v_ven numeric;
begin
  select coalesce(cc.piso_cents, pa.piso_cents), coalesce(cc.percentual, pa.percentual), coalesce(cc.percentual_venda, pa.percentual_venda)
    into v_piso, v_pct, v_pctv
    from consultant_commission_config pa
    left join consultant_commission_config cc on cc.consultant_id = p_staff
   where pa.consultant_id is null
   limit 1;

  -- No mes corrente a conta segue os trechos do mes: quem passou o cliente
  -- adiante recebe ate o dia da troca e quem recebeu, do dia seguinte em diante.
  -- Nos outros meses vale so quem esta com o cliente hoje.
  with lim as (
    select x.*,
           case
             -- saindo (pediu e nao foi retido): conta ate o fim do aviso
             when x.saindo and not coalesce(x.retido, false) then
               case
                 when p.notice_end_date is null or p.notice_end_date < v_ini then 0
                 when p.notice_end_date <= v_fim then extract(day from p.notice_end_date)::int
                 else v_dias
               end
             -- contrato que acabou sem renovacao sai
             when not (x.recorrente or x.contract_end_date is null or x.contract_end_date >= v_ini) then 0
             else v_dias
           end as ult
      from carteira_consultores_raw() x
      left join onboarding_projects p on p.id = x.project_id
  ),
  r as (
    select l.*,
           case
             when v_ini = date_trunc('month', current_date)::date
               then greatest(0, least(l.dia_fim, l.ult) - l.dia_inicio + 1)::numeric / v_dias
             when l.atual then l.ult::numeric / v_dias
             else 0
           end as fator_mes,
           -- a comissao de venda e do projeto, nao do trecho: uma vez por projeto
           l.ult::numeric / v_dias as fator_venda
      from lim l
  )
  select count(*) filter (where r.consultant_id = p_staff and r.fator_mes > 0),
         coalesce(sum(r.monthly_cents * r.fator_mes) filter (where r.consultant_id = p_staff), 0) * v_pct / 100,
         coalesce(sum(r.monthly_cents * r.fator_venda) filter (where r.vendido_por = p_staff and r.comissao_venda_cents is not null), 0) * coalesce(v_pctv, 0) / 100
    into v_qt, v_ent, v_ven
    from r;

  return round((case when v_qt > 0 then coalesce(v_piso, 0) else 0 end) + v_ent + v_ven)::bigint;
end $function$;


revoke all on function public.carteira_consultores_raw() from public, anon, authenticated;
grant execute on function public.carteira_consultores_raw() to service_role;
revoke all on function public.carteira_consultores(uuid) from public, anon;
grant execute on function public.carteira_consultores(uuid) to authenticated, service_role;
revoke all on function public.trg_registra_troca_consultor() from public, anon, authenticated;

notify pgrst, 'reload schema';
