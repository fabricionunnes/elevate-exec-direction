-- Add new client roles to the onboarding_role enum
-- These need to be committed separately before use
ALTER TYPE public.onboarding_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.onboarding_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE public.onboarding_role ADD VALUE IF NOT EXISTS 'rh_client';
ALTER TYPE public.onboarding_role ADD VALUE IF NOT EXISTS 'estoque';
ALTER TYPE public.onboarding_role ADD VALUE IF NOT EXISTS 'financeiro';