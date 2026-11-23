-- Segurança, etapa 2 (parte 1): fatura pública e link de pagamento.
-- Antes: qualquer visitante lia TODAS as faturas e TODOS os links de pagamento
-- direto na tabela. Agora a página pública lê só o próprio registro, por função.

-- Guarda a posição anterior das regras que esta etapa mexe (pra desfazer).
create table if not exists public.zz_rls_etapa2_20261123 (
  guardado_em timestamptz not null default now(),
  tablename text not null,
  policyname text not null,
  permissive text,
  cmd text,
  roles text[],
  qual text,
  with_check text
);
alter table public.zz_rls_etapa2_20261123 enable row level security;
revoke all on public.zz_rls_etapa2_20261123 from anon, authenticated;

insert into public.zz_rls_etapa2_20261123 (tablename, policyname, permissive, cmd, roles, qual, with_check)
select p.tablename, p.policyname, p.permissive, p.cmd, p.roles::text[], p.qual, p.with_check
from pg_policies p
where p.schemaname = 'public'
  and ((p.tablename = 'company_invoices' and p.policyname = 'Public access by token')
    or (p.tablename = 'payment_links' and p.policyname in ('Public can view payment links by id', 'Anyone can insert payment links')))
  and not exists (select 1 from public.zz_rls_etapa2_20261123 z where z.tablename = p.tablename and z.policyname = p.policyname);

-- 1) Fatura pública: só os campos que a página mostra, e só da fatura do token.
create or replace function public.public_invoice_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id,
    'description', i.description,
    'amount_cents', i.amount_cents,
    'due_date', i.due_date,
    'status', i.status,
    'late_fee_cents', i.late_fee_cents,
    'interest_cents', i.interest_cents,
    'total_with_fees_cents', i.total_with_fees_cents,
    'payment_link_url', i.payment_link_url,
    'installment_number', i.installment_number,
    'total_installments', i.total_installments,
    'paid_at', i.paid_at,
    'paid_amount_cents', i.paid_amount_cents,
    'late_fee_percent', i.late_fee_percent,
    'daily_interest_percent', i.daily_interest_percent
  )
  from public.company_invoices i
  where p_token is not null
    and length(p_token) >= 16
    and i.public_token = p_token
  limit 1
$$;
revoke all on function public.public_invoice_get(text) from public;
grant execute on function public.public_invoice_get(text) to anon, authenticated, service_role;

drop policy if exists "Public access by token" on public.company_invoices;

-- 2) Link de pagamento: o checkout lê só o link do endereço.
create or replace function public.payment_link_get(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', l.id,
    'description', l.description,
    'amount_cents', l.amount_cents,
    'payment_method', l.payment_method,
    'installments', l.installments,
    'provider', l.provider
  )
  from public.payment_links l
  where p_id is not null
    and length(p_id) = 36
    and l.id::text = lower(p_id)
  limit 1
$$;
revoke all on function public.payment_link_get(text) from public;
grant execute on function public.payment_link_get(text) to anon, authenticated, service_role;

drop policy if exists "Public can view payment links by id" on public.payment_links;

-- Criar link: só a equipe logada (as funções do servidor não passam por aqui).
drop policy if exists "Anyone can insert payment links" on public.payment_links;
drop policy if exists "Equipe cria links de pagamento" on public.payment_links;
create policy "Equipe cria links de pagamento" on public.payment_links
  for insert to authenticated
  with check ((select public.gv_is_staff()) or created_by = auth.uid());
