-- Contas bancárias: ordem escolhida pelo Fabrício e qual é a principal (16/10/2026).
alter table public.financial_banks
  add column if not exists sort_order int,
  add column if not exists is_main boolean not null default false;
-- ordem inicial = a de hoje (por nome)
with o as (select id, row_number() over (order by name) n from financial_banks where sort_order is null)
update financial_banks b set sort_order = o.n from o where o.id = b.id;
-- só uma principal
create unique index if not exists financial_banks_uma_principal on public.financial_banks (is_main) where is_main;

create or replace function public.financial_banks_reordenar(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then raise exception 'Só o time UNV'; end if;
  update financial_banks b set sort_order = x.n from unnest(p_ids) with ordinality x(id, n) where b.id = x.id;
end $$;
create or replace function public.financial_banks_principal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then raise exception 'Só o time UNV'; end if;
  update financial_banks set is_main = false where is_main;
  update financial_banks set is_main = true where id = p_id;
end $$;
revoke all on function public.financial_banks_reordenar(uuid[]) from public, anon;
revoke all on function public.financial_banks_principal(uuid) from public, anon;
grant execute on function public.financial_banks_reordenar(uuid[]) to authenticated;
grant execute on function public.financial_banks_principal(uuid) to authenticated;
