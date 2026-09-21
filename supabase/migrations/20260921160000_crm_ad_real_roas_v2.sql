CREATE OR REPLACE FUNCTION public.crm_ad_real_roas(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if auth.uid() is not null and get_current_staff_id() is null then raise exception 'sem permissão'; end if;
  with nomes as (
    select distinct on (ad_id) ad_id, regexp_replace(btrim(ad_name), '\s*[—–-]\s*(c[oó]pia|copy)(\s*\d+)?\s*$', '', 'i') nome
    from crm_meta_ads_ads where coalesce(ad_name,'') <> '' order by ad_id, date_start desc
  ), gasto as (
    select upper(n.nome) k, max(n.nome) ad_name, (array_agg(a.campaign_name order by a.spend desc nulls last))[1] campaign_name, count(distinct a.campaign_id) campanhas, sum(a.spend)::numeric spend,
           sum(a.leads)::int meta_leads, sum(a.impressions)::bigint impressions, sum(a.clicks)::bigint clicks,
           (array_agg(a.creative_thumbnail_url order by a.date_start desc) filter (where a.creative_thumbnail_url is not null))[1] thumb
    from crm_meta_ads_ads a join nomes n on n.ad_id = a.ad_id where a.date_start between p_from and p_to group by 1
  ), base as (
    select l.id, upper(coalesce(n.nome, regexp_replace(btrim(l.ad_name), '\s*[—–-]\s*(c[oó]pia|copy)(\s*\d+)?\s*$', '', 'i'))) k, coalesce(n.nome, regexp_replace(btrim(l.ad_name), '\s*[—–-]\s*(c[oó]pia|copy)(\s*\d+)?\s*$', '', 'i')) ad_name, l.created_at, coalesce(l.opportunity_value,0)::numeric valor,
           (s.final_type = 'won') won, coalesce(l.closed_at, l.stage_entered_at, l.updated_at) fechou
    from crm_leads l left join crm_stages s on s.id = l.stage_id left join nomes n on n.ad_id = l.meta_ad_id
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
    select upper(coalesce(n.nome, regexp_replace(btrim(l.ad_name), '\s*[—–-]\s*(c[oó]pia|copy)(\s*\d+)?\s*$', '', 'i'))) k, count(distinct e.lead_id) reunioes
    from crm_meeting_events e join crm_leads l on l.id = e.lead_id left join nomes n on n.ad_id = l.meta_ad_id
    where coalesce(l.ad_name,'') <> '' and e.created_at::date between p_from and p_to and e.event_type in ('realized','realizada','completed','done')
    group by 1
  ), juntos as (
    select coalesce(g.k, c.k) k, coalesce(g.ad_name, c.ad_name) ad_name, g.campaign_name, coalesce(g.campanhas,0) campanhas, coalesce((select t.url from crm_meta_ad_thumbs t where t.ad_key = coalesce(g.k, c.k)), g.thumb) thumb,
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
end $function$
;
