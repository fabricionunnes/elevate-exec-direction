-- Chaves de API do CRM geradas pela tela (Configurações > API e Webhooks), 01/10/2026.
-- Antes, receive-external-lead e update-lead-status aceitavam UM segredo fixo
-- (env EXTERNAL_LEAD_API_KEY) igual pra todo mundo: não dava pra saber quem usava
-- nem cortar um integrador sem derrubar os outros. A chave antiga continua valendo.
-- Guardamos só o hash (sha256) e os 8 primeiros caracteres; o valor aparece uma vez.

-- Staff da UNV (tenant nulo) master/admin. Cliente white-label não gerencia chave:
-- as duas functions gravam no CRM da UNV.
create or replace function public.crm_is_unv_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.onboarding_staff s
    where s.user_id = auth.uid()
      and s.is_active = true
      and s.tenant_id is null
      and s.role in ('master', 'admin')
  );
$$;
grant execute on function public.crm_is_unv_admin() to authenticated, service_role;

create table if not exists public.crm_api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array['leads:create', 'leads:status'],
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  created_by uuid references public.onboarding_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.crm_api_keys enable row level security;

drop policy if exists "crm_api_keys_select_admin" on public.crm_api_keys;
create policy "crm_api_keys_select_admin" on public.crm_api_keys
  for select to authenticated using (public.crm_is_unv_admin());
-- Sem policy de escrita: criar e revogar só pelas funções abaixo (a edge usa service_role).

revoke all on public.crm_api_keys from anon;
revoke insert, update, delete on public.crm_api_keys from authenticated;
grant select on public.crm_api_keys to authenticated;
grant all on public.crm_api_keys to service_role;

-- Cria a chave e devolve o valor em claro UMA vez (não fica guardado em lugar nenhum).
create or replace function public.crm_api_key_create(
  p_name text,
  p_scopes text[] default array['leads:create', 'leads:status'],
  p_pipeline_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_row public.crm_api_keys;
  v_scopes text[];
begin
  if not public.crm_is_unv_admin() then
    raise exception 'Sem permissão pra gerar chave de API';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Dê um nome pra chave (quem vai usar)';
  end if;
  select array_agg(distinct s) into v_scopes
  from unnest(coalesce(p_scopes, array[]::text[])) s
  where s in ('leads:create', 'leads:status');
  if v_scopes is null then
    raise exception 'Escolha pelo menos uma permissão';
  end if;

  -- 192 bits aleatórios (dois uuid v4 dão 244 bits; usamos 48 hex)
  v_key := 'nx_' || substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 48);

  insert into public.crm_api_keys (name, key_hash, key_prefix, scopes, pipeline_id, created_by)
  values (
    trim(p_name),
    encode(sha256(convert_to(v_key, 'UTF8')), 'hex'),
    substr(v_key, 1, 8),
    v_scopes,
    p_pipeline_id,
    public.get_current_staff_id()
  )
  returning * into v_row;

  return json_build_object(
    'id', v_row.id, 'name', v_row.name, 'key', v_key, 'key_prefix', v_row.key_prefix,
    'scopes', v_row.scopes, 'pipeline_id', v_row.pipeline_id, 'created_at', v_row.created_at
  );
end;
$$;
revoke all on function public.crm_api_key_create(text, text[], uuid) from public, anon;
grant execute on function public.crm_api_key_create(text, text[], uuid) to authenticated, service_role;

create or replace function public.crm_api_key_revoke(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_is_unv_admin() then
    raise exception 'Sem permissão pra revogar chave de API';
  end if;
  update public.crm_api_keys set revoked_at = now() where id = p_id and revoked_at is null;
end;
$$;
revoke all on function public.crm_api_key_revoke(uuid) from public, anon;
grant execute on function public.crm_api_key_revoke(uuid) to authenticated, service_role;
