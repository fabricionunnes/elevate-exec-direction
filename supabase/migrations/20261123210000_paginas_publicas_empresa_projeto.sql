-- Segurança, etapa 2 (parte 4): páginas públicas que liam empresas e projetos.
-- Antes: a lista inteira de empresas e de projetos ficava legível a qualquer visitante
-- só pra essas páginas mostrarem o nome da empresa. Agora elas pedem o dado exato por função.

-- Nome do produto e da empresa de UM projeto (avaliações 360/DISC/clima e briefing social).
create or replace function public.public_project_info(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'product_name', p.product_name,
    'onboarding_company_id', p.onboarding_company_id,
    'company_name', c.name)
  from public.onboarding_projects p
  left join public.onboarding_companies c on c.id = p.onboarding_company_id
  where p.id = p_project_id
  limit 1
$$;
revoke all on function public.public_project_info(uuid) from public;
grant execute on function public.public_project_info(uuid) to anon, authenticated, service_role;

-- Check-in do Ponto de Encontro: busca de empresa por nome (mínimo 2 letras, 8 resultados),
-- igual à tela fazia, sem expor a tabela.
create or replace function public.pe_company_search(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name)), '[]'::jsonb)
  from (
    select c.id, c.name
    from public.onboarding_companies c
    where length(btrim(coalesce(p_query, ''))) >= 2
      and not coalesce(c.oculta, false)
      and c.name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by c.name
    limit 8
  ) x
$$;
revoke all on function public.pe_company_search(text) from public;
grant execute on function public.pe_company_search(text) to anon, authenticated, service_role;

-- Formulários de consultoria (financeiro, marketing e tráfego): leitura e gravação
-- só do formulário do token. Antes qualquer visitante lia e alterava todos.
create or replace function public.consultation_form_tabela(p_tipo text)
returns text
language sql
immutable
as $$
  select case p_tipo
    when 'financial' then 'financial_consultation_forms'
    when 'marketing' then 'marketing_consultation_forms'
    when 'traffic' then 'traffic_analysis_forms'
  end
$$;

create or replace function public.consultation_form_get(p_tipo text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t text := public.consultation_form_tabela(p_tipo);
  r jsonb;
begin
  if t is null or p_token is null or length(p_token) < 16 then
    return null;
  end if;
  execute format($q$
    select to_jsonb(f) || jsonb_build_object('company_name', (
      select c.name from public.onboarding_projects p
      join public.onboarding_companies c on c.id = p.onboarding_company_id
      where p.id = f.project_id))
    from public.%I f where f.access_token = $1 limit 1 $q$, t)
  into r using p_token;
  return r;
end;
$$;
revoke all on function public.consultation_form_get(text, text) from public;
grant execute on function public.consultation_form_get(text, text) to anon, authenticated, service_role;

create or replace function public.consultation_form_update(p_tipo text, p_token text, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := public.consultation_form_tabela(p_tipo);
  v_set text;
  n int;
begin
  if t is null or p_token is null or length(p_token) < 16
     or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return false;
  end if;

  -- Só colunas de resposta: nunca o token, o projeto ou as datas de criação.
  select string_agg(format('%I = r.%I', c.column_name, c.column_name), ', ')
    into v_set
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = t
    and c.column_name in (select jsonb_object_keys(p_patch))
    and c.column_name not in ('id', 'project_id', 'access_token', 'created_at', 'created_by', 'updated_at');

  if v_set is null then
    return false;
  end if;

  execute format($q$
    update public.%I f set %s, updated_at = now()
    from (select (jsonb_populate_record(null::public.%I, $1)).*) r
    where f.access_token = $2 $q$, t, v_set, t)
  using p_patch, p_token;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.consultation_form_update(text, text, jsonb) from public;
grant execute on function public.consultation_form_update(text, text, jsonb) to anon, authenticated, service_role;
