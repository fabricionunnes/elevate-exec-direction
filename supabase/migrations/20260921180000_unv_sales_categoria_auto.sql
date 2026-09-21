-- UNV Sales: categoria automática respeitando as DUAS listas de categorias do Financeiro
-- company_invoices usa staff_financial_categories; recorrências e contas a receber usam financial_categories.
drop trigger if exists aa_unv_sales_categoria on public.company_invoices;
drop trigger if exists aa_unv_sales_categoria on public.company_recurring_charges;
drop trigger if exists aa_unv_sales_categoria on public.financial_receivables;
drop function if exists public.trg_unv_sales_categoria();
drop function if exists public.unv_sales_categoria(text, text);

create or replace function public.unv_sales_tipo(p_desc text, p_notes text) returns text language sql immutable as $f$
  select case
    when coalesce(p_desc,'') !~* 'unv\s*sales' and coalesce(p_notes,'') !~* '^unv_sales' then null
    when coalesce(p_desc,'') ~* 'sales\s*(force|acceleration|ops|core|control)' then null   -- consultoria, não o SaaS
    when coalesce(p_desc,'') ~* '(recarga|cr[eé]dito|carteira)' or coalesce(p_notes,'') ~* 'wallet' then 'Créditos UNV Sales'
    when coalesce(p_desc,'') ~* 'inst[aâ]ncia' then 'Instâncias UNV Sales'
    when coalesce(p_desc,'') ~* 'm[oó]dulo' then 'Módulos UNV Sales'
    else 'UNV Sales' end;
$f$;
create or replace function public.trg_unv_sales_categoria() returns trigger language plpgsql as $f$
declare v_tipo text; v_id uuid;
begin
  if NEW.category_id is not null then return NEW; end if;
  v_tipo := unv_sales_tipo(NEW.description, NEW.notes);
  if v_tipo is null then return NEW; end if;
  if TG_TABLE_NAME = 'company_invoices' then
    select id into v_id from staff_financial_categories where name = v_tipo and is_active order by created_at limit 1;
  else
    select id into v_id from financial_categories where name = v_tipo limit 1;
  end if;
  if v_id is not null then NEW.category_id := v_id; end if;
  return NEW;
end $f$;
create trigger aa_unv_sales_categoria before insert or update of description, notes, category_id on public.company_invoices for each row execute function public.trg_unv_sales_categoria();
create trigger aa_unv_sales_categoria before insert or update of description, notes, category_id on public.company_recurring_charges for each row execute function public.trg_unv_sales_categoria();
create trigger aa_unv_sales_categoria before insert or update of description, notes, category_id on public.financial_receivables for each row execute function public.trg_unv_sales_categoria();

-- o que já existe sem categoria: "tocar" a linha faz o gatilho preencher
update company_recurring_charges set description = description where category_id is null and unv_sales_tipo(description, notes) is not null;
update company_invoices set description = description where category_id is null and unv_sales_tipo(description, notes) is not null;
update financial_receivables set description = description where category_id is null and unv_sales_tipo(description, notes) is not null;

