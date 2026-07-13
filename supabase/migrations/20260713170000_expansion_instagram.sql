-- Funil Expansão: lead herda o Instagram da empresa (onboarding_companies)
-- quando o lead ganho não tem o campo. Vale pro trigger de ganho automático.
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
  v_instagram text;
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

  -- Instagram: usa o do lead ganho; se vazio, busca na empresa cadastrada
  v_instagram := nullif(trim(coalesce(new.instagram, '')), '');
  if v_instagram is null then
    select nullif(trim(c.instagram), '') into v_instagram
    from onboarding_companies c
    where lower(c.name) = lower(new.company)
       or lower(c.name) = lower(new.name)
       or (v_digits <> '' and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 8) = v_digits)
    order by (c.status = 'active') desc
    limit 1;
  end if;

  insert into crm_leads (
    name, phone, email, company, segment, instagram, city, state,
    origin_id, pipeline_id, stage_id, owner_staff_id,
    origin, notes, entered_pipeline_at, stage_entered_at
  ) values (
    new.name, new.phone, new.email, new.company, new.segment, v_instagram, new.city, new.state,
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
