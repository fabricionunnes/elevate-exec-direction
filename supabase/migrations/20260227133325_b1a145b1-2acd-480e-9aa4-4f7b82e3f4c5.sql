CREATE TABLE public.company_daily_goal_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  include_saturday BOOLEAN NOT NULL DEFAULT false,
  include_sunday BOOLEAN NOT NULL DEFAULT false,
  include_holidays BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Allow public read (for public entry page) and authenticated write
ALTER TABLE public.company_daily_goal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on company_daily_goal_settings"
  ON public.company_daily_goal_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert on company_daily_goal_settings"
  ON public.company_daily_goal_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on company_daily_goal_settings"
  ON public.company_daily_goal_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);