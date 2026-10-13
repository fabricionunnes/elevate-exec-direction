-- Mesclar dois cadastros da mesma pessoa (ex.: pedido pelo WhatsApp com um telefone e pelo app com outro).
-- Os pedidos e avaliações do cadastro removido passam pro que fica; endereço, região, anotações e tags
-- só preenchem o que estiver vazio. O cadastro removido é apagado.
create or replace function yasfood.merge_customers(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_keep yasfood.customers%rowtype;
  v_rem  yasfood.customers%rowtype;
begin
  if not yasfood.is_admin() then raise exception 'Só a administradora pode mesclar clientes'; end if;
  if p_keep = p_remove then raise exception 'DADOS: escolha dois cadastros diferentes'; end if;
  select * into v_keep from yasfood.customers where id = p_keep;
  select * into v_rem  from yasfood.customers where id = p_remove;
  if v_keep.id is null or v_rem.id is null then raise exception 'DADOS: cliente não encontrado'; end if;

  update yasfood.orders  set customer_id = p_keep where customer_id = p_remove;
  update yasfood.reviews set customer_id = p_keep where customer_id = p_remove;

  update yasfood.customers set
    kind      = case when v_keep.kind = 'cliente' or v_rem.kind = 'cliente' then 'cliente' else v_keep.kind end,
    zone_id   = coalesce(v_keep.zone_id, v_rem.zone_id),
    address   = case when v_keep.address = '' then v_rem.address else v_keep.address end,
    reference = case when v_keep.reference = '' then v_rem.reference else v_keep.reference end,
    lat       = coalesce(v_keep.lat, v_rem.lat),
    lng       = coalesce(v_keep.lng, v_rem.lng),
    geo_address = coalesce(v_keep.geo_address, v_rem.geo_address),
    tags      = (select coalesce(array_agg(distinct t), '{}') from unnest(v_keep.tags || v_rem.tags) t),
    notes     = trim(both E'\n' from concat_ws(E'\n', nullif(v_keep.notes, ''), nullif(v_rem.notes, ''),
                  case when v_rem.phone <> v_keep.phone then 'Outro telefone informado: ' || v_rem.phone else null end))
  where id = p_keep;

  delete from yasfood.customers where id = p_remove;
end $$;

grant execute on function yasfood.merge_customers(uuid, uuid) to authenticated;

-- Camila Guimarães: cadastro de 09/10 (pedido pelo WhatsApp) e de 12/10 (pedido pelo app) são a mesma pessoa.
do $$
declare
  v_keep uuid;
  v_rem uuid;
begin
  select id into v_keep from yasfood.customers where lower(name) like 'camila guimar%' order by created_at limit 1;
  select id into v_rem  from yasfood.customers where lower(name) like 'camila guimar%' and id <> v_keep order by created_at desc limit 1;
  if v_keep is not null and v_rem is not null then
    update yasfood.customers set name = 'Camila Guimarães' where id = v_keep;
    -- a função checa is_admin(); a migração roda como dono do banco, então faz o mesmo passo a passo
    update yasfood.orders  set customer_id = v_keep where customer_id = v_rem;
    update yasfood.reviews set customer_id = v_keep where customer_id = v_rem;
    update yasfood.customers k set
      kind = 'cliente',
      zone_id = coalesce(k.zone_id, r.zone_id),
      address = case when k.address = '' then r.address else k.address end,
      reference = case when k.reference = '' then r.reference else k.reference end,
      notes = trim(both E'\n' from concat_ws(E'\n', nullif(k.notes, ''), nullif(r.notes, ''), 'Outro telefone informado no app: ' || r.phone))
    from yasfood.customers r
    where k.id = v_keep and r.id = v_rem;
    delete from yasfood.customers where id = v_rem;
  end if;
end $$;
