-- ============================================================
-- agente-unv: tabela de chat IDs + pg_cron para reunião diária
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_chat_ids (
  agent       TEXT        NOT NULL PRIMARY KEY,
  chat_id     BIGINT      NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_chat_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read agent_chat_ids" ON public.agent_chat_ids;
CREATE POLICY "Public read agent_chat_ids"
  ON public.agent_chat_ids FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public write agent_chat_ids" ON public.agent_chat_ids;
CREATE POLICY "Public write agent_chat_ids"
  ON public.agent_chat_ids FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update agent_chat_ids" ON public.agent_chat_ids;
CREATE POLICY "Public update agent_chat_ids"
  ON public.agent_chat_ids FOR UPDATE USING (true);

-- pg_cron setup (wrapped in exception handler for environments where it is not available)
DO $outer$
DECLARE
  v_new_url TEXT := 'https://zfuxjmvzkecnmbmnrfvq.supabase.co/functions/v1/agente-unv';
  v_apikey TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdXhqbXZ6a2Vjbm1ibW5yZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjQ5MzcsImV4cCI6MjA5NDQ0MDkzN30.qTHgB-v4yEIGIYuUsQYxD92eqkIbFAwStRfO2qZxsm4';
  v_sql TEXT;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-reuniao-diaria') THEN
    PERFORM cron.unschedule('agente-reuniao-diaria');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-1') THEN PERFORM cron.unschedule('agente-checkin-1'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-2') THEN PERFORM cron.unschedule('agente-checkin-2'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-3') THEN PERFORM cron.unschedule('agente-checkin-3'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-4') THEN PERFORM cron.unschedule('agente-checkin-4'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-5') THEN PERFORM cron.unschedule('agente-checkin-5'); END IF;

  v_sql := format(
    'SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:=%L::jsonb)',
    v_new_url || '?action=daily-meeting',
    '{"Content-Type":"application/json","apikey":"' || v_apikey || '"}',
    '{}'
  );
  PERFORM cron.schedule('agente-reuniao-diaria', '0 10 * * *', v_sql);

  v_sql := format(
    'SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:=%L::jsonb)',
    v_new_url || '?action=check-in',
    '{"Content-Type":"application/json","apikey":"' || v_apikey || '"}',
    '{}'
  );
  PERFORM cron.schedule('agente-checkin-1', '0 12 * * *', v_sql);
  PERFORM cron.schedule('agente-checkin-2', '0 14 * * *', v_sql);
  PERFORM cron.schedule('agente-checkin-3', '0 16 * * *', v_sql);
  PERFORM cron.schedule('agente-checkin-4', '0 18 * * *', v_sql);
  PERFORM cron.schedule('agente-checkin-5', '0 20 * * *', v_sql);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $outer$;
