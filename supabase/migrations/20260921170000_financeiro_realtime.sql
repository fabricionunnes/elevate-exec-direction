-- Financeiro em tempo real (21/09/2026): as tabelas centrais passam a emitir eventos pro app
do $$
declare t text;
begin
  foreach t in array array['financial_payables','company_invoices','financial_receivables','financial_banks','company_recurring_charges'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
select json_agg(tablename) from pg_publication_tables where pubname='supabase_realtime' and tablename in ('financial_payables','company_invoices','financial_receivables','financial_banks','company_recurring_charges');
