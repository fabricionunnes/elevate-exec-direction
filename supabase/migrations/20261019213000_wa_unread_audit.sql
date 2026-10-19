-- Diagnóstico (19/10/2026): quem zera unread_count depois de marcar como não lida. Registra
-- cada mudança do contador com o papel, o usuário e os headers do PostgREST (user-agent).
create table if not exists public.wa_unread_audit (
  id bigserial primary key, conversation_id uuid, old_unread int, new_unread int, old_manual boolean, new_manual boolean,
  db_role text, jwt_role text, jwt_sub text, headers jsonb, at timestamptz default now()
);
create or replace function public.trg_wa_unread_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.unread_count is distinct from old.unread_count or new.unread_manual is distinct from old.unread_manual then
    insert into wa_unread_audit (conversation_id, old_unread, new_unread, old_manual, new_manual, db_role, jwt_role, jwt_sub, headers)
    values (new.id, old.unread_count, new.unread_count, old.unread_manual, new.unread_manual, current_user,
            nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
            nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub',
            nullif(current_setting('request.headers', true), '')::jsonb);
  end if;
  return new;
end $$;
drop trigger if exists zz_wa_unread_audit on public.crm_whatsapp_conversations;
create trigger zz_wa_unread_audit after update on public.crm_whatsapp_conversations for each row execute function public.trg_wa_unread_audit();
