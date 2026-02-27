
CREATE TABLE public.cac_cost_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_cac_cost_items_project_month ON public.cac_cost_items(project_id, year, month);

-- RLS
ALTER TABLE public.cac_cost_items ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "Staff can manage CAC cost items" ON public.cac_cost_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Project members (clients) can view and manage their own project's items
CREATE POLICY "Project members can manage CAC cost items" ON public.cac_cost_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users
      WHERE user_id = auth.uid() AND project_id = cac_cost_items.project_id
    )
  );

-- Allow anonymous insert for public form usage
CREATE POLICY "Anyone can insert CAC cost items" ON public.cac_cost_items
  FOR INSERT WITH CHECK (true);
