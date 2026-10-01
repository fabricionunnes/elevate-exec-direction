-- Ferramentas configuráveis nos agentes de IA do CRM (benchmark Datacrazy).
--
-- 1) crm_ai_agents.enabled_tools: liga/desliga por ferramenta. NULL = comportamento
--    de sempre (as ferramentas antigas ligadas, as novas desligadas), então agente que
--    ninguém mexeu continua exatamente igual.
-- 2) crm_agent_mcp_servers: servidores MCP externos. O segredo fica numa coluna que o
--    front NÃO consegue ler de volta (privilégio de coluna): quem lê é só o service_role,
--    dentro das edge functions. A tela usa a view sem o segredo.

alter table public.crm_ai_agents add column if not exists enabled_tools jsonb;
comment on column public.crm_ai_agents.enabled_tools is
  'Mapa {nome_da_ferramenta: true|false}. NULL ou chave ausente = padrão (antigas ligadas, novas desligadas).';

create table if not exists public.crm_agent_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.crm_ai_agents(id) on delete cascade, -- NULL = todos os agentes
  name text not null check (char_length(btrim(name)) between 2 and 60),
  url text not null check (url ~* '^https://[^[:space:]]+$' and char_length(url) <= 500),
  auth_type text not null default 'none' check (auth_type in ('none', 'bearer', 'header')),
  auth_header_name text check (auth_header_name is null or auth_header_name ~ '^[A-Za-z0-9-]{1,64}$'),
  secret text check (secret is null or char_length(secret) <= 4000),
  has_secret boolean generated always as (secret is not null and secret <> '') stored,
  allowed_tools text[] not null default '{}', -- vazio = nenhuma liberada
  tools_cache jsonb,                          -- o que o servidor ofereceu no último teste (gravado só pela edge)
  is_active boolean not null default true,
  timeout_ms integer not null default 8000 check (timeout_ms between 1000 and 20000),
  last_probe_at timestamptz,
  last_probe_ok boolean,
  last_probe_error text,
  tenant_id uuid,
  created_by uuid references public.onboarding_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_agent_mcp_servers_agent on public.crm_agent_mcp_servers (agent_id) where is_active;

-- Trocar o endereço invalida o que foi aprovado: as ferramentas liberadas eram do
-- servidor antigo e o segredo passaria a ir pra um destino que ninguém testou.
create or replace function public.crm_agent_mcp_servers_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.url is distinct from old.url then
    new.allowed_tools := '{}';
    new.tools_cache := null;
    new.last_probe_at := null;
    new.last_probe_ok := null;
    new.last_probe_error := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_agent_mcp_servers_guard on public.crm_agent_mcp_servers;
create trigger trg_crm_agent_mcp_servers_guard
  before insert or update on public.crm_agent_mcp_servers
  for each row execute function public.crm_agent_mcp_servers_guard();

alter table public.crm_agent_mcp_servers enable row level security;

drop policy if exists mcp_srv_read on public.crm_agent_mcp_servers;
create policy mcp_srv_read on public.crm_agent_mcp_servers
  for select to authenticated using (public.is_crm_admin());

drop policy if exists mcp_srv_insert on public.crm_agent_mcp_servers;
create policy mcp_srv_insert on public.crm_agent_mcp_servers
  for insert to authenticated with check (public.is_crm_master_or_admin());

drop policy if exists mcp_srv_update on public.crm_agent_mcp_servers;
create policy mcp_srv_update on public.crm_agent_mcp_servers
  for update to authenticated using (public.is_crm_master_or_admin()) with check (public.is_crm_master_or_admin());

drop policy if exists mcp_srv_delete on public.crm_agent_mcp_servers;
create policy mcp_srv_delete on public.crm_agent_mcp_servers
  for delete to authenticated using (public.is_crm_master_or_admin());

-- Privilégio por COLUNA: o front escreve o segredo, mas não tem SELECT nele.
-- tools_cache e last_probe_* só a edge (service_role) grava.
revoke all on public.crm_agent_mcp_servers from anon, authenticated;
grant select (id, agent_id, name, url, auth_type, auth_header_name, has_secret, allowed_tools, tools_cache,
              is_active, timeout_ms, last_probe_at, last_probe_ok, last_probe_error, tenant_id, created_by,
              created_at, updated_at)
  on public.crm_agent_mcp_servers to authenticated;
grant insert (id, agent_id, name, url, auth_type, auth_header_name, secret, allowed_tools, is_active,
              timeout_ms, tenant_id, created_by)
  on public.crm_agent_mcp_servers to authenticated;
grant update (agent_id, name, url, auth_type, auth_header_name, secret, allowed_tools, is_active, timeout_ms)
  on public.crm_agent_mcp_servers to authenticated;
grant delete on public.crm_agent_mcp_servers to authenticated;
grant all on public.crm_agent_mcp_servers to service_role;

-- View da tela: tudo menos o segredo. security_invoker = RLS e privilégios de quem consulta.
create or replace view public.crm_agent_mcp_servers_view
with (security_invoker = true) as
select id, agent_id, name, url, auth_type, auth_header_name, has_secret, allowed_tools, tools_cache,
       is_active, timeout_ms, last_probe_at, last_probe_ok, last_probe_error, tenant_id, created_by,
       created_at, updated_at
from public.crm_agent_mcp_servers;

revoke all on public.crm_agent_mcp_servers_view from anon, authenticated;
grant select on public.crm_agent_mcp_servers_view to authenticated, service_role;
