-- ============================================================
-- agente-unv: tabela de chat IDs + pg_cron para reunião diária
-- ============================================================

-- Tabela para persistir o chat_id do usuário por agente
CREATE TABLE IF NOT EXISTS public.agent_chat_ids (
  agent       TEXT        NOT NULL PRIMARY KEY,  -- 'financeiro' | 'crm' | 'projetos' | 'ceo'
  chat_id     BIGINT      NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: permite leitura e escrita pública (chat_id não é dado sensível)
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

-- ============================================================
-- pg_cron: schedule automático (fuso horário BRT = UTC-3)
-- 7h BRT = 10h UTC | check-ins: 9h/11h/13h/15h/17h BRT
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs antigos se existirem
SELECT cron.unschedule('agente-reuniao-diaria') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agente-reuniao-diaria'
);
SELECT cron.unschedule('agente-checkin-1') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-1'
);
SELECT cron.unschedule('agente-checkin-2') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-2'
);
SELECT cron.unschedule('agente-checkin-3') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-3'
);
SELECT cron.unschedule('agente-checkin-4') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-4'
);
SELECT cron.unschedule('agente-checkin-5') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agente-checkin-5'
);

-- Reunião diária: 7h BRT (10h UTC) — CEO convoca todos os agentes
SELECT cron.schedule(
  'agente-reuniao-diaria',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/agente-unv?action=daily-meeting',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY"}'::jsonb,
    body   := '{}'::jsonb
  )
  $$
);

-- Check-in 09h BRT (12h UTC)
SELECT cron.schedule(
  'agente-checkin-1', '0 12 * * *',
  $$SELECT net.http_post(url:='https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/agente-unv?action=check-in',headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY"}'::jsonb,body:='{}'::jsonb)$$
);

-- Check-in 11h BRT (14h UTC)
SELECT cron.schedule(
  'agente-checkin-2', '0 14 * * *',
  $$SELECT net.http_post(url:='https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/agente-unv?action=check-in',headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY"}'::jsonb,body:='{}'::jsonb)$$
);

-- Check-in 13h BRT (16h UTC)
SELECT cron.schedule(
  'agente-checkin-3', '0 16 * * *',
  $$SELECT net.http_post(url:='https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/agente-unv?action=check-in',headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY"}'::jsonb,body:='{}'::jsonb)$$
);

-- Check-in 15h BRT (18h UTC)
SELECT cron.schedule(
  'agente-checkin-4', '0 18 * * *',
  $$SELECT net.http_post(url:='https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/agente-unv?action=check-in',headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY"}'::jsonb,body:='{}'::jsonb)$$
);

-- Check-in 17h BRT (20h UTC)
SELECT cron.schedule(
  'agente-checkin-5', '0 20 * * *',
  $$SELECT net.http_post(url:='https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/agente-unv?action=check-in',headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY"}'::jsonb,body:='{}'::jsonb)$$
);
