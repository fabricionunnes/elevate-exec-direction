
-- Table to store multiple Asaas accounts with custom names
CREATE TABLE public.asaas_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key_secret_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_accounts ENABLE ROW LEVEL SECURITY;

-- Only authenticated staff can view
CREATE POLICY "Staff can view asaas accounts"
  ON public.asaas_accounts FOR SELECT
  TO authenticated
  USING (true);

-- Only financial admins can manage
CREATE POLICY "Financial admins can manage asaas accounts"
  ON public.asaas_accounts FOR ALL
  TO authenticated
  USING (public.is_financial_admin())
  WITH CHECK (public.is_financial_admin());

-- Add asaas_account_id to recurring charges
ALTER TABLE public.company_recurring_charges
  ADD COLUMN asaas_account_id uuid REFERENCES public.asaas_accounts(id);

-- Seed initial accounts - the existing ASAAS_API_KEY as the default
INSERT INTO public.asaas_accounts (name, api_key_secret_name, is_default)
VALUES ('Asaas Principal', 'ASAAS_API_KEY', true);
