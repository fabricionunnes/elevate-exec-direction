-- Catálogo de produtos do CRM (aba Produtos em Configurações do CRM), 01/10/2026.
-- O produto do lead (crm_leads.product_id, crm_sales.product_id, crm_secondary_goals.product_id)
-- aponta pra onboarding_services, que também é o catálogo de serviços do onboarding
-- (fases, templates, projetos). A tabela só tinha nome, slug e descrição: faltava preço
-- de tabela, recorrência e ordem. Colunas novas e opcionais, nada muda pra quem já lê.
alter table public.onboarding_services
  add column if not exists list_price numeric,
  add column if not exists recurrence text,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'onboarding_services_recurrence_check') then
    alter table public.onboarding_services
      add constraint onboarding_services_recurrence_check
      check (recurrence is null or recurrence in ('unica', 'mensal', 'trimestral', 'semestral', 'anual'));
  end if;
end $$;

comment on column public.onboarding_services.list_price is 'Preço de tabela em reais (referência pra venda nova, não é o que a carteira paga)';
comment on column public.onboarding_services.recurrence is 'unica, mensal, trimestral, semestral ou anual';
comment on column public.onboarding_services.sort_order is 'Ordem de exibição nas listas do CRM (menor primeiro, empate por nome)';
