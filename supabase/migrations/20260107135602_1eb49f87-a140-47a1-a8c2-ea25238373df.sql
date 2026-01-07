ALTER TABLE public.onboarding_ai_chat
  DROP CONSTRAINT IF EXISTS onboarding_ai_chat_role_check;

ALTER TABLE public.onboarding_ai_chat
  ADD CONSTRAINT onboarding_ai_chat_role_check
  CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'kpi_analysis'::text])));
