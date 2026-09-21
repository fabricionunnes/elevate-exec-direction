-- ROAS real por anúncio (21/09/2026): gasto da Meta x vendas que o CRM atribui ao anúncio, sem o limite de 7 dias da Meta
create or replace function public.crm_ad_real_roas(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $f$
declare v jsonb;
begin
  if auth.uid() is not null and get_current_staff_id() is null then raise exception 'sem permissão'; end if;
  with gasto as (
    select upper(btrim(ad_name)) k, max(ad_name) ad_name, max(campaign_name) campaign_name, sum(spend)::numeric spend,
           sum(leads)::int meta_leads, sum(impressions)::bigint impressions, sum(clicks)::bigint clicks,
           (array_agg(creative_thumbnail_url order by date_start desc) filter (where creative_thumbnail_url is not null))[1] thumb
    from crm_meta_ads_ads where date_start between p_from and p_to and coalesce(ad_name,'') <> '' group by 1
  ), base as (
    select l.id, upper(btrim(l.ad_name)) k, l.ad_name, l.created_at, coalesce(l.opportunity_value,0)::numeric valor,
           (s.final_type = 'won') won, coalesce(l.closed_at, l.stage_entered_at, l.updated_at) fechou
    from crm_leads l left join crm_stages s on s.id = l.stage_id
    where coalesce(l.ad_name,'') <> ''
  ), crm as (
    select k, max(ad_name) ad_name,
      count(*) filter (where created_at::date between p_from and p_to) leads,
      count(*) filter (where won and fechou::date between p_from and p_to) vendas,
      coalesce(sum(valor) filter (where won and fechou::date between p_from and p_to),0) receita,
      count(*) filter (where won and fechou::date between p_from and p_to and fechou::date - created_at::date <= 7) vendas_7d,
      coalesce(sum(valor) filter (where won and fechou::date between p_from and p_to and fechou::date - created_at::date <= 7),0) receita_7d,
      round(avg(fechou::date - created_at::date) filter (where won and fechou::date between p_from and p_to),1) ciclo_medio
    from base group by 1
  ), reun as (
    select upper(btrim(l.ad_name)) k, count(distinct e.lead_id) reunioes
    from crm_meeting_events e join crm_leads l on l.id = e.lead_id
    where coalesce(l.ad_name,'') <> '' and e.created_at::date between p_from and p_to and e.event_type in ('realized','realizada','completed','done')
    group by 1
  ), juntos as (
    select coalesce(g.k, c.k) k, coalesce(g.ad_name, c.ad_name) ad_name, g.campaign_name, g.thumb,
      coalesce(g.spend,0) spend, coalesce(g.meta_leads,0) meta_leads, coalesce(g.impressions,0) impressions, coalesce(g.clicks,0) clicks,
      coalesce(c.leads,0) leads, coalesce(c.vendas,0) vendas, coalesce(c.receita,0) receita,
      coalesce(c.vendas_7d,0) vendas_7d, coalesce(c.receita_7d,0) receita_7d, c.ciclo_medio, coalesce(r.reunioes,0) reunioes
    from gasto g full join crm c on c.k = g.k left join reun r on r.k = coalesce(g.k, c.k)
  )
  select jsonb_build_object(
    'de', p_from, 'ate', p_to,
    'anuncios', coalesce((select jsonb_agg(to_jsonb(j) - 'k' order by j.receita desc, j.spend desc) from juntos j where j.spend > 0 or j.leads > 0 or j.vendas > 0), '[]'::jsonb),
    'sem_anuncio', (select jsonb_build_object('vendas', count(*), 'receita', coalesce(sum(coalesce(l.opportunity_value,0)),0),
        'de_trafego', count(*) filter (where l.fbclid is not null or lower(coalesce(l.utm_source,'')) in ('facebook','instagram','fb','ig','meta')))
      from crm_leads l join crm_stages s on s.id = l.stage_id
      where s.final_type = 'won' and coalesce(l.ad_name,'') = '' and coalesce(l.closed_at, l.stage_entered_at, l.updated_at)::date between p_from and p_to)
  ) into v;
  return v;
end $f$;
revoke all on function public.crm_ad_real_roas(date,date) from public, anon;
grant execute on function public.crm_ad_real_roas(date,date) to authenticated, service_role;
