-- Add auth user_id to company_salespeople for login support
ALTER TABLE public.company_salespeople
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_company_salespeople_user_id
  ON public.company_salespeople(user_id)
  WHERE user_id IS NOT NULL;
