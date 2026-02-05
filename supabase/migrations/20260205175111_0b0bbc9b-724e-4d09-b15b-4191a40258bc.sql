-- Create table for task card subtasks
CREATE TABLE public.social_card_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.onboarding_staff(id)
);

-- Enable RLS
ALTER TABLE public.social_card_subtasks ENABLE ROW LEVEL SECURITY;

-- Create policies for subtasks (same access as parent card)
CREATE POLICY "Staff can view subtasks"
  ON public.social_card_subtasks
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can create subtasks"
  ON public.social_card_subtasks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can update subtasks"
  ON public.social_card_subtasks
  FOR UPDATE
  USING (true);

CREATE POLICY "Staff can delete subtasks"
  ON public.social_card_subtasks
  FOR DELETE
  USING (true);

-- Create index for performance
CREATE INDEX idx_social_card_subtasks_card_id ON public.social_card_subtasks(card_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_card_subtasks;