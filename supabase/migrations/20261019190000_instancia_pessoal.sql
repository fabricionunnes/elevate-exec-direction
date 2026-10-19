-- Instância pessoal do Fabrício (19/10/2026): "no Acontecendo hoje tá mostrando conversa da minha
-- instância pessoal, isso não pode aparecer em lugar nenhum". show_in_inbox=false não serve de
-- marca (fabricionunnes, financeiro e marcelo também estão fora do Atendimento). Marca própria.
alter table public.whatsapp_instances add column if not exists is_personal boolean not null default false;
update public.whatsapp_instances set is_personal = true where instance_name = 'fabricio-pessoal';

-- helper pra todo painel/vigia: conversa de instância pessoal fica fora
create or replace function public.wa_conversa_pessoal(p_instance_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select i.is_personal from whatsapp_instances i where i.id = p_instance_id), false)
$$;
grant execute on function public.wa_conversa_pessoal(uuid) to authenticated, service_role;
