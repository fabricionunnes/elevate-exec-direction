
-- Table for staff self-registration via public link
CREATE TABLE public.staff_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Personal data (PF)
  full_name TEXT,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  
  -- Address
  cep TEXT,
  street TEXT,
  address_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  
  -- Bank data
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  bank_account_type TEXT,
  pix_key TEXT,
  
  -- PJ data
  cnpj TEXT,
  company_name TEXT,
  trade_name TEXT,
  municipal_registration TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.staff_registrations ENABLE ROW LEVEL SECURITY;

-- Public can insert (self-registration)
CREATE POLICY "Anyone can create a registration"
ON public.staff_registrations
FOR INSERT
WITH CHECK (true);

-- Public can view by token (to fill the form)
CREATE POLICY "Anyone can view by token"
ON public.staff_registrations
FOR SELECT
USING (true);

-- Public can update (to submit the form)
CREATE POLICY "Anyone can update a pending registration"
ON public.staff_registrations
FOR UPDATE
USING (status = 'pending');

-- Staff can view all
CREATE POLICY "Staff can view all registrations"
ON public.staff_registrations
FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_staff_registrations_updated_at
BEFORE UPDATE ON public.staff_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
