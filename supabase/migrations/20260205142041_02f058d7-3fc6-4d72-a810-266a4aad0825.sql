-- ============================================
-- UNV Social Restructuring Migration (Corrigido)
-- ============================================

-- 1. Create enum for card types
CREATE TYPE social_card_type AS ENUM ('content', 'task', 'info');

-- 2. Add new values to social_content_type enum
ALTER TYPE social_content_type ADD VALUE IF NOT EXISTS 'estatico';
ALTER TYPE social_content_type ADD VALUE IF NOT EXISTS 'carrossel';
ALTER TYPE social_content_type ADD VALUE IF NOT EXISTS 'outro';

-- 3. Add new columns to social_content_cards
ALTER TABLE public.social_content_cards 
ADD COLUMN IF NOT EXISTS card_type social_card_type NOT NULL DEFAULT 'content',
ADD COLUMN IF NOT EXISTS card_color text;

-- 4. Create table for card tags (status and format tags)
CREATE TABLE public.social_card_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('status', 'format')),
  tag_value text NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on social_card_tags
ALTER TABLE public.social_card_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_card_tags (following existing pattern)
CREATE POLICY "Staff can manage card tags" 
ON public.social_card_tags 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
  )
);

-- 5. Create table for card attachments
CREATE TABLE public.social_card_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on social_card_attachments
ALTER TABLE public.social_card_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_card_attachments (following existing pattern)
CREATE POLICY "Staff can manage card attachments" 
ON public.social_card_attachments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
  )
);

-- 6. Add WhatsApp group fields to social_whatsapp_settings
ALTER TABLE public.social_whatsapp_settings
ADD COLUMN IF NOT EXISTS group_jid text,
ADD COLUMN IF NOT EXISTS send_to_group boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name text;

-- 7. Add recurrence fields to social_stage_checklists
ALTER TABLE public.social_stage_checklists
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type text CHECK (recurrence_type IS NULL OR recurrence_type IN ('monthly', 'weekly')),
ADD COLUMN IF NOT EXISTS recurrence_day integer;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_social_card_tags_card_id ON public.social_card_tags(card_id);
CREATE INDEX IF NOT EXISTS idx_social_card_tags_tag_type ON public.social_card_tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_social_card_attachments_card_id ON public.social_card_attachments(card_id);
CREATE INDEX IF NOT EXISTS idx_social_content_cards_card_type ON public.social_content_cards(card_type);