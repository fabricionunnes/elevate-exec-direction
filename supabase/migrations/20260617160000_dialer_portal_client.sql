-- Opção B: cliente do portal acessa o discador no mesmo login.
-- Libera o agente do discador pra ser qualquer usuário (não só onboarding_staff).
ALTER TABLE public.crm_calls DROP CONSTRAINT IF EXISTS crm_calls_agent_staff_id_fkey;
ALTER TABLE public.crm_dialer_sessions DROP CONSTRAINT IF EXISTS crm_dialer_sessions_agent_staff_id_fkey;
ALTER TABLE public.crm_dialer_campaigns DROP CONSTRAINT IF EXISTS crm_dialer_campaigns_agent_staff_id_fkey;
-- Habilita o discador por cliente do portal.
ALTER TABLE public.onboarding_users ADD COLUMN IF NOT EXISTS dialer_enabled BOOLEAN NOT NULL DEFAULT false;
