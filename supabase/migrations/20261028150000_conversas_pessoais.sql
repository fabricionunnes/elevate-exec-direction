-- 28/10/2026, Fabrício: "no Atendimento estão aparecendo conversas do meu WhatsApp pessoal, mais de 99 não lidas,
-- e ele nem conectado está". A instância fabricio-pessoal (is_personal) foi excluída em 27/10; a FK
-- ON DELETE SET NULL deixou as 654 conversas órfãs e conversa órfã aparece pro master no Atendimento.
-- A marca de pessoal passa a ficar também na CONVERSA, pra sobreviver à exclusão do número.
alter table public.crm_whatsapp_conversations add column if not exists pessoal boolean not null default false;

-- nomes de instâncias pessoais (sobrevive à exclusão; recriar com o mesmo nome volta como pessoal)
create table if not exists public.wa_instancias_pessoais (instance_name text primary key, marcado_em timestamptz not null default now());
alter table public.wa_instancias_pessoais enable row level security;
revoke all on public.wa_instancias_pessoais from anon, authenticated;

insert into public.wa_instancias_pessoais (instance_name)
select instance_name from public.whatsapp_instances where is_personal
union select 'fabricio-pessoal'
on conflict do nothing;

update public.crm_whatsapp_conversations c set pessoal = true
 where not c.pessoal
   and (c.orphan_instance_name in (select instance_name from public.wa_instancias_pessoais)
        or c.instance_id in (select id from public.whatsapp_instances where is_personal));

-- antes de excluir uma instância pessoal: marca as conversas e guarda o nome
create or replace function public.wa_instancia_pessoal_antes_excluir() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_personal then
    insert into wa_instancias_pessoais (instance_name) values (old.instance_name) on conflict do nothing;
    update crm_whatsapp_conversations set pessoal = true where instance_id = old.id and not pessoal;
  end if;
  return old;
end $$;
drop trigger if exists aa_wa_instancia_pessoal_antes_excluir on public.whatsapp_instances;
create trigger aa_wa_instancia_pessoal_antes_excluir before delete on public.whatsapp_instances
  for each row execute function public.wa_instancia_pessoal_antes_excluir();

-- recriar uma instância com nome de pessoal já nasce pessoal
create or replace function public.wa_instancia_pessoal_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.is_personal, false)
     and exists (select 1 from wa_instancias_pessoais p where p.instance_name = new.instance_name) then
    new.is_personal := true;
  end if;
  return new;
end $$;
drop trigger if exists aa_wa_instancia_pessoal_sync on public.whatsapp_instances;
create trigger aa_wa_instancia_pessoal_sync before insert on public.whatsapp_instances
  for each row execute function public.wa_instancia_pessoal_sync();

-- marcar/desmarcar is_personal propaga pras conversas da instância
create or replace function public.wa_instancia_pessoal_propaga() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_personal then
    insert into wa_instancias_pessoais (instance_name) values (new.instance_name) on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.is_personal then
    delete from wa_instancias_pessoais where instance_name = new.instance_name;
  end if;
  if tg_op = 'INSERT' or new.is_personal is distinct from old.is_personal then
    update crm_whatsapp_conversations set pessoal = coalesce(new.is_personal, false)
     where instance_id = new.id and pessoal is distinct from coalesce(new.is_personal, false);
  end if;
  return null;
end $$;
drop trigger if exists zz_wa_instancia_pessoal_propaga on public.whatsapp_instances;
create trigger zz_wa_instancia_pessoal_propaga after insert or update of is_personal on public.whatsapp_instances
  for each row execute function public.wa_instancia_pessoal_propaga();

-- conversa nova (ou religada) numa instância pessoal já fica marcada
create or replace function public.crm_conversa_marca_pessoal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.instance_id is not null and wa_conversa_pessoal(new.instance_id) then new.pessoal := true; end if;
  return new;
end $$;
drop trigger if exists crm_conversa_marca_pessoal on public.crm_whatsapp_conversations;
create trigger crm_conversa_marca_pessoal before insert or update of instance_id on public.crm_whatsapp_conversations
  for each row execute function public.crm_conversa_marca_pessoal();

create index if not exists crm_whatsapp_conversations_pessoal_idx on public.crm_whatsapp_conversations (pessoal) where pessoal;
