-- Adiciona instagram_business_account_id na tabela de conexão Meta
ALTER TABLE public.unv_meta_ads_accounts
  ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Tabela de posts pendentes de aprovação
CREATE TABLE IF NOT EXISTS public.unv_instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  caption TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_prompt TEXT,
  hashtags TEXT,
  post_type TEXT NOT NULL DEFAULT 'feed', -- feed | story | reel
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | posted | failed
  instagram_media_id TEXT,
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unv_instagram_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unv_instagram_posts' AND policyname = 'Full access unv_instagram_posts') THEN
    CREATE POLICY "Full access unv_instagram_posts"
      ON public.unv_instagram_posts FOR ALL
      TO anon, authenticated, service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.unv_instagram_posts TO anon, authenticated, service_role;
