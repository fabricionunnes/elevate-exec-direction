-- Conversa perdia o número quando a instância era apagada e recriada (FK ON DELETE SET NULL): 1.170
-- conversas sem instância em 13/10/2026, a tela do lead mostrava só "WhatsApp". Agora a conversa guarda
-- o nome da instância ao ser apagada e religa sozinha quando uma instância com o mesmo nome volta.
ALTER TABLE public.crm_whatsapp_conversations ADD COLUMN IF NOT EXISTS orphan_instance_name text;

CREATE OR REPLACE FUNCTION public.wa_instance_before_delete_stash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update crm_whatsapp_conversations set orphan_instance_name = OLD.instance_name where instance_id = OLD.id;
  return OLD;
end $$;
DROP TRIGGER IF EXISTS trg_wa_instance_before_delete_stash ON public.whatsapp_instances;
CREATE TRIGGER trg_wa_instance_before_delete_stash BEFORE DELETE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.wa_instance_before_delete_stash();

CREATE OR REPLACE FUNCTION public.wa_instance_after_insert_relink()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update crm_whatsapp_conversations set instance_id = NEW.id, orphan_instance_name = null
   where instance_id is null and official_instance_id is null and orphan_instance_name = NEW.instance_name;
  -- vínculos de agente e acesso que apontavam pro id antigo da mesma instância (nome igual) seguem o novo id
  update crm_ai_agent_channels ch set instance_id = NEW.id
   where ch.instance_id is not null and not exists (select 1 from whatsapp_instances i where i.id = ch.instance_id)
     and ch.instance_id in (select old_id from wa_instance_renames where instance_name = NEW.instance_name);
  return NEW;
end $$;
CREATE TABLE IF NOT EXISTS public.wa_instance_renames (instance_name text, old_id uuid, deleted_at timestamptz default now());
CREATE OR REPLACE FUNCTION public.wa_instance_before_delete_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin insert into wa_instance_renames (instance_name, old_id) values (OLD.instance_name, OLD.id); return OLD; end $$;
DROP TRIGGER IF EXISTS trg_wa_instance_before_delete_log ON public.whatsapp_instances;
CREATE TRIGGER trg_wa_instance_before_delete_log BEFORE DELETE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.wa_instance_before_delete_log();
DROP TRIGGER IF EXISTS trg_wa_instance_after_insert_relink ON public.whatsapp_instances;
CREATE TRIGGER trg_wa_instance_after_insert_relink AFTER INSERT ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.wa_instance_after_insert_relink();
-- a instância da Natália já foi apagada hoje (id 95278a26…): registra o id antigo pra religar o agente quando voltar
INSERT INTO public.wa_instance_renames (instance_name, old_id) VALUES ('natalia-amador', '95278a26-7618-4b19-8f8c-67c925b733e5');
