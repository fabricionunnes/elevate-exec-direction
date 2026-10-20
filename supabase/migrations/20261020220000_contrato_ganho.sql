-- Contrato do cliente ganho (Fabrício, 20/10/2026): anexa o contrato assinado no projeto, conclui a
-- tarefa "Contrato" e cobra o closer às 17h enquanto não assinar. Edge crm-contrato-ganho.
create table if not exists public.crm_contrato_ganho (
  lead_id uuid primary key references public.crm_leads(id) on delete cascade,
  company_id uuid references public.onboarding_companies(id) on delete set null,
  project_id uuid references public.onboarding_projects(id) on delete set null,
  envelope_id uuid,
  envelope_status text,
  status text not null default 'pendente', -- pendente | anexado | sem_empresa
  document_id uuid,
  task_id uuid,
  attached_at timestamptz,
  last_reminder_at timestamptz,
  reminders integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_contrato_ganho enable row level security;
grant select, insert, update, delete on public.crm_contrato_ganho to service_role;
grant select on public.crm_contrato_ganho to authenticated;
drop policy if exists "leitura staff" on public.crm_contrato_ganho;
create policy "leitura staff" on public.crm_contrato_ganho for select to authenticated using (true);

-- segredo do gatilho/cron (valor gerado aqui, nunca sai do banco)
insert into public.app_secrets(key, value) values ('crm_contrato_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- gatilho do ganho: chama a função 60 s depois (tempo do front criar empresa, projeto e tarefas)
create or replace function public.crm_contrato_ganho_trigger() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare old_won boolean := false; new_won boolean := false;
begin
  begin
    select (final_type = 'won') into old_won from crm_stages where id = OLD.stage_id;
    select (final_type = 'won') into new_won from crm_stages where id = NEW.stage_id;
    if coalesce(new_won,false) and not coalesce(old_won,false) then
      perform net.http_post(
        url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-contrato-ganho',
        headers := jsonb_build_object('Content-Type','application/json','x-contrato-secret',(select value from app_secrets where key='crm_contrato_secret')),
        body := jsonb_build_object('lead_id', NEW.id, 'esperar', 60),
        timeout_milliseconds := 10000);
    end if;
  exception when others then
    raise warning 'crm_contrato_ganho_trigger: %', sqlerrm;
  end;
  return NEW;
end $$;
drop trigger if exists zz_crm_contrato_ganho on public.crm_leads;
create trigger zz_crm_contrato_ganho after update of stage_id on public.crm_leads for each row execute function public.crm_contrato_ganho_trigger();
