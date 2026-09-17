-- Segurança 18/09/2026: o formulário público de dados do contrato lia/alterava crm_leads direto, e a regra
-- liberava TODO lead que tivesse token (sem conferir qual). Passa a usar funções que exigem o token do link.
create or replace function public.contract_form_get(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'name', l.name, 'company', l.company, 'trade_name', l.trade_name,
    'document', l.document, 'email', l.email, 'phone', l.phone, 'legal_representative_name', l.legal_representative_name,
    'cpf', l.cpf, 'rg', l.rg, 'marital_status', l.marital_status, 'address', l.address, 'address_number', l.address_number,
    'address_complement', l.address_complement, 'address_neighborhood', l.address_neighborhood,
    'city', l.city, 'state', l.state, 'zipcode', l.zipcode)
  from crm_leads l
  where length(coalesce(p_token,'')) >= 12 and l.contract_form_token = p_token
  limit 1;
$$;

create or replace function public.contract_form_save(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_company uuid; v_addr text;
  d jsonb := coalesce(p_data, '{}'::jsonb);
begin
  if length(coalesce(p_token,'')) < 12 or length(d::text) > 20000 then return jsonb_build_object('ok', false); end if;
  update crm_leads l set
    company = nullif(d->>'company',''), trade_name = nullif(d->>'trade_name',''), document = nullif(d->>'document',''),
    email = nullif(d->>'email',''), phone = nullif(d->>'phone',''),
    legal_representative_name = nullif(d->>'legal_representative_name',''), cpf = nullif(d->>'cpf',''), rg = nullif(d->>'rg',''),
    marital_status = nullif(d->>'marital_status',''), address = nullif(d->>'address',''),
    address_number = nullif(d->>'address_number',''), address_complement = nullif(d->>'address_complement',''),
    address_neighborhood = nullif(d->>'address_neighborhood',''), city = nullif(d->>'city',''),
    state = nullif(d->>'state',''), zipcode = nullif(d->>'zipcode','')
  where l.contract_form_token = p_token
  returning l.id into v_lead;
  if v_lead is null then return jsonb_build_object('ok', false); end if;

  -- espelha na aba Empresa do lead (campos personalizados)
  insert into crm_custom_field_values (lead_id, field_id, value)
  select v_lead, m.field_id, btrim(m.val)
  from (values
    ('7b67f652-0241-4ce4-a0a1-55f662156798'::uuid, d->>'company'),
    ('b3466b71-9393-421f-9de6-5f3e78a64d75'::uuid, d->>'document'),
    ('2625e412-c60b-44b2-9b95-9ffb4206ba3b'::uuid, d->>'phone'),
    ('80a12445-cd5e-41ad-a3ec-41990b2dd2ff'::uuid, d->>'email'),
    ('dd91421b-6808-421b-b7b4-da7e81d87702'::uuid, d->>'city'),
    ('e26503ad-13b4-41fd-9e7b-bc5b8efee7af'::uuid, d->>'state'),
    ('244d8391-d3ca-4b59-b343-68809511076a'::uuid, d->>'zipcode')
  ) m(field_id, val)
  where btrim(coalesce(m.val,'')) <> '' and exists (select 1 from crm_custom_fields f where f.id = m.field_id)
  on conflict (lead_id, field_id) do update set value = excluded.value;

  -- espelha na empresa vinculada ao lead, se já existir projeto
  select p.onboarding_company_id into v_company from onboarding_projects p
  where p.crm_lead_id = v_lead and p.onboarding_company_id is not null limit 1;
  if v_company is not null then
    v_addr := nullif(concat_ws(', ', nullif(d->>'address',''), nullif(d->>'address_number',''), nullif(d->>'address_complement','')), '');
    update onboarding_companies c set
      cnpj = nullif(d->>'document',''), name = coalesce(nullif(d->>'company',''), c.name), address = v_addr,
      address_number = nullif(d->>'address_number',''), address_complement = nullif(d->>'address_complement',''),
      address_neighborhood = nullif(d->>'address_neighborhood',''), address_zipcode = nullif(d->>'zipcode',''),
      address_city = nullif(d->>'city',''), address_state = nullif(d->>'state',''),
      phone = nullif(d->>'phone',''), email = nullif(d->>'email',''),
      owner_name = nullif(d->>'legal_representative_name',''), owner_cpf = nullif(d->>'cpf',''),
      owner_rg = nullif(d->>'rg',''), owner_marital_status = nullif(d->>'marital_status','')
    where c.id = v_company;
  end if;
  return jsonb_build_object('ok', true, 'lead_id', v_lead);
end $$;

revoke all on function public.contract_form_get(text) from public;
revoke all on function public.contract_form_save(text, jsonb) from public;
grant execute on function public.contract_form_get(text) to anon, authenticated, service_role;
grant execute on function public.contract_form_save(text, jsonb) to anon, authenticated, service_role;
