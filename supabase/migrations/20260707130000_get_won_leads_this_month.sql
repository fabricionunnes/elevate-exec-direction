-- Dashboard Head Comercial chamava supabase.rpc("get_won_leads_this_month"),
-- mas a função nunca existia no banco -> a chamada falhava e o "Realizado"/
-- contagem de vendas ficava sempre R$ 0 / 0 pra todos os closers.
-- Retorna, por closer (fallback owner), o valor e a qtd de leads GANHOS fechados
-- no mês corrente (fuso America/Sao_Paulo).
create or replace function get_won_leads_this_month()
returns table(staff_id uuid, total_value numeric, total_won bigint)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select date_trunc('month', (now() at time zone 'America/Sao_Paulo')) as m_start,
           date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month' as m_end
  )
  select coalesce(l.closer_staff_id, l.owner_staff_id) as staff_id,
         sum(coalesce(l.opportunity_value, 0))::numeric as total_value,
         count(*)::bigint as total_won
  from crm_leads l
  join crm_stages s on s.id = l.stage_id, b
  where s.final_type = 'won'
    and coalesce(l.closed_at, l.updated_at) is not null
    and (coalesce(l.closed_at, l.updated_at) at time zone 'America/Sao_Paulo') >= b.m_start
    and (coalesce(l.closed_at, l.updated_at) at time zone 'America/Sao_Paulo') < b.m_end
    and coalesce(l.closer_staff_id, l.owner_staff_id) is not null
  group by coalesce(l.closer_staff_id, l.owner_staff_id);
$$;

grant execute on function get_won_leads_this_month() to authenticated, anon, service_role;
