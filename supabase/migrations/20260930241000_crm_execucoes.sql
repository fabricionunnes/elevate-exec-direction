-- Central de Execuções do CRM (benchmark Datacrazy, 30/09/2026).
-- Uma linha por trabalho em segundo plano: importação de leads, exportação, impulso,
-- mesclagem, backfill de automação. Guarda progresso (total, feitos, falhas, pulados),
-- quem iniciou, estado e onde está o resultado (arquivo no bucket crm-execucoes).
-- A tela fica em /crm/disparos, aba Execuções, e atualiza por realtime.
--
-- Quem roda o trabalho (navegador ou edge function) grava o progresso com
-- UPDATE ... WHERE status = 'running'. Se o update não devolver linha, alguém cancelou:
-- o trabalho para. É assim que o botão Cancelar funciona sem ficar esperando ninguém.

create table if not exists public.crm_executions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('lead_import', 'lead_export', 'impulso', 'merge', 'automation_backfill')),
  title text not null,
  status text not null default 'running' check (status in ('queued', 'running', 'paused', 'done', 'failed', 'cancelled')),
  total integer not null default 0,
  done integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  params jsonb not null default '{}'::jsonb,
  result_path text,          -- caminho no bucket crm-execucoes (arquivo exportado)
  result_name text,
  errors_path text,          -- CSV com a lista de erros, no mesmo bucket
  error text,                -- motivo da falha ou da pausa
  cancel_requested boolean not null default false,
  ref_id uuid,               -- impulso: crm_impulsos.id
  started_by uuid references public.onboarding_staff(id) on delete set null,
  started_by_name text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists crm_executions_created_idx on public.crm_executions (created_at desc);
create index if not exists crm_executions_owner_idx on public.crm_executions (started_by, created_at desc);
create index if not exists crm_executions_ref_idx on public.crm_executions (ref_id) where ref_id is not null;

alter table public.crm_executions enable row level security;

drop policy if exists "Staff ve execucoes" on public.crm_executions;
create policy "Staff ve execucoes" on public.crm_executions for select to authenticated
  using (not public.current_user_is_tenant() and (public.is_crm_admin() or started_by = public.get_current_staff_id()));

drop policy if exists "Staff cria execucao" on public.crm_executions;
create policy "Staff cria execucao" on public.crm_executions for insert to authenticated
  with check (not public.current_user_is_tenant() and started_by = public.get_current_staff_id());

drop policy if exists "Staff atualiza execucao" on public.crm_executions;
create policy "Staff atualiza execucao" on public.crm_executions for update to authenticated
  using (not public.current_user_is_tenant() and (public.is_crm_admin() or started_by = public.get_current_staff_id()))
  with check (not public.current_user_is_tenant() and (public.is_crm_admin() or started_by = public.get_current_staff_id()));

grant select, insert, update on public.crm_executions to authenticated;
grant all on public.crm_executions to service_role;

-- lista ao vivo
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_executions') then
    alter publication supabase_realtime add table public.crm_executions;
  end if;
end $$;

-- ---------------------------------------------------------------- arquivos
-- Bucket privado. Caminho: <staff_id>/<execution_id>/<arquivo>. Cada um lê os seus;
-- administrador do CRM lê todos. O download na tela é por link assinado.
insert into storage.buckets (id, name, public) values ('crm-execucoes', 'crm-execucoes', false)
on conflict (id) do nothing;

drop policy if exists "crm execucoes leitura" on storage.objects;
create policy "crm execucoes leitura" on storage.objects for select to authenticated
  using (bucket_id = 'crm-execucoes'
    and ((storage.foldername(name))[1] = public.get_current_staff_id()::text or public.is_crm_admin()));

drop policy if exists "crm execucoes escrita" on storage.objects;
create policy "crm execucoes escrita" on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-execucoes' and (storage.foldername(name))[1] = public.get_current_staff_id()::text);

-- ---------------------------------------------------------------- exportação
-- Linhas do CSV de leads, na mesma ordem de colunas do export do kanban.
-- Só a edge crm-export-leads chama (service_role), em blocos de até 500 ids.
create or replace function public.crm_export_leads_rows(p_ids uuid[])
returns table (
  nome text, empresa text, telefone text, email text, documento text, etapa text, origem text,
  responsavel text, valor text, criado_em text, ultima_atividade text, campanha text, conjunto text,
  anuncio text, tags text
)
language sql stable security definer set search_path = public as $$
  select l.name, l.company, l.phone, l.email, l.document, s.name, o.name, st.name,
    replace(l.opportunity_value::text, '.', ','),
    to_char(l.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    to_char(l.last_activity_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    coalesce(l.campaign_name, l.utm_campaign), coalesce(l.adset_name, l.utm_term), coalesce(l.ad_name, l.utm_content),
    (select string_agg(t.name, ' | ' order by t.name) from crm_lead_tags lt join crm_tags t on t.id = lt.tag_id where lt.lead_id = l.id)
  from crm_leads l
  left join crm_stages s on s.id = l.stage_id
  left join crm_origins o on o.id = l.origin_id
  left join onboarding_staff st on st.id = l.owner_staff_id
  where l.id = any(p_ids)
  order by l.created_at desc
$$;
revoke all on function public.crm_export_leads_rows(uuid[]) from public, anon, authenticated;
grant execute on function public.crm_export_leads_rows(uuid[]) to service_role;
