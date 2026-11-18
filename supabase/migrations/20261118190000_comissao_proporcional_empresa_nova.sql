-- Empresa nova no meio do mês: a comissão de entrega conta do dia em que ela entrou até o fim do mês.
--
-- Regra do Fabrício (18/11/2026): "se uma empresa nova entrar hoje, só conta de hoje até final do mês
-- proporcionalmente também".
--
-- Vale só para projeto criado no mês corrente. A data é o início do contrato, ou a criação do projeto
-- quando não há início. Projeto antigo não entra na regra, porque a renovação empurra o início do
-- contrato para frente (Agile Save: criado em maio, início em 01/11) e cortaria dias de quem já atendia.
-- A comissão de venda não muda: continua pelo mês inteiro.
--
-- Junto: quem recebe um projeto que estava sem consultor conta do próprio dia, e não do dia seguinte.

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
    select tr.pid, tr.para, case when tr.de is null then tr.dia else tr.dia + 1 end, coalesce(tr.prox, v_dias), (tr.prox is null),
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
           -- Empresa nova no mes (Fabricio, 18/11/2026): conta do dia em que entrou
           -- ate o fim do mes. So vale pra projeto CRIADO neste mes: a renovacao
           -- empurra a data de inicio do contrato pra frente e nao pode cortar os
           -- dias de quem ja atendia o cliente.
           greatest(sg.d1, en.dia) as d1,
           sg.d2 as d2,
           sg.atual as seg_atual,
           coalesce(sg.tipo, case when en.dia > 1 then 'novo' end) as seg_tipo,
           coalesce(sg.tdata, case when en.dia > 1 then en.dt end) as seg_data,
           sg.outro as seg_outro,
           -- uma linha por projeto carrega o que e do projeto e nao do consultor
           -- (comissao de venda, valor em aberto): a do trecho mais recente
           (row_number() over (partition by p.id order by sg.d1 desc) = 1) as principal
      from onboarding_projects p
      join seg sg on sg.pid = p.id
      left join npc on npc.cid = p.onboarding_company_id
      cross join lateral (
        select x.dt,
               case
                 when (p.created_at at time zone 'America/Sao_Paulo')::date < date_trunc('month', current_date)::date then 1
                 when x.dt < date_trunc('month', current_date)::date then 1
                 when x.dt >= (date_trunc('month', current_date) + interval '1 month')::date then v_dias + 1
                 else extract(day from x.dt)::int
               end as dia
          from (select coalesce(p.contract_start_date, (p.created_at at time zone 'America/Sao_Paulo')::date) as dt) x
      ) en
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

revoke all on function public.carteira_consultores_raw() from public, anon, authenticated;
grant execute on function public.carteira_consultores_raw() to service_role;
