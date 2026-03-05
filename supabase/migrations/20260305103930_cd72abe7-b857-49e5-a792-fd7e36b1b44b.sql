
-- Staff salaries configuration table
CREATE TABLE public.staff_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, month, year)
);

-- Staff invoices table
CREATE TABLE public.staff_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  pix_key TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','em_analise','pago')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for invoice actions
CREATE TABLE public.staff_invoice_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.staff_invoices(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.onboarding_staff(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invoice_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is the staff member
CREATE OR REPLACE FUNCTION public.get_own_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true LIMIT 1
$$;

-- Helper: check if user has nf_manage permission
CREATE OR REPLACE FUNCTION public.has_nf_manage_permission()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role IN ('master', 'admin')
      OR EXISTS (
        SELECT 1 FROM public.staff_menu_permissions smp
        WHERE smp.staff_id = os.id AND smp.menu_key = 'nf_manage'
      )
    )
  )
$$;

-- RLS: staff_salaries
-- Staff can see own salary
CREATE POLICY "Staff can view own salary" ON public.staff_salaries
  FOR SELECT TO authenticated
  USING (staff_id = public.get_own_staff_id());

-- Managers can view all salaries
CREATE POLICY "Managers can view all salaries" ON public.staff_salaries
  FOR SELECT TO authenticated
  USING (public.has_nf_manage_permission());

-- Managers can insert/update salaries
CREATE POLICY "Managers can insert salaries" ON public.staff_salaries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_nf_manage_permission());

CREATE POLICY "Managers can update salaries" ON public.staff_salaries
  FOR UPDATE TO authenticated
  USING (public.has_nf_manage_permission());

-- RLS: staff_invoices
-- Staff can see own invoices
CREATE POLICY "Staff can view own invoices" ON public.staff_invoices
  FOR SELECT TO authenticated
  USING (staff_id = public.get_own_staff_id());

-- Staff can insert own invoices
CREATE POLICY "Staff can insert own invoices" ON public.staff_invoices
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.get_own_staff_id());

-- Managers can view all invoices
CREATE POLICY "Managers can view all invoices" ON public.staff_invoices
  FOR SELECT TO authenticated
  USING (public.has_nf_manage_permission());

-- Managers can update invoice status
CREATE POLICY "Managers can update invoices" ON public.staff_invoices
  FOR UPDATE TO authenticated
  USING (public.has_nf_manage_permission());

-- RLS: audit logs
CREATE POLICY "Staff can view own audit logs" ON public.staff_invoice_audit_logs
  FOR SELECT TO authenticated
  USING (
    staff_id = public.get_own_staff_id() 
    OR public.has_nf_manage_permission()
  );

CREATE POLICY "Authenticated can insert audit logs" ON public.staff_invoice_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('staff-invoices', 'staff-invoices', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: staff can upload own invoices
CREATE POLICY "Staff can upload own invoices" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Staff can read own invoices
CREATE POLICY "Staff can read own invoices" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'staff-invoices' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_nf_manage_permission()
  ));

-- Managers can read all invoices
CREATE POLICY "Managers can read all staff invoices" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'staff-invoices' AND public.has_nf_manage_permission());
