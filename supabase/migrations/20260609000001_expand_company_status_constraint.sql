-- Expande o check constraint de status da tabela onboarding_companies
-- para aceitar os novos valores usados na interface

ALTER TABLE public.onboarding_companies
  DROP CONSTRAINT IF EXISTS onboarding_companies_status_check;

ALTER TABLE public.onboarding_companies
  ADD CONSTRAINT onboarding_companies_status_check
  CHECK (status IN (
    'active',
    'inactive',
    'churned',
    'onboarding',
    'cancellation_signaled',
    'notice_period',
    'closed',
    'prospect',
    'paused'
  ));
