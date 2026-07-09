-- Garante que uma fatura com pagamento registrado (paid_at) NUNCA fique
-- overdue/pending. Sem isso, um evento OVERDUE do Asaas (ou qualquer código)
-- pode marcar como vencida uma fatura já paga — e a régua cobra o cliente por
-- algo já quitado. Caso real: Mensalidade POLI WINE EXPERIENCE (2/12), paga em
-- 04/07 e mostrando "Vencido".

create or replace function enforce_paid_invoice_status()
returns trigger
language plpgsql
as $$
begin
  -- paid_at preenchido => a fatura foi paga; overdue/pending vira paid.
  -- 'partial' e 'paid' são preservados. Estorno legítimo limpa paid_at na mesma
  -- operação, então continua podendo voltar pra pending/overdue.
  if new.paid_at is not null and new.status in ('overdue', 'pending') then
    new.status := 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_paid_invoice_status on company_invoices;
create trigger trg_enforce_paid_invoice_status
  before insert or update on company_invoices
  for each row execute function enforce_paid_invoice_status();

-- Corrige as faturas que já estão nesse estado inconsistente.
update company_invoices
set status = 'paid', updated_at = now()
where paid_at is not null and status in ('overdue', 'pending');
