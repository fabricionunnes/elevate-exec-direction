-- Checkup diário do produto (30/09/2026): o que foi marcado como feito/tratado em cada dia.
-- As exceções em si são calculadas na hora pela edge function produto-checkup.
create table if not exists public.produto_checkup_blocos (
  dia date not null,
  bloco text not null,
  feito_por uuid references public.onboarding_staff(id),
  feito_em timestamptz not null default now(),
  nota text,
  pendencias int,
  tratadas int,
  primary key (dia, bloco)
);
create table if not exists public.produto_checkup_itens (
  dia date not null,
  item_key text not null,
  bloco text not null,
  company_id uuid,
  staff_id uuid,
  titulo text,
  tratado_por uuid references public.onboarding_staff(id),
  tratado_em timestamptz not null default now(),
  nota text,
  tarefa_id uuid,
  primary key (dia, item_key)
);
create index if not exists produto_checkup_itens_key_idx on public.produto_checkup_itens (item_key, dia desc);
-- Escrita e leitura só pela edge function (service role): RLS ligado e sem policy.
alter table public.produto_checkup_blocos enable row level security;
alter table public.produto_checkup_itens enable row level security;
revoke all on public.produto_checkup_blocos from anon, authenticated;
revoke all on public.produto_checkup_itens from anon, authenticated;
select 'ok' r;

create or replace function public.produto_checkup_dados()
returns jsonb language sql stable security definer set search_path = public as $fn$
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
emp as (
  select c.id, c.name, c.consultant_id, c.cs_id, c.goal_not_required, c.renewal_plan_type, c.contract_end_date, c.is_billing_blocked,
         st.name consultor,
         (select p.id from onboarding_projects p where p.onboarding_company_id = c.id and p.status in ('active','notice_period') order by p.created_at limit 1) project_id
  from onboarding_companies c left join onboarding_staff st on st.id = c.consultant_id
  where c.status = 'active' and coalesce(c.is_simulator, false) = false
),
proj as (
  select p.id, p.onboarding_company_id cid, p.status, p.product_name, p.contract_end_date, p.cancellation_signal_date, p.cancellation_signal_reason, p.notice_end_date, p.renewal_status
  from onboarding_projects p join emp e on e.id = p.onboarding_company_id where p.status in ('active','notice_period')
),
tarefas as (
  select pr.cid, count(*) n, min(t.due_date) mais_antiga,
         (array_agg(t.title order by t.due_date))[1:3] exemplos,
         mode() within group (order by t.responsible_staff_id) resp
  from onboarding_tasks t join proj pr on pr.id = t.project_id, hoje
  where t.status::text in ('pending','in_progress') and t.due_date < hoje.d
  group by pr.cid
),
kpi_ult as (
  select k.company_id cid, max(k.entry_date) ultimo from kpi_entries k join emp e on e.id = k.company_id group by 1
),
kpi_main as (
  select distinct on (ck.company_id) ck.company_id cid, ck.id kpi_id, ck.name, ck.target_value
  from company_kpis ck join emp e on e.id = ck.company_id
  where ck.is_active and ck.kpi_type = 'monetary'
  order by ck.company_id, ck.is_main_goal desc nulls last, ck.sort_order nulls last
),
kpi_mes as (
  select km.cid, km.name kpi,
    (select coalesce(sum(k.value),0) from kpi_entries k, hoje where k.kpi_id = km.kpi_id and k.entry_date >= date_trunc('month', hoje.d)::date and k.entry_date <= hoje.d) realizado,
    coalesce((select max(t.target_value) from kpi_monthly_targets t, hoje where t.kpi_id = km.kpi_id and t.month_year = to_char(hoje.d,'YYYY-MM') and t.salesperson_id is null and coalesce(t.level_order,1) = 1), km.target_value, 0) meta
  from kpi_main km
),
reun_pend as (
  select pr.cid, count(*) n, min(m.meeting_date) mais_antiga, (array_agg(m.meeting_title order by m.meeting_date))[1:3] titulos,
         mode() within group (order by m.staff_id) resp
  from onboarding_meeting_notes m join proj pr on pr.id = m.project_id
  where coalesce(m.is_finalized,false) = false and coalesce(m.is_internal,false) = false
    and m.meeting_date < now() - interval '3 hours' and m.meeting_date > now() - interval '30 days'
  group by pr.cid
),
reun_noshow as (
  select pr.cid, count(*) n, max(m.meeting_date) ultima from onboarding_meeting_notes m join proj pr on pr.id = m.project_id
  where m.is_no_show and m.meeting_date > now() - interval '7 days' group by pr.cid
),
reun_ult as (
  select pr.cid, max(m.meeting_date) filter (where m.meeting_date <= now() and coalesce(m.is_no_show,false) = false) ultima,
         min(m.meeting_date) filter (where m.meeting_date > now()) proxima
  from onboarding_meeting_notes m join proj pr on pr.id = m.project_id where coalesce(m.is_internal,false) = false group by pr.cid
),
nps_baixo as (
  select pr.cid, n.score, n.created_at, left(coalesce(n.what_can_improve, n.feedback, ''), 200) texto, n.respondent_name
  from onboarding_nps_responses n join proj pr on pr.id = n.project_id where n.created_at > now() - interval '30 days' and n.score <= 6
),
csat_baixo as (
  select pr.cid, r.score, r.responded_at, left(coalesce(r.feedback,''), 200) texto, r.respondent_name
  from csat_responses r join proj pr on pr.id = r.project_id where coalesce(r.responded_at, r.created_at) > now() - interval '14 days' and r.score <= 3
),
saude as (
  select distinct on (h.project_id) pr.cid, h.total_score, h.risk_level, h.trend_direction
  from client_health_scores h join proj pr on pr.id = h.project_id order by h.project_id, h.updated_at desc
),
fin as (
  select i.company_id cid, count(*) n, sum(i.amount_cents) total_cents, min(i.due_date) mais_antiga
  from company_invoices i join emp e on e.id = i.company_id, hoje
  where i.status::text in ('overdue','pending') and i.due_date < hoje.d group by 1
)
select jsonb_build_object(
  'dia', (select d from hoje),
  'empresas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', name, 'consultant_id', consultant_id, 'consultor', consultor, 'project_id', project_id, 'sem_meta', goal_not_required)), '[]') from emp),
  'tarefas', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'n', n, 'mais_antiga', mais_antiga, 'exemplos', exemplos, 'resp', resp) order by n desc), '[]') from tarefas),
  'kpi_sem_lancar', (select coalesce(jsonb_agg(jsonb_build_object('company_id', e.id, 'ultimo', u.ultimo)), '[]')
      from emp e left join kpi_ult u on u.cid = e.id, hoje
      where coalesce(e.goal_not_required,false) = false and exists (select 1 from company_kpis ck where ck.company_id = e.id and ck.is_active)
        and (u.ultimo is null or u.ultimo < hoje.d - 4)),
  'kpi_mes', (select coalesce(jsonb_agg(jsonb_build_object('company_id', m.cid, 'kpi', m.kpi, 'realizado', m.realizado, 'meta', m.meta)), '[]')
      from kpi_mes m join emp e on e.id = m.cid where coalesce(e.goal_not_required,false) = false and m.meta > 0),
  'reunioes_pendentes', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'n', n, 'mais_antiga', mais_antiga, 'titulos', titulos, 'resp', resp)), '[]') from reun_pend),
  'no_show', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'n', n, 'ultima', ultima)), '[]') from reun_noshow),
  'sem_reuniao', (select coalesce(jsonb_agg(jsonb_build_object('company_id', e.id, 'ultima', r.ultima)), '[]')
      from emp e left join reun_ult r on r.cid = e.id
      where (r.ultima is null or r.ultima < now() - interval '30 days') and r.proxima is null),
  'nps', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'score', score, 'quando', created_at, 'texto', texto, 'quem', respondent_name)), '[]') from nps_baixo),
  'csat', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'score', score, 'quando', responded_at, 'texto', texto, 'quem', respondent_name)), '[]') from csat_baixo),
  'saude', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'score', total_score, 'risco', risk_level, 'tendencia', trend_direction)), '[]') from saude where risk_level in ('critical','at_risk')),
  'sinal_cancelamento', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'status', status, 'quando', cancellation_signal_date, 'motivo', cancellation_signal_reason, 'fim_aviso', notice_end_date, 'produto', product_name)), '[]')
      from proj where status = 'notice_period' or cancellation_signal_date > now() - interval '30 days'),
  'renovacao', (select coalesce(jsonb_agg(jsonb_build_object('company_id', pr.cid, 'produto', pr.product_name, 'fim', coalesce(pr.contract_end_date, e.contract_end_date), 'plano', e.renewal_plan_type, 'status_renovacao', pr.renewal_status)), '[]')
      from proj pr join emp e on e.id = pr.cid, hoje
      where coalesce(e.renewal_plan_type,'') <> 'monthly' and coalesce(pr.contract_end_date, e.contract_end_date) is not null
        and coalesce(pr.contract_end_date, e.contract_end_date) <= hoje.d + 45 and coalesce(pr.renewal_status,'') not in ('renewed','renovado')),
  'financeiro', (select coalesce(jsonb_agg(jsonb_build_object('company_id', cid, 'n', n, 'total_cents', total_cents, 'mais_antiga', mais_antiga) order by total_cents desc), '[]') from fin),
  'bloqueadas', (select coalesce(jsonb_agg(jsonb_build_object('company_id', id)), '[]') from emp where is_billing_blocked),
  'staff', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', name, 'role', role)), '[]') from onboarding_staff where is_active)
);
$fn$;
revoke all on function public.produto_checkup_dados() from public, anon, authenticated;
grant execute on function public.produto_checkup_dados() to service_role;
select jsonb_object_agg(k, case when jsonb_typeof(v)='array' then to_jsonb(jsonb_array_length(v)) else v end) resumo
from jsonb_each(public.produto_checkup_dados()) as t(k,v);
