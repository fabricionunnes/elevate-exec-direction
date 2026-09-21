-- Miniaturas dos anúncios guardadas no nosso storage (as URLs da Meta expiram em poucos dias) — 21/09/2026
insert into storage.buckets (id, name, public) values ('ad-thumbs','ad-thumbs', true) on conflict (id) do update set public = true;
create table if not exists public.crm_meta_ad_thumbs (
  ad_key text primary key, ad_id text, url text not null, updated_at timestamptz not null default now()
);
alter table public.crm_meta_ad_thumbs enable row level security;
revoke all on public.crm_meta_ad_thumbs from anon;
grant select on public.crm_meta_ad_thumbs to authenticated;
grant all on public.crm_meta_ad_thumbs to service_role;
drop policy if exists crm_meta_ad_thumbs_read on public.crm_meta_ad_thumbs;
create policy crm_meta_ad_thumbs_read on public.crm_meta_ad_thumbs for select to authenticated using (true);
select 1;
