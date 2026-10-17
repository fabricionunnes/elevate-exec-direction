-- Fatura de débito automático (Pix Automático): a régua de cobranças manda só o lembrete de que
-- vai debitar, sem link, antes e no dia do vencimento; em atraso segue a cobrança normal com link.
-- Hoje só a mensalidade do UNV Sales paga por Pix Automático usa (espelho do asaas-webhook). 17/10/2026.
alter table public.company_invoices add column if not exists auto_debit boolean not null default false;
