-- Funil Expansão: lead herda os dados cadastrais da empresa (CNPJ, email,
-- endereço, cidade/UF/CEP) além do Instagram, pra aba Empresa vir preenchida.
create or replace function expansion_on_won()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_final text;
  v_exp_origin uuid;
  v_exp_pipeline uuid;
  v_exp_stage uuid;
  v_origin_name text;
  v_digits text;
  v_co onboarding_companies%rowtype;
begin
  if new.stage_id is null or new.stage_id = old.stage_id then return new; end if;
  select final_type into v_final from crm_stages where id = new.stage_id;
  if v_final is distinct from 'won' then return new; end if;
  if new.tenant_id is not null then return new; end if;

  select id, pipeline_id into v_exp_origin, v_exp_pipeline
  from crm_origins where name = 'Expansão — Clientes' limit 1;
  if v_exp_origin is null or new.origin_id = v_exp_origin then return new; end if;

  select id into v_exp_stage from crm_stages
  where pipeline_id = v_exp_pipeline and sort_order = 0 limit 1;
  if v_exp_stage is null then return new; end if;

  v_digits := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 8);
  if exists (
    select 1 from crm_leads l
    join crm_stages s on s.id = l.stage_id
    where l.origin_id = v_exp_origin
      and coalesce(s.final_type, '') = ''
      and (
        (v_digits <> '' and right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) = v_digits)
        or lower(l.name) = lower(new.name)
      )
  ) then return new; end if;

  select name into v_origin_name from crm_origins where id = new.origin_id;

  -- Empresa correspondente no Nexus (por nome/telefone) pra herdar cadastro
  select c.* into v_co
  from onboarding_companies c
  where lower(c.name) = lower(new.company)
     or lower(c.name) = lower(new.name)
     or (v_digits <> '' and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 8) = v_digits)
  order by (c.status = 'active') desc
  limit 1;

  insert into crm_leads (
    name, phone, email, company, segment, instagram, document,
    address, address_number, address_neighborhood, city, state, zipcode,
    origin_id, pipeline_id, stage_id, owner_staff_id,
    origin, notes, entered_pipeline_at, stage_entered_at
  ) values (
    new.name,
    coalesce(nullif(trim(coalesce(new.phone,'')),''), nullif(trim(coalesce(v_co.phone,'')),'')),
    coalesce(nullif(trim(coalesce(new.email,'')),''), nullif(trim(coalesce(v_co.email,'')),'')),
    new.company, new.segment,
    coalesce(nullif(trim(coalesce(new.instagram,'')),''), nullif(trim(coalesce(v_co.instagram,'')),'')),
    coalesce(nullif(trim(coalesce(new.document,'')),''), nullif(trim(coalesce(v_co.cnpj,'')),'')),
    coalesce(nullif(trim(coalesce(new.address,'')),''), nullif(trim(coalesce(v_co.address,'')),'')),
    coalesce(nullif(trim(coalesce(new.address_number,'')),''), nullif(trim(coalesce(v_co.address_number,'')),'')),
    coalesce(nullif(trim(coalesce(new.address_neighborhood,'')),''), nullif(trim(coalesce(v_co.address_neighborhood,'')),'')),
    coalesce(nullif(trim(coalesce(new.city,'')),''), nullif(trim(coalesce(v_co.address_city,'')),'')),
    coalesce(nullif(trim(coalesce(new.state,'')),''), nullif(trim(coalesce(v_co.address_state,'')),'')),
    coalesce(nullif(trim(coalesce(new.zipcode,'')),''), nullif(trim(coalesce(v_co.address_zipcode,'')),'')),
    v_exp_origin, v_exp_pipeline, v_exp_stage,
    coalesce(new.closer_staff_id, new.owner_staff_id),
    'expansao_automatica',
    'Cliente ganho no funil ' || coalesce(v_origin_name, '?') || ' em ' ||
      to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') ||
      coalesce('. Valor do fechamento: R$ ' || to_char(new.opportunity_value, 'FM999G999G990D00'), '') ||
      '. Trabalhar oferta dos demais serviços UNV.',
    now(), now()
  );
  return new;
end;
$$;
