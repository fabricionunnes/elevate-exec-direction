-- ordem certa na categoria automática: instância antes de carteira (compra de instância vem com notes unv_sales_wallet_recharge)
create or replace function public.unv_sales_tipo(p_desc text, p_notes text) returns text language sql immutable as $f$
  select case
    when coalesce(p_desc,'') !~* 'unv\s*sales' and coalesce(p_notes,'') !~* '^unv_sales' then null
    when coalesce(p_desc,'') ~* 'sales\s*(force|acceleration|ops|core|control)' then null
    when coalesce(p_desc,'') ~* 'inst[aâ]ncia' then 'Instâncias UNV Sales'
    when coalesce(p_desc,'') ~* 'm[oó]dulo' then 'Módulos UNV Sales'
    when coalesce(p_desc,'') ~* '(recarga|cr[eé]dito|carteira)' or coalesce(p_notes,'') ~* 'wallet' then 'Créditos UNV Sales'
    else 'UNV Sales' end;
$f$;
select unv_sales_tipo('UNV Sales — Instância de WhatsApp (1º mês) - X','unv_sales_wallet_recharge:1') t;
