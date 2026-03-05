-- Add commission to staff_salaries
ALTER TABLE public.staff_salaries ADD COLUMN commission numeric DEFAULT NULL;

-- Add invoice_type to staff_invoices (salary or commission)
ALTER TABLE public.staff_invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'salary';