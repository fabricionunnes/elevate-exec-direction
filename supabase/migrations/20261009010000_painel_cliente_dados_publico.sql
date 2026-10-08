-- Painel de Controle do cliente (link público por token): entrega os dados do painel do projeto
-- (os mesmos que já vão embutidos no HTML público) para a versão em React do painel, que
-- reaproveita os componentes do Painel de Controle do Nexus. Só leitura, só com o token.
create or replace function public.project_dashboard_dados_public(p_token text)
returns table(title text, dados jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.title, d.dados, d.updated_at
  from project_custom_dashboards d
  where p_token is not null and length(p_token) >= 32 and d.public_token = p_token
$$;

revoke all on function public.project_dashboard_dados_public(text) from public;
grant execute on function public.project_dashboard_dados_public(text) to anon, authenticated, service_role;
