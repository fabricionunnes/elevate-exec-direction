-- 30/10/2026, Fabrício: na Carteira do consultor, "uma análise melhor de como o consultor faz pra ganhar mais,
-- o que tem que ficar atento pra não perder cliente, e oferecer novos serviços pra aumentar a receita de cada cliente".
-- Esta função junta, por contrato da carteira, os sinais que já existem no Nexus: saúde, previsão de churn, NPS,
-- tarefas atrasadas, última reunião, WhatsApp, inadimplência, meta do mês e os produtos que a empresa já tem.
-- A tela monta risco e oportunidades em cima disso. Mesma regra de acesso da carteira_consultores.

create or replace function public.carteira_analise(p_consultant_id uuid default null)
returns table(
  consultant_id uuid, company_id uuid, company_name text, project_id uuid, product_name text,
  monthly_cents bigint, saindo boolean, retido boolean, recorrente boolean, plano text,
  contract_start_date date, contract_end_date date, vence_em_dias int, tem_success_fee boolean,
  health_score int, health_risk text, health_trend text,
  churn_prob numeric, churn_risk text, churn_factors jsonb, churn_actions jsonb,
  nps_score int, nps_date date,
  tarefas_atrasadas int, tarefas_abertas int,
  ultima_reuniao date, reunioes_90d int, noshows_90d int,
  wa_rag text, wa_last date, wa_msgs_7d int,
  inadimplente_cents bigint,
  meta_nome text, meta_alvo numeric, meta_realizado numeric,
  produtos text[], segmento text, meses_cliente int
)
language plpgsql stable security definer set search_path = public as $$
declare v_staff uuid; v_role text; v_filter uuid;
begin
  select s.id, s.role into v_staff, v_role from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if v_staff is null then return; end if;
  if v_role in ('master', 'admin') then v_filter := p_consultant_id; else v_filter := v_staff; end if;

  return query
  with base as (
    select r.* from carteira_consultores_raw() r where (v_filter is null or r.consultant_id = v_filter)
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
end $$;
revoke all on function public.carteira_analise(uuid) from anon, public;
grant execute on function public.carteira_analise(uuid) to authenticated;
