-- Atendimento: saber quem falou por último (fila "Esperando resposta") — 19/09/2026
alter table public.crm_whatsapp_conversations add column if not exists last_message_direction text;
alter table public.crm_whatsapp_conversations add column if not exists last_inbound_at timestamptz;

create or replace function public.trg_bump_wa_conversation_last_message()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  -- Toda mensagem (enviada ou recebida) sobe a conversa pro topo do Atendimento.
  update crm_whatsapp_conversations
     set last_message_direction = case when coalesce(new.created_at, now()) >= coalesce(last_message_at, '-infinity'::timestamptz) and coalesce(new.type,'') <> 'reaction'
                                       then new.direction else last_message_direction end,
         last_inbound_at = case when new.direction = 'inbound' and coalesce(new.type,'') <> 'reaction'
                                then greatest(coalesce(last_inbound_at, '-infinity'::timestamptz), coalesce(new.created_at, now())) else last_inbound_at end,
         last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), coalesce(new.created_at, now())),
         last_message = case when coalesce(new.created_at, now()) >= coalesce(last_message_at, '-infinity'::timestamptz) and length(coalesce(new.content,'')) > 0
                             then left(new.content, 255) else last_message end,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end $function$;

-- preenche o que já existe (só conversas com movimento nos últimos 60 dias)
update public.crm_whatsapp_conversations c
   set last_message_direction = (select m.direction from crm_whatsapp_messages m where m.conversation_id = c.id and coalesce(m.type,'') <> 'reaction' order by m.created_at desc limit 1),
       last_inbound_at = (select max(m.created_at) from crm_whatsapp_messages m where m.conversation_id = c.id and m.direction = 'inbound' and coalesce(m.type,'') <> 'reaction')
 where c.last_message_at > now() - interval '60 days';

select json_agg(x) from (select last_message_direction d, count(*) n from crm_whatsapp_conversations where last_message_at > now() - interval '60 days' group by 1) x;
