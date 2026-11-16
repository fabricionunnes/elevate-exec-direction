-- Acompanhamento de recorrência em Pix Automático com aviso por WhatsApp numa data (16/11/2026).
-- Fabrício, sobre a Trilobit: "coloca para no dia 23 me avisar no whatsapp no meu número através da
-- instância Fabrício Nunnes". A régua (billing-notifications, de hora em hora) manda o aviso no dia,
-- entre 8h e 20h, com a situação da recorrência naquele momento, uma vez só.
create table if not exists public.pix_automatico_acompanhamentos (
  recurring_charge_id uuid primary key,
  avisar_em date not null,
  telefone text not null,
  instancia text not null,
  pedido text,
  criado_em timestamptz not null default now(),
  avisado_em timestamptz,
  resultado text
);
alter table public.pix_automatico_acompanhamentos enable row level security;
grant all on public.pix_automatico_acompanhamentos to service_role;
grant select on public.pix_automatico_acompanhamentos to authenticated;
drop policy if exists "staff vê acompanhamentos do pix automático" on public.pix_automatico_acompanhamentos;
create policy "staff vê acompanhamentos do pix automático" on public.pix_automatico_acompanhamentos for select to authenticated
  using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active));
insert into public.pix_automatico_acompanhamentos (recurring_charge_id, avisar_em, telefone, instancia, pedido)
values ('5ee504c8-3c94-48ee-b3bd-a385614f413b', date '2026-11-23', '553194622556', 'fabricionunnes',
        'Trilobit: avisar em 23/11 se a autorização foi aprovada ou se voltou pra Pix normal (pedido do Fabrício em 16/11/2026)')
on conflict (recurring_charge_id) do nothing;
select recurring_charge_id, avisar_em, telefone, instancia, avisado_em from public.pix_automatico_acompanhamentos;
