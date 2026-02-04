-- Create table for stage checklists (sub-stages as checklist items)
CREATE TABLE public.social_stage_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.social_content_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for card checklist progress
CREATE TABLE public.social_card_checklist_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.social_stage_checklists(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, checklist_item_id)
);

-- Enable RLS
ALTER TABLE public.social_stage_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_card_checklist_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for stage checklists
CREATE POLICY "Authenticated users can view stage checklists"
ON public.social_stage_checklists FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage stage checklists"
ON public.social_stage_checklists FOR ALL
TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for card checklist progress
CREATE POLICY "Authenticated users can view checklist progress"
ON public.social_card_checklist_progress FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage checklist progress"
ON public.social_card_checklist_progress FOR ALL
TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_social_stage_checklists_stage_id ON public.social_stage_checklists(stage_id);
CREATE INDEX idx_social_card_checklist_progress_card_id ON public.social_card_checklist_progress(card_id);

-- Enable realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_card_checklist_progress;