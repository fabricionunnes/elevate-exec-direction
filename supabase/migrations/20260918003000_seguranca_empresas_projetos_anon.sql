-- Segurança 18/09/2026: sem login, empresas e projetos expunham tudo (CPF do dono, contrato, senha de CRM)
-- e qualquer pessoa podia alterar qualquer empresa. Visitante sem login passa a enxergar só as colunas
-- que as páginas públicas usam (nome da empresa; produto do projeto). Usuários logados: nada muda.
revoke all on public.onboarding_companies from anon;
grant select (id, name) on public.onboarding_companies to anon;
revoke all on public.onboarding_projects from anon;
grant select (id, product_name, onboarding_company_id) on public.onboarding_projects to anon;
-- kickoff público agora grava via kickoff_form_save; a regra aberta fica só pra quem está logado
alter policy "Allow public kickoff form updates" on public.onboarding_companies to authenticated;
-- histórico pré-UNV: o kickoff era o único uso sem login e agora vai pela função
drop policy if exists "Anon can delete pre-UNV sales history" on public.company_sales_history;
drop policy if exists "Anon can insert pre-UNV sales history" on public.company_sales_history;
drop policy if exists "Anon can view pre-UNV sales history" on public.company_sales_history;
revoke all on public.company_sales_history from anon;
