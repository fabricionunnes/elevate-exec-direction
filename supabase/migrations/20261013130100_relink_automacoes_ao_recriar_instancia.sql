-- Ao recriar uma instância com o mesmo nome, as regras de Automação que citavam o id antigo passam a citar o novo.
CREATE OR REPLACE FUNCTION public.wa_instance_after_insert_relink()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare r record;
begin
  update crm_whatsapp_conversations set instance_id = NEW.id, orphan_instance_name = null
   where instance_id is null and official_instance_id is null and orphan_instance_name = NEW.instance_name;
  for r in select old_id from wa_instance_renames where instance_name = NEW.instance_name and old_id <> NEW.id loop
    update crm_ai_agent_channels ch set instance_id = NEW.id where ch.instance_id = r.old_id;
    update whatsapp_instance_access a set instance_id = NEW.id where a.instance_id = r.old_id;
    update crm_automations set conditions = replace(conditions::text, r.old_id::text, NEW.id::text)::jsonb
     where conditions::text like '%' || r.old_id::text || '%';
  end loop;
  return NEW;
end $$;
