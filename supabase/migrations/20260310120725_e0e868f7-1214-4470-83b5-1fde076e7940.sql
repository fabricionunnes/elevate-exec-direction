
-- Slide Presentations (main container)
CREATE TABLE public.slide_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  audience TEXT DEFAULT 'geral',
  duration_minutes INTEGER DEFAULT 30,
  content_level TEXT DEFAULT 'intermediario',
  status TEXT DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id UUID,
  slide_count INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  is_template BOOLEAN DEFAULT false,
  template_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual slides
CREATE TABLE public.slide_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID REFERENCES public.slide_presentations(id) ON DELETE CASCADE NOT NULL,
  slide_number INTEGER NOT NULL,
  slide_type TEXT NOT NULL DEFAULT 'content',
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}',
  speaker_notes TEXT,
  background_color TEXT,
  layout_type TEXT DEFAULT 'default',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slide_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for presentations
CREATE POLICY "Authenticated users can view all presentations"
  ON public.slide_presentations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can create presentations"
  ON public.slide_presentations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own presentations"
  ON public.slide_presentations FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own presentations"
  ON public.slide_presentations FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- RLS policies for slide items
CREATE POLICY "Authenticated users can view slide items"
  ON public.slide_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage slide items"
  ON public.slide_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.slide_presentations WHERE id = presentation_id AND created_by = auth.uid())
  );

CREATE POLICY "Users can update their slide items"
  ON public.slide_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.slide_presentations WHERE id = presentation_id AND created_by = auth.uid())
  );

CREATE POLICY "Users can delete their slide items"
  ON public.slide_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.slide_presentations WHERE id = presentation_id AND created_by = auth.uid())
  );

-- Index for performance
CREATE INDEX idx_slide_items_presentation ON public.slide_items(presentation_id, sort_order);
CREATE INDEX idx_slide_presentations_created_by ON public.slide_presentations(created_by);
