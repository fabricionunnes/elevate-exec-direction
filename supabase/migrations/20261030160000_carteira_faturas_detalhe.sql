-- Detalhe de faturas pra quando o master clica em Faturado ou Inadimplencia na
-- Carteira. Mesma regra de quem enxerga o que: consultor so ve as empresas
-- dele, master e admin veem todas e podem filtrar.

drop function if exists public.carteira_faturas(uuid, text);

create or replace function public.carteira_faturas(
  p_consultant_id uuid default null,
  p_mes text default null
)
returns table (
  company_id uuid,
  company_name text,
  consultant_name text,
  descricao text,
  valor_cents bigint,
  vencimento date,
  status text,
  pago_em date,
  dias_atraso int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  uuid;
  v_role   text;
  v_filter uuid;
  v_ini    date;
begin
  select s.id, s.role into v_staff, v_role
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  if v_role in ('master', 'admin') then
    v_filter := p_consultant_id;
  else
    v_filter := v_staff;
  end if;

  v_ini := coalesce(to_date(nullif(p_mes, ''), 'YYYY-MM'), date_trunc('month', current_date)::date);

  return query
  with empresas as (
    select distinct p.onboarding_company_id as cid, p.consultant_id as sid
      from onboarding_projects p
     where p.tenant_id is null
       and p.consultant_id is not null
       and p.status in ('active', 'cancellation_signaled', 'notice_period')
       and (v_filter is null or p.consultant_id = v_filter)
  )
  select c.id,
         c.name::text,
         st.name::text,
         coalesce(i.description, 'Mensalidade')::text,
         i.amount_cents::bigint,
         i.due_date,
         (case when i.paid_at is not null then 'pago'
               when i.due_date < current_date then 'vencido'
               else 'a vencer' end)::text,
         i.paid_at::date,
         (case when i.paid_at is null and i.due_date < current_date
               then (current_date - i.due_date)::int end)
    from company_invoices i
    join empresas e on e.cid = i.company_id
    join onboarding_companies c on c.id = i.company_id
    left join onboarding_staff st on st.id = e.sid
   where i.due_date >= v_ini
     and i.due_date < v_ini + interval '1 month'
     and coalesce(c.is_simulator, false) = false
   order by i.due_date, c.name;
end
$$;

revoke all on function public.carteira_faturas(uuid, text) from public;
grant execute on function public.carteira_faturas(uuid, text) to authenticated;
