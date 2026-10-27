-- Vigia de conexão dos números de WhatsApp (Fabrício, 27/10/2026: "desconectou do nexus o
-- whatsapp, quando acontecer isso tem que ter um aviso pra mim"). O "Fabrício Nunnes" ficou mudo
-- de 26/10 10h31 a 27/10 sem ninguém saber: cobrança, aviso de lead e de contrato não saíram.
alter table public.whatsapp_instances add column if not exists monitorar_conexao boolean not null default true;
update public.whatsapp_instances set monitorar_conexao = false where display_name like 'GP ·%'; -- números do evento de 24/10

create table if not exists public.whatsapp_conexao_vigia (
  instance_id uuid primary key references public.whatsapp_instances(id) on delete cascade,
  estado text,
  falhas_seguidas int not null default 0,
  caiu_em timestamptz,
  avisado_em timestamptz,
  checado_em timestamptz
);
alter table public.whatsapp_conexao_vigia enable row level security;
grant select, insert, update, delete on public.whatsapp_conexao_vigia to service_role;
