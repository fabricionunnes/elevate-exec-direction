-- Cadastro de funcionário (staff_registrations: CPF, RG, endereço, conta bancária, PIX) estava aberto pra
-- qualquer visitante: regra "Anyone can view by token" com USING (true) deixava ler TODOS os cadastros com a
-- chave pública do site (aviso externo de 23/11/2026, confirmado). A página pública passa a ler e gravar só
-- pelo token do link, por função; a tabela fica só pra equipe (ver a migração seguinte).
create or replace function public.staff_registration_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select to_jsonb(r) - 'token' from staff_registrations r
   where length(coalesce(p_token, '')) >= 32 and r.token = p_token
   limit 1;
$$;

create or replace function public.staff_registration_submit(p_token text, p_form jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid; f jsonb := coalesce(p_form, '{}'::jsonb);
begin
  if length(coalesce(p_token, '')) < 32 then raise exception 'link inválido'; end if;
  update staff_registrations r set
    full_name = nullif(f->>'full_name', ''), email = nullif(f->>'email', ''), phone = nullif(f->>'phone', ''),
    cpf = nullif(f->>'cpf', ''), rg = nullif(f->>'rg', ''),
    birth_date = case when coalesce(f->>'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}' then left(f->>'birth_date', 10)::date else r.birth_date end,
    cep = nullif(f->>'cep', ''), street = nullif(f->>'street', ''), address_number = nullif(f->>'address_number', ''),
    complement = nullif(f->>'complement', ''), neighborhood = nullif(f->>'neighborhood', ''), city = nullif(f->>'city', ''),
    state = nullif(f->>'state', ''), bank_name = nullif(f->>'bank_name', ''), bank_agency = nullif(f->>'bank_agency', ''),
    bank_account = nullif(f->>'bank_account', ''), bank_account_type = nullif(f->>'bank_account_type', ''),
    pix_key = nullif(f->>'pix_key', ''), cnpj = nullif(f->>'cnpj', ''), company_name = nullif(f->>'company_name', ''),
    trade_name = nullif(f->>'trade_name', ''), municipal_registration = nullif(f->>'municipal_registration', ''),
    status = 'submitted', submitted_at = now(), updated_at = now()
  where r.token = p_token and r.status = 'pending'
  returning r.id into v_id;
  if v_id is null then raise exception 'link inválido ou cadastro já enviado'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.staff_registration_get(text) from public;
revoke all on function public.staff_registration_submit(text, jsonb) from public;
grant execute on function public.staff_registration_get(text) to anon, authenticated;
grant execute on function public.staff_registration_submit(text, jsonb) to anon, authenticated;
