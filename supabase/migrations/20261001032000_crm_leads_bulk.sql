-- Contatos do CRM: "sem seleção = todos do filtro" (benchmark Datacrazy).
-- As ações em massa da tela (atribuir, etiqueta, marcar perdido, lista, mesclar) passam a
-- valer pra todos os leads do filtro atual quando nada está marcado. Contagem e aplicação
-- são feitas no banco, porque o PostgREST só devolve 1000 linhas e a base tem mais de
-- 100 mil leads. Mesmo desenho do Atendimento (crm_inbox_bulk com p_dry_run).
--
--  * crm_leads_filtered: os leads que a pessoa ENXERGA e que batem com o filtro. Espelha a
--    RLS de crm_leads (tenant, papel, dono) e o acesso por funil (crm_pipeline_permissions).
--    Uso interno, não fica exposta na API.
--  * crm_leads_page_v2: a página da tela, em cima do mesmo filtro (com o filtro "Lista").
--    A crm_leads_page antiga continua existindo pro front que ainda está no ar.
--  * crm_lead_merge_one: mescla um lead em outro levando o histórico junto. Uso interno.
--  * crm_leads_bulk: conta (p_dry_run) e aplica em lotes; o front chama até acabar.

-- ---------------------------------------------------------------- leads visíveis + filtro
create or replace function public.crm_leads_filtered(p_filters jsonb default '{}'::jsonb, p_ids uuid[] default null)
returns table (id uuid, created_at timestamptz, can_change_owner boolean, can_delete boolean)
language plpgsql stable security definer set search_path = public as $$
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
    and (v_list is null or l.id in (select i.lead_id from crm_lead_list_items i where i.list_id = v_list))
    and (v_search is null or l.name ilike '%' || v_search || '%' or l.company ilike '%' || v_search || '%'
         or l.email ilike '%' || v_search || '%' or (v_digits <> '' and l.phone ilike '%' || v_digits || '%'))
    and (v_dups is distinct from 'phone' or right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) in (select dp.k from dup_phone dp))
    and (v_dups is distinct from 'email' or lower(btrim(l.email)) in (select de.k from dup_email de));
end $$;
revoke all on function public.crm_leads_filtered(jsonb, uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------- página de Contatos
create or replace function public.crm_leads_page_v2(p_filters jsonb default '{}'::jsonb, p_limit integer default 10, p_offset integer default 0)
returns table (id uuid, total bigint, dup_phone boolean, dup_email boolean)
language sql stable security definer set search_path = public as $$
  with pg as (
    select b.id, b.created_at, count(*) over () as total
    from crm_leads_filtered(p_filters, null) b
    order by b.created_at desc, b.id
    limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)
  ), pg2 as (
    -- chaves de duplicado só pras linhas da página
    select pg.id, pg.created_at, pg.total,
      right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) pk,
      lower(btrim(l.email)) ek
    from pg join crm_leads l on l.id = pg.id
  )
  select pg2.id, pg2.total,
    (length(pg2.pk) >= 8 and exists (select 1 from crm_leads x where x.id <> pg2.id
        and right(regexp_replace(coalesce(x.phone, ''), '\D', '', 'g'), 8) = pg2.pk)) as dup_phone,
    (pg2.ek is not null and pg2.ek <> '' and exists (select 1 from crm_leads x where x.id <> pg2.id
        and lower(btrim(x.email)) = pg2.ek)) as dup_email
  from pg2
  order by pg2.created_at desc, pg2.id;
$$;
revoke all on function public.crm_leads_page_v2(jsonb, integer, integer) from public, anon;
grant execute on function public.crm_leads_page_v2(jsonb, integer, integer) to authenticated;

-- ---------------------------------------------------------------- mesclar um lead em outro
-- Preenche no principal o que estiver em branco, leva junto tudo que aponta pro secundário
-- (atividades, histórico, conversas, ligações, arquivos, pagamentos, vendas, listas) e só
-- então apaga o secundário. A merge_crm_leads antiga apagava o lead e o histórico ia embora
-- no cascade (e hoje nem roda: referencia tabelas que não existem).
create or replace function public.crm_lead_merge_one(p_primary uuid, p_secondary uuid, p_staff uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare p crm_leads; s crm_leads;
begin
  if p_primary is null or p_secondary is null or p_primary = p_secondary then return; end if;
  select * into p from crm_leads where id = p_primary for update;
  select * into s from crm_leads where id = p_secondary for update;
  if p.id is null or s.id is null then return; end if;
  if p.tenant_id is distinct from s.tenant_id then
    raise exception 'Leads de contas diferentes não podem ser mesclados';
  end if;

  update crm_leads l set
    phone = coalesce(nullif(btrim(l.phone), ''), s.phone),
    email = coalesce(nullif(btrim(l.email), ''), s.email),
    company = coalesce(nullif(btrim(l.company), ''), s.company),
    document = coalesce(nullif(btrim(l.document), ''), s.document),
    cpf = coalesce(nullif(btrim(l.cpf), ''), s.cpf),
    role = coalesce(nullif(btrim(l.role), ''), s.role),
    city = coalesce(nullif(btrim(l.city), ''), s.city),
    state = coalesce(nullif(btrim(l.state), ''), s.state),
    segment = coalesce(nullif(btrim(l.segment), ''), s.segment),
    instagram = coalesce(nullif(btrim(l.instagram), ''), s.instagram),
    estimated_revenue = coalesce(nullif(btrim(l.estimated_revenue), ''), s.estimated_revenue),
    employee_count = coalesce(nullif(btrim(l.employee_count), ''), s.employee_count),
    main_pain = coalesce(nullif(btrim(l.main_pain), ''), s.main_pain),
    product_id = coalesce(l.product_id, s.product_id),
    owner_staff_id = coalesce(l.owner_staff_id, s.owner_staff_id),
    utm_source = coalesce(l.utm_source, s.utm_source),
    utm_medium = coalesce(l.utm_medium, s.utm_medium),
    utm_campaign = coalesce(l.utm_campaign, s.utm_campaign),
    utm_content = coalesce(l.utm_content, s.utm_content),
    utm_term = coalesce(l.utm_term, s.utm_term),
    notes = case
      when nullif(btrim(l.notes), '') is null then s.notes
      when nullif(btrim(s.notes), '') is null or btrim(s.notes) = btrim(l.notes) then l.notes
      else l.notes || E'\n---\n' || s.notes end,
    opportunity_value = case
      when coalesce(l.opportunity_value, 0) < coalesce(s.opportunity_value, 0) then s.opportunity_value
      else l.opportunity_value end,
    last_activity_at = case
      when l.last_activity_at is null then s.last_activity_at
      when s.last_activity_at is null then l.last_activity_at
      else greatest(l.last_activity_at, s.last_activity_at) end,
    updated_at = now()
  where l.id = p_primary;

  -- o que tem unicidade por lead: entra só o que o principal ainda não tem
  insert into crm_lead_tags (lead_id, tag_id)
    select p_primary, t.tag_id from crm_lead_tags t where t.lead_id = p_secondary
    on conflict do nothing;
  insert into crm_custom_field_values (lead_id, field_id, value)
    select p_primary, v.field_id, v.value from crm_custom_field_values v
    where v.lead_id = p_secondary and nullif(btrim(v.value), '') is not null
    on conflict do nothing;
  insert into crm_lead_list_items (list_id, lead_id, added_by, added_at)
    select i.list_id, p_primary, i.added_by, i.added_at from crm_lead_list_items i where i.lead_id = p_secondary
    on conflict do nothing;

  -- o que só aponta pro lead: muda de dono
  update crm_activities set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_history set lead_id = p_primary where lead_id = p_secondary;
  update crm_meeting_events set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_form_answers set lead_id = p_primary where lead_id = p_secondary;
  update crm_whatsapp_conversations set lead_id = p_primary where lead_id = p_secondary;
  update crm_whatsapp_contacts set lead_id = p_primary where lead_id = p_secondary;
  update instagram_conversations set lead_id = p_primary where lead_id = p_secondary;
  update crm_calls set lead_id = p_primary where lead_id = p_secondary;
  update crm_scheduled_calls set lead_id = p_primary where lead_id = p_secondary;
  update crm_voice_calls set lead_id = p_primary where lead_id = p_secondary;
  update crm_transcriptions set lead_id = p_primary where lead_id = p_secondary;
  update media_transcriptions set lead_id = p_primary where lead_id = p_secondary;
  update crm_attachments set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_files set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_payments set lead_id = p_primary where lead_id = p_secondary;
  update crm_sales set lead_id = p_primary where lead_id = p_secondary;
  update onboarding_projects set crm_lead_id = p_primary where crm_lead_id = p_secondary;
  update public_service_purchases set crm_lead_id = p_primary where crm_lead_id = p_secondary;
  update sales_scanner_submissions set lead_id = p_primary where lead_id = p_secondary;

  insert into crm_lead_history (lead_id, action, field_changed, old_value, new_value, notes, staff_id)
  values (p_primary, 'merge', 'lead', p_secondary::text, p_primary::text,
    'Lead duplicado mesclado neste: ' || coalesce(nullif(btrim(s.name), ''), 'sem nome')
      || case when s.phone is not null then ', ' || s.phone else '' end
      || case when s.email is not null then ', ' || s.email else '' end,
    p_staff);

  delete from crm_leads where id = p_secondary;
end $$;
revoke all on function public.crm_lead_merge_one(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- ações em massa
-- p_ids preenchido = age nos selecionados; vazio = em todos os leads do filtro.
-- p_dry_run = só conta (é o número que a confirmação mostra).
-- Aplica um lote por chamada e devolve "remaining": o front chama de novo até zerar
-- (o tempo limite de uma chamada autenticada é 8s, e mover etapa dispara vários gatilhos).
create or replace function public.crm_leads_bulk(
  p_action text,
  p_payload jsonb default '{}'::jsonb,
  p_filters jsonb default '{}'::jsonb,
  p_ids uuid[] default null,
  p_dry_run boolean default false
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  st record;
  v_admin boolean;
  pl jsonb := coalesce(p_payload, '{}'::jsonb);
  by_ids boolean := p_ids is not null and coalesce(array_length(p_ids, 1), 0) > 0;
  n_total int := 0; n_pending int := 0; n_done int := 0;
  n_skip_perm int := 0; n_skip_won int := 0; n_skip_stage int := 0; n_groups int := 0;
  v_batch int;
  v_staff uuid; v_tag uuid; v_reason uuid; v_list uuid; v_primary uuid;
  v_name text; v_key text;
  v_t0 timestamptz := clock_timestamp();
  r record;
begin
  select os.id, os.role, os.tenant_id into st from onboarding_staff os
  where os.user_id = auth.uid() and os.is_active limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  v_admin := st.role in ('admin', 'master', 'head_comercial');
  if p_action not in ('count', 'assign', 'tag', 'lost', 'add_to_list', 'remove_from_list', 'merge', 'merge_dups') then
    raise exception 'Ação desconhecida: %', p_action;
  end if;

  create temp table if not exists _crm_bulk_target (
    id uuid primary key, can_change_owner boolean, can_delete boolean
  ) on commit drop;
  truncate _crm_bulk_target;
  insert into _crm_bulk_target (id, can_change_owner, can_delete)
  select f.id, f.can_change_owner, f.can_delete
  from crm_leads_filtered(case when by_ids then '{}'::jsonb else p_filters end, case when by_ids then p_ids else null end) f;
  select count(*) into n_total from _crm_bulk_target;

  if p_action = 'count' then
    return json_build_object('count', n_total);
  end if;

  -- ------------------------------------------------------------ atribuir responsável
  if p_action = 'assign' then
    v_staff := nullif(pl->>'staff_id', '')::uuid;
    select s.name into v_name from onboarding_staff s
    where s.id = v_staff and s.is_active and s.tenant_id is not distinct from st.tenant_id;
    if v_name is null then raise exception 'Escolha o responsável'; end if;
    v_batch := least(greatest(coalesce((pl->>'batch')::int, 1500), 1), 3000);

    select count(*) filter (where not t.can_change_owner),
           count(*) filter (where t.can_change_owner and l.owner_staff_id is distinct from v_staff)
      into n_skip_perm, n_pending
    from _crm_bulk_target t join crm_leads l on l.id = t.id;
    if p_dry_run then
      return json_build_object('count', n_total, 'pending', n_pending, 'skipped_permission', n_skip_perm);
    end if;

    with alvo as (
      select l.id, l.owner_staff_id as old_owner
      from _crm_bulk_target t join crm_leads l on l.id = t.id
      where t.can_change_owner and l.owner_staff_id is distinct from v_staff
      order by l.created_at desc limit v_batch
    ), upd as (
      update crm_leads l set owner_staff_id = v_staff from alvo a where l.id = a.id
      returning l.id, a.old_owner
    )
    insert into crm_lead_history (lead_id, action, field_changed, old_value, new_value, notes, staff_id)
    select u.id, 'owner_change', 'owner_staff_id', u.old_owner::text, v_staff::text,
           'Responsável alterado para ' || v_name || ' em massa (tela de Contatos)', st.id
    from upd u;
    get diagnostics n_done = row_count;

  -- ------------------------------------------------------------ etiqueta
  elsif p_action = 'tag' then
    v_tag := nullif(pl->>'tag_id', '')::uuid;
    select tg.name into v_name from crm_tags tg where tg.id = v_tag;
    if v_name is null then raise exception 'Escolha a etiqueta'; end if;
    v_batch := least(greatest(coalesce((pl->>'batch')::int, 5000), 1), 10000);

    select count(*) into n_pending from _crm_bulk_target t
    where not exists (select 1 from crm_lead_tags lt where lt.lead_id = t.id and lt.tag_id = v_tag);
    if p_dry_run then
      return json_build_object('count', n_total, 'pending', n_pending);
    end if;

    insert into crm_lead_tags (lead_id, tag_id)
    select t.id, v_tag from _crm_bulk_target t
    where not exists (select 1 from crm_lead_tags lt where lt.lead_id = t.id and lt.tag_id = v_tag)
    limit v_batch
    on conflict (lead_id, tag_id) do nothing;
    get diagnostics n_done = row_count;

  -- ------------------------------------------------------------ marcar perdido
  -- Cada lead vai pra etapa de perdido do próprio funil. Lead GANHO fica de fora: tirar um
  -- ganho em massa apagaria a venda (crm_sale_sync_on_stage_change). Esse é um por um.
  elsif p_action = 'lost' then
    v_reason := nullif(pl->>'loss_reason_id', '')::uuid;
    select lr.name into v_name from crm_loss_reasons lr where lr.id = v_reason;
    if v_name is null then raise exception 'Escolha o motivo da perda'; end if;
    v_batch := least(greatest(coalesce((pl->>'batch')::int, 300), 1), 500);

    create temp table if not exists _crm_bulk_lost (id uuid primary key, lost_stage uuid, lost_name text, created_at timestamptz) on commit drop;
    truncate _crm_bulk_lost;
    with info as (
      select l.id, l.created_at, sg.final_type as cur_type, ls.id as lost_stage, ls.name as lost_name
      from _crm_bulk_target t
      join crm_leads l on l.id = t.id
      left join crm_stages sg on sg.id = l.stage_id
      left join lateral (
        select s2.id, s2.name from crm_stages s2
        where s2.pipeline_id = l.pipeline_id and s2.final_type = 'lost'
        order by s2.sort_order limit 1
      ) ls on true
    ), cont as (
      select count(*) filter (where i.cur_type = 'won') as won,
             count(*) filter (where i.cur_type is distinct from 'won' and i.cur_type is distinct from 'lost' and i.lost_stage is null) as sem_etapa
      from info i
    ), ins as (
      insert into _crm_bulk_lost (id, lost_stage, lost_name, created_at)
      select i.id, i.lost_stage, i.lost_name, i.created_at from info i
      where i.cur_type is distinct from 'won' and i.cur_type is distinct from 'lost' and i.lost_stage is not null
      returning 1
    )
    select c.won, c.sem_etapa, (select count(*) from ins) into n_skip_won, n_skip_stage, n_pending from cont c;
    if p_dry_run then
      return json_build_object('count', n_total, 'pending', n_pending, 'skipped_won', n_skip_won, 'skipped_no_stage', n_skip_stage);
    end if;

    with alvo as (
      select b.id, b.lost_stage, b.lost_name from _crm_bulk_lost b order by b.created_at desc limit v_batch
    ), upd as (
      update crm_leads l set stage_id = a.lost_stage, loss_reason_id = v_reason, closed_at = now()
      from alvo a where l.id = a.id
      returning l.id, a.lost_name
    )
    insert into crm_lead_history (lead_id, action, field_changed, new_value, notes, staff_id)
    select u.id, 'note_added', 'stage_change_note', u.lost_name,
           'Marcado como perdido em massa. Motivo: ' || v_name, st.id
    from upd u;
    get diagnostics n_done = row_count;

  -- ------------------------------------------------------------ listas
  elsif p_action in ('add_to_list', 'remove_from_list') then
    v_list := nullif(pl->>'list_id', '')::uuid;
    select ll.name into v_name from crm_lead_lists ll
    where ll.id = v_list and ll.tenant_id is not distinct from st.tenant_id
      and (ll.created_by = st.id or ll.is_shared or st.role in ('master', 'admin'));
    if v_name is null then raise exception 'Escolha a lista'; end if;
    v_batch := least(greatest(coalesce((pl->>'batch')::int, 5000), 1), 10000);

    if p_action = 'add_to_list' then
      select count(*) into n_pending from _crm_bulk_target t
      where not exists (select 1 from crm_lead_list_items i where i.list_id = v_list and i.lead_id = t.id);
      if p_dry_run then
        return json_build_object('count', n_total, 'pending', n_pending);
      end if;
      insert into crm_lead_list_items (list_id, lead_id, added_by)
      select v_list, t.id, st.id from _crm_bulk_target t
      where not exists (select 1 from crm_lead_list_items i where i.list_id = v_list and i.lead_id = t.id)
      limit v_batch
      on conflict (list_id, lead_id) do nothing;
      get diagnostics n_done = row_count;
    else
      select count(*) into n_pending from _crm_bulk_target t
      where exists (select 1 from crm_lead_list_items i where i.list_id = v_list and i.lead_id = t.id);
      if p_dry_run then
        return json_build_object('count', n_total, 'pending', n_pending);
      end if;
      delete from crm_lead_list_items i
      where i.list_id = v_list and i.lead_id in (
        select t.id from _crm_bulk_target t
        where exists (select 1 from crm_lead_list_items i2 where i2.list_id = v_list and i2.lead_id = t.id)
        limit v_batch
      );
      get diagnostics n_done = row_count;
    end if;

  -- ------------------------------------------------------------ mesclar os selecionados
  elsif p_action = 'merge' then
    if not v_admin then raise exception 'Só master, admin ou head comercial pode mesclar leads'; end if;
    if not by_ids then raise exception 'Selecione os leads que serão mesclados'; end if;
    v_primary := nullif(pl->>'primary_id', '')::uuid;
    if v_primary is null or not exists (select 1 from _crm_bulk_target t where t.id = v_primary) then
      raise exception 'Escolha o lead principal';
    end if;
    select count(*) filter (where t.can_delete), count(*) filter (where not t.can_delete)
      into n_pending, n_skip_perm
    from _crm_bulk_target t where t.id <> v_primary;
    if p_dry_run then
      return json_build_object('count', n_total, 'pending', n_pending, 'skipped_permission', n_skip_perm);
    end if;
    for r in select t.id from _crm_bulk_target t where t.id <> v_primary and t.can_delete loop
      perform crm_lead_merge_one(v_primary, r.id, st.id);
      n_done := n_done + 1;
    end loop;

  -- ------------------------------------------------------------ mesclar duplicados do filtro
  -- Só junta DUPLICADO EXATO: mesmo funil, mesma chave (telefone com DDD, ou e-mail) e mesmo
  -- nome. A base tem e-mail e telefone "coringa" repetidos em milhares de leads de pessoas
  -- diferentes (um único e-mail aparece em 3.963 leads); juntar só pela chave apagaria gente
  -- que não é duplicada. Pelo mesmo motivo, grupo com mais de 10 leads fica de fora.
  -- Cada grupo vai pro lead com atividade mais recente (empate: o mais antigo). Lead ganho
  -- ou com venda nunca é apagado: vira o principal do grupo ou fica como está.
  elsif p_action = 'merge_dups' then
    if not v_admin then raise exception 'Só master, admin ou head comercial pode mesclar leads'; end if;
    v_key := coalesce(nullif(pl->>'key', ''), nullif(coalesce(p_filters, '{}'::jsonb)->>'dups', ''));
    if v_key is null or v_key not in ('phone', 'email') then
      raise exception 'Ligue o filtro de duplicados (telefone ou e-mail) pra mesclar em massa';
    end if;
    v_batch := least(greatest(coalesce((pl->>'batch')::int, 300), 1), 1000);

    create temp table if not exists _crm_bulk_dups (
      id uuid primary key, k text, primary_id uuid, protegido boolean, can_delete boolean, grande boolean
    ) on commit drop;
    truncate _crm_bulk_dups;
    with base as (
      select l.id, l.created_at, l.last_activity_at, t.can_delete,
             (coalesce(sg.final_type, '') = 'won' or exists (select 1 from crm_sales cs where cs.lead_id = l.id)) as protegido,
             l.pipeline_id::text || '|' ||
             case when v_key = 'phone'
                  then case when length(ph.d) >= 10 then left(ph.d, 2) || right(ph.d, 8) end
                  else nullif(lower(btrim(l.email)), '') end
             || '|' || nullif(lower(regexp_replace(btrim(coalesce(l.name, '')), '\s+', ' ', 'g')), '') as k
      from _crm_bulk_target t
      join crm_leads l on l.id = t.id
      left join crm_stages sg on sg.id = l.stage_id
      -- telefone só com dígitos e sem o 55 do país (mesma regra da br_phone_key: DDD + 8 finais)
      cross join lateral (
        select case when x.raw like '55%' and length(x.raw) >= 12 then substr(x.raw, 3) else x.raw end as d
        from (select regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') as raw) x
      ) ph
    ), ranked as (
      select b.id, b.k, b.protegido, b.can_delete,
             first_value(b.id) over w as primary_id,
             row_number() over w as rn,
             count(*) over (partition by b.k) as c
      from base b where b.k is not null
      window w as (partition by b.k order by b.protegido desc, b.last_activity_at desc nulls last, b.created_at asc, b.id)
    )
    insert into _crm_bulk_dups (id, k, primary_id, protegido, can_delete, grande)
    select x.id, x.k, x.primary_id, x.protegido, x.can_delete, x.c > 10 from ranked x where x.c > 1 and x.rn > 1;

    select count(*) filter (where not d.grande and not d.protegido and d.can_delete),
           count(*) filter (where not d.grande and d.protegido),
           count(*) filter (where not d.grande and not d.protegido and not d.can_delete),
           count(distinct d.k) filter (where not d.grande and not d.protegido and d.can_delete),
           count(*) filter (where d.grande)
      into n_pending, n_skip_won, n_skip_perm, n_groups, n_skip_stage
    from _crm_bulk_dups d;
    if p_dry_run then
      return json_build_object('count', n_total, 'pending', n_pending, 'groups', n_groups,
        'skipped_won', n_skip_won, 'skipped_permission', n_skip_perm, 'skipped_large', n_skip_stage, 'key', v_key);
    end if;
    n_skip_stage := 0;
    -- mescla enquanto couber no tempo da chamada (limite de 8s pra usuário logado)
    for r in
      select d.id, d.primary_id from _crm_bulk_dups d
      where not d.grande and not d.protegido and d.can_delete
      order by d.k, d.id limit v_batch
    loop
      perform crm_lead_merge_one(r.primary_id, r.id, st.id);
      n_done := n_done + 1;
      exit when clock_timestamp() - v_t0 > interval '5 seconds';
    end loop;
  end if;

  return json_build_object(
    'count', n_total,
    'pending', n_pending,
    'affected', n_done,
    'remaining', greatest(n_pending - n_done, 0),
    'skipped_permission', n_skip_perm,
    'skipped_won', n_skip_won,
    'skipped_no_stage', n_skip_stage
  );
end $$;
revoke all on function public.crm_leads_bulk(text, jsonb, jsonb, uuid[], boolean) from public, anon;
grant execute on function public.crm_leads_bulk(text, jsonb, jsonb, uuid[], boolean) to authenticated;
