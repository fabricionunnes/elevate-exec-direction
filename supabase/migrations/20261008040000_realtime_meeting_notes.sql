-- Gestão à vista escuta reuniões de consultoria e tarefas: onboarding_meeting_notes entra no realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='onboarding_meeting_notes') then alter publication supabase_realtime add table public.onboarding_meeting_notes; end if;
end $$;
