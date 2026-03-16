
-- Table for video captions/subtitles
CREATE TABLE public.social_video_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  style_preset TEXT DEFAULT 'default',
  style_json JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for video overlays (emojis, images, stickers)
CREATE TABLE public.social_video_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  overlay_type TEXT NOT NULL DEFAULT 'emoji',
  content TEXT NOT NULL,
  x FLOAT DEFAULT 50,
  y FLOAT DEFAULT 50,
  scale FLOAT DEFAULT 1.0,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  animation TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_video_captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_video_overlays ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can manage captions via board -> project
CREATE POLICY "Staff can manage video captions"
ON public.social_video_captions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_boards b ON b.id = c.board_id
    JOIN public.onboarding_staff s ON s.user_id = auth.uid() AND s.is_active = true
    WHERE c.id = social_video_captions.card_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_boards b ON b.id = c.board_id
    JOIN public.onboarding_staff s ON s.user_id = auth.uid() AND s.is_active = true
    WHERE c.id = social_video_captions.card_id
  )
);

-- RLS: Project members can read captions
CREATE POLICY "Project members can read video captions"
ON public.social_video_captions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_boards b ON b.id = c.board_id
    WHERE c.id = social_video_captions.card_id
    AND public.is_onboarding_project_member(b.project_id)
  )
);

-- RLS: Staff can manage overlays
CREATE POLICY "Staff can manage video overlays"
ON public.social_video_overlays
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_boards b ON b.id = c.board_id
    JOIN public.onboarding_staff s ON s.user_id = auth.uid() AND s.is_active = true
    WHERE c.id = social_video_overlays.card_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_boards b ON b.id = c.board_id
    JOIN public.onboarding_staff s ON s.user_id = auth.uid() AND s.is_active = true
    WHERE c.id = social_video_overlays.card_id
  )
);

-- RLS: Project members can read overlays
CREATE POLICY "Project members can read video overlays"
ON public.social_video_overlays
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_boards b ON b.id = c.board_id
    WHERE c.id = social_video_overlays.card_id
    AND public.is_onboarding_project_member(b.project_id)
  )
);

-- Indexes
CREATE INDEX idx_video_captions_card_id ON public.social_video_captions(card_id);
CREATE INDEX idx_video_overlays_card_id ON public.social_video_overlays(card_id);
