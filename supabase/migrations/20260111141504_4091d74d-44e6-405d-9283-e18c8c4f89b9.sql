-- Create table to manage service phases with ordering
CREATE TABLE public.onboarding_service_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.onboarding_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, name)
);

-- Enable RLS
ALTER TABLE public.onboarding_service_phases ENABLE ROW LEVEL SECURITY;

-- Create policies for staff access
CREATE POLICY "Staff can view phases"
  ON public.onboarding_service_phases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage phases"
  ON public.onboarding_service_phases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_service_phases_updated_at
  BEFORE UPDATE ON public.onboarding_service_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_service_phases_service_id ON public.onboarding_service_phases(service_id);
CREATE INDEX idx_service_phases_sort_order ON public.onboarding_service_phases(service_id, sort_order);