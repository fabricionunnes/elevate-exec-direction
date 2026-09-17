-- Segurança 18/09/2026: visitante sem login não lê nem altera crm_leads direto.
-- O formulário de dados contratuais usa contract_form_get / contract_form_save (exigem o token do link).
drop policy if exists "Public read lead by contract form token" on public.crm_leads;
drop policy if exists "Public update lead contract data by token" on public.crm_leads;
