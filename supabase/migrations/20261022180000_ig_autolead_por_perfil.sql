insert into crm_tags (name, color, is_active)
select 'Instagram', '#E1306C', true where not exists (select 1 from crm_tags where name = 'Instagram');

-- Quem chama no direct vira lead automaticamente. Até aqui todo perfil ia pro Funil SS; o
-- @socialcomcarol (Carol Souza, UNV Social) passa a mandar pro funil Social Media, etapa
-- Novo Lead, origem Social Media, onde atende o agente "Social Selling - Carol" (22/10/2026).
create or replace function public.ig_conversation_autolead()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_contact record;
  v_lead uuid;
  v_origin uuid;
  v_pipeline uuid := '4f7bee20-15a3-4612-8085-c2ef9796ee6d'; -- Funil SS
  v_stage uuid := 'b62fe94f-284e-4b61-8fb3-d4ae3ebeec9e';
begin
  if NEW.lead_id is not null then return NEW; end if;
  begin
    select name, username, instagram_user_id into v_contact from instagram_contacts where id = NEW.contact_id;
    if NEW.instance_id = '208c41b4-5814-4feb-af81-c767b49b5355' then -- @socialcomcarol
      v_pipeline := '96bbbbaf-cf87-43eb-af1e-2ab15ccfdf00'; -- Social Media
      v_stage := 'f47f3d15-34ff-40e3-866c-7928f07e92ad';    -- Novo Lead
      v_origin := '357b1c33-afe8-4fff-bbcb-7aadebc4c010';   -- Social Media
    else
      select id into v_origin from crm_origins where name='FUNIL SS' and pipeline_id='4f7bee20-15a3-4612-8085-c2ef9796ee6d' limit 1;
    end if;
    insert into crm_leads (name, pipeline_id, stage_id, origin_id, instagram)
    values (
      coalesce(nullif(v_contact.name,''), nullif('@'||v_contact.username,'@'), 'Instagram '||coalesce(v_contact.instagram_user_id,'')),
      v_pipeline, v_stage, v_origin, v_contact.username
    ) returning id into v_lead;
    update instagram_conversations set lead_id = v_lead where id = NEW.id;
    -- leads do @socialcomcarol saem com a etiqueta Instagram (Fabrício, 22/10/2026)
    if NEW.instance_id = '208c41b4-5814-4feb-af81-c767b49b5355' then
      insert into crm_lead_tags (lead_id, tag_id)
      select v_lead, id from crm_tags where name = 'Instagram' and is_active limit 1;
    end if;
  exception when others then
    raise warning 'ig_conversation_autolead falhou: %', sqlerrm;
  end;
  return NEW;
end $function$;

-- a conversa que entrou antes da mudança (Funil SS) vai pro Social Media com a etiqueta
update crm_leads l set pipeline_id = '96bbbbaf-cf87-43eb-af1e-2ab15ccfdf00', stage_id = 'f47f3d15-34ff-40e3-866c-7928f07e92ad',
       origin_id = '357b1c33-afe8-4fff-bbcb-7aadebc4c010'
  from instagram_conversations c
 where c.lead_id = l.id and c.instance_id = '208c41b4-5814-4feb-af81-c767b49b5355'
   and l.pipeline_id = '4f7bee20-15a3-4612-8085-c2ef9796ee6d';
insert into crm_lead_tags (lead_id, tag_id)
select distinct c.lead_id, t.id from instagram_conversations c, crm_tags t
 where c.instance_id = '208c41b4-5814-4feb-af81-c767b49b5355' and c.lead_id is not null and t.name = 'Instagram'
   and not exists (select 1 from crm_lead_tags x where x.lead_id = c.lead_id and x.tag_id = t.id);
