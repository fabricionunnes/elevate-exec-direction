-- Lead com nome de preenchimento ("Sem nome 1", "Lead 3", só o número...) passa a usar o nome do
-- perfil do WhatsApp assim que o contato tiver um nome de verdade. Pedido do Fabrício 09/10/2026
-- (caso Lukas, ME Outubro). Nome digitado por gente NÃO é sobrescrito: só o de preenchimento.
CREATE OR REPLACE FUNCTION public.crm_nome_placeholder(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  select coalesce(btrim(p), '') = ''
      or btrim(p) ~* '^(sem nome|lead|contato|novo lead|cliente|desconhecido|unknown)( ?\d+)?$'
      or regexp_replace(btrim(p), '\D', '', 'g') = btrim(p)   -- só dígitos (telefone como nome)
      or btrim(p) ~ '^\+?[\d(][\d ()-]{6,}$'                     -- telefone formatado
$$;

-- nome "de verdade": tem letra e não é placeholder
CREATE OR REPLACE FUNCTION public.crm_nome_real(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  select coalesce(p, '') ~ '[[:alpha:]]' and not public.crm_nome_placeholder(p)
$$;

-- Aplica o nome do contato do WhatsApp nos leads ligados a ele (por contact.lead_id e pelas conversas)
CREATE OR REPLACE FUNCTION public.crm_lead_nome_do_whatsapp(p_contact uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_name text; n int := 0;
begin
  select btrim(ct.name) into v_name from crm_whatsapp_contacts ct where ct.id = p_contact;
  if not public.crm_nome_real(v_name) then return 0; end if;
  with alvo as (
    select l.id, l.name as antigo from crm_leads l
    where public.crm_nome_placeholder(l.name)
      and (l.id = (select ct.lead_id from crm_whatsapp_contacts ct where ct.id = p_contact)
           or l.id in (select c.lead_id from crm_whatsapp_conversations c where c.contact_id = p_contact and c.lead_id is not null))
  ), upd as (
    update crm_leads l set name = v_name from alvo a where l.id = a.id returning l.id, a.antigo
  )
  insert into crm_lead_history (lead_id, action, field_changed, old_value, new_value, notes)
  select u.id, 'note_added', 'name', u.antigo, v_name, 'Nome preenchido com o nome do perfil do WhatsApp' from upd u;
  get diagnostics n = row_count;
  return n;
end $$;

-- 1) contato ganhou/trocou nome
CREATE OR REPLACE FUNCTION public.trg_crm_contact_name_to_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if TG_OP = 'INSERT' or NEW.name is distinct from OLD.name then
    begin perform public.crm_lead_nome_do_whatsapp(NEW.id);
    exception when others then raise warning 'crm_lead_nome_do_whatsapp: %', sqlerrm; end;
  end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_crm_contact_name_to_lead ON public.crm_whatsapp_contacts;
CREATE TRIGGER trg_crm_contact_name_to_lead AFTER INSERT OR UPDATE OF name ON public.crm_whatsapp_contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_crm_contact_name_to_lead();

-- 2) conversa foi ligada a um lead
CREATE OR REPLACE FUNCTION public.trg_crm_conv_link_name_to_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if NEW.lead_id is not null and (TG_OP = 'INSERT' or NEW.lead_id is distinct from OLD.lead_id) then
    begin perform public.crm_lead_nome_do_whatsapp(NEW.contact_id);
    exception when others then raise warning 'crm_lead_nome_do_whatsapp: %', sqlerrm; end;
  end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_crm_conv_link_name_to_lead ON public.crm_whatsapp_conversations;
CREATE TRIGGER trg_crm_conv_link_name_to_lead AFTER INSERT OR UPDATE OF lead_id ON public.crm_whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.trg_crm_conv_link_name_to_lead();
