
ALTER TABLE public.social_company_profiles
  ADD COLUMN IF NOT EXISTS brand_colors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_fonts text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visual_style text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visual_style_prompt text DEFAULT NULL;
