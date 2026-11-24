-- Planilha diária de vendas: o print do "acompanhamento de vendas diário" que a gestão do cliente manda
-- no grupo vira lançamento no Nexus (função kpi-planilha-diaria) e o resumo do dia sai em seguida.
-- Liga por empresa em company_automation_settings (automation_key = 'planilha_diaria'); sem linha = desligada.

create table if not exists public.kpi_planilha_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  entry_date date,
  status text not null,            -- ok | divergente | bloqueada | erro
  vendido_dia numeric,
  vendido_mes numeric,
  leitura jsonb,                   -- o que a IA leu do print
  resultado jsonb,                 -- o que mudou no Nexus (ou por que travou)
  origem text,
  created_at timestamptz not null default now()
);
create index if not exists idx_kpi_planilha_log_company on public.kpi_planilha_log (company_id, created_at desc);

alter table public.kpi_planilha_log enable row level security;
revoke all on public.kpi_planilha_log from anon, authenticated;
grant all on public.kpi_planilha_log to service_role;
drop policy if exists "Equipe le o registro da planilha diaria" on public.kpi_planilha_log;
create policy "Equipe le o registro da planilha diaria" on public.kpi_planilha_log
  for select to authenticated using ((select public.gv_is_staff()));
grant select on public.kpi_planilha_log to authenticated;

-- Zenith Financeira: primeira empresa com a planilha como fonte dos números
insert into public.company_automation_settings (company_id, automation_key, enabled, updated_at)
values ('1624c6ab-8a28-4c83-a508-d9960fc8f7f8', 'planilha_diaria', true, now())
on conflict (company_id, automation_key) do update set enabled = true, updated_at = now();
