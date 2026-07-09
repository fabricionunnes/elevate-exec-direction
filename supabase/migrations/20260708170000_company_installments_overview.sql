-- Aba "Parcelas" na tela inicial do staff: por empresa ativa, quem tem parcelas
-- mensais a receber (company_invoices pendentes/vencidas), quantas pagas/restam,
-- valor em aberto e próximo vencimento. Quem não tem fatura = pagamento fora do
-- sistema (cartão na operadora) ou cobrança não configurada.
-- RPC agregada no servidor (1 linha por empresa — sem cap de 1000 linhas do PostgREST).
create or replace function get_company_installments_overview()
returns table(
  company_id uuid,
  company_name text,
  payment_method text,
  contract_value numeric,
  total_installments int,
  paid_count bigint,
  open_count bigint,
  open_amount_cents bigint,
  overdue_count bigint,
  next_due date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.payment_method,
    c.contract_value,
    max(i.total_installments) filter (where i.total_installments is not null)::int,
    count(i.id) filter (where i.status = 'paid'),
    count(i.id) filter (where i.status in ('pending','overdue')),
    coalesce(sum(i.amount_cents) filter (where i.status in ('pending','overdue')), 0)::bigint,
    count(i.id) filter (where i.status = 'overdue'),
    min(i.due_date) filter (where i.status in ('pending','overdue'))
  from onboarding_companies c
  left join company_invoices i on i.company_id = c.id
  where c.status = 'active'
    -- só staff ativo enxerga (a RPC é security definer)
    and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active = true)
  group by c.id, c.name, c.payment_method, c.contract_value
  order by c.name;
$$;

grant execute on function get_company_installments_overview() to authenticated;
