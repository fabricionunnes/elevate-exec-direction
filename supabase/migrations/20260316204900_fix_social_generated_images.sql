-- Create social_generated_images table (was missing from migrations)
CREATE TABLE IF NOT EXISTS public.social_generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.social_content_cards(id) ON DELETE SET NULL,
  prompt TEXT,
  image_url TEXT,
  model TEXT,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage generated images" ON public.social_generated_images
  FOR ALL USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));
