-- Contatos do CRM: filtro por DDD. Telefone na base vem em todo formato (55+DDD+9, 0+DDD+8,
-- (11) 9xxxx-xxxx, só 8 dígitos...). br_phone_ddd normaliza e devolve os 2 dígitos do DDD
-- (null quando não dá pra saber). Índice na expressão pra o filtro não varrer 118 mil leads.
CREATE OR REPLACE FUNCTION public.br_phone_ddd(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  select case when length(d2) >= 10 and left(d2, 2) between '11' and '99' then left(d2, 2) end
  from (
    select case when d1 like '0%' and length(d1) in (11, 12) then substr(d1, 2) else d1 end as d2
    from (
      select case when d like '55%' and length(d) >= 12 then substr(d, 3) else d end as d1
      from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) a
    ) b
  ) c
$$;

CREATE INDEX IF NOT EXISTS crm_leads_ddd_idx ON public.crm_leads (public.br_phone_ddd(phone));

CREATE OR REPLACE FUNCTION public.crm_leads_filtered(p_filters jsonb DEFAULT '{}'::jsonb, p_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(id uuid, created_at timestamp with time zone, can_change_owner boolean, can_delete boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  st record;
  v_admin boolean;
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_search text := nullif(btrim(coalesce(f->>'search', '')), '');
  v_digits text;
  v_pipeline uuid := nullif(f->>'pipeline', '')::uuid;
  v_stage uuid := nullif(f->>'stage', '')::uuid;
  v_owner uuid := nullif(f->>'owner', '')::uuid;
  v_urgency text := nullif(f->>'urgency', '');
  v_dups text := nullif(f->>'dups', '');
  v_list uuid := nullif(f->>'list', '')::uuid;
  v_ddd text := nullif(regexp_replace(coalesce(f->>'ddd', ''), '\D', '', 'g'), '');
  v_hidden uuid[] := '{}'; v_only_own uuid[] := '{}'; v_no_owner uuid[] := '{}'; v_no_delete uuid[] := '{}';
begin
  select s.id, s.role, s.tenant_id into st from onboarding_staff s
  where s.user_id = auth.uid() and s.is_active = true limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  v_admin := st.role in ('admin', 'master', 'head_comercial');
  v_digits := regexp_replace(coalesce(v_search, ''), '\D', '', 'g');

  -- a lista do filtro tem que ser uma que a pessoa enxerga
  if v_list is not null and not exists (
    select 1 from crm_lead_lists ll
    where ll.id = v_list and ll.tenant_id is not distinct from st.tenant_id
      and (ll.created_by = st.id or ll.is_shared or st.role in ('master', 'admin'))
  ) then
    raise exception 'Lista não encontrada';
  end if;

  -- Acesso por funil (crm_pipeline_permissions): regra efetiva desta pessoa em cada funil
  -- (linha dela > linha de todos > liberado), resolvida uma vez e guardada em listas. Como
  -- junção, o planner refazia a conta pra cada um dos 118 mil leads.
  if not v_admin then
    select coalesce(array_agg(q.pipeline_id) filter (where not q.can_view), '{}'),
           coalesce(array_agg(q.pipeline_id) filter (where q.only_own_leads), '{}'),
           coalesce(array_agg(q.pipeline_id) filter (where not q.can_change_owner), '{}'),
           coalesce(array_agg(q.pipeline_id) filter (where not q.can_delete), '{}')
      into v_hidden, v_only_own, v_no_owner, v_no_delete
    from (
      select distinct on (pp.pipeline_id) pp.pipeline_id, pp.can_view, pp.only_own_leads, pp.can_change_owner, pp.can_delete
      from crm_pipeline_permissions pp
      where pp.staff_id = st.id or pp.staff_id is null
      order by pp.pipeline_id, pp.staff_id nulls last
    ) q;
  end if;

  return query
  with dup_phone as (
    select right(regexp_replace(coalesce(d.phone, ''), '\D', '', 'g'), 8) k
    from crm_leads d where d.phone is not null
    group by 1 having length(right(regexp_replace(coalesce(d.phone, ''), '\D', '', 'g'), 8)) >= 8 and count(*) > 1
  ), dup_email as (
    select lower(btrim(d.email)) k from crm_leads d where d.email is not null and btrim(d.email) <> ''
    group by 1 having count(*) > 1
  )
  select l.id, l.created_at,
         not coalesce(l.pipeline_id = any(v_no_owner), false),
         not coalesce(l.pipeline_id = any(v_no_delete), false)
  from crm_leads l
  where l.tenant_id is not distinct from st.tenant_id
    -- RLS "CRM users can view leads": admin/head/sdr veem tudo; closer só os seus
    and (st.role in ('admin', 'master', 'head_comercial', 'sdr') or (st.role = 'closer' and l.owner_staff_id = st.id))
    -- RLS "Acesso por funil (ver)"
    and (v_admin or (not coalesce(l.pipeline_id = any(v_hidden), false)
         and (not coalesce(l.pipeline_id = any(v_only_own), false) or l.owner_staff_id = st.id)))
    and (p_ids is null or l.id = any(p_ids))
    and (v_pipeline is null or l.pipeline_id = v_pipeline)
    and (v_stage is null or l.stage_id = v_stage)
    and (v_owner is null or l.owner_staff_id = v_owner)
    and (v_urgency is null or l.urgency = v_urgency)
    and (v_ddd is null or public.br_phone_ddd(l.phone) = v_ddd)
    and (v_list is null or l.id in (select i.lead_id from crm_lead_list_items i where i.list_id = v_list))
    and (v_search is null or l.name ilike '%' || v_search || '%' or l.company ilike '%' || v_search || '%'
         or l.email ilike '%' || v_search || '%' or (v_digits <> '' and l.phone ilike '%' || v_digits || '%'))
    and (v_dups is distinct from 'phone' or right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) in (select dp.k from dup_phone dp))
    and (v_dups is distinct from 'email' or lower(btrim(l.email)) in (select de.k from dup_email de));
end $function$;

-- DDDs que existem na base (pro seletor mostrar só os que têm lead, com contagem)
CREATE OR REPLACE FUNCTION public.crm_leads_ddd_counts()
RETURNS TABLE(ddd text, n bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select public.br_phone_ddd(l.phone) as ddd, count(*) as n
  from crm_leads l
  where l.tenant_id is not distinct from (select s.tenant_id from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1)
    and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active)
  group by 1 having public.br_phone_ddd(l.phone) is not null
  order by 2 desc
$$;
REVOKE ALL ON FUNCTION public.crm_leads_ddd_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_leads_ddd_counts() TO authenticated;
