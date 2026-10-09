-- =====================================================================
-- YasFood — schema completo (loja: Yas Delícias)
-- Pedidos (tipo iFood), agenda de produção com capacidade, entrega com
-- rastreio, estoque com receita, financeiro e login da administradora.
-- =====================================================================

create extension if not exists pgcrypto;

-- Schema próprio: isola o YasFood das tabelas do UNV Nexus no mesmo projeto.
-- Lembrete: expor 'yasfood' em Project Settings → Data API → Exposed schemas.
create schema if not exists yasfood;
grant usage on schema yasfood to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Administradores (Yasmim). Qualquer usuário do auth listado aqui é admin.
-- ---------------------------------------------------------------------
create table if not exists yasfood.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create or replace function yasfood.is_admin()
returns boolean
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select exists (select 1 from yasfood.admins where user_id = auth.uid());
$$;

-- 10) telefone canônico: só dígitos, sem o 55 do país (mesma regra do front)
create or replace function yasfood.normalize_phone(p text)
returns text language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^55(?=\d{10,11}$)', '');
$$;

-- Data "de hoje" no fuso da loja (Supabase roda em UTC)
create or replace function yasfood.today_br()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- ---------------------------------------------------------------------
-- Configurações (linha única)
-- ---------------------------------------------------------------------
create table if not exists yasfood.settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Yas Delícias',
  whatsapp text not null default '5531992372507',
  pix_key text not null default '',
  pix_name text not null default 'Yasmim',
  min_lead_days int not null default 1,
  pickup_enabled boolean not null default true,
  pickup_address text not null default '',
  default_daily_capacity int not null default 10,
  is_open boolean not null default true,
  closed_message text not null default 'Estamos sem receber pedidos no momento. Volte em breve!',
  logo_url text not null default '',
  instagram text not null default '',
  site_url text not null default '',                 -- ex.: https://deliciasdayas.com.br (monta o link de rastreio/avaliação)
  review_auto_enabled boolean not null default true,  -- pedir avaliação automaticamente após a entrega
  review_delay_hours int not null default 3,          -- quantas horas depois de entregue
  review_webhook_url text not null default '',        -- N8N / WhatsApp API: recebe {phone,name,code,link,message}
  review_message text not null default 'Oi {nome}! Aqui é a Yasmim, da Yas Delícias. Espero que tenha gostado! Pode me contar o que achou? É rapidinho, de 1 a 5 estrelas: {link}',
  updated_at timestamptz not null default now()
);
insert into yasfood.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Cardápio
-- ---------------------------------------------------------------------
create table if not exists yasfood.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  weight_g int,
  image_url text,
  category text not null default 'Bolos',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Zonas de entrega e frete
-- ---------------------------------------------------------------------
create table if not exists yasfood.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee numeric(10,2) not null default 0 check (fee >= 0),
  active boolean not null default true,
  sort_order int not null default 0,
  notes text not null default ''
);

-- ---------------------------------------------------------------------
-- Agenda de produção (capacidade por dia)
-- ---------------------------------------------------------------------
create table if not exists yasfood.capacity_days (
  day date primary key,
  max_units int not null default 10 check (max_units >= 0),
  is_open boolean not null default true,
  notes text not null default ''
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists yasfood.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  zone_id uuid references yasfood.delivery_zones(id) on delete set null,
  address text not null default '',
  reference text not null default '',
  notes text not null default '',
  kind text not null default 'lead' check (kind in ('lead','cliente')),
  source text not null default 'cardapio',   -- cardapio, whatsapp, indicacao, grupo, instagram, outro
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create sequence if not exists yasfood.orders_code_seq;

create table if not exists yasfood.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('DY-' || lpad(nextval('yasfood.orders_code_seq')::text, 4, '0')),
  tracking_token uuid not null unique default gen_random_uuid(),
  customer_id uuid references yasfood.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  fulfillment text not null check (fulfillment in ('entrega','retirada')),
  zone_id uuid references yasfood.delivery_zones(id) on delete set null,
  zone_name text,
  address text not null default '',
  reference text not null default '',
  delivery_fee numeric(10,2) not null default 0,
  scheduled_date date not null,
  items_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('pix','dinheiro','cartao')),
  change_for numeric(10,2),
  payment_status text not null default 'pendente' check (payment_status in ('pendente','pago','estornado')),
  status text not null default 'recebido' check (status in ('recebido','confirmado','em_producao','pronto','saiu_entrega','entregue','cancelado')),
  notes text not null default '',
  cancel_reason text,
  stock_consumed boolean not null default false,
  delivered_at timestamptz,
  review_request_due_at timestamptz,   -- quando pedir avaliação
  review_request_sent_at timestamptz,  -- quando foi enviado (webhook ou manual)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_scheduled_date_idx on yasfood.orders (scheduled_date);
create index if not exists orders_status_idx on yasfood.orders (status);
create index if not exists orders_customer_idx on yasfood.orders (customer_id);

create table if not exists yasfood.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references yasfood.orders(id) on delete cascade,
  product_id uuid references yasfood.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  qty int not null check (qty > 0),
  line_total numeric(10,2) not null
);
create index if not exists order_items_order_idx on yasfood.order_items (order_id);

-- Linha do tempo do pedido (rastreio estilo Mercado Livre)
create table if not exists yasfood.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references yasfood.orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on yasfood.order_events (order_id, created_at);

-- ---------------------------------------------------------------------
-- Estoque: insumos, receita por produto, movimentações
-- ---------------------------------------------------------------------
create table if not exists yasfood.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'g' check (unit in ('g','kg','ml','l','un')),
  qty_on_hand numeric(12,3) not null default 0,
  min_qty numeric(12,3) not null default 0,
  cost_per_unit numeric(12,4) not null default 0,
  supplier text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists yasfood.product_ingredients (
  product_id uuid not null references yasfood.products(id) on delete cascade,
  ingredient_id uuid not null references yasfood.ingredients(id) on delete cascade,
  qty numeric(12,3) not null check (qty > 0),
  primary key (product_id, ingredient_id)
);

create table if not exists yasfood.stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references yasfood.ingredients(id) on delete cascade,
  type text not null check (type in ('entrada','saida','ajuste','producao')),
  qty numeric(12,3) not null,            -- positiva entra, negativa sai
  unit_cost numeric(12,4),
  note text not null default '',
  order_id uuid references yasfood.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_ing_idx on yasfood.stock_movements (ingredient_id, created_at);

-- Custo de produção por produto (soma da receita)
create or replace view yasfood.product_costs as
select
  p.id as product_id,
  p.name,
  p.price,
  coalesce(sum(pi.qty * i.cost_per_unit), 0)::numeric(10,2) as cost,
  (p.price - coalesce(sum(pi.qty * i.cost_per_unit), 0))::numeric(10,2) as margin,
  case when p.price > 0 then round((p.price - coalesce(sum(pi.qty * i.cost_per_unit), 0)) / p.price * 100, 1) else 0 end as margin_pct
from yasfood.products p
left join yasfood.product_ingredients pi on pi.product_id = p.id
left join yasfood.ingredients i on i.id = pi.ingredient_id
group by p.id, p.name, p.price;

-- ---------------------------------------------------------------------
-- Avaliações (feedback do cliente após a entrega)
-- ---------------------------------------------------------------------
create table if not exists yasfood.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references yasfood.orders(id) on delete cascade,
  customer_id uuid references yasfood.customers(id) on delete set null,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  approved boolean not null default true,     -- Yasmim pode ocultar
  reply text not null default '',
  created_at timestamptz not null default now()
);

-- Configurações públicas (sem webhook/mensagens internas). View do dono: ignora RLS.
create or replace view yasfood.public_settings as
select id, business_name, whatsapp, pix_key, pix_name, min_lead_days, pickup_enabled, pickup_address,
       is_open, closed_message, logo_url, instagram, site_url
from yasfood.settings;

-- Visão pública (só aprovadas, sem dados sensíveis). View do dono: ignora RLS.
create or replace view yasfood.public_reviews as
select r.id, split_part(r.customer_name, ' ', 1) as first_name, r.rating, r.comment, r.reply, r.created_at
from yasfood.reviews r
where r.approved;

-- Estatísticas de cliente (quantas vezes comprou, quanto gastou, última compra)
create or replace view yasfood.customer_stats as
select
  c.id as customer_id,
  count(o.id) filter (where o.status <> 'cancelado')::int as orders_count,
  coalesce(sum(o.total) filter (where o.status <> 'cancelado'), 0)::numeric(10,2) as total_spent,
  coalesce(avg(o.total) filter (where o.status <> 'cancelado'), 0)::numeric(10,2) as avg_ticket,
  min(o.created_at) as first_order_at,
  max(o.created_at) as last_order_at,
  (yasfood.today_br() - max(o.scheduled_date))::int as days_since_last
from yasfood.customers c
left join yasfood.orders o on o.customer_id = c.id
group by c.id;

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------
create table if not exists yasfood.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receita','despesa')),
  category text not null default 'Outros',
  amount numeric(10,2) not null check (amount >= 0),
  occurred_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  description text not null default '',
  payment_method text,
  order_id uuid references yasfood.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on yasfood.transactions (occurred_on);
create unique index if not exists transactions_order_receita_uq on yasfood.transactions (order_id) where order_id is not null and type = 'receita';

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------


create or replace function yasfood.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists orders_touch on yasfood.orders;
create trigger orders_touch before update on yasfood.orders
for each row execute function yasfood.touch_updated_at();

-- Aplica movimentação no saldo do insumo
create or replace function yasfood.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  update yasfood.ingredients set qty_on_hand = qty_on_hand + new.qty where id = new.ingredient_id;
  if new.type = 'entrada' and new.unit_cost is not null and new.unit_cost > 0 then
    update yasfood.ingredients set cost_per_unit = new.unit_cost where id = new.ingredient_id;
  end if;
  return new;
end $$;

drop trigger if exists stock_movements_apply on yasfood.stock_movements;
create trigger stock_movements_apply after insert on yasfood.stock_movements
for each row execute function yasfood.apply_stock_movement();

-- ---------------------------------------------------------------------
-- Disponibilidade pública (cliente vê vagas por dia)
-- ---------------------------------------------------------------------
create or replace function yasfood.availability(p_from date, p_to date)
returns table (day date, max_units int, is_open boolean, booked_units int, remaining int, bookable boolean)
language sql
stable
security definer
set search_path = yasfood, public
as $$
  with s as (select min_lead_days, is_open as store_open from yasfood.settings where id = 1),
  booked as (
    select o.scheduled_date, coalesce(sum(oi.qty), 0)::int as units
    from yasfood.orders o
    join yasfood.order_items oi on oi.order_id = o.id
    where o.status <> 'cancelado' and o.scheduled_date between p_from and p_to
    group by o.scheduled_date
  )
  select
    c.day,
    c.max_units,
    c.is_open,
    coalesce(b.units, 0) as booked_units,
    greatest(c.max_units - coalesce(b.units, 0), 0) as remaining,
    (c.is_open and s.store_open and c.day >= yasfood.today_br() + s.min_lead_days and (c.max_units - coalesce(b.units, 0)) > 0) as bookable
  from yasfood.capacity_days c
  cross join s
  left join booked b on b.scheduled_date = c.day
  where c.day between p_from and p_to
  order by c.day;
$$;

-- ---------------------------------------------------------------------
-- Criar pedido (chamado pelo cliente, sem login). Preços, frete e
-- capacidade são validados no banco, nunca confiados no front.
-- payload: { name, phone, fulfillment, zone_id, address, reference,
--            scheduled_date, payment_method, change_for, notes,
--            items: [{product_id, qty}] }
-- ---------------------------------------------------------------------
create or replace function yasfood.place_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_settings yasfood.settings%rowtype;
  v_cap yasfood.capacity_days%rowtype;
  v_phone text;
  v_name text;
  v_fulfillment text;
  v_zone yasfood.delivery_zones%rowtype;
  v_fee numeric(10,2) := 0;
  v_date date;
  v_items jsonb;
  v_item jsonb;
  v_product yasfood.products%rowtype;
  v_qty int;
  v_total_qty int := 0;
  v_items_total numeric(10,2) := 0;
  v_booked int;
  v_customer_id uuid;
  v_order_id uuid;
  v_code text;
  v_token uuid;
  v_payment text;
  v_admin boolean := yasfood.is_admin();   -- pedido manual da Yasmim: regras de prazo/limite não travam
begin
  select * into v_settings from yasfood.settings where id = 1;
  if not v_settings.is_open and not v_admin then
    raise exception 'LOJA_FECHADA: %', v_settings.closed_message;
  end if;

  v_name := trim(coalesce(p->>'name', ''));
  v_phone := yasfood.normalize_phone(p->>'phone');
  if length(v_name) < 2 then raise exception 'DADOS: informe seu nome'; end if;
  if length(v_phone) < 10 then raise exception 'DADOS: informe um telefone válido com DDD'; end if;

  v_fulfillment := p->>'fulfillment';
  if v_fulfillment not in ('entrega','retirada') then raise exception 'DADOS: escolha entrega ou retirada'; end if;
  if v_fulfillment = 'retirada' and not v_settings.pickup_enabled then raise exception 'DADOS: retirada indisponível no momento'; end if;

  if v_fulfillment = 'entrega' then
    select * into v_zone from yasfood.delivery_zones where id = nullif(p->>'zone_id','')::uuid and active;
    if not found then raise exception 'ENTREGA: não entregamos nesse endereço'; end if;
    v_fee := v_zone.fee;
    if length(trim(coalesce(p->>'address',''))) < 3 then raise exception 'DADOS: informe o endereço (bloco/apto)'; end if;
  end if;

  v_payment := p->>'payment_method';
  if v_payment not in ('pix','dinheiro','cartao') then raise exception 'DADOS: escolha a forma de pagamento'; end if;

  v_date := nullif(p->>'scheduled_date','')::date;
  if v_date is null then raise exception 'DATA: escolha a data da encomenda'; end if;
  if v_date < yasfood.today_br() + v_settings.min_lead_days and not v_admin then
    raise exception 'DATA: pedidos precisam de pelo menos % dia(s) de antecedência', v_settings.min_lead_days;
  end if;
  if v_date < yasfood.today_br() then raise exception 'DATA: a data já passou'; end if;

  -- trava a linha do dia para evitar overbooking em pedidos simultâneos
  select * into v_cap from yasfood.capacity_days where day = v_date for update;
  if not found and v_admin then
    insert into yasfood.capacity_days (day, max_units, is_open) values (v_date, v_settings.default_daily_capacity, true)
    returning * into v_cap;
  end if;
  if not found or (not v_cap.is_open and not v_admin) then raise exception 'DATA: não estamos produzindo nesse dia'; end if;

  v_items := p->'items';
  if v_items is null or jsonb_array_length(v_items) = 0 then raise exception 'ITENS: seu carrinho está vazio'; end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'ITENS: quantidade inválida'; end if;
    select * into v_product from yasfood.products where id = (v_item->>'product_id')::uuid and active;
    if not found then raise exception 'ITENS: produto indisponível'; end if;
    v_total_qty := v_total_qty + v_qty;
    v_items_total := v_items_total + v_product.price * v_qty;
  end loop;

  select coalesce(sum(oi.qty), 0) into v_booked
  from yasfood.orders o join yasfood.order_items oi on oi.order_id = o.id
  where o.scheduled_date = v_date and o.status <> 'cancelado';

  if v_booked + v_total_qty > v_cap.max_units and not v_admin then
    raise exception 'CAPACIDADE: só temos % unidade(s) disponíveis para esse dia', greatest(v_cap.max_units - v_booked, 0);
  end if;

  -- cliente: cria ou atualiza pelo telefone
  insert into yasfood.customers (name, phone, zone_id, address, reference, kind)
  values (v_name, v_phone, case when v_fulfillment = 'entrega' then v_zone.id else null end,
          coalesce(p->>'address',''), coalesce(p->>'reference',''), 'cliente')
  on conflict (phone) do update
    set name = excluded.name,
        kind = 'cliente',
        zone_id = coalesce(excluded.zone_id, yasfood.customers.zone_id),
        address = case when excluded.address <> '' then excluded.address else yasfood.customers.address end,
        reference = case when excluded.reference <> '' then excluded.reference else yasfood.customers.reference end
  returning id into v_customer_id;

  insert into yasfood.orders (customer_id, customer_name, customer_phone, fulfillment, zone_id, zone_name, address, reference,
                             delivery_fee, scheduled_date, items_total, total, payment_method, change_for, notes)
  values (v_customer_id, v_name, v_phone, v_fulfillment,
          case when v_fulfillment = 'entrega' then v_zone.id else null end,
          case when v_fulfillment = 'entrega' then v_zone.name else null end,
          coalesce(p->>'address',''), coalesce(p->>'reference',''),
          v_fee, v_date, v_items_total, v_items_total + v_fee, v_payment,
          nullif(p->>'change_for','')::numeric, coalesce(p->>'notes',''))
  returning id, code, tracking_token into v_order_id, v_code, v_token;

  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_product from yasfood.products where id = (v_item->>'product_id')::uuid;
    insert into yasfood.order_items (order_id, product_id, product_name, unit_price, qty, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.price, (v_item->>'qty')::int, v_product.price * (v_item->>'qty')::int);
  end loop;

  insert into yasfood.order_events (order_id, status, note) values (v_order_id, 'recebido', 'Pedido recebido. Aguardando confirmação.');

  return jsonb_build_object('order_id', v_order_id, 'code', v_code, 'tracking_token', v_token, 'total', v_items_total + v_fee);
end $$;

-- ---------------------------------------------------------------------
-- Rastreio público pelo token (o cliente recebe o link)
-- ---------------------------------------------------------------------
create or replace function yasfood.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'customer_id' - 'stock_consumed',
    'items', (select coalesce(jsonb_agg(to_jsonb(oi) order by oi.product_name), '[]'::jsonb) from yasfood.order_items oi where oi.order_id = o.id),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb) from yasfood.order_events e where e.order_id = o.id),
    'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'reply', r.reply) from yasfood.reviews r where r.order_id = o.id),
    'settings', (select jsonb_build_object('business_name', s.business_name, 'whatsapp', s.whatsapp, 'pix_key', s.pix_key, 'pix_name', s.pix_name, 'pickup_address', s.pickup_address) from yasfood.settings s where s.id = 1)
  )
  from yasfood.orders o
  where o.tracking_token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Cliente avalia o pedido pelo token (só depois de entregue)
-- ---------------------------------------------------------------------
create or replace function yasfood.submit_review(p_token uuid, p_rating int, p_comment text default '')
returns jsonb
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_order yasfood.orders%rowtype;
  v_id uuid;
begin
  select * into v_order from yasfood.orders where tracking_token = p_token;
  if not found then raise exception 'pedido não encontrado'; end if;
  if v_order.status <> 'entregue' then raise exception 'AVALIACAO: você pode avaliar depois de receber o pedido'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'AVALIACAO: nota de 1 a 5'; end if;
  insert into yasfood.reviews (order_id, customer_id, customer_name, rating, comment)
  values (v_order.id, v_order.customer_id, v_order.customer_name, p_rating, left(coalesce(p_comment,''), 600))
  on conflict (order_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now()
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- ---------------------------------------------------------------------
-- Admin: mudar status (gera evento, baixa estoque ao entrar em produção)
-- ---------------------------------------------------------------------
create or replace function yasfood.set_order_status(p_order_id uuid, p_status text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_order yasfood.orders%rowtype;
  v_default_note text;
  r record;
begin
  if not yasfood.is_admin() then raise exception 'sem permissão'; end if;
  select * into v_order from yasfood.orders where id = p_order_id for update;
  if not found then raise exception 'pedido não encontrado'; end if;
  if p_status not in ('recebido','confirmado','em_producao','pronto','saiu_entrega','entregue','cancelado') then
    raise exception 'status inválido';
  end if;

  v_default_note := case p_status
    when 'confirmado' then 'Pedido confirmado. Entra na fila de produção.'
    when 'em_producao' then 'Seu pedido está sendo preparado com carinho.'
    when 'pronto' then 'Pedido pronto e embalado.'
    when 'saiu_entrega' then 'Saiu para entrega. Fica de olho no interfone!'
    when 'entregue' then case when v_order.fulfillment = 'retirada' then 'Retirado. Bom apetite!' else 'Entregue. Bom apetite!' end
    when 'cancelado' then 'Pedido cancelado.'
    else 'Pedido recebido.' end;

  update yasfood.orders
    set status = p_status,
        delivered_at = case when p_status = 'entregue' then now() else delivered_at end,
        review_request_due_at = case
          when p_status = 'entregue' and review_request_sent_at is null
            then now() + make_interval(hours => (select review_delay_hours from yasfood.settings where id = 1))
          when p_status = 'cancelado' then null
          else review_request_due_at end,
        cancel_reason = case when p_status = 'cancelado' then nullif(p_note,'') else cancel_reason end
  where id = p_order_id;

  insert into yasfood.order_events (order_id, status, note)
  values (p_order_id, p_status, coalesce(nullif(p_note,''), v_default_note));

  -- cancelamento: devolve insumos já baixados e estorna a receita
  if p_status = 'cancelado' then
    if v_order.stock_consumed then
      insert into yasfood.stock_movements (ingredient_id, type, qty, note, order_id)
      select ingredient_id, 'ajuste', -qty, 'Estorno por cancelamento do pedido ' || v_order.code, p_order_id
      from yasfood.stock_movements where order_id = p_order_id and type = 'producao';
      update yasfood.orders set stock_consumed = false where id = p_order_id;
    end if;
    if v_order.payment_status = 'pago' then
      update yasfood.orders set payment_status = 'estornado' where id = p_order_id;
      delete from yasfood.transactions where order_id = p_order_id and type = 'receita';
    end if;
  end if;

  -- baixa de estoque uma única vez, quando entra em produção
  if p_status = 'em_producao' and not v_order.stock_consumed then
    for r in
      select pi.ingredient_id, sum(pi.qty * oi.qty) as qty
      from yasfood.order_items oi
      join yasfood.product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = p_order_id
      group by pi.ingredient_id
    loop
      insert into yasfood.stock_movements (ingredient_id, type, qty, note, order_id)
      values (r.ingredient_id, 'producao', -r.qty, 'Produção do pedido ' || v_order.code, p_order_id);
    end loop;
    update yasfood.orders set stock_consumed = true where id = p_order_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Admin: marcar pago / não pago (gera ou remove a receita no financeiro)
-- ---------------------------------------------------------------------
create or replace function yasfood.set_order_paid(p_order_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_order yasfood.orders%rowtype;
begin
  if not yasfood.is_admin() then raise exception 'sem permissão'; end if;
  select * into v_order from yasfood.orders where id = p_order_id;
  if not found then raise exception 'pedido não encontrado'; end if;

  if p_paid then
    update yasfood.orders set payment_status = 'pago' where id = p_order_id;
    insert into yasfood.transactions (type, category, amount, occurred_on, description, payment_method, order_id)
    values ('receita', 'Vendas', v_order.total, yasfood.today_br(), 'Pedido ' || v_order.code || ' - ' || v_order.customer_name, v_order.payment_method, p_order_id)
    on conflict do nothing;
  else
    update yasfood.orders set payment_status = 'pendente' where id = p_order_id;
    delete from yasfood.transactions where order_id = p_order_id and type = 'receita';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Admin: abrir agenda em lote (ex.: próximos 30 dias, seg a sáb, 10 un)
-- ---------------------------------------------------------------------
create or replace function yasfood.open_capacity_range(p_from date, p_to date, p_max_units int, p_weekdays int[] default array[0,1,2,3,4,5,6], p_overwrite boolean default false)
returns int
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  d date;
  n int := 0;
begin
  if not yasfood.is_admin() then raise exception 'sem permissão'; end if;
  d := p_from;
  while d <= p_to loop
    if extract(dow from d)::int = any(p_weekdays) then
      if p_overwrite then
        insert into yasfood.capacity_days (day, max_units, is_open) values (d, p_max_units, true)
        on conflict (day) do update set max_units = excluded.max_units, is_open = true;
      else
        insert into yasfood.capacity_days (day, max_units, is_open) values (d, p_max_units, true)
        on conflict (day) do nothing;
      end if;
      n := n + 1;
    end if;
    d := d + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Pedido de avaliação automático (X horas após "entregue")
-- Lista o que está na hora e dispara pro webhook (N8N / WhatsApp API).
-- Sem webhook configurado, o painel mostra a fila pra envio manual.
-- ---------------------------------------------------------------------
create or replace function yasfood.build_review_link(p_token uuid)
returns text language sql stable security definer set search_path = yasfood, public as $$
  select rtrim(coalesce((select site_url from yasfood.settings where id = 1), ''), '/') || '/pedido/' || p_token::text || '#avaliar';
$$;

-- interna (sem checagem): usada pelo cron. Nunca exposta à API.
create or replace function yasfood.pending_review_requests_internal()
returns table (order_id uuid, code text, customer_name text, customer_phone text, due_at timestamptz, link text, message text)
language sql stable security definer set search_path = yasfood, public as $$
  select o.id, o.code, o.customer_name, o.customer_phone, o.review_request_due_at,
         yasfood.build_review_link(o.tracking_token),
         replace(replace(replace(s.review_message, '{nome}', split_part(o.customer_name, ' ', 1)), '{link}', yasfood.build_review_link(o.tracking_token)), '{codigo}', o.code)
  from yasfood.orders o cross join yasfood.settings s
  where s.id = 1
    and o.status = 'entregue'
    and o.review_request_sent_at is null
    and o.review_request_due_at is not null
    and o.review_request_due_at <= now()
    and not exists (select 1 from yasfood.reviews r where r.order_id = o.id)
  order by o.review_request_due_at;
$$;

-- pública (painel): exige admin
create or replace function yasfood.pending_review_requests()
returns table (order_id uuid, code text, customer_name text, customer_phone text, due_at timestamptz, link text, message text)
language plpgsql stable security definer set search_path = yasfood, public as $$
begin
  if not yasfood.is_admin() then raise exception 'sem permissão'; end if;
  return query select * from yasfood.pending_review_requests_internal();
end $$;

create or replace function yasfood.mark_review_request_sent(p_order_id uuid)
returns void language sql security definer set search_path = yasfood, public as $$
  update yasfood.orders set review_request_sent_at = now() where id = p_order_id;
$$;

-- Executado pelo pg_cron a cada 10 min. Só dispara se automático estiver ligado e houver webhook.
create or replace function yasfood.dispatch_review_requests()
returns int
language plpgsql
security definer
set search_path = yasfood, public, extensions
as $$
declare
  s yasfood.settings%rowtype;
  r record;
  n int := 0;
begin
  select * into s from yasfood.settings where id = 1;
  if not s.review_auto_enabled or s.review_webhook_url = '' then return 0; end if;
  for r in select * from yasfood.pending_review_requests_internal() loop
    perform net.http_post(
      url := s.review_webhook_url,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'event', 'review_request',
        'order_id', r.order_id, 'code', r.code,
        'name', r.customer_name, 'phone', r.customer_phone,
        'link', r.link, 'message', r.message
      )
    );
    update yasfood.orders set review_request_sent_at = now() where id = r.order_id;
    n := n + 1;
  end loop;
  return n;
end $$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net indisponível: %', sqlerrm; end $$;

do $$
begin
  create extension if not exists pg_cron;
  grant usage on schema cron to postgres;
exception when others then raise notice 'pg_cron indisponível (ative em Database → Extensions): %', sqlerrm; end $$;

do $$
begin
  perform cron.unschedule('yasfood_review_requests') where exists (select 1 from cron.job where jobname = 'yasfood_review_requests');
  perform cron.schedule('yasfood_review_requests', '*/10 * * * *', 'select yasfood.dispatch_review_requests();');
  raise notice 'job yasfood_review_requests agendado (a cada 10 min)';
exception when others then raise notice 'job não agendado: %', sqlerrm; end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table yasfood.admins enable row level security;
alter table yasfood.settings enable row level security;
alter table yasfood.products enable row level security;
alter table yasfood.delivery_zones enable row level security;
alter table yasfood.capacity_days enable row level security;
alter table yasfood.customers enable row level security;
alter table yasfood.orders enable row level security;
alter table yasfood.order_items enable row level security;
alter table yasfood.order_events enable row level security;
alter table yasfood.ingredients enable row level security;
alter table yasfood.product_ingredients enable row level security;
alter table yasfood.stock_movements enable row level security;
alter table yasfood.transactions enable row level security;
alter table yasfood.reviews enable row level security;

-- admins: cada um vê a si mesmo
drop policy if exists admins_self on yasfood.admins;
create policy admins_self on yasfood.admins for select using (user_id = auth.uid());

-- público lê: configurações, produtos ativos, zonas ativas, agenda
drop policy if exists settings_admin_read on yasfood.settings;
create policy settings_admin_read on yasfood.settings for select using (yasfood.is_admin());
drop policy if exists settings_admin_write on yasfood.settings;
create policy settings_admin_write on yasfood.settings for update using (yasfood.is_admin()) with check (yasfood.is_admin());

drop policy if exists products_public_read on yasfood.products;
create policy products_public_read on yasfood.products for select using (active or yasfood.is_admin());
drop policy if exists products_admin_all on yasfood.products;
create policy products_admin_all on yasfood.products for all using (yasfood.is_admin()) with check (yasfood.is_admin());

drop policy if exists zones_public_read on yasfood.delivery_zones;
create policy zones_public_read on yasfood.delivery_zones for select using (active or yasfood.is_admin());
drop policy if exists zones_admin_all on yasfood.delivery_zones;
create policy zones_admin_all on yasfood.delivery_zones for all using (yasfood.is_admin()) with check (yasfood.is_admin());

drop policy if exists capacity_public_read on yasfood.capacity_days;
create policy capacity_public_read on yasfood.capacity_days for select using (true);
drop policy if exists capacity_admin_all on yasfood.capacity_days;
create policy capacity_admin_all on yasfood.capacity_days for all using (yasfood.is_admin()) with check (yasfood.is_admin());

-- privado (só admin): clientes, pedidos, itens, eventos, estoque, financeiro
drop policy if exists customers_admin_all on yasfood.customers;
create policy customers_admin_all on yasfood.customers for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists orders_admin_all on yasfood.orders;
create policy orders_admin_all on yasfood.orders for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists order_items_admin_all on yasfood.order_items;
create policy order_items_admin_all on yasfood.order_items for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists order_events_admin_all on yasfood.order_events;
create policy order_events_admin_all on yasfood.order_events for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists ingredients_admin_all on yasfood.ingredients;
create policy ingredients_admin_all on yasfood.ingredients for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists product_ingredients_admin_all on yasfood.product_ingredients;
create policy product_ingredients_admin_all on yasfood.product_ingredients for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists stock_movements_admin_all on yasfood.stock_movements;
create policy stock_movements_admin_all on yasfood.stock_movements for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists reviews_admin_all on yasfood.reviews;
create policy reviews_admin_all on yasfood.reviews for all using (yasfood.is_admin()) with check (yasfood.is_admin());
drop policy if exists transactions_admin_all on yasfood.transactions;
create policy transactions_admin_all on yasfood.transactions for all using (yasfood.is_admin()) with check (yasfood.is_admin());

-- privilégios: RLS continua valendo; isto só permite a API chegar nas tabelas
grant select on yasfood.products, yasfood.delivery_zones, yasfood.capacity_days to anon;
grant select, insert, update, delete on all tables in schema yasfood to authenticated;
grant usage, select on all sequences in schema yasfood to authenticated;
alter default privileges in schema yasfood grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema yasfood grant usage, select on sequences to authenticated;

-- funções: por padrão PUBLIC pode executar; fechamos tudo e abrimos só o necessário
revoke execute on all functions in schema yasfood from public, anon, authenticated;
alter default privileges in schema yasfood revoke execute on functions from public;
grant execute on function yasfood.availability(date, date) to anon, authenticated;
grant execute on function yasfood.place_order(jsonb) to anon, authenticated;
grant execute on function yasfood.get_order_by_token(uuid) to anon, authenticated;
grant execute on function yasfood.submit_review(uuid, int, text) to anon, authenticated;
grant execute on function yasfood.set_order_status(uuid, text, text) to authenticated;
grant execute on function yasfood.set_order_paid(uuid, boolean) to authenticated;
grant execute on function yasfood.open_capacity_range(date, date, int, int[], boolean) to authenticated;
grant execute on function yasfood.pending_review_requests() to authenticated;
grant execute on function yasfood.mark_review_request_sent(uuid) to authenticated;
-- dispatch/internal/build_review_link: só o dono (cron) executa
grant execute on function yasfood.is_admin() to anon, authenticated;
grant execute on function yasfood.normalize_phone(text) to anon, authenticated;
grant execute on function yasfood.today_br() to anon, authenticated;

-- view de custos só pra admin (RLS das tabelas base já protege via security_invoker)
alter view yasfood.product_costs set (security_invoker = on);
alter view yasfood.customer_stats set (security_invoker = on);
grant select on yasfood.public_reviews to anon, authenticated;
grant select on yasfood.public_settings to anon, authenticated;

-- realtime pro painel da Yasmim
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table yasfood.orders;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table yasfood.order_events;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage: fotos dos produtos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true)
on conflict (id) do nothing;

drop policy if exists produtos_public_read on storage.objects;
create policy produtos_public_read on storage.objects for select using (bucket_id = 'produtos');
drop policy if exists produtos_admin_write on storage.objects;
create policy produtos_admin_write on storage.objects for insert with check (bucket_id = 'produtos' and yasfood.is_admin());
drop policy if exists produtos_admin_update on storage.objects;
create policy produtos_admin_update on storage.objects for update using (bucket_id = 'produtos' and yasfood.is_admin());
drop policy if exists produtos_admin_delete on storage.objects;
create policy produtos_admin_delete on storage.objects for delete using (bucket_id = 'produtos' and yasfood.is_admin());
