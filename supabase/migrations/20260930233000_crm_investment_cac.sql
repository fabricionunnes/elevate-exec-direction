-- Investimento e CAC na aba Vendas (pedido do Fabrício, 30/09/2026): custo por reunião
-- agendada/realizada, CAC e custo por lead sobre o investimento TOTAL (tráfego Meta + discador
-- + outros custos lançados à mão), não só o discador. Com closer filtrado, o investimento é
-- rateado pela fração de leads do closer (por funil quando a campanha tem funil vinculado).
-- Só dados da UNV (tenant_id nulo), nunca de cliente.

-- Outros custos de marketing/comercial lançados à mão, por mês (ferramenta, agência, salário de SDR).
create table if not exists public.crm_marketing_costs (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  label text not null check (length(trim(label)) > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_marketing_costs_month on public.crm_marketing_costs (month);
alter table public.crm_marketing_costs enable row level security;
drop policy if exists "staff le custos de marketing" on public.crm_marketing_costs;
create policy "staff le custos de marketing" on public.crm_marketing_costs for select to authenticated
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)));
drop policy if exists "admin escreve custos de marketing" on public.crm_marketing_costs;
create policy "admin escreve custos de marketing" on public.crm_marketing_costs for all to authenticated
  using (public.crm_is_settings_admin()) with check (public.crm_is_settings_admin());
grant select, insert, update, delete on public.crm_marketing_costs to authenticated;

-- Resumo do investimento no período. O discador (Twilio) fica no front (edge dialer-usage).
-- meta_spend_by_pipeline: gasto de cada campanha ligada a um funil (crm_meta_campaign_pipelines,
-- peso), e o resto no balde pipeline_id nulo. Custos manuais mensais rateados pelos dias do
-- período dentro de cada mês. Leads = criados no período fora das etapas exclude_from_lead_count,
-- igual à tabela "Entradas por funil" da tela; "do closer" = dono ou closer do lead.
create or replace function public.crm_investment_summary(p_from timestamptz, p_to timestamptz, p_closer uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  d_from date := (p_from at time zone 'America/Sao_Paulo')::date;
  d_to date := (p_to at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  with gasto as (
    select c.campaign_id, c.campaign_name, sum(c.spend) spend
      from crm_meta_ads_campaigns c
     where c.tenant_id is null and c.date_start >= d_from and c.date_start <= d_to
     group by c.campaign_id, c.campaign_name
  ),
  vinculo as (
    select campaign_id, pipeline_id, coalesce(weight, 1) peso,
           coalesce(weight, 1) / nullif(sum(coalesce(weight, 1)) over (partition by campaign_id), 0) fracao
      from crm_meta_campaign_pipelines where tenant_id is null
  ),
  gasto_funil as (
    select v.pipeline_id, sum(g.spend * v.fracao) spend
      from gasto g join vinculo v on v.campaign_id = g.campaign_id
     group by v.pipeline_id
    union all
    select null::uuid, sum(g.spend) from gasto g where not exists (select 1 from vinculo v where v.campaign_id = g.campaign_id)
  ),
  custos as (
    select m.id, m.month, m.label, m.amount_cents / 100.0 valor,
           -- dias do período que caem dentro do mês do lançamento
           greatest(0, (least(d_to, (m.month + interval '1 month' - interval '1 day')::date) - greatest(d_from, m.month)) + 1) dias_no_periodo,
           extract(day from (m.month + interval '1 month' - interval '1 day'))::int dias_do_mes
      from crm_marketing_costs m
     where m.month <= d_to and (m.month + interval '1 month' - interval '1 day')::date >= d_from
  ),
  leads as (
    select l.id, l.pipeline_id, (p_closer is not null and (l.owner_staff_id = p_closer or l.closer_staff_id = p_closer)) do_closer
      from crm_leads l left join crm_stages s on s.id = l.stage_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at <= p_to
       and coalesce(s.exclude_from_lead_count, false) = false
  )
  select jsonb_build_object(
    'meta_spend_total', (select coalesce(sum(spend), 0) from gasto),
    'meta_campaigns', (select coalesce(jsonb_agg(jsonb_build_object('campaign_id', campaign_id, 'nome', campaign_name, 'spend', spend) order by spend desc), '[]'::jsonb) from gasto),
    'meta_spend_by_pipeline', (select coalesce(jsonb_agg(jsonb_build_object('pipeline_id', gf.pipeline_id, 'nome', p.name, 'spend', gf.spend)), '[]'::jsonb)
                                 from gasto_funil gf left join crm_pipelines p on p.id = gf.pipeline_id where gf.spend is not null),
    'meta_last_sync', (select max(synced_at) from crm_meta_ads_campaigns where tenant_id is null),
    'meta_last_day', (select max(date_start) from crm_meta_ads_campaigns where tenant_id is null),
    'manual_costs_total', (select coalesce(sum(valor * dias_no_periodo / dias_do_mes), 0) from custos),
    'manual_costs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'month', month, 'label', label, 'valor_mes', valor, 'valor_rateado', valor * dias_no_periodo / dias_do_mes) order by month, label), '[]'::jsonb) from custos),
    'leads_total', (select count(*) from leads),
    'leads_closer', (select count(*) filter (where do_closer) from leads),
    'leads_by_pipeline', (select coalesce(jsonb_agg(jsonb_build_object('pipeline_id', x.pipeline_id, 'total', x.total, 'closer', x.closer)), '[]'::jsonb)
                            from (select pipeline_id, count(*) total, count(*) filter (where do_closer) closer from leads group by pipeline_id) x),
    'period_days', (d_to - d_from) + 1
  ) into v;
  return v;
end;
$$;
revoke all on function public.crm_investment_summary(timestamptz, timestamptz, uuid) from public;
grant execute on function public.crm_investment_summary(timestamptz, timestamptz, uuid) to authenticated;
