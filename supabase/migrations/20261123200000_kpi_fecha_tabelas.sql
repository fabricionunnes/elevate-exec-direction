-- Segurança, etapa 2 (parte 3): fecha as tabelas de KPI pra visitante.
-- As páginas públicas (/kpi-entry e /kpi-gestor) já leem e gravam por função com
-- código de acesso (migração 20261123180000). Aqui saem as regras "qualquer um"
-- e entram regras por vínculo: equipe ativa, cliente da empresa e vendedor da empresa.
-- As regras usam (select ...) pra rodar uma vez por consulta, não por linha.

-- Posição anterior (pra desfazer).
insert into public.zz_rls_etapa2_20261123 (tablename, policyname, permissive, cmd, roles, qual, with_check)
select p.tablename, p.policyname, p.permissive, p.cmd, p.roles::text[], p.qual, p.with_check
from pg_policies p
where p.schemaname = 'public'
  and (p.tablename, p.policyname) in (
    ('kpi_entries', 'Public can delete own entries for update'),
    ('kpi_entries', 'Public can insert entries'),
    ('kpi_entries', 'Public can update own entries'),
    ('kpi_entries', 'Public can view own entries'),
    ('kpi_monthly_targets', 'Allow delete kpi_monthly_targets'),
    ('kpi_monthly_targets', 'Allow insert kpi_monthly_targets'),
    ('kpi_monthly_targets', 'Allow read kpi_monthly_targets'),
    ('kpi_monthly_targets', 'Allow update kpi_monthly_targets'),
    ('company_sectors', 'Public can read sectors'),
    ('company_sectors', 'Staff can manage sectors'),
    ('salesperson_sectors', 'Public can read salesperson_sectors'),
    ('salesperson_sectors', 'Staff can manage salesperson_sectors'),
    ('company_daily_goal_settings', 'Allow public read on company_daily_goal_settings'),
    ('company_daily_goal_settings', 'Allow authenticated insert on company_daily_goal_settings'),
    ('company_daily_goal_settings', 'Allow authenticated update on company_daily_goal_settings'),
    ('company_kpis', 'Public can view kpis'),
    ('company_salespeople', 'Public can view salespeople'),
    ('kpi_salespeople', 'Public can view kpi_salespeople'),
    ('kpi_sectors', 'Public can view kpi_sectors'),
    ('kpi_units', 'Public can view kpi_units'),
    ('kpi_teams', 'Public can view kpi_teams'),
    ('kpi_entries', 'Clients can view their company kpi entries'),
    ('kpi_entries', 'Salesperson reads own entries'),
    ('kpi_monthly_targets', 'Salesperson reads monthly targets'),
    ('company_sectors', 'Salesperson reads company sectors'),
    ('company_daily_goal_settings', 'Salesperson reads daily goal settings')
  )
  and not exists (select 1 from public.zz_rls_etapa2_20261123 z where z.tablename = p.tablename and z.policyname = p.policyname);

-- Vendedores das empresas a que o usuário logado pertence (cliente ou vendedor).
create or replace function public.kpi_meus_vendedores()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select sp.id
  from public.company_salespeople sp
  where sp.company_id in (select public.my_portal_company_ids())
     or sp.company_id = (select public.get_salesperson_company_id())
$$;
revoke all on function public.kpi_meus_vendedores() from public, anon;
grant execute on function public.kpi_meus_vendedores() to authenticated, service_role;

-- ---------- kpi_entries
drop policy if exists "Public can delete own entries for update" on public.kpi_entries;
drop policy if exists "Public can insert entries" on public.kpi_entries;
drop policy if exists "Public can update own entries" on public.kpi_entries;
drop policy if exists "Public can view own entries" on public.kpi_entries;
-- As duas leituras antigas de cliente e de vendedor ficam cobertas, com a mesma
-- condição, pela regra nova abaixo. Elas rodavam por linha (antes isso não pesava
-- porque a regra "qualquer um" encurtava a conta): 8,6 mil linhas levavam 215 ms.
drop policy if exists "Clients can view their company kpi entries" on public.kpi_entries;
drop policy if exists "Salesperson reads own entries" on public.kpi_entries;
drop policy if exists "Cliente e vendedor lancam na propria empresa" on public.kpi_entries;
create policy "Cliente e vendedor lancam na propria empresa" on public.kpi_entries
  for all to authenticated
  using (company_id in (select public.my_portal_company_ids())
         or company_id = (select public.get_salesperson_company_id()))
  with check (company_id in (select public.my_portal_company_ids())
              or company_id = (select public.get_salesperson_company_id()));

-- ---------- kpi_monthly_targets
drop policy if exists "Allow delete kpi_monthly_targets" on public.kpi_monthly_targets;
drop policy if exists "Allow insert kpi_monthly_targets" on public.kpi_monthly_targets;
drop policy if exists "Allow read kpi_monthly_targets" on public.kpi_monthly_targets;
drop policy if exists "Allow update kpi_monthly_targets" on public.kpi_monthly_targets;
drop policy if exists "Equipe gerencia metas" on public.kpi_monthly_targets;
create policy "Equipe gerencia metas" on public.kpi_monthly_targets
  for all to authenticated
  using ((select public.gv_is_staff()))
  with check ((select public.gv_is_staff()));
drop policy if exists "Cliente gerencia metas da propria empresa" on public.kpi_monthly_targets;
create policy "Cliente gerencia metas da propria empresa" on public.kpi_monthly_targets
  for all to authenticated
  using (company_id in (select public.my_portal_company_ids()))
  with check (company_id in (select public.my_portal_company_ids()));

-- ---------- company_sectors
drop policy if exists "Public can read sectors" on public.company_sectors;
drop policy if exists "Staff can manage sectors" on public.company_sectors;
drop policy if exists "Equipe gerencia setores" on public.company_sectors;
create policy "Equipe gerencia setores" on public.company_sectors
  for all to authenticated
  using ((select public.gv_is_staff()))
  with check ((select public.gv_is_staff()));
drop policy if exists "Cliente gerencia setores da propria empresa" on public.company_sectors;
create policy "Cliente gerencia setores da propria empresa" on public.company_sectors
  for all to authenticated
  using (company_id in (select public.my_portal_company_ids()))
  with check (company_id in (select public.my_portal_company_ids()));

-- ---------- salesperson_sectors
drop policy if exists "Public can read salesperson_sectors" on public.salesperson_sectors;
drop policy if exists "Staff can manage salesperson_sectors" on public.salesperson_sectors;
drop policy if exists "Equipe gerencia setores do vendedor" on public.salesperson_sectors;
create policy "Equipe gerencia setores do vendedor" on public.salesperson_sectors
  for all to authenticated
  using ((select public.gv_is_staff()))
  with check ((select public.gv_is_staff()));
drop policy if exists "Empresa do usuario gerencia setores do vendedor" on public.salesperson_sectors;
create policy "Empresa do usuario gerencia setores do vendedor" on public.salesperson_sectors
  for all to authenticated
  using (salesperson_id in (select public.kpi_meus_vendedores()))
  with check (salesperson_id in (select public.kpi_meus_vendedores()));

-- ---------- company_daily_goal_settings
drop policy if exists "Allow public read on company_daily_goal_settings" on public.company_daily_goal_settings;
drop policy if exists "Allow authenticated insert on company_daily_goal_settings" on public.company_daily_goal_settings;
drop policy if exists "Allow authenticated update on company_daily_goal_settings" on public.company_daily_goal_settings;
drop policy if exists "Equipe e cliente gerenciam dias da meta" on public.company_daily_goal_settings;
create policy "Equipe e cliente gerenciam dias da meta" on public.company_daily_goal_settings
  for all to authenticated
  using ((select public.gv_is_staff()) or company_id in (select public.my_portal_company_ids()))
  with check ((select public.gv_is_staff()) or company_id in (select public.my_portal_company_ids()));

-- ---------- só leitura de visitante: sai
drop policy if exists "Public can view kpis" on public.company_kpis;
drop policy if exists "Public can view salespeople" on public.company_salespeople;
drop policy if exists "Public can view kpi_salespeople" on public.kpi_salespeople;
drop policy if exists "Public can view kpi_sectors" on public.kpi_sectors;
drop policy if exists "Public can view kpi_units" on public.kpi_units;
drop policy if exists "Public can view kpi_teams" on public.kpi_teams;

-- ---------- leitura do vendedor logado: mesma condição, rodando uma vez por consulta
drop policy if exists "Salesperson reads monthly targets" on public.kpi_monthly_targets;
create policy "Salesperson reads monthly targets" on public.kpi_monthly_targets
  for select to authenticated
  using (company_id = (select public.get_salesperson_company_id()));
drop policy if exists "Salesperson reads company sectors" on public.company_sectors;
create policy "Salesperson reads company sectors" on public.company_sectors
  for select to authenticated
  using (company_id = (select public.get_salesperson_company_id()));
drop policy if exists "Salesperson reads daily goal settings" on public.company_daily_goal_settings;
create policy "Salesperson reads daily goal settings" on public.company_daily_goal_settings
  for select to authenticated
  using (company_id = (select public.get_salesperson_company_id()));
