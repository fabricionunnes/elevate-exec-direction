
CREATE TABLE public.nfse_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  invoice_id UUID REFERENCES public.company_invoices(id) ON DELETE SET NULL,
  nfeio_id TEXT,
  number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  service_description TEXT,
  tomador_name TEXT,
  tomador_document TEXT,
  tomador_email TEXT,
  city_service_code TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  rps_number TEXT,
  rps_serie TEXT,
  environment TEXT DEFAULT 'Production',
  error_message TEXT,
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.nfse_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage nfse_records" ON public.nfse_records
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE TRIGGER update_nfse_records_updated_at
  BEFORE UPDATE ON public.nfse_records
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
