-- Remove a política permissiva antiga
DROP POLICY IF EXISTS "Allow all for financial_bank_transactions" ON public.financial_bank_transactions;

-- Acesso só se o banco da transação é visível ao usuário (RLS de financial_banks já isola por tenant)
CREATE POLICY "Tenant isolation select bank transactions"
  ON public.financial_bank_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_banks b
      WHERE b.id = financial_bank_transactions.bank_id
    )
  );

CREATE POLICY "Tenant isolation insert bank transactions"
  ON public.financial_bank_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_banks b
      WHERE b.id = financial_bank_transactions.bank_id
    )
  );

CREATE POLICY "Tenant isolation update bank transactions"
  ON public.financial_bank_transactions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_banks b
      WHERE b.id = financial_bank_transactions.bank_id
    )
  );

CREATE POLICY "Tenant isolation delete bank transactions"
  ON public.financial_bank_transactions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_banks b
      WHERE b.id = financial_bank_transactions.bank_id
    )
  );