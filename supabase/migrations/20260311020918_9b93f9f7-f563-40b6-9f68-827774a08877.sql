
-- Instagram Accounts connected per project
CREATE TABLE public.instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  profile_picture_url TEXT,
  bio TEXT,
  website TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected',
  last_synced_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, instagram_user_id)
);

-- Instagram Posts
CREATE TABLE public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  instagram_post_id TEXT NOT NULL UNIQUE,
  post_type TEXT NOT NULL DEFAULT 'feed',
  caption TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram Post Metrics
CREATE TABLE public.instagram_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.instagram_posts(id) ON DELETE CASCADE,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  engagement_rate NUMERIC(8,4) DEFAULT 0,
  reach_rate NUMERIC(8,4) DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id)
);

-- Instagram Account Metrics (daily snapshots)
CREATE TABLE public.instagram_account_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  avg_likes NUMERIC(10,2) DEFAULT 0,
  avg_comments NUMERIC(10,2) DEFAULT 0,
  avg_shares NUMERIC(10,2) DEFAULT 0,
  avg_saves NUMERIC(10,2) DEFAULT 0,
  profile_score INTEGER DEFAULT 0,
  recorded_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, recorded_date)
);

-- Instagram AI Insights
CREATE TABLE public.instagram_insights_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSON,
  priority TEXT DEFAULT 'medium',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram Competitor Accounts
CREATE TABLE public.instagram_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  competitor_username TEXT NOT NULL,
  competitor_full_name TEXT,
  followers_count INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(8,4) DEFAULT 0,
  posts_per_week NUMERIC(6,2) DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, competitor_username)
);

-- Instagram Reports
CREATE TABLE public.instagram_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSON,
  pdf_url TEXT,
  share_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram Sync Logs
CREATE TABLE public.instagram_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  posts_synced INTEGER DEFAULT 0,
  metrics_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Instagram Content Suggestions
CREATE TABLE public.instagram_content_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  theme TEXT NOT NULL,
  format TEXT,
  objective TEXT,
  cta TEXT,
  visual_style TEXT,
  description TEXT,
  is_used BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_account_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_insights_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_content_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Staff (admin, cs, consultant) can manage, clients can view their project's data

-- instagram_accounts policies
CREATE POLICY "Staff can manage instagram accounts" ON public.instagram_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project instagram accounts" ON public.instagram_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid() AND ou.project_id = instagram_accounts.project_id
    )
  );

-- instagram_posts policies  
CREATE POLICY "Staff can manage instagram posts" ON public.instagram_posts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project posts" ON public.instagram_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts ia
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ia.id = instagram_posts.account_id AND ou.user_id = auth.uid()
    )
  );

-- instagram_post_metrics policies
CREATE POLICY "Staff can manage post metrics" ON public.instagram_post_metrics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project post metrics" ON public.instagram_post_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_posts ip
      JOIN public.instagram_accounts ia ON ia.id = ip.account_id
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ip.id = instagram_post_metrics.post_id AND ou.user_id = auth.uid()
    )
  );

-- instagram_account_metrics policies
CREATE POLICY "Staff can manage account metrics" ON public.instagram_account_metrics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project account metrics" ON public.instagram_account_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts ia
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ia.id = instagram_account_metrics.account_id AND ou.user_id = auth.uid()
    )
  );

-- instagram_insights_ai policies
CREATE POLICY "Staff can manage insights" ON public.instagram_insights_ai
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project insights" ON public.instagram_insights_ai
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts ia
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ia.id = instagram_insights_ai.account_id AND ou.user_id = auth.uid()
    )
  );

-- instagram_competitors policies
CREATE POLICY "Staff can manage competitors" ON public.instagram_competitors
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project competitors" ON public.instagram_competitors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts ia
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ia.id = instagram_competitors.account_id AND ou.user_id = auth.uid()
    )
  );

-- instagram_reports policies
CREATE POLICY "Staff can manage reports" ON public.instagram_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project reports" ON public.instagram_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts ia
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ia.id = instagram_reports.account_id AND ou.user_id = auth.uid()
    )
  );

-- instagram_sync_logs policies
CREATE POLICY "Staff can manage sync logs" ON public.instagram_sync_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

-- instagram_content_suggestions policies
CREATE POLICY "Staff can manage suggestions" ON public.instagram_content_suggestions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Clients can view their project suggestions" ON public.instagram_content_suggestions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts ia
      JOIN public.onboarding_users ou ON ou.project_id = ia.project_id
      WHERE ia.id = instagram_content_suggestions.account_id AND ou.user_id = auth.uid()
    )
  );
