ALTER TABLE public.generated_contracts ADD COLUMN IF NOT EXISTS envelope_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL;
ALTER TABLE public.distratos ADD COLUMN IF NOT EXISTS envelope_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL;
ALTER TABLE public.employee_contracts ADD COLUMN IF NOT EXISTS envelope_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL;
