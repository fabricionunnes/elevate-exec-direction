-- "Mamore" e "Rua Mamoré" são a mesma rua: a chave da rua ignora o tipo (Rua, Avenida, Alameda…),
-- acento e maiúscula. No nome mostrado, vale a forma completa mais usada ("Rua Mamoré").

create or replace function yasfood.street_key(rua text)
returns text
language sql
immutable
as $$
  select yasfood.group_key(regexp_replace(coalesce(rua, ''), '^(rua|avenida|alameda|travessa|pra[cç]a|rodovia)\s+', '', 'i'))
$$;

create or replace function yasfood.ranking_base(p_from date, p_to date)
returns table (order_id uuid, customer_id uuid, customer_name text, customer_phone text, total numeric, bairro text, bairro_key text, rua text, rua_key text)
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select o.id, o.customer_id, coalesce(c.name, o.customer_name), coalesce(c.phone, o.customer_phone), o.total,
         b.bairro, yasfood.group_key(b.bairro), r.rua, yasfood.street_key(r.rua)
  from yasfood.orders o
  left join yasfood.customers c on c.id = o.customer_id
  left join yasfood.delivery_zones z on z.id = coalesce(c.zone_id, o.zone_id)
  cross join lateral (select yasfood.customer_bairro(c.bairro, coalesce(z.name, o.zone_name)) as bairro) b
  cross join lateral (select yasfood.street_name(coalesce(nullif(trim(o.address), ''), c.address)) as rua) r
  where o.status <> 'cancelado'
    and (p_from is null or o.scheduled_date >= p_from)
    and (p_to is null or o.scheduled_date <= p_to)
$$;
revoke all on function yasfood.ranking_base(date, date) from public, anon, authenticated;

create or replace function yasfood.neighborhood_ranking(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = yasfood, public
as $$
declare r jsonb;
begin
  if not yasfood.is_admin() then raise exception 'Só a administradora vê o ranking'; end if;
  with b as (select * from yasfood.ranking_base(p_from, p_to)),
  bairros as (
    select bairro_key k, mode() within group (order by bairro) as name, count(*) as orders, count(distinct coalesce(customer_id::text, customer_phone)) as customers, sum(total) as total
    from b where bairro_key is not null group by bairro_key
  ),
  ruas as (
    select rua_key k,
           coalesce(mode() within group (order by rua) filter (where rua ~ '^(Rua|Avenida|Alameda|Travessa|Praça|Rodovia) ' and rua ~ '[áàâãéêíóôõúç]'),
                    mode() within group (order by rua) filter (where rua ~ '^(Rua|Avenida|Alameda|Travessa|Praça|Rodovia) '),
                    mode() within group (order by rua)) as name,
           mode() within group (order by bairro) as bairro, count(*) as orders,
           count(distinct coalesce(customer_id::text, customer_phone)) as customers, sum(total) as total
    from b where rua_key is not null group by rua_key
  )
  select jsonb_build_object(
    'orders', (select count(*) from b),
    'sem_bairro', (select count(*) from b where bairro_key is null),
    'sem_rua', (select count(*) from b where rua_key is null),
    'bairros', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'name', name, 'orders', orders, 'customers', customers, 'total', total) order by orders desc, customers desc, name) from bairros), '[]'::jsonb),
    'ruas', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'name', name, 'bairro', bairro, 'orders', orders, 'customers', customers, 'total', total) order by orders desc, customers desc, name) from ruas), '[]'::jsonb),
    'sem_bairro_clientes', coalesce((
      select jsonb_agg(x order by x->>'name') from (
        select distinct on (c.id) jsonb_build_object('id', c.id, 'name', c.name, 'address', c.address, 'geo_address', c.geo_address) x
        from b join yasfood.customers c on c.id = b.customer_id where b.bairro_key is null
      ) s), '[]'::jsonb)
  ) into r;
  return r;
end $$;
grant execute on function yasfood.neighborhood_ranking(date, date) to authenticated;
