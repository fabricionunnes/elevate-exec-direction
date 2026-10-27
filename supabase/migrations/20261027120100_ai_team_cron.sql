-- Time de IA: o Max (ai-team-orchestrator) acorda de 30 em 30 min e roda os
-- agentes cujo horário bate com o slot atual (BRT). A função deduplica por dia,
-- então chamar a mais não repete rodada. Mesmo padrão dos outros crons (anon key).
select cron.unschedule(jobid) from cron.job where jobname = 'ai-team-orchestrator-30min';
select cron.schedule(
  'ai-team-orchestrator-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/ai-team-orchestrator',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"scheduled":true}'::jsonb
  ) as request_id;
  $$
);
