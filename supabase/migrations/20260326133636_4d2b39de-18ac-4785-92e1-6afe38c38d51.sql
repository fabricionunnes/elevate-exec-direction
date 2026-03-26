
-- B2B Prospection module tables

-- Search history
CREATE TABLE public.b2b_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  niches TEXT[] NOT NULL DEFAULT '{}',
  state TEXT,
  city TEXT,
  country TEXT DEFAULT 'Brasil',
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history" ON public.b2b_search_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own search history" ON public.b2b_search_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own search history" ON public.b2b_search_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Saved lists
CREATE TABLE public.b2b_saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  lead_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_saved_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved lists" ON public.b2b_saved_lists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leads
CREATE TABLE public.b2b_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  list_id UUID REFERENCES public.b2b_saved_lists(id) ON DELETE CASCADE,
  place_id TEXT,
  name TEXT NOT NULL,
  segment TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  website TEXT,
  google_rating NUMERIC(2,1),
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own leads" ON public.b2b_leads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_b2b_leads_user_id ON public.b2b_leads(user_id);
CREATE INDEX idx_b2b_leads_list_id ON public.b2b_leads(list_id);
CREATE INDEX idx_b2b_leads_phone ON public.b2b_leads(phone);
CREATE INDEX idx_b2b_leads_status ON public.b2b_leads(status);

-- Lead notes
CREATE TABLE public.b2b_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.b2b_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lead notes" ON public.b2b_lead_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Search audit log
CREATE TABLE public.b2b_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  search_query TEXT,
  filters JSONB DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own search logs" ON public.b2b_search_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own search logs" ON public.b2b_search_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
