-- v2: o caso "PALESTRA" → funil "Palestras" não casou porque a comparação era exata (caixa/acentos).
-- Agora: origem ligada ao funil cujo nome bate com o nome antigo ignorando caixa e espaços
-- acompanha; se nenhuma bater e o funil tiver UMA só origem ativa, ela acompanha também.
CREATE OR REPLACE FUNCTION public.crm_pipeline_rename_sync_origin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare n int;
begin
  if NEW.name is distinct from OLD.name then
    update crm_origins o set name = NEW.name
    where o.pipeline_id = NEW.id and o.name <> NEW.name
      and lower(btrim(o.name)) = lower(btrim(coalesce(OLD.name, '')))
      and not exists (select 1 from crm_origins o2 where o2.id <> o.id and o2.name = NEW.name);
    get diagnostics n = row_count;
    if n = 0 and (select count(*) from crm_origins o where o.pipeline_id = NEW.id and o.is_active) = 1 then
      update crm_origins o set name = NEW.name
      where o.pipeline_id = NEW.id and o.is_active and o.name <> NEW.name
        and not exists (select 1 from crm_origins o2 where o2.id <> o.id and o2.name = NEW.name);
    end if;
  end if;
  return NEW;
end $$;
