-- Tráfego pago (19/10/2026, Fabrício): "o consultor de tráfego também pode ter acesso, o Weslley,
-- a todos os clientes dele somente". Chave de menu `trafego_pago` em staff_menu_permissions; quem
-- não é master/admin vê só os projetos em que é consultor (ou CS).
insert into public.staff_menu_permissions (staff_id, menu_key)
select id, 'trafego_pago' from public.onboarding_staff where id = '33d33570-cac2-4983-9a37-484ece9f41ae'
on conflict (staff_id, menu_key) do nothing;

create or replace function public.trafego_pago_painel(p_from date, p_to date, p_project uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_staff uuid; v_role text; v_restrito boolean;
  v_empresas jsonb; v_totais jsonb; v_serie jsonb; v_campanhas jsonb := '[]'::jsonb; v_leads_nexus jsonb := '[]'::jsonb;
begin
  v_staff := (select get_current_staff_id());
  if v_staff is null then raise exception 'não autorizado'; end if;
  select role into v_role from onboarding_staff where id = v_staff;
  v_restrito := coalesce(v_role, '') not in ('master', 'admin');
  if v_restrito and not exists (select 1 from staff_menu_permissions m where m.staff_id = v_staff and m.menu_key = 'trafego_pago') then
    raise exception 'não autorizado';
  end if;

  with proj as (
    select p.id, p.status, p.product_name, c.name empresa, c.id company_id
    from onboarding_projects p
    join onboarding_companies c on c.id = p.onboarding_company_id
    where ((p.product_name = 'UNV Ads' and p.status in ('active','notice_period','paused'))
       or (p.status <> 'closed' and exists (select 1 from meta_ads_accounts a where a.project_id = p.id and a.is_connected))
       or exists (select 1 from trafego_diario t where t.project_id = p.id and t.dia between p_from and p_to and t.spend > 0))
      and (not v_restrito or p.consultant_id = v_staff or p.cs_id = v_staff)
      and not exists (
        select 1 from meta_ads_accounts a1 join meta_ads_accounts a2 on a2.ad_account_id = a1.ad_account_id and a2.project_id <> a1.project_id
        join onboarding_projects p2 on p2.id = a2.project_id
        where a1.project_id = p.id and a1.is_connected and a2.is_connected and p2.product_name = 'UNV Ads' and p.product_name <> 'UNV Ads'
          and p2.onboarding_company_id = p.onboarding_company_id)
  ), conta as (
    select distinct on (a.project_id) a.project_id, a.ad_account_id, a.ad_account_name, a.is_connected, a.token_expires_at,
           a.meta_account_status_label, a.is_prepaid, a.available_balance, a.amount_owed, a.funding_source,
           a.balance_checked_at, a.balance_error, a.last_synced_at, a.sync_error
    from meta_ads_accounts a order by a.project_id, a.is_connected desc, a.updated_at desc
  ), meta as (
    select t.project_id, sum(t.spend) gasto, sum(t.impressions) impressoes, sum(t.clicks) cliques, sum(t.link_clicks) cliques_link,
           sum(t.leads) leads, sum(t.conversas) conversas, sum(t.compras) compras, sum(t.receita) receita
    from trafego_diario t where t.dia between p_from and p_to group by 1
  ), nexus as (
    select l.project_id,
           count(*) filter (where l.arrived_at::date between p_from and p_to) leads,
           count(*) filter (where l.status = 'fechou' and coalesce(l.closed_at, l.updated_at)::date between p_from and p_to) vendas,
           coalesce(sum(l.sale_value) filter (where l.status = 'fechou' and coalesce(l.closed_at, l.updated_at)::date between p_from and p_to), 0) receita
    from client_traffic_leads l group by 1
  ), linhas as (
    select p.id project_id, p.empresa, p.status status_projeto, p.product_name,
      jsonb_build_object(
        'conectada', coalesce(c.is_connected, false), 'conta', c.ad_account_name, 'conta_id', c.ad_account_id,
        'vence_em', c.token_expires_at, 'situacao', c.meta_account_status_label, 'prepaga', c.is_prepaid,
        'saldo', c.available_balance, 'em_aberto', c.amount_owed, 'forma_pagamento', c.funding_source,
        'saldo_checado_em', c.balance_checked_at, 'saldo_erro', c.balance_error,
        'ultimo_sync', c.last_synced_at, 'sync_erro', c.sync_error) conta,
      coalesce(m.gasto, 0) gasto, coalesce(m.impressoes, 0) impressoes, coalesce(m.cliques, 0) cliques, coalesce(m.cliques_link, 0) cliques_link,
      coalesce(m.leads, 0) leads, coalesce(m.conversas, 0) conversas, coalesce(m.compras, 0) compras, coalesce(m.receita, 0) receita_meta,
      coalesce(n.leads, 0) leads_nexus, coalesce(n.vendas, 0) vendas_nexus, coalesce(n.receita, 0) receita_nexus
    from proj p left join conta c on c.project_id = p.id left join meta m on m.project_id = p.id left join nexus n on n.project_id = p.id
    where p_project is null or p.id = p_project
  )
  select jsonb_agg(to_jsonb(l) || jsonb_build_object(
           'resultados', l.leads + l.conversas,
           'vendas', case when l.vendas_nexus > 0 then l.vendas_nexus else l.compras end,
           'receita', case when l.receita_nexus > 0 then l.receita_nexus else l.receita_meta end,
           'cpl', case when (l.leads + l.conversas) > 0 then round(l.gasto / (l.leads + l.conversas), 2) end,
           'cac', case when (case when l.vendas_nexus > 0 then l.vendas_nexus else l.compras end) > 0
                       then round(l.gasto / (case when l.vendas_nexus > 0 then l.vendas_nexus else l.compras end), 2) end,
           'roas', case when l.gasto > 0 then round((case when l.receita_nexus > 0 then l.receita_nexus else l.receita_meta end) / l.gasto, 2) end
         ) order by l.gasto desc, l.empresa)
  into v_empresas from linhas l;

  select jsonb_build_object(
    'empresas', count(*), 'conectadas', count(*) filter (where (e->'conta'->>'conectada')::boolean),
    'com_gasto', count(*) filter (where (e->>'gasto')::numeric > 0),
    'gasto', coalesce(sum((e->>'gasto')::numeric), 0), 'impressoes', coalesce(sum((e->>'impressoes')::numeric), 0),
    'cliques', coalesce(sum((e->>'cliques')::numeric), 0), 'leads', coalesce(sum((e->>'leads')::numeric), 0),
    'conversas', coalesce(sum((e->>'conversas')::numeric), 0), 'resultados', coalesce(sum((e->>'resultados')::numeric), 0),
    'vendas', coalesce(sum((e->>'vendas')::numeric), 0), 'receita', coalesce(sum((e->>'receita')::numeric), 0),
    'saldo_alerta', count(*) filter (where (e->'conta'->>'prepaga')::boolean and coalesce((e->'conta'->>'saldo')::numeric, 999999) < 150),
    'sem_conexao', count(*) filter (where not coalesce((e->'conta'->>'conectada')::boolean, false))
  ) into v_totais from jsonb_array_elements(coalesce(v_empresas, '[]'::jsonb)) e;
  v_totais := v_totais || jsonb_build_object(
    'cpl', case when (v_totais->>'resultados')::numeric > 0 then round((v_totais->>'gasto')::numeric / (v_totais->>'resultados')::numeric, 2) end,
    'cac', case when (v_totais->>'vendas')::numeric > 0 then round((v_totais->>'gasto')::numeric / (v_totais->>'vendas')::numeric, 2) end,
    'roas', case when (v_totais->>'gasto')::numeric > 0 then round((v_totais->>'receita')::numeric / (v_totais->>'gasto')::numeric, 2) end,
    'restrito', v_restrito);

  select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'gasto', d.gasto, 'leads', d.leads, 'conversas', d.conversas, 'compras', d.compras) order by d.dia), '[]'::jsonb)
  into v_serie
  from (
    select t.dia, sum(t.spend) gasto, sum(t.leads) leads, sum(t.conversas) conversas, sum(t.compras) compras
    from trafego_diario t
    where t.dia between p_from and p_to and (p_project is null or t.project_id = p_project)
      and (not v_restrito or t.project_id in (select id from onboarding_projects where consultant_id = v_staff or cs_id = v_staff))
    group by 1
  ) d;

  if p_project is not null and (not v_restrito or exists (select 1 from onboarding_projects where id = p_project and (consultant_id = v_staff or cs_id = v_staff))) then
    select coalesce(jsonb_agg(jsonb_build_object('campaign_id', x.campaign_id, 'nome', x.nome, 'objetivo', x.objetivo, 'gasto', x.gasto,
             'impressoes', x.impressoes, 'cliques', x.cliques, 'leads', x.leads, 'conversas', x.conversas, 'compras', x.compras, 'receita', x.receita,
             'cpl', case when (x.leads + x.conversas) > 0 then round(x.gasto / (x.leads + x.conversas), 2) end,
             'ultimo_dia', x.ultimo_dia) order by x.gasto desc), '[]'::jsonb)
    into v_campanhas
    from (
      select t.campaign_id, max(t.campaign_name) nome, max(t.objective) objetivo, sum(t.spend) gasto, sum(t.impressions) impressoes,
             sum(t.clicks) cliques, sum(t.leads) leads, sum(t.conversas) conversas, sum(t.compras) compras, sum(t.receita) receita, max(t.dia) ultimo_dia
      from trafego_diario t where t.project_id = p_project and t.dia between p_from and p_to group by 1
    ) x;
    select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.name, 'telefone', l.phone, 'chegou_em', l.arrived_at, 'origem', l.source,
             'status', l.status, 'valor', l.sale_value, 'fechou_em', l.closed_at) order by l.arrived_at desc), '[]'::jsonb)
    into v_leads_nexus
    from client_traffic_leads l where l.project_id = p_project and l.arrived_at::date between p_from and p_to limit 500;
  end if;

  return jsonb_build_object('de', p_from, 'ate', p_to, 'empresas', coalesce(v_empresas, '[]'::jsonb), 'totais', v_totais,
                            'serie', v_serie, 'campanhas', v_campanhas, 'leads_nexus', v_leads_nexus, 'gerado_em', now());
end $$;
