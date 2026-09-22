-- Nexus não tinha o gatilho que o UNV Sales já tem há tempos: quando um lead
-- nasce com pipeline_id mas sem origin_id (ou com origem de outro funil), a
-- tela de Negócios filtra por origem e o lead some — mesmo estando no banco,
-- na etapa certa. Aconteceu com os leads da Prospecção B2B.
create or replace function public.crm_lead_fix_origin()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_origin_pipeline uuid;
begin
  if new.pipeline_id is not null then
    if new.origin_id is not null then
      select pipeline_id into v_origin_pipeline from crm_origins where id = new.origin_id;
    end if;
    if new.origin_id is null or v_origin_pipeline is distinct from new.pipeline_id then
      select id into new.origin_id from crm_origins
       where pipeline_id = new.pipeline_id and is_active
       order by sort_order nulls last, created_at limit 1;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_crm_lead_fix_origin on public.crm_leads;
create trigger trg_crm_lead_fix_origin before insert or update of pipeline_id, origin_id on public.crm_leads
  for each row execute function public.crm_lead_fix_origin();

-- conserta os leads da Prospecção B2B que já ficaram órfãos de origem
update public.crm_leads l set origin_id = (
  select id from crm_origins where pipeline_id = l.pipeline_id and is_active
  order by sort_order nulls last, created_at limit 1
) where l.origin_id is null and l.pipeline_id is not null
  and exists (select 1 from crm_origins o where o.pipeline_id = l.pipeline_id);
