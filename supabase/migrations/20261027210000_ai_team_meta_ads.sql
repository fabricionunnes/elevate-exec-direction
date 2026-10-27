-- Time de IA: anúncios que o Max cria na Meta por ordem do dono. Nascem PAUSADOS;
-- ativar é outra ordem explícita. Guarda os ids da Meta pra ativar/pausar depois.
create table if not exists public.ai_team_meta_ads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  ad_account_id text not null,
  campaign_id text not null,
  adset_id text,
  ad_id text,
  creative_id text,
  image_hash text,
  headline text,
  texto text,
  link text,
  orcamento_diario numeric,
  status text not null default 'paused' check (status in ('paused','active','error')),
  erro text,
  created_by uuid,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_team_meta_ads_company_idx on public.ai_team_meta_ads (company_id, created_at desc);

alter table public.ai_team_meta_ads enable row level security;
drop policy if exists ai_team_meta_ads_read on public.ai_team_meta_ads;
create policy ai_team_meta_ads_read on public.ai_team_meta_ads for select using (ai_team_has_access(company_id));
grant select on public.ai_team_meta_ads to authenticated;
grant all on public.ai_team_meta_ads to service_role;
