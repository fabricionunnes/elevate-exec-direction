-- Add consultant and CS fields to projects
ALTER TABLE public.onboarding_projects 
ADD COLUMN consultant_id UUID REFERENCES public.onboarding_staff(id),
ADD COLUMN cs_id UUID REFERENCES public.onboarding_staff(id);