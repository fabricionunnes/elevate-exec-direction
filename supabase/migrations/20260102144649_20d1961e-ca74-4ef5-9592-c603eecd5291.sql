-- Add admin role to onboarding_role enum
ALTER TYPE onboarding_role ADD VALUE IF NOT EXISTS 'admin';
