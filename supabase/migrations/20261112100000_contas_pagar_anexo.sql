-- Boleto/anexo nas contas a pagar (Fabrício, 12/11/2026: "aqui quero poder anexar o boleto")
alter table public.financial_payables add column if not exists attachment_path text, add column if not exists attachment_name text;
insert into storage.buckets (id, name, public, file_size_limit) values ('financial-attachments', 'financial-attachments', false, 15728640)
on conflict (id) do nothing;
-- só quem tem o menu Financeiro (ou é master) enxerga e mexe nos anexos
create or replace function public.pode_anexo_financeiro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active
                 and public.staff_has_menu_permission(s.id, 'financial'))
$$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Financeiro le anexos') then
    create policy "Financeiro le anexos" on storage.objects for select using (bucket_id = 'financial-attachments' and public.pode_anexo_financeiro());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Financeiro envia anexos') then
    create policy "Financeiro envia anexos" on storage.objects for insert with check (bucket_id = 'financial-attachments' and public.pode_anexo_financeiro());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Financeiro apaga anexos') then
    create policy "Financeiro apaga anexos" on storage.objects for delete using (bucket_id = 'financial-attachments' and public.pode_anexo_financeiro());
  end if;
end $$;
select 'ok' r;
