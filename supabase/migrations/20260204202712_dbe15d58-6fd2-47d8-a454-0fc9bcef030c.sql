-- =============================================
-- UNV Social - Content Production Pipeline
-- =============================================

-- Enum for content types
CREATE TYPE public.social_content_type AS ENUM ('feed', 'reels', 'stories');

-- Enum for content objectives
CREATE TYPE public.social_content_objective AS ENUM ('engagement', 'authority', 'conversion');

-- Enum for pipeline stages
CREATE TYPE public.social_stage_type AS ENUM (
  'idea',
  'script', 
  'design',
  'internal_review',
  'client_approval',
  'adjustments',
  'approved',
  'scheduled',
  'published'
);

-- Enum for approval status
CREATE TYPE public.social_approval_status AS ENUM ('pending', 'approved', 'adjustment_requested');

-- =============================================
-- 1. Instagram Accounts (per project)
-- =============================================
CREATE TABLE public.social_instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  instagram_user_id TEXT,
  instagram_username TEXT,
  page_id TEXT, -- Facebook Page ID linked to Instagram
  access_token TEXT, -- Long-lived token
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  connected_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- =============================================
-- 2. Content Pipeline Boards (one per project)
-- =============================================
CREATE TABLE public.social_content_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Pipeline de Conteúdo',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- =============================================
-- 3. Pipeline Stages (fixed stages per board)
-- =============================================
CREATE TABLE public.social_content_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.social_content_boards(id) ON DELETE CASCADE,
  stage_type social_stage_type NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, stage_type)
);

-- =============================================
-- 4. Content Cards (posts)
-- =============================================
CREATE TABLE public.social_content_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.social_content_boards(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.social_content_stages(id),
  
  -- Content info
  content_type social_content_type NOT NULL DEFAULT 'feed',
  theme TEXT NOT NULL,
  objective social_content_objective DEFAULT 'engagement',
  
  -- Copy and creative
  copy_text TEXT,
  creative_url TEXT,
  creative_type TEXT, -- 'image' or 'video'
  final_caption TEXT,
  hashtags TEXT,
  cta TEXT,
  
  -- Scheduling
  suggested_date DATE,
  suggested_time TIME,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  instagram_post_id TEXT,
  instagram_post_url TEXT,
  
  -- Metadata
  is_locked BOOLEAN DEFAULT false, -- Lock after approval
  created_by UUID REFERENCES public.onboarding_staff(id),
  assigned_to UUID REFERENCES public.onboarding_staff(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. Approval Links (public access tokens)
-- =============================================
CREATE TABLE public.social_approval_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status social_approval_status DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  sent_via TEXT DEFAULT 'whatsapp',
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 6. Client Feedback / Adjustment Requests
-- =============================================
CREATE TABLE public.social_client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  approval_link_id UUID REFERENCES public.social_approval_links(id),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('approved', 'adjustment_requested')),
  adjustment_notes TEXT, -- Required if adjustment_requested
  client_name TEXT,
  client_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 7. Card History / Activity Log
-- =============================================
CREATE TABLE public.social_content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'moved', 'sent_for_approval', 'approved', 'adjustment_requested', 'scheduled', 'published'
  from_stage_id UUID REFERENCES public.social_content_stages(id),
  to_stage_id UUID REFERENCES public.social_content_stages(id),
  details JSONB,
  performed_by UUID REFERENCES public.onboarding_staff(id),
  performed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 8. Publish Logs
-- =============================================
CREATE TABLE public.social_publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.social_content_cards(id) ON DELETE CASCADE,
  instagram_account_id UUID REFERENCES public.social_instagram_accounts(id),
  action TEXT NOT NULL, -- 'scheduled', 'published', 'failed'
  instagram_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 9. WhatsApp Notification Settings (per project)
-- =============================================
CREATE TABLE public.social_whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  client_phone TEXT, -- Phone number to send approvals
  client_name TEXT,
  whatsapp_instance_id UUID, -- Reference to existing Evolution instance
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE public.social_instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_approval_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_client_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publish_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies - Staff can manage all
-- =============================================

-- Instagram Accounts
CREATE POLICY "Staff can manage instagram accounts" ON public.social_instagram_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- Content Boards
CREATE POLICY "Staff can manage content boards" ON public.social_content_boards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- Content Stages
CREATE POLICY "Staff can manage content stages" ON public.social_content_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- Content Cards
CREATE POLICY "Staff can manage content cards" ON public.social_content_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- Approval Links - Staff can manage, public can read with token
CREATE POLICY "Staff can manage approval links" ON public.social_approval_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Public can read approval links with token" ON public.social_approval_links
  FOR SELECT USING (true);

-- Client Feedback - Anyone can insert, staff can read
CREATE POLICY "Anyone can insert feedback" ON public.social_client_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can read feedback" ON public.social_client_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- History
CREATE POLICY "Staff can manage history" ON public.social_content_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- Publish Logs
CREATE POLICY "Staff can manage publish logs" ON public.social_publish_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- WhatsApp Settings
CREATE POLICY "Staff can manage whatsapp settings" ON public.social_whatsapp_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

-- =============================================
-- Function to create default stages for a board
-- =============================================
CREATE OR REPLACE FUNCTION public.create_social_default_stages(p_board_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES
    (p_board_id, 'idea', '1) Ideia / Planejamento', '#9CA3AF', 1),
    (p_board_id, 'script', '2) Roteiro / Copy', '#60A5FA', 2),
    (p_board_id, 'design', '3) Design / Criação', '#A78BFA', 3),
    (p_board_id, 'internal_review', '4) Revisão Interna', '#FBBF24', 4),
    (p_board_id, 'client_approval', '5) Aprovação do Cliente', '#F97316', 5),
    (p_board_id, 'adjustments', '6) Ajustes Solicitados', '#EF4444', 6),
    (p_board_id, 'approved', '7) Aprovado', '#10B981', 7),
    (p_board_id, 'scheduled', '8) Programado no Instagram', '#3B82F6', 8),
    (p_board_id, 'published', '9) Publicado', '#059669', 9)
  ON CONFLICT (board_id, stage_type) DO NOTHING;
END;
$$;

-- =============================================
-- Trigger to auto-create board and stages for UNV Social projects
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_unv_social_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id UUID;
  v_board_id UUID;
BEGIN
  -- Check if this project is for the "UNV Social" service
  SELECT id INTO v_service_id
  FROM public.onboarding_services
  WHERE LOWER(name) LIKE '%unv social%' OR LOWER(name) LIKE '%social%'
  LIMIT 1;
  
  -- Only proceed if service matches and project has that service
  IF v_service_id IS NOT NULL AND NEW.service_id = v_service_id THEN
    -- Create board for this project
    INSERT INTO public.social_content_boards (project_id, name)
    VALUES (NEW.id, 'Pipeline de Conteúdo')
    ON CONFLICT (project_id) DO NOTHING
    RETURNING id INTO v_board_id;
    
    -- Create default stages
    IF v_board_id IS NOT NULL THEN
      PERFORM public.create_social_default_stages(v_board_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on project creation
DROP TRIGGER IF EXISTS create_social_board_on_project ON public.onboarding_projects;
CREATE TRIGGER create_social_board_on_project
  AFTER INSERT ON public.onboarding_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_unv_social_project();

-- =============================================
-- Enable Realtime for key tables
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_content_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_content_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_client_feedback;

-- =============================================
-- Create storage bucket for content media
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-content', 'social-content', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Staff can upload social content" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'social-content' AND
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view social content" ON storage.objects
  FOR SELECT USING (bucket_id = 'social-content');

CREATE POLICY "Staff can update social content" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'social-content' AND
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff can delete social content" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'social-content' AND
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
  );