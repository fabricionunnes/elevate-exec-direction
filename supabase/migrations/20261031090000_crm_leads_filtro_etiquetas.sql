-- 31/10/2026, Fabrício: filtrar Contatos por etiqueta, inclusive quem NÃO tem a etiqueta.
-- crm_leads_filtered ganha as chaves tags (tem alguma) e sem_tags (não tem nenhuma); vale pra lista, ações em massa e template.
CREATE OR REPLACE FUNCTION public.crm_leads_filtered(p_filters jsonb DEFAULT '{}'::jsonb, p_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, created_at timestamp with time zone, can_change_owner boolean, can_delete boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  st record;
  v_admin boolean;
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_search text := nullif(btrim(coalesce(f->>'search', '')), '');
  v_digits text;
  -- cada filtro aceita um valor (chave no singular) ou vários (chave no plural, array); vazio = qualquer
  v_pipelines uuid[] := array_remove(coalesce((select array_agg(nullif(x,'')::uuid) from jsonb_array_elements_text(coalesce(f->'pipelines','[]'::jsonb)) x), '{}') || array[nullif(f->>'pipeline','')::uuid], null);
  v_stages uuid[] := array_remove(coalesce((select array_agg(nullif(x,'')::uuid) from jsonb_array_elements_text(coalesce(f->'stages','[]'::jsonb)) x), '{}') || array[nullif(f->>'stage','')::uuid], null);
  v_owners uuid[] := array_remove(coalesce((select array_agg(nullif(x,'')::uuid) from jsonb_array_elements_text(coalesce(f->'owners','[]'::jsonb)) x), '{}') || array[nullif(f->>'owner','')::uuid], null);
  v_urgencies text[] := array_remove(coalesce((select array_agg(nullif(x,'')) from jsonb_array_elements_text(coalesce(f->'urgencies','[]'::jsonb)) x), '{}') || array[nullif(f->>'urgency','')], null);
  v_dups text := nullif(f->>'dups', '');
  v_lists uuid[] := array_remove(coalesce((select array_agg(nullif(x,'')::uuid) from jsonb_array_elements_text(coalesce(f->'lists','[]'::jsonb)) x), '{}') || array[nullif(f->>'list','')::uuid], null);
  v_ddds text[] := array_remove(coalesce((select array_agg(nullif(regexp_replace(x,'\D','','g'),'')) from jsonb_array_elements_text(coalesce(f->'ddds','[]'::jsonb)) x), '{}') || array[nullif(regexp_replace(coalesce(f->>'ddd',''),'\D','','g'),'')], null);
  -- etiquetas (31/10/2026, Fabrício): "tags" = tem alguma delas; "sem_tags" = não tem nenhuma delas
  v_tags uuid[] := array_remove(coalesce((select array_agg(nullif(x,'')::uuid) from jsonb_array_elements_text(coalesce(f->'tags','[]'::jsonb)) x), '{}'), null);
  v_sem_tags uuid[] := array_remove(coalesce((select array_agg(nullif(x,'')::uuid) from jsonb_array_elements_text(coalesce(f->'sem_tags','[]'::jsonb)) x), '{}'), null);
  v_hidden uuid[] := '{}'; v_only_own uuid[] := '{}'; v_no_owner uuid[] := '{}'; v_no_delete uuid[] := '{}';
begin
  select s.id, s.role, s.tenant_id into st from onboarding_staff s
  where s.user_id = auth.uid() and s.is_active = true limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  v_admin := st.role in ('admin', 'master', 'head_comercial');
  v_digits := regexp_replace(coalesce(v_search, ''), '\D', '', 'g');

  -- a lista do filtro tem que ser uma que a pessoa enxerga
  if cardinality(v_lists) > 0 and (select count(*) from crm_lead_lists ll
    where ll.id = any(v_lists) and ll.tenant_id is not distinct from st.tenant_id
      and (ll.created_by = st.id or ll.is_shared or st.role in ('master', 'admin'))) < cardinality(v_lists) then
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
    and (cardinality(v_pipelines) = 0 or l.pipeline_id = any(v_pipelines))
    and (cardinality(v_stages) = 0 or l.stage_id = any(v_stages))
    and (cardinality(v_owners) = 0 or l.owner_staff_id = any(v_owners))
    and (cardinality(v_urgencies) = 0 or l.urgency = any(v_urgencies))
    and (cardinality(v_ddds) = 0 or public.br_phone_ddd(l.phone) = any(v_ddds))
    and (cardinality(v_lists) = 0 or l.id in (select i.lead_id from crm_lead_list_items i where i.list_id = any(v_lists)))
    and (cardinality(v_tags) = 0 or exists (select 1 from crm_lead_tags t where t.lead_id = l.id and t.tag_id = any(v_tags)))
    and (cardinality(v_sem_tags) = 0 or not exists (select 1 from crm_lead_tags t where t.lead_id = l.id and t.tag_id = any(v_sem_tags)))
    and (v_search is null or l.name ilike '%' || v_search || '%' or l.company ilike '%' || v_search || '%'
         or l.email ilike '%' || v_search || '%' or (v_digits <> '' and l.phone ilike '%' || v_digits || '%'))
    and (v_dups is distinct from 'phone' or right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) in (select dp.k from dup_phone dp))
    and (v_dups is distinct from 'email' or lower(btrim(l.email)) in (select de.k from dup_email de));
end $function$

;
