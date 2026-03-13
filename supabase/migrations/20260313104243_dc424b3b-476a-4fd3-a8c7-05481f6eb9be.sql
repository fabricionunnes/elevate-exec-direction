
CREATE TABLE public.social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.social_content_boards(id) ON DELETE CASCADE,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_id)
);

ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage post metrics"
  ON public.social_post_metrics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Clients can view post metrics"
  ON public.social_post_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.social_content_boards scb
      JOIN public.onboarding_users ou ON ou.project_id = scb.project_id
      WHERE scb.id = social_post_metrics.board_id
      AND ou.user_id = auth.uid()
    )
  );
