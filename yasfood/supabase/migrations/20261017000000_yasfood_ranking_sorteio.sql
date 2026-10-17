-- Ranking de bairros e ruas (pra mandar no grupo) e sorteio entre quem pediu na rua campeã.
-- Bairro fica no cadastro do cliente; a rua sai do endereço (primeira parte, sem número/casa/apto).

alter table yasfood.customers add column if not exists bairro text not null default '';

-- Nome bonito: tira espaços sobrando, primeira letra maiúscula, "da/de/do/das/dos/e" minúsculo.
create or replace function yasfood.nice_name(s text)
returns text
language plpgsql
immutable
as $$
declare r text;
begin
  r := initcap(lower(trim(regexp_replace(coalesce(s, ''), '\s+', ' ', 'g'))));
  r := replace(' ' || r || ' ', ' Da ', ' da ');
  r := replace(r, ' Das ', ' das ');
  r := replace(r, ' De ', ' de ');
  r := replace(r, ' Do ', ' do ');
  r := replace(r, ' Dos ', ' dos ');
  r := replace(r, ' E ', ' e ');
  r := trim(r);
  return nullif(r, '');
end $$;

-- Chave pra agrupar sem ligar pra acento e maiúscula
create or replace function yasfood.group_key(s text)
returns text
language sql
immutable
as $$
  select nullif(translate(lower(trim(regexp_replace(coalesce(s, ''), '\s+', ' ', 'g'))),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '')
$$;

-- "R. das Acácias, 120, casa 7" -> "Rua das Acácias"
create or replace function yasfood.street_name(a text)
returns text
language plpgsql
immutable
as $$
declare s text;
begin
  s := split_part(coalesce(a, ''), ',', 1);
  s := regexp_replace(s, '\m(apartamento|apto|apt|ap|casa|cs|bloco|bl|torre|lote|lt|quadra|qd|unidade)\.?\s*[[:alnum:]-]+', '', 'gi');
  s := regexp_replace(s, '\s+(n[º°o.]*\s*)?\d+\s*[a-z]?\s*$', '', 'i');
  s := regexp_replace(s, '\s*[-–]\s*$', '');
  s := trim(regexp_replace(s, '\s+', ' ', 'g'));
  s := regexp_replace(s, '^(r|rua)\.?\s+', 'Rua ', 'i');
  s := regexp_replace(s, '^(av|avda|avenida)\.?\s+', 'Avenida ', 'i');
  s := regexp_replace(s, '^(al|alameda)\.?\s+', 'Alameda ', 'i');
  s := regexp_replace(s, '^(tv|trav|travessa)\.?\s+', 'Travessa ', 'i');
  s := regexp_replace(s, '^(p[cç]a?|pra[cç]a)\.?\s+', 'Praça ', 'i');
  s := regexp_replace(s, '^(rod|rodovia)\.?\s+', 'Rodovia ', 'i');
  if length(s) < 4 or s !~ '[[:alpha:]]{3}' then return null; end if;
  return yasfood.nice_name(s);
end $$;

-- Bairro do cliente; sem bairro, usa a região de entrega quando ela é um lugar de verdade
create or replace function yasfood.customer_bairro(p_bairro text, p_zone text)
returns text
language sql
immutable
as $$
  select coalesce(
    yasfood.nice_name(nullif(trim(p_bairro), '')),
    case when p_zone is not null and p_zone !~* '(outros|fora|combinar|meu condom)' then yasfood.nice_name(p_zone) end
  )
$$;

-- Pedidos que contam: não cancelados, com data no período
create or replace function yasfood.ranking_base(p_from date, p_to date)
returns table (order_id uuid, customer_id uuid, customer_name text, customer_phone text, total numeric, bairro text, bairro_key text, rua text, rua_key text)
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select o.id, o.customer_id, coalesce(c.name, o.customer_name), coalesce(c.phone, o.customer_phone), o.total,
         b.bairro, yasfood.group_key(b.bairro), r.rua, yasfood.group_key(r.rua)
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
    select rua_key k, mode() within group (order by rua) as name, mode() within group (order by bairro) as bairro, count(*) as orders,
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

-- Bairros já usados (sugestão no formulário do site; só nomes, sem dado de ninguém)
create or replace function yasfood.known_bairros()
returns setof text
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select name from (
    select mode() within group (order by yasfood.nice_name(bairro)) as name, count(*) n
    from yasfood.customers where trim(bairro) <> '' group by yasfood.group_key(bairro)
  ) s where n >= 1 order by n desc, name limit 60
$$;
grant execute on function yasfood.known_bairros() to anon, authenticated;

-- Histórico de sorteios
create table if not exists yasfood.raffles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_from date,
  period_to date,
  scope text not null check (scope in ('rua', 'bairro', 'todos')),
  scope_label text not null default '',
  prize text not null default '',
  weighted boolean not null default true,
  participants int not null default 0,
  tickets int not null default 0,
  winner_customer_id uuid references yasfood.customers(id) on delete set null,
  winner_name text not null default '',
  winner_phone text not null default '',
  delivered_at timestamptz,
  notes text not null default ''
);
alter table yasfood.raffles enable row level security;
drop policy if exists raffles_admin_all on yasfood.raffles;
create policy raffles_admin_all on yasfood.raffles for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select, insert, update, delete on yasfood.raffles to authenticated;

-- Sorteia no servidor (ninguém mexe no resultado) e grava no histórico.
-- p: {from, to, scope: 'rua'|'bairro'|'todos', key, label, prize, weighted}
create or replace function yasfood.draw_raffle(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = yasfood, public
as $$
declare
  v_scope text := coalesce(p->>'scope', 'rua');
  v_key text := p->>'key';
  v_weighted boolean := coalesce((p->>'weighted')::boolean, true);
  v_from date := nullif(p->>'from', '')::date;
  v_to date := nullif(p->>'to', '')::date;
  v_total int; v_n int; v_pick numeric;
  v_win record; v_id uuid; v_entries jsonb;
begin
  if not yasfood.is_admin() then raise exception 'Só a administradora pode sortear'; end if;
  if v_scope not in ('rua', 'bairro', 'todos') then raise exception 'Tipo de sorteio inválido'; end if;
  if v_scope <> 'todos' and coalesce(v_key, '') = '' then raise exception 'Escolha a rua ou o condomínio do sorteio'; end if;

  drop table if exists _entries;
  create temp table _entries on commit drop as
    select b.customer_id, max(b.customer_name) as name, max(b.customer_phone) as phone,
           case when v_weighted then count(*) else 1 end::int as tickets
    from yasfood.ranking_base(v_from, v_to) b
    where b.customer_id is not null
      and (v_scope = 'todos' or (v_scope = 'rua' and b.rua_key = v_key) or (v_scope = 'bairro' and b.bairro_key = v_key))
    group by b.customer_id;

  select coalesce(sum(tickets), 0), count(*) into v_total, v_n from _entries;
  if v_n = 0 then raise exception 'Ninguém pediu nesse período pra entrar no sorteio'; end if;

  v_pick := floor(random() * v_total);
  select e.* into v_win from (
    select *, sum(tickets) over (order by customer_id) - tickets as acc from _entries
  ) e where v_pick >= e.acc and v_pick < e.acc + e.tickets limit 1;

  insert into yasfood.raffles (period_from, period_to, scope, scope_label, prize, weighted, participants, tickets, winner_customer_id, winner_name, winner_phone)
  values (v_from, v_to, v_scope, coalesce(p->>'label', ''), coalesce(p->>'prize', ''), v_weighted, v_n, v_total, v_win.customer_id, v_win.name, v_win.phone)
  returning id into v_id;

  select jsonb_agg(jsonb_build_object('name', name, 'tickets', tickets) order by random()) into v_entries from _entries;
  return jsonb_build_object('id', v_id, 'winner', jsonb_build_object('customer_id', v_win.customer_id, 'name', v_win.name, 'phone', v_win.phone, 'tickets', v_win.tickets),
                            'participants', v_n, 'tickets', v_total, 'entries', v_entries);
end $$;
grant execute on function yasfood.draw_raffle(jsonb) to authenticated;

-- Pedido pelo site/painel com bairro: grava no cadastro do cliente
create or replace function yasfood.place_order_with_addons(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  r jsonb;
  v_order_id uuid;
  v_a jsonb;
  v_addon yasfood.addons%rowtype;
  v_qty int;
  v_sum numeric(10,2) := 0;
  v_products uuid[];
begin
  -- cliente que já comprou e deixou o nome em branco: usa o nome do cadastro pelo telefone
  if length(trim(coalesce(p->>'name', ''))) < 2 then
    p := jsonb_set(p, '{name}', to_jsonb(coalesce((select c.name from yasfood.customers c where c.phone = yasfood.normalize_phone(p->>'phone')), '')));
  end if;
  r := yasfood.place_order(p);
  v_order_id := (r->>'order_id')::uuid;
  select coalesce(array_agg(distinct product_id), '{}') into v_products from yasfood.order_items where order_id = v_order_id;

  for v_a in select * from jsonb_array_elements(coalesce(p->'addons', '[]'::jsonb)) loop
    v_qty := coalesce((v_a->>'qty')::int, 0);
    continue when v_qty <= 0;
    select * into v_addon from yasfood.addons where id = (v_a->>'addon_id')::uuid and active;
    if not found then raise exception 'ITENS: um adicional não está mais disponível. Atualize a página.'; end if;
    if v_qty > v_addon.max_qty then raise exception 'ITENS: no máximo % de "%"', v_addon.max_qty, v_addon.name; end if;
    if cardinality(v_addon.product_ids) > 0 and not (v_addon.product_ids && v_products) then
      raise exception 'ITENS: o adicional "%" não vale pros itens do carrinho', v_addon.name;
    end if;
    insert into yasfood.order_addons (order_id, addon_id, name, unit_price, qty, line_total)
    values (v_order_id, v_addon.id, v_addon.name, v_addon.price, v_qty, v_addon.price * v_qty);
    v_sum := v_sum + v_addon.price * v_qty;
  end loop;

  if v_sum > 0 then
    update yasfood.orders set addons_total = v_sum where id = v_order_id;
  end if;

  if length(trim(coalesce(p->>'bairro', ''))) >= 2 then
    update yasfood.customers set bairro = yasfood.nice_name(left(p->>'bairro', 80))
    where id = (select customer_id from yasfood.orders where id = v_order_id);
  end if;
  return r || jsonb_build_object('total', (select total from yasfood.orders where id = v_order_id), 'addons_total', v_sum);
end $$;
grant execute on function yasfood.place_order_with_addons(jsonb) to anon, authenticated;
