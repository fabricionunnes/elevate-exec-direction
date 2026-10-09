-- Menu Negócios e título "Negócios da origem" mostram a ORIGEM, não o funil. 28 das 33 origens
-- nascem com o mesmo nome do funil, então renomear o funil deixava o menu com o nome velho
-- (caso "Mansão Empreendedora (Outubro)" → "ME Outubro (Kart)", 09/10/2026). Agora a origem
-- ligada ao funil, que ainda tinha o nome antigo dele, acompanha a troca.
CREATE OR REPLACE FUNCTION public.crm_pipeline_rename_sync_origin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if NEW.name is distinct from OLD.name then
    update crm_origins o set name = NEW.name
    where o.pipeline_id = NEW.id and o.name = OLD.name
      and not exists (select 1 from crm_origins o2 where o2.id <> o.id and o2.name = NEW.name);
  end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_crm_pipeline_rename_sync_origin ON public.crm_pipelines;
CREATE TRIGGER trg_crm_pipeline_rename_sync_origin
AFTER UPDATE OF name ON public.crm_pipelines
FOR EACH ROW EXECUTE FUNCTION public.crm_pipeline_rename_sync_origin();
